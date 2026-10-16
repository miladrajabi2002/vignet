'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Minus, Package, PenLine, Plus, Search, X } from 'lucide-react'
import type { ChannelType } from '@prisma/client'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { ChannelGlyph, channelLabel } from '@/components/crm/channel-badge'
import { ProductImage } from '@/components/products/product-image'
import { toEnglishDigits } from '@/lib/phone'
import type { PayItem } from '@/lib/payments/card/items'
import { cn } from '@/lib/utils'

/** A line in the editor: a payment item plus a key for React and the photo it was picked with. */
export type EditorItem = PayItem & { key: string; image?: string | null }

export function itemsTotal(items: EditorItem[]): number {
	return items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)
}

export function toPayItems(items: EditorItem[]): PayItem[] {
	return items.filter((item) => item.name.trim()).map(({ name, quantity, unitPrice, productId }) => ({ name: name.trim(), quantity, unitPrice, productId: productId ?? null }))
}

const groupInput = (value: string) => toEnglishDigits(value).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** Amount in tomans with the unit inside the field and the rial value under it. */
export function AmountField({ id, value, onChange, fa, disabled, hint }: { id: string; value: string; onChange: (value: string) => void; fa: boolean; disabled?: boolean; hint?: string | null }) {
	const amount = Number(toEnglishDigits(value).replace(/\D/g, ''))
	return (
		<label className="block" htmlFor={id}>
			<span className="ui-field-label">{fa ? 'مبلغ' : 'Amount'}</span>
			<span className="relative mt-1.5 block">
				<input id={id} dir="ltr" inputMode="numeric" autoComplete="off" className={cn('input font-mono text-[18px] tabular-nums', fa ? 'pl-16 pr-3' : 'pl-3 pr-16')} value={value} onChange={(event) => onChange(groupInput(event.target.value))} placeholder="1,250,000" required disabled={disabled} />
				<span aria-hidden className={cn('pointer-events-none absolute inset-y-1 grid place-items-center rounded-[10px] bg-[var(--bg-surface)] px-2.5 text-[12px] text-[var(--text-muted)]', fa ? 'left-1' : 'right-1')}>{fa ? 'تومان' : 'Toman'}</span>
			</span>
			<span className="mt-1 flex flex-wrap justify-between gap-x-3 text-[12px] text-[var(--text-muted)]">
				<span>{hint ?? ''}</span>
				{amount >= 1000 ? <span>{fa ? `به ریال: ${(amount * 10).toLocaleString('fa-IR')}` : `In rials: ${(amount * 10).toLocaleString('en-US')}`}</span> : null}
			</span>
		</label>
	)
}

export const formatAmountInput = (value: number) => (value ? value.toLocaleString('en-US') : '')

type ProductHit = { id: string; name: string; price: number | null; images?: string[] | null; active?: boolean; stock?: number | null }

