import { requireUser } from '@/lib/session'
import { syncOnboarding } from '@/lib/onboarding'
import { prisma } from '@/lib/prisma'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { getVerticalPack } from '@/lib/verticals/registry'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

export default async function OnboardingPage() {
  const user = await requireUser()

  const state = await syncOnboarding(user.workspaceId)
  const [workspace, firstAgent] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: user.workspaceId },
      select: { name: true, businessType: true, businessProfile: true },
    }),
    prisma.agent.findFirst({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
  ])
  const businessProfile = readBusinessProfile(workspace.businessProfile)
  const hasProfile = !!businessProfile && !!workspace.businessType
  const pack = workspace.businessType ? getVerticalPack(workspace.businessType) : null

  return (
    <OnboardingFlow
      hasProfile={hasProfile}
      hasAgent={state.checks.hasAgent}
      hasKnowledge={state.checks.hasKnowledge}
      hasChannel={state.checks.hasChannel}
      agentId={firstAgent?.id ?? null}
      workspaceName={workspace.name}
      businessType={workspace.businessType}
      businessProfile={businessProfile}
      agentTemplate={pack?.agentTemplate}
    />
  )
}
