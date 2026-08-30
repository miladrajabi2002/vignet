import { notFound } from 'next/navigation'
import { Camera, AlertCircle, CheckCircle2 } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { InstagramAutomationManager } from '@/components/instagram/automation-manager'
import { InstagramConnectFlow } from '@/components/channels/instagram-connect-wizard'
import {
        DEFAULT_SETTINGS,
        type Automation,
        type AutomationTrigger,
        type AutomationAction,
        type InstagramAutomationSettings,
        type ReplyPolicy,
} from '@/components/instagram/types'

export const dynamic = 'force-dynamic'

/** Query params the OAuth callback can append when it lands back here. */
type IgSearchParams = Record<string, string | string[] | undefined>

function readIgFlag(sp: IgSearchParams | undefined, key: string): boolean {
        return sp?.[key] === '1' || sp?.[key] === 'true'
}

function readIgError(sp: IgSearchParams | undefined): string | null {
        const v = sp?.ig_error
        return typeof v === 'string' && v ? v : null
}

export default async function InstagramAutomationPage(
        props: {
                params: Promise<{ agentId: string }>
                searchParams?: Promise<IgSearchParams>
                /** Where to land after a successful connect (workspace page passes "/instagram"). */
                returnTo?: string
                /** Pre-read redirect flags — used when embedded by the workspace /instagram page. */
                igConnected?: boolean
                igError?: string | null
        },
) {
        const params = await props.params
        const sp = props.searchParams ? await props.searchParams : undefined
        return (
                <InstagramAutomationContent
                        agentId={params.agentId}
                        returnTo={props.returnTo ?? `/agents/${params.agentId}/instagram`}
                        igConnected={props.igConnected ?? readIgFlag(sp, 'ig_connected')}
                        igError={props.igError ?? readIgError(sp)}
                />
        )
}

/**
 * Per-agent Instagram automation dashboard (v3). Loads the connected IG
 * channel + its automation scenarios + the channel-level
 * `InstagramAutomationSettings`, then mounts the client manager.
 *
 * The form (create/edit) lives on separate routes:
 *   - `/agents/{agentId}/instagram/new?type={tab}` (create)
 *   - `/agents/{agentId}/instagram/{id}/edit`      (edit)
 *
 * v3 settings shape: only `replyPolicy` + `stopWords` + `aiEnabled` are
 * surfaced in the UI (welcomeMessage + followUp* were removed). The backend
 * PATCH treats omitted fields as "skip", so we don't touch them.
 */
