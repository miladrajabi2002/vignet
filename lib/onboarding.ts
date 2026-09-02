import { prisma } from '@/lib/prisma'

export interface OnboardingState {
  step: number // highest contiguous completed setup step (0-3)
  completed: boolean
  checks: {
    hasAgent: boolean // 1. first agent
    hasKnowledge: boolean // 2. knowledge/products, or explicitly postponed
    hasChannel: boolean // 3. connected channel, or explicitly postponed
    knowledgeSkipped: boolean
    channelSkipped: boolean
  }
}

/**
 * Compute the live onboarding state for a workspace from its data.
 * The "step" is the count of completed checks (they are sequential).
 */
export async function computeOnboarding(
  workspaceId: string,
): Promise<OnboardingState> {
  const [agentCount, kbCount, productCount, serviceCount, channelCount, workspace] =
    await Promise.all([
      prisma.agent.count({ where: { workspaceId } }),
      prisma.knowledgeBase.count({ where: { workspaceId } }),
      prisma.product.count({ where: { workspaceId } }),
      prisma.service.count({ where: { workspaceId } }),
      prisma.agentChannel.count({ where: { agent: { workspaceId } } }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { onboardingKnowledgeSkipped: true, onboardingChannelSkipped: true },
      }),
    ])

  const checks = {
    hasAgent: agentCount >= 1,
    hasKnowledge: kbCount >= 1 || productCount >= 1 || serviceCount >= 1 || !!workspace?.onboardingKnowledgeSkipped,
    hasChannel: channelCount >= 1 || !!workspace?.onboardingChannelSkipped,
    knowledgeSkipped: !!workspace?.onboardingKnowledgeSkipped && kbCount === 0 && productCount === 0 && serviceCount === 0,
    channelSkipped: !!workspace?.onboardingChannelSkipped && channelCount === 0,
  }

  // Steps are sequential — count completed in order.
  const ordered = [
    checks.hasAgent,
    checks.hasKnowledge,
    checks.hasChannel,
  ]
  let step = 0
  for (const ok of ordered) {
    if (!ok) break
    step++
  }

  return { step, completed: step >= 3, checks }
}

/**
 * Recompute onboarding state and persist progress. Completion is intentionally
 * confirmed by the owner from the final onboarding screen, so connecting a
 * channel never swaps the shell underneath an in-progress task.
 * Call this opportunistically from API routes after relevant mutations.
 */
export async function syncOnboarding(
  workspaceId: string,
): Promise<OnboardingState> {
  const state = await computeOnboarding(workspaceId)
  await prisma.workspace.updateMany({
    where: { id: workspaceId, onboardingStep: { not: state.step } },
    data: {
      onboardingStep: state.step,
      onboardingStepUpdatedAt: new Date(),
    },
  })
  return state
}
