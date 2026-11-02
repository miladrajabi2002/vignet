import Link from 'next/link'
import { BadgeCheck, CircleCheck, CreditCard, Globe, Hourglass, MapPin, MessageSquare, ShieldCheck, ShoppingBag, Store } from 'lucide-react'
import { BankMark } from '@/components/payments/bank-card'
import { PaymentHandledButton } from '@/components/payments/payment-actions'
import { displayOrderCode } from '@/lib/commerce/order-ref'
import type { Purchase } from '@/lib/payments/card/fulfilment'
import { cn } from '@/lib/utils'

const CONFIRMED_BY: Record<string, [string, string]> = {
	AUTO: ['خودکار با پیامک بانک', 'By the bank SMS'],
	OWNER: ['دستی از پنل', 'By hand'],
	OPERATOR: ['از ربات مدیر', 'From the manager bot'],
	ADMIN: ['پشتیبانی ویجنت', 'By support'],
}

/** A purchase as it arrives from the API: dates as strings. */
export type PurchaseView = Omit<Purchase, 'paidAt' | 'handledAt'> & { paidAt: Date | string; handledAt: Date | string | null }

/**
 * One paid order as a receipt: what was bought (line by line), what it came
 * to, how it was paid and where it goes, with «رسیدگی شد» while it waits.
 * `card` stands alone with its own header; `plain` is the body only, for a
 * row or sheet that already shows the code, date and state.
 * `conversationLink` is off inside the conversation itself.
 */
