/**
 * The payable amount of a card-to-card payment.
 *
 * The identifier is 1…999 whole TOMANS added to the price, so the rial amount
 * always ends in 0 and can be typed in bank apps that only accept tomans, and
 * no two open payments of one business share an amount.
 */
export const AMOUNT_ID_RANGE = 999

export interface AllocatedAmount {
  baseAmount: number
  payAmount: number
  /** 1…AMOUNT_ID_RANGE */
  identifier: number
}

/**
 * Pick a free identifier for `baseAmount` (whole tomans). `taken` holds the
 * payAmounts that are still reserved. Null when every slot of this price is
 * waiting for a transfer.
 */
export function allocateAmount(baseAmount: number, taken: ReadonlySet<number>, random: () => number = Math.random): AllocatedAmount | null {
  if (!Number.isInteger(baseAmount) || baseAmount <= 0) return null
  const free = (id: number) => !taken.has(baseAmount + id)
  let identifier = 0
  for (let tries = 0; tries < 24 && !identifier; tries++) {
    const guess = 1 + Math.floor(random() * AMOUNT_ID_RANGE)
    if (free(guess)) identifier = guess
  }
  for (let scan = 1; scan <= AMOUNT_ID_RANGE && !identifier; scan++) if (free(scan)) identifier = scan
  if (!identifier) return null
  return { baseAmount, payAmount: baseAmount + identifier, identifier }
}

/** Tomans → rials (what a bank SMS and the API speak). */
export function tomanToRial(toman: number): number {
  return toman * 10
}

/** Rials → whole tomans; null when the rial amount is not a whole toman. */
export function rialToToman(rial: number): number | null {
  return Number.isInteger(rial) && rial % 10 === 0 ? rial / 10 : null
}

export function groupDigits(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
