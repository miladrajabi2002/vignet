'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Clock3, Loader2, MapPin, Pencil, Plus, Power, Search, Sparkles } from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'
import { DialogShell } from '@/components/ui/dialog-shell'
import { SectionHeader } from '@/components/dashboard/section-header'
import { cn } from '@/lib/utils'

type ServiceItem = {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  location: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  _count: { appointments: number }
}

const EMPTY_FORM = { name: '', description: '', durationMinutes: '60', location: '' }
const durations = [30, 45, 60, 90, 120].map((value) => ({ value: String(value), label: `${value.toLocaleString('fa-IR')} دقیقه` }))

export function ServiceCatalogManager({ initialServices }: { initialServices: ServiceItem[] }) {
  const searchParams = useSearchParams()
  const [items, setItems] = useState(initialServices)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const lastNewRef = useRef<string | null>(null)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setOpen(true)
  }

  function openEdit(item: ServiceItem) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description ?? '',
      durationMinutes: String(item.durationMinutes),
      location: item.location ?? '',
    })
    setError('')
    setOpen(true)
  }

  function closeDialog() {
    if (saving) return
    setOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  useEffect(() => {
    const newParam = searchParams.get('new')
    if (newParam && newParam !== lastNewRef.current) {
      lastNewRef.current = newParam
      openCreate()
    }
  // openCreate intentionally resets local form state; the query value is the trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.name.trim().length < 2 || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(
        editingId ? `/api/appointments/services/${editingId}` : '/api/appointments/services',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || (editingId ? null : undefined),
            durationMinutes: Number(form.durationMinutes),
            location: form.location.trim() || (editingId ? null : undefined),
            ...(editingId ? {} : { weeklyRules: [] }),
          }),
        },
      )
      const data = await response.json() as { service?: ServiceItem }
      if (!response.ok || !data.service) throw new Error()
      setItems((current) => editingId
        ? current.map((item) => item.id === editingId ? data.service! : item)
        : [data.service!, ...current])
      setOpen(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
    } catch {
      setError('ذخیره خدمت انجام نشد؛ اطلاعات را بررسی کنید.')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(item: ServiceItem) {
    setBusyId(item.id)
    setError('')
    try {
      const response = await fetch(`/api/appointments/services/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      })
      if (!response.ok) throw new Error()
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, active: !row.active } : row))
    } catch {
      setError('تغییر وضعیت انجام نشد.')
    } finally {
      setBusyId(null)
    }
  }

  const filteredItems = query.trim()
    ? items.filter((item) => `${item.name} ${item.description ?? ''} ${item.location ?? ''}`.toLocaleLowerCase('fa').includes(query.trim().toLocaleLowerCase('fa')))
    : items

  return (
    <section className="space-y-4">
      <SectionHeader
        title="خدمات قابل معرفی"
        subtitle="خدماتی که ویجنتو به مشتری معرفی می‌کند؛ برای هر خدمت مدت و محل ارائه را مشخص کنید."
      />

      {error && !open && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">{error}</p>}

      {items.length > 0 && (
        <div className="sticky top-[5.25rem] z-20 -mx-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/95 p-2 shadow-sm backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <label className="relative block">
            <span className="sr-only">جستجوی خدمات</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام، توضیح یا محل خدمت…" className="input min-h-11 w-full ps-10" />
          </label>
        </div>
      )}

      {items.length ? (
        filteredItems.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <article key={item.id} className={cn('spatial-surface rounded-[1.5rem] p-4 transition-opacity', !item.active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white"><Sparkles className="h-4 w-4" /></span>
                <span className={cn(
                  'inline-flex min-h-8 items-center rounded-full border px-2.5 text-[10px] font-bold',
                  item.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-black/10 bg-black/[0.035] text-black/45',
                )}>
                  {item.active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <h3 className="mt-4 font-bold text-[var(--text-primary)]">{item.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-[11px] leading-5 text-[var(--text-secondary)]">{item.description || 'توضیحی ثبت نشده است.'}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[9px] text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.045] px-2.5 py-1"><Clock3 className="h-3 w-3" />{item.durationMinutes.toLocaleString('fa-IR')} دقیقه</span>
                {item.location && <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.045] px-2.5 py-1"><MapPin className="h-3 w-3" />{item.location}</span>}
                <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.045] px-2.5 py-1"><CalendarDays className="h-3 w-3" />{item._count.appointments.toLocaleString('fa-IR')} رزرو</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openEdit(item)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-black/10 text-[10px] font-bold transition-colors hover:bg-black hover:text-white">
                  <Pencil className="h-3.5 w-3.5" /> ویرایش
                </button>
                <button type="button" disabled={busyId === item.id} onClick={() => void toggle(item)} aria-label={item.active ? 'غیرفعال کردن خدمت' : 'فعال کردن خدمت'} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-black/10 text-[10px] font-bold transition-colors hover:bg-black/[0.04] disabled:opacity-50">
                  {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  {item.active ? 'غیرفعال کردن' : 'فعال کردن'}
                </button>
              </div>
              <Link href="/appointments" className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-black/10 text-[10px] font-bold transition-colors hover:bg-black hover:text-white">تنظیم برنامه و رزرو</Link>
            </article>
          ))}
        </div> : (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-black/45">خدمتی با این عبارت پیدا نشد.</div>
        )
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-black/15 bg-white p-10 text-center">
          <BriefcaseEmpty />
          <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">هنوز خدمتی ثبت نشده است</p>
          <p className="mt-1 text-xs text-black/45">اولین خدمت را اضافه کنید تا ویجنتو بتواند آن را به مشتری معرفی کند.</p>
          <button type="button" onClick={openCreate} className="spatial-press mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-5 text-xs font-bold text-white">
            <Plus className="h-4 w-4" /> افزودن اولین خدمت
          </button>
        </div>
      )}

      {open && (
        <DialogShell
          title={editingId ? 'ویرایش خدمت' : 'افزودن خدمت جدید'}
          subtitle="این اطلاعات برای معرفی خدمت به مشتری و تنظیم رزرو استفاده می‌شود."
          onClose={closeDialog}
        >
          <form onSubmit={saveService} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">نام خدمت</span>
                <input className="input" data-dialog-initial-focus value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="مثلاً مشاوره اولیه" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">مدت معمول</span>
                <MaterialSelect value={form.durationMinutes} onValueChange={(value) => setForm((current) => ({ ...current, durationMinutes: value }))} options={durations} ariaLabel="مدت خدمت" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">محل ارائه</span>
                <input className="input" value={form.location} onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))} placeholder="حضوری، آنلاین یا آدرس" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">توضیح برای مشتری و ایجنت</span>
                <input className="input" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="این خدمت برای چه کسی مناسب است؟" />
              </label>
            </div>
            {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeDialog} disabled={saving} className="min-h-11 rounded-xl border border-[var(--border-default)] px-4 text-xs font-bold text-[var(--text-secondary)]">انصراف</button>
              <button type="submit" disabled={saving || form.name.trim().length < 2} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 text-xs font-bold text-white disabled:opacity-40">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? 'ذخیره تغییرات' : 'ذخیره خدمت'}
              </button>
            </div>
          </form>
        </DialogShell>
      )}
    </section>
  )
}

function BriefcaseEmpty() {
  return <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-black text-white"><Sparkles className="h-5 w-5" /></span>
}
