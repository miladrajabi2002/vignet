import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { readPayGatewaySettings } from '@/lib/payments/card/settings'
import { cardPayView } from '@/lib/payments/card/service'
import { readPayItems, type PayItem } from '@/lib/payments/card/items'
import { PayPageClient } from './pay-client'

// The state of a payment changes by the second; never cache this page.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'پرداخت کارت‌به‌کارت',
	robots: { index: false, follow: false },
}

type Props = { params: Promise<{ authority: string }> }

/** A chat order's lines, from its draft, in the payment's own shape. */
async function draftItems(orderDraftId: string): Promise<PayItem[]> {
	const draft = await prisma.orderDraft.findUnique({ where: { id: orderDraftId }, select: { items: true } })
	if (!Array.isArray(draft?.items)) return []
	return readPayItems(
		(draft.items as Array<Record<string, unknown>>).map((item) => ({
			name: [item.name, item.variant].filter((part) => typeof part === 'string' && part).join(' · '),
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			productId: item.productId,
		})),
	)
}

/** The hosted payment page: card, exact amount, live state. Opened from a site, a manual link or a messenger button. */
export default async function PayPage(props: Props) {
	const { authority } = await props.params
	if (!/^[\w-]{8,80}$/.test(authority)) notFound()
	const payment = await prisma.cardPayment.findUnique({
		where: { authority },
		include: { card: true, site: { select: { name: true } }, workspace: { select: { name: true, businessProfile: true, payGatewaySettings: true } } },
	})
	if (!payment) notFound()
	const settings = readPayGatewaySettings(payment.workspace.payGatewaySettings)
	const profile = readBusinessProfile(payment.workspace.businessProfile)
	const business = profile?.businessName ?? payment.workspace.name
	const items = payment.orderDraftId ? await draftItems(payment.orderDraftId) : readPayItems(payment.items)
	return (
		<PayPageClient
			card={cardPayView(payment, payment.card, settings, 'fa')}
			business={business}
			website={profile?.website ?? payment.site?.name ?? null}
			description={payment.description}
			baseAmount={payment.baseAmount}
			items={items}
			paidAt={payment.paidAt?.toISOString() ?? null}
			createdAt={payment.createdAt.toISOString()}
			hasReturn={Boolean(payment.returnUrl)}
		/>
	)
}
