'use client'

import { useState } from 'react'
import { CalendarOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import {
  WEEKDAYS,
  durationLabel,
  num,
  serviceAccent,
  type Locale,
  type ServiceRow,
} from '@/components/bookings/booking-model'

/**
 * Weekly-hours graph: one 24h track per weekday with the open ranges drawn in
 * the service's accent. Reads like a mini Gantt, so a manager sees at a glance
 * which days are open and where the lunch break is.
 */
export function WeekHoursGraph({ service, fa }: { service: ServiceRow; fa: boolean }) {
  const accent = serviceAccent(service.id)
  return (
    <div className="space-y-1.5">
      {WEEKDAYS.map((day) => {
        const rules = service.weeklyRules.filter((rule) => rule.active && rule.weekday === day.value)
        return (
          <div key={day.value} className="flex items-center gap-2">
            <span className={cn('w-4 shrink-0 text-center text-[12px] font-bold', rules.length ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]')}>{fa ? day.short : day.en.slice(0, 2)}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-black/[0.045]" dir="ltr">
              {rules.map((rule, index) => (
                <span
                  key={index}
                  className={cn('absolute inset-y-0 rounded-full', service.active ? accent.bar : 'bg-black/25')}
                  style={{ left: `${(rule.startMinute / 1440) * 100}%`, width: `${((rule.endMinute - rule.startMinute) / 1440) * 100}%` }}
                />
              ))}
            </div>
          </div>
        )
      })}
      <div className="flex justify-between ps-6 text-[12px] tabular-nums text-[var(--text-muted)]" dir="ltr">
        <span>0</span><span>6</span><span>12</span><span>18</span><span>24</span>
      </div>
    </div>
  )
}

function clock(minute: number, fa: boolean) {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  const text = m ? `${h}:${String(m).padStart(2, '0')}` : String(h)
  return fa ? text.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : text
}

/** Seven weekday dots (filled = open) and the hours in words. */
export function WeekDots({ service, fa }: { service: ServiceRow; fa: boolean }) {
  const active = service.weeklyRules.filter((rule) => rule.active)
  const ranges = new Set(active.map((rule) => `${rule.startMinute}-${rule.endMinute}`))
  const perDay = new Map<number, number>()
  for (const rule of active) perDay.set(rule.weekday, (perDay.get(rule.weekday) ?? 0) + 1)
  const uniform = ranges.size === 1 && [...perDay.values()].every((count) => count === 1)
  const first = active[0]
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <span className="flex gap-1" role="img" aria-label={fa ? `${num(perDay.size, true)} روز باز در هفته` : `${perDay.size} open days a week`}>
        {WEEKDAYS.map((day) => (
          <span
            key={day.value}
            className={cn(
              'grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold',
              perDay.has(day.value)
                ? service.active ? 'bg-[var(--text-primary)] text-white' : 'bg-black/30 text-white'
                : 'bg-black/[0.05] text-[var(--text-hint)]',
            )}
          >
            {fa ? day.short : day.en.slice(0, 1)}
          </span>
        ))}
      </span>
      <span className="text-[12px] tabular-nums text-[var(--text-secondary)]">
        {uniform && first
          ? (fa ? `${clock(first.startMinute, true)} تا ${clock(first.endMinute, true)}` : `${clock(first.startMinute, false)}–${clock(first.endMinute, false)}`)
          : (fa ? 'ساعت‌ها در روزهای مختلف فرق دارد' : 'Hours vary by day')}
      </span>
    </div>
  )
}

export function ServicesBoard({
  locale,
  services,
  onEdit,
  onDelete,
  onCreate,
  onToggle,
}: {
  locale: Locale
  services: ServiceRow[]
  onEdit: (service: ServiceRow) => void
  onDelete: (service: ServiceRow) => void
  onCreate: () => void
  onToggle: (service: ServiceRow, active: boolean) => Promise<void>
}) {
  const fa = locale === 'fa'
  const [busyId, setBusyId] = useState<string | null>(null)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => {
        const today = dateKeyInTimeZone(new Date(), service.timezone)
        const closures = service.exceptions.filter((item) => item.date >= today)
        const openDays = new Set(service.weeklyRules.filter((rule) => rule.active).map((rule) => rule.weekday)).size
        return (
          <article
            key={service.id}
            className={cn(
              'spatial-surface group flex flex-col rounded-card p-4 transition-shadow hover:shadow-[var(--shadow-soft)]',
              !service.active && 'opacity-70',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="ui-h3 truncate">{service.name}</h3>
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-muted)]">
                  {[
                    durationLabel(service.durationMinutes, fa),
                    fa ? `ظرفیت ${num(service.capacity, true)} نفر` : `${service.capacity} at once`,
                    service.location,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Switch
                checked={service.active}
                disabled={busyId === service.id}
                onChange={async (checked) => {
                  setBusyId(service.id)
                  try { await onToggle(service, checked) } finally { setBusyId(null) }
                }}
                aria-label={fa ? (service.active ? 'غیرفعال کردن رزرو این خدمت' : 'فعال کردن رزرو این خدمت') : 'Toggle booking'}
              />
            </div>

            {/* Open days as seven dots and the hours as one line; the full
                weekly graph lives in the editor. */}
            <div className="mt-3">
              {openDays ? (
                <WeekDots service={service} fa={fa} />
              ) : (
                <p className="text-xs font-medium text-amber-700">{fa ? 'ساعت کاری ندارد؛ ایجنت زمانی پیشنهاد نمی‌دهد.' : 'No hours set, so the agent cannot offer times.'}</p>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
              <span className="ui-chip ui-chip-neutral">{fa ? `${num(service.appointmentCount, true)} رزرو` : `${service.appointmentCount} bookings`}</span>
              {closures.length > 0 && (
                <span className="ui-chip ui-chip-danger"><CalendarOff className="h-3 w-3" />{fa ? `${num(closures.length, true)} تاریخ خاص` : `${closures.length} exceptions`}</span>
              )}
              {!service.active && <span className="ui-chip ui-chip-warn">{fa ? 'بسته برای رزرو' : 'Paused'}</span>}
              <button
                type="button"
                onClick={() => onDelete(service)}
                aria-label={fa ? `حذف ${service.name}` : `Delete ${service.name}`}
                title={fa ? 'حذف خدمت' : 'Delete service'}
                className="ms-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--text-hint)] transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onEdit(service)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                <Pencil className="h-3.5 w-3.5" />{fa ? 'ویرایش' : 'Edit'}
              </button>
            </div>
          </article>
        )
      })}

      <button
        type="button"
        onClick={onCreate}
        className="group grid min-h-[10rem] place-items-center rounded-card border-2 border-dashed border-[var(--border-default)] p-6 text-center transition-colors hover:border-[var(--text-primary)] hover:bg-white/60"
      >
        <span>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)] transition-transform group-hover:scale-105">
            <Plus className="h-5 w-5" />
          </span>
          <span className="mt-3 block text-sm font-bold text-[var(--text-primary)]">{fa ? 'افزودن خدمت' : 'Add a service'}</span>
          <span className="mt-1 block text-xs text-[var(--text-muted)]">{fa ? 'مدت، ظرفیت و ساعت کاری مستقل' : 'Its own length, capacity and hours'}</span>
        </span>
      </button>
    </div>
  )
}
