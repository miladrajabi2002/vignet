import { prisma } from '@/lib/prisma'
import { isMarketingOptOutMessage } from '@/lib/crm/marketing-consent'
import type { InboundMessage } from '@/lib/channels/types'
import type { MessengerType } from '@/lib/channels/registry'

/**
 * Consecutive-message batching (wait-and-merge).
 *
 * Customers type «سلام» «خوبین» «محصول فلان رو دارین؟» as three rapid-fire
 * messages. Replying per message produced several interrupting answers with
 * no shared context — and each one burned an AI credit. Instead, the turn
 * that reaches the AI first holds the conversation turn-lease, watches the
 * inbound-event ledger for newer sibling events in the same thread, absorbs
 * them into its own turn and answers ONCE with the combined text.
 *
 * How absorption stays safe with the ledger:
 *  - An absorbed row is atomically finalized as COMPLETED with
 *    result.outcome = 'MERGED_INTO_TURN'. Its own job — either queued or
 *    already waiting on the conversation lease — later fails its fencing
 *    assert (LeaseLost) or re-claims into 'completed', and in both cases
 *    skips without sending anything.
 *  - The absorbing turn persists each absorbed text as a normal USER
 *    message, so the inbox thread keeps every message visible.
 *  - failInboundEvent() never reverts a COMPLETED row, so a losing job
 *    cannot resurrect a merged event.
 */

/** Event kinds that live in the same DM thread and benefit from merging.
 * Comments are public and must stay instant; reactions are emoji-only. */
const MERGEABLE_EVENT_TYPES = new Set(['DM', 'STORY_REPLY', 'STORY_MENTION'])

const MAX_ABSORBED_MESSAGES = 5
const MAX_ABSORB_TEXT_CHARS = 2_000
/** Never look back before the current turn's own event. */
const NOT_BEFORE_GRACE_MS = 2_000

