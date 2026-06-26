import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { startChat } from '@/lib/ai/chat-engine'

const bodySchema = z.object({
  agentId: z.string().min(1),
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const allowed = await rateLimit(`chat:${user.workspaceId}`, 30, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }

  const agent = await prisma.agent.findFirst({
    where: { id: parsed.data.agentId, workspaceId: user.workspaceId },
    select: {
      id: true,
      systemPrompt: true,
      language: true,
      model: true,
      temperature: true,
      maxTokens: true,
      fallbackMessage: true,
    },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const result = await startChat({
    workspaceId: user.workspaceId,
    agent,
    message: parsed.data.message,
    conversationId: parsed.data.conversationId,
    channel: 'API',
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
