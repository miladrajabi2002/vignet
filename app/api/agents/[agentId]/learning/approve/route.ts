import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchIngestion } from '@/lib/queue/jobs'
import { LEARNED_PREFIX } from '@/lib/ai/learning'

type Params = { params: { agentId: string } }

const bodySchema = z.object({
  messageId: z.string().min(1),
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(8000),
})

/**
 * Approve a learned Q&A: store it as an FAQ knowledge base (which gets embedded
 * by the ingestion worker) and mark the originating message as resolved so it
 * leaves the review queue.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const { messageId, question, answer } = parsed.data
  const title = question.length > 80 ? `${question.slice(0, 80)}…` : question

  const kb = await prisma.knowledgeBase.create({
    data: {
      agentId: agent.id,
      workspaceId: user.workspaceId,
      name: `${LEARNED_PREFIX}${title}`,
      type: 'FAQ',
      status: 'PENDING',
    },
  })

  // Embed the Q&A pair as the FAQ content.
  await dispatchIngestion({
    kbId: kb.id,
    text: `سوال: ${question}\nپاسخ: ${answer}`,
  })

  // Resolve the originating message so it leaves the review queue.
  await prisma.message.updateMany({
    where: {
      id: messageId,
      conversation: { agentId: agent.id, workspaceId: user.workspaceId },
    },
    data: { unanswered: false },
  })

  return NextResponse.json({ ok: true, kbId: kb.id })
}
