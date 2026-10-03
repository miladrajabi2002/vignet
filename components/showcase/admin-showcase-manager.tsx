'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Edit3, Trash2, Loader2, X, Image as ImageIcon, ExternalLink, GripVertical, Star, Power } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NumberField } from '@/components/admin/number-field'
import { Switch } from '@/components/ui/switch'

export interface ShowcaseRow {
	id: string
	name: string
	handle: string | null
	url: string | null
	imageUrl: string | null
	channels: string[]
	quote: string | null
	metricValue: string | null
	metricLabel: string | null
	featured: boolean
	active: boolean
	sortOrder: number
	updatedAt: string
}

const CHANNEL_LABELS_FA: Record<string, string> = {
	INSTAGRAM: 'اینستاگرام',
	TELEGRAM: 'تلگرام',
	BALE: 'بله',
	RUBIKA: 'روبیکا',
	WEB: 'وب‌سایت',
	WOOCOMMERCE: 'ووکامرس',
}
const CHANNEL_KEYS = Object.keys(CHANNEL_LABELS_FA)

type FormState = {
	name: string
	handle: string
	url: string
	imageUrl: string
	channels: string[]
	quote: string
	metricValue: string
	metricLabel: string
	featured: boolean
	active: boolean
	sortOrder: number
}

const EMPTY_FORM: FormState = {
	name: '',
	handle: '',
	url: '',
	imageUrl: '',
	channels: [],
	quote: '',
	metricValue: '',
	metricLabel: '',
	featured: false,
	active: true,
	sortOrder: 0,
}

// The shared field family (app/globals.css `.input` / `.ui-field-label`).
const inputClass = 'input text-sm'
const labelClass = 'ui-field-label'