function intFromEnv(name: string, fallback: number): number {
        const raw = process.env[name]
        const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Quiet-window: how long a turn waits for a possible sibling message. */
const BATCH_QUIET_MS = intFromEnv('INBOUND_BATCH_QUIET_MS', 4_000)
/** Hard ceiling on the whole wait, even if messages keep arriving. */
const BATCH_MAX_WINDOW_MS = intFromEnv('INBOUND_BATCH_MAX_WINDOW_MS', 15_000)
const BATCH_POLL_MS = intFromEnv('INBOUND_BATCH_POLL_MS', 1_000)

export interface AbsorbedInbound {
        eventId: string
        text: string
        kind?: string
}

export interface AbsorbConsecutiveParams {
        workspaceId: string
        channelId: string
        conversationKey: string
        conversationId: string
        /** The absorbing turn's own ledger event id. */
        currentEventId: string
        /** Persist an absorbed text as a USER message; returns its message id. */
        persistInbound: (text: string, eventId: string, kind?: string) => Promise<string | null>
}

/**
 * True when this inbound should take part in wait-and-merge batching:
 * only DM-thread kinds, never comments/reactions, and only when the
 * current message itself is text (media-only turns are answered as before).
 */
export function shouldBatchConsecutiveMessages(
        type: MessengerType,
        msg: InboundMessage,
): boolean {
        void type
        const kind = msg.kind ?? 'DM'
        return MERGEABLE_EVENT_TYPES.has(kind) && !!msg.text?.trim()
}

/**
 * Wait through a quiet window and absorb newer sibling events of the same
 * conversation into the current turn. Returns the absorbed messages in
 * arrival order.
 */
export async function absorbConsecutiveInboundMessages(
        params: AbsorbConsecutiveParams,
): Promise<AbsorbedInbound[]> {
        const startedAt = Date.now()
        const notBefore = new Date(startedAt - NOT_BEFORE_GRACE_MS)
        let quietUntil = startedAt + BATCH_QUIET_MS
        const hardDeadline = startedAt + BATCH_MAX_WINDOW_MS
        const absorbed: AbsorbedInbound[] = []
        const skipped = new Set<string>()

        while (Date.now() < quietUntil && Date.now() < hardDeadline) {
                await sleep(BATCH_POLL_MS)

                const candidates = await prisma.inboundEvent.findMany({
                        where: {
                                workspaceId: params.workspaceId,
                                channelId: params.channelId,
                                conversationKey: params.conversationKey,
                                id: { not: params.currentEventId },
                                state: { in: ['RECEIVED', 'PROCESSING'] },
                                eventType: { in: [...MERGEABLE_EVENT_TYPES] },
                                createdAt: { gte: notBefore },
                        },
                        orderBy: { createdAt: 'asc' },
                        take: 10,
                        select: { id: true, eventType: true, payload: true },
                })

                for (const candidate of candidates) {
                        if (absorbed.length >= MAX_ABSORBED_MESSAGES) return absorbed
                        if (skipped.has(candidate.id) || absorbed.some((a) => a.eventId === candidate.id)) {
                                continue
                        }

                        const text = extractPayloadText(candidate.payload)
                        if (!text || text.length > MAX_ABSORB_TEXT_CHARS || isMarketingOptOutMessage(text)) {
                                // Media-only or sensitive turns process on their own.
                                skipped.add(candidate.id)
                                continue
                        }

                        // Atomically take the event away from its (queued or lock-waiting)
                        // owner. Exactly one writer wins; everyone else sees COMPLETED.
                        const now = new Date()
                        const taken = await prisma.inboundEvent.updateMany({
                                where: { id: candidate.id, state: { in: ['RECEIVED', 'PROCESSING'] } },
                                data: {
                                        state: 'COMPLETED',
                                        completedAt: now,
                                        leaseOwner: null,
                                        leaseExpiresAt: null,
                                        effectsCommittedAt: now,
                                        conversationId: params.conversationId,
                                        result: { outcome: 'MERGED_INTO_TURN', mergedInto: params.currentEventId },
                                },
                        })
                        if (taken.count !== 1) {
                                skipped.add(candidate.id)
                                continue
                        }

                        const kind = extractPayloadKind(candidate.payload)
                        let messageId: string | null = null
                        try {
                                messageId = await params.persistInbound(text, candidate.id, kind)
                                if (messageId) {
                                        await prisma.inboundEvent
                                                .updateMany({
                                                        where: { id: candidate.id, state: 'COMPLETED' },
                                                        data: { inboundMessageId: messageId },
                                                })
                                                .catch(() => {})
                                }
                        } catch (error) {
                                // The ledger row is already finalized; losing only the inbox copy
                                // of an absorbed message is acceptable and must not break the turn.
                                console.error('[batching] absorbed inbound persist failed:', error)
                        }

                        absorbed.push({ eventId: candidate.id, text, kind })
                        // A sibling just arrived — extend the quiet window so a fast
                        // typist's next line is absorbed too.
                        quietUntil = Date.now() + BATCH_QUIET_MS
                }
        }

        return absorbed
}

/** Join the leading message and its absorbed siblings into one AI prompt. */
export function combineTurnText(base: string, absorbed: AbsorbedInbound[]): string {
        const parts = [base.trim(), ...absorbed.map((a) => a.text.trim())].filter(Boolean)
        return parts.join('\n')
}

/**
 * True when a job's own event was absorbed into a concurrent turn. Such a
 * job dies with LeaseLost BY DESIGN — the caller treats it as a normal skip
 * instead of a failure (no error capture, no BullMQ retry).
 */
export async function isInboundEventMergedIntoAnotherTurn(eventId: string): Promise<boolean> {
        const row = await prisma.inboundEvent.findUnique({
                where: { id: eventId },
                select: { state: true, result: true },
        })
        if (!row || row.state !== 'COMPLETED') return false
        const result = row.result as { outcome?: string } | null
        return result?.outcome === 'MERGED_INTO_TURN'
}

function extractPayloadText(payload: unknown): string {
        if (!payload || typeof payload !== 'object') return ''
        const text = (payload as { text?: unknown }).text
        return typeof text === 'string' ? text.trim() : ''
}

function extractPayloadKind(payload: unknown): string | undefined {
        if (!payload || typeof payload !== 'object') return undefined
        const kind = (payload as { kind?: unknown }).kind
        return typeof kind === 'string' ? kind : undefined
}

function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms).unref?.())
}
