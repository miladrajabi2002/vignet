'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import type { ChannelType, ConvStatus } from '@prisma/client'
import { cn } from '@/lib/utils'
import { smartTime, formatDateTime } from '@/lib/format'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ConversationStatusBadge } from '@/components/crm/conversation-status-badge'
import { SalesInsightBadge } from '@/components/crm/sales-insight'
import { MobileConversationCard } from '@/components/crm/mobile-conversation-card'
import { LiveArrivalItem } from '@/components/crm/live-arrivals'
import { BulkDeleteButton } from '@/components/ui/bulk-delete-button'
import { fetchAllResultIds, SelectionBar, SelectionHeader } from '@/components/ui/selection-bar'
import { useTableSelection } from '@/lib/hooks/use-table-selection'

/**
 * Conversation inbox with row selection (tri-state + shift-click +
 * select-all-N). Extracted from the server page so selection state can live
 * on the client; rendering (desktop rows + mobile cards) is unchanged apart
 * from the checkbox column.
 */

export interface ConversationInboxItem {
  id: string
  who: string
  avatarSrc: string | null
  channelHandle: string | null
  sourceLabel: string | null
  when: string
  messageCount: number
  channel: ChannelType
  status: ConvStatus
  statusLabel: string
  attention: boolean
  lastMessage: string
  reactionEmoji: string | null
  salesInsight: { leadType: 'UNCLEAR' | 'INFORMATION_SEEKER' | 'BUYER' | 'EXISTING_CUSTOMER' | 'SUPPORT_SEEKER'; buyerProbability: number } | null
}

export interface ConversationSelectionFilters {
  channel: string
  status: string
  agent: string
  sales: string
  q: string
}

