/**
 * Per-business behaviour of the payment gateway (Workspace.payGatewaySettings).
 * Pure: safe for client components.
 */
export interface PayGatewaySettings {
  /** Minutes the customer has to make the transfer: fixed, not a setting. */
  ttlMinutes: number
  /** Show «پرداخت کردم» so a missing SMS goes to the owner's review. */
  manualClaim: boolean
  /** Show the cardholder's name beside the number. */
  showHolderName: boolean
}

/** Every chat payment gives the customer twenty minutes. */
export const PAY_TTL_MINUTES = 20

export const DEFAULT_PAY_GATEWAY_SETTINGS: PayGatewaySettings = {
  ttlMinutes: PAY_TTL_MINUTES,
  manualClaim: true,
  showHolderName: true,
}

/** After the deadline the amount stays reserved this long for a late SMS. */
export const LATE_SMS_GRACE_MS = 2 * 60 * 60 * 1000

export function readPayGatewaySettings(value: unknown): PayGatewaySettings {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    // A deadline stored by the old setting is ignored: the deadline is fixed.
    ttlMinutes: PAY_TTL_MINUTES,
    manualClaim: typeof row.manualClaim === 'boolean' ? row.manualClaim : DEFAULT_PAY_GATEWAY_SETTINGS.manualClaim,
    showHolderName: typeof row.showHolderName === 'boolean' ? row.showHolderName : DEFAULT_PAY_GATEWAY_SETTINGS.showHolderName,
  }
}
