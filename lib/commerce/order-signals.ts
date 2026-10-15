/**
 * What the customer's message means for the in-chat order, as one object.
 *
 * The order state machine (order-service.ts) reads these signals instead of
 * the message itself. They are built from the verified turn reading
 * (lib/agent/turn/route.ts), with cart operations and product picks already
 * resolved to catalog ids. A turn without a reading carries
 * emptyOrderSignals(): nothing is read into its text.
 */
import {
  type OrderSlotValues,
} from '@/lib/commerce/order-capture'
import { type CartEditCue, type CartEditOp } from '@/lib/commerce/cart-edit'

export interface OrderStartItem {
  productId: string
  variationId: number | null
  /** Variant words the customer used («آبی»، «سایز ۴۲»), matched on the server. */
  variant: string | null
  quantity: number | null
}

export interface OrderTurnSignals {
  /**
   * 'understanding': the items and variants are already resolved to catalog
   * rows. 'message': only the cues are known and the order flow still reads
   * the variant from the customer's own words.
   */
  source: 'understanding' | 'message'
  /** Open a new draft. */
  orderIntent: boolean
  /** Products the customer picked, already resolved (understanding only). */
  startItems: OrderStartItem[]
  cartCue: CartEditCue | null
  /** Cart operations resolved by the reading; null = apply the cue to the product this turn identified. */
  cartOps: CartEditOp[] | null
  confirm: boolean
  decline: boolean
  /** Explicit request to cancel the WHOLE order (always confirmed once). */
  cancel: boolean
  /** The message asks something (answered by the reply model mid-order). */
  question: boolean
  /** «بی‌خیال، یه چیز دیگه»: the customer drops what they were doing. */
  abandon: boolean
  /** A thanks, a goodbye or «بعداً خبر می‌دم» and nothing else. */
  closing: boolean
  linkRequest: boolean
  paymentClaim: boolean
  /** Wants to pay by card-to-card / asks for the card number (payment gateway). */
  cardTransfer: boolean
  /** Verified customer details; null = parse the message (legacy). */
  slots: OrderSlotValues | null
  /** Verified coupon; undefined = parse the message (legacy). */
  coupon?: string | null
  /** Shipping method words the customer used, matched against the store's rates. */
  shippingText: string | null
  /** The customer wants to see/change the shipping method. */
  shippingChange: boolean
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
    abandon: false,
    closing: false,
    linkRequest: false,
    paymentClaim: false,
    cardTransfer: false,
    slots: null,
    coupon: null,
    shippingText: null,
    shippingChange: false,
  }
}