function ProductSearch({ fa, onPick, onClose }: { fa: boolean; onPick: (product: ProductHit) => void; onClose: () => void }) {
	const [query, setQuery] = useState('')
	const [hits, setHits] = useState<ProductHit[] | null>(null)
	const [failed, setFailed] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => { input.current?.focus() }, [])
	useEffect(() => {
		const controller = new AbortController()
		const timer = window.setTimeout(async () => {
			try {
				const params = new URLSearchParams({ limit: '12', sort: query.trim() ? 'newest' : 'queried' })
				if (query.trim()) params.set('q', query.trim())
				const response = await fetch(`/api/products?${params}`, { signal: controller.signal })
				if (!response.ok) throw new Error('failed')
				const data = await response.json()
				setHits(Array.isArray(data.products) ? data.products : [])
				setFailed(false)
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return
				setFailed(true)
			}
		}, query ? 250 : 0)
		return () => { controller.abort(); window.clearTimeout(timer) }
	}, [query])
	const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
	return (
		<div className="grid gap-1.5 rounded-2xl border border-[var(--border-default)] bg-white p-2 shadow-[var(--elev-2)] dark:bg-neutral-900">
			<div className="flex items-center gap-1.5">
				<div className="relative min-w-0 flex-1">
					<Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
					<input ref={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} placeholder={fa ? 'نام یا کد محصول…' : 'Product name or SKU…'} aria-label={fa ? 'جستجوی محصول' : 'Search products'} className="input min-h-10 w-full ps-9 text-base sm:text-sm" />
				</div>
				<button type="button" onClick={onClose} aria-label={fa ? 'بستن' : 'Close'} className="grid size-10 shrink-0 place-items-center rounded-control text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"><X className="size-4" aria-hidden /></button>
			</div>
			<div className="max-h-56 overflow-y-auto">
				{failed ? <p className="px-2 py-3 text-center text-[12px] text-red-600">{fa ? 'فهرست محصولات باز نشد.' : 'The product list could not be loaded.'}</p>
					: hits === null ? <p className="flex items-center justify-center gap-2 px-2 py-3 text-[12px] text-[var(--text-muted)]"><Loader2 className="size-3.5 animate-spin" aria-hidden />{fa ? 'در حال جستجو…' : 'Searching…'}</p>
					: hits.length === 0 ? <p className="px-2 py-3 text-center text-[12px] text-[var(--text-muted)]">{fa ? 'محصولی پیدا نشد.' : 'No product found.'}</p>
					: (
						<ul>
							{hits.map((product) => {
								const image = product.images?.find((src) => /^https?:\/\//.test(src))
								return (
									<li key={product.id}>
										<button type="button" disabled={product.active === false} onClick={() => onPick(product)} className="flex min-h-12 w-full items-center gap-2.5 rounded-control px-2 py-1 text-start hover:bg-[var(--bg-hover)] disabled:opacity-45">
											{image ? <ProductImage src={image} alt="" loading="lazy" className="size-9 shrink-0 rounded-lg bg-[var(--bg-muted)] object-cover" /> : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-muted)]"><Package className="size-4" aria-hidden /></span>}
											<span className="min-w-0 flex-1">
												<span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{product.name}</span>
												<span className="block text-[12px] tabular-nums text-[var(--text-muted)]">{product.price != null ? `${nf.format(product.price)} ${fa ? 'تومان' : 'Toman'}` : (fa ? 'بدون قیمت' : 'No price')}</span>
											</span>
											<Plus className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
										</button>
									</li>
								)
							})}
						</ul>
					)}
			</div>
		</div>
	)
}

/**
 * What the payment is for: catalog products or typed lines (shipping, a
 * custom order), each with a quantity. Its total can fill the amount.
 */
