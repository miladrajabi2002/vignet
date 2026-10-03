/**
 * What the customer's message means for the in-chat order, as one object.
 *
 * The order state machine (order-service.ts) used to call a dozen regex
 * detectors directly. It now reads these signals instead, so the same state
 * machine runs on either source:
 *   • 'understanding' — built from the verified turn-understanding acts
 *     (lib/agent/understand), with cart operations and product picks already
 *     resolved to catalog ids;
 *   • 'legacy'        — the previous regex detectors, kept as the fallback
 *     when the understanding layer is off or unavailable for a turn.
 */
import {
  assistantOfferedOrder,
  detectOrderIntent,
  isOrderCancellation,
  isOrderConfirmation,
  isOrderDecline,
  isQuestion,
  type OrderSlotValues,
} from '@/lib/commerce/order-capture'
import { detectCartEditCue, type CartEditCue, type CartEditOp } from '@/lib/commerce/cart-edit'
import { isLinkRequest, isPaymentClaim } from '@/lib/commerce/checkout-link'

export interface OrderStartItem {
  productId: string
  variationId: number | null
  /** Variant words the customer used («آبی»، «سایز ۴۲»), matched on the server. */
  variant: string | null
  quantity: number | null
}

export interface OrderTurnSignals {
  source: 'understanding' | 'legacy'
  /** Open a new draft. */
  orderIntent: boolean
  /** Products the customer picked, already resolved (understanding only). */
  startItems: OrderStartItem[]
  cartCue: CartEditCue | null
  /** Resolved cart operations (understanding); null lets the legacy planner decide. */
  cartOps: CartEditOp[] | null
  confirm: boolean
  decline: boolean
  /** Explicit request to cancel the WHOLE order (always confirmed once). */
  cancel: boolean
  /** The message asks something (answered by the reply model mid-order). */
  question: boolean
  linkRequest: boolean
  paymentClaim: boolean
  /** Verified customer details; null = parse the message (legacy). */
  slots: OrderSlotValues | null
  /** Verified coupon; undefined = parse the message (legacy). */
  coupon?: string | null
  /** Shipping method words the customer used, matched against the store's rates. */
  shippingText: string | null
  /** The customer wants to see/change the shipping method. */
  shippingChange: boolean
}

/** Previous behaviour, unchanged: regex detectors over the raw message. */
export function legacyOrderSignals(message: string, lastAssistantText: string | null): OrderTurnSignals {
  const confirm = isOrderConfirmation(message)
  return {
    source: 'legacy',
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

/** No order meaning at all (understanding saw nothing order-related). */
export function emptyOrderSignals(source: OrderTurnSignals['source'] = 'understanding'): OrderTurnSignals {
  return {
    source,
    orderIntent: false,
    startItems: [],
    cartCue: null,
    cartOps: null,
    confirm: false,
    decline: false,
    cancel: false,
    question: false,
    linkRequest: false,
    paymentClaim: false,
    slots: null,
    coupon: null,
    shippingText: null,
    shippingChange: false,
  }
}

/** Does this turn touch the order flow at all? (cheap pre-check for the engine) */
export function hasOrderMeaning(signals: OrderTurnSignals): boolean {
  return signals.orderIntent || signals.startItems.length > 0 || signals.cartCue != null || Boolean(signals.cartOps?.length)
    || signals.confirm || signals.decline || signals.cancel || signals.linkRequest || signals.paymentClaim
    || Boolean(signals.slots && Object.keys(signals.slots).length) || Boolean(signals.coupon) || Boolean(signals.shippingText)
    || signals.shippingChange
}
