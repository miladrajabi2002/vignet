/**
 * Rollout switch for the turn-understanding layer.
 *
 *   off    — the legacy regex router decides everything (no model call).
 *   shadow — the model reads every turn and both readings are logged
 *            (TurnUnderstandingLog), but routing stays legacy.
 *   on     — routing comes from the verified model reading, domain by
 *            domain; any turn without a usable reading falls back to legacy.
 *
 * Precedence: per-workspace override → platform setting (admin panel,
 * PlatformAiSettings.understandingConfig) → default («on»). The admin panel
 * is the only switch: no environment variable can force a mode, so a stale
 * line in a server .env can never silently turn the layer off after a deploy.
 * (AGENT_UNDERSTANDING_DISABLED=1 stays as the emergency stop for the model
 * call itself; every turn then answers through the legacy path.)
 */
import { prisma } from '@/lib/prisma'

export type UnderstandingMode = 'off' | 'shadow' | 'on'

export const UNDERSTANDING_DOMAINS = ['products', 'orders', 'bookings', 'courses', 'restock', 'tracking', 'handoff', 'state', 'insights'] as const
export type UnderstandingDomain = (typeof UNDERSTANDING_DOMAINS)[number]

export interface UnderstandingConfig {
  mode: UnderstandingMode
  domains: Record<UnderstandingDomain, boolean>
  /** Per-attempt provider timeout for the understanding call. */
  timeoutMs: number
  /** workspaceId → mode, for gradual rollout or a per-tenant opt-out. */
  workspaces: Record<string, UnderstandingMode>
}

export const DEFAULT_UNDERSTANDING_CONFIG: UnderstandingConfig = {
  mode: 'on',
  domains: Object.fromEntries(UNDERSTANDING_DOMAINS.map((domain) => [domain, true])) as Record<UnderstandingDomain, boolean>,
  timeoutMs: 6_000,
  workspaces: {},
}

function isMode(value: unknown): value is UnderstandingMode {
  return value === 'off' || value === 'shadow' || value === 'on'
}

export function parseUnderstandingConfig(raw: unknown): UnderstandingConfig {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const domainsRaw = value.domains && typeof value.domains === 'object' && !Array.isArray(value.domains)
    ? value.domains as Record<string, unknown>
    : {}
  const workspacesRaw = value.workspaces && typeof value.workspaces === 'object' && !Array.isArray(value.workspaces)
    ? value.workspaces as Record<string, unknown>
    : {}
  const timeout = typeof value.timeoutMs === 'number' && Number.isFinite(value.timeoutMs) ? value.timeoutMs : DEFAULT_UNDERSTANDING_CONFIG.timeoutMs
  return {
    mode: isMode(value.mode) ? value.mode : DEFAULT_UNDERSTANDING_CONFIG.mode,
    domains: Object.fromEntries(UNDERSTANDING_DOMAINS.map((domain) => [
      domain,
      typeof domainsRaw[domain] === 'boolean' ? domainsRaw[domain] : DEFAULT_UNDERSTANDING_CONFIG.domains[domain],
    ])) as Record<UnderstandingDomain, boolean>,
    timeoutMs: Math.min(15_000, Math.max(1_500, Math.round(timeout))),
    workspaces: Object.fromEntries(Object.entries(workspacesRaw).filter((entry): entry is [string, UnderstandingMode] => isMode(entry[1])).slice(0, 500)),
  }
}

let cache: { value: UnderstandingConfig; expiresAt: number } | null = null

export async function getUnderstandingConfig(): Promise<UnderstandingConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.value
  let value = DEFAULT_UNDERSTANDING_CONFIG
  try {
    const row = await prisma.platformAiSettings.findUnique({ where: { id: 'primary' }, select: { understandingConfig: true } })
    value = parseUnderstandingConfig(row?.understandingConfig ?? {})
  } catch {
    // Before the migration the column does not exist: defaults apply.
  }
  cache = { value, expiresAt: Date.now() + 30_000 }
  return value
}

export async function saveUnderstandingConfig(input: UnderstandingConfig): Promise<UnderstandingConfig> {
  const value = parseUnderstandingConfig(input)
  await prisma.platformAiSettings.upsert({
    where: { id: 'primary' },
    create: { id: 'primary', understandingConfig: value as unknown as object },
    update: { understandingConfig: value as unknown as object },
  })
  cache = { value, expiresAt: Date.now() + 30_000 }
  return value
}

export function resetUnderstandingConfigCache(): void {
  cache = null
}

export interface ResolvedUnderstandingMode {
  mode: UnderstandingMode
  domains: Record<UnderstandingDomain, boolean>
  timeoutMs: number
}

export async function resolveUnderstandingMode(workspaceId: string): Promise<ResolvedUnderstandingMode> {
  const config = await getUnderstandingConfig()
  const mode = config.workspaces[workspaceId] ?? config.mode
  return { mode, domains: config.domains, timeoutMs: config.timeoutMs }
}

/** Does this domain route from the model reading on this turn? */
export function routesFromUnderstanding(resolved: ResolvedUnderstandingMode, domain: UnderstandingDomain): boolean {
  return resolved.mode === 'on' && resolved.domains[domain]
}
