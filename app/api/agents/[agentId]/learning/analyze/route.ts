import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { reviewLearningConversations } from '@/lib/ai/learning-review'

export async function POST(_req: Request, props: { params: Promise<{ agentId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { agentId } = await props.params
  const agent = await prisma.agent.findFirst({ where: { id: agentId, workspaceId: user.workspaceId }, select: { id: true, model: true, language: true } })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (!(await rateLimit(`learning-review:${user.workspaceId}`, 6, 60))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  try {
    return NextResponse.json(await reviewLearningConversations(user.workspaceId, agent))
  } catch (error) {
    console.error('[learning-review] analysis failed', error)
    return NextResponse.json({ error: error instanceof Error && error.message === 'AI_UNAVAILABLE' ? 'AI_UNAVAILABLE' : 'ANALYSIS_FAILED' }, { status: 503 })
  }
}
