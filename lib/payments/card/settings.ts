/**
 * Per-business behaviour of the payment gateway (Workspace.payGatewaySettings).
 * Pure: safe for client components.
 */
export interface PayGatewaySettings {
  /** Minutes the customer has to make the transfer. */
  ttlMinutes: number
  /** Show «پرداخت کردم» so a missing SMS goes to the owner's review. */
  manualClaim: boolean
  /** Show the cardholder's name beside the number. */
  showHolderName: boolean
}

export const DEFAULT_PAY_GATEWAY_SETTINGS: PayGatewaySettings = {
  ttlMinutes: 20,
  manualClaim: true,
  showHolderName: true,
}

export const PAY_TTL_RANGE = { min: 10, max: 60 } as const

/** After the deadline the amount stays reserved this long for a late SMS. */
export const LATE_SMS_GRACE_MS = 2 * 60 * 60 * 1000

export function readPayGatewaySettings(value: unknown): PayGatewaySettings {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const ttl = typeof row.ttlMinutes === 'number' && Number.isFinite(row.ttlMinutes)
    ? Math.min(PAY_TTL_RANGE.max, Math.max(PAY_TTL_RANGE.min, Math.round(row.ttlMinutes)))
    : DEFAULT_PAY_GATEWAY_SETTINGS.ttlMinutes
  return {
    ttlMinutes: ttl,
    manualClaim: typeof row.manualClaim === 'boolean' ? row.manualClaim : DEFAULT_PAY_GATEWAY_SETTINGS.manualClaim,
    showHolderName: typeof row.showHolderName === 'boolean' ? row.showHolderName : DEFAULT_PAY_GATEWAY_SETTINGS.showHolderName,
  }
}
