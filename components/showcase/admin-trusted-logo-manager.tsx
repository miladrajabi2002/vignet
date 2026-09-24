'use client'

import { useCallback, useRef, useState } from 'react'
import { Plus, Edit3, Trash2, Loader2, X, Image as ImageIcon, ExternalLink, Power } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TrustedLogoRow {
        id: string
        name: string
        imageUrl: string | null
        url: string | null
        active: boolean
        sortOrder: number
        updatedAt: string
}

type FormState = {
        name: string
        imageUrl: string
        url: string
        active: boolean
        sortOrder: number
}

const EMPTY_FORM: FormState = {
        name: '',
        imageUrl: '',
        url: '',
        active: true,
        sortOrder: 0,
}

const inputClass =
        'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 placeholder:text-zinc-400'
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-600'

const ERROR_MESSAGES: Record<string, string> = {
        UNAUTHORIZED: 'دسترسی ندارید؛ دوباره وارد شوید.',
        TOO_LARGE: 'حجم فایل بیش از حد مجاز است (۴ مگابایت).',
        INVALID_TYPE: 'فرمت فایل پشتیبانی نمی‌شود.',
        INVALID_FILE_CONTENT: 'محتوای فایل تصویر معتبر نیست.',
        NO_FILE: 'فایلی انتخاب نشده است.',
        EMPTY_FILE: 'فایل خالی است.',
        INVALID: 'اطلاعات فرم معتبر نیست.',
        NOT_FOUND: 'این لوگو حذف شده است؛ صفحه را تازه کنید.',
}

function describeError(error: string | null): string {
        if (!error) return 'خطای ناشناخته رخ داد.'
        return ERROR_MESSAGES[error] ?? `خطا: ${error}`
}

