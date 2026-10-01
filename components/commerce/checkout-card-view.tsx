'use client'

import type { CheckoutCard } from '@/lib/commerce/checkout-card'

function money(value: number, lang: 'fa' | 'en'): string {
	return lang === 'en'
		? `${Math.round(value).toLocaleString('en-US')} Toman`
		: `${Math.round(value).toLocaleString('fa-IR')} تومان`
}

/**
 * In-chat checkout card: the cart lines, shipping, total and one pay button
 * that opens the store's own payment page in a new tab.
 */
export function CheckoutCardView({ card, accent, onAccent }: { card: CheckoutCard; accent: string; onAccent: string }) {
	const fa = card.lang !== 'en'
	const rows: Array<{ label: string; value: string; tone?: 'muted' | 'total' }> = card.items.map((item) => ({
		label: `${item.name}${item.variant ? ` — ${item.variant}` : ''} × ${item.quantity.toLocaleString(fa ? 'fa-IR' : 'en-US')}`,
		value: item.lineTotal != null ? money(item.lineTotal, card.lang) : '',
	}))
	if (card.shipping) {
		rows.push({
			label: `${fa ? 'ارسال' : 'Shipping'} — ${card.shipping.label}`,
			value: card.shipping.cost > 0 ? money(card.shipping.cost, card.lang) : fa ? 'رایگان' : 'Free',
			tone: 'muted',
		})
	}
	if (card.discount) rows.push({ label: fa ? 'تخفیف' : 'Discount', value: `−${money(card.discount, card.lang)}`, tone: 'muted' })
	if (card.total != null) rows.push({ label: fa ? 'قابل پرداخت' : 'To pay', value: money(card.total, card.lang), tone: 'total' })

	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className="w-full max-w-[340px] rounded-3xl border border-[var(--border-default,#e5e7eb)] bg-white p-4 shadow-[0_12px_32px_-20px_rgba(0,0,0,.35)] dark:bg-neutral-900"
		>
			<div className="mb-2 flex flex-col gap-0.5">
				<span className="text-[14px] font-extrabold text-neutral-900 dark:text-neutral-50">
					{fa ? 'سفارش' : 'Order'} {card.code}
				</span>
				<span className="text-[11.5px] text-neutral-500">
					{fa ? 'پرداخت امن روی' : 'Secure payment on'} {card.storeHost}
				</span>
			</div>
			<div className="divide-y divide-neutral-100 dark:divide-neutral-800">
				{rows.map((row, index) => (
					<div
						key={index}
						className={`flex justify-between gap-3 py-2 text-[12.5px] leading-6 ${
							row.tone === 'total'
								? 'font-extrabold text-neutral-900 dark:text-neutral-50'
								: row.tone === 'muted'
									? 'text-neutral-500'
									: 'text-neutral-800 dark:text-neutral-200'
						}`}
					>
						<span className="min-w-0 [overflow-wrap:anywhere]">{row.label}</span>
						<span className="shrink-0 tabular-nums">{row.value}</span>
					</div>
				))}
			</div>
			<a
				href={card.url}
				target="_blank"
				rel="noopener noreferrer"
				className="mt-3 flex min-h-[46px] items-center justify-center rounded-2xl text-[14px] font-extrabold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
				style={{ backgroundColor: accent, color: onAccent }}
			>
				{fa ? 'پرداخت و ثبت سفارش' : 'Pay and place order'}
			</a>
		</div>
	)
}
