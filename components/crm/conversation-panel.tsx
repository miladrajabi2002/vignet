'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
        Bell,
        User,
        Phone,
        Bot,
        Send,
        MessagesSquare,
        Radio,
        MessageCircle,
        Loader2,
        CheckCircle2,
        Sparkles,
} from 'lucide-react'
import type { ChannelType } from '@prisma/client'
import { OperatorReply } from '@/components/crm/operator-reply'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/lib/format'

/**
 * ConversationPanel (F3) — rich banner shown at the top of a conversation
 * thread when the conversation is in the "handed off to a human operator"
 * state OR there's an open HandoffAlert for it. Renders:
 *
 *   1. An "🔔 انتقال به اپراتور" alert banner with the reason + relative time.
 *   2. A customer snapshot card (name / phone / channel / agent / summary).
 *   3. A "بریم سمت کارشناس" section listing the agent's connected messenger
 *      channels so the operator can see where the customer is reachable.
 *   4. The OperatorReply box (reused) for sending an answer to the customer.
 *   5. A "بستن هشدار" button that PATCHes the alert state to 'resolved'.
 *
 * The parent page only mounts this component when there IS a handoff state —
 * either `status === 'HANDED_OFF'` or a non-null `handoffAlert`.
 */

export interface HandoffAlertProp {
        id: string
        reason: string | null
        state: 'open' | 'claimed' | 'resolved'
        createdAt: string
        contactName: string | null
        contactPhone: string | null
        summary: string | null
}

const MESSENGER_META: Record<
        ChannelType,
        { label: string; icon: typeof Send }
> = {
        TELEGRAM: { label: 'تلگرام', icon: Send },
        BALE: { label: 'بله', icon: MessagesSquare },
        RUBIKA: { label: 'روبیکا', icon: Radio },
        WHATSAPP: { label: 'واتساپ', icon: MessageCircle },
        INSTAGRAM: { label: 'اینستاگرام', icon: MessageCircle },
        WEB_WIDGET: { label: 'وب‌ویجت', icon: Send },
        API: { label: 'API', icon: Send },
}

export function ConversationPanel({
        conversationId,
        status,
        contactName,
        contactPhone,
        channel,
        agentName,
        summary,
        handoffAlert,
        connectedChannels,
        canDeliver,
        locale,
}: {
        conversationId: string
        status: 'OPEN' | 'RESOLVED' | 'HANDED_OFF'
        contactName: string | null
        contactPhone: string | null
        channel: ChannelType
        agentName: string
        summary: string | null
        handoffAlert: HandoffAlertProp | null
        connectedChannels: ChannelType[]
        canDeliver: boolean
        locale: 'fa' | 'en'
}) {
        const t = useTranslations('conversations')
        const router = useRouter()
        const [resolving, setResolving] = useState(false)
        const [resolved, setResolved] = useState(
                handoffAlert?.state === 'resolved' || status === 'RESOLVED',
        )

        async function resolveAlert() {
                if (!handoffAlert || resolving || resolved) return
                setResolving(true)
                try {
                        const res = await fetch(`/api/handoff-alerts/${handoffAlert.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ state: 'resolved' }),
                        })
                        if (res.ok) {
                                setResolved(true)
                                router.refresh()
                        }
                } finally {
                        setResolving(false)
                }
        }

        const activeChannels = connectedChannels.filter(
                (c) => c !== 'WEB_WIDGET' && c !== 'API',
        )

        return (
                <div className="space-y-3">
                        {/* Alert banner */}
                        <div
                                className={cn(
                                        'rounded-2xl border bg-[var(--bg-surface)] p-4',
                                        resolved
                                                ? 'border-[var(--border-default)] opacity-70'
                                                : 'border-[var(--amber)] bg-[var(--white-05)]',
                                )}
                        >
                                <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5">
                                                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--amber)] text-white">
                                                        <Bell className="h-3.5 w-3.5" />
                                                </span>
                                                <div>
                                                        <div className="text-sm font-medium text-[var(--text-primary)]">
                                                                {resolved ? t('alertResolved') : t('handoffAlert')}
                                                        </div>
                                                        {handoffAlert?.reason && (
                                                                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                                                        {t('handoffReason')}: {handoffAlert.reason}
                                                                </p>
                                                        )}
                                                        {handoffAlert && (
                                                                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                                                                        {relativeTime(new Date(handoffAlert.createdAt), locale)}
                                                                </p>
                                                        )}
                                                </div>
                                        </div>
                                        {handoffAlert && !resolved && (
                                                <button
                                                        onClick={resolveAlert}
                                                        disabled={resolving}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] disabled:opacity-50"
                                                >
                                                        {resolving ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                        )}
                                                        {t('resolveAlert')}
                                                </button>
                                        )}
                                </div>
                        </div>

                        {/* Customer snapshot card */}
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                                <div className="mb-3 text-xs font-medium text-[var(--text-secondary)]">
                                        {t('customerSnapshot')}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                        <Snap
                                                icon={<User className="h-3.5 w-3.5" />}
                                                label={t('customerName')}
                                                value={contactName ?? '—'}
                                        />
                                        <Snap
                                                icon={<Phone className="h-3.5 w-3.5" />}
                                                label={t('customerPhone')}
                                                value={contactPhone ?? '—'}
                                        />
                                        <Snap
                                                icon={<MessageCircle className="h-3.5 w-3.5" />}
                                                label={t('customerChannel')}
                                                value={MESSENGER_META[channel]?.label ?? channel}
                                        />
                                        <Snap
                                                icon={<Bot className="h-3.5 w-3.5" />}
                                                label={t('customerAgent')}
                                                value={agentName}
                                        />
                                </div>
                                {(summary || handoffAlert?.summary) && (
                                        <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                                                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                                                        <Sparkles className="h-3 w-3" />
                                                        {t('summary')}
                                                </div>
                                                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                                                        {summary ?? handoffAlert?.summary}
                                                </p>
                                        </div>
                                )}
                        </div>

                        {/* "Go to specialist" / connected channels */}
                        {activeChannels.length > 0 && (
                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                                        <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
                                                {t('goToSpecialist')}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                                {activeChannels.map((c) => {
                                                        const meta = MESSENGER_META[c]
                                                        const Icon = meta?.icon ?? Send
                                                        return (
                                                                <span
                                                                        key={c}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                                                                >
                                                                        <Icon className="h-3.5 w-3.5 text-[var(--green)]" />
                                                                        {meta?.label ?? c}
                                                                        <span className="text-[10px] text-[var(--text-muted)]">
                                                                                • {t('connectedOn')}
                                                                        </span>
                                                                </span>
                                                        )
                                                })}
                                        </div>
                                        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                                                💬 {t('replyHere')}
                                        </p>
                                </div>
                        )}

                        {/* Operator reply box (reused) */}
                        <OperatorReply conversationId={conversationId} canDeliver={canDeliver} />
                </div>
        )
}

function Snap({
        icon,
        label,
        value,
}: {
        icon: React.ReactNode
        label: string
        value: string
}) {
        return (
                <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)]">
                                {icon}
                        </span>
                        <div className="min-w-0">
                                <div className="text-[10px] text-[var(--text-muted)]">{label}</div>
                                <div className="truncate text-[13px] text-[var(--text-primary)]" dir="auto">
                                        {value}
                                </div>
                        </div>
                </div>
        )
}
