import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { computeOnboarding, syncOnboarding } from '@/lib/onboarding'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const state = await computeOnboarding(user.workspaceId)
  return NextResponse.json(state)
}

// Recompute onboarding conditions server-side and persist the result.
export async function PATCH() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const state = await syncOnboarding(user.workspaceId)
  return NextResponse.json(state)
}
