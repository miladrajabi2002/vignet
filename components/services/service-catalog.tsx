'use client'

import { useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  CalendarClock,
  Pencil,
  Plus,
  Loader2,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { Switch } from '@/components/ui/switch'
import { normalizePersian } from '@/lib/search/persian'
import { SERVICE_TEMPLATES, ServiceEditor, type ServiceTemplate } from '@/components/bookings/service-editor'
import { WeekDots } from '@/components/bookings/services-board'
import { DeleteServiceDialog } from '@/components/bookings/delete-service'
import { enableBookingModule, openBookingSetup } from '@/components/services/enable-booking'
import {
  durationLabel,
  num,
  type ServiceRow,
} from '@/components/bookings/booking-model'

type Filter = 'all' | 'active' | 'inactive'

/**
 * /services — the catalog of services the agent introduces to customers.
 * Same visual language and editor as the bookings workspace; the editor runs
 * in `catalog` mode so it never overwrites a booking schedule.
 */
export function ServiceCatalog({
  initialServices,
  title,
  bookingEnabled,
}: {
  initialServices: ServiceRow[]
  title: string
  /** Whether this workspace also has the bookings module in its menu. */
  bookingEnabled: boolean
}) {
  const [services, setServices] = useState(initialServices)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editor, setEditor] = useState<{ open: boolean; service?: ServiceRow | null; template?: ServiceTemplate | null }>({ open: false })
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<ServiceRow | null>(null)
  const [bookingBusy, setBookingBusy] = useState<string | null>(null)

  const stats = useMemo(() => {
    const active = services.filter((item) => item.active)
    const bookings = services.reduce((sum, item) => sum + item.appointmentCount, 0)
    const average = active.length ? Math.round(active.reduce((sum, item) => sum + item.durationMinutes, 0) / active.length) : 0
    return { active: active.length, bookings, average }
  }, [services])

  const visible = useMemo(() => {
    const needle = normalizePersian(query.trim())
    return services
      .filter((item) => (filter === 'all' ? true : filter === 'active' ? item.active : !item.active))
      .filter((item) => !needle || normalizePersian(`${item.name} ${item.description ?? ''} ${item.location ?? ''}`).includes(needle))
  }, [services, query, filter])

  async function toggle(service: ServiceRow, active: boolean) {
    setError('')
    setServices((rows) => rows.map((row) => (row.id === service.id ? { ...row, active } : row)))
    const response = await fetch(`/api/appointments/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    }).catch(() => null)
    if (!response?.ok) {
      setServices((rows) => rows.map((row) => (row.id === service.id ? { ...row, active: !active } : row)))
      setError('تغییر وضعیت ذخیره نشد؛ دوباره تلاش کنید.')
    }
  }

  function removed(serviceId: string) {
    setServices((rows) => rows.filter((row) => row.id !== serviceId))
    setDeleting(null)
    setEditor({ open: false })
  }

  // Bookings not in the menu yet → switch the capability on first, then open
  // this service's hours in the bookings workspace.
  async function setUpBooking(service: ServiceRow) {
    setError('')
    if (!bookingEnabled) {
      setBookingBusy(service.id)
      if (!(await enableBookingModule('fa'))) {
        setBookingBusy(null)
        setError('رزرو آنلاین فعال نشد؛ دوباره تلاش کنید.')
        return
      }
    }
    openBookingSetup(service.id)
  }

  const openCreate = (template?: ServiceTemplate | null) => setEditor({ open: true, service: null, template: template ?? null })

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        icon={BriefcaseBusiness}
        title={title}
        subtitle="خدمت، مدت، قیمت و محل ارائه را یک‌بار ثبت کنید؛ ایجنت در گفتگو همین اطلاعات را دقیق به مشتری معرفی می‌کند."
        actions={services.length > 0 ? (
          <button type="button" onClick={() => openCreate()} className="spatial-press inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" />خدمت جدید
          </button>
        ) : undefined}
      />

      {services.length === 0 ? (
        <section className="spatial-surface rounded-sheet p-6 text-center sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]"><Sparkles className="h-6 w-6" /></span>
          <h2 className="ui-h2 mt-4">اولین خدمت را معرفی کنید</h2>
          <p className="ui-body mx-auto mt-1 max-w-md">وقتی مشتری بپرسد «چه خدماتی دارید؟»، ایجنت دقیقاً از همین فهرست جواب می‌دهد، نه از حدس.</p>
          <button type="button" onClick={() => openCreate()} className="spatial-press mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--text-primary)] px-6 text-sm font-bold text-white shadow-[var(--shadow-control)]">
            <Plus className="h-4 w-4" />افزودن اولین خدمت
          </button>
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
            {SERVICE_TEMPLATES.map((template) => (
              <button key={template.key} type="button" onClick={() => openCreate(template)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]">
                {template.fa}<span className="font-normal text-[var(--text-muted)]">· {template.hintFa}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <dl className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white/80 rtl:divide-x-reverse lg:w-[26rem] lg:shrink-0">
              <Kpi label="خدمت فعال" value={num(stats.active, true)} />
              <Kpi label="رزرو ثبت‌شده" value={num(stats.bookings, true)} />
              <Kpi label="میانگین مدت" value={stats.average ? durationLabel(stats.average, true) : '—'} small />
            </dl>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block flex-1">
                <span className="sr-only">جستجوی خدمات</span>
                <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-hint)]" aria-hidden />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام، توضیح یا محل…" className="input min-h-12 w-full rounded-2xl ps-10" />
              </label>
              <div className="ui-seg grid-cols-3 sm:w-64" role="tablist" aria-label="فیلتر وضعیت">
                {([['all', 'همه'], ['active', 'فعال'], ['inactive', 'غیرفعال']] as const).map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className="ui-seg-tab text-[13px]">{label}</button>
                ))}
              </div>
            </div>
          </div>

          {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p>}

          {visible.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((service) => {
                const hasHours = service.weeklyRules.some((rule) => rule.active)
                return (
                  <article key={service.id} className={cn('spatial-surface flex flex-col rounded-card p-4 transition-shadow hover:shadow-[var(--shadow-soft)]', !service.active && 'opacity-70')}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="ui-h3 truncate">{service.name}</h3>
                        <p className="mt-0.5 line-clamp-2 min-h-[2.75rem] text-[13px] leading-[1.4rem] text-[var(--text-secondary)]">{service.description || <span className="text-[var(--text-muted)]">بدون توضیح؛ یک جمله کوتاه به ایجنت کمک می‌کند بهتر معرفی کند.</span>}</p>
                      </div>
                      <Switch checked={service.active} onChange={(checked) => void toggle(service, checked)} aria-label={service.active ? 'غیرفعال کردن خدمت' : 'فعال کردن خدمت'} />
                    </div>

                    {/* Length, price and place as one line; open days as seven dots. */}
                    <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                      {[
                        durationLabel(service.durationMinutes, true),
                        service.price ? `${num(service.price, true)} تومان` : null,
                        service.location,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {hasHours && <div className="mt-2.5"><WeekDots service={service} fa /></div>}

                    <div className="mt-auto flex items-center gap-1.5 pt-3">
                      <span className="text-[12px] font-medium tabular-nums text-[var(--text-primary)]">{num(service.appointmentCount, true)} رزرو</span>
                      <button type="button" disabled={bookingBusy === service.id} onClick={() => void setUpBooking(service)} className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-60">
                        {bookingBusy === service.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}{bookingEnabled && hasHours ? 'ساعت و ظرفیت' : 'فعال‌سازی رزرو'}
                      </button>
                      <button type="button" onClick={() => setDeleting(service)} aria-label={`حذف ${service.name}`} title="حذف خدمت" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--text-hint)] transition-colors hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setEditor({ open: true, service })} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
                        <Pencil className="h-3.5 w-3.5" />ویرایش
                      </button>
                    </div>
                  </article>
                )
              })}
              {filter !== 'inactive' && !query && (
                <button type="button" onClick={() => openCreate()} className="group grid min-h-[9rem] place-items-center rounded-card border-2 border-dashed border-[var(--border-default)] p-6 text-center transition-colors hover:border-[var(--text-primary)] hover:bg-white/60">
                  <span>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)] transition-transform group-hover:scale-105"><Plus className="h-5 w-5" /></span>
                    <span className="mt-3 block text-sm font-bold text-[var(--text-primary)]">افزودن خدمت</span>
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-card border border-dashed border-[var(--border-default)] bg-white/60 p-8 text-center">
              <div>
                <Search className="mx-auto h-6 w-6 text-[var(--text-hint)]" />
                <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">خدمتی با این مشخصات پیدا نشد</p>
                <button type="button" onClick={() => { setQuery(''); setFilter('all') }} className="mt-3 min-h-11 rounded-xl px-3 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">پاک کردن فیلترها</button>
              </div>
            </div>
          )}
        </>
      )}

      {editor.open && (
        <ServiceEditor
          variant="catalog"
          bookingEnabled={bookingEnabled}
          locale="fa"
          service={editor.service}
          template={editor.template}
          onClose={() => setEditor({ open: false })}
          onDeleted={removed}
          onSaved={(saved, created, keepOpen) => {
            setServices((rows) => (created ? [saved, ...rows] : rows.map((row) => (row.id === saved.id ? saved : row))))
            if (!keepOpen) setEditor({ open: false })
          }}
        />
      )}
      {deleting && (
        <DeleteServiceDialog
          locale="fa"
          service={deleting}
          onCancel={() => setDeleting(null)}
          onDeleted={removed}
          onPause={async () => { await toggle(deleting, false); setDeleting(null) }}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col-reverse px-2 py-2.5 text-center">
      <dt className="truncate text-[12px] text-[var(--text-muted)]">{label}</dt>
      <dd className={cn('truncate font-bold tabular-nums leading-7 text-[var(--text-primary)]', small ? 'text-[15px]' : 'text-lg')}>{value}</dd>
    </div>
  )
}
