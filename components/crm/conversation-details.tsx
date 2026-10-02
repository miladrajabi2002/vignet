import Link from 'next/link'
import { ArrowUpLeft, Headphones, Lightbulb, Sparkles } from 'lucide-react'
import type { ChannelType, ConvStatus } from '@prisma/client'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ConversationActions, HandoffAlertResolve } from '@/components/crm/conversation-actions'
import { ConversationSideTabs } from '@/components/crm/conversation-side-tabs'
import { SalesInsightCard, type SalesInsightView } from '@/components/crm/sales-insight'
import { CopyButton } from '@/components/ui/copy-button'
import { displayPhone } from '@/lib/phone'
import { relativeTime } from '@/lib/format'

export interface HandoffAlertProp {
        id: string
        reason: string | null
        state: 'open' | 'claimed' | 'resolved'
        createdAt: string
        contactName: string | null
        contactPhone: string | null
        summary: string | null
}

/**
 * Everything beside a conversation, shared by the inbox pane and the
 * conversation's own page: summary and next step, the customer, the sale.
 */
export function ConversationDetails({
        locale,
        conversationId,
        status,
        summary,
        channel,
        agentName,
        sourceLabel,
        contact,
        handle,
        handoffAlert,
        insight,
        copyLabel,
        copiedLabel,
}: {
        locale: 'fa' | 'en'
        conversationId: string
        status: ConvStatus
        summary: string | null
        channel: ChannelType
        agentName: string
        sourceLabel?: string | null
        contact: { id: string; name: string | null; phone: string | null } | null
        handle: string | null
        handoffAlert: HandoffAlertProp | null
        insight: SalesInsightView
        copyLabel: string
        copiedLabel: string
}) {
        const fa = locale === 'fa'
        const waiting = status !== 'RESOLVED' && (status === 'HANDED_OFF' || (handoffAlert != null && handoffAlert.state !== 'resolved'))
        const what = summary ?? handoffAlert?.summary ?? null
        const copyClass = '!min-h-7 !min-w-7 !rounded-lg !border-transparent !bg-transparent !px-1 hover:!bg-[var(--bg-hover)]'

        return (
                <>
                {/* Who answers next matters on every visit, so it sits above the tabs. */}
                <div className="border-b border-[var(--border-subtle)] p-3">
                        <ConversationActions key={conversationId} conversationId={conversationId} status={status} satisfaction={insight.satisfaction ?? null} />
                </div>
                <ConversationSideTabs
                        locale={locale}
                        attention={waiting}
                        summary={
                                <>
                                        <section className="rounded-card border border-[var(--border-subtle)] bg-white p-3.5">
                                                <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-secondary)]">
                                                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                                        {fa ? 'چه می‌خواهد؟' : 'What do they want?'}
                                                </h3>
                                                <p dir="auto" className="mt-1.5 text-[13px] leading-6 text-[var(--text-primary)]">
                                                        {what ?? (fa ? 'هنوز خلاصه‌ای برای این گفتگو ساخته نشده است.' : 'No summary has been written for this conversation yet.')}
                                                </p>
                                                {insight.recommendedAction && (
                                                        <div className="mt-3 rounded-xl border border-[var(--signal-border)] bg-[var(--signal-soft)] p-3">
                                                                <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--signal-strong)]">
                                                                        <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                                                                        {fa ? 'قدم بعدی' : 'Next step'}
                                                                </p>
                                                                <p dir="auto" className="mt-1 text-[13px] leading-6 text-[var(--text-primary)]">{insight.recommendedAction}</p>
                                                        </div>
                                                )}
                                        </section>

                                        {waiting && (
                                                <section className="rounded-card border border-amber-500/30 bg-amber-50 p-3.5">
                                                        <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-amber-900">
                                                                <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
                                                                {fa ? 'چرا به شما سپرده شد؟' : 'Why was it handed to you?'}
                                                        </h3>
                                                        <p dir="auto" className="mt-1.5 text-[13px] leading-6 text-[var(--text-primary)]">
                                                                {handoffAlert?.reason ?? (fa ? 'پاسخ خودکار ایجنت برای این گفتگو متوقف است.' : 'Automatic agent replies are paused for this conversation.')}
                                                        </p>
                                                        {handoffAlert && (
                                                                <>
                                                                        <p className="mt-1 text-[12px] text-amber-900/70">{relativeTime(new Date(handoffAlert.createdAt), locale)}</p>
                                                                        <HandoffAlertResolve alertId={handoffAlert.id} resolved={handoffAlert.state === 'resolved'} />
                                                                </>
                                                        )}
                                                </section>
                                        )}

                                </>
                        }
                        customer={
                                <section className="rounded-card border border-[var(--border-subtle)] bg-white">
                                        <dl className="divide-y divide-[var(--border-subtle)] text-[13px]">
                                                <Row label={fa ? 'نام' : 'Name'}>
                                                        <span dir="auto" className="truncate font-medium text-[var(--text-primary)]">{contact?.name ?? '—'}</span>
                                                </Row>
                                                <Row label={fa ? 'شماره' : 'Phone'}>
                                                        {contact?.phone ? (
                                                                <span dir="ltr" className="inline-flex items-center gap-1 tabular-nums text-[var(--text-primary)]">
                                                                        {displayPhone(contact.phone)}
                                                                        <CopyButton value={contact.phone} label={copyLabel} copiedLabel={copiedLabel} className={copyClass} />
                                                                </span>
                                                        ) : '—'}
                                                </Row>
                                                <Row label={fa ? 'برنامه' : 'App'}>
                                                        <ChannelBadge type={channel} />
                                                </Row>
                                                {handle && (
                                                        <Row label={fa ? 'شناسه' : 'Handle'}>
                                                                <span dir="ltr" className="inline-flex min-w-0 items-center gap-1 text-[var(--text-primary)]">
                                                                        <span className="truncate">@{handle}</span>
                                                                        <CopyButton value={handle} label={copyLabel} copiedLabel={copiedLabel} className={copyClass} />
                                                                </span>
                                                        </Row>
                                                )}
                                                {sourceLabel && (
                                                        <Row label={fa ? 'از کجا آمد' : 'Came from'}>
                                                                <span className="truncate text-[var(--text-primary)]">{sourceLabel}</span>
                                                        </Row>
                                                )}
                                                <Row label={fa ? 'ایجنت' : 'Agent'}>
                                                        <span dir="auto" className="truncate text-[var(--text-primary)]">{agentName}</span>
                                                </Row>
                                        </dl>
                                        {contact?.id && (
                                                <div className="border-t border-[var(--border-subtle)] p-2">
                                                        <Link
                                                                href={`/contacts/${contact.id}`}
                                                                className="flex min-h-10 items-center justify-center gap-1.5 rounded-control text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                        >
                                                                {fa ? 'پروفایل و سابقهٔ مشتری' : 'Customer profile and history'}
                                                                <ArrowUpLeft className="h-4 w-4 ltr:-scale-x-100" aria-hidden="true" />
                                                        </Link>
                                                </div>
                                        )}
                                </section>
                        }
                        sales={<SalesInsightCard insight={insight} locale={locale} />}
                />
                </>
        )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
        return (
                <div className="flex min-h-11 items-center justify-between gap-3 px-3.5 py-1.5">
                        <dt className="shrink-0 text-[12px] text-[var(--text-muted)]">{label}</dt>
                        <dd className="flex min-w-0 items-center justify-end">{children}</dd>
                </div>
        )
}
