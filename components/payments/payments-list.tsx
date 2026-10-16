'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Ban, Check, ChevronLeft, Copy, ExternalLink, MessageSquareText, PackageCheck, PackageX, ReceiptText, ShieldCheck, X } from 'lucide-react'
import type { ChannelType } from '@prisma/client'
import { SideSheet } from '@/components/ui/side-sheet'
import { StatusChip, type ChipTone } from '@/components/ui/status-chip'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { ChannelGlyph, channelLabel } from '@/components/crm/channel-badge'
import { BankMark } from '@/components/payments/bank-card'
import { copyText } from '@/components/commerce/card-pay-view'
import type { PayItem } from '@/lib/payments/card/items'
import { cn } from '@/lib/utils'

export interface PaymentRowData {
	id: string
	reference: string
	status: string
	confirmedBy: string | null
	source: string
	subject: string
	title: string
	customerName: string | null
	baseAmount: number
	/** What is still to transfer: after a short deposit, the rest. */
	payAmount: number
	/** Tomans already received from short deposits the owner attached. */
	partialAmount: number
	/** Tomans sent beyond the amount, to return or count toward the next purchase. */
	overpaidAmount: number | null
	/** Whether card-to-card is stopped for this customer; null when the payment has no known customer. */
	customerBlocked: boolean | null
	bankKey: string
	last4: string
	siteName: string | null
	createdAt: string
	claimedAt: string | null
	paidAt: string | null
	resolvedAt: string | null
	expiresAt: string
	payUrl: string
	conversation: { id: string; name: string; channel: ChannelType; avatar: string | null; lastMessage: string | null } | null
	items: PayItem[]
	storeOrder: { number: string | null; queued: boolean; error: string | null } | null
}

const STATUS: Record<string, { tone: ChipTone; fa: string; en: string }> = {
	PENDING: { tone: 'warn', fa: 'در انتظار واریز', en: 'Waiting for transfer' },
	CLAIMED: { tone: 'danger', fa: 'نیاز به بررسی شما', en: 'Needs your review' },
	PAID: { tone: 'ok', fa: 'پرداخت‌شده', en: 'Paid' },
	EXPIRED: { tone: 'neutral', fa: 'منقضی', en: 'Expired' },
	FAILED: { tone: 'danger', fa: 'رد شد', en: 'Rejected' },
	CANCELLED: { tone: 'neutral', fa: 'لغو شد', en: 'Cancelled' },
}

function useFormat() {
	const fa = useLocale() !== 'en'
	const numbers = fa ? 'fa-IR' : 'en-US'
	const time = new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' })
	const clock = new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-GB', { timeStyle: 'short', timeZone: 'Asia/Tehran' })
	return { fa, numbers, time: (value: string) => time.format(new Date(value)), clock: (value: string) => clock.format(new Date(value)), num: (value: number) => value.toLocaleString(numbers) }
}

export function PaymentStatusChip({ status, confirmedBy, size = 'md' }: { status: string; confirmedBy?: string | null; size?: 'sm' | 'md' }) {
	const { fa } = useFormat()
	const tone = STATUS[status] ?? STATUS.CANCELLED
	const byHand = status === 'PAID' && confirmedBy && confirmedBy !== 'AUTO'
	return (
		<StatusChip tone={tone.tone} dot pulse={status === 'PENDING' || status === 'CLAIMED'} className={size === 'sm' ? 'text-[11.5px]' : undefined}>
			{fa ? tone.fa : tone.en}{byHand ? (fa ? ' · دستی' : ' · by hand') : ''}
		</StatusChip>
	)
}

/** Who the payment came from: the conversation's customer and their app. */
function FromChip({ conversation }: { conversation: NonNullable<PaymentRowData['conversation']> }) {
	const { fa } = useFormat()
	return (
		<span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-[var(--bg-muted)] py-0.5 pe-2 ps-0.5 text-[11.5px] font-medium text-[var(--text-primary)]">
			<ContactAvatar src={conversation.avatar} alt="" size="xs" className="!size-[18px] border-0" />
			<span className="truncate">{conversation.name}</span>
			<ChannelGlyph type={conversation.channel} className="[&>svg]:size-3" />
			<span className="sr-only">{fa ? `از ${channelLabel(conversation.channel, 'fa')}` : `on ${channelLabel(conversation.channel, 'en')}`}</span>
		</span>
	)
}

