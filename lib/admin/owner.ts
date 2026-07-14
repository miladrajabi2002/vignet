import { normalizePhone } from '@/lib/phone'

/** The only identity that can own the platform-level administration surface. */
export const ADMIN_OWNER_PHONE = normalizePhone(process.env.ADMIN_OWNER_PHONE ?? '')
export const ADMIN_OWNER_NAME = process.env.ADMIN_OWNER_NAME?.trim() || 'مدیر پلتفرم'

export function isPlatformOwnerPhone(value: string | null | undefined): boolean {
  return Boolean(ADMIN_OWNER_PHONE) && normalizePhone(value ?? '') === ADMIN_OWNER_PHONE
}
