'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ChannelType } from '@prisma/client'
import { Users, Search, LayoutList, Columns3, User, GripVertical } from 'lucide-react'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface ContactRow {
  id: string
  name: string | null
  phone: string | null
  stage: string
  tags: string[]
  channels: ChannelType[]
  conversationCount: number
  updatedAt: string
}

const STAGES = ['lead', 'qualified', 'customer', 'lost'] as const
type Stage = (typeof STAGES)[number]

const STAGE_KEY: Record<Stage, string> = {
  lead: 'stageLead',
  qualified: 'stageQualified',
  customer: 'stageCustomer',
  lost: 'stageLost',
}

export function ContactsView({
  initial,
  locale,
  footer,
}: {
  initial: ContactRow[]
  locale: 'fa' | 'en'
  footer?: React.ReactNode
}) {
  const t = useTranslations('contacts')
  const [rows, setRows] = useState(initial)
  const [view, setView] = useState<'list' | 'pipeline'>('list')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q),
    )
  }, [rows, query])

  async function move(id: string, stage: Stage) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, stage } : r)))
    await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    }).catch(() => {})
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-[var(--text-primary)]">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border-default)] p-1">
          <ToggleBtn
            active={view === 'list'}
            onClick={() => setView('list')}
            icon={<LayoutList className="h-4 w-4" />}
            label={t('list')}
          />
          <ToggleBtn
            active={view === 'pipeline'}
            onClick={() => setView('pipeline')}
            icon={<Columns3 className="h-4 w-4" />}
            label={t('pipeline')}
          />
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')}
          className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] py-2.5 pe-3 ps-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
          <Users className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-4 text-sm text-[var(--text-secondary)]">{t('empty')}</p>
        </div>
      ) : view === 'list' ? (
        <ListView rows={filtered} locale={locale} onMove={move} />
      ) : (
        <PipelineView rows={filtered} onMove={move} />
      )}

      {/* Pagination only makes sense for the flat list; the pipeline drags
          across stages within the loaded page and a search hides the controls. */}
      {footer && view === 'list' && !query ? footer : null}
    </div>
  )
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function StageSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (s: Stage) => void
}) {
  const t = useTranslations('contacts')
  return (
    <select
      value={STAGES.includes(value as Stage) ? value : 'lead'}
      onChange={(e) => onChange(e.target.value as Stage)}
      className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none"
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {t(STAGE_KEY[s])}
        </option>
      ))}
    </select>
  )
}

function Avatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
      <User className="h-4 w-4" />
    </div>
  )
}

function ListView({
  rows,
  locale,
  onMove,
}: {
  rows: ContactRow[]
  locale: 'fa' | 'en'
  onMove: (id: string, s: Stage) => void
}) {
  const t = useTranslations('contacts')
  return (
    <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      {rows.map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-4 py-3">
          <Avatar />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/contacts/${c.id}`}
                className="truncate text-sm font-medium text-[var(--text-primary)] hover:underline"
              >
                {c.name || c.phone || t('anonymous')}
              </Link>
              {c.channels.map((ch) => (
                <ChannelBadge key={ch} type={ch} />
              ))}
            </div>
            <p className="truncate text-xs text-[var(--text-secondary)]">
              {c.conversationCount} {t('conversations')} · {t('lastSeen')}{' '}
              {relativeTime(new Date(c.updatedAt), locale)}
            </p>
          </div>
          <StageSelect value={c.stage} onChange={(s) => onMove(c.id, s)} />
        </div>
      ))}
    </div>
  )
}

function PipelineView({
  rows,
  onMove,
}: {
  rows: ContactRow[]
  onMove: (id: string, s: Stage) => void
}) {
  const t = useTranslations('contacts')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<Stage | null>(null)

  function stageOf(r: ContactRow): Stage {
    return STAGES.includes(r.stage as Stage) ? (r.stage as Stage) : 'lead'
  }

  function handleDrop(stage: Stage) {
    if (dragId) {
      const cur = rows.find((r) => r.id === dragId)
      if (cur && stageOf(cur) !== stage) onMove(dragId, stage)
    }
    setDragId(null)
    setOverStage(null)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STAGES.map((stage) => {
        const items = rows.filter((r) => stageOf(r) === stage)
        const isOver = overStage === stage
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              if (!dragId) return
              e.preventDefault()
              if (overStage !== stage) setOverStage(stage)
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return
              if (overStage === stage) setOverStage(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(stage)
            }}
            className={cn(
              'flex flex-col rounded-2xl border bg-[var(--bg-surface)] transition-colors',
              isOver
                ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
                : 'border-[var(--border-default)]',
            )}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {t(STAGE_KEY[stage])}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {items.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              {items.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                  {isOver ? t('dropHere') : t('noStage')}
                </p>
              ) : (
                items.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(c.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverStage(null)
                    }}
                    className={cn(
                      'group cursor-grab rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 transition-opacity active:cursor-grabbing',
                      dragId === c.id && 'opacity-40',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                      <Link
                        href={`/contacts/${c.id}`}
                        className="truncate text-sm font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {c.name || c.phone || t('anonymous')}
                      </Link>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {c.channels.map((ch) => (
                        <ChannelBadge key={ch} type={ch} />
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {c.conversationCount} {t('conversations')}
                      </span>
                      <StageSelect
                        value={c.stage}
                        onChange={(s) => onMove(c.id, s)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
