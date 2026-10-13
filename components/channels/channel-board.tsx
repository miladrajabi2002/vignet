'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SideSheet } from '@/components/ui/side-sheet'
import { StatusChip, type ChipTone } from '@/components/ui/status-chip'
import { cn } from '@/lib/utils'

/** One state vocabulary for every connection, whatever it is made of. */
export type ChannelStatus = 'on' | 'off' | 'attention' | 'paused'

export interface ChannelBoardItem {
  key: string
  label: string
  /** One line under the name: the connected account, or what the channel is for. */
  hint: string
  status: ChannelStatus
  mark: ReactNode
  /** How much room the sheet needs: a form beside its preview, or a full editor. */
  size?: 'lg' | 'xl'
  content: ReactNode
}

// The sheet is only as wide as what it holds, so a short form never opens
// onto an empty canvas.
const SHEET_WIDTH: Record<NonNullable<ChannelBoardItem['size']>, string> = {
  lg: 'md:w-[min(58rem,calc(100vw-1.5rem))]',
  xl: 'md:w-[min(68rem,calc(100vw-1.5rem))]',
}

const TONE: Record<ChannelStatus, ChipTone> = {
  on: 'ok',
  off: 'neutral',
  attention: 'danger',
  paused: 'warn',
}

const STATUS_KEY: Record<ChannelStatus, string> = {
  on: 'statusOn',
  off: 'statusOff',
  attention: 'statusAttention',
  paused: 'statusPaused',
}

/**
 * The agent's connections as a board of short cards. A card opens its
 * connection in a side sheet, so the page itself only ever answers «what is
 * connected?». `?open=<KEY>` opens a sheet directly (links from «اتصال‌ها»,
 * the Instagram OAuth return).
 */
export function ChannelBoard({
  items,
  initialOpen,
}: {
  items: ChannelBoardItem[]
  initialOpen?: string | null
}) {
  const t = useTranslations('channels')
  const [openKey, setOpenKey] = useState<string | null>(
    initialOpen && items.some((item) => item.key === initialOpen) ? initialOpen : null,
  )
  const open = items.find((item) => item.key === openKey) ?? null

  // Keep the address in step so a reload (or a shared link) lands on the same sheet.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (openKey) url.searchParams.set('open', openKey)
    else url.searchParams.delete('open')
    window.history.replaceState(window.history.state, '', url)
  }, [openKey])

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3" aria-label={t('mobileChannelList')}>
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => setOpenKey(item.key)}
              aria-haspopup="dialog"
              className="spatial-surface flex h-full w-full flex-col gap-3 rounded-card p-4 text-start transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:transform-none sm:p-5"
            >
              <span className="flex items-center justify-between gap-2">
                {item.mark}
                <StatusChip tone={TONE[item.status]} dot={item.status !== 'off'}>
                  {t(STATUS_KEY[item.status])}
                </StatusChip>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[var(--text-primary)]">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]"><bdi>{item.hint}</bdi></span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <SideSheet
          title={open.label}
          subtitle={open.hint}
          icon={open.mark}
          badge={
            <StatusChip tone={TONE[open.status]} dot={open.status !== 'off'}>
              {t(STATUS_KEY[open.status])}
            </StatusChip>
          }
          onClose={() => setOpenKey(null)}
          className={cn(
            'md:transition-[width] md:duration-300 md:ease-out motion-reduce:transition-none',
            open.size && SHEET_WIDTH[open.size],
          )}
        >
          {open.content}
        </SideSheet>
      )}
    </>
  )
}
