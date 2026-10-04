/**
 * Commerce switches and helpers of a turn (moved from chat-engine.ts).
 */
import { prisma } from '@/lib/prisma'
import type { ChatAgent } from '@/lib/ai/chat-types'
import { looksLikePersonName } from '@/lib/ai/customer-identification'

/**
 * A commerce action resolved deterministically for this turn: a pre-order
 * step, a back-in-stock alert, or a confirmed pre-order to file.
 */
export type CommerceTurn =
        | { kind: 'none' }
        | { kind: 'reply'; text: string }
        | { kind: 'submit'; text: string; draftId: string; code: string; operatorSummary: string }
        | { kind: 'instruct'; instruction: string }

/**
 * The agent's commerce switches, read with a raw query that tolerates a
 * database where the columns do not exist yet: the worker runs from source,
 * so a restart before the migration must degrade to "off", never break every
 * inbound message on an unknown-column error.
 */
export type CommerceFlags = {
        orderCaptureEnabled: boolean
        restockAlertsEnabled: boolean
        orderUpdatesEnabled: boolean
        cartHoldEnabled: boolean
}

export async function loadCommerceFlags(agent: ChatAgent): Promise<CommerceFlags> {
        if (
                agent.orderCaptureEnabled !== undefined && agent.restockAlertsEnabled !== undefined
                && agent.orderUpdatesEnabled !== undefined && agent.cartHoldEnabled !== undefined
        ) {
                return {
                        orderCaptureEnabled: agent.orderCaptureEnabled,
                        restockAlertsEnabled: agent.restockAlertsEnabled,
                        orderUpdatesEnabled: agent.orderUpdatesEnabled,
                        cartHoldEnabled: agent.cartHoldEnabled,
                }
        }
        try {
                const rows = await prisma.$queryRaw<Array<CommerceFlags>>`
                        SELECT "orderCaptureEnabled", "restockAlertsEnabled", "orderUpdatesEnabled", "cartHoldEnabled" FROM "Agent" WHERE id = ${agent.id}`
                return {
                        orderCaptureEnabled: rows[0]?.orderCaptureEnabled === true,
                        restockAlertsEnabled: rows[0]?.restockAlertsEnabled === true,
                        orderUpdatesEnabled: rows[0]?.orderUpdatesEnabled === true,
                        cartHoldEnabled: rows[0]?.cartHoldEnabled === true,
                }
        } catch {
                // The follow-up switches ship in a later migration than the
                // order-capture ones: without them, both are simply off.
        }
        try {
                const rows = await prisma.$queryRaw<Array<{ orderCaptureEnabled: boolean; restockAlertsEnabled: boolean }>>`
                        SELECT "orderCaptureEnabled", "restockAlertsEnabled" FROM "Agent" WHERE id = ${agent.id}`
                return {
                        orderCaptureEnabled: rows[0]?.orderCaptureEnabled === true,
                        restockAlertsEnabled: rows[0]?.restockAlertsEnabled === true,
                        orderUpdatesEnabled: false,
                        cartHoldEnabled: false,
                }
        } catch {
                return { orderCaptureEnabled: false, restockAlertsEnabled: false, orderUpdatesEnabled: false, cartHoldEnabled: false }
        }
}

/** Known customer details offered for confirmation in an order summary. */
export function orderPrefill(params: {
        contactName: string | null
        contactPhone: string | null
        facts: Array<{ key: string; value: string }>
}): { name: string | null; phone: string | null; city: string | null; address: string | null } {
        const name = params.contactName?.trim() ?? ''
        const fact = (key: string) => params.facts.find((item) => item.key === key)?.value ?? null
        return {
                // Channel display names («milad_rgb», emoji handles) are not names.
                name: name && /^[\p{L}\s.'‌-]{2,40}$/u.test(name) && looksLikePersonName(name) ? name : null,
                phone: params.contactPhone ?? null,
                city: fact('شهر مقصد ارسال') ?? fact('شهر'),
                address: fact('آدرس'),
        }
}
