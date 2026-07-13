import { describe, expect, it } from 'vitest'
import {
  getRoleTemplate,
  getRoleTemplatesForBusiness,
  getSuggestedRoleTemplate,
} from '@/lib/ai/prompt-builder'
import { BUSINESS_TYPES } from '@/lib/verticals/registry'
import { agentCreateSchema } from '@/lib/validations/agent'

describe('business-specific role templates', () => {
  it.each(BUSINESS_TYPES)('shows exactly three %s roles plus custom', (businessType) => {
    const templates = getRoleTemplatesForBusiness(businessType)

    expect(templates).toHaveLength(4)
    expect(templates.slice(0, 3).every((template) => template.key !== 'custom')).toBe(true)
    expect(templates[3]?.key).toBe('custom')
    expect(new Set(templates.map((template) => template.key)).size).toBe(4)
    expect(templates.slice(0, 3).every((template) => template.config.personality.length > 0)).toBe(true)
  })

  it('keeps all business role keys resolvable and accepted by agent creation', () => {
    for (const businessType of BUSINESS_TYPES) {
      for (const template of getRoleTemplatesForBusiness(businessType).slice(0, 3)) {
        expect(getRoleTemplate(template.key)?.key).toBe(template.key)
        expect(agentCreateSchema.safeParse({ name: 'Test agent', roleTemplate: template.key }).success).toBe(true)
      }
    }
  })

  it('maps generic Vigento roles to a relevant role in the selected vertical', () => {
    expect(getSuggestedRoleTemplate('COMMERCE', 'sales_consultant').key).toBe('commerce_sales')
    expect(getSuggestedRoleTemplate('APPOINTMENTS', 'lead_capture').key).toBe('appointments_reception')
    expect(getSuggestedRoleTemplate('SUPPORT', 'support_specialist').key).toBe('support_frontline')
  })
})
