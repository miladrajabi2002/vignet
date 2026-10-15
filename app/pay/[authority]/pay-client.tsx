'use client'

import { useCallback, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { CardPayCardView } from '@/components/commerce/card-pay-view'
import type { CardPayStatus, CardPayView } from '@/lib/payments/card/pay-card'

export function PayPageClient({
	card,
	business,
	description,
	baseAmount,
	hasReturn,
}: {
	card: CardPayView
	business: string
	description: string | null
	baseAmount: number
	hasReturn: boolean
}) {
	const [status, setStatus] = useState<CardPayStatus>(card.status)

	const onStatus = useCallback(async (next: CardPayStatus) => {
		setStatus(next)
		if (next !== 'PAID' || !hasReturn) return
		try {
			const response = await fetch(`/api/pay/status/${card.authority}`, { cache: 'no-store' })
			const data = (await response.json()) as { returnUrl?: string | null }
			if (!data.returnUrl) return
			const target = new URL(data.returnUrl)
			target.searchParams.set('authority', card.authority)
			target.searchParams.set('order_id', card.code)
			target.searchParams.set('status', 'paid')
			window.setTimeout(() => window.location.assign(target.toString()), 2500)
		} catch { /* the customer stays on the confirmed page */ }
	}, [card.authority, card.code, hasReturn])

	return (
		<main dir="rtl" className="flex min-h-dvh flex-col items-center bg-[var(--bg-base,#f5f5f3)] px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] text-[var(--text-primary,#111)]">
			<div className="flex w-full max-w-[380px] flex-col items-center gap-4">
				<header className="flex w-full flex-col gap-1 text-center">
					<h1 className="text-[20px] font-bold leading-9">{business}</h1>
					<p className="text-[13.5px] leading-7 text-[var(--text-secondary,#55524c)]">
						{description ? `${description} · ` : ''}مبلغ سفارش {baseAmount.toLocaleString('fa-IR')} تومان
					</p>
				</header>
				<CardPayCardView card={card} accent="#111111" onAccent="#ffffff" onStatus={onStatus} />
				{status === 'PAID' && hasReturn && <p className="text-center text-[13px] leading-7 text-[var(--text-secondary,#55524c)]">در حال بازگشت به سایت فروشگاه…</p>}
				{(status === 'PENDING' || status === 'CLAIMED') && (
					<ol className="flex w-full flex-col gap-2 rounded-[20px] border border-[var(--border-default,rgba(17,17,17,.09))] bg-white p-4 text-[13px] leading-7 text-[var(--text-secondary,#55524c)]">
						<li>۱. شماره کارت و مبلغ را با دکمهٔ «کپی» بردارید.</li>
						<li>۲. در همراه‌بانک خودتان کارت‌به‌کارت کنید؛ مبلغ دقیقاً همین باشد.</li>
						<li>۳. همین صفحه باز بماند؛ با رسیدن واریز خودش تأیید می‌شود.</li>
					</ol>
				)}
				<p className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted,#6f6a64)]">
					<ShieldCheck className="size-4" aria-hidden />
					پول مستقیم به حساب {business} واریز می‌شود · تأیید خودکار با ویجنت
				</p>
			</div>
		</main>
	)
}
