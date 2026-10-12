/**
 * Test support: stands in for the turn reading in flow tests.
 *
 * Production code takes the order and restock signals of a turn only from the
 * verified reading (lib/agent/turn/route.ts). The order and restock state
 * machines are tested turn by turn with Persian messages, so these helpers
 * derive the same signals from the message text with the regex detectors
 * that used to be the fallback router — without calling a model.
 */
import type { OrderTurnSignals } from '@/lib/commerce/order-signals'
import {
  assistantOfferedOrder,
  detectOrderIntent,
  isOrderCancellation,
  isOrderConfirmation,
  isOrderDecline,
  isQuestion,
} from './order-capture'
import { detectCartEditCue } from './cart-edit'
import { isLinkRequest, isPaymentClaim } from './checkout-link'

export { detectRestockRequest } from './restock'
export { detectOrderIntent, isOrderConfirmation, isOrderDecline, isOrderCancellation, isQuestion } from './order-capture'
export { detectCartEditCue } from './cart-edit'
export { isLinkRequest, isPaymentClaim } from './checkout-link'

export function regexOrderSignals(message: string, lastAssistantText: string | null = null): OrderTurnSignals {
  const confirm = isOrderConfirmation(message)
  return {
    source: 'message',
    orderIntent: detectOrderIntent(message) || (assistantOfferedOrder(lastAssistantText) && confirm),
    startItems: [],
    cartCue: detectCartEditCue(message),
    cartOps: null,
    confirm,
    decline: isOrderDecline(message),
    cancel: isOrderCancellation(message),
    question: isQuestion(message),
    linkRequest: isLinkRequest(message),
    paymentClaim: isPaymentClaim(message),
    slots: null,
    coupon: undefined,
    shippingText: null,
    shippingChange: false,
  }
}
