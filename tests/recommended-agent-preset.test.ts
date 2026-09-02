import { describe, expect, it } from 'vitest'
import { getRecommendedAgentPreset } from '@/lib/agents/recommended-preset'

describe('recommended onboarding agent preset', () => {
  it('builds a business-specific Persian agent without asking for a description', () => {
    const preset = getRecommendedAgentPreset('COMMERCE', 'فروشگاه مهر')

    expect(preset.name).toContain('فروشگاه مهر')
    expect(preset.roleTemplate).toBe('commerce_recommended')
    expect(preset.language).toBe('fa')
    expect(preset).not.toHaveProperty('description')
  })

  it('enables lead collection for appointment businesses', () => {
    const preset = getRecommendedAgentPreset('APPOINTMENTS')

    expect(preset.requireCustomerInfo).toBe(true)
    expect(preset.handoffEnabled).toBe(true)
  })
})
