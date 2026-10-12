/**
 * Which OpenRouter providers serve a model, and in what order.
 *
 * One model is served by many providers that differ several-fold in speed and
 * price. OpenRouter's own sorts (price / latency / throughput) each optimise
 * one thing, and its «latency» is time to the first token, not to the whole
 * reply. The curated order below is measured end to end
 * (scripts/benchmark-providers.ts): best first, the next one when a provider
 * fails, and any other provider after the list as a last resort.
 */

export type ProviderSort = 'price' | 'latency' | 'throughput'

export interface ProviderRouting {
  /** 'order' tries the curated list of the model in sequence; 'sort' leaves the choice to OpenRouter. */
  mode: 'order' | 'sort'
  /** OpenRouter's own ordering: used in 'sort' mode and for models without a curated list. */
  sort: ProviderSort
  /** Provider slugs per model id, best first. */
  orders: Record<string, string[]>
}

export const PROVIDER_SORTS: readonly ProviderSort[] = ['price', 'latency', 'throughput']
export const MAX_PROVIDER_ORDER = 8
const PROVIDER_SLUG_RE = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9.-]*)?$/

/** What was measured for one provider of one model. */
export interface ProviderBenchmark {
  slug: string
  /** Median time of a turn-reading request (≈3k tokens in, ≈100 out). */
  medianMs: number
  /** Real cost of that request in USD, cache discounts included. */
  costUSD: number
  /** Routing accuracy (%) on the 162-case understanding evaluation, where it was run. */
  accuracy?: number
}

/**
 * Measured on 2026-10-12, best first. Rows with an accuracy were scored on
 * the full understanding evaluation (scripts/eval-understanding.ts
 * --provider …, 162 requests); the others on 6 requests
 * (scripts/benchmark-providers.ts). Providers that failed or returned a
 * malformed reply in any run are left out. The order weighs the median time,
 * the slow tail and the cost per request together; the first five of each
 * model are its default order.
 */
export const PROVIDER_BENCHMARKS: Record<string, ProviderBenchmark[]> = {
  'deepseek/deepseek-v4-flash': [
    { slug: 'relace/fp4', medianMs: 778, costUSD: 0.000213, accuracy: 92.0 },
    { slug: 'baidu/fp8', medianMs: 1455, costUSD: 0.000133, accuracy: 92.6 },
    { slug: 'gmicloud/fp8', medianMs: 2226, costUSD: 0.000095, accuracy: 93.8 },
    { slug: 'streamlake/fp8', medianMs: 2840, costUSD: 0.000082, accuracy: 93.2 },
    { slug: 'siliconflow/fp8', medianMs: 2350, costUSD: 0.000151, accuracy: 94.4 },
    { slug: 'azure/us', medianMs: 1894, costUSD: 0.000193, accuracy: 92.6 },
    { slug: 'parasail/fp8', medianMs: 2427, costUSD: 0.000305 },
    { slug: 'digitalocean', medianMs: 4158, costUSD: 0.000237 },
    { slug: 'venice', medianMs: 4626, costUSD: 0.000301 },
    { slug: 'mancer/fp8', medianMs: 4454, costUSD: 0.000603 },
  ],
  'deepseek/deepseek-v4.1-flash': [
    { slug: 'digitalocean', medianMs: 842, costUSD: 0.000074, accuracy: 96.3 },
    { slug: 'together', medianMs: 513, costUSD: 0.000119, accuracy: 95.1 },
    { slug: 'deepinfra/fp8', medianMs: 1137, costUSD: 0.000061, accuracy: 96.3 },
    { slug: 'ionstream', medianMs: 1021, costUSD: 0.000088, accuracy: 95.7 },
    { slug: 'inference-net/fp8', medianMs: 714, costUSD: 0.000113, accuracy: 95.7 },
    { slug: 'wafer', medianMs: 1063, costUSD: 0.000167, accuracy: 95.7 },
    { slug: 'siliconflow/fp8', medianMs: 1739, costUSD: 0.000128 },
    { slug: 'atlas-cloud/fp8', medianMs: 1362, costUSD: 0.00018 },
    { slug: 'streamlake/fp8', medianMs: 1646, costUSD: 0.000132 },
    { slug: 'coreweave/fp8', medianMs: 698, costUSD: 0.000318 },
    { slug: 'morph/fp8', medianMs: 2050, costUSD: 0.000094 },
    { slug: 'gmicloud/fp8', medianMs: 2212, costUSD: 0.000168 },
  ],
}

/** The five best providers of each model by speed and price together. */
export const DEFAULT_PROVIDER_ORDERS: Record<string, string[]> = Object.fromEntries(
  Object.entries(PROVIDER_BENCHMARKS).map(([model, rows]) => [model, rows.slice(0, 5).map((row) => row.slug)]),
)

export const DEFAULT_PROVIDER_ROUTING: ProviderRouting = {
  mode: 'order',
  sort: 'latency',
  orders: DEFAULT_PROVIDER_ORDERS,
}

function isSort(value: unknown): value is ProviderSort {
  return typeof value === 'string' && (PROVIDER_SORTS as readonly string[]).includes(value)
}

export function isProviderSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 60 && PROVIDER_SLUG_RE.test(value)
}

function cleanOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isProviderSlug))].slice(0, MAX_PROVIDER_ORDER)
}

export function normalizeProviderRouting(input: unknown): ProviderRouting {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
  const stored = value.orders && typeof value.orders === 'object' && !Array.isArray(value.orders)
    ? value.orders as Record<string, unknown>
    : {}
  return {
    mode: value.mode === 'sort' ? 'sort' : 'order',
    sort: isSort(value.sort) ? value.sort : DEFAULT_PROVIDER_ROUTING.sort,
    // A model the panel never saved keeps the measured default.
    orders: {
      ...DEFAULT_PROVIDER_ORDERS,
      ...Object.fromEntries(Object.entries(stored).slice(0, 20).map(([model, order]) => [model, cleanOrder(order)])),
    },
  }
}

/**
 * The routing is kept in the settings row's `providerSort` text column, as
 * JSON. A row saved before the curated order existed holds a bare sort
 * («latency»): that sort is kept and the curated order becomes active.
 */
export function parseProviderRouting(stored: string | null | undefined): ProviderRouting {
  const raw = stored?.trim() ?? ''
  if (isSort(raw)) return { ...DEFAULT_PROVIDER_ROUTING, sort: raw }
  if (!raw.startsWith('{')) return DEFAULT_PROVIDER_ROUTING
  try {
    return normalizeProviderRouting(JSON.parse(raw))
  } catch {
    return DEFAULT_PROVIDER_ROUTING
  }
}

export function serializeProviderRouting(routing: ProviderRouting): string {
  return JSON.stringify(normalizeProviderRouting(routing))
}

/**
 * The `provider` preferences of one request. `attempt` rotates the curated
 * order, so a retry after a slow or failed attempt starts at the next
 * provider instead of asking the same one again.
 */
export function providerPreferences(
  model: string,
  routing: ProviderRouting,
  options: { attempt?: number; sort?: ProviderSort; only?: string } = {},
): { order: string[] } | { sort: ProviderSort } | { only: string[] } {
  // Evaluation runs pin one provider, or score one of OpenRouter's sorts.
  if (options.only) return { only: [options.only] }
  if (options.sort) return { sort: options.sort }
  const order = routing.mode === 'order' ? routing.orders[model] ?? [] : []
  if (!order.length) return { sort: routing.sort }
  const shift = Math.max(0, Math.floor(options.attempt ?? 0)) % order.length
  return { order: [...order.slice(shift), ...order.slice(0, shift)] }
}