export function AdminShowcaseManager({ initialEntries }: { initialEntries: ShowcaseRow[] }) {
	const [entries, setEntries] = useState<ShowcaseRow[]>(initialEntries)
	const [form, setForm] = useState<FormState>(EMPTY_FORM)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [showForm, setShowForm] = useState(false)
	const [busy, setBusy] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const fileRef = useRef<HTMLInputElement>(null)

	const reload = useCallback(async () => {
		const res = await fetch('/api/admin/showcase', { cache: 'no-store' })
		if (!res.ok) return
		const data = await res.json()
		setEntries(data.entries ?? [])
	}, [])

	const startCreate = () => {
		setEditingId(null)
		setForm(EMPTY_FORM)
		setError(null)
		setShowForm(true)
	}

	const startEdit = (entry: ShowcaseRow) => {
		setEditingId(entry.id)
		setForm({
			name: entry.name,
			handle: entry.handle ?? '',
			url: entry.url ?? '',
			imageUrl: entry.imageUrl ?? '',
			channels: entry.channels,
			quote: entry.quote ?? '',
			metricValue: entry.metricValue ?? '',
			metricLabel: entry.metricLabel ?? '',
			featured: entry.featured,
			active: entry.active,
			sortOrder: entry.sortOrder,
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
			const res = await fetch('/api/admin/showcase/upload', { method: 'POST', body })
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.url) {
				throw new Error(data?.error ?? `HTTP ${res.status}`)
			}
			setForm((f) => ({ ...f, imageUrl: data.url as string }))
		} catch (e) {
			setError(`آپلود ناموفق بود: ${e instanceof Error ? e.message : 'خطای نامشخص'}`)
		} finally {
			setUploading(false)
		}
	}

	const submit = async () => {
		setBusy(true)
		setError(null)
		try {
			const res = await fetch(
				editingId ? `/api/admin/showcase/${editingId}` : '/api/admin/showcase',
				{
					method: editingId ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(form),
				},
			)
			const data = await res.json().catch(() => null)
			if (!res.ok) {
				const detail = data?.details
					? Object.values(data.details).flat().join(' • ')
					: data?.error ?? `HTTP ${res.status}`
				throw new Error(String(detail))
			}
			setShowForm(false)
			setEditingId(null)
			setForm(EMPTY_FORM)
			await reload()
		} catch (e) {
			setError(e instanceof Error ? e.message : 'ذخیره ناموفق بود')
		} finally {
			setBusy(false)
		}
	}

	const remove = async (entry: ShowcaseRow) => {
		if (!window.confirm(`«${entry.name}» حذف شود؟ این عمل قابل بازگشت نیست.`)) return
		const res = await fetch(`/api/admin/showcase/${entry.id}`, { method: 'DELETE' })
		if (res.ok) await reload()
	}

	const quickToggle = async (entry: ShowcaseRow, patch: Partial<FormState>) => {
		const res = await fetch(`/api/admin/showcase/${entry.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch),
		})
		if (res.ok) await reload()
	}

	useEffect(() => {
		if (!showForm) fileRef.current = null
	}, [showForm])

	return (
		<div className="p-4 sm:p-6">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-sm font-bold text-[var(--text-primary)]">
						مشتریان ویجنت روی صفحه اصلی
					</h2>
					<p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
						هر مورد ثبت‌شده بلافاصله بعد از ذخیره روی صفحه اصلی نمایش داده می‌شود؛
						غیرفعال‌کردن آن را از سایت حذف می‌کند بدون پاک‌شدن اطلاعات.
					</p>
				</div>
				<button
					type="button"
					onClick={startCreate}
					className="admin-primary-button min-h-10 px-4 text-xs"
				>
					<Plus className="h-3.5 w-3.5" />
					افزودن مشتری
				</button>
			</div>

			{error && (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					{error}
				</div>
			)}

			{showForm && (
				<div className="mb-6 rounded-card border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5">
					<div className="mb-4 flex items-center justify-between">
						<h3 className="text-sm font-bold text-[var(--text-primary)]">
							{editingId ? 'ویرایش مشتری' : 'مشتری جدید'}
						</h3>
						<button
							type="button"
							onClick={() => setShowForm(false)}
							className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
							aria-label="بستن"
						>
							<X className="h-4 w-4" />
						</button>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label className={labelClass} htmlFor="sc-name">نام کسب‌وکار *</label>
							<input
								id="sc-name"
								className={inputClass}
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								placeholder="فروشگاه مانتو آیدا"
								maxLength={80}
							/>
						</div>
						<div>
							<label className={labelClass} htmlFor="sc-handle">یوزرنیم اینستاگرام</label>
							<input
								id="sc-handle"
								className={inputClass}
								dir="ltr"
								value={form.handle}
								onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
								placeholder="aida.manto"
							/>
							<p className="mt-1 text-[12px] text-[var(--text-muted)]">بدون @ — لینک کارت به این پیج می‌رود مگر اینکه لینک جدا بدهید.</p>
						</div>
						<div>
							<label className={labelClass} htmlFor="sc-url">لینک اختصاصی (اختیاری)</label>
							<input
								id="sc-url"
								className={inputClass}
								dir="ltr"
								value={form.url}
								onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
								placeholder="https://example.com"
							/>
						</div>
						<div>
							<span className={labelClass}>تصویر (لوگو یا اسکرین‌شات پیج)</span>
							<div className="flex items-center gap-3">
								{form.imageUrl ? (
									// Admin-provided preview URLs can use arbitrary hosts.
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={form.imageUrl}
										alt=""
										width={44}
										height={44}
										className="h-11 w-11 rounded-xl border border-[var(--border-default)] object-cover"
									/>
								) : (
									<span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-[var(--border-hover)] bg-white text-[var(--text-hint)]">
										<ImageIcon className="h-4 w-4" />
									</span>
								)}
								<input
									ref={fileRef}
									type="file"
									accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
									className="hidden"
									onChange={(e) => {
										const file = e.target.files?.[0]
										if (file) void uploadImage(file)
										e.target.value = ''
									}}
								/>
								<button
									type="button"
									onClick={() => fileRef.current?.click()}
									disabled={uploading}
									className="admin-toolbar-button min-h-10 disabled:opacity-50"
								>
									{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
									{uploading ? 'در حال آپلود…' : form.imageUrl ? 'تغییر تصویر' : 'انتخاب تصویر'}
								</button>
								{form.imageUrl && (
									<button
										type="button"
										onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
										className="text-xs text-red-500 hover:underline"
									>
										حذف
									</button>
								)}
							</div>
							<p className="mt-1 text-[12px] text-[var(--text-muted)]">مربع، حداکثر ۴MB — png/jpg/webp</p>
						</div>
						<div className="sm:col-span-2">
							<span className={labelClass}>کانال‌هایی که این مشتری استفاده می‌کند</span>
							<div className="flex flex-wrap gap-1.5">
								{CHANNEL_KEYS.map((key) => {
									const selected = form.channels.includes(key)
									return (
										<button
											key={key}
											type="button"
											onClick={() =>
												setForm((f) => ({
													...f,
													channels: selected
														? f.channels.filter((c) => c !== key)
														: [...f.channels, key],
												}))
											}
											className={cn(
												'rounded-full border px-2.5 py-1 text-[12px] transition',
												selected
													? 'border-[#111] bg-[#111] text-white'
													: 'border-[var(--border-hover)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
											)}
										>
											{CHANNEL_LABELS_FA[key]}
										</button>
									)
								})}
							</div>
						</div>
						<div className="sm:col-span-2">
							<label className={labelClass} htmlFor="sc-quote">یک جمله نتیجه/نقل‌قول (اختیاری)</label>
							<input
								id="sc-quote"
								className={inputClass}
								value={form.quote}
								onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
								placeholder="پاسخ‌گویی نیمه‌شب بدون اپراتور"
								maxLength={200}
							/>
						</div>
						<div>
							<label className={labelClass} htmlFor="sc-metric-value">عدد برجسته (اختیاری)</label>
							<input
								id="sc-metric-value"
								className={inputClass}
								value={form.metricValue}
								onChange={(e) => setForm((f) => ({ ...f, metricValue: e.target.value }))}
								placeholder="۹۸٪"
								maxLength={20}
							/>
						</div>
						<div>
							<label className={labelClass} htmlFor="sc-metric-label">برچسب عدد</label>
							<input
								id="sc-metric-label"
								className={inputClass}
								value={form.metricLabel}
								onChange={(e) => setForm((f) => ({ ...f, metricLabel: e.target.value }))}
								placeholder="پاسخ خودکار"
								maxLength={40}
							/>
						</div>
						<div>
							<label className={labelClass} htmlFor="sc-sort">ترتیب نمایش</label>
							<NumberField
								id="sc-sort"
								value={form.sortOrder}
								onChange={(raw) => setForm((f) => ({ ...f, sortOrder: Number(raw) || 0 }))}
							/>
							<p className="mt-1 text-[12px] text-[var(--text-muted)]">عدد کوچک‌تر اول نمایش داده می‌شود.</p>
						</div>
						<div className="flex items-end gap-4">
							<span className="inline-flex min-h-11 items-center gap-2.5 text-xs font-medium text-[var(--text-secondary)]">
								<Switch checked={form.featured} onChange={(next) => setForm((f) => ({ ...f, featured: next }))} aria-label="ویژه" />
								<Star className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
								ویژه
							</span>
							<span className="inline-flex min-h-11 items-center gap-2.5 text-xs font-medium text-[var(--text-secondary)]">
								<Switch checked={form.active} onChange={(next) => setForm((f) => ({ ...f, active: next }))} aria-label="فعال روی سایت" />
								فعال روی سایت
							</span>
						</div>
					</div>

					<div className="mt-5 flex items-center gap-2">
						<button
							type="button"
							onClick={submit}
							disabled={busy || uploading || form.name.trim().length < 2}
							className="admin-primary-button min-h-10 px-4 text-xs"
						>
							{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
							{editingId ? 'ذخیره تغییرات' : 'افزودن به صفحه اصلی'}
						</button>
						<button
							type="button"
							onClick={() => setShowForm(false)}
							className="admin-toolbar-button min-h-10 px-4"
						>
							انصراف
						</button>
					</div>
				</div>
			)}

			{entries.length === 0 ? (
				<p className="py-10 text-center text-xs text-[var(--text-muted)]">
					هنوز مشتری‌ای ثبت نشده است. اولین مشتری را با «افزودن مشتری» بسازید —
					همین‌که فعال باشد روی صفحه اصلی نمایش داده می‌شود.
				</p>
			) : (
				<ul className="space-y-2">
					{entries.map((entry) => {
						const link = entry.url || (entry.handle ? `https://instagram.com/${entry.handle}` : null)
						return (
							<li
								key={entry.id}
								className={cn(
									'flex flex-wrap items-center gap-3 rounded-xl border p-3 transition',
									entry.active ? 'border-[var(--border-default)] bg-white' : 'border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] opacity-70',
								)}
							>
									<GripVertical className="h-4 w-4 shrink-0 text-[var(--text-hint)]" aria-hidden />
									{entry.imageUrl ? (
										// Admin-provided preview URLs can use arbitrary hosts.
										// eslint-disable-next-line @next/next/no-img-element
										<img src={entry.imageUrl} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border-default)] object-cover" />
								) : (
									<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-xs font-bold text-[var(--text-muted)]">
										{entry.name.trim().charAt(0)}
									</span>
								)}
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
										<span className="text-sm font-semibold text-[var(--text-primary)]">{entry.name}</span>
										{entry.featured && <Star className="h-3 w-3 text-amber-500" aria-label="ویژه" />}
										{entry.handle && (
											<span dir="ltr" className="text-[12px] text-[var(--text-muted)]">@{entry.handle}</span>
										)}
										{link && (
											<a href={link} target="_blank" rel="noreferrer" className="text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]">
												<ExternalLink className="h-3 w-3" />
											</a>
										)}
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-1.5">
										{entry.channels.map((ch) => (
											<span key={ch} className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[12px] text-[var(--text-muted)]">
												{CHANNEL_LABELS_FA[ch] ?? ch}
											</span>
										))}
										{entry.metricValue && (
											<span className="text-[12px] font-bold text-[var(--text-secondary)]">
												{entry.metricValue}{' '}
												<span className="font-normal text-[var(--text-muted)]">{entry.metricLabel}</span>
											</span>
										)}
										<span className="text-[12px] text-[var(--text-hint)]">ترتیب: {entry.sortOrder}</span>
									</div>
									{entry.quote && <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">{entry.quote}</p>}
								</div>
								<div className="flex shrink-0 items-center gap-1">
									<button
										type="button"
										onClick={() => quickToggle(entry, { active: !entry.active })}
										title={entry.active ? 'غیرفعال‌کردن از سایت' : 'نمایش دوباره روی سایت'}
										className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
									>
										<Power className={cn('h-3.5 w-3.5', entry.active && 'text-emerald-600')} />
									</button>
									<button
										type="button"
										onClick={() => startEdit(entry)}
										title="ویرایش"
										className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
									>
										<Edit3 className="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										onClick={() => remove(entry)}
										title="حذف"
										className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition hover:bg-red-50 hover:text-red-600"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</button>
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