async function InstagramAutomationContent({
        agentId,
        returnTo,
        igConnected,
        igError,
}: {
        agentId: string
        returnTo: string
        igConnected: boolean
        igError: string | null
}) {
        const user = await requireUser()

        const agent = await prisma.agent.findFirst({
                where: { id: agentId, workspaceId: user.workspaceId },
                select: {
                        id: true,
                        name: true,
                        channels: {
                                where: { type: 'INSTAGRAM' },
                                select: { id: true, config: true },
                        },
                },
        })
        if (!agent) notFound()

        const igChannel = agent.channels[0]

        // Status banners shown right after the OAuth round-trip lands back
        // here (?ig_connected=1 / ?ig_error=...). Mirrors the channels page.
        const statusBanner = igError ? (
                <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                        <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-danger">اتصال ناموفق بود.</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-danger/80">
                                        دوباره تلاش کنید.{' '}
                                        {igError === 'denied' && '(دسترسی لغو شد)'}
                                        {igError === 'exchange' && '(خطا در تأیید کد)'}
                                        {igError === 'state' && '(نشست نامعتبر)'}
                                </p>
                        </div>
                </div>
        ) : igConnected ? (
                <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                        <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-success">
                                        اکانت اینستاگرام با موفقیت متصل شد.
                                </p>
                                <p className="mt-0.5 text-xs leading-relaxed text-success/80">
                                        حالا می‌توانید اتوماسیون‌های دایرکت و کامنت را فعال کنید.
                                </p>
                        </div>
                </div>
        ) : null

        // Not connected — the connect flow lives HERE now. The operator starts
        // Instagram OAuth directly from this page (no detour through agent
        // settings → channels) and lands back on `returnTo` after connecting.
        if (!igChannel) {
                return (
                        <div className="mx-auto max-w-3xl space-y-5">
                                {statusBanner}
                                <div className="flex items-center gap-2.5">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
                                                <Camera className="h-5 w-5" />
                                        </div>
                                        <div>
                                                <h1 className="text-base font-semibold text-[var(--text-primary)]">
                                                        اتصال اینستاگرام
                                                </h1>
                                                <p className="text-xs text-[var(--text-secondary)]">
                                                        اتوماسیون اینستاگرام ویجنت رایگان است — فقط اکانت خود را وصل کنید.
                                                </p>
                                        </div>
                                </div>
                                <InstagramConnectFlow
                                        agentId={agent.id}
                                        returnTo={returnTo}
                                />
                        </div>
                )
        }

        // Pull the connected IG account's display info from the channel config.
        const cfg = (igChannel.config ?? {}) as {
                botUsername?: string
        }
        const accountUsername = cfg.botUsername ?? 'vigent.bot'

        const [rows, settingsRow] = await Promise.all([
                prisma.instagramAutomation.findMany({
                        where: { agentId: agent.id, channelId: igChannel.id },
                        orderBy: [{ type: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
                }),
                // InstagramAutomationSettings is a model added by BACKEND-AUTO-V2.
                // Look it up by the @unique `agentId` field. Wrapped in optional
                // chaining so the page compiles even before `prisma generate` has run
                // for the new model.
                (prisma as unknown as {
                        instagramAutomationSettings?: {
                                findUnique: (args: {
                                        where: { agentId: string }
                                }) => Promise<Record<string, unknown> | null>
                        }
                }).instagramAutomationSettings?.findUnique({
                        where: { agentId: agent.id },
                }),
        ])

        const automations: Automation[] = rows.map((r) => ({
                id: r.id,
                agentId: r.agentId,
                channelId: r.channelId,
                type: r.type,
                name: r.name,
                active: r.active,
                priority: r.priority,
                trigger: r.trigger as unknown as AutomationTrigger,
                action: r.action as unknown as AutomationAction,
                createdAt: r.createdAt.toISOString(),
                updatedAt: r.updatedAt.toISOString(),
        }))

        const settings = normalizeSettings(settingsRow)

        return (
                <div className="mx-auto max-w-6xl space-y-5">
                        {statusBanner}
                        <InstagramAutomationManager
                                agentId={agent.id}
                                accountUsername={accountUsername}
                                initialAutomations={automations}
                                initialSettings={settings}
                        />
                </div>
        )
}

/** Coerce an unknown settings blob into a fully-typed InstagramAutomationSettings (v3). */
function normalizeSettings(raw: unknown): InstagramAutomationSettings {
        if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS
        const s = raw as Record<string, unknown>
        const replyPolicy = (
                ['ALL_AGENT', 'AGENT_EXCEPT_SCENARIOS', 'AUTOMATION_ONLY'].includes(
                        String(s.replyPolicy ?? ''),
                )
                        ? s.replyPolicy
                        : 'AGENT_EXCEPT_SCENARIOS'
        ) as ReplyPolicy
        const policy = (key: string): ReplyPolicy =>
                (['ALL_AGENT', 'AGENT_EXCEPT_SCENARIOS', 'AUTOMATION_ONLY'].includes(String(s[key] ?? ''))
                        ? s[key]
                        : replyPolicy) as ReplyPolicy
        return {
                replyPolicy,
                dmReplyPolicy: policy('dmReplyPolicy'),
                storyReplyPolicy: policy('storyReplyPolicy'),
                commentReplyPolicy: policy('commentReplyPolicy'),
                stopWords: Array.isArray(s.stopWords)
                        ? s.stopWords.filter((x): x is string => typeof x === 'string')
                        : [],
                aiEnabled: typeof s.aiEnabled === 'boolean' ? s.aiEnabled : true,
                storyReactionReplyEnabled: s.storyReactionReplyEnabled === true,
                storyReactionReplyText: typeof s.storyReactionReplyText === 'string' ? s.storyReactionReplyText : null,
                commentEmojiReplyEnabled: s.commentEmojiReplyEnabled === true,
                commentEmojiReplyText: typeof s.commentEmojiReplyText === 'string' ? s.commentEmojiReplyText : null,
                likeDmAfterReply: s.likeDmAfterReply === true,
                likeStoryReplyAfterReply: s.likeStoryReplyAfterReply === true,
                likeStoryReactionAfterReply: s.likeStoryReactionAfterReply === true,
                // Comment likes are not supported by the current Meta adapter/connection.
                likeCommentAfterReply: false,
        }
}
