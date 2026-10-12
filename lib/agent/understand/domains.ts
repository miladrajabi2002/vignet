/**
 * What a verified reading routes on a turn. The understanding layer is the
 * only router: every turn is read, and a turn whose reading could not be
 * obtained is answered as a plain conversation turn, not routed by guesswork.
 */
export const UNDERSTANDING_DOMAINS = ['products', 'orders', 'bookings', 'courses', 'restock', 'tracking', 'handoff', 'state', 'insights'] as const
export type UnderstandingDomain = (typeof UNDERSTANDING_DOMAINS)[number]

/**
 * Per-attempt limit of the understanding call. Each attempt goes to the next
 * provider of the curated order, where a reading takes about 1–3 s; the limit
 * only has to catch a stalled one.
 */
export const UNDERSTANDING_TIMEOUT_MS = 8_000
