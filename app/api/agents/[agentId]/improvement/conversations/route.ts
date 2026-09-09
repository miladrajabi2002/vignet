import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { conversationWhere, selectionSchema, withImprovementFreshness } from '@/lib/improvement/types'

export async function GET(req: Request, props: { params: Promise<{ agentId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { agentId } = await props.params
  if (!(await prisma.agent.count({ where: { id: agentId, workspaceId: user.workspaceId } }))) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const p = new URL(req.url).searchParams
  const parsed = selectionSchema.safeParse({ search: p.get('search') ?? '', channel: p.get('channel') || undefined,
    attention: p.get('attention') || 'all', from: p.get('from') || undefined, to: p.get('to') || undefined, contactId: p.get('contactId') || undefined,
    includeReviewed: p.get('includeReviewed') === 'true' })
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const page = Math.max(1, Math.min(10000, Number(p.get('page')) || 1))
  const where = withImprovementFreshness(
    conversationWhere(user.workspaceId, agentId, parsed.data),
    parsed.data.includeReviewed,
    prisma.conversation.fields.lastImprovementReviewAt,
  )
  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({ where, orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip: (page - 1) * 25, take: 25,
      select: { id: true, channel: true, status: true, messageCount: true, lastMessageAt: true, contactId: true,
        contact: { select: { name: true, phone: true } }, messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { content: true } } } }),
    prisma.conversation.count({ where }),
  ])
  return NextResponse.json({ conversations: conversations.map((c) => ({ ...c, messages: c.messages.map((m) => ({ content: m.content.slice(0, 250) })) })), total }, { headers: { 'Cache-Control': 'no-store' } })
}