export function ItemsEditor({ items, onChange, fa, disabled }: { items: EditorItem[]; onChange: (items: EditorItem[]) => void; fa: boolean; disabled?: boolean }) {
	const [searching, setSearching] = useState(false)
	const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
	const update = (key: string, patch: Partial<EditorItem>) => onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
	const remove = (key: string) => onChange(items.filter((item) => item.key !== key))
	const add = (item: Omit<EditorItem, 'key'>) => onChange([...items, { ...item, key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }])

	return (
		<div className="grid gap-2">
			{items.length ? (
				<ul className="grid gap-0 rounded-2xl border border-[var(--border-default)] px-3">
					{items.map((item) => (
						<li key={item.key} className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] py-2.5 last:border-b-0">
							{item.productId
								? (item.image ? <ProductImage src={item.image} alt="" loading="lazy" className="size-9 shrink-0 rounded-lg bg-[var(--bg-muted)] object-cover" /> : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-muted)]"><Package className="size-4" aria-hidden /></span>)
								: <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)]"><PenLine className="size-4" aria-hidden /></span>}
							<div className="min-w-0 flex-1">
								{item.productId ? (
									<>
										<p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{item.name}</p>
										<p className="text-[11.5px] tabular-nums text-[var(--text-muted)]">{item.unitPrice != null ? `${nf.format(item.unitPrice)} ${fa ? 'تومان' : 'Toman'}` : (fa ? 'بدون قیمت' : 'No price')}</p>
									</>
								) : (
									<div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-1.5">
										<input aria-label={fa ? 'شرح قلم' : 'Line name'} value={item.name} onChange={(event) => update(item.key, { name: event.target.value })} placeholder={fa ? 'مثلاً هزینهٔ ارسال' : 'e.g. Shipping'} maxLength={120} disabled={disabled} className="input min-h-9 px-2.5 text-[13px]" />
										<input aria-label={fa ? 'قیمت (تومان)' : 'Price (Toman)'} dir="ltr" inputMode="numeric" value={item.unitPrice ? item.unitPrice.toLocaleString('en-US') : ''} onChange={(event) => { const value = Number(toEnglishDigits(event.target.value).replace(/\D/g, '')); update(item.key, { unitPrice: value || null }) }} placeholder={fa ? 'قیمت' : 'Price'} disabled={disabled} className="input min-h-9 px-2.5 font-mono text-[13px] tabular-nums" />
									</div>
								)}
							</div>
							<div className="inline-flex shrink-0 items-center rounded-full border border-[var(--border-default)]">
								<button type="button" disabled={disabled || item.quantity <= 1} onClick={() => update(item.key, { quantity: item.quantity - 1 })} aria-label={fa ? 'یکی کمتر' : 'One less'} className="grid size-7 place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"><Minus className="size-3.5" aria-hidden /></button>
								<span className="min-w-5 text-center text-[12.5px] font-bold tabular-nums">{nf.format(item.quantity)}</span>
								<button type="button" disabled={disabled || item.quantity >= 999} onClick={() => update(item.key, { quantity: item.quantity + 1 })} aria-label={fa ? 'یکی بیشتر' : 'One more'} className="grid size-7 place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"><Plus className="size-3.5" aria-hidden /></button>
							</div>
							<button type="button" disabled={disabled} onClick={() => remove(item.key)} aria-label={fa ? `حذف ${item.name || 'قلم'}` : `Remove ${item.name || 'line'}`} className="grid size-7 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"><X className="size-3.5" aria-hidden /></button>
						</li>
					))}
				</ul>
			) : null}
			{searching ? (
				<ProductSearch
					fa={fa}
					onClose={() => setSearching(false)}
					onPick={(product) => {
						const existing = items.find((item) => item.productId === product.id)
						if (existing) update(existing.key, { quantity: Math.min(999, existing.quantity + 1) })
						else add({ name: product.name, quantity: 1, unitPrice: product.price, productId: product.id, image: product.images?.find((src) => /^https?:\/\//.test(src)) ?? null })
						setSearching(false)
					}}
				/>
			) : (
				<div className="flex flex-wrap gap-1.5">
					<button type="button" disabled={disabled || items.length >= 20} onClick={() => setSearching(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-[var(--border-strong)] px-3 text-[12.5px] font-medium text-[var(--text-primary)] hover:border-[var(--text-primary)] disabled:opacity-50"><Package className="size-4" aria-hidden />{fa ? 'افزودن از محصولات' : 'Add a product'}</button>
					<button type="button" disabled={disabled || items.length >= 20} onClick={() => add({ name: '', quantity: 1, unitPrice: null, productId: null })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-[var(--border-strong)] px-3 text-[12.5px] font-medium text-[var(--text-primary)] hover:border-[var(--text-primary)] disabled:opacity-50"><PenLine className="size-4" aria-hidden />{fa ? 'قلم دستی' : 'Typed line'}</button>
				</div>
			)}
		</div>
	)
}

export type Recipient = { conversationId: string; channel: ChannelType; name: string; handle: string | null; avatar: string | null; lastMessageAt: string | null; blocked: 'WINDOW_CLOSED' | null }

function ago(value: string | null, fa: boolean): string {
	if (!value) return ''
	const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
	const nf = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')
	if (minutes < 1) return fa ? 'همین الان' : 'just now'
	if (minutes < 60) return fa ? `${nf(minutes)} دقیقه پیش` : `${minutes} min ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24) return fa ? `${nf(hours)} ساعت پیش` : `${hours} h ago`
	const days = Math.round(hours / 24)
	return fa ? `${nf(days)} روز پیش` : `${days} d ago`
}

export function RecipientRow({ recipient, fa }: { recipient: Recipient; fa: boolean }) {
	return (
		<>
			<span className="relative shrink-0">
				<ContactAvatar src={recipient.avatar} alt="" size="sm" />
				<span className="absolute -bottom-0.5 -end-1 grid size-[18px] place-items-center rounded-full border-2 border-white bg-white dark:border-neutral-900 dark:bg-neutral-900"><ChannelGlyph type={recipient.channel} className="[&>svg]:size-3" /></span>
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[13px] font-bold text-[var(--text-primary)]">{recipient.name}</span>
				<span className="block truncate text-[11.5px] text-[var(--text-muted)]">
					{channelLabel(recipient.channel, fa ? 'fa' : 'en')}
					{recipient.handle ? <> · <bdi dir="ltr">@{recipient.handle.replace(/^@/, '')}</bdi></> : null}
					{recipient.lastMessageAt ? ` · ${ago(recipient.lastMessageAt, fa)}` : ''}
				</span>
			</span>
		</>
	)
}

/** Search the recent conversations and pick the customer to send the payment to. */
export function RecipientPicker({ value, onChange, fa }: { value: Recipient | null; onChange: (recipient: Recipient | null) => void; fa: boolean }) {
	const [query, setQuery] = useState('')
	const [hits, setHits] = useState<Recipient[] | null>(null)
	useEffect(() => {
		if (value) return
		const controller = new AbortController()
		const timer = window.setTimeout(async () => {
			try {
				const response = await fetch(`/api/payments/recipients?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
				const data = await response.json()
				setHits(Array.isArray(data.recipients) ? data.recipients : [])
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return
				setHits([])
			}
		}, query ? 250 : 0)
		return () => { controller.abort(); window.clearTimeout(timer) }
	}, [query, value])

	if (value) {
		return (
			<div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[var(--text-primary)] bg-[var(--bg-surface)] p-2.5">
				<RecipientRow recipient={value} fa={fa} />
				<button type="button" onClick={() => onChange(null)} aria-label={fa ? 'عوض کردن مشتری' : 'Change customer'} className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"><X className="size-4" aria-hidden /></button>
			</div>
		)
	}
	return (
		<div className="grid gap-1.5">
			<div className="relative">
				<Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
				<input id="pay-recipient-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={fa ? 'نام، شماره یا آیدی مشتری…' : 'Customer name, phone or handle…'} aria-label={fa ? 'جستجوی مشتری' : 'Search customers'} className="input min-h-11 w-full ps-9 text-base sm:text-sm" />
			</div>
			<ul className="grid max-h-64 gap-0.5 overflow-y-auto rounded-2xl border border-[var(--border-default)] p-1">
				{hits === null ? <li className="flex items-center justify-center gap-2 px-2 py-3 text-[12px] text-[var(--text-muted)]"><Loader2 className="size-3.5 animate-spin" aria-hidden />{fa ? 'در حال جستجو…' : 'Searching…'}</li>
					: hits.length === 0 ? <li className="px-2 py-3 text-center text-[12px] text-[var(--text-muted)]">{fa ? 'گفتگویی پیدا نشد.' : 'No conversation found.'}</li>
					: hits.map((recipient) => (
						<li key={recipient.conversationId}>
							<button type="button" disabled={recipient.blocked !== null} onClick={() => onChange(recipient)} className="flex w-full items-center gap-3 rounded-xl p-2 text-start hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50" title={recipient.blocked ? (fa ? 'اینستاگرام فقط تا ۲۴ ساعت بعد از آخرین پیام مشتری اجازهٔ پیام می‌دهد.' : 'Instagram allows messages only within 24 hours of the customer’s last one.') : undefined}>
								<RecipientRow recipient={recipient} fa={fa} />
								{recipient.blocked ? <span className="shrink-0 rounded-full bg-[var(--bg-muted)] px-2 text-[11px] leading-5 text-[var(--text-muted)]">{fa ? 'بیش از ۲۴ ساعت' : '24h passed'}</span> : null}
							</button>
						</li>
					))}
			</ul>
		</div>
	)
}
