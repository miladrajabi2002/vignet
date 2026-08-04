export interface OnboardingProgressSignals {
  completed: boolean
  hasProfile: boolean
  hasAgent: boolean
  hasKnowledge: boolean
  hasChannel: boolean
}

const SETUP_STAGES = [
  { key: 'PROFILE', labelFa: 'اطلاعات کسب‌وکار' },
  { key: 'AGENT', labelFa: 'ساخت ایجنت' },
  { key: 'KNOWLEDGE', labelFa: 'دانش و محصولات' },
  { key: 'CHANNEL', labelFa: 'اتصال کانال' },
] as const

/**
 * Turns live or persisted onboarding signals into one admin-facing status.
 * This is intentionally pure so existing users can be classified without a
 * migration or rewriting their workspace rows.
 */
export function getOnboardingProgress(signals: OnboardingProgressSignals) {
  if (signals.completed) {
    return {
      stageKey: 'COMPLETED' as const,
      labelFa: 'فعال‌شده',
      completedMilestones: SETUP_STAGES.length,
      totalMilestones: SETUP_STAGES.length,
      readyToFinish: false,
    }
  }

  const completedByKey = {
    PROFILE: signals.hasProfile,
    AGENT: signals.hasAgent,
    KNOWLEDGE: signals.hasKnowledge,
    CHANNEL: signals.hasChannel,
  } satisfies Record<(typeof SETUP_STAGES)[number]['key'], boolean>

  const completedMilestones = SETUP_STAGES.filter(
    (stage) => completedByKey[stage.key],
  ).length
  const nextStage = SETUP_STAGES.find((stage) => !completedByKey[stage.key])

  if (nextStage) {
    return {
      stageKey: nextStage.key,
      labelFa: nextStage.labelFa,
      completedMilestones,
      totalMilestones: SETUP_STAGES.length,
      readyToFinish: false,
    }
  }

  return {
    stageKey: 'FINISH' as const,
    labelFa: 'تأیید نهایی راه‌اندازی',
    completedMilestones,
    totalMilestones: SETUP_STAGES.length,
    readyToFinish: true,
  }
}
