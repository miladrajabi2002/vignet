import Link from 'next/link'
import { BadgeCheck, CircleCheck, Hourglass, MapPin, MessageSquare, ShoppingBag, Store } from 'lucide-react'
import { BankMark } from '@/components/payments/bank-card'
import { PaymentHandledButton } from '@/components/payments/payment-actions'
import type { Purchase } from '@/lib/payments/card/fulfilment'
import { cn } from '@/lib/utils'

const CONFIRMED_BY: Record<string, [string, string]> = {
	AUTO: ['تأیید خودکار با پیامک بانک', 'Confirmed by the bank SMS'],
	OWNER: ['تأیید دستی', 'Confirmed by hand'],
	OPERATOR: ['تأیید از ربات مدیر', 'Confirmed from the manager bot'],
	ADMIN: ['تأیید پشتیبانی', 'Confirmed by support'],
}

/**
 * One paid order as a receipt: what was bought (line by line), what it came
 * to, how it was paid and where it goes, with «رسیدگی شد» while it waits.
 * `conversationLink` is off inside the conversation itself.
 */
/** A purchase as it arrives from the API: dates as strings. */
export type PurchaseView = Omit<Purchase, 'paidAt' | 'handledAt'> & { paidAt: Date | string; handledAt: Date | string | null }

