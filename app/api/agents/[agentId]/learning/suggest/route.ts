import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { draftAnswer } from '@/lib/ai/learning'
import { rateLimit } from '@/lib/ratelimit'
import { LEARNING_REVIEW_VERSION, learningRecord } from '@/lib/ai/learning-candidates'

type Params = { params: Promise<{ agentId: string }> }

const bodySchema = z.object({ messageId: z.string().min(1), question: z.string().trim().min(3).max(2000) })

/** Generate an AI-suggested answer for an unanswered question. */
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // Drafting calls the model — cap it per workspace.
  const allowed = await rateLimit(`learn:${user.workspaceId}`, 30, 60)
  if (!allowed) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: {
      id: true,
      systemPrompt: true,
      promptConfig: true,
      roleTemplate: true,
      language: true,
      model: true,
      temperature: true,
    },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const source = await prisma.message.findFirst({
    where: { id: parsed.data.messageId, role: 'ASSISTANT', unanswered: true, conversation: { agentId: agent.id, workspaceId: user.workspaceId } },
    select: { metadata: true },
  })
  if (!source) return NextResponse.json({ error: 'LEARNING_SOURCE_NOT_PENDING' }, { status: 409 })
  const review = learningRecord(learningRecord(source.metadata).learningReview)
  if (review.version !== LEARNING_REVIEW_VERSION) return NextResponse.json({ error: 'LEARNING_ANALYSIS_REQUIRED' }, { status: 409 })
  if (review.eligible !== true) return NextResponse.json({ error: 'LEARNING_SOURCE_NOT_ELIGIBLE' }, { status: 422 })

  const result = await draftAnswer(user.workspaceId, agent, parsed.data.question).catch(() => ({ error: 'AI_UNAVAILABLE' as const }))
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ answer: result.answer })
}
