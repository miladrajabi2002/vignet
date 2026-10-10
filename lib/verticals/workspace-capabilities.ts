import { prisma } from '@/lib/prisma'
import { normalizeBusinessProfile, readBusinessProfile, workspaceCapabilities } from '@/lib/verticals/profile'
import { getDashboardModules, type CapabilityKey, type DashboardModuleKey } from '@/lib/verticals/registry'

// Every customer turn reads the switches; a short per-process cache keeps
// that to one query per workspace per window. A change in settings reaches
// the agent within the TTL.
const TTL_MS = 30_000
const cache = new Map<string, { at: number; value: CapabilityKey[] }>()

export async function loadWorkspaceCapabilities(workspaceId: string): Promise<CapabilityKey[]> {
  const hit = cache.get(workspaceId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { businessType: true, businessProfile: true },
  })
  const value = workspaceCapabilities(workspace)
  cache.set(workspaceId, { at: Date.now(), value })
  if (cache.size > 5_000) cache.delete(cache.keys().next().value as string)
  return value
}

export async function loadWorkspaceModules(workspaceId: string): Promise<Set<DashboardModuleKey>> {
  return new Set(getDashboardModules(await loadWorkspaceCapabilities(workspaceId)))
}

/** Drop the cached switches after the owner saves them. */
export function forgetWorkspaceCapabilities(workspaceId: string): void {
  cache.delete(workspaceId)
}

/**
 * Switches one capability on without touching the rest of the profile.
 * Idempotent: when it is already on nothing is written. Null when the
 * workspace does not exist.
 */
export async function enableWorkspaceCapability(
  workspaceId: string,
  key: CapabilityKey,
  locale: 'fa' | 'en' = 'fa',
): Promise<{ changed: boolean; capabilities: CapabilityKey[] } | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, businessType: true, businessProfile: true },
  })
  if (!workspace) return null

  const current = workspaceCapabilities(workspace)
  if (current.includes(key)) return { changed: false, capabilities: current }

  const profile = readBusinessProfile(workspace.businessProfile, workspace.businessType)
  const next = normalizeBusinessProfile({
    website: profile?.website,
    businessName: profile?.businessName ?? workspace.name,
    capabilities: [...current, key],
    extras: profile?.extras ?? [],
    locale,
  })
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { businessProfile: next },
  })
  forgetWorkspaceCapabilities(workspaceId)
  return { changed: true, capabilities: next.capabilities }
}
