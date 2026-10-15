import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { BankCardFace } from '@/components/payments/bank-card'
import { receivedTodayByCard } from '@/lib/payments/card/service'

/**
 * «نمای کلی»: the gateway at a glance — the card customers are paying into
 * right now and today's numbers. Shown only once the owner switched the
 * gateway on; silent on a database without the gateway tables.
 */
export async function GatewayOverviewTile({ workspaceId, locale }: { workspaceId: string; locale: 'fa' | 'en' }) {
	const fa = locale !== 'en'
	const data = await (async () => {
		const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewayEnabled: true } })
		if (!workspace?.payGatewayEnabled) return null
		const [cards, received, pending, review, device] = await Promise.all([
			prisma.payCard.findMany({ where: { workspaceId, active: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
			receivedTodayByCard(workspaceId),
			prisma.cardPayment.count({ where: { workspaceId, status: 'PENDING' } }),
			prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED' } }),
			prisma.payDevice.findFirst({ where: { workspaceId, active: true }, orderBy: { lastSmsAt: { sort: 'desc', nulls: 'last' } }, select: { lastSmsAt: true } }),
		])
		if (!cards.length) return null
		// The card the next payment goes to: least received today.
		const next = cards.reduce((best, card) => ((received.get(card.id) ?? 0) < (received.get(best.id) ?? 0) ? card : best))
		const today = [...received.values()].reduce((sum, value) => sum + value, 0)
		return { next, today, pending, review, lastSmsAt: device?.lastSmsAt ?? null, cards: cards.length }
	})().catch(() => null)
	if (!data) return null
	const numbers = fa ? 'fa-IR' : 'en-US'
	const masked = `${data.next.bin.slice(0, 4)} ${data.next.bin.slice(4)}•• •••• ${data.next.last4}`
	const sms = data.lastSmsAt
		? new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(data.lastSmsAt)
		: null
	return (
		<section aria-label={fa ? 'درگاه پرداخت' : 'Payment gateway'} className="spatial-surface grid gap-5 rounded-card p-4 sm:p-5 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:items-center">
			<BankCardFace bankKey={data.next.bankKey} pan={masked} holder={data.next.holderName} lang={locale} className="mx-auto max-w-[19rem]" />
			<div className="min-w-0">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'درگاه پرداخت' : 'Payment gateway'}</h2>
					<Link href="/payments" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{fa ? 'همهٔ پرداخت‌ها' : 'All payments'}<ArrowLeft className="size-3.5 ltr:rotate-180" aria-hidden /></Link>
				</div>
				<p className="mt-1 text-[13px] leading-6 text-[var(--text-muted)]">{data.cards > 1 ? (fa ? `پرداخت بعدی به این کارت می‌رود (از ${data.cards.toLocaleString(numbers)} کارت فعال).` : `The next payment goes to this card (of ${data.cards} active cards).`) : (fa ? 'مشتری‌ها به این کارت واریز می‌کنند.' : 'Customers transfer to this card.')}</p>
				<dl className="mt-3 grid grid-cols-3 gap-2">
					{[
						{ label: fa ? 'دریافتی امروز' : 'Received today', value: `${data.today.toLocaleString(numbers)}`, unit: fa ? 'تومان' : 'Toman' },
						{ label: fa ? 'در انتظار واریز' : 'Waiting', value: data.pending.toLocaleString(numbers), unit: '' },
						{ label: fa ? 'نیاز به بررسی' : 'To review', value: data.review.toLocaleString(numbers), unit: '', alert: data.review > 0 },
					].map((item) => (
						<div key={item.label} className={item.alert ? 'rounded-control bg-red-50 p-2.5 text-red-800' : 'rounded-control bg-[var(--bg-surface)] p-2.5'}>
							<dt className="text-[12px] text-[var(--text-muted)]">{item.label}</dt>
							<dd className="ui-num mt-0.5 text-[17px] font-bold">{item.value} <span className="text-[11.5px] font-normal">{item.unit}</span></dd>
						</div>
					))}
				</dl>
				<p className="mt-2.5 text-[12.5px] text-[var(--text-muted)]">{sms ? (fa ? `آخرین پیامک بانک: ${sms}` : `Last bank SMS: ${sms}`) : (fa ? 'هنوز پیامکی از گوشی دریافت پیامک نرسیده.' : 'No SMS has arrived from the phone yet.')}</p>
			</div>
		</section>
	)
}
