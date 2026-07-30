import { describe, expect, it } from 'vitest'
import { getOnboardingProgress } from '@/lib/onboarding-progress'

const emptySignals = {
  completed: false,
  hasProfile: false,
  hasAgent: false,
  hasKnowledge: false,
  hasChannel: false,
}

describe('admin onboarding progress', () => {
  it('reports the first live prerequisite instead of trusting a stored step number', () => {
    expect(getOnboardingProgress(emptySignals).stageKey).toBe('PROFILE')
    expect(getOnboardingProgress({
      ...emptySignals,
      hasProfile: true,
      hasAgent: true,
    }).stageKey).toBe('KNOWLEDGE')
  })

  it('keeps the first missing prerequisite for non-contiguous legacy data', () => {
    const progress = getOnboardingProgress({
      ...emptySignals,
      hasAgent: true,
      hasKnowledge: true,
    })

    expect(progress.stageKey).toBe('PROFILE')
    expect(progress.completedMilestones).toBe(2)
  })

  it('separates ready-to-finish users from users missing setup data', () => {
    const progress = getOnboardingProgress({
      completed: false,
      hasProfile: true,
      hasAgent: true,
      hasKnowledge: true,
      hasChannel: true,
    })

    expect(progress.stageKey).toBe('FINISH')
    expect(progress.readyToFinish).toBe(true)
  })

  it('keeps an already completed legacy onboarding authoritative', () => {
    const progress = getOnboardingProgress({
      ...emptySignals,
      completed: true,
    })

    expect(progress.stageKey).toBe('COMPLETED')
    expect(progress.completedMilestones).toBe(progress.totalMilestones)
  })
})
