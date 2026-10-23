import crypto from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { vigentPayCallbackIsGenuine } from '@/lib/billing/vigentpay'

const SECRET = 'whs_test_secret_for_billing_callbacks'

/** Signs the way lib/payments/card/service.ts signs outgoing site callbacks. */
function sign(timestamp: string, body: string): string {
	return `sha256=${crypto.createHmac('sha256', SECRET).update(`${timestamp}.${body}`).digest('hex')}`
}

describe('Vigent card gateway callbacks for site billing', () => {
	const body = JSON.stringify({ event: 'payment.paid', authority: 'abcdefgh123', order_id: 'pay_1', status: 'paid', amount: 1_000_000, pay_amount: 1_003_120 })
	const now = Date.UTC(2026, 9, 23, 18, 0, 0)
	const timestamp = String(Math.floor(now / 1000))

	afterEach(() => { delete process.env.VIGENTPAY_CALLBACK_SECRET })

	it('accepts a fresh callback signed with the site secret', () => {
		process.env.VIGENTPAY_CALLBACK_SECRET = SECRET
		expect(vigentPayCallbackIsGenuine(body, timestamp, sign(timestamp, body), now)).toBe(true)
	})

	it('refuses a changed body, a wrong secret, a stale timestamp or no secret at all', () => {
		process.env.VIGENTPAY_CALLBACK_SECRET = SECRET
		expect(vigentPayCallbackIsGenuine(body.replace('pay_1', 'pay_2'), timestamp, sign(timestamp, body), now)).toBe(false)
		expect(vigentPayCallbackIsGenuine(body, timestamp, `sha256=${'0'.repeat(64)}`, now)).toBe(false)
		const old = String(Math.floor(now / 1000) - 11 * 60)
		expect(vigentPayCallbackIsGenuine(body, old, sign(old, body), now)).toBe(false)
		expect(vigentPayCallbackIsGenuine(body, null, sign(timestamp, body), now)).toBe(false)
		delete process.env.VIGENTPAY_CALLBACK_SECRET
		expect(vigentPayCallbackIsGenuine(body, timestamp, sign(timestamp, body), now)).toBe(false)
	})
})