function StoreOrderChip({ order }: { order: PaymentRowData['storeOrder'] }) {
	const { fa } = useFormat()
	if (!order) return null
	if (order.number) return <span className="inline-flex items-center gap-1 rounded-full bg-[#f1eeff] px-2 py-0.5 text-[11.5px] font-medium text-[#4c2fd0] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><PackageCheck className="size-3.5" aria-hidden />{fa ? 'ووکامرس' : 'WooCommerce'} #{order.number}</span>
	if (order.queued) return <span title={order.error ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11.5px] text-[var(--text-secondary)]"><PackageCheck className="size-3.5" aria-hidden />{fa ? 'در صف ووکامرس' : 'Queued for WooCommerce'}</span>
	if (order.error) return <span title={order.error} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11.5px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"><PackageX className="size-3.5" aria-hidden />{fa ? 'در ووکامرس ثبت نشد' : 'Not on WooCommerce'}</span>
	return null
}

type Action = 'confirm' | 'cancel' | 'reject' | 'block' | 'unblock'

/** Money that does not fit the amount: part received so far, or the extra beyond it. */
function MoneyChip({ row }: { row: PaymentRowData }) {
	const { fa, num } = useFormat()
	if (row.overpaidAmount) return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{fa ? `${num(row.overpaidAmount)} اضافه` : `${num(row.overpaidAmount)} extra`}</span>
	if (row.partialAmount && row.status !== 'PAID') return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{fa ? `${num(row.partialAmount)} رسیده` : `${num(row.partialAmount)} received`}</span>
	return null
}

/** Stop card-to-card for the payment's customer, or allow it again; asks once more before blocking. */
function BlockToggle({ row }: { row: PaymentRowData }) {
	const { fa } = useFormat()
	const { busy, armed, error, run } = usePaymentAction(row.id)
	if (row.customerBlocked == null) return null
	const action: Action = row.customerBlocked ? 'unblock' : 'block'
	return (
		<div className="grid gap-1">
			<button type="button" disabled={busy !== null} onClick={() => run(action, action === 'unblock')} className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors disabled:opacity-60', armed === 'block' ? 'border-red-600 bg-red-600 text-white' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]')}>
				{row.customerBlocked ? <ShieldCheck className="size-4" aria-hidden /> : <Ban className="size-4" aria-hidden />}
				{busy ? '…' : row.customerBlocked ? (fa ? 'باز کردن کارت‌به‌کارت این مشتری' : 'Allow card-to-card again') : armed === 'block' ? (fa ? 'بله، ببند' : 'Yes, block') : (fa ? 'بستن کارت‌به‌کارت این مشتری' : 'Block card-to-card for this customer')}
			</button>
			{row.customerBlocked ? <p className="text-[11.5px] text-[var(--text-muted)]">{fa ? 'ایجنت برای این مشتری کارت نمی‌فرستد و راه‌های دیگر پرداخت را پیشنهاد می‌کند.' : 'The agent does not send this customer the card and offers the other ways to pay.'}</p> : null}
			{error ? <span role="alert" className="text-[12px] text-red-600">{error}</span> : null}
		</div>
	)
}

