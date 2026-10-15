import Link from 'next/link'
import { CircleAlert, Hourglass } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { BankMark } from '@/components/payments/bank-card'
import { PaymentActions } from '@/components/payments/payment-actions'

/**
 * «بررسی پرداخت» inside a conversation: a customer said they paid and no bank
 * SMS has matched, so the owner decides — shown in red until they do. A
 * payment that is simply waiting for its transfer shows as a quiet line.
 * Tolerates a database without the gateway tables (before the migration).
 */
export async function ConversationPaymentBanner({ workspaceId, conversationId, locale }: { workspaceId: string; conversationId: string; locale: 'fa' | 'en' }) {
	const fa = locale !== 'en'
	const payments = await prisma.cardPayment.findMany({
		where: { workspaceId, conversationId, status: { in: ['CLAIMED', 'PENDING'] } },
		orderBy: { createdAt: 'desc' },
		take: 3,
		include: { card: { select: { bankKey: true, last4: true } } },
	}).catch(() => [])
	if (!payments.length) return null
	const money = (value: number) => `${value.toLocaleString(fa ? 'fa-IR' : 'en-US')} ${fa ? 'تومان' : 'Toman'}`
	return (
		<div className="grid shrink-0 gap-2">
			{payments.map((payment) => payment.status === 'CLAIMED' ? (
				<section key={payment.id} role="alert" className="rounded-card border border-red-300 bg-red-50 p-3.5 sm:p-4">
					<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
						<CircleAlert className="size-5 shrink-0 text-red-600" aria-hidden />
						<h2 className="text-[15px] font-bold text-red-800">{fa ? 'بررسی پرداخت' : 'Payment review'}</h2>
						<span dir="ltr" className="font-mono text-sm font-bold text-red-900">#{payment.reference}</span>
						<span className="text-sm font-bold text-red-900">{money(payment.payAmount)}</span>
						<span className="inline-flex items-center gap-1.5 text-[13px] text-red-800"><BankMark bankKey={payment.card.bankKey} size={20} /><span dir="ltr" className="font-mono">…{payment.card.last4}</span></span>
					</div>
					<p className="mt-1.5 max-w-3xl text-[13.5px] leading-7 text-red-900">
						{fa
							? 'مشتری می‌گوید این مبلغ را واریز کرده، ولی پیامک واریز بانک به ویجنت نرسیده. موجودی همین کارت را در همراه‌بانک نگاه کنید: اگر رسیده «تأیید» و اگر نرسیده «رد» را بزنید. تا تصمیم شما، ایجنت به مشتری نمی‌گوید پرداخت تأیید شده است.'
							: 'The customer says this amount was transferred, but no deposit SMS reached Vigent. Check this card in your bank app: confirm if it arrived, reject if it did not. Until you decide, the agent does not tell the customer the payment is confirmed.'}
					</p>
					<div className="mt-3"><PaymentActions paymentId={payment.id} mode="review" /></div>
				</section>
			) : (
				<section key={payment.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-card border border-amber-200 bg-amber-50/80 px-3.5 py-2.5">
					<Hourglass className="size-4 shrink-0 text-amber-700" aria-hidden />
					<p className="min-w-0 flex-1 text-[13.5px] leading-7 text-amber-900">
						{fa ? 'در انتظار واریز' : 'Waiting for the transfer'} <span dir="ltr" className="font-mono font-bold">#{payment.reference}</span> · {money(payment.payAmount)} {fa ? 'به کارت' : 'to card'} <span dir="ltr" className="font-mono">…{payment.card.last4}</span>{fa ? '. با رسیدن پیامک بانک خودکار تأیید می‌شود.' : '. It confirms by itself when the bank SMS arrives.'}
					</p>
					<PaymentActions paymentId={payment.id} mode="pending" compact />
				</section>
			))}
		</div>
	)
}

/** Above the inbox: payments waiting for the owner's decision, each linking to its conversation. */
export async function PaymentReviewStrip({ workspaceId, locale }: { workspaceId: string; locale: 'fa' | 'en' }) {
	const fa = locale !== 'en'
	const payments = await prisma.cardPayment.findMany({
		where: { workspaceId, status: 'CLAIMED' },
		orderBy: { claimedAt: 'desc' },
		take: 6,
		select: { id: true, reference: true, payAmount: true, conversationId: true, customerName: true },
	}).catch(() => [])
	if (!payments.length) return null
	return (
		<section role="alert" className="rounded-card border border-red-300 bg-red-50 p-3.5">
			<h2 className="flex items-center gap-2 text-sm font-bold text-red-800"><CircleAlert className="size-4" aria-hidden />{fa ? `${payments.length.toLocaleString('fa-IR')} پرداخت منتظر بررسی شماست` : `${payments.length} payment${payments.length === 1 ? '' : 's'} waiting for your review`}</h2>
			<ul className="mt-2 flex flex-wrap gap-2">
				{payments.map((payment) => (
					<li key={payment.id}>
						<Link href={payment.conversationId ? `/conversations/${payment.conversationId}` : '/payments'} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-red-200 bg-white px-3 text-[13px] text-red-900 hover:border-red-400">
							<span dir="ltr" className="font-mono font-bold">#{payment.reference}</span>
							<span>{payment.payAmount.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'تومان' : 'Toman'}</span>
							{payment.customerName ? <span className="text-red-700">· {payment.customerName}</span> : null}
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}
