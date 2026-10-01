/**
 * Adds one capability (a BUSINESS_SERVICE_OPTIONS key such as `bookings`) to
 * the business profile so its section appears in the menu.
 */
export async function enableCapability(key: string, locale: 'fa' | 'en' = 'fa'): Promise<boolean> {
  const response = await fetch('/api/workspace/capabilities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ add: key, locale }),
  }).catch(() => null)
  return Boolean(response?.ok)
}

/** Turns on bookings («رزرو و نوبت‌دهی»). */
export function enableBookingModule(locale: 'fa' | 'en' = 'fa'): Promise<boolean> {
  return enableCapability('bookings', locale)
}

/** Full navigation so the server-rendered menu picks up the new section. */
export function openBookingSetup(serviceId?: string) {
  const query = new URLSearchParams({ tab: 'services' })
  if (serviceId) query.set('edit', serviceId)
  window.location.assign(`/appointments?${query}`)
}
