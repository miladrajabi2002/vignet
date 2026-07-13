'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarDays, Check, Clock3, Loader2, MapPin, Plus, Power, Sparkles } from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'
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

const durations = [30, 45, 60, 90, 120].map((value) => ({ value: String(value), label: `${value.toLocaleString('fa-IR')} دقیقه` }))

export function ServiceCatalogManager({ initialServices }: { initialServices: ServiceItem[] }) {
  const [items, setItems] = useState(initialServices)
  const [open, setOpen] = useState(initialServices.length === 0)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', description: '', durationMinutes: '60', location: '' })

  async function createService() {
    if (form.name.trim().length < 2 || saving) return
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/appointments/services', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || undefined, durationMinutes: Number(form.durationMinutes), location: form.location.trim() || undefined, weeklyRules: [] }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error()
      setItems((current) => [data.service, ...current])
      setForm({ name: '', description: '', durationMinutes: '60', location: '' })
      setOpen(false)
    } catch { setError('ذخیره خدمت انجام نشد؛ اطلاعات را بررسی کنید.') } finally { setSaving(false) }
  }

  async function toggle(item: ServiceItem) {
    setBusyId(item.id)
    try {
      const response = await fetch(`/api/appointments/services/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !item.active }) })
      if (!response.ok) throw new Error()
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, active: !row.active } : row))
    } catch { setError('تغییر وضعیت انجام نشد.') } finally { setBusyId(null) }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold">خدمات قابل معرفی</h2><p className="mt-1 text-[11px] text-black/45">فعال‌بودن یعنی ویجنتو می‌تواند این خدمت را به مشتری پیشنهاد دهد.</p></div><button type="button" onClick={() => setOpen((value) => !value)} className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white"><Plus className="h-4 w-4"/>خدمت جدید</button></div>

      {open && <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-medium">نام خدمت</span><input className="input" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="مثلاً مشاوره اولیه" /></label><label className="block"><span className="mb-1.5 block text-xs font-medium">مدت معمول</span><MaterialSelect value={form.durationMinutes} onValueChange={(value) => setForm((current) => ({ ...current, durationMinutes: value }))} options={durations} ariaLabel="مدت خدمت" /></label><label className="block"><span className="mb-1.5 block text-xs font-medium">محل ارائه</span><input className="input" value={form.location} onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))} placeholder="حضوری، آنلاین یا آدرس" /></label><label className="block"><span className="mb-1.5 block text-xs font-medium">توضیح برای مشتری و ایجنت</span><input className="input" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="این خدمت برای چه کسی مناسب است؟" /></label></div>{error && <p className="mt-3 text-xs text-rose-600" role="alert">{error}</p>}<div className="mt-4 flex justify-end"><button type="button" disabled={saving || form.name.trim().length < 2} onClick={createService} className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-5 text-xs font-bold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}ذخیره خدمت</button></div></div>}

      {items.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className={cn('spatial-surface rounded-[1.5rem] p-4 transition-opacity', !item.active && 'opacity-55')}><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white"><Sparkles className="h-4 w-4"/></span><button type="button" disabled={busyId === item.id} onClick={() => toggle(item)} aria-label={item.active ? 'غیرفعال کردن' : 'فعال کردن'} className={cn('grid h-10 w-10 place-items-center rounded-xl border', item.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-black/10 text-black/35')}>{busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Power className="h-4 w-4"/>}</button></div><h3 className="mt-4 font-bold">{item.name}</h3><p className="mt-1 line-clamp-2 min-h-10 text-[11px] leading-5 text-black/45">{item.description || 'توضیحی ثبت نشده است.'}</p><div className="mt-4 flex flex-wrap gap-2 text-[9px] text-black/55"><span className="inline-flex items-center gap-1 rounded-full bg-black/[0.045] px-2.5 py-1"><Clock3 className="h-3 w-3"/>{item.durationMinutes.toLocaleString('fa-IR')} دقیقه</span>{item.location && <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.045] px-2.5 py-1"><MapPin className="h-3 w-3"/>{item.location}</span>}<span className="inline-flex items-center gap-1 rounded-full bg-black/[0.045] px-2.5 py-1"><CalendarDays className="h-3 w-3"/>{item._count.appointments.toLocaleString('fa-IR')} رزرو</span></div><Link href="/appointments" className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-black/10 text-[10px] font-bold transition-colors hover:bg-black hover:text-white">تنظیم برنامه و رزرو</Link></article>)}</div> : <div className="rounded-[1.5rem] border border-dashed border-black/15 bg-white p-10 text-center"><BriefcaseEmpty/><p className="mt-3 text-sm font-bold">هنوز خدمتی ثبت نشده است</p><p className="mt-1 text-xs text-black/45">اولین خدمت را اضافه کنید تا در اختیار ایجنت قرار بگیرد.</p></div>}
    </section>
  )
}

function BriefcaseEmpty() { return <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-black text-white"><Sparkles className="h-5 w-5"/></span> }
