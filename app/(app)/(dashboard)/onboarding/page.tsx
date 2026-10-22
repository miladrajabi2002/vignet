import type { Metadata } from 'next'
import { requireUser } from '@/lib/session'
import { syncOnboarding } from '@/lib/onboarding'
import { prisma } from '@/lib/prisma'
import { readBusinessProfile, workspaceCapabilities } from '@/lib/verticals/profile'
import { getVerticalPack } from '@/lib/verticals/registry'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'
import { getRecommendedAgentPreset } from '@/lib/agents/recommended-preset'

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}

export default async function OnboardingPage() {
  const user = await requireUser()

  const state = await syncOnboarding(user.workspaceId)
  const [workspace, firstAgent, instagramChannel, productCount, serviceCount] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: user.workspaceId },
      select: { businessType: true, businessProfile: true },
    }),
    prisma.agent.findFirst({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    // Same test the Instagram page uses to send a connected account back here.
    prisma.agentChannel.findFirst({
      where: { type: 'INSTAGRAM', agent: { workspaceId: user.workspaceId } },
      select: { id: true },
    }),
    prisma.product.count({ where: { workspaceId: user.workspaceId, active: true } }),
    prisma.service.count({ where: { workspaceId: user.workspaceId, active: true } }),
  ])
  const businessProfile = readBusinessProfile(workspace.businessProfile, workspace.businessType)
  const hasProfile = !!businessProfile && !!workspace.businessType
  const pack = workspace.businessType ? getVerticalPack(workspace.businessType) : null
  const preset = getRecommendedAgentPreset(workspace.businessType, businessProfile?.businessName)
  // The finish screen leads with whatever the agent cannot sell without.
  const capabilities = workspaceCapabilities(workspace)
  const firstNeed = capabilities.includes('products') && productCount === 0
    ? 'products' as const
    : (capabilities.includes('bookings') || capabilities.includes('services')) && serviceCount === 0
      ? 'services' as const
      : null

  return (
    <OnboardingFlow
      hasProfile={hasProfile}
      hasAgent={state.checks.hasAgent}
      hasKnowledge={state.checks.hasKnowledge}
      hasChannel={state.checks.hasChannel}
      instagramConnected={Boolean(instagramChannel)}
      agentId={firstAgent?.id ?? null}
      businessType={workspace.businessType}
      businessProfile={businessProfile}
      agentTemplate={pack?.agentTemplate}
      agentPreset={{ name: preset.name, welcomeMessage: preset.welcomeMessage, requireCustomerInfo: preset.requireCustomerInfo }}
      firstNeed={firstNeed}
    />
  )
}
