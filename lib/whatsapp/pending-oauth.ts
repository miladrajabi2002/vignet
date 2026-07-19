import { decrypt, encrypt } from '@/lib/crypto'

export interface PendingWhatsappNumber {
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber?: string
  verifiedName?: string
}

export interface PendingWhatsappOAuth {
  userId: string
  workspaceId: string
  agentId: string
  userToken: string
  userTokenExpiresAt: string
  expiresAt: string
  numbers: PendingWhatsappNumber[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function sealPendingWhatsappOAuth(
  pending: Omit<PendingWhatsappOAuth, 'expiresAt'>,
): string {
  return encrypt(
    JSON.stringify({
      ...pending,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }),
  )
}

export function openPendingWhatsappOAuth(
  sealed: string,
): PendingWhatsappOAuth | null {
  try {
    const parsed = JSON.parse(decrypt(sealed)) as Partial<PendingWhatsappOAuth>
    if (
      !isNonEmptyString(parsed.userId) ||
      !isNonEmptyString(parsed.workspaceId) ||
      !isNonEmptyString(parsed.agentId) ||
      !isNonEmptyString(parsed.userToken) ||
      !isNonEmptyString(parsed.userTokenExpiresAt) ||
      !isNonEmptyString(parsed.expiresAt) ||
      !Array.isArray(parsed.numbers) ||
      !Number.isFinite(Date.parse(parsed.userTokenExpiresAt)) ||
      !Number.isFinite(Date.parse(parsed.expiresAt)) ||
      Date.parse(parsed.expiresAt) <= Date.now()
    ) {
      return null
    }

    const numbers = parsed.numbers.filter(
      (number): number is PendingWhatsappNumber =>
        !!number &&
        isNonEmptyString(number.wabaId) &&
        isNonEmptyString(number.phoneNumberId),
    )
    if (!numbers.length || numbers.length !== parsed.numbers.length) return null

    return {
      userId: parsed.userId,
      workspaceId: parsed.workspaceId,
      agentId: parsed.agentId,
      userToken: parsed.userToken,
      userTokenExpiresAt: parsed.userTokenExpiresAt,
      expiresAt: parsed.expiresAt,
      numbers,
    }
  } catch {
    return null
  }
}
