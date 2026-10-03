'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import type { ChannelType, ConvStatus } from '@prisma/client'
import { ArrowLeft, Clock3, Lightbulb, MessageSquareText, MessagesSquare, Sparkles } from 'lucide-react'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { ConversationDeleteAction } from '@/components/crm/conversation-actions'
import { ConversationStatusBadge } from '@/components/crm/conversation-status-badge'
import { ConversationStatusDot } from '@/components/crm/conversation-status-dot'
import { SalesInsightText, SatisfactionText, type SalesInsightView } from '@/components/crm/sales-insight'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { cn } from '@/lib/utils'

/**
 * One conversation in the phone inbox. The row stays short (who, which app,
 * how they feel); tapping it opens a summary sheet — what they want, their
 * last message, the next step — so most checks never need the full thread.
 */
export function MobileConversationCard({
  conversationId,
  who,
  avatarSrc,
  channelHandle,
  sourceTag,
  relativeTimeLabel,
  messageCountLabel,
  channel,
  status,
  statusLabel,
  attention,
  satisfaction,
  summary,
  recommendedAction,
  buyerProbability,
  locale,
  lastMessage,
  reactionEmoji,
}: {
  conversationId: string
  who: string
  avatarSrc?: string | null
  channelHandle?: string | null
  /** "Instagram Direct", "Instagram Comment"…; null shows the plain app name. */
  sourceTag?: string | null
  relativeTimeLabel: string
  messageCountLabel: string
  channel: ChannelType
  status: ConvStatus
  statusLabel: string
  attention: boolean
  /** Automatic 0–100 satisfaction read; null when there is no evidence yet. */
  satisfaction?: number | null
  summary?: string | null
  recommendedAction?: string | null
  buyerProbability?: Pick<SalesInsightView, 'leadType' | 'buyerProbability'> | null
  locale: 'fa' | 'en'
  lastMessage: string
  reactionEmoji?: string | null
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isFa = locale === 'fa'

  return (
    <>
      <article
        className={cn(
          'spatial-surface overflow-hidden rounded-card transition-[border-color,box-shadow] duration-150',
          attention && 'border-amber-300/70',
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${isFa ? 'نمایش خلاصه گفتگو با' : 'Show conversation summary for'} ${who}`}
          className="spatial-press block min-h-16 w-full p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ContactAvatar src={avatarSrc} alt={who} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                {(attention || status === 'OPEN') && (
                  <ConversationStatusDot attention={attention} open={status === 'OPEN'} label={statusLabel} />
                )}
                <span
                  dir="auto"
                  className={cn('min-w-0 truncate text-[15px] text-[var(--text-primary)]', status === 'RESOLVED' ? 'font-medium' : 'font-bold')}
                >
                  {who}
                </span>
                <span className="ms-auto shrink-0 whitespace-nowrap text-[12px] text-[var(--text-muted)]">
                  {relativeTimeLabel}
                </span>
              </div>
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                <ChannelBadge type={channel} label={sourceTag} />
                <SatisfactionText satisfaction={satisfaction} locale={locale} variant="tag" />
              </div>
            </div>
            <ArrowLeft
              className="h-4 w-4 shrink-0 text-[var(--text-hint)] ltr:rotate-180"
              aria-hidden="true"
            />
          </div>
        </button>
      </article>

      <MobileBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        title={who}
        description={isFa ? 'خلاصه گفتگو' : 'Conversation summary'}
        closeLabel={isFa ? 'بستن خلاصه گفتگو' : 'Close conversation summary'}
        motionPreset="detail"
        footer={
          <div className="grid grid-cols-[auto_auto_1fr] gap-2">
            <ConversationDeleteAction
              conversationId={conversationId}
              variant="sheet"
              onDeleted={() => setOpen(false)}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {isFa ? 'بستن' : 'Close'}
            </button>
            <Link
              href={`/conversations/${conversationId}`}
              className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              {isFa ? 'ورود به گفتگو' : 'Open conversation'}
              <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-white p-4">
            <ContactAvatar src={avatarSrc} alt={who} size="lg" />
            <div className="min-w-0 flex-1">
              <p dir="auto" className="truncate text-base font-bold text-[var(--text-primary)]">
                {who}
              </p>
              {channelHandle && who !== channelHandle && (
                <p dir="ltr" className="mt-1 truncate text-start text-xs text-[var(--text-muted)]">
                  @{channelHandle}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ConversationStatusBadge
                  status={status}
                  label={statusLabel}
                  attention={attention}
                />
                <ChannelBadge type={channel} label={sourceTag} />
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
            <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-secondary)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {isFa ? 'چه می‌خواهد؟' : 'What do they want?'}
            </h3>
            <p dir="auto" className="mt-1.5 text-[13px] leading-6 text-[var(--text-primary)]">
              {summary || (isFa ? 'هنوز خلاصه‌ای برای این گفتگو ساخته نشده است.' : 'No summary has been written for this conversation yet.')}
            </p>
            {recommendedAction && (
              <div className="mt-3 rounded-xl border border-[var(--signal-border)] bg-[var(--signal-soft)] p-3">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--signal-strong)]">
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                  {isFa ? 'قدم بعدی' : 'Next step'}
                </p>
                <p dir="auto" className="mt-1 text-[13px] leading-6 text-[var(--text-primary)]">{recommendedAction}</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
            <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-secondary)]">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
              {isFa ? 'آخرین پیام' : 'Last message'}
            </h3>
            <div className="mt-1.5 flex min-w-0 items-start gap-1.5">
              {reactionEmoji && (
                <span dir="ltr" className="emoji-glyph shrink-0 text-[15px] leading-6" aria-label={isFa ? 'واکنش مشتری' : 'Customer reaction'}>
                  {reactionEmoji}
                </span>
              )}
              <p dir="auto" className="line-clamp-4 min-w-0 flex-1 text-[13px] leading-6 text-[var(--text-primary)] [overflow-wrap:anywhere]">
                {lastMessage}
              </p>
            </div>
          </section>

          <dl className="grid grid-cols-2 gap-2">
            <SheetStat icon={<MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />} label={isFa ? 'تعداد پیام‌ها' : 'Messages'}>
              {messageCountLabel}
            </SheetStat>
            <SheetStat icon={<Clock3 className="h-3.5 w-3.5" aria-hidden="true" />} label={isFa ? 'آخرین فعالیت' : 'Last activity'}>
              {relativeTimeLabel}
            </SheetStat>
            {buyerProbability && (
              <SheetStat label={isFa ? 'فروش' : 'Sales'}>
                <SalesInsightText insight={buyerProbability} locale={locale} className="!text-sm" />
              </SheetStat>
            )}
            {typeof satisfaction === 'number' && (
              <SheetStat label={isFa ? 'رضایت مشتری' : 'Satisfaction'}>
                <SatisfactionText satisfaction={satisfaction} locale={locale} showScore />
              </SheetStat>
            )}
          </dl>
        </div>
      </MobileBottomSheet>
    </>
  )
}

function SheetStat({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-black/[0.03] p-3.5">
      <dt className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">{children}</dd>
    </div>
  )
}
