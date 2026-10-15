import Link from 'next/link'
import { AlertCircle, ArrowLeft, Clock3, MessageSquareText, TrendingUp, WalletCards } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { BankCardFace } from '@/components/payments/bank-card'
import { GatewayFlowMotion } from '@/components/payments/gateway-flow-motion'
import { getPlatformGatewaySettings } from '@/lib/payments/card/platform'
import { receivedTodayByCard } from '@/lib/payments/card/service'
import { cn } from '@/lib/utils'

const SAMPLE_AMOUNT = 1_250_347
const NOT_TEST = { NOT: { reference: { startsWith: 'TEST-' } } }

/**
 * «نمای کلی»: the payment gateway at a glance. Once the gateway is on: the
 * card customers pay into right now, still, with today's three numbers
 * beside it. Before that: the flow animated on a sample card and the way in.
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
		const [received, pending, review, unmatched, device] = await Promise.all([
			receivedTodayByCard(workspaceId),
			prisma.cardPayment.count({ where: { workspaceId, status: 'PENDING', ...NOT_TEST } }),
			prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED', ...NOT_TEST } }),
			prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
			prisma.payDevice.findFirst({ where: { workspaceId, active: true }, orderBy: { lastSmsAt: { sort: 'desc', nulls: 'last' } }, select: { lastSmsAt: true } }),
		])
		// The card the next payment goes to: least received today.
		const next = cards.reduce((best, card) => ((received.get(card.id) ?? 0) < (received.get(best.id) ?? 0) ? card : best))
		const today = [...received.values()].reduce((sum, value) => sum + value, 0)
		return { live: { next, today, pending, review, unmatched, lastSmsAt: device?.lastSmsAt ?? null, cards: cards.length } }
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
		? new Intl.DateTimeFormat(numbers, { dateStyle: 'short', timeStyle: 'short' }).format(live.lastSmsAt)
		: null
	const attention = live.review + live.unmatched
	const fields = [
		{ key: 'today', icon: TrendingUp, label: fa ? 'دریافتی امروز' : 'Received today', value: live.today.toLocaleString(numbers), unit: fa ? 'تومان' : 'Toman', tint: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', alert: false },
		{ key: 'pending', icon: Clock3, label: fa ? 'در انتظار واریز' : 'Waiting for transfer', value: live.pending.toLocaleString(numbers), unit: fa ? 'پرداخت' : 'payments', tint: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', alert: false },
		{ key: 'attention', icon: AlertCircle, label: fa ? 'نیاز به تصمیم شما' : 'Needs you', value: attention.toLocaleString(numbers), unit: fa ? 'مورد' : 'items', tint: attention > 0 ? 'bg-red-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-muted)]', alert: attention > 0 },
	]
	return (
		<section aria-label={fa ? 'درگاه پرداخت' : 'Payment gateway'} className="spatial-surface rounded-card p-4 sm:p-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2.5">
					<h2 className="inline-flex items-center gap-2 text-[15px] font-bold text-[var(--text-primary)]"><WalletCards className="size-[18px] text-[#5b3de8]" aria-hidden />{fa ? 'درگاه پرداخت' : 'Payment gateway'}</h2>
					<span className="ui-chip ui-chip-ok"><span className="ui-chip-dot" />{fa ? 'روشن' : 'On'}</span>
				</div>
				<Link href="/payments" className="inline-flex min-h-9 items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{fa ? 'همهٔ پرداخت‌ها' : 'All payments'}<ArrowLeft className="size-3.5 ltr:rotate-180" aria-hidden /></Link>
			</div>
			<div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:items-center lg:gap-7">
				<div className="mx-auto grid w-full max-w-[21rem] gap-2 md:mx-0">
					<BankCardFace bankKey={live.next.bankKey} pan={masked} holder={live.next.holderName} lang={locale} />
					<p className="text-center text-[12px] text-[var(--text-muted)] md:text-start">
						{live.cards > 1
							? (fa ? `پرداخت بعدی به این کارت می‌رود · ${live.cards.toLocaleString(numbers)} کارت فعال` : `The next payment goes to this card · ${live.cards} active cards`)
							: (fa ? 'کارتی که مشتری‌ها به آن واریز می‌کنند' : 'The card your customers pay into')}
					</p>
				</div>
				<div className="grid min-w-0 gap-3">
					<dl className="grid grid-cols-3 gap-2 sm:gap-3">
						{fields.map((field) => {
							const Icon = field.icon
							const body = (
								<>
									<span className={cn('grid size-8 place-items-center rounded-xl', field.tint)}><Icon className="size-4" aria-hidden /></span>
									<dt className="mt-2.5 text-[11.5px] leading-5 text-[var(--text-muted)] sm:text-[12.5px]">{field.label}</dt>
									<dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1">
										<span className={cn('text-[18px] font-extrabold tabular-nums leading-7 sm:text-[22px]', field.alert ? 'text-red-600' : 'text-[var(--text-primary)]')}>{field.value}</span>
										<span className="text-[11px] text-[var(--text-muted)]">{field.unit}</span>
									</dd>
								</>
							)
							return field.alert
								? <Link key={field.key} href="/payments" className="min-w-0 rounded-2xl border border-red-200 bg-red-50/60 p-3 transition-colors hover:border-red-300 dark:border-red-900/50 dark:bg-red-950/20 sm:p-3.5">{body}</Link>
								: <div key={field.key} className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 sm:p-3.5">{body}</div>
						})}
					</dl>
					<p className="flex items-center gap-1.5 text-[12.5px] leading-6 text-[var(--text-muted)]">
						<MessageSquareText className="size-3.5 shrink-0" aria-hidden />
						{sms ? (fa ? `آخرین پیامک بانک: ${sms}` : `Last bank SMS: ${sms}`) : (fa ? 'هنوز پیامکی از گوشی دریافت پیامک نرسیده.' : 'No SMS has arrived from the phone yet.')}
					</p>
				</div>
			</div>
		</section>
	)
}
