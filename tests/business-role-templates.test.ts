import { describe, expect, it } from 'vitest'
import {
  getRoleTemplate,
  getRoleTemplatesForBusiness,
  getSuggestedRoleTemplate,
} from '@/lib/ai/prompt-builder'
import { BUSINESS_TYPES } from '@/lib/verticals/registry'
import { agentCreateSchema, promptConfigSchema } from '@/lib/validations/agent'

describe('business-specific role templates', () => {
  it.each(BUSINESS_TYPES)('shows only one complete %s recommendation plus custom', (businessType) => {
    const templates = getRoleTemplatesForBusiness(businessType)

    expect(templates).toHaveLength(2)
    expect(templates[0]?.key).toMatch(/_recommended$/)
    expect(templates[0]?.nameFa).toBe('پیشنهادی برای کسب‌وکار شما')
    expect(templates[0]?.config.personality.length).toBeGreaterThan(0)
    expect(templates[0]?.config.doSay.length).toBeGreaterThan(3)
    expect(templates[0]?.config.dontSay.length).toBeGreaterThan(3)
    expect(templates[0]?.config.qaPairs.length).toBeGreaterThan(2)
    expect(promptConfigSchema.safeParse(templates[0]?.config).success).toBe(true)
    expect(templates[1]?.key).toBe('custom')
  })

  it('keeps every recommended role resolvable and accepted by agent creation', () => {
    for (const businessType of BUSINESS_TYPES) {
      const template = getRoleTemplatesForBusiness(businessType)[0]!
      expect(getRoleTemplate(template.key)?.key).toBe(template.key)
      expect(agentCreateSchema.safeParse({ name: 'Test agent', roleTemplate: template.key }).success).toBe(true)
    }
  })

  it('maps every Vigento role to the complete recommendation', () => {
    expect(getSuggestedRoleTemplate('COMMERCE', 'sales_consultant').key).toBe('commerce_recommended')
    expect(getSuggestedRoleTemplate('APPOINTMENTS', 'lead_capture').key).toBe('appointments_recommended')
    expect(getSuggestedRoleTemplate('SUPPORT', 'support_specialist').key).toBe('support_recommended')
  })

  it('maps previously saved split roles to the new complete recommendation', () => {
    expect(getRoleTemplate('commerce_after_sales')?.key).toBe('commerce_recommended')
    expect(getRoleTemplate('food_booking_host')?.key).toBe('food_recommended')
    expect(getRoleTemplate('education_student_support')?.key).toBe('education_recommended')
  })
})
