import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { draftAnswer } from '@/lib/ai/learning'
import { rateLimit } from '@/lib/ratelimit'

type Params = { params: { agentId: string } }

const bodySchema = z.object({ question: z.string().min(1).max(2000) })

/** Generate an AI-suggested answer for an unanswered question. */
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // Drafting calls the model — cap it per workspace.
  const allowed = await rateLimit(`learn:${user.workspaceId}`, 30, 60)
  if (!allowed) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, systemPrompt: true, language: true, model: true, temperature: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const result = await draftAnswer(user.workspaceId, agent, parsed.data.question)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ answer: result.answer })
}
