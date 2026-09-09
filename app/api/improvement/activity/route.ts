import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const recentThreshold = new Date(Date.now() - 20_000)
  const run = await prisma.improvementRun.findFirst({
    where: {
      workspaceId: user.workspaceId,
      OR: [
        { status: { in: ['QUEUED', 'RUNNING'] } },
        { finishedAt: { gte: recentThreshold } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      agentId: true,
      status: true,
      total: true,
      error: true,
      createdAt: true,
      finishedAt: true,
      agent: { select: { name: true } },
      reviews: { select: { status: true, checkpoint: true } },
    },
  })
  if (!run) return NextResponse.json({ activity: null }, { headers: { 'Cache-Control': 'no-store' } })

  const finalized = run.reviews.filter((review) => ['DONE', 'ERROR'].includes(review.status)).length
  const fractional = run.reviews.reduce((sum, review) => {
    if (review.status !== 'PROCESSING') return sum
    const checkpoint = review.checkpoint as { next?: number; total?: number } | null
    if (!checkpoint?.total) return sum
    return sum + Math.min(0.95, Math.max(0, (checkpoint.next ?? 0) / checkpoint.total))
  }, 0)
  const completed = ['DONE', 'PARTIAL', 'ERROR', 'CANCELLED'].includes(run.status)
  const percent = completed
    ? 100
    : Math.min(99, Math.max(0, Math.round(((finalized + fractional) / Math.max(run.total, 1)) * 100)))
  const usageWhere = {
    workspaceId: user.workspaceId,
    type: 'LEARNING' as const,
    status: 'CAPTURED' as const,
    idempotencyKey: { startsWith: `improvement:run:${run.id}:` },
  }
  const [usage, requestCount] = await Promise.all([
    prisma.usageLog.aggregate({ where: usageWhere, _sum: { chargedIRR: true } }),
    prisma.usageLog.count({ where: usageWhere }),
  ])

  return NextResponse.json({
    activity: {
      id: run.id,
      agentId: run.agentId,
      agentName: run.agent.name,
      status: run.status,
      error: run.error,
      total: run.total,
      processed: finalized,
      percent,
      requestCount,
      chargedIRR: usage._sum.chargedIRR ?? 0,
      createdAt: run.createdAt,
      finishedAt: run.finishedAt,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
