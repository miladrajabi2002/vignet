'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCheck, MessageSquareText, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BankCardFace } from '@/components/payments/bank-card'

const STEP_MS = 2100
const STEPS = 6

/**
 * «نمای کلی»: how a card-to-card payment confirms itself, as a short loop on
 * the business's own card — the customer asks to pay, the agent sends the card
 * with the exact amount, the bank's deposit SMS reaches Vigent, it matches and
 * the customer is told. Decorative (aria-hidden); every element keeps its box
 * from the first paint and only opacity/transform change. Plays only while on
 * screen; with reduced motion it shows the finished frame.
 */
export function GatewayFlowMotion({
	bankKey,
	pan,
	holder,
	amount,
	lang,
	className,
}: {
	bankKey: string
	/** Masked for display. */
	pan: string
	holder: string | null
	/** Whole tomans, the exact amount with its identifier. */
	amount: number
	lang: 'fa' | 'en'
	className?: string
}) {
	const fa = lang !== 'en'
	const root = useRef<HTMLDivElement>(null)
	const [step, setStep] = useState(STEPS - 1)
	const [playing, setPlaying] = useState(false)

	useEffect(() => {
		const node = root.current
		if (!node) return
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		const observer = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting && document.visibilityState === 'visible'), { threshold: 0.35 })
		observer.observe(node)
		const onVisibility = () => setPlaying(document.visibilityState === 'visible' && node.getBoundingClientRect().top < window.innerHeight)
		document.addEventListener('visibilitychange', onVisibility)
		return () => {
			observer.disconnect()
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, [])

	useEffect(() => {
		if (!playing) return
		setStep(0)
		const timer = window.setInterval(() => setStep((current) => (current + 1) % STEPS), STEP_MS)
		return () => window.clearInterval(timer)
	}, [playing])

	const shown = (from: number) => step >= from
	const rial = (amount * 10).toLocaleString('en-US')
	const tomans = amount.toLocaleString('en-US')
	const tail = tomans.slice(-3)
	const head = tomans.slice(0, -3)
	const reveal = (from: number) => cn('transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none', shown(from) ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0')

	return (
		<div ref={root} aria-hidden dir={fa ? 'rtl' : 'ltr'} className={cn('grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]', className)}>
			{/* The chat */}
			<div className="flex min-h-[15.5rem] flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
				<div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-muted)]"><MessageSquareText className="size-3.5" aria-hidden />{fa ? 'گفتگو با مشتری' : 'Customer chat'}</div>
				<div className={cn(reveal(0), 'max-w-[85%] self-start rounded-2xl rounded-ss-md bg-white px-3 py-1.5 text-[12.5px] leading-6 text-[var(--text-primary)] shadow-sm ltr:self-end dark:bg-neutral-800')}>
					{fa ? 'همینو می‌خوام، کارت‌به‌کارت می‌کنم' : 'I’ll take it — paying card to card'}
				</div>
				<div className={cn(reveal(1), 'flex w-[min(15.5rem,100%)] flex-col gap-1.5 self-end rounded-2xl border border-[var(--border-subtle)] bg-white p-2 shadow-sm ltr:self-start dark:bg-neutral-900')}>
					<BankCardFace bankKey={bankKey} pan={pan} holder={holder} lang={lang} size="sm" />
					<div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-2 py-1 text-[11.5px]">
						<span className="text-[var(--text-muted)]">{fa ? 'مبلغ دقیق (تومان)' : 'Exact amount'}</span>
						<b dir="ltr" className="font-mono text-[var(--text-primary)]">{head}<span className={cn('rounded px-0.5 transition-colors duration-500', shown(3) ? 'bg-[#ede9fe] text-[#5b3de8]' : '')}>{tail}</span></b>
					</div>
				</div>
				<div className={cn(reveal(4), 'mt-auto max-w-[85%] self-end rounded-2xl rounded-se-md bg-[var(--text-primary)] px-3 py-1.5 text-[12.5px] leading-6 text-white ltr:self-start dark:text-neutral-900')}>
					{fa ? 'پرداختتون رسید ✅ سفارش تأیید شد' : 'Payment received ✅ order confirmed'}
				</div>
			</div>

			{/* The owner's phone */}
			<div className="relative flex min-h-[15.5rem] flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-b from-[#f6f5ff] to-white p-3 dark:from-neutral-900 dark:to-neutral-950">
				<div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-muted)]"><Smartphone className="size-3.5" aria-hidden />{fa ? 'گوشی شما' : 'Your phone'}</div>
				<div className={cn(reveal(2), 'rounded-xl border border-white/70 bg-white/90 p-2.5 text-[11.5px] leading-5 shadow-[0_12px_28px_-18px_rgba(17,17,17,.45)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-800/90')}>
					<div className="mb-1 flex items-center justify-between text-[10.5px] text-[var(--text-muted)]"><span>{fa ? 'پیامک بانک' : 'Bank SMS'}</span><span dir="ltr">{fa ? 'همین حالا' : 'now'}</span></div>
					<div dir="rtl" className="font-mono text-[var(--text-primary)]">{fa ? 'واریز' : 'Deposit'} <b dir="ltr">{rial}</b></div>
					<div dir="rtl" className="font-mono text-[var(--text-muted)]">{fa ? 'مانده' : 'Balance'} •••</div>
				</div>
				<div className={cn(reveal(2), 'flex items-center gap-1.5 self-center text-[11px] text-[var(--text-muted)]')}>
					<span className={cn('size-1.5 rounded-full bg-[#5b3de8]', shown(2) && !shown(3) ? 'animate-ping motion-reduce:animate-none' : '')} />
					{fa ? 'فوروارد خودکار به ویجنت' : 'Forwarded to Vigent'}
				</div>
				<div className={cn(reveal(3), 'flex items-center justify-between gap-2 rounded-xl border border-[#d9d2ff] bg-white px-2.5 py-2 text-[12px] dark:border-[#3b2f80] dark:bg-neutral-900')}>
					<span className="text-[var(--text-secondary)]">{fa ? 'تطبیق با پرداخت باز' : 'Matched to the open payment'}</span>
					<span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-bold text-[#5b3de8]">{fa ? 'یکی است' : 'Exact'}</span>
				</div>
				<div className={cn(reveal(4), 'mt-auto flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[12.5px] font-bold text-white')}>
					<CheckCheck className="size-4" aria-hidden />
					{fa ? 'تأیید خودکار — بدون چک کردن حساب' : 'Confirmed — nobody checked the account'}
				</div>
			</div>
		</div>
	)
}
