'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import type { ChannelType, ConvStatus } from '@prisma/client'
import { ArrowLeft, Clock3, MessagesSquare } from 'lucide-react'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { ConversationStatusBadge } from '@/components/crm/conversation-status-badge'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { cn } from '@/lib/utils'

export function MobileConversationCard({
  conversationId,
  who,
  avatarSrc,
  channelHandle,
  sourceLabel,
  relativeTimeLabel,
  messageCountLabel,
  channel,
  status,
  statusLabel,
  attention,
  locale,
}: {
  conversationId: string
  who: string
  avatarSrc?: string | null
  channelHandle?: string | null
  sourceLabel?: string | null
  relativeTimeLabel: string
  messageCountLabel: string
  channel: ChannelType
  status: ConvStatus
  statusLabel: string
  attention: boolean
  locale: 'fa' | 'en'
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isFa = locale === 'fa'

  return (
    <>
      <article
        className={cn(
          'spatial-surface overflow-hidden rounded-[1.35rem] transition-[border-color,box-shadow] duration-150',
          attention &&
            'border-amber-300/70 bg-amber-50/35 shadow-[0_14px_34px_rgba(245,158,11,0.08)]',
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${isFa ? 'نمایش جزئیات گفتگو با' : 'Show conversation details for'} ${who}`}
          className="spatial-press block min-h-16 w-full p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ContactAvatar src={avatarSrc} alt={who} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span
                  dir="auto"
                  className="min-w-0 truncate text-[15px] font-bold text-[var(--text-primary)]"
                >
                  {who}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                  {relativeTimeLabel}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ConversationStatusBadge
                  status={status}
                  label={statusLabel}
                  attention={attention}
                />
                <ChannelBadge type={channel} />
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
        description={isFa ? 'جزئیات گفتگو' : 'Conversation details'}
        closeLabel={isFa ? 'بستن جزئیات گفتگو' : 'Close conversation details'}
        motionPreset="detail"
        footer={
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <Link
              href={`/conversations/${conversationId}`}
              className="spatial-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
            >
              {isFa ? 'ورود به گفتگو' : 'Open conversation'}
              <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
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
                <ChannelBadge type={channel} />
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/[0.03] p-3.5">
              <dt className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
                {isFa ? 'تعداد پیام‌ها' : 'Messages'}
              </dt>
              <dd className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">
                {messageCountLabel}
              </dd>
            </div>
            <div className="rounded-2xl bg-black/[0.03] p-3.5">
              <dt className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {isFa ? 'آخرین فعالیت' : 'Last activity'}
              </dt>
              <dd className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">
                {relativeTimeLabel}
              </dd>
            </div>
          </dl>

          {sourceLabel && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3">
              <span className="text-xs text-[var(--text-muted)]">
                {isFa ? 'منبع گفتگو' : 'Conversation source'}
              </span>
              <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                {sourceLabel}
              </span>
            </div>
          )}

          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
            {isFa
              ? 'برای مشاهده پیام‌ها و پاسخ‌دادن، ورود به گفتگو را تأیید کنید.'
              : 'Confirm opening the conversation to read messages and reply.'}
          </p>
        </div>
      </MobileBottomSheet>
    </>
  )
}
