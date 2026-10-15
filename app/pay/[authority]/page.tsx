import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { readPayGatewaySettings } from '@/lib/payments/card/settings'
import { cardPayView } from '@/lib/payments/card/service'
import { PayPageClient } from './pay-client'

// The state of a payment changes by the second; never cache this page.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'پرداخت کارت‌به‌کارت',
	robots: { index: false, follow: false },
}

type Props = { params: Promise<{ authority: string }> }

/** The hosted payment page: card, exact amount, live state. Opened from a site, a manual link or a messenger button. */
export default async function PayPage(props: Props) {
	const { authority } = await props.params
	if (!/^[\w-]{8,80}$/.test(authority)) notFound()
	const payment = await prisma.cardPayment.findUnique({
		where: { authority },
		include: { card: true, workspace: { select: { name: true, businessProfile: true, payGatewaySettings: true } } },
	})
	if (!payment) notFound()
	const settings = readPayGatewaySettings(payment.workspace.payGatewaySettings)
	const business = readBusinessProfile(payment.workspace.businessProfile)?.businessName ?? payment.workspace.name
	return (
		<PayPageClient
			card={cardPayView(payment, payment.card, settings, 'fa')}
			business={business}
			description={payment.description}
			baseAmount={payment.baseAmount}
			hasReturn={Boolean(payment.returnUrl)}
		/>
	)
}
