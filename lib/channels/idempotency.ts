import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { InboundMessage } from '@/lib/channels/types'
import type { ConversationTurnLease } from '@/lib/channels/conversation-lock'

/**
 * PostgreSQL-backed inbound event ledger.
 *
 * Webhook delivery, BullMQ and worker restarts are all at-least-once. The
 * ledger therefore owns the durable identity of a normalized platform event.
 * A worker may process an event only while it owns its renewable lease; every
 * reclaim increments leaseToken, which fences a timed-out/crashed predecessor.
 */

const DEFAULT_LEASE_MS = 45_000
const DEFAULT_HEARTBEAT_MS = 10_000
// Longer than one lease: even the final BullMQ attempt can reclaim a crashed
// owner instead of exhausting retries while the stale lease is still alive.
const DEFAULT_WAIT_TIMEOUT_MS = 55_000
const DEFAULT_POLL_MS = 250

export type InboundEventState =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'EFFECTS_COMMITTED'
  | 'COMPLETED'
  | 'DELIVERY_UNCERTAIN'
  | 'FAILED'

export interface InboundEventLease {
  id: string
  workspaceId: string
  channelId: string
  externalEventId: string
  conversationKey: string
  leaseOwner: string
  leaseToken: number
  leaseExpiresAt: Date
  attempts: number
  state: InboundEventState
  payloadHash: string
  effectsCommittedAt: Date | null
  deliveryStartedAt: Date | null
  deliveryCompletedAt: Date | null
  conversationId: string | null
  inboundMessageId: string | null
  resultMessageId: string | null
  result: Prisma.JsonValue | null
}

export type ClaimInboundEventResult =
  | { status: 'acquired'; lease: InboundEventLease }
  | {
      status: 'completed'
      eventId: string
      state: InboundEventState
      payloadConflict: boolean
    }
  | {
      status: 'busy'
      eventId: string
      state: InboundEventState
      payloadConflict: boolean
    }

export interface ClaimInboundEventInput {
  workspaceId: string
  channelId: string
  externalEventId: string
  conversationKey: string
  eventType: string
  payload: unknown
}

export interface LeaseTimingOptions {
  leaseMs?: number
  heartbeatMs?: number
  waitTimeoutMs?: number
  pollMs?: number
}

export interface InboundEventLeaseGuard {
  readonly lease: InboundEventLease
  assertActive(): Promise<void>
}

export interface InboundEventEffects {
  conversationId?: string | null
  inboundMessageId?: string | null
  resultMessageId?: string | null
  result?: Prisma.InputJsonValue
}

export class InboundEventLeaseLostError extends Error {
  constructor(eventId: string) {
    super(`Inbound event lease is no longer current: ${eventId}`)
    this.name = 'InboundEventLeaseLostError'
  }
}

