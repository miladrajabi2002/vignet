'use client'

import { useCallback, useRef, useState } from 'react'
import { Plus, Edit3, Trash2, Loader2, X, Image as ImageIcon, ExternalLink, Power } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NumberField } from '@/components/admin/number-field'
import { Switch } from '@/components/ui/switch'

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

// The shared field family (app/globals.css `.input` / `.ui-field-label`).
const inputClass = 'input text-sm'
const labelClass = 'ui-field-label'

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
                                        <h3 className="text-sm font-bold text-[var(--text-primary)]">لوگوهای اعتماد</h3>
                                        <p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">
                                                لوگوی برندها در بخش «اعتماد بهترین‌های صنعت» بالای صفحه اصلی نمایش داده می‌شود.
                                        </p>
                                </div>
                                <button
                                        type="button"
                                        onClick={startCreate}
                                        className="admin-primary-button min-h-10 px-4 text-xs"
                                >
                                        <Plus className="h-3.5 w-3.5" />
                                        افزودن لوگو
                                </button>
                        </div>

                        {error ? (
                                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
                        ) : null}

                        {showForm ? (
                                <form onSubmit={submit} className="space-y-3 rounded-card border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                                        <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-[var(--text-primary)]">{editingId ? 'ویرایش لوگو' : 'لوگوی جدید'}</h4>
                                                <button
                                                        type="button"
                                                        onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}
                                                        className="rounded-md p-1 text-[var(--text-muted)] transition hover:bg-black/10 hover:text-[var(--text-secondary)]"
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
                                                        <NumberField
                                                                id="trusted-logo-order"
                                                                value={form.sortOrder}
                                                                onChange={(raw) => setForm((f) => ({ ...f, sortOrder: Math.min(9999, Number(raw) || 0) }))}
                                                        />
                                                </div>
                                                <div>
                                                        <label className={labelClass}>فایل لوگو (PNG، WebP، JPG — حداکثر ۴MB)</label>
                                                        <div className="flex items-center gap-2">
                                                                <button
                                                                        type="button"
                                                                        onClick={() => fileRef.current?.click()}
                                                                        disabled={uploading}
                                                                        className="admin-toolbar-button min-h-10 disabled:opacity-50"
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
                                                                        <img src={form.imageUrl} alt="پیش‌نمایش لوگو" className="h-8 w-auto max-w-24 rounded border border-[var(--border-default)] bg-white object-contain px-1" />
                                                                ) : (
                                                                        <span className="text-[12px] text-[var(--text-muted)]">بدون تصویر — نام برند به‌صورت متن نمایش داده می‌شود</span>
                                                                )}
                                                        </div>
                                                </div>
                                        </div>

                                        <span className="flex min-h-11 items-center gap-2.5 text-xs font-medium text-[var(--text-secondary)]">
                                                <Switch checked={form.active} onChange={(next) => setForm((f) => ({ ...f, active: next }))} aria-label="فعال روی صفحه اصلی" />
                                                فعال روی صفحه اصلی
                                        </span>

                                        <div className="flex items-center justify-end gap-2 pt-1">
                                                <button
                                                        type="button"
                                                        onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}
                                                        className="admin-toolbar-button min-h-10 px-4"
                                                >
                                                        انصراف
                                                </button>
                                                <button
                                                        type="submit"
                                                        disabled={busy || uploading}
                                                        className="admin-primary-button min-h-10 px-4 text-xs"
                                                >
                                                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                        {editingId ? 'ذخیره تغییرات' : 'افزودن'}
                                                </button>
                                        </div>
                                </form>
                        ) : null}

                        {logos.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-[var(--border-hover)] bg-[var(--bg-surface)] px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                                        هنوز لوگویی ثبت نشده است. با دکمه «افزودن لوگو» اولین برند را اضافه کنید؛ بخش «اعتماد بهترین‌های صنعت» بعد از اولین لوگوی فعال روی صفحه اصلی نمایش داده می‌شود.
                                </p>
                        ) : (
                                <ul className="space-y-2">
                                        {logos.map((logo) => (
                                                <li
                                                        key={logo.id}
                                                        className={cn(
                                                                'flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                                                                logo.active ? 'border-[var(--border-default)] bg-white' : 'border-[var(--border-default)] bg-[var(--bg-surface)] opacity-60',
                                                        )}
                                                >
                                                        {logo.imageUrl ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={logo.imageUrl} alt={logo.name} className="h-8 w-auto max-w-24 rounded border border-[var(--border-subtle)] bg-white object-contain px-1" />
                                                        ) : (
                                                                <span className="grid h-8 w-10 place-items-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)]">متن</span>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{logo.name}</p>
                                                                <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
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
                                                                                logo.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[var(--text-muted)] hover:bg-black/10',
                                                                        )}
                                                                >
                                                                        <Power className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                        type="button"
                                                                        onClick={() => startEdit(logo)}
                                                                        disabled={busy}
                                                                        title="ویرایش"
                                                                        className="rounded-md p-2 text-[var(--text-muted)] transition hover:bg-black/10 hover:text-[var(--text-primary)] disabled:opacity-50"
                                                                >
                                                                        <Edit3 className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                        type="button"
                                                                        onClick={() => remove(logo.id)}
                                                                        disabled={busy}
                                                                        title="حذف"
                                                                        className="rounded-md p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
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
