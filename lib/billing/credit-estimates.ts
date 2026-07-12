/** Number of successful replies remaining when the low-credit alert fires. */
export const LOW_CREDIT_REPLY_THRESHOLD = 20

/** Apply a plan discount and keep wallet charges stable/readable in rials. */
export function discountedReplyPriceIRR(baseIRR: number, discountBps: number): number {
  const safeBase = Number.isFinite(baseIRR) ? Math.max(0, Math.round(baseIRR)) : 0
  const safeDiscount = Number.isFinite(discountBps)
    ? Math.min(10_000, Math.max(0, Math.round(discountBps)))
    : 0
  const discounted = Math.ceil((safeBase * (10_000 - safeDiscount)) / 10_000)
  return Math.max(100, Math.ceil(discounted / 100) * 100)
}

/** Conservative whole successful replies affordable at a fixed reply price. */
export function estimateRemainingReplies(balanceIRR: number, replyPriceIRR: number): number {
  if (!Number.isFinite(balanceIRR) || !Number.isFinite(replyPriceIRR) || replyPriceIRR <= 0) {
    return 0
  }
  return Math.max(0, Math.floor(Math.max(0, balanceIRR) / replyPriceIRR))
}

export function lowCreditThresholdIRR(replyPriceIRR: number): number {
  return Math.max(0, Math.round(replyPriceIRR)) * LOW_CREDIT_REPLY_THRESHOLD
}

export function crossedLowCreditThreshold(params: {
  previousBalanceIRR: number
  balanceIRR: number
  replyPriceIRR: number
}): boolean {
  const threshold = lowCreditThresholdIRR(params.replyPriceIRR)
  return params.previousBalanceIRR >= threshold && params.balanceIRR < threshold
}

export type LowCreditAlertAction = 'ALERT' | 'REARM' | 'NONE'

/** Pure state transition used by the post-capture alert latch. */
export function decideLowCreditAlertAction(params: {
  armed: boolean | null
  balanceIRR: number
  replyPriceIRR: number
}): LowCreditAlertAction {
  const belowThreshold =
    estimateRemainingReplies(params.balanceIRR, params.replyPriceIRR) <
    LOW_CREDIT_REPLY_THRESHOLD
  if (!belowThreshold) return params.armed === false ? 'REARM' : 'NONE'
  return params.armed === false ? 'NONE' : 'ALERT'
}