export class InboundEventLeaseBusyError extends Error {
  constructor(eventId: string) {
    super(`Inbound event is still owned by another worker: ${eventId}`)
    this.name = 'InboundEventLeaseBusyError'
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object)
    .sort()
    .filter((key) => object[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(',')}}`
}

export function inboundPayloadHash(payload: unknown): string {
  return crypto.createHash('sha256').update(stableJson(payload)).digest('hex')
}

/**
 * Platforms normally provide a message id. The deterministic fingerprint is a
 * last-resort identity for malformed/legacy adapters, and deliberately uses
 * only normalized immutable fields so a redelivery hashes identically.
 */
export function inboundExternalEventId(msg: InboundMessage): string {
  const kind = msg.kind ?? 'DM'
  if (msg.platformMessageId) return `${kind}:${msg.platformMessageId}`
  return `synthetic:${inboundPayloadHash({
    kind,
    chatId: msg.chatId,
    senderId: msg.senderId,
    text: msg.text,
    voiceFileId: msg.voiceFileId,
    replyToMessageId: msg.replyToMessageId,
    commentId: msg.commentId,
    postId: msg.postId,
    storyId: msg.storyId,
  })}`
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code === 'P2002'
      : !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002'
  )
}

const eventSelect = {
  id: true,
  workspaceId: true,
  channelId: true,
  externalEventId: true,
  conversationKey: true,
  leaseOwner: true,
  leaseToken: true,
  leaseExpiresAt: true,
  attempts: true,
  state: true,
  payloadHash: true,
  effectsCommittedAt: true,
  deliveryStartedAt: true,
  deliveryCompletedAt: true,
  conversationId: true,
  inboundMessageId: true,
  resultMessageId: true,
  result: true,
} satisfies Prisma.InboundEventSelect

type SelectedEvent = Prisma.InboundEventGetPayload<{ select: typeof eventSelect }>

function toLease(row: SelectedEvent): InboundEventLease {
  if (!row.leaseOwner || !row.leaseExpiresAt) throw new InboundEventLeaseLostError(row.id)
  return {
    ...row,
    state: row.state as InboundEventState,
    leaseOwner: row.leaseOwner,
    leaseExpiresAt: row.leaseExpiresAt,
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Atomically create, claim, or reclaim one durable inbound event. */
export async function claimInboundEvent(
  input: ClaimInboundEventInput,
  options: LeaseTimingOptions = {},
): Promise<ClaimInboundEventResult> {
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS
  const deadline = Date.now() + waitTimeoutMs
  const leaseOwner = crypto.randomUUID()
  const payloadHash = inboundPayloadHash(input.payload)

  for (;;) {
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + leaseMs)
    try {
      const created = await prisma.inboundEvent.create({
        data: {
          id: crypto.randomUUID(),
          workspaceId: input.workspaceId,
          channelId: input.channelId,
          externalEventId: input.externalEventId,
          conversationKey: input.conversationKey,
          eventType: input.eventType,
          payloadHash,
          payload: asJson(input.payload),
          state: 'PROCESSING',
          leaseOwner,
          leaseToken: 1,
          leaseExpiresAt,
          attempts: 1,
          processingStartedAt: now,
        },
        select: eventSelect,
      })
      return { status: 'acquired', lease: toLease(created) }
    } catch (error) {
      if (!isUniqueConflict(error)) throw error
    }

    // updateMany makes lease takeover one conditional SQL UPDATE. Two workers
    // racing an expired row cannot both win: the first extends the expiry and
    // changes the owner before the second predicate is evaluated.
    const reclaimed = await prisma.inboundEvent.updateMany({
      where: {
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        externalEventId: input.externalEventId,
        state: { notIn: ['COMPLETED', 'DELIVERY_UNCERTAIN'] },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      data: {
        state: 'PROCESSING',
        leaseOwner,
        leaseToken: { increment: 1 },
        leaseExpiresAt,
        attempts: { increment: 1 },
        processingStartedAt: now,
        lastError: null,
      },
    })
    if (reclaimed.count === 1) {
      const row = await prisma.inboundEvent.findUnique({
        where: {
          workspaceId_channelId_externalEventId: {
            workspaceId: input.workspaceId,
            channelId: input.channelId,
            externalEventId: input.externalEventId,
          },
        },
        select: eventSelect,
      })
      if (row?.leaseOwner === leaseOwner) return { status: 'acquired', lease: toLease(row) }
      if (row) throw new InboundEventLeaseLostError(row.id)
    }

    const existing = await prisma.inboundEvent.findUnique({
      where: {
        workspaceId_channelId_externalEventId: {
          workspaceId: input.workspaceId,
          channelId: input.channelId,
          externalEventId: input.externalEventId,
        },
      },
      select: { id: true, state: true, payloadHash: true },
    })
    // The row can disappear only when the owning channel/workspace is deleted.
    // Retry creation in that rare race while we are still inside the wait budget.
    if (!existing) {
      if (Date.now() >= deadline) throw new Error('Inbound ledger row disappeared during claim')
      continue
    }
    const payloadConflict = existing.payloadHash !== payloadHash
    if (existing.state === 'COMPLETED' || existing.state === 'DELIVERY_UNCERTAIN') {
      return {
        status: 'completed',
        eventId: existing.id,
        state: existing.state as InboundEventState,
        payloadConflict,
      }
    }
    if (Date.now() >= deadline) {
      return {
        status: 'busy',
        eventId: existing.id,
        state: existing.state as InboundEventState,
        payloadConflict,
      }
    }
    await sleep(Math.max(1, pollMs))
  }
}

async function renewInboundEventLease(
  lease: InboundEventLease,
  leaseMs: number,
): Promise<boolean> {
  const now = new Date()
  const result = await prisma.inboundEvent.updateMany({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      leaseToken: lease.leaseToken,
      state: { in: ['PROCESSING', 'EFFECTS_COMMITTED'] },
      leaseExpiresAt: { gt: now },
    },
    data: { leaseExpiresAt: new Date(now.getTime() + leaseMs) },
  })
  return result.count === 1
}

async function assertInboundEventLease(lease: InboundEventLease): Promise<void> {
  const count = await prisma.inboundEvent.count({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      leaseToken: lease.leaseToken,
      state: { in: ['PROCESSING', 'EFFECTS_COMMITTED'] },
      leaseExpiresAt: { gt: new Date() },
    },
  })
  if (count !== 1) throw new InboundEventLeaseLostError(lease.id)
}

/** Keep an event claim alive during slow STT/LLM/provider calls. */
export async function withInboundEventLease<T>(
  lease: InboundEventLease,
  operation: (guard: InboundEventLeaseGuard) => Promise<T>,
  options: LeaseTimingOptions = {},
): Promise<T> {
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS
  let lost = false
  let renewing = false
  const timer = setInterval(() => {
    if (renewing || lost) return
    renewing = true
    void renewInboundEventLease(lease, leaseMs)
      .then((ok) => {
        if (!ok) lost = true
      })
      .catch(() => {
        // A single transient database error must not permanently poison an
        // otherwise-current lease. The next heartbeat retries, while every
        // dispatch/finalization write still proves the fencing token and the
        // expiry atomically in PostgreSQL.
      })
      .finally(() => {
        renewing = false
      })
  }, heartbeatMs)
  timer.unref?.()

  const guard: InboundEventLeaseGuard = {
    lease,
    async assertActive() {
      if (lost) throw new InboundEventLeaseLostError(lease.id)
      await assertInboundEventLease(lease)
    },
  }

  try {
    // Do not assert after the callback returns. A successful callback is
    // allowed to call completeInboundEvent(), which atomically transitions
    // the row to COMPLETED and intentionally clears its lease. Re-checking the
    // lease here would turn every successful completion into LeaseLost.
    return await operation(guard)
  } finally {
    clearInterval(timer)
  }
}

/** Record that all local message/conversation writes for the event are durable. */
export async function markInboundEventEffectsCommitted(
  lease: InboundEventLease,
  effects: InboundEventEffects,
): Promise<void> {
  const now = new Date()
  const updated = await prisma.inboundEvent.updateMany({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      leaseToken: lease.leaseToken,
      state: { in: ['PROCESSING', 'EFFECTS_COMMITTED'] },
      leaseExpiresAt: { gt: now },
    },
    data: {
      state: 'EFFECTS_COMMITTED',
      effectsCommittedAt: now,
      conversationId: effects.conversationId,
      inboundMessageId: effects.inboundMessageId,
      resultMessageId: effects.resultMessageId,
      ...(effects.result === undefined ? {} : { result: effects.result }),
    },
  })
  if (updated.count !== 1) throw new InboundEventLeaseLostError(lease.id)
}

/**
 * Write-ahead marker for the first external provider send.
 *
 * Telegram/Meta-style send APIs do not accept a caller idempotency key. We use
 * an explicit at-most-once policy: after this durable marker, a crash retry
 * treats delivery as ambiguous and never sends the same event again. This
 * prevents duplicate customer replies at the unavoidable cost that a crash in
 * the tiny marker-before-send window can leave the reply unsent.
 */
export async function beginInboundEventDispatch(
  lease: InboundEventLease,
): Promise<boolean> {
  const now = new Date()
  const started = await prisma.inboundEvent.updateMany({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      leaseToken: lease.leaseToken,
      state: { in: ['PROCESSING', 'EFFECTS_COMMITTED'] },
      leaseExpiresAt: { gt: now },
      deliveryStartedAt: null,
    },
    data: { deliveryStartedAt: now },
  })
  if (started.count === 1) {
    lease.deliveryStartedAt = now
    return true
  }
  const current = await prisma.inboundEvent.count({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      leaseToken: lease.leaseToken,
      state: { in: ['PROCESSING', 'EFFECTS_COMMITTED'] },
      leaseExpiresAt: { gt: now },
      deliveryStartedAt: { not: null },
    },
  })
  if (current === 1) return false
  throw new InboundEventLeaseLostError(lease.id)
}

export async function markInboundEventDeliveryCompleted(
  lease: InboundEventLease,
): Promise<void> {
  const now = new Date()
  const completed = await prisma.inboundEvent.updateMany({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      leaseToken: lease.leaseToken,
      state: { in: ['PROCESSING', 'EFFECTS_COMMITTED'] },
      leaseExpiresAt: { gt: now },
      deliveryStartedAt: { not: null },
    },
    data: { deliveryCompletedAt: now },
  })
  if (completed.count !== 1) throw new InboundEventLeaseLostError(lease.id)
  lease.deliveryCompletedAt = now
}

/**
 * Finalize only while BOTH fencing tokens are current. The lease row is locked
 * until the event update commits, so a concurrent conversation reclaim cannot
 * slip between the fence check and COMPLETED.
 */
export async function completeInboundEvent(
  lease: InboundEventLease,
  conversationLease: ConversationTurnLease,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        leaseOwner: string | null
        fencingToken: number
        leaseExpiresAt: Date | null
      }>
    >(Prisma.sql`
      SELECT "leaseOwner", "fencingToken", "leaseExpiresAt"
      FROM "ConversationTurnLease"
      WHERE "id" = ${conversationLease.id}
      FOR UPDATE
    `)
    const current = rows[0]
    const now = new Date()
    if (
      !current ||
      current.leaseOwner !== conversationLease.leaseOwner ||
      current.fencingToken !== conversationLease.fencingToken ||
      !current.leaseExpiresAt ||
      current.leaseExpiresAt <= now
    ) {
      throw new InboundEventLeaseLostError(lease.id)
    }

    const updated = await tx.inboundEvent.updateMany({
      where: {
        id: lease.id,
        leaseOwner: lease.leaseOwner,
        leaseToken: lease.leaseToken,
        state: 'EFFECTS_COMMITTED',
        leaseExpiresAt: { gt: now },
      },
      data: {
        state: 'COMPLETED',
        completedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    })
    if (updated.count !== 1) throw new InboundEventLeaseLostError(lease.id)
  })
}

/**
 * Terminalize an ambiguous provider send without retrying it. The dashboard
 * notification is created in the same transaction, so an at-most-once safety
 * decision can never become a silent loss.
 */
export async function markInboundEventDeliveryUncertain(
  lease: InboundEventLease,
  conversationLease: ConversationTurnLease,
  conversationId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        leaseOwner: string | null
        fencingToken: number
        leaseExpiresAt: Date | null
      }>
    >(Prisma.sql`
      SELECT "leaseOwner", "fencingToken", "leaseExpiresAt"
      FROM "ConversationTurnLease"
      WHERE "id" = ${conversationLease.id}
      FOR UPDATE
    `)
    const current = rows[0]
    const now = new Date()
    if (
      !current ||
      current.leaseOwner !== conversationLease.leaseOwner ||
      current.fencingToken !== conversationLease.fencingToken ||
      !current.leaseExpiresAt ||
      current.leaseExpiresAt <= now
    ) {
      throw new InboundEventLeaseLostError(lease.id)
    }

    const updated = await tx.inboundEvent.updateMany({
      where: {
        id: lease.id,
        leaseOwner: lease.leaseOwner,
        leaseToken: lease.leaseToken,
        state: 'EFFECTS_COMMITTED',
        leaseExpiresAt: { gt: now },
        deliveryStartedAt: { not: null },
        deliveryCompletedAt: null,
      },
      data: {
        state: 'DELIVERY_UNCERTAIN',
        completedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError:
          'Provider delivery started but was not acknowledged before the worker stopped; automatic resend suppressed.',
      },
    })
    if (updated.count !== 1) throw new InboundEventLeaseLostError(lease.id)

    await tx.notification.create({
      data: {
        workspaceId: lease.workspaceId,
        type: 'SYSTEM',
        title: 'وضعیت ارسال پاسخ نامشخص است',
        body:
          'برای جلوگیری از پاسخ تکراری، ارسال خودکار دوباره انجام نشد. لطفاً گفتگو را بررسی کنید و در صورت نیاز دستی پاسخ دهید.',
        link: conversationId ? `/conversations/${conversationId}` : '/conversations',
      },
    })
  })
}

/** Release a failed attempt for immediate, fenced retry. */
export async function failInboundEvent(
  lease: InboundEventLease,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  await prisma.inboundEvent.updateMany({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      leaseToken: lease.leaseToken,
      state: { not: 'COMPLETED' },
    },
    data: {
      state: 'FAILED',
      leaseOwner: null,
      leaseExpiresAt: new Date(),
      lastError: message.slice(0, 4_000),
    },
  })
}
