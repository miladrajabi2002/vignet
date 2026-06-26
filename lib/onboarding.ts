import { prisma } from '@/lib/prisma'

/** Cookie that hides the onboarding flow without marking it complete. */
export const ONBOARDING_SKIP_COOKIE = 'onboarding_skipped'

export interface OnboardingState {
  step: number // highest contiguous completed step (0-5)
  completed: boolean
  checks: {
    hasKey: boolean // 1. OpenRouter key
    hasAgent: boolean // 2. first agent
    hasKnowledge: boolean // 3. knowledge or products
    hasChannel: boolean // 4. connected channel
    hasConversation: boolean // 5. tested agent
  }
}

/**
 * Compute the live onboarding state for a workspace from its data.
 * The "step" is the count of completed checks (they are sequential).
 */
export async function computeOnboarding(
  workspaceId: string,
): Promise<OnboardingState> {
  const [workspace, agentCount, kbCount, productCount, channelCount, convCount] =
    await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { openrouterKeyEnc: true },
      }),
      prisma.agent.count({ where: { workspaceId } }),
      prisma.knowledgeBase.count({ where: { workspaceId } }),
      prisma.product.count({ where: { workspaceId } }),
      prisma.agentChannel.count({ where: { agent: { workspaceId } } }),
      prisma.conversation.count({ where: { workspaceId } }),
    ])

  const checks = {
    hasKey: !!workspace?.openrouterKeyEnc,
    hasAgent: agentCount >= 1,
    hasKnowledge: kbCount >= 1 || productCount >= 1,
    hasChannel: channelCount >= 1,
    hasConversation: convCount >= 1,
  }

  // Steps are sequential — count completed in order.
  const ordered = [
    checks.hasKey,
    checks.hasAgent,
    checks.hasKnowledge,
    checks.hasChannel,
    checks.hasConversation,
  ]
  let step = 0
  for (const ok of ordered) {
    if (!ok) break
    step++
  }

  return { step, completed: step >= 5, checks }
}

/**
 * Recompute onboarding state and persist it to the workspace.
 * Call this opportunistically from API routes after relevant mutations.
 */
export async function syncOnboarding(
  workspaceId: string,
): Promise<OnboardingState> {
  const state = await computeOnboarding(workspaceId)
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { onboardingStep: state.step, onboardingCompleted: state.completed },
  })
  return state
}
