'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ArrowLeft, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { BankCardFace } from '@/components/payments/bank-card'
import { CardsManager } from '@/components/payments/cards-manager'
import { DeviceSetup, TestTransfer } from '@/components/payments/device-setup'
import { cn } from '@/lib/utils'
import type { GatewayCardRow, GatewayDeviceRow } from '@/lib/payments/card/dashboard'
import { GATEWAY_SETUP_STEPS, type GatewaySetupStep } from '@/lib/payments/card/setup'

const COPY: Record<GatewaySetupStep, { tab: [string, string]; title: [string, string]; body: [string, string]; eta: [string, string] }> = {
	card: {
		tab: ['کارت مقصد', 'Destination card'],
		title: ['کارتی که مشتری‌ها به آن واریز می‌کنند', 'The card your customers transfer to'],
		body: ['شماره کارت و نام صاحب کارت. بانک از روی شماره شناخته می‌شود.', 'The card number and the cardholder’s name. The bank is recognised from the number.'],
		eta: ['حدود ۳۰ ثانیه', 'About 30 seconds'],
	},
	phone: {
		tab: ['گوشی دریافت پیامک', 'SMS phone'],
		title: ['پیامک واریز بانک باید به ویجنت برسد', 'The bank’s deposit SMS must reach Vigent'],
		body: ['سه سؤال کوتاه، بعد راهنمای قدم‌به‌قدم همان گوشی. وقتی اولین پیام از گوشی برسد این قدم خودش تیک می‌خورد.', 'Three short questions, then the step-by-step guide for that phone. This step ticks itself when the phone’s first message arrives.'],
		eta: ['حدود ۳ دقیقه', 'About 3 minutes'],
	},
	test: {
		tab: ['واریز آزمایشی', 'Test transfer'],
		title: ['یک واریز کوچک بزنید تا مطمئن شویم', 'Make one small transfer to be sure'],
		body: ['از یک کارت دیگر، دقیقاً همین مبلغ را به کارتتان بزنید. وقتی پیامکش برسد، این قدم خودش سبز می‌شود.', 'From another card, transfer exactly this amount to yours. When its SMS arrives this step turns green by itself.'],
		eta: ['حدود ۱ دقیقه', 'About 1 minute'],
	},
	switch: {
		tab: ['روشن کردن درگاه', 'Switch it on'],
		title: ['همه چیز آماده است؛ درگاه را روشن کنید', 'All set; switch the gateway on'],
		body: ['از این لحظه ایجنت بعد از تأیید هر سفارش، کارت و مبلغ دقیق را می‌فرستد و واریز را خودش تأیید می‌کند.', 'From now on the agent sends your card and the exact amount for every confirmed order and confirms the transfer by itself.'],
		eta: ['یک کلیک', 'One click'],
	},
}

/**
 * The gateway's setup on the «پرداخت‌ها» tab: four steps, one at a time,
 * each doing its job in place (add the card, connect the phone, make the
 * test transfer, switch on). Done steps tick themselves from the server's
 * answer, and the wizard leaves the page once all four are done.
 */
