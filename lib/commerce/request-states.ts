/**
 * The chat pre-orders on «درخواست‌ها», by what they wait for. A paid one is
 * not here: it is an order now, on «سفارش‌ها».
 */

/** Filed by the agent; the owner arranges payment and delivery. */
export const REQUEST_ACTION_STATUSES = ['SUBMITTED'] as const
/** Sent to the customer to pay (card transfer or the store's checkout). */
export const REQUEST_PAYING_STATUSES = ['AWAITING_TRANSFER', 'PAYMENT_REVIEW', 'LINK_SENT', 'PAYMENT_PENDING', 'ON_HOLD'] as const
/** Finished without a payment here: done by hand, cancelled, expired or failed. */
export const REQUEST_CLOSED_STATUSES = ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED', 'REFUNDED'] as const

export const REQUEST_LISTED_STATUSES = [...REQUEST_ACTION_STATUSES, ...REQUEST_PAYING_STATUSES, ...REQUEST_CLOSED_STATUSES]

/** Only a closed pre-order may be deleted: an open one is still a live cart in a chat. */
export function isDeletableRequest(status: string): boolean {
  return (REQUEST_CLOSED_STATUSES as readonly string[]).includes(status)
}