export function PurchaseCard({ purchase, locale, conversationLink = true, className }: { purchase: PurchaseView; locale: 'fa' | 'en'; conversationLink?: boolean; className?: string }) {
	const fa = locale !== 'en'
	const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
	const money = (value: number) => `${nf.format(Math.round(value))} ${fa ? 'تومان' : 'Toman'}`
	const date = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(purchase.paidAt))
	const waiting = purchase.paymentId != null && !purchase.handledAt
	const subtotal = purchase.lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.quantity, 0)
	const showSubtotal = subtotal > 0 && (purchase.shipping?.cost || purchase.discount)
	const confirmed = purchase.confirmedBy ? CONFIRMED_BY[purchase.confirmedBy] : null

	return (
		<article className={cn('overflow-hidden rounded-2xl border bg-white', waiting ? 'border-emerald-300 shadow-[0_10px_30px_-22px_rgba(5,150,105,.7)]' : 'border-[var(--border-default)]', className)}>
			<header className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3', waiting ? 'bg-emerald-50' : 'bg-[var(--bg-muted)]')}>
				<span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', waiting ? 'bg-emerald-600 text-white' : 'bg-white text-[var(--text-secondary)] ring-1 ring-[var(--border-default)]')}>
					<ShoppingBag className="size-[18px]" aria-hidden />
				</span>
				<div className="min-w-0 flex-1">
					<p className="flex flex-wrap items-baseline gap-x-2 text-[14.5px] font-bold text-[var(--text-primary)]">
						{fa ? 'سفارش' : 'Order'} <span dir="ltr" className="font-mono">#{purchase.code}</span>
					</p>
					<p className="text-[12px] text-[var(--text-muted)]">{fa ? `پرداخت‌شده · ${date}` : `Paid · ${date}`}</p>
				</div>
				{purchase.paymentId ? (
					waiting ? (
						<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-semibold text-amber-800"><Hourglass className="size-3.5" aria-hidden />{fa ? 'منتظر رسیدگی' : 'Waiting for you'}</span>
					) : (
						<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-semibold text-emerald-800"><CircleCheck className="size-3.5" aria-hidden />{fa ? 'رسیدگی شد' : 'Handled'}</span>
					)
				) : (
					<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-semibold text-emerald-800"><BadgeCheck className="size-3.5" aria-hidden />{fa ? 'پرداخت‌شده' : 'Paid'}</span>
				)}
			</header>

			<ul className="divide-y divide-[var(--border-subtle)] px-4">
				{purchase.lines.map((line, index) => (
					<li key={index} className="flex items-start gap-3 py-2.5">
						<span className="mt-0.5 grid h-6 min-w-6 shrink-0 place-items-center rounded-md bg-[var(--bg-muted)] px-1 text-[12px] font-bold tabular-nums text-[var(--text-secondary)]">{nf.format(line.quantity)}×</span>
						<span className="min-w-0 flex-1">
							<span className="block text-[13.5px] font-medium leading-6 text-[var(--text-primary)]">{line.name}</span>
							{line.variant || (line.unitPrice != null && line.quantity > 1) ? (
								<span className="block text-[12px] text-[var(--text-muted)]">
									{[line.variant, line.unitPrice != null && line.quantity > 1 ? `${fa ? 'هر عدد' : 'each'} ${money(line.unitPrice)}` : null].filter(Boolean).join(' · ')}
								</span>
							) : null}
						</span>
						{line.unitPrice != null ? <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{money(line.unitPrice * line.quantity)}</span> : null}
					</li>
				))}
			</ul>

			<dl className="mx-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-dashed border-[var(--border-default)] py-3 text-[13px]">
				{showSubtotal ? (<><dt className="text-[var(--text-muted)]">{fa ? 'جمع اقلام' : 'Items'}</dt><dd className="tabular-nums text-[var(--text-secondary)]">{money(subtotal)}</dd></>) : null}
				{purchase.shipping ? (<><dt className="text-[var(--text-muted)]">{purchase.shipping.label || (fa ? 'ارسال' : 'Shipping')}</dt><dd className="tabular-nums text-[var(--text-secondary)]">{purchase.shipping.cost ? money(purchase.shipping.cost) : (fa ? 'رایگان' : 'Free')}</dd></>) : null}
				{purchase.discount ? (<><dt className="text-[var(--text-muted)]">{fa ? 'تخفیف' : 'Discount'}</dt><dd className="tabular-nums text-emerald-700">−{money(purchase.discount)}</dd></>) : null}
				<dt className="font-bold text-[var(--text-primary)]">{fa ? 'مبلغ پرداخت‌شده' : 'Paid'}</dt>
				<dd className="text-[15px] font-extrabold tabular-nums text-[var(--text-primary)]">{money(purchase.total)}</dd>
			</dl>

			<div className="grid gap-2 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-muted)_55%,white)] px-4 py-3 text-[12.5px] leading-6 text-[var(--text-secondary)]">
				<p className="flex flex-wrap items-center gap-x-2 gap-y-1">
					{purchase.card ? <BankMark bankKey={purchase.card.bankKey} size={18} /> : null}
					<span className="font-medium text-[var(--text-primary)]">{purchase.method}</span>
					{purchase.card ? <span dir="ltr" className="font-mono">…{purchase.card.last4}</span> : null}
					{confirmed ? <span className="text-[var(--text-muted)]">· {fa ? confirmed[0] : confirmed[1]}</span> : null}
				</p>
				{purchase.address ? <p className="flex items-start gap-1.5"><MapPin className="mt-1 size-3.5 shrink-0" aria-hidden /><span className="min-w-0 break-words">{purchase.address}</span></p> : null}
				{purchase.storeOrder ? <p className="flex items-center gap-1.5"><Store className="size-3.5 shrink-0" aria-hidden />{fa ? 'در فروشگاه سایت ثبت شد:' : 'Placed on the store:'} <span dir="ltr" className="font-mono">#{purchase.storeOrder}</span></p> : null}
				{(purchase.paymentId || (conversationLink && purchase.conversationId)) ? (
					<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
						{conversationLink && purchase.conversationId ? (
							<Link href={`/conversations/${purchase.conversationId}`} className="ui-link inline-flex items-center gap-1.5 text-[12.5px]"><MessageSquare className="size-3.5" aria-hidden />{fa ? 'گفتگوی خرید' : 'Open the chat'}</Link>
						) : <span />}
						{purchase.paymentId ? <PaymentHandledButton paymentId={purchase.paymentId} handled={!waiting} /> : null}
					</div>
				) : null}
			</div>
		</article>
	)
}
