import { describe, expect, it } from 'vitest'
import { getRecommendedAgentPreset } from '@/lib/agents/recommended-preset'
import { getBusinessGoals } from '@/lib/ai/prompt-builder'

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

  it('narrows the behavior to the chosen goals and keeps the full preset otherwise', () => {
    const goals = getBusinessGoals('COMMERCE').map((goal) => goal.key)
    const full = getRecommendedAgentPreset('COMMERCE')
    const focused = getRecommendedAgentPreset('COMMERCE', null, [goals[1]])

    expect(goals).toHaveLength(3)
    expect(getRecommendedAgentPreset('COMMERCE', null, goals).promptConfig).toEqual(full.promptConfig)
    expect(getRecommendedAgentPreset('COMMERCE', null, ['unknown']).promptConfig).toEqual(full.promptConfig)
    expect(focused.roleTemplate).toBe(full.roleTemplate)
    expect(focused.promptConfig.personality).not.toBe(full.promptConfig.personality)
  })
})
