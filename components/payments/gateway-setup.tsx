'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ArrowLeft, Check, Clock, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { BankCardFace } from '@/components/payments/bank-card'
import { CardsManager } from '@/components/payments/cards-manager'
import { DeviceSetup, StepFooter, TestTransfer } from '@/components/payments/device-setup'
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
		body: ['نوع گوشی، یک پیامک واریز نمونه، روش ارسال و شماره؛ بعد راهنمای قدم‌به‌قدم تنظیم همان گوشی.', 'The phone type, a sample deposit SMS, the delivery and the number; then the step-by-step guide for that phone.'],
		eta: ['حدود ۳ دقیقه', 'About 3 minutes'],
	},
	test: {
		tab: ['واریز آزمایشی', 'Test transfer'],
		title: ['یک واریز کوچک؛ همین، اتصال گوشی است', 'One small transfer; that is the phone’s connection'],
		body: ['یک تراکنش ۱۰٬۰۰۰ تومانی بسازید و از کارت دیگری همان مبلغ را به کارت خودتان بزنید. وقتی پیامکش از گوشی برسد، هم گوشی وصل شده و هم این قدم سبز می‌شود.', 'Create a 10,000-toman transaction and pay it from another card into yours. When its SMS arrives through the phone, the phone is connected and this step turns green.'],
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
 * The gateway's setup, the only thing on «درگاه پرداخت» until it is done:
 * four steps in order, each doing its job in place (add the card, connect
 * the phone, make the test transfer, switch on). A step opens only after
 * the one before it; done steps tick themselves from the server's answer,
 * and once all four are done the page turns into the gateway's tabs.
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
	// A step finished on the server moves the wizard on; a phone just
	// registered stays on its guide until the owner moves on from it.
	useEffect(() => setView((shown) => (shown === 'phone' && current === 'test' ? shown : current)), [current])

	const index = GATEWAY_SETUP_STEPS.indexOf(view)
	const copy = COPY[view]
	const activeCards = cards.filter((card) => card.active)
	// Steps up to the first unfinished one are open; the rest wait their turn.
	const reachable = (step: GatewaySetupStep) => GATEWAY_SETUP_STEPS.indexOf(step) <= GATEWAY_SETUP_STEPS.indexOf(current)
	const doneCount = GATEWAY_SETUP_STEPS.filter((step) => done[step]).length

	async function switchOn() {
		setSwitching(true)
		setError(null)
		try {
			const response = await fetch('/api/payments/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) })
			if (!response.ok) {
				setError(fa ? 'روشن نشد؛ اول سه قدم قبلی را کامل کنید.' : 'Not switched on; finish the three steps before it first.')
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
				<p className="mt-0.5 text-[13px] leading-6 text-[var(--text-secondary)]">{fa ? 'چهار قدم پشت سر هم، حدود ۵ دقیقه. بخش‌های دیگر درگاه بعد از این چهار قدم باز می‌شوند؛ هر جا بمانید، دفعهٔ بعد از همان‌جا ادامه می‌دهید.' : 'Four steps in order, about 5 minutes. The gateway’s other sections open after them; wherever you stop, you pick up from there next time.'}</p>
			</div>

			{/* Desktop: the four steps as a rail. Phones: the current step and a bar. */}
			<ol className="hidden grid-cols-4 gap-2 px-5 py-4 sm:grid">
				{GATEWAY_SETUP_STEPS.map((step, position) => {
					const isDone = done[step]
					const isView = view === step
					const locked = !reachable(step)
					return (
						<li key={step}>
							<button type="button" disabled={locked} onClick={() => setView(step)} aria-current={isView ? 'step' : undefined} title={locked ? (fa ? 'بعد از قدم قبلی باز می‌شود' : 'Opens after the step before it') : undefined} className="grid w-full gap-2 rounded-lg text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed">
								<span className="h-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
									<span className={cn('block h-full rounded-full transition-[width] duration-500', isDone ? 'w-full bg-[var(--text-primary)]' : isView ? 'w-1/2 bg-[var(--text-primary)]' : 'w-0')} />
								</span>
								<span className={cn('flex items-center gap-2 text-[13px]', isDone || isView ? 'font-bold text-[var(--text-primary)]' : locked ? 'text-[var(--text-hint)]' : 'text-[var(--text-muted)]')}>
									<span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] text-[11.5px] font-bold', isDone ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]' : isView ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[0_0_0_4px_var(--bg-muted)]' : 'border-[var(--border-strong)] bg-white dark:bg-neutral-900')}>
										{isDone ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : (position + 1).toLocaleString(numbers)}
									</span>
									{COPY[step].tab[at]}
									{locked ? <Lock className="size-3 text-[var(--text-hint)]" aria-hidden /> : null}
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
					<span className="block h-full rounded-full bg-[var(--text-primary)] transition-[width] duration-500" style={{ width: `${Math.max(8, (doneCount / 4) * 100)}%` }} />
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
							<p className="text-[12.5px] leading-6 text-[var(--text-muted)]">{fa ? 'کارت‌های بیشتر را بعد از راه‌اندازی از بخش «کارت‌ها» اضافه کنید.' : 'Add more cards from «Cards» once setup is done.'}</p>
						</div>
					</div>
				) : <CardsManager cards={[]} />)}

				{view === 'phone' && (
					<DeviceSetup
						devices={devices}
						inboundLines={inboundLines}
						hasCard={done.card}
						inSetup
						// The phone step owns the bar: its own pages first, then the setup's steps.
						exits={{
							back: { label: fa ? `قبلی: ${COPY.card.tab[0]}` : `Back: ${COPY.card.tab[1]}`, onClick: () => setView('card') },
							next: { label: fa ? `بعدی: ${COPY.test.tab[0]}` : `Next: ${COPY.test.tab[1]}`, onClick: () => setView('test'), ready: done.phone },
						}}
					/>
				)}

				{view === 'test' && (done.phone || done.test
					? <TestTransfer verified={done.test} hasCard={done.card} />
					: <p className="text-[13.5px] text-[var(--text-muted)]">{fa ? 'اول گوشی دریافت پیامک را وصل کنید؛ واریز آزمایشی از روی پیامک همان گوشی تأیید می‌شود.' : 'Connect the SMS phone first; the test transfer is confirmed from that phone’s SMS.'}</p>)}

				{view === 'switch' && (
					<div className="grid max-w-xl gap-3">
						<div className={cn('flex items-center gap-4 rounded-2xl border p-4', done.switch ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40' : 'border-[var(--border-default)] bg-white dark:bg-neutral-900')}>
							<Switch checked={done.switch} pending={switching} disabled={switching || done.switch || !done.card || !done.phone || !done.test || !platformEnabled} onChange={(next) => { if (next) void switchOn() }} aria-label={fa ? 'روشن کردن درگاه پرداخت' : 'Switch the payment gateway on'} />
							<div className="min-w-0">
								<p className="text-[14px] font-bold text-[var(--text-primary)]">{done.switch ? (fa ? 'درگاه روشن است' : 'The gateway is on') : (fa ? 'درگاه پرداخت خاموش است' : 'The payment gateway is off')}</p>
								<p className="text-[12.5px] text-[var(--text-muted)]">{!platformEnabled ? (fa ? 'درگاه موقتاً از طرف ویجنت در دسترس نیست.' : 'The gateway is temporarily unavailable.') : done.card && done.phone && done.test ? (fa ? 'برای روشن کردن بزنید' : 'Tap to switch it on') : (fa ? 'اول سه قدم قبلی را کامل کنید' : 'Finish the three steps before it first')}</p>
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
						{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
					</div>
				)}

				{view !== 'phone' && (() => {
					const previous = index > 0 ? GATEWAY_SETUP_STEPS[index - 1] : null
					const following = index < 3 ? GATEWAY_SETUP_STEPS[index + 1] : null
					return (
						<StepFooter
							back={previous ? { label: fa ? `قبلی: ${COPY[previous].tab[0]}` : `Back: ${COPY[previous].tab[1]}`, onClick: () => setView(previous) } : null}
							next={following ? (
								<Button onClick={() => setView(following)} disabled={!done[view]}>
									{fa ? `بعدی: ${COPY[following].tab[0]}` : `Next: ${COPY[following].tab[1]}`}
									<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
								</Button>
							) : null}
							hint={following && !done[view] ? (fa ? 'قدم بعد وقتی باز می‌شود که این قدم کامل شود.' : 'The next step opens once this one is done.') : null}
						/>
					)
				})()}
			</div>
		</section>
	)
}