export function ConversationInbox({
  items,
  totalResults,
  filters,
}: {
  items: ConversationInboxItem[]
  /** Server count of every conversation matching the current filters. */
  totalResults: number
  /** Current list filters — fed to /api/conversations/ids for select-all-N. */
  filters: ConversationSelectionFilters
}) {
  const locale = useLocale()
  const fa = locale !== 'en'
  const selection = useTableSelection(items.map((item) => item.id))
  const [loadingAll, setLoadingAll] = useState(false)

  async function handleSelectAllResults() {
    setLoadingAll(true)
    try {
      const params = new URLSearchParams()
      if (filters.channel) params.set('channel', filters.channel)
      if (filters.status) params.set('status', filters.status)
      if (filters.agent) params.set('agent', filters.agent)
      if (filters.sales) params.set('sales', filters.sales)
      if (filters.q) params.set('q', filters.q)
      const ids = await fetchAllResultIds('/api/conversations/ids', params)
      selection.setSelectedIds(ids)
    } catch {
      // Best effort — the button stays available for a retry.
    } finally {
      setLoadingAll(false)
    }
  }

  function rowCheckbox(id: string, who: string) {
    const checked = selection.isSelected(id)
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`${fa ? 'انتخاب گفتگو' : 'Select conversation'}: ${who}`}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          selection.toggle(id, { shiftKey: event.shiftKey })
        }}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid h-[1.15rem] w-[1.15rem] place-items-center rounded-[0.4rem] border transition-colors',
            checked
              ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]'
              : 'border-black/25 bg-white',
          )}
        >
          {checked && (
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <SelectionHeader
        locale={fa ? 'fa' : 'en'}
        triState={selection.triState}
        onToggleVisible={selection.toggleVisible}
        visibleCount={items.length}
        entityLabel={fa ? 'گفتگو' : 'conversation'}
      />
              <SelectionBar
          hidden={selection.selectedCount === 0}
          locale={fa ? 'fa' : 'en'}
          selectedCount={selection.selectedCount}
          visibleCount={items.length}
          totalResults={totalResults}
          loadingAll={loadingAll}
          allResultsSelected={selection.selectedCount >= totalResults}
          onSelectAllResults={handleSelectAllResults}
          onClear={selection.clear}
        >
          <BulkDeleteButton
            countEndpoint="/api/conversations/bulk"
            deleteEndpoint="/api/conversations/bulk"
            restoreEndpoint="/api/conversations/bulk/restore"
            entityLabel={fa ? 'گفتگو' : 'conversation'}
            entitySingularLabel={fa ? 'گفتگو' : 'conversation'}
            buttonLabel={fa
              ? `حذف ${selection.selectedCount.toLocaleString('fa-IR')} گفتگو`
              : `Delete ${selection.selectedCount} conversations`}
            dialogTitle={fa
              ? `حذف ${selection.selectedCount.toLocaleString('fa-IR')} گفتگو؟`
              : `Delete ${selection.selectedCount} conversations?`}
            countOverride={selection.selectedCount}
            deleteBody={{ ids: [...selection.selected] }}
            compactOnMobile
            onDeleted={selection.clear}
            onRestored={selection.clear}
          />
        </SelectionBar>

      {/* ── Mobile cards ── */}
      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <LiveArrivalItem key={`mobile-${item.id}`} itemId={item.id}>
            <div className="flex gap-1">
              <div className="flex shrink-0 items-center">{rowCheckbox(item.id, item.who)}</div>
              <div className="min-w-0 flex-1">
                <MobileConversationCard
                  conversationId={item.id}
                  who={item.who}
                  avatarSrc={item.avatarSrc}
                  channelHandle={item.channelHandle}
                  sourceLabel={item.sourceLabel}
                  relativeTimeLabel={smartTime(new Date(item.when), fa ? 'fa' : 'en')}
                  messageCountLabel={`${item.messageCount.toLocaleString(fa ? 'fa-IR' : 'en-US')} ${fa ? 'پیام' : 'messages'}`}
                  channel={item.channel}
                  status={item.status}
                  statusLabel={item.statusLabel}
                  attention={item.attention}
                  locale={fa ? 'fa' : 'en'}
                  lastMessage={item.lastMessage}
                  reactionEmoji={item.reactionEmoji}
                />
              </div>
            </div>
          </LiveArrivalItem>
        ))}
      </div>

      {/* ── Desktop rows ── */}
      <div className="spatial-surface hidden min-w-0 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[1.5rem] md:block">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={selection.triState === 'all' ? true : selection.triState === 'partial' ? 'mixed' : false}
              aria-label={fa ? 'انتخاب همه گفتگوهای این صفحه' : 'Select all conversations on this page'}
              onClick={selection.toggleVisible}
              className="grid h-11 w-11 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid h-[1.15rem] w-[1.15rem] place-items-center rounded-[0.4rem] border text-[var(--bg-base)]',
                  selection.triState === 'none'
                    ? 'border-black/25 bg-white'
                    : 'border-[var(--text-primary)] bg-[var(--text-primary)]',
                )}
              >
                {selection.triState === 'partial' && <span className="h-[3px] w-2 rounded-full bg-current" />}
                {selection.triState === 'all' && (
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
                    <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">{fa ? 'صندوق گفتگوها' : 'Conversation inbox'}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{fa ? 'انتخاب کنید و عملیات گروهی انجام دهید' : 'Select rows for bulk actions'}</p>
            </div>
          </div>
        </div>
        {items.map((item) => (
          <LiveArrivalItem
            key={`desktop-${item.id}`}
            itemId={item.id}
            className={cn(
              'group flex items-center gap-2 px-3 py-3 transition-colors hover:bg-[var(--bg-hover)] sm:px-4',
              selection.isSelected(item.id) && 'bg-[var(--bg-muted)]/70',
              item.attention && 'bg-amber-500/5',
            )}
          >
            {rowCheckbox(item.id, item.who)}
            <Link
              href={`/conversations/${item.id}`}
              dir={fa ? 'rtl' : 'ltr'}
              className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
            >
              <ContactAvatar src={item.avatarSrc} alt={item.who} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  <span dir="auto" className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]" title={item.who}>{item.who}</span>
                  {item.channelHandle && item.who !== item.channelHandle && <span dir="ltr" className="max-w-28 shrink truncate rounded-full bg-[var(--bg-base)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]" title={`@${item.channelHandle}`}>{`@${item.channelHandle}`}</span>}
                  {item.sourceLabel && <span className="shrink-0 rounded-full border border-black/[0.07] bg-black/[0.035] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{item.sourceLabel}</span>}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-1.5">
                  {item.reactionEmoji && (
                    <span
                      dir="ltr"
                      className="emoji-glyph inline-flex h-5 shrink-0 items-center rounded-full border border-black/[0.08] bg-white px-1.5 text-[13px] leading-none shadow-sm"
                      aria-label={fa ? 'واکنش مشتری' : 'Customer reaction'}
                    >
                      {item.reactionEmoji}
                    </span>
                  )}
                  <p dir={fa ? 'rtl' : 'ltr'} className="min-w-0 flex-1 truncate text-start text-xs leading-5 text-[var(--text-secondary)] [overflow-wrap:anywhere]" title={item.lastMessage}>{item.lastMessage}</p>
                </div>
              </div>
              <span className="flex max-w-sm shrink-0 flex-row flex-wrap items-center justify-end gap-1.5 text-[11px] leading-5 text-[var(--text-muted)]">
                <ConversationStatusBadge status={item.status} label={item.statusLabel} attention={item.attention} />
                <ChannelBadge type={item.channel} />
                {item.salesInsight && item.salesInsight.leadType !== 'UNCLEAR' && <SalesInsightBadge insight={item.salesInsight} locale={fa ? 'fa' : 'en'} compactOnMobile />}
                <span className="tabular-nums" title={formatDateTime(new Date(item.when), fa ? 'fa' : 'en')}>{smartTime(new Date(item.when), fa ? 'fa' : 'en')}</span>
                <span className="tabular-nums">{item.messageCount.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'پیام' : 'messages'}</span>
              </span>
            </Link>
          </LiveArrivalItem>
        ))}
      </div>
    </div>
  )
}
