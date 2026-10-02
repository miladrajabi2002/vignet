import { z } from 'zod'
import {
  BUSINESS_TYPES,
  CAPABILITY_KEYS,
  capabilityLabel,
  findCapabilityByLabel,
  legacyCapabilities,
  normalizeCapabilities,
  type CapabilityKey,
} from '@/lib/verticals/registry'

export const businessProfileInputSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES),
  businessName: z.string().trim().min(2).max(120),
  /** What the panel and the agent do: stable keys, never display text. */
  capabilities: z.array(z.enum(CAPABILITY_KEYS)).min(1).max(CAPABILITY_KEYS.length),
  /** Free-text notes about the business kept from older profiles. */
  extras: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  locale: z.enum(['fa', 'en']).default('fa'),
  /** Optional site or Instagram page given during setup. */
  website: z.string().trim().max(300).optional(),
})

export type BusinessProfileInput = z.infer<typeof businessProfileInputSchema>

export interface BusinessProfile {
  businessName: string
  capabilities: CapabilityKey[]
  /** Display labels of the capabilities plus any free-text extras. */
  services: string[]
  /** Free-text entries that are not a capability. */
  extras: string[]
  /** Site or Instagram page the owner gave during setup, if any. */
  website?: string
}

function dedupe(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

/** The JSON stored on Workspace.businessProfile. */
export function normalizeBusinessProfile(input: Pick<BusinessProfileInput, 'businessName' | 'capabilities' | 'extras' | 'locale'> & { website?: string }) {
  const capabilities = normalizeCapabilities(input.capabilities)
  const extras = dedupe(input.extras ?? []).filter((extra) => !findCapabilityByLabel(extra)).slice(0, 12)
  return {
    businessName: input.businessName.trim(),
    capabilities,
    // Labels stay alongside the keys so admin views (and an older build, on
    // rollback) still read a meaningful list.
    services: [...capabilities.map((key) => capabilityLabel(key, input.locale ?? 'fa')), ...extras].slice(0, 16),
    ...(input.website?.trim() ? { website: input.website.trim() } : {}),
  }
}

/**
 * Read a stored profile. Profiles saved before capabilities were keyed only
 * hold labels; for those the keys are derived from the labels and the
 * business type, reproducing the menu they had (see legacyCapabilities).
 */
export function readBusinessProfile(value: unknown, businessType?: unknown): BusinessProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.businessName !== 'string' || !record.businessName.trim()) return null
  const services = Array.isArray(record.services)
    ? record.services.filter((service): service is string => typeof service === 'string' && Boolean(service.trim()))
    : []
  const keyed = Array.isArray(record.capabilities)
  if (!keyed && !services.length) return null
  const capabilities = keyed
    ? normalizeCapabilities(record.capabilities as unknown[])
    : legacyCapabilities(businessType, services)
  return {
    businessName: record.businessName.trim(),
    capabilities,
    services,
    extras: services.filter((service) => !findCapabilityByLabel(service)),
    ...(typeof record.website === 'string' && record.website.trim() ? { website: record.website.trim() } : {}),
  }
}

/**
 * Capabilities of a workspace row (profile JSON + type), never null. A
 * workspace that never saved a profile keeps what its type used to switch on.
 */
export function workspaceCapabilities(workspace: { businessType?: unknown; businessProfile?: unknown } | null | undefined): CapabilityKey[] {
  return readBusinessProfile(workspace?.businessProfile, workspace?.businessType)?.capabilities
    ?? legacyCapabilities(workspace?.businessType, [])
}