/** Runs a decision on a payment; it asks once more before acting unless `immediate`. */
function usePaymentAction(paymentId: string, onDone?: () => void) {
	const router = useRouter()
	const { fa } = useFormat()
	const [busy, setBusy] = useState<Action | null>(null)
	const [armed, setArmed] = useState<Action | null>(null)
	const [error, setError] = useState<string | null>(null)
	useEffect(() => {
		if (!armed) return
		const timer = window.setTimeout(() => setArmed(null), 4000)
		return () => window.clearTimeout(timer)
	}, [armed])
	async function run(action: Action, immediate = false) {
		if (!immediate && armed !== action) { setArmed(action); return }
		setArmed(null)
		setBusy(action)
		setError(null)
		try {
			const response = await fetch(`/api/payments/${paymentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
			if (!response.ok && response.status !== 409) throw new Error('failed')
			onDone?.()
			router.refresh()
		} catch {
			setError(fa ? 'انجام نشد؛ دوباره تلاش کنید.' : 'That did not work; try again.')
		} finally {
			setBusy(null)
		}
	}
	return { busy, armed, error, run }
}

function CopyLinkButton({ url, compact }: { url: string; compact?: boolean }) {
	const { fa } = useFormat()
	const [done, setDone] = useState(false)
	const label = done ? (fa ? 'کپی شد' : 'Copied') : (fa ? 'کپی لینک' : 'Copy link')
	return (
		<button
			type="button"
			title={fa ? 'کپی لینک صفحهٔ پرداخت' : 'Copy the payment page link'}
			onClick={async (event) => {
				event.stopPropagation()
				if (await copyText(url)) { setDone(true); window.setTimeout(() => setDone(false), 1500) }
			}}
			className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', done ? 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-[var(--border-default)] bg-white text-[var(--text-primary)] hover:border-[var(--border-hover)] dark:bg-neutral-900', compact && 'size-9 justify-center px-0')}
		>
			{done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
			{compact ? <span className="sr-only">{label}</span> : label}
		</button>
	)
}

/** The decisions on an open payment, side by side: confirm in green, withdraw in red, each asking once more. */
function DecisionButtons({ row, size = 'row', onDone }: { row: PaymentRowData; size?: 'row' | 'sheet'; onDone?: () => void }) {
	const { fa } = useFormat()
	const { busy, armed, error, run } = usePaymentAction(row.id, onDone)
	const review = row.status === 'CLAIMED'
	const big = size === 'sheet'
	const base = cn('inline-flex items-center justify-center gap-1.5 rounded-full border font-bold transition-[background-color,border-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60', big ? 'min-h-12 rounded-2xl px-4 text-[14px]' : 'min-h-9 px-3 text-[12.5px]')
	const confirmArmed = armed === 'confirm'
	const stopArmed = armed === 'cancel' || armed === 'reject'
	const stop: Action = review ? 'reject' : 'cancel'
	return (
		<div className={cn('flex items-center gap-1.5', big && 'grid grid-cols-2 gap-2')} onClick={(event) => event.stopPropagation()}>
			<button type="button" disabled={busy !== null} onClick={() => run('confirm')} className={cn(base, confirmArmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200')}>
				<Check className="size-4" strokeWidth={2.6} aria-hidden />
				{busy === 'confirm' ? '…' : confirmArmed ? (fa ? 'بله، واریز رسیده' : 'Yes, it arrived') : review ? (fa ? 'واریز رسیده' : 'It arrived') : (fa ? 'تأیید دستی' : 'Confirm')}
			</button>
			<button type="button" disabled={busy !== null} onClick={() => run(stop)} className={cn(base, stopArmed ? 'border-red-600 bg-red-600 text-white' : 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300')}>
				<X className="size-4" strokeWidth={2.6} aria-hidden />
				{busy === stop ? '…' : stopArmed ? (fa ? 'بله، لغو شود' : 'Yes, withdraw') : review ? (fa ? 'نیامده، رد' : 'Reject') : (fa ? 'لغو' : 'Withdraw')}
			</button>
			{error ? <span role="alert" className="col-span-2 text-[12px] text-red-600">{error}</span> : null}
		</div>
	)
}

function Detail({ row, onClose }: { row: PaymentRowData; onClose: () => void }) {
	const { fa, num, time, clock } = useFormat()
	const open = row.status === 'PENDING' || row.status === 'CLAIMED'
	const minutes = Math.max(0, Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / 60_000))
	const steps: Array<{ label: string; at: string | null; state: 'done' | 'now' | 'bad' }> = [
		{ label: row.conversation ? (fa ? `ساخته و در گفتگوی ${channelLabel(row.conversation.channel, 'fa')} فرستاده شد` : `Created and sent on ${channelLabel(row.conversation.channel, 'en')}`) : row.source === 'API' ? (fa ? `از سایت ${row.siteName ?? ''} ساخته شد` : `Created by ${row.siteName ?? 'the site'}`) : (fa ? 'لینک پرداخت ساخته شد' : 'Payment link created'), at: row.createdAt, state: 'done' },
		...(row.claimedAt ? [{ label: fa ? 'مشتری گفت پرداخت کرده' : 'The customer said they paid', at: row.claimedAt, state: 'done' as const }] : []),
		row.status === 'PAID'
			? { label: row.confirmedBy === 'AUTO' ? (fa ? 'پیامک بانک رسید؛ خودکار تأیید شد' : 'The bank SMS arrived; confirmed automatically') : (fa ? 'دستی تأیید شد' : 'Confirmed by hand'), at: row.paidAt, state: 'done' }
			: row.status === 'PENDING' ? { label: fa ? 'منتظر پیامک واریز بانک' : 'Waiting for the bank’s deposit SMS', at: null, state: 'now' }
			: row.status === 'CLAIMED' ? { label: fa ? 'منتظر تصمیم شما' : 'Waiting for your decision', at: null, state: 'now' }
			: row.status === 'EXPIRED' ? { label: fa ? 'مهلت تمام شد' : 'Expired', at: row.expiresAt, state: 'bad' }
			: row.status === 'FAILED' ? { label: fa ? 'رد شد' : 'Rejected', at: row.resolvedAt, state: 'bad' }
			: { label: fa ? 'لغو شد' : 'Withdrawn', at: row.resolvedAt, state: 'bad' },
	]
	const itemsTotal = row.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)

	return (
		<SideSheet
			title={row.title}
			subtitle={`#${row.reference}`}
			onClose={onClose}
			closeLabel={fa ? 'بستن' : 'Close'}
			className="md:w-[min(28rem,calc(100vw-1.5rem))]"
			icon={<BankMark bankKey={row.bankKey} size={40} />}
			footer={open || row.customerBlocked != null ? (
				<div className="grid gap-2">
					{open ? (
						<>
							<DecisionButtons row={row} size="sheet" onDone={onClose} />
							<div className="flex flex-wrap gap-2">
								<CopyLinkButton url={row.payUrl} />
								<a href={row.payUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 text-[12.5px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]"><ExternalLink className="size-4" aria-hidden />{fa ? 'صفحهٔ پرداخت' : 'Payment page'}</a>
							</div>
						</>
					) : null}
					<BlockToggle row={row} />
				</div>
			) : undefined}
		>
			<div className="grid gap-5">
				<div className="grid justify-items-center gap-1.5 rounded-2xl bg-[var(--bg-surface)] px-4 py-5 text-center">
					<PaymentStatusChip status={row.status} confirmedBy={row.confirmedBy} />
					<p className="text-[28px] font-extrabold tabular-nums leading-10 text-[var(--text-primary)]">{num(row.baseAmount)} <span className="text-[13px] font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span></p>
					<p className="text-[12.5px] text-[var(--text-muted)]">
						{fa ? 'واریز دقیق' : 'Exact transfer'} <span dir="ltr" className="font-mono">{row.payAmount.toLocaleString('en-US')}</span> · {fa ? 'به کارت' : 'to'} <span dir="ltr" className="font-mono">••{row.last4}</span>
						{row.status === 'PENDING' && minutes > 0 ? <> · {fa ? `${num(minutes)} دقیقه مانده` : `${minutes} min left`}</> : null}
					</p>
					{row.partialAmount ? (
						<p className="text-[12.5px] text-amber-800 dark:text-amber-300">
							{row.status === 'PAID'
								? (fa ? `در دو مرحله رسید: اول ${num(row.partialAmount)} تومان، بعد بقیه` : `Arrived in two parts: ${num(row.partialAmount)} Toman first, then the rest`)
								: (fa ? `${num(row.partialAmount)} تومان رسیده؛ بقیه از مشتری خواسته شده` : `${num(row.partialAmount)} Toman received; the customer was asked for the rest`)}
						</p>
					) : null}
					{row.overpaidAmount ? (
						<p className="text-[12.5px] text-amber-800 dark:text-amber-300">{fa ? `مشتری ${num(row.overpaidAmount)} تومان بیشتر واریز کرده؛ برگردانید یا در خرید بعدی حساب کنید.` : `The customer sent ${num(row.overpaidAmount)} Toman more; return it or count it toward the next purchase.`}</p>
					) : null}
					<StoreOrderChip order={row.storeOrder} />
				</div>

				{row.conversation ? (
					<div className="grid gap-2">
						<p className="text-[12px] font-medium text-[var(--text-muted)]">{fa ? 'گفتگو' : 'Conversation'}</p>
						<Link href={`/conversations/${row.conversation.id}`} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-white p-3 transition-colors hover:border-[var(--border-hover)] dark:bg-neutral-900">
							<span className="relative">
								<ContactAvatar src={row.conversation.avatar} alt="" size="md" />
								<span className="absolute -bottom-0.5 -end-1 grid size-5 place-items-center rounded-full border-2 border-white bg-white dark:border-neutral-900 dark:bg-neutral-900"><ChannelGlyph type={row.conversation.channel} /></span>
							</span>
							<span className="min-w-0">
								<b className="block truncate text-[13.5px] text-[var(--text-primary)]">{row.conversation.name}</b>
								<span className="block truncate text-[12px] text-[var(--text-muted)]">{row.conversation.lastMessage ? `«${row.conversation.lastMessage}»` : channelLabel(row.conversation.channel, fa ? 'fa' : 'en')}</span>
							</span>
							<span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"><MessageSquareText className="size-4" aria-hidden />{fa ? 'باز کردن' : 'Open'}</span>
						</Link>
					</div>
				) : row.customerName ? (
					<p className="text-[13px] text-[var(--text-secondary)]">{fa ? 'مشتری: ' : 'Customer: '}<b className="text-[var(--text-primary)]">{row.customerName}</b></p>
				) : null}

				{row.items.length ? (
					<div className="grid gap-2">
						<p className="text-[12px] font-medium text-[var(--text-muted)]">{fa ? 'اقلام' : 'Items'}</p>
						<ul className="grid gap-0 rounded-2xl border border-[var(--border-default)] px-3.5">
							{row.items.map((item, index) => (
								<li key={index} className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-2.5 text-[13px] last:border-b-0">
									<span className="min-w-0"><span className="block truncate text-[var(--text-primary)]">{item.name}</span><span className="text-[11.5px] text-[var(--text-muted)]">{fa ? `${num(item.quantity)} عدد` : `× ${item.quantity}`}</span></span>
									{item.unitPrice != null ? <span className="shrink-0 tabular-nums font-medium">{num(item.unitPrice * item.quantity)}</span> : null}
								</li>
							))}
							{itemsTotal && itemsTotal !== row.baseAmount ? <li className="flex justify-between py-2 text-[12px] text-[var(--text-muted)]"><span>{fa ? 'جمع اقلام' : 'Items total'}</span><span className="tabular-nums">{num(itemsTotal)}</span></li> : null}
						</ul>
					</div>
				) : null}

				<div className="grid gap-2">
					<p className="text-[12px] font-medium text-[var(--text-muted)]">{fa ? 'مسیر پرداخت' : 'Timeline'}</p>
					<ol className="grid gap-0">
						{steps.map((step, index) => (
							<li key={index} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5 text-[13px] text-[var(--text-secondary)]">
								<span className={cn('mx-auto size-2.5 rounded-full', step.state === 'done' ? 'bg-emerald-500' : step.state === 'now' ? 'animate-pulse bg-amber-500 ring-4 ring-amber-100 motion-reduce:animate-none dark:ring-amber-950' : 'bg-[var(--border-strong)]')} />
								<span>{step.label}</span>
								<time className="text-[11.5px] tabular-nums text-[var(--text-muted)]" title={step.at ? time(step.at) : undefined}>{step.at ? clock(step.at) : '—'}</time>
							</li>
						))}
					</ol>
				</div>
			</div>
		</SideSheet>
	)
}

/**
 * The payments as a list: on desktop each row carries its decisions as
 * buttons; on phones a row is one tap target. Tapping or clicking a row
 * opens its detail (side sheet / bottom sheet) with the conversation, the
 * items and the timeline.
 */
export function PaymentsList({ rows }: { rows: PaymentRowData[] }) {
	const { fa, num, time } = useFormat()
	const [openId, setOpenId] = useState<string | null>(null)
	const selected = rows.find((row) => row.id === openId) ?? null

	return (
		<>
			<div aria-hidden className="hidden grid-cols-[2.25rem_minmax(0,1.6fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(13rem,auto)] gap-4 border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-2 text-[12px] font-medium text-[var(--text-muted)] md:grid">
				<span />
				<span>{fa ? 'پرداخت' : 'Payment'}</span>
				<span>{fa ? 'مبلغ' : 'Amount'}</span>
				<span>{fa ? 'وضعیت' : 'Status'}</span>
				<span className="text-end">{fa ? 'کارها' : 'Actions'}</span>
			</div>
			<ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] md:border-t-0">
				{rows.map((row) => {
					const open = row.status === 'PENDING' || row.status === 'CLAIMED'
					const meta = [row.conversation ? null : row.subject, row.siteName, !row.conversation && row.customerName && row.title !== row.customerName ? row.customerName : null, time(row.createdAt)].filter(Boolean).join(' · ')
					return (
						<li key={row.id}>
							<div
								role="button"
								tabIndex={0}
								aria-label={fa ? `جزئیات ${row.title}، ${num(row.baseAmount)} تومان` : `Details of ${row.title}, ${row.baseAmount} Toman`}
								onClick={() => setOpenId(row.id)}
								onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpenId(row.id) } }}
								className={cn(
									'grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--bg-surface)] focus-visible:bg-[var(--bg-surface)] focus-visible:outline-none active:bg-[var(--bg-hover)] sm:px-5 md:grid-cols-[2.25rem_minmax(0,1.6fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(13rem,auto)] md:gap-x-4',
									openId === row.id && 'bg-[var(--bg-surface)]',
								)}
							>
								<span className="row-span-2 md:row-span-1"><BankMark bankKey={row.bankKey} size={36} /></span>
								<div className="min-w-0">
									<p className="flex min-w-0 items-center gap-2">
										<span className="truncate text-[13.5px] font-bold text-[var(--text-primary)]">{row.title}</span>
										<span dir="ltr" className="hidden shrink-0 font-mono text-[11.5px] text-[var(--text-muted)] sm:inline">#{row.reference}</span>
									</p>
									<p className="mt-0.5 hidden min-w-0 items-center gap-1.5 text-[12px] text-[var(--text-muted)] md:flex">
										{row.conversation ? <FromChip conversation={row.conversation} /> : null}
										<span className="truncate">{meta}</span>
									</p>
								</div>
								<div className="text-end md:text-start">
									<p className="whitespace-nowrap text-[14px] font-bold tabular-nums text-[var(--text-primary)]">{num(row.baseAmount)} <span className="text-[11.5px] font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span></p>
									<p className="hidden truncate text-[12px] text-[var(--text-muted)] md:block">{fa ? 'واریز دقیق' : 'Exact'} <span dir="ltr" className="font-mono">{row.payAmount.toLocaleString('en-US')}</span> · <span dir="ltr" className="font-mono">••{row.last4}</span></p>
								</div>
								{/* Phones: status and where it came from on the second line, a chevron at the end. */}
								<div className="col-start-2 col-end-4 flex min-w-0 items-center gap-1.5 md:col-auto">
									<PaymentStatusChip status={row.status} confirmedBy={row.confirmedBy} size="sm" />
									<MoneyChip row={row} />
									<span className="hidden md:inline-flex"><StoreOrderChip order={row.storeOrder} /></span>
									<span className="flex min-w-0 md:hidden">{row.conversation ? <FromChip conversation={row.conversation} /> : <span className="truncate text-[11.5px] text-[var(--text-muted)]">{row.subject}</span>}</span>
									<ChevronLeft className="ms-auto size-4 shrink-0 text-[var(--text-hint)] md:hidden ltr:rotate-180" aria-hidden />
								</div>
								<div className="hidden items-center justify-end gap-1.5 md:flex">
									{open ? (
										<>
											<CopyLinkButton url={row.payUrl} compact />
											<DecisionButtons row={row} />
										</>
									) : (
										<span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3.5 text-[12.5px] font-medium text-[var(--text-secondary)]"><ReceiptText className="size-4" aria-hidden />{fa ? 'جزئیات' : 'Details'}</span>
									)}
								</div>
							</div>
						</li>
					)
				})}
			</ul>
			{selected ? <Detail row={selected} onClose={() => setOpenId(null)} /> : null}
		</>
	)
}

