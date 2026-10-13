/**
 * The customer's delivery address on their CRM profile.
 *
 * Stored in `Contact.metadata.shippingAddress` (workspace-level, not per
 * agent): the address a customer confirmed for their latest in-chat order.
 * Contacts synced from WooCommerce carry `billing*` keys instead; those are
 * read as a fallback so the profile shows one address either way.
 */
export interface ContactAddress {
  city: string | null
  address: string | null
  postalCode: string | null
  province: string | null
}

type MetadataRecord = Record<string, unknown>

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as MetadataRecord) : {}
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed.slice(0, max) : null
}

export function cleanContactAddress(input: Partial<ContactAddress> | null | undefined): ContactAddress | null {
  const address: ContactAddress = {
    city: text(input?.city, 60),
    address: text(input?.address, 300),
    postalCode: text(input?.postalCode, 20),
    province: text(input?.province, 60),
  }
  return address.city || address.address ? address : null
}

export function readContactAddress(metadata: unknown): ContactAddress | null {
  const root = asRecord(metadata)
  const saved = cleanContactAddress(asRecord(root.shippingAddress) as Partial<ContactAddress>)
  if (saved) return saved
  return cleanContactAddress({
    city: root.billingCity as string,
    address: root.billingAddress as string,
    postalCode: root.billingPostcode as string,
    province: root.billingState as string,
  })
}

/** One display line: «تهران، خیابان ولیعصر، پلاک ۱۰ · کد پستی: ۱۲۳۴۵۶۷۸۹۰». */
export function formatContactAddress(address: ContactAddress, postalCodeLabel: string, locale: 'fa' | 'en'): string {
  // «تهران، ونک …» already names the city; do not print it twice.
  const city = address.city && !address.address?.includes(address.city) ? address.city : null
  const place = [city, address.address].filter(Boolean).join(locale === 'fa' ? '، ' : ', ')
  return address.postalCode ? `${place} · ${postalCodeLabel}: ${address.postalCode}` : place
}

/** Metadata with the confirmed address written in; null when nothing changes. */
export function withContactAddress(
  metadata: unknown,
  input: Partial<ContactAddress> | null | undefined,
  source: string,
  now: Date = new Date(),
): MetadataRecord | null {
  const next = cleanContactAddress(input)
  if (!next) return null
  const root = asRecord(metadata)
  const current = cleanContactAddress(asRecord(root.shippingAddress) as Partial<ContactAddress>)
  // A city alone («ارسال به شیراز») must not erase a full address on file.
  const merged: ContactAddress = next.address
    ? next
    : { ...(current ?? next), city: next.city ?? current?.city ?? null, province: next.province ?? current?.province ?? null }
  if (current && (Object.keys(merged) as Array<keyof ContactAddress>).every((key) => merged[key] === current[key])) return null
  return { ...root, shippingAddress: { ...merged, source, updatedAt: now.toISOString() } }
}