export function PurchaseCard({ purchase, locale, conversationLink = true, variant = 'card', className }: { purchase: PurchaseView; locale: 'fa' | 'en'; conversationLink?: boolean; variant?: 'card' | 'plain'; className?: string }) {
	const fa = locale !== 'en'
	const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
	const money = (value: number) => `${nf.format(Math.round(value))} ${fa ? 'تومان' : 'Toman'}`
	const date = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(purchase.paidAt))
	const waiting = purchase.paymentId != null && !purchase.handledAt
	const subtotal = purchase.lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.quantity, 0)
	const showSubtotal = subtotal > 0 && (purchase.shipping?.cost || purchase.discount)
	const confirmed = purchase.confirmedBy ? CONFIRMED_BY[purchase.confirmedBy] : null
	const chat = conversationLink && purchase.conversationId ? purchase.conversationId : null

	const facts: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = [
		{
			icon: purchase.card ? <BankMark bankKey={purchase.card.bankKey} size={16} /> : <CreditCard className="size-4" aria-hidden />,
			label: fa ? 'پرداخت' : 'Paid by',
			value: <>{purchase.method}{purchase.card ? <> <span dir="ltr" className="font-mono text-[var(--text-muted)]">…{purchase.card.last4}</span></> : null}</>,
		},
		...(confirmed ? [{ icon: <ShieldCheck className="size-4" aria-hidden />, label: fa ? 'تأیید' : 'Confirmed', value: fa ? confirmed[0] : confirmed[1] }] : []),
		...(purchase.address ? [{ icon: <MapPin className="size-4" aria-hidden />, label: fa ? 'آدرس' : 'Address', value: purchase.address }] : []),
		...(purchase.storeOrder ? [{ icon: <Store className="size-4" aria-hidden />, label: fa ? 'فروشگاه سایت' : 'Store order', value: <span dir="ltr" className="font-mono">#{purchase.storeOrder}</span> }] : []),
		...(purchase.source === 'API' ? [{ icon: <Globe className="size-4" aria-hidden />, label: fa ? 'سایت' : 'Site', value: <>{purchase.siteName ?? (fa ? 'سایت متصل' : 'Connected site')}{purchase.handledAt ? <span className="block text-[11.5px] font-normal text-[var(--text-muted)]">{fa ? 'سایت پرداخت را تأیید کرده و سفارش را خودش تحویل می‌دهد.' : 'The site verified the payment and delivers the order itself.'}</span> : null}</> }] : []),
	]

	const body = (
		<>
			<ul className="divide-y divide-[var(--border-subtle)]">
				{purchase.lines.map((line, index) => (
					<li key={index} className="flex items-start gap-3 py-2.5 first:pt-0">
						<span className="mt-0.5 grid h-6 min-w-7 shrink-0 place-items-center rounded-md bg-[var(--bg-muted)] px-1 text-[12px] font-bold tabular-nums text-[var(--text-secondary)]">{nf.format(line.quantity)}×</span>
						<span className="min-w-0 flex-1">
							<span className="block break-words text-[13.5px] font-medium leading-6 text-[var(--text-primary)]">{line.name}</span>
							{line.variant || (line.unitPrice != null && line.quantity > 1) ? (
								<span className="block text-[12px] text-[var(--text-muted)]">
									{[line.variant, line.unitPrice != null && line.quantity > 1 ? `${fa ? 'هر عدد' : 'each'} ${money(line.unitPrice)}` : null].filter(Boolean).join(' · ')}
								</span>
							) : null}
						</span>
						{line.unitPrice != null ? <span className="shrink-0 pt-px text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{money(line.unitPrice * line.quantity)}</span> : null}
					</li>
				))}
			</ul>

			<dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1.5 border-t border-dashed border-[var(--border-default)] pt-3 text-[13px]">
				{showSubtotal ? (<><dt className="text-[var(--text-muted)]">{fa ? 'جمع اقلام' : 'Items'}</dt><dd className="tabular-nums text-[var(--text-secondary)]">{money(subtotal)}</dd></>) : null}
				{purchase.shipping ? (<><dt className="text-[var(--text-muted)]">{purchase.shipping.label || (fa ? 'ارسال' : 'Shipping')}</dt><dd className="tabular-nums text-[var(--text-secondary)]">{purchase.shipping.cost ? money(purchase.shipping.cost) : (fa ? 'رایگان' : 'Free')}</dd></>) : null}
				{purchase.discount ? (<><dt className="text-[var(--text-muted)]">{fa ? 'تخفیف' : 'Discount'}</dt><dd className="tabular-nums text-emerald-700">−{money(purchase.discount)}</dd></>) : null}
				<dt className="font-bold text-[var(--text-primary)]">{fa ? 'مبلغ پرداخت‌شده' : 'Paid'}</dt>
				<dd className="text-[15.5px] font-extrabold tabular-nums text-[var(--text-primary)]">{money(purchase.total)}</dd>
			</dl>

			<dl className="grid gap-2 rounded-xl bg-[var(--bg-muted)] p-3 text-[12.5px] leading-6">
				{facts.map((fact) => (
					<div key={fact.label} className="flex items-start gap-2.5">
						<span className="grid h-6 w-4 shrink-0 place-items-center text-[var(--text-muted)]">{fact.icon}</span>
						<dt className="w-16 shrink-0 text-[var(--text-muted)] sm:w-20">{fact.label}</dt>
						<dd className="min-w-0 flex-1 break-words font-medium text-[var(--text-primary)]">{fact.value}</dd>
					</div>
				))}
			</dl>

			{purchase.paymentId || chat ? (
				<div className={cn('grid gap-2', purchase.paymentId && chat ? 'grid-cols-2 sm:flex sm:justify-end' : 'sm:flex sm:justify-end')}>
					{chat ? (
						<Link
							href={`/conversations/${chat}`}
							className="spatial-press inline-flex min-h-9 items-center justify-center gap-2 rounded-control border border-[var(--border-default)] bg-white px-3.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] dark:bg-transparent"
						>
							<MessageSquare className="size-4" aria-hidden />
							{fa ? 'گفتگوی خرید' : 'Open the chat'}
						</Link>
					) : null}
					{purchase.paymentId ? <PaymentHandledButton paymentId={purchase.paymentId} handled={!waiting} className="[&>button]:w-full sm:[&>button]:w-auto" /> : null}
				</div>
			) : null}
		</>
	)

	if (variant === 'plain') return <div className={cn('grid gap-3', className)}>{body}</div>

	return (
		<article className={cn('overflow-hidden rounded-2xl border bg-white dark:bg-neutral-900', waiting ? 'border-emerald-300 shadow-[0_10px_30px_-22px_rgba(5,150,105,.7)]' : 'border-[var(--border-default)]', className)}>
			<header className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
				<span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', waiting ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700')}>
					<ShoppingBag className="size-[18px]" aria-hidden />
				</span>
				<div className="min-w-0 flex-1">
					<p className="flex min-w-0 items-baseline gap-1.5 text-[14.5px] font-bold text-[var(--text-primary)]">
						<span className="shrink-0">{fa ? 'سفارش' : 'Order'}</span>
						<span dir="ltr" className="truncate font-mono" title={purchase.code}>#{displayOrderCode(purchase.code)}</span>
					</p>
					<p className="text-[12px] leading-5 text-[var(--text-muted)]">{date}</p>
				</div>
				<PurchaseState purchase={purchase} fa={fa} />
			</header>
			<div className="grid gap-3 p-4">{body}</div>
		</article>
	)
}

/** «منتظر رسیدگی» / «رسیدگی شد» for a card-to-card order, «پرداخت‌شده» otherwise. */
export function PurchaseState({ purchase, fa, className }: { purchase: Pick<PurchaseView, 'paymentId' | 'handledAt'>; fa: boolean; className?: string }) {
	const base = 'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold'
	if (purchase.paymentId && !purchase.handledAt) {
		return <span className={cn(base, 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200', className)}><Hourglass className="size-3.5" aria-hidden />{fa ? 'منتظر رسیدگی' : 'To handle'}</span>
	}
	return purchase.paymentId
		? <span className={cn(base, 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200', className)}><CircleCheck className="size-3.5" aria-hidden />{fa ? 'رسیدگی شد' : 'Handled'}</span>
		: <span className={cn(base, 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200', className)}><BadgeCheck className="size-3.5" aria-hidden />{fa ? 'پرداخت‌شده' : 'Paid'}</span>
}
