'use client'

import { type FormEvent, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Loader2,
  MessageCircleWarning,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { cn } from '@/lib/utils'

/**
 * Admin conversations search + filters — mirrors the user-dashboard
 * ConversationFilters UX exactly:
 *  - Desktop (md+): live search field + MaterialSelect dropdowns for status
 *    and channel (each option carries a live count) + a "needs operator"
 *    toggle + a clear-all button.
 *  - Mobile: search field + a filter button (badge = active facet count)
 *    that opens a bottom sheet with the same selects, plus removable
 *    active-filter chips.
 */

type StatusKey = 'OPEN' | 'RESOLVED' | 'HANDED_OFF'

interface StatusOption {
  key: StatusKey | 'ALL'
  label: string
  count: number
}

interface FilterOption {
  key: string
  label: string
  count: number
}

type NavigateInput = {
  status?: string
  channel?: string
  q?: string
}

export function AdminConversationFilters({
  statusOptions,
  channelOptions,
  activeStatus,
  activeChannel,
  query,
  resultCount,
}: {
  statusOptions: StatusOption[]
  channelOptions: FilterOption[]
  activeStatus: string | undefined
  activeChannel: string | undefined
  query?: string
  resultCount: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const paramsString = params.toString()
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const [searchValue, setSearchValue] = useState(query ?? '')
  const [filterOpen, setFilterOpen] = useState(false)
  const [isSearching, startSearchTransition] = useTransition()
  const hasActiveFilter = Boolean(activeStatus || activeChannel || searchValue)
  const activeFacetCount = [activeStatus, activeChannel].filter(Boolean).length

  function navigate(next: NavigateInput) {
    const sp = new URLSearchParams(params.toString())
    const values = {
      status: next.status !== undefined ? next.status : activeStatus,
      channel: next.channel !== undefined ? next.channel : activeChannel,
      q: next.q !== undefined ? next.q : searchValue.trim(),
    }
    for (const [key, value] of Object.entries(values)) {
      sp.delete(key)
      if (value) sp.set(key, value)
    }
    sp.delete('page')
    const qs = sp.toString()
    router.push(qs ? `/admin/conversations?${qs}` : '/admin/conversations', { scroll: false })
  }

  function clearAll() {
    setSearchValue('')
    router.push('/admin/conversations', { scroll: false })
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate({ q: searchValue.trim() || undefined })
  }

  useEffect(() => {
    setSearchValue(query ?? '')
  }, [query])

  // Debounced live search — 280ms after the last keystroke (same as user dashboard).
  useEffect(() => {
    const nextQuery = searchValue.trim()
    if (nextQuery === (query ?? '')) return

    const timer = window.setTimeout(() => {
      const sp = new URLSearchParams(paramsString)
      sp.delete('q')
      if (nextQuery) sp.set('q', nextQuery)
      sp.delete('page')
      const qs = sp.toString()
      startSearchTransition(() => {
        router.replace(qs ? `/admin/conversations?${qs}` : '/admin/conversations', {
          scroll: false,
        })
      })
    }, 280)

    return () => window.clearTimeout(timer)
  }, [paramsString, query, router, searchValue])

  const totalResults =
    statusOptions.find((option) => option.key === 'ALL')?.count ?? 0
  const operatorCount =
    statusOptions.find((option) => option.key === 'HANDED_OFF')?.count ?? 0
  const nf = new Intl.NumberFormat('fa-IR')
  const activeItems = [
    activeStatus
      ? {
          key: 'status',
          label:
            statusOptions.find((option) => option.key === activeStatus)?.label ??
            activeStatus,
          clear: () => navigate({ status: '' }),
        }
      : null,
    activeChannel
      ? {
          key: 'channel',
          label:
            channelOptions.find((option) => option.key === activeChannel)?.label ??
            activeChannel,
          clear: () => navigate({ channel: '' }),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))

  const searchProps = {
    value: searchValue,
    loading: isSearching,
    placeholder: 'کاربر، مخاطب، ایجنت یا متن پیام…',
    ariaLabel: 'جست‌وجوی گفتگوها',
    clearLabel: 'پاک‌کردن جست‌وجو',
    onChange: setSearchValue,
  }

  return (
    <>
      {/* ── Mobile: search + filter button (bottom sheet) ── */}
      <div className="md:hidden">
        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <AdminSearchField {...searchProps} />
          <button
            ref={filterTriggerRef}
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
            aria-label="فیلترهای گفتگو"
            className={cn(
              'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60',
              activeFacetCount > 0
                ? 'border-black bg-black text-white'
                : 'border-black/10 text-black/55',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {activeFacetCount > 0 && (
              <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-amber-400 px-1 text-[10px] font-bold tabular-nums text-black">
                {nf.format(activeFacetCount)}
              </span>
            )}
          </button>
        </form>

        {activeItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {activeItems.map((item) => (
              <ActiveFilterChip key={item.key} label={item.label} onRemove={item.clear} />
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop: search + selects + operator toggle + clear ── */}
      <form
        action="/admin/conversations"
        method="get"
        className="hidden flex-wrap items-center gap-2 md:flex"
        onSubmit={submitSearch}
      >
        {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
        {activeChannel && <input type="hidden" name="channel" value={activeChannel} />}

        <AdminSearchField {...searchProps} className="min-w-[13rem] flex-1" />

        <MaterialSelect
          value={activeStatus ?? ''}
          onValueChange={(status) => navigate({ status })}
          ariaLabel="وضعیت گفتگو"
          className="min-w-40"
          options={statusOptions.map((option) => ({
            value: option.key === 'ALL' ? '' : option.key,
            label: option.label,
            meta: nf.format(option.count),
          }))}
        />

        {channelOptions.length > 0 && (
          <MaterialSelect
            value={activeChannel ?? ''}
            onValueChange={(channel) => navigate({ channel })}
            ariaLabel="کانال گفتگو"
            className="min-w-40"
            options={channelOptions.map((option) => ({
              value: option.key === 'ALL' ? '' : option.key,
              label: option.label,
              meta:
                option.key === 'ALL'
                  ? nf.format(totalResults)
                  : nf.format(option.count),
            }))}
          />
        )}

        <button
          type="button"
          onClick={() =>
            navigate({
              status: activeStatus === 'HANDED_OFF' ? '' : 'HANDED_OFF',
            })
          }
          aria-pressed={activeStatus === 'HANDED_OFF'}
          className={cn(
            'inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.75rem] border px-3 text-xs font-semibold transition-[background-color,border-color,color] duration-150',
            activeStatus === 'HANDED_OFF'
              ? 'border-amber-400 bg-amber-400 text-black'
              : 'border-amber-400/25 bg-amber-400/[0.08] text-amber-700 hover:bg-amber-400/[0.14]',
          )}
        >
          <MessageCircleWarning className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden lg:inline">تحویل به اپراتور</span>
          <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] tabular-nums">
            {nf.format(operatorCount)}
          </span>
        </button>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="پاک‌کردن فیلترها"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[0.75rem] border border-black/[0.08] bg-white text-black/45 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>

      {/* ── Mobile bottom sheet ── */}
      <MobileBottomSheet
        open={filterOpen}
        title="فیلتر گفتگوها"
        description="گفتگوهای پلتفرم را بر اساس وضعیت و کانال محدود کنید"
        closeLabel="بستن فیلترها"
        triggerRef={filterTriggerRef}
        onClose={() => setFilterOpen(false)}
        footer={
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={clearAll}
              disabled={!hasActiveFilter}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/10 px-4 text-xs font-semibold text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 disabled:opacity-40"
            >
              پاک‌کردن
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
            >
              نمایش نتایج ({nf.format(resultCount)})
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FilterField label="وضعیت گفتگو">
            <MaterialSelect
              value={activeStatus ?? ''}
              onValueChange={(status) => navigate({ status })}
              ariaLabel="وضعیت گفتگو"
              options={statusOptions.map((option) => ({
                value: option.key === 'ALL' ? '' : option.key,
                label: option.label,
                meta: nf.format(option.count),
              }))}
            />
          </FilterField>

          {channelOptions.length > 0 && (
            <FilterField label="کانال گفتگو">
              <MaterialSelect
                value={activeChannel ?? ''}
                onValueChange={(channel) => navigate({ channel })}
                ariaLabel="کانال گفتگو"
                options={channelOptions.map((option) => ({
                  value: option.key === 'ALL' ? '' : option.key,
                  label: option.label,
                  meta:
                    option.key === 'ALL'
                      ? nf.format(totalResults)
                      : nf.format(option.count),
                }))}
              />
            </FilterField>
          )}
        </div>
      </MobileBottomSheet>
    </>
  )
}

function AdminSearchField({
  value,
  loading,
  placeholder,
  ariaLabel,
  clearLabel,
  onChange,
  className,
}: {
  value: string
  loading: boolean
  placeholder: string
  ariaLabel: string
  clearLabel: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      {loading ? (
        <Loader2
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-black/30 motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30"
          aria-hidden="true"
        />
      )}
      <input
        name="q"
        type="search"
        inputMode="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={120}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="admin-input min-h-11 w-full bg-black/[0.025] ps-9 pe-11 text-sm shadow-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute end-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-black/30 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
    >
      <span className="max-w-36 truncate">{label}</span>
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-black/60">{label}</span>
      {children}
    </div>
  )
}
