'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Edit3, Trash2, Loader2, X, Image as ImageIcon, ExternalLink, GripVertical, Star, Power } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const inputClass =
	'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 placeholder:text-zinc-400'
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-600'

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
					<h2 className="text-sm font-bold text-zinc-800">
						مشتریان ویجنت روی صفحه اصلی
					</h2>
					<p className="mt-1 text-xs leading-5 text-zinc-500">
						هر مورد ثبت‌شده بلافاصله بعد از ذخیره روی صفحه اصلی نمایش داده می‌شود؛
						غیرفعال‌کردن آن را از سایت حذف می‌کند بدون پاک‌شدن اطلاعات.
					</p>
				</div>
				<button
					type="button"
					onClick={startCreate}
					className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
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
				<div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
					<div className="mb-4 flex items-center justify-between">
						<h3 className="text-sm font-bold text-zinc-800">
							{editingId ? 'ویرایش مشتری' : 'مشتری جدید'}
						</h3>
						<button
							type="button"
							onClick={() => setShowForm(false)}
							className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
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
							<p className="mt-1 text-[10px] text-zinc-400">بدون @ — لینک کارت به این پیج می‌رود مگر اینکه لینک جدا بدهید.</p>
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
										className="h-11 w-11 rounded-xl border border-zinc-200 object-cover"
									/>
								) : (
									<span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-zinc-300 bg-white text-zinc-300">
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
									className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 transition hover:border-zinc-400 disabled:opacity-50"
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
							<p className="mt-1 text-[10px] text-zinc-400">مربع، حداکثر ۴MB — png/jpg/webp</p>
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
												'rounded-full border px-2.5 py-1 text-[11px] transition',
												selected
													? 'border-zinc-900 bg-zinc-900 text-white'
													: 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400',
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
							<input
								id="sc-sort"
								type="number"
								min={0}
								className={inputClass}
								value={form.sortOrder}
								onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
							/>
							<p className="mt-1 text-[10px] text-zinc-400">عدد کوچک‌تر اول نمایش داده می‌شود.</p>
						</div>
						<div className="flex items-end gap-4">
							<label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
								<input
									type="checkbox"
									checked={form.featured}
									onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
									className="h-4 w-4 accent-zinc-900"
								/>
								<Star className="h-3.5 w-3.5 text-amber-500" />
								ویژه
							</label>
							<label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
								<input
									type="checkbox"
									checked={form.active}
									onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
									className="h-4 w-4 accent-zinc-900"
								/>
								فعال روی سایت
							</label>
						</div>
					</div>

					<div className="mt-5 flex items-center gap-2">
						<button
							type="button"
							onClick={submit}
							disabled={busy || uploading || form.name.trim().length < 2}
							className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
						>
							{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
							{editingId ? 'ذخیره تغییرات' : 'افزودن به صفحه اصلی'}
						</button>
						<button
							type="button"
							onClick={() => setShowForm(false)}
							className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-600 transition hover:border-zinc-400"
						>
							انصراف
						</button>
					</div>
				</div>
			)}

			{entries.length === 0 ? (
				<p className="py-10 text-center text-xs text-zinc-400">
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
									entry.active ? 'border-zinc-200 bg-white' : 'border-dashed border-zinc-200 bg-zinc-50 opacity-70',
								)}
							>
									<GripVertical className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
									{entry.imageUrl ? (
										// Admin-provided preview URLs can use arbitrary hosts.
										// eslint-disable-next-line @next/next/no-img-element
										<img src={entry.imageUrl} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 object-cover" />
								) : (
									<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-500">
										{entry.name.trim().charAt(0)}
									</span>
								)}
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
										<span className="text-sm font-semibold text-zinc-800">{entry.name}</span>
										{entry.featured && <Star className="h-3 w-3 text-amber-500" aria-label="ویژه" />}
										{entry.handle && (
											<span dir="ltr" className="text-[11px] text-zinc-400">@{entry.handle}</span>
										)}
										{link && (
											<a href={link} target="_blank" rel="noreferrer" className="text-zinc-400 transition hover:text-zinc-700">
												<ExternalLink className="h-3 w-3" />
											</a>
										)}
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-1.5">
										{entry.channels.map((ch) => (
											<span key={ch} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
												{CHANNEL_LABELS_FA[ch] ?? ch}
											</span>
										))}
										{entry.metricValue && (
											<span className="text-[10px] font-bold text-zinc-700">
												{entry.metricValue}{' '}
												<span className="font-normal text-zinc-400">{entry.metricLabel}</span>
											</span>
										)}
										<span className="text-[10px] text-zinc-300">ترتیب: {entry.sortOrder}</span>
									</div>
									{entry.quote && <p className="mt-1 truncate text-[11px] text-zinc-400">{entry.quote}</p>}
								</div>
								<div className="flex shrink-0 items-center gap-1">
									<button
										type="button"
										onClick={() => quickToggle(entry, { active: !entry.active })}
										title={entry.active ? 'غیرفعال‌کردن از سایت' : 'نمایش دوباره روی سایت'}
										className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
									>
										<Power className={cn('h-3.5 w-3.5', entry.active && 'text-emerald-600')} />
									</button>
									<button
										type="button"
										onClick={() => startEdit(entry)}
										title="ویرایش"
										className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
									>
										<Edit3 className="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										onClick={() => remove(entry)}
										title="حذف"
										className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
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
