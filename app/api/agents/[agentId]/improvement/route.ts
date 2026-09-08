import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { improvementOverview, publicError, retryImprovement, startImprovement } from '@/lib/improvement/service'
import { conversationWhere, draftSchema, json, selectionSchema, settingsSchema } from '@/lib/improvement/types'
import { applyImprovement, prepareImprovementKnowledge, previewImprovement, revertImprovement, saveImprovementDraft } from '@/lib/improvement/actions'

type Props = { params: Promise<{ agentId: string }> }
const identity = { id: z.string().min(1).max(100), version: z.number().int().min(1) }
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), selection: selectionSchema }),
  z.object({ action: z.literal('estimate'), selection: selectionSchema }),
  z.object({ action: z.literal('settings'), settings: settingsSchema }),
  z.object({ action: z.literal('save'), ...identity, draft: draftSchema }),
  z.object({ action: z.literal('preview'), ...identity }),
  z.object({ action: z.literal('apply'), ...identity }),
  z.object({ action: z.literal('dismiss'), ...identity }),
  z.object({ action: z.literal('revert'), id: identity.id }),
  z.object({ action: z.literal('retry'), id: identity.id }),
  z.object({ action: z.literal('cancel'), id: identity.id }),
  z.object({ action: z.literal('ingest'), id: identity.id }),
])
export async function GET(req: Request, props: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { agentId } = await props.params
  const agent = await prisma.agent.findFirst({ where: { id: agentId, workspaceId: user.workspaceId }, select: { improvementSettings: true } })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const url = new URL(req.url)
  const runId = url.searchParams.get('runId')
  if (runId) {
    const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1))
    const where = { runId, run: { workspaceId: user.workspaceId, agentId } }
    const [reviews, total] = await Promise.all([
      prisma.improvementReview.findMany({ where, orderBy: { id: 'asc' }, skip: (page - 1) * 25, take: 25,
        select: { id: true, conversationId: true, status: true, error: true, result: true,
          conversation: { select: { channel: true, contact: { select: { name: true } } } } } }),
      prisma.improvementReview.count({ where }),
    ])
    return NextResponse.json({ reviews, total }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('suggestionPage')) || 1))
  const overview = await improvementOverview(user.workspaceId, agentId, page, url.searchParams.get('history') === '1', Math.max(1, Math.min(10000, Number(url.searchParams.get('runPage')) || 1)))
  return NextResponse.json({ ...overview, settings: settingsSchema.parse(agent.improvementSettings ?? {}) }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: Request, props: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { agentId } = await props.params
  const agent = await prisma.agent.findFirst({ where: { id: agentId, workspaceId: user.workspaceId }, select: { id: true } })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const input = parsed.data
  const expensive = input.action === 'start' || input.action === 'preview' || input.action === 'retry'
  if (!(await rateLimit(`improvement:${expensive ? 'ai' : 'edit'}:${user.workspaceId}`, expensive ? 12 : 80, 60))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  try {
    const w = user.workspaceId
    switch (input.action) {
      case 'estimate': {
        const conversations = await prisma.conversation.findMany({ where: conversationWhere(w, agentId, input.selection),
          orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
          take: input.selection.mode === 'selected' ? input.selection.ids.length : input.selection.count, select: { id: true } })
        if (!conversations.length) throw new Error('NO_CONVERSATIONS')
        const sizes = await prisma.$queryRaw<Array<{ chars: bigint }>>`SELECT SUM(LENGTH(content)) AS chars FROM "Message" WHERE "conversationId" IN (${Prisma.join(conversations.map((c) => c.id))}) AND role IN ('USER', 'ASSISTANT') GROUP BY "conversationId"`
        const segments = sizes.reduce((sum, r) => sum + Math.max(1, Math.ceil(Number(r.chars) / 16000)), 0)
        const chars = sizes.reduce((sum, r) => sum + Number(r.chars), 0)
        return NextResponse.json({ count: conversations.length, estimatedTokens: Math.ceil(chars / 2 + segments * 6000), segments })
      }
      case 'start': return NextResponse.json({ run: await startImprovement(w, agentId, user.id, input.selection) }, { status: 202 })
      case 'settings': await prisma.agent.update({ where: { id: agentId }, data: { improvementSettings: json({ ...input.settings, authorizedBy: user.id }) } }); break
      case 'save': await saveImprovementDraft(w, agentId, input.id, input.version, input.draft); break
      case 'preview': return NextResponse.json({ preview: await previewImprovement(w, agentId, input.id, input.version) })
      case 'apply': return NextResponse.json({ change: await applyImprovement(w, agentId, user.id, input.id, input.version) })
      case 'revert': await revertImprovement(w, agentId, input.id); break
      case 'retry': await retryImprovement(w, agentId, input.id); break
      case 'dismiss': {
        const result = await prisma.improvementSuggestion.updateMany({ where: { id: input.id, workspaceId: w, agentId, version: input.version, status: 'PENDING' }, data: { status: 'DISMISSED', version: { increment: 1 } } })
        if (!result.count) throw new Error('CONFLICT')
        break
      }
      case 'cancel': await prisma.improvementRun.updateMany({ where: { id: input.id, workspaceId: w, agentId, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'CANCELLED', finishedAt: new Date() } }); break
      case 'ingest': {
        const change = await prisma.improvementChange.findFirst({ where: { id: input.id, kind: 'KNOWLEDGE', revertedAt: null, suggestion: { workspaceId: w, agentId, status: 'APPLIED' } } })
        if (!change?.targetId) throw new Error('NOT_FOUND')
        await prepareImprovementKnowledge(change.targetId); break
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = publicError(error)
    return NextResponse.json({ error: code }, { status: code === 'NOT_FOUND' ? 404 : ['FAILED', 'QUEUE_UNAVAILABLE', 'AI_UNAVAILABLE', 'INGESTION_UNAVAILABLE'].includes(code) ? 503 : 409 })
  }
}
