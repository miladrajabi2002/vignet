'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { Headset, Loader2, Lock, Shuffle, Store, WalletCards } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChatPaymentMethod = 'operator' | 'card' | 'site' | 'both'

export function chatPaymentMethod(flags: { cardPayEnabled: boolean; payLinkEnabled: boolean }): ChatPaymentMethod {
	if (flags.cardPayEnabled && flags.payLinkEnabled) return 'both'
	if (flags.cardPayEnabled) return 'card'
	if (flags.payLinkEnabled) return 'site'
	return 'operator'
}

/**
 * How one agent takes payment for an order it took in chat — a single choice
 * instead of separate switches, shown the same way on the agent's page, in
 * «درگاه پرداخت › تنظیمات» and in the WooCommerce tab.
 */
export function PaymentMethodPicker({
	agentId,
	initial,
	gatewayReady,
	store,
	disabledReason,
	onChange,
	compact = false,
}: {
	agentId: string
	initial: { cardPayEnabled: boolean; payLinkEnabled: boolean }
	/** The payment gateway is on and has an active card. */
	gatewayReady: boolean
	/** Connected WooCommerce store; `ready` once its plugin takes payments. */
	store: { host: string; ready: boolean } | null
	/** The whole choice is locked (e.g. the agent does not take orders in chat). */
	disabledReason?: string
	onChange?: (flags: { cardPayEnabled: boolean; payLinkEnabled: boolean }) => void
	compact?: boolean
}) {
	const fa = useLocale() !== 'en'
	const [flags, setFlags] = useState(initial)
	const [saving, setSaving] = useState<ChatPaymentMethod | null>(null)
	const [error, setError] = useState(false)
	const current = chatPaymentMethod(flags)

	const options: Array<{ key: ChatPaymentMethod; icon: typeof Store; title: string; body: string; locked?: { text: string; href: string; cta: string } }> = [
		{
			key: 'operator',
			icon: Headset,
			title: fa ? 'هماهنگی با اپراتور' : 'Arranged by your operator',
			body: fa ? 'سفارش در «درخواست‌های چت» ثبت می‌شود و همکار شما پرداخت و ارسال را با مشتری هماهنگ می‌کند.' : 'The order is filed in chat requests and your colleague arranges payment and delivery with the customer.',
		},
		{
			key: 'card',
			icon: WalletCards,
			title: fa ? 'درگاه پرداخت ویجنت (کارت‌به‌کارت خودکار)' : 'Vigent payment gateway (automatic card-to-card)',
			body: fa ? 'ایجنت کارت شما و مبلغ دقیق را می‌فرستد و واریز از روی پیامک بانک خودکار تأیید می‌شود. سایت لازم ندارد.' : 'The agent sends your card and the exact amount, and the transfer is confirmed automatically from the bank SMS. No website needed.',
			locked: gatewayReady ? undefined : { text: fa ? 'اول درگاه پرداخت را راه‌اندازی کنید.' : 'Set up the payment gateway first.', href: '/payments', cta: fa ? 'راه‌اندازی درگاه' : 'Set up the gateway' },
		},
		...(store
			? [{
					key: 'site' as const,
					icon: Store,
					title: fa ? `پرداخت روی سایت ${store.host}` : `Payment on ${store.host}`,
					body: fa ? 'ایجنت لینک پرداخت همان سبد را روی سایت ووکامرسی شما می‌فرستد و مشتری با درگاه‌های خود سایت پرداخت می‌کند.' : 'The agent sends a payment link for the same cart on your WooCommerce site and the customer pays with the site’s own gateways.',
					locked: store.ready ? undefined : { text: fa ? 'افزونهٔ ویجنت روی سایت باید به‌روز شود.' : 'The Vigent plugin on the site needs an update.', href: '/store', cta: fa ? 'دیدن وضعیت سایت' : 'See the store' },
				},
				{
					key: 'both' as const,
					icon: Shuffle,
					title: fa ? 'هر دو؛ مشتری انتخاب کند' : 'Both; the customer chooses',
					body: fa ? 'لینک پرداخت سایت فرستاده می‌شود و اگر مشتری بگوید «کارت به کارت»، کارت و مبلغ دقیق را می‌گیرد.' : 'The site’s payment link is sent, and a customer who says “card to card” gets your card and the exact amount instead.',
					locked: !store.ready
						? { text: fa ? 'افزونهٔ ویجنت روی سایت باید به‌روز شود.' : 'The Vigent plugin on the site needs an update.', href: '/store', cta: fa ? 'دیدن وضعیت سایت' : 'See the store' }
						: gatewayReady ? undefined : { text: fa ? 'اول درگاه پرداخت را راه‌اندازی کنید.' : 'Set up the payment gateway first.', href: '/payments', cta: fa ? 'راه‌اندازی درگاه' : 'Set up the gateway' },
				}]
			: []),
	]

	async function choose(key: ChatPaymentMethod) {
		if (key === current || saving) return
		const next = { cardPayEnabled: key === 'card' || key === 'both', payLinkEnabled: key === 'site' || key === 'both' }
		const previous = flags
		setFlags(next)
		setSaving(key)
		setError(false)
		try {
			const response = await fetch('/api/payments/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: { id: agentId, ...next } }) })
			if (!response.ok) throw new Error('save failed')
			onChange?.(next)
		} catch {
			setFlags(previous)
			setError(true)
		} finally {
			setSaving(null)
		}
	}

	return (
		<div>
			{!compact && (
				<div className="mb-2">
					<h3 className="text-xs font-semibold text-[var(--text-muted)]">{fa ? 'پرداخت سفارش‌های چت' : 'Payment for chat orders'}</h3>
					<p className="mt-1 max-w-3xl text-xs leading-6 text-[var(--text-secondary)]">{fa ? 'بعد از این‌که مشتری خلاصهٔ سفارش را تأیید کرد، پرداخت چطور انجام شود؟ یکی را انتخاب کنید.' : 'Once the customer confirms the order summary, how is it paid? Choose one.'}</p>
				</div>
			)}
			<div role="radiogroup" aria-label={fa ? 'روش پرداخت سفارش‌های چت' : 'Payment method for chat orders'} className="grid gap-2">
				{options.map((option) => {
					const Icon = option.icon
					const selected = current === option.key
					const locked = Boolean(disabledReason) || Boolean(option.locked)
					return (
						<div key={option.key} className={cn('rounded-2xl border bg-white transition-colors', selected ? 'border-[var(--text-primary)] shadow-[var(--elev-1)]' : 'border-[var(--border-subtle)]')}>
							<button
								type="button"
								role="radio"
								aria-checked={selected}
								disabled={locked && !selected}
								onClick={() => choose(option.key)}
								className="flex w-full items-start gap-3 p-3.5 text-start disabled:cursor-not-allowed disabled:opacity-60"
							>
								<span className={cn('mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl', selected ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--bg-muted)] text-[var(--text-primary)]')}>
									{saving === option.key ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : locked && !selected ? <Lock className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-sm font-bold text-[var(--text-primary)]">{option.title}</span>
									<span className="mt-0.5 block text-[13px] leading-6 text-[var(--text-secondary)]">{option.body}</span>
								</span>
								<span aria-hidden className={cn('mt-1 grid size-[18px] shrink-0 place-items-center rounded-full border-2', selected ? 'border-[var(--text-primary)]' : 'border-[var(--border-strong)]')}>{selected && <span className="size-2 rounded-full bg-[var(--text-primary)]" />}</span>
							</button>
							{option.locked && (
								<p className="flex flex-wrap items-center gap-x-2 border-t border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] text-[var(--text-muted)]">
									{selected ? (fa ? 'انتخاب شده ولی هنوز کار نمی‌کند: ' : 'Selected, but not working yet: ') : ''}{option.locked.text}
									<Link href={option.locked.href} className="ui-link">{option.locked.cta}</Link>
								</p>
							)}
						</div>
					)
				})}
			</div>
			{disabledReason && <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">{disabledReason}</p>}
			{error && <p role="alert" className="mt-2 text-sm text-red-600">{fa ? 'ذخیره نشد؛ دوباره تلاش کنید.' : 'Not saved; try again.'}</p>}
		</div>
	)
}