export function GatewaySetup({
	done,
	current,
	cards,
	devices,
	inboundLines,
	platformEnabled,
}: {
	done: Record<GatewaySetupStep, boolean>
	current: GatewaySetupStep
	cards: GatewayCardRow[]
	devices: GatewayDeviceRow[]
	inboundLines: string[]
	platformEnabled: boolean
}) {
	const fa = useLocale() !== 'en'
	const at = fa ? 0 : 1
	const numbers = fa ? 'fa-IR' : 'en-US'
	const router = useRouter()
	const [view, setView] = useState<GatewaySetupStep>(current)
	const [switching, setSwitching] = useState(false)
	const [error, setError] = useState<string | null>(null)
	// A step finished on the server moves the wizard on.
	useEffect(() => setView(current), [current])

	const index = GATEWAY_SETUP_STEPS.indexOf(view)
	const copy = COPY[view]
	const activeCards = cards.filter((card) => card.active)
	const doneCount = GATEWAY_SETUP_STEPS.filter((step) => done[step]).length

	async function switchOn() {
		setSwitching(true)
		setError(null)
		try {
			const response = await fetch('/api/payments/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) })
			if (!response.ok) {
				setError(fa ? 'روشن نشد؛ اول یک کارت فعال لازم است.' : 'Not switched on; an active card is needed first.')
				return
			}
			router.refresh()
		} catch {
			setError(fa ? 'روشن نشد؛ دوباره تلاش کنید.' : 'Not switched on; try again.')
		} finally {
			setSwitching(false)
		}
	}

	return (
		<section aria-labelledby="gateway-setup-title" className="spatial-surface overflow-hidden rounded-card shadow-[0_1px_2px_rgba(17,17,17,.04),0_10px_28px_-14px_rgba(17,17,17,.16)]">
			<div className="px-4 pt-4 sm:px-5 sm:pt-5">
				<h2 id="gateway-setup-title" className="text-lg font-bold text-[var(--text-primary)]">{fa ? 'راه‌اندازی درگاه پرداخت' : 'Set up the payment gateway'}</h2>
				<p className="mt-0.5 text-[13px] leading-6 text-[var(--text-secondary)]">{fa ? 'چهار قدم، حدود ۵ دقیقه. هر جا بمانید، دفعهٔ بعد از همان‌جا ادامه می‌دهید.' : 'Four steps, about 5 minutes. Wherever you stop, you pick up from there next time.'}</p>
			</div>

			{/* Desktop: the four steps as a rail. Phones: the current step and a bar. */}
			<ol className="hidden grid-cols-4 gap-2 px-5 py-4 sm:grid">
				{GATEWAY_SETUP_STEPS.map((step, position) => {
					const isDone = done[step]
					const isView = view === step
					return (
						<li key={step}>
							<button type="button" onClick={() => setView(step)} aria-current={isView ? 'step' : undefined} className="grid w-full gap-2 rounded-lg text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
								<span className="h-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
									<span className={cn('block h-full rounded-full transition-[width] duration-500', isDone ? 'w-full bg-emerald-600' : isView ? 'w-1/2 bg-[#5b3de8]' : 'w-0')} />
								</span>
								<span className={cn('flex items-center gap-2 text-[13px]', isDone || isView ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>
									<span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] text-[11.5px] font-bold', isDone ? 'border-emerald-600 bg-emerald-600 text-white' : isView ? 'border-[#5b3de8] bg-[#5b3de8] text-white shadow-[0_0_0_4px_#f1eeff] dark:shadow-[0_0_0_4px_rgba(91,61,232,.25)]' : 'border-[var(--border-strong)] bg-white dark:bg-neutral-900')}>
										{isDone ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : (position + 1).toLocaleString(numbers)}
									</span>
									{COPY[step].tab[at]}
									{isDone ? <span className="sr-only">{fa ? '(انجام شده)' : '(done)'}</span> : null}
								</span>
							</button>
						</li>
					)
				})}
			</ol>
			<div className="px-4 pt-4 sm:hidden">
				<div className="flex items-center justify-between text-[12.5px]">
					<b className="text-[var(--text-primary)]">{copy.tab[at]}</b>
					<span className="text-[var(--text-muted)]">{fa ? `قدم ${(index + 1).toLocaleString(numbers)} از ۴` : `Step ${index + 1} of 4`}</span>
				</div>
				<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
					<span className="block h-full rounded-full bg-[#5b3de8] transition-[width] duration-500" style={{ width: `${Math.max(8, (doneCount / 4) * 100)}%` }} />
				</div>
			</div>

			<div className="mt-4 grid gap-4 border-t border-[var(--border-subtle)] bg-gradient-to-b from-[var(--bg-surface)] to-transparent px-4 py-5 sm:mt-0 sm:px-5">
				<div>
					<p className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
						{fa ? `قدم ${(index + 1).toLocaleString(numbers)} از ۴` : `Step ${index + 1} of 4`} · <Clock className="size-3.5" aria-hidden />{copy.eta[at]}
					</p>
					<h3 className="mt-1 text-[18px] font-extrabold leading-8 text-[var(--text-primary)]">{copy.title[at]}</h3>
					<p className="max-w-2xl text-[13.5px] leading-7 text-[var(--text-secondary)]">{copy.body[at]}</p>
				</div>

				{view === 'card' && (done.card ? (
					<div className="grid gap-3 sm:grid-cols-[minmax(0,17rem)_1fr] sm:items-center">
						<BankCardFace bankKey={activeCards[0].bankKey} pan={`${activeCards[0].bin.slice(0, 4)} ${activeCards[0].bin.slice(4)}•• •••• ${activeCards[0].last4}`} holder={activeCards[0].holderName} lang={fa ? 'fa' : 'en'} size="sm" />
						<div className="grid gap-2 text-[13px]">
							<p className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300"><Check className="size-4" aria-hidden />{fa ? `${activeCards.length.toLocaleString(numbers)} کارت فعال اضافه شده` : `${activeCards.length} active card(s) added`}</p>
							<Link href="/payments/cards" className="ui-link w-fit">{fa ? 'افزودن یا مدیریت کارت‌ها' : 'Add or manage cards'}</Link>
						</div>
					</div>
				) : <CardsManager cards={[]} />)}

				{view === 'phone' && (
					<DeviceSetup devices={devices} inboundLines={inboundLines} hasCard={done.card} cardBanks={[...new Set(activeCards.map((card) => card.bankKey))]} />
				)}

				{view === 'test' && (done.phone || done.test
					? <TestTransfer verified={done.test} hasCard={done.card} />
					: <p className="text-[13.5px] text-[var(--text-muted)]">{fa ? 'اول گوشی دریافت پیامک را وصل کنید؛ واریز آزمایشی از روی پیامک همان گوشی تأیید می‌شود.' : 'Connect the SMS phone first; the test transfer is confirmed from that phone’s SMS.'}</p>)}

				{view === 'switch' && (
					<div className="grid max-w-xl gap-3">
						<div className={cn('flex items-center gap-4 rounded-2xl border p-4', done.switch ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40' : 'border-[var(--border-default)] bg-white dark:bg-neutral-900')}>
							<Switch checked={done.switch} pending={switching} disabled={switching || done.switch || !done.card || !platformEnabled} onChange={(next) => { if (next) void switchOn() }} aria-label={fa ? 'روشن کردن درگاه پرداخت' : 'Switch the payment gateway on'} />
							<div className="min-w-0">
								<p className="text-[14px] font-bold text-[var(--text-primary)]">{done.switch ? (fa ? 'درگاه روشن است' : 'The gateway is on') : (fa ? 'درگاه پرداخت خاموش است' : 'The payment gateway is off')}</p>
								<p className="text-[12.5px] text-[var(--text-muted)]">{!platformEnabled ? (fa ? 'درگاه موقتاً از طرف ویجنت در دسترس نیست.' : 'The gateway is temporarily unavailable.') : done.card ? (fa ? 'برای روشن کردن بزنید' : 'Tap to switch it on') : (fa ? 'اول یک کارت اضافه کنید' : 'Add a card first')}</p>
							</div>
						</div>
						<ul className="grid gap-1.5 text-[13px]">
							{(['card', 'phone', 'test'] as const).map((step) => (
								<li key={step} className={cn('flex items-center gap-2', done[step] ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]')}>
									<span className={cn('grid size-4 place-items-center rounded-full', done[step] ? 'bg-emerald-600 text-white' : 'border border-[var(--border-strong)]')}>{done[step] ? <Check className="size-2.5" strokeWidth={3.5} aria-hidden /> : null}</span>
									{COPY[step].tab[at]}
									{!done[step] ? <button type="button" className="ui-link text-[12.5px]" onClick={() => setView(step)}>{fa ? 'انجام بدهید' : 'Do it'}</button> : null}
								</li>
							))}
						</ul>
						{!done.test && done.card ? <p className="text-[12.5px] leading-6 text-amber-800 dark:text-amber-200">{fa ? 'می‌توانید همین حالا روشنش کنید؛ ولی تا گوشی وصل نشود، پرداخت‌ها برای تأیید دستی به شما می‌رسند.' : 'You can switch it on now, but until the phone is connected payments come to you to confirm by hand.'}</p> : null}
						{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
					</div>
				)}

				<div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
					{index < 3 && (
						<Button variant={done[view] ? 'primary' : 'ghost'} onClick={() => setView(GATEWAY_SETUP_STEPS[index + 1])}>
							{done[view] ? (fa ? `قدم بعد: ${COPY[GATEWAY_SETUP_STEPS[index + 1]].tab[0]}` : `Next: ${COPY[GATEWAY_SETUP_STEPS[index + 1]].tab[1]}`) : (fa ? 'فعلاً رد شو' : 'Skip for now')}
							<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
						</Button>
					)}
					{index > 0 && <Button variant="ghost" onClick={() => setView(GATEWAY_SETUP_STEPS[index - 1])}>{fa ? 'قبلی' : 'Back'}</Button>}
				</div>
			</div>
		</section>
	)
}
