import { z } from 'zod'
import { BUSINESS_TYPES } from '@/lib/verticals/registry'

export const businessProfileInputSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES),
  businessName: z.string().trim().min(2).max(120),
  services: z.array(z.string().trim().min(1).max(80)).min(1).max(16),
})

export type BusinessProfileInput = z.infer<typeof businessProfileInputSchema>

export function normalizeBusinessProfile(input: BusinessProfileInput) {
  return {
    businessName: input.businessName.trim(),
    services: Array.from(
      new Set(input.services.map((service) => service.trim()).filter(Boolean)),
    ).slice(0, 16),
  }
}

export function readBusinessProfile(value: unknown): {
  businessName: string
  services: string[]
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.businessName !== 'string' || !Array.isArray(record.services)) {
    return null
  }
  const services = record.services.filter(
    (service): service is string => typeof service === 'string' && Boolean(service.trim()),
  )
  if (!record.businessName.trim() || !services.length) return null
  return { businessName: record.businessName.trim(), services }
}
