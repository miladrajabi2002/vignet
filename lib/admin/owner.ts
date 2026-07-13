import { normalizePhone } from '@/lib/phone'

/** The only identity that can own the platform-level administration surface. */
export const ADMIN_OWNER_PHONE = normalizePhone('09128352271')!
export const ADMIN_OWNER_NAME = 'میلاد'

export function isPlatformOwnerPhone(value: string | null | undefined): boolean {
  return normalizePhone(value ?? '') === ADMIN_OWNER_PHONE
}
