import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyVigentPayPayment, vigentPayCallbackIsGenuine } from '@/lib/billing/vigentpay'
import { activateSubscriptionPayment } from '@/lib/billing/entitlements'
import { captureAiCreditTopupPayment } from '@/lib/billing/credit-topups'
import { isPaidPlan } from '@/lib/billing/plans'
import { readBoundedRequestBody } from '@/lib/security/request-body'
import { captureError } from '@/lib/errors/capture'

export const dynamic = 'force-dynamic'

const MAX_CALLBACK_BYTES = 16 * 1024

type Outcome = 'success' | 'pending' | 'failed'

function appUrl(): string {
	return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003').replace(/\/$/, '')
}

/**
 * Settles one checkout by asking the gateway, never by trusting the caller:
 * the browser's return and the signed callback both end up here, and a
 * repeat of either is harmless (a PAID row stays PAID).
 */
async function settle(paymentId: string): Promise<Outcome> {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		select: { id: true, workspaceId: true, gateway: true, plan: true, kind: true, amount: true, status: true, authority: true },
	})
	if (!payment || payment.gateway !== 'VIGENTPAY' || !payment.authority) return 'failed'
	if (payment.status === 'PAID') return 'success'
	// FAILED and EXPIRED are asked again: the gateway closes an unpaid link as «expired»,
	// and the owner may still confirm the transfer by hand afterwards (a late deposit).
	if (payment.status !== 'PENDING' && payment.status !== 'FAILED' && payment.status !== 'EXPIRED') return 'failed'

	let verify
	try {
		verify = await verifyVigentPayPayment(payment.authority)
	} catch (error) {
		// An outage is not evidence the payment failed: keep it PENDING for the next try.
		captureError('billing:vigentpay-verify', error, { workspaceId: payment.workspaceId, metadata: { paymentId: payment.id } })
		return 'pending'
	}
	if (verify.pending) return 'pending'
	if (!verify.success) {
		// -1: the gateway closed it (expired, failed or cancelled) without a transfer.
		if (verify.code === -1) {
			await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', callbackPayload: verify.raw as Prisma.InputJsonValue } })
		}
		return 'failed'
	}

	// The verified order amount must be what we charged, for this very payment.
	if (verify.amount == null || Math.round(verify.amount) !== Math.round(payment.amount) || (verify.orderId != null && verify.orderId !== payment.id)) {
		await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', callbackPayload: verify.raw as Prisma.InputJsonValue } })
		return 'failed'
	}

	// Verified paid after being closed as failed: reopen it so the single PENDING→PAID claim below applies.
	if (payment.status === 'FAILED') {
		await prisma.payment.updateMany({ where: { id: payment.id, status: 'FAILED' }, data: { status: 'PENDING' } })
	}
	// EXPIRED (the stale-checkout sweep) is claimed as it is by the activation below.

	const paymentUpdate = {
		status: 'PAID' as const,
		paidAt: new Date(),
		externalId: verify.paymentId,
		callbackPayload: verify.raw as Prisma.InputJsonValue,
	}
	if (payment.kind === 'AI_CREDIT') {
		await captureAiCreditTopupPayment({ paymentId: payment.id, workspaceId: payment.workspaceId, amountIRR: Math.round(payment.amount), paymentUpdate })
		return 'success'
	}
	if (payment.kind !== 'SUBSCRIPTION' || !payment.plan || !isPaidPlan(payment.plan)) {
		await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', callbackPayload: verify.raw as Prisma.InputJsonValue } })
		return 'failed'
	}
	await activateSubscriptionPayment({
		paymentId: payment.id,
		workspaceId: payment.workspaceId,
		plan: payment.plan,
		monthlyPrice: payment.amount,
		currency: 'IRR',
		paymentUpdate,
	})
	return 'success'
}

/**
 * The customer comes back from the pay page (`?pid=` is ours, set at
 * checkout; the gateway adds `authority`, `order_id` and `status`).
 */
export async function GET(req: Request) {
	const pid = new URL(req.url).searchParams.get('pid')
	const outcome = pid ? await settle(pid) : 'failed'
	return NextResponse.redirect(`${appUrl()}/billing?payment=${outcome}`, 303)
}

/**
 * The gateway's own signed callback, server to server. It lands even when the
 * customer closed the pay page before it returned them here.
 */
export async function POST(req: Request) {
	let raw: string
	try {
		raw = (await readBoundedRequestBody(req, MAX_CALLBACK_BYTES)).toString('utf8')
	} catch {
		return NextResponse.json({ ok: false }, { status: 413 })
	}
	if (!vigentPayCallbackIsGenuine(raw, req.headers.get('x-vigent-timestamp'), req.headers.get('x-vigent-signature'))) {
		return NextResponse.json({ ok: false }, { status: 401 })
	}
	let pid: string | null = null
	try {
		const body = JSON.parse(raw) as { order_id?: unknown }
		pid = typeof body.order_id === 'string' ? body.order_id : null
	} catch { /* not JSON */ }
	if (!pid) return NextResponse.json({ ok: false }, { status: 400 })
	const outcome = await settle(pid)
	return NextResponse.json({ ok: true, outcome })
}
