import Link from 'next/link'
import { ArrowLeft, WalletCards } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { GatewayFlowMotion } from '@/components/payments/gateway-flow-motion'
import { getPlatformGatewaySettings } from '@/lib/payments/card/platform'
import { receivedTodayByCard } from '@/lib/payments/card/service'

const SAMPLE_AMOUNT = 1_250_347

/**
 * «نمای کلی»: the payment gateway at a glance. Once the gateway is on: the
 * flow animated on the card customers pay into right now, with today's
 * numbers. Before that: the same flow on a sample card and the way in.
 * Silent on a database without the gateway tables.
 */
export async function GatewayOverviewTile({ workspaceId, locale }: { workspaceId: string; locale: 'fa' | 'en' }) {
	const fa = locale !== 'en'
	const data = await (async () => {
		const [workspace, platform] = await Promise.all([
			prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewayEnabled: true, payGatewaySuspendedAt: true } }),
			getPlatformGatewaySettings(),
		])
		if (!platform.enabled || workspace?.payGatewaySuspendedAt) return null
		const cards = await prisma.payCard.findMany({ where: { workspaceId, active: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } })
		if (!workspace?.payGatewayEnabled || !cards.length) return { live: null }
		const [received, pending, review, unmatched, device, last] = await Promise.all([
			receivedTodayByCard(workspaceId),
			prisma.cardPayment.count({ where: { workspaceId, status: 'PENDING' } }),
			prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED' } }),
			prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
			prisma.payDevice.findFirst({ where: { workspaceId, active: true }, orderBy: { lastSmsAt: { sort: 'desc', nulls: 'last' } }, select: { lastSmsAt: true } }),
			prisma.cardPayment.findFirst({ where: { workspaceId, status: 'PAID' }, orderBy: { paidAt: 'desc' }, select: { payAmount: true } }),
		])
		// The card the next payment goes to: least received today.
		const next = cards.reduce((best, card) => ((received.get(card.id) ?? 0) < (received.get(best.id) ?? 0) ? card : best))
		const today = [...received.values()].reduce((sum, value) => sum + value, 0)
		return { live: { next, today, pending, review, unmatched, lastSmsAt: device?.lastSmsAt ?? null, cards: cards.length, amount: last?.payAmount ?? SAMPLE_AMOUNT } }
	})().catch(() => null)
	if (!data) return null
	const numbers = fa ? 'fa-IR' : 'en-US'

	if (!data.live) {
		return (
			<section aria-label={fa ? 'درگاه پرداخت' : 'Payment gateway'} className="spatial-surface grid gap-5 rounded-card p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-center">
				<div className="min-w-0">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-[#ede9fe] px-2.5 py-1 text-[12px] font-bold text-[#5b3de8]"><WalletCards className="size-3.5" aria-hidden />{fa ? 'درگاه پرداخت ویجنت' : 'Vigent payment gateway'}</span>
					<h2 className="mt-2.5 text-[17px] font-extrabold leading-8 text-[var(--text-primary)]">{fa ? 'کارت‌به‌کارت، بدون اینکه شما حساب را چک کنید' : 'Card-to-card, without you checking the account'}</h2>
					<p className="mt-1.5 text-[13.5px] leading-7 text-[var(--text-secondary)]">
						{fa
							? 'ایجنت کارت شما را با یک مبلغ دقیق در گفتگو می‌فرستد؛ پیامک واریز بانک که برسد، سفارش، نوبت یا ثبت‌نام خودکار تأیید می‌شود. بدون درگاه بانکی، اینماد و کد مالیاتی.'
							: 'The agent sends your card with an exact amount in the chat; when the bank’s deposit SMS arrives, the order, booking or sign-up is confirmed by itself. No bank gateway or Enamad needed.'}
					</p>
					<Link href="/payments" className="spatial-press mt-3.5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-4 text-sm font-bold text-white dark:text-neutral-900">
						{fa ? 'راه‌اندازی قدم‌به‌قدم' : 'Set it up step by step'}<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
					</Link>
				</div>
				<GatewayFlowMotion bankKey="mellat" pan="6104 33•• •••• 5675" holder={fa ? 'نام شما' : 'Your name'} amount={SAMPLE_AMOUNT} lang={locale} />
			</section>
		)
	}

	const live = data.live
	const masked = `${live.next.bin.slice(0, 4)} ${live.next.bin.slice(4)}•• •••• ${live.next.last4}`
	const sms = live.lastSmsAt
		? new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(live.lastSmsAt)
		: null
	const attention = live.review + live.unmatched
	return (
		<section aria-label={fa ? 'درگاه پرداخت' : 'Payment gateway'} className="spatial-surface rounded-card p-4 sm:p-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="inline-flex items-center gap-2 text-[15px] font-bold text-[var(--text-primary)]"><WalletCards className="size-4.5 text-[#5b3de8]" aria-hidden />{fa ? 'درگاه پرداخت' : 'Payment gateway'}</h2>
				<Link href="/payments" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{fa ? 'همهٔ پرداخت‌ها' : 'All payments'}<ArrowLeft className="size-3.5 ltr:rotate-180" aria-hidden /></Link>
			</div>
			<div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-stretch">
				<GatewayFlowMotion bankKey={live.next.bankKey} pan={masked} holder={live.next.holderName} amount={live.amount} lang={locale} />
				<div className="flex min-w-0 flex-col gap-2.5">
					<dl className="grid grid-cols-3 gap-2 lg:grid-cols-1">
						{[
							{ label: fa ? 'دریافتی امروز' : 'Received today', value: live.today.toLocaleString(numbers), unit: fa ? 'تومان' : 'Toman', alert: false },
							{ label: fa ? 'در انتظار واریز' : 'Waiting', value: live.pending.toLocaleString(numbers), unit: '', alert: false },
							{ label: fa ? 'نیاز به تصمیم شما' : 'Needs you', value: attention.toLocaleString(numbers), unit: '', alert: attention > 0 },
						].map((item) => (
							<div key={item.label} className={item.alert ? 'rounded-control bg-red-50 p-2.5 text-red-800 dark:bg-red-950/40 dark:text-red-200' : 'rounded-control bg-[var(--bg-surface)] p-2.5'}>
								<dt className="text-[12px] text-[var(--text-muted)]">{item.label}</dt>
								<dd className="mt-0.5 text-[17px] font-bold tabular-nums">{item.value} <span className="text-[11.5px] font-normal">{item.unit}</span></dd>
							</div>
						))}
					</dl>
					<p className="text-[12.5px] leading-6 text-[var(--text-muted)]">
						{live.cards > 1 ? (fa ? `پرداخت بعدی به کارت ••${live.next.last4} می‌رود (از ${live.cards.toLocaleString(numbers)} کارت فعال). ` : `The next payment goes to ••${live.next.last4} (of ${live.cards} active cards). `) : ''}
						{sms ? (fa ? `آخرین پیامک بانک: ${sms}` : `Last bank SMS: ${sms}`) : (fa ? 'هنوز پیامکی از گوشی دریافت پیامک نرسیده.' : 'No SMS has arrived from the phone yet.')}
					</p>
					{attention > 0 ? (
						<Link href="/payments" className="mt-auto inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 text-[13px] font-bold text-white">
							{fa ? `رسیدگی به ${attention.toLocaleString(numbers)} مورد` : `Review ${attention}`}<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
						</Link>
					) : null}
				</div>
			</div>
		</section>
	)
}
