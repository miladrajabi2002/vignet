'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Headset, MessageCircle, CheckCircle2, X } from 'lucide-react'

type StatusKey = 'OPEN' | 'RESOLVED' | 'HANDED_OFF'

interface StatusOption {
  key: StatusKey | 'ALL'
  label: string
  count: number
}

interface ChannelOption {
  key: string
  label: string
  count: number
}

/**
 * Build a filter URL from the active status + channel.
 * This stays inside the Client Component so we don't pass a function
 * across the RSC border.
 */
function buildHref(
  basePath: string,
  status: string | undefined,
  channel: string | undefined,
): string {
  const sp = new URLSearchParams()
  if (status) sp.set('status', status)
  if (channel) sp.set('channel', channel)
  const qs = sp.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/**
 * Conversation filter bar — status pills (with handed-off highlighted) +
 * channel pills + active-filter chip with clear button.
 *
 * Theme-aware (uses CSS variables) so it works in both light and dark.
 */
export function ConversationFilters({
  statusOptions,
  channelOptions,
  activeStatus,
  activeChannel,
  basePath = '/conversations',
  isFa,
}: {
  statusOptions: StatusOption[]
  channelOptions: ChannelOption[]
  activeStatus: string | undefined
  activeChannel: string | undefined
  basePath?: string
  isFa: boolean
}) {
  const hasActiveFilter = !!activeStatus || !!activeChannel
  const activeStatusLabel =
    statusOptions.find((o) => o.key === activeStatus)?.label ?? activeStatus
  const activeChannelLabel =
    channelOptions.find((o) => o.key === activeChannel)?.label ?? activeChannel

  return (
    <div
      className="rounded-2xl border bg-[var(--bg-surface)] p-3 sm:p-4"
      style={{ borderColor: 'var(--border-default)' }}
    >
      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="ms-1 shrink-0 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {isFa ? 'وضعیت' : 'Status'}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {statusOptions.map((opt) => {
            const isAll = opt.key === 'ALL'
            const active = isAll ? !activeStatus : activeStatus === opt.key
            const isHandoff = opt.key === 'HANDED_OFF'

            // Icon per status.
            const Icon = isAll
              ? null
              : isHandoff
                ? Headset
                : opt.key === 'OPEN'
                  ? MessageCircle
                  : CheckCircle2

            return (
              <Link
                key={opt.key}
                href={buildHref(
                  basePath,
                  isAll ? undefined : opt.key,
                  activeChannel,
                )}
                className={cn(
                  'group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  active
                    ? isHandoff
                      ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-400'
                      : 'bg-[var(--white)] text-[var(--bg-base)] shadow-sm'
                    : isHandoff
                      ? 'border border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                      : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
                )}
              >
                {isHandoff && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span
                      className={cn(
                        'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                        active ? 'bg-white' : 'bg-amber-500',
                      )}
                    />
                    <span
                      className={cn(
                        'relative inline-flex h-1.5 w-1.5 rounded-full',
                        active ? 'bg-white' : 'bg-amber-500',
                      )}
                    />
                  </span>
                )}
                {!isHandoff && Icon && (
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5',
                      active
                        ? 'opacity-90'
                        : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]',
                    )}
                  />
                )}
                {opt.label}
                {!isAll && (
                  <span
                    className={cn(
                      'rounded px-1 text-[10px] tabular-nums',
                      active
                        ? isHandoff
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-base)]/10 text-[var(--bg-base)]'
                        : 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
                    )}
                  >
                    {opt.count.toLocaleString('fa-IR')}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Channel row (only if channels exist) */}
      {channelOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
          <span className="ms-1 shrink-0 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {isFa ? 'کانال' : 'Channel'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {channelOptions.map((opt) => {
              const isAll = opt.key === 'ALL'
              const active = isAll ? !activeChannel : activeChannel === opt.key
              return (
                <Link
                  key={opt.key}
                  href={buildHref(
                    basePath,
                    activeStatus,
                    isAll ? undefined : opt.key,
                  )}
                  className={cn(
                    'group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                    active
                      ? 'bg-[var(--white)] text-[var(--bg-base)] shadow-sm'
                      : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {opt.label}
                  {!isAll && (
                    <span
                      className={cn(
                        'rounded px-1 text-[10px] tabular-nums',
                        active
                          ? 'bg-[var(--bg-base)]/10 text-[var(--bg-base)]'
                          : 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
                      )}
                    >
                      {opt.count.toLocaleString('fa-IR')}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Active filter chip with clear button */}
      {hasActiveFilter && (
        <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
          <span className="text-[11px] text-[var(--text-muted)]">
            {isFa ? 'فیلتر فعال:' : 'Active:'}
          </span>
          {activeStatus && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
              {activeStatusLabel}
            </span>
          )}
          {activeChannel && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
              {activeChannelLabel}
            </span>
          )}
          <Link
            href={basePath}
            className="ms-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3 w-3" />
            {isFa ? 'حذف فیلترها' : 'Clear all'}
          </Link>
        </div>
      )}
    </div>
  )
}
