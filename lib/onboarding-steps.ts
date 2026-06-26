import type { OnboardingState } from '@/lib/onboarding'

export type OnboardingCheckKey = keyof OnboardingState['checks']

export interface OnboardingStepMeta {
  key: 'key' | 'agent' | 'knowledge' | 'channel' | 'test'
  href: string
  check: OnboardingCheckKey
}

/** Ordered activation steps shared by the widget and the onboarding page. */
export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { key: 'key', href: '/settings/ai-keys', check: 'hasKey' },
  { key: 'agent', href: '/agents/new', check: 'hasAgent' },
  { key: 'knowledge', href: '/products', check: 'hasKnowledge' },
  { key: 'channel', href: '/agents', check: 'hasChannel' },
  { key: 'test', href: '/agents', check: 'hasConversation' },
]

export const ONBOARDING_TOTAL = ONBOARDING_STEPS.length