/** Admin manager for the homepage "اعتماد بهترین‌های صنعت" logo bar. */
export function AdminTrustedLogoManager({ initialLogos }: { initialLogos: TrustedLogoRow[] }) {
        const [logos, setLogos] = useState<TrustedLogoRow[]>(initialLogos)
        const [form, setForm] = useState<FormState>(EMPTY_FORM)
        const [editingId, setEditingId] = useState<string | null>(null)
        const [showForm, setShowForm] = useState(false)
        const [busy, setBusy] = useState(false)
        const [uploading, setUploading] = useState(false)
        const [error, setError] = useState<string | null>(null)
        const fileRef = useRef<HTMLInputElement>(null)

        const reload = useCallback(async () => {
                const res = await fetch('/api/admin/trusted-logo', { cache: 'no-store' })
                if (!res.ok) return
                const data = await res.json()
                setLogos(data.logos ?? [])
        }, [])

        const startCreate = () => {
                setEditingId(null)
                setForm(EMPTY_FORM)
                setError(null)
                setShowForm(true)
        }

        const startEdit = (logo: TrustedLogoRow) => {
                setEditingId(logo.id)
                setForm({
                        name: logo.name,
                        imageUrl: logo.imageUrl ?? '',
                        url: logo.url ?? '',
                        active: logo.active,
                        sortOrder: logo.sortOrder,
                })
                setError(null)
                setShowForm(true)
        }

        const uploadImage = async (file: File) => {
                setUploading(true)
                setError(null)
                try {
                        const body = new FormData()
                        body.append('file', file)
                        const res = await fetch('/api/admin/trusted-logo/upload', { method: 'POST', body })
                        const data = await res.json().catch(() => null)
                        if (!res.ok || !data?.url) {
                                throw new Error(data?.error ?? `HTTP ${res.status}`)
                        }
                        setForm((f) => ({ ...f, imageUrl: data.url as string }))
                } catch (e) {
                        setError(e instanceof Error ? e.message : 'آپلود ناموفق بود.')
                } finally {
                        setUploading(false)
                }
        }

        const submit = async (event: React.FormEvent) => {
                event.preventDefault()
                if (busy) return
                setBusy(true)
                setError(null)
                try {
                        const res = await fetch(editingId ? `/api/admin/trusted-logo/${editingId}` : '/api/admin/trusted-logo', {
                                method: editingId ? 'PATCH' : 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        name: form.name,
                                        imageUrl: form.imageUrl || null,
                                        url: form.url || null,
                                        active: form.active,
                                        sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
                                }),
                        })
                        const data = await res.json().catch(() => null)
                        if (!res.ok) {
                                throw new Error(data?.error ?? `HTTP ${res.status}`)
                        }
                        setShowForm(false)
                        setEditingId(null)
                        setForm(EMPTY_FORM)
                        await reload()
                } catch (e) {
                        setError(e instanceof Error ? describeError(e.message) : 'ذخیره ناموفق بود.')
                } finally {
                        setBusy(false)
                }
        }

        const remove = async (id: string) => {
                if (busy) return
                if (!window.confirm('این لوگو حذف شود؟ این عمل قابل بازگشت نیست.')) return
                setBusy(true)
                setError(null)
                try {
                        const res = await fetch(`/api/admin/trusted-logo/${id}`, { method: 'DELETE' })
                        if (!res.ok) {
                                const data = await res.json().catch(() => null)
                                throw new Error(data?.error ?? `HTTP ${res.status}`)
                        }
                        if (editingId === id) {
                                setShowForm(false)
                                setEditingId(null)
                                setForm(EMPTY_FORM)
                        }
                        await reload()
                } catch (e) {
                        setError(e instanceof Error ? describeError(e.message) : 'حذف ناموفق بود.')
                } finally {
                        setBusy(false)
                }
        }

        const toggleActive = async (logo: TrustedLogoRow) => {
                if (busy) return
                setBusy(true)
                setError(null)
                try {
                        const res = await fetch(`/api/admin/trusted-logo/${logo.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ active: !logo.active }),
                        })
                        if (!res.ok) {
                                const data = await res.json().catch(() => null)
                                throw new Error(data?.error ?? `HTTP ${res.status}`)
                        }
                        await reload()
                } catch (e) {
                        setError(e instanceof Error ? describeError(e.message) : 'تغییر وضعیت ناموفق بود.')
                } finally {
                        setBusy(false)
                }
        }

        return (
                <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                        <h3 className="text-sm font-bold text-zinc-900">لوگوهای اعتماد</h3>
                                        <p className="mt-1 text-xs leading-6 text-zinc-500">
                                                لوگوی برندها در بخش «اعتماد بهترین‌های صنعت» بالای صفحه اصلی نمایش داده می‌شود.
                                        </p>
                                </div>
                                <button
                                        type="button"
                                        onClick={startCreate}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700"
                                >
                                        <Plus className="h-3.5 w-3.5" />
                                        افزودن لوگو
                                </button>
                        </div>

                        {error ? (
                                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
                        ) : null}

                        {showForm ? (
                                <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                        <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-zinc-800">{editingId ? 'ویرایش لوگو' : 'لوگوی جدید'}</h4>
                                                <button
                                                        type="button"
                                                        onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}
                                                        className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700"
                                                        aria-label="بستن"
                                                >
                                                        <X className="h-4 w-4" />
                                                </button>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                        <label className={labelClass} htmlFor="trusted-logo-name">نام برند *</label>
                                                        <input
                                                                id="trusted-logo-name"
                                                                className={inputClass}
                                                                value={form.name}
                                                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                                                placeholder="مثلاً: فروشگاه مانتو آیدا"
                                                                required
                                                                minLength={2}
                                                                maxLength={60}
                                                        />
                                                </div>
                                                <div>
                                                        <label className={labelClass} htmlFor="trusted-logo-url">لینک سایت (اختیاری)</label>
                                                        <input
                                                                id="trusted-logo-url"
                                                                className={inputClass}
                                                                value={form.url}
                                                                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                                                                placeholder="https://example.com"
                                                                type="url"
                                                                dir="ltr"
                                                        />
                                                </div>
                                                <div>
                                                        <label className={labelClass} htmlFor="trusted-logo-order">ترتیب نمایش</label>
                                                        <input
                                                                id="trusted-logo-order"
                                                                className={inputClass}
                                                                value={form.sortOrder}
                                                                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
                                                                type="number"
                                                                min={0}
                                                                max={9999}
                                                                dir="ltr"
                                                        />
                                                </div>
                                                <div>
                                                        <label className={labelClass}>فایل لوگو (PNG، WebP، JPG — حداکثر ۴MB)</label>
                                                        <div className="flex items-center gap-2">
                                                                <button
                                                                        type="button"
                                                                        onClick={() => fileRef.current?.click()}
                                                                        disabled={uploading}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                                                                >
                                                                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                                                                        {uploading ? 'در حال آپلود…' : 'انتخاب فایل'}
                                                                </button>
                                                                <input
                                                                        ref={fileRef}
                                                                        type="file"
                                                                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                                const file = e.target.files?.[0]
                                                                                if (file) void uploadImage(file)
                                                                                e.target.value = ''
                                                                        }}
                                                                />
                                                                {form.imageUrl ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src={form.imageUrl} alt="پیش‌نمایش لوگو" className="h-8 w-auto max-w-24 rounded border border-zinc-200 bg-white object-contain px-1" />
                                                                ) : (
                                                                        <span className="text-[11px] text-zinc-400">بدون تصویر — نام برند به‌صورت متن نمایش داده می‌شود</span>
                                                                )}
                                                        </div>
                                                </div>
                                        </div>

                                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-700">
                                                <input
                                                        type="checkbox"
                                                        checked={form.active}
                                                        onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                                                        className="size-4 accent-zinc-900"
                                                />
                                                فعال روی صفحه اصلی
                                        </label>

                                        <div className="flex items-center justify-end gap-2 pt-1">
                                                <button
                                                        type="button"
                                                        onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}
                                                        className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-200"
                                                >
                                                        انصراف
                                                </button>
                                                <button
                                                        type="submit"
                                                        disabled={busy || uploading}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
                                                >
                                                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                        {editingId ? 'ذخیره تغییرات' : 'افزودن'}
                                                </button>
                                        </div>
                                </form>
                        ) : null}

                        {logos.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-xs text-zinc-500">
                                        هنوز لوگویی ثبت نشده است. با دکمه «افزودن لوگو» اولین برند را اضافه کنید؛ بخش «اعتماد بهترین‌های صنعت» بعد از اولین لوگوی فعال روی صفحه اصلی نمایش داده می‌شود.
                                </p>
                        ) : (
                                <ul className="space-y-2">
                                        {logos.map((logo) => (
                                                <li
                                                        key={logo.id}
                                                        className={cn(
                                                                'flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                                                                logo.active ? 'border-zinc-200 bg-white' : 'border-zinc-200/70 bg-zinc-50 opacity-60',
                                                        )}
                                                >
                                                        {logo.imageUrl ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={logo.imageUrl} alt={logo.name} className="h-8 w-auto max-w-24 rounded border border-zinc-100 bg-white object-contain px-1" />
                                                        ) : (
                                                                <span className="grid h-8 w-10 place-items-center rounded border border-zinc-100 bg-zinc-50 text-[10px] text-zinc-400">متن</span>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-semibold text-zinc-800">{logo.name}</p>
                                                                <p className="mt-0.5 text-[11px] text-zinc-400">
                                                                        ترتیب {logo.sortOrder}
                                                                        {logo.url ? (
                                                                                <span className="ms-2 inline-flex items-center gap-0.5">
                                                                                        <ExternalLink className="h-3 w-3" />
                                                                                        <span dir="ltr" className="truncate">{logo.url}</span>
                                                                                </span>
                                                                        ) : null}
                                                                </p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                                <button
                                                                        type="button"
                                                                        onClick={() => toggleActive(logo)}
                                                                        disabled={busy}
                                                                        title={logo.active ? 'غیرفعال کردن' : 'فعال کردن'}
                                                                        className={cn(
                                                                                'rounded-md p-2 transition disabled:opacity-50',
                                                                                logo.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-zinc-400 hover:bg-zinc-200',
                                                                        )}
                                                                >
                                                                        <Power className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                        type="button"
                                                                        onClick={() => startEdit(logo)}
                                                                        disabled={busy}
                                                                        title="ویرایش"
                                                                        className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 disabled:opacity-50"
                                                                >
                                                                        <Edit3 className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                        type="button"
                                                                        onClick={() => remove(logo.id)}
                                                                        disabled={busy}
                                                                        title="حذف"
                                                                        className="rounded-md p-2 text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
                                                                >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                        </div>
                                                </li>
                                        ))}
                                </ul>
                        )}
                </div>
        )
}
