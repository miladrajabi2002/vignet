import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { computeOnboarding, syncOnboarding } from '@/lib/onboarding'
import { prisma } from '@/lib/prisma'
import {
  businessProfileInputSchema,
  normalizeBusinessProfile,
  readBusinessProfile,
} from '@/lib/verticals/profile'
import { getVerticalPack } from '@/lib/verticals/registry'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const [state, workspace] = await Promise.all([
    computeOnboarding(user.workspaceId),
    prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { businessType: true, businessProfile: true },
    }),
  ])
  return NextResponse.json({
    ...state,
    businessType: workspace?.businessType ?? 'CUSTOM',
    businessProfile: readBusinessProfile(workspace?.businessProfile),
    vertical: getVerticalPack(workspace?.businessType),
  })
}

// Recompute onboarding conditions server-side and persist the result.
export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await request.json().catch(() => null)
  if (json !== null && Object.keys(json as object).length > 0) {
    const action = typeof (json as { action?: unknown }).action === 'string'
      ? (json as { action: string }).action
      : null
    if (action === 'SKIP_KNOWLEDGE' || action === 'SKIP_CHANNEL') {
      await prisma.workspace.update({
        where: { id: user.workspaceId },
        data: action === 'SKIP_KNOWLEDGE'
          ? { onboardingKnowledgeSkipped: true }
          : { onboardingChannelSkipped: true },
      })
    } else if (action === 'FINISH') {
      const state = await computeOnboarding(user.workspaceId)
      if (!state.completed) {
        return NextResponse.json({ error: 'SETUP_INCOMPLETE' }, { status: 409 })
      }
      await prisma.workspace.update({
        where: { id: user.workspaceId },
        data: { onboardingCompleted: true, onboardingStep: state.step },
      })
    } else {
    const parsed = businessProfileInputSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'INVALID', issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: {
        businessType: parsed.data.businessType,
        businessProfile: normalizeBusinessProfile(parsed.data),
      },
    })
    }
  }
  const state = await syncOnboarding(user.workspaceId)
  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { businessType: true, businessProfile: true },
  })
  return NextResponse.json({
    ...state,
    businessType: workspace?.businessType ?? 'CUSTOM',
    businessProfile: readBusinessProfile(workspace?.businessProfile),
    vertical: getVerticalPack(workspace?.businessType),
  })
}
