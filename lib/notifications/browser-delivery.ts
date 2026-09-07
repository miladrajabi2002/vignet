interface DeliveryItem {
  id: string
  read: boolean
  createdAt: string
}

interface DeliveryState {
  through: string
  ids: string[]
  lastAlertAt: number
}

const memory = new Map<string, DeliveryState>()
const ALERT_INTERVAL_MS = 60_000

/** Consume arrivals separately from read receipts, including suppressed alerts. */
export async function claimNotificationArrivals<T extends DeliveryItem>(
  scope: string,
  items: T[],
  quiet: boolean,
): Promise<T[]> {
  const key = `vigent:notification-delivery:v1:${scope}`
  const claim = () => {
    let previous = memory.get(key)
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (stored && typeof stored.through === 'string' &&
        Array.isArray(stored.ids) && typeof stored.lastAlertAt === 'number') {
        previous = stored as DeliveryState
      }
    } catch {
      // Storage may be unavailable; keep deduplication for this page session.
    }

    // The initial visit establishes a baseline, without replaying the backlog.
    const arrivals = previous ? items.filter((item) => !item.read && (
      item.createdAt > previous.through ||
      (item.createdAt === previous.through && !previous.ids.includes(item.id))
    )) : []
    const through = items.reduce(
      (latest, item) => item.createdAt > latest ? item.createdAt : latest,
      previous?.through ?? '',
    )
    const ids = new Set(previous?.through === through ? previous.ids : [])
    for (const item of items) if (item.createdAt === through) ids.add(item.id)
    const now = Date.now()
    const show = !quiet && arrivals.length > 0 &&
      now - (previous?.lastAlertAt ?? 0) >= ALERT_INTERVAL_MS
    const next = { through, ids: [...ids], lastAlertAt: show ? now : previous?.lastAlertAt ?? 0 }
    memory.set(key, next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Best effort. */ }
    return show ? arrivals : []
  }

  // Serialize the shared storage claim so two dashboard tabs cannot both alert.
  if (navigator.locks) return navigator.locks.request(key, claim)
  return claim()
}
