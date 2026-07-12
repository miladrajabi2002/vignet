import { prisma } from '@/lib/prisma'

export interface VigentoAdminReport {
  total: number
  succeeded: number
  failed: number
  applied: number
  helpful: number
  unhelpful: number
  averageDurationMs: number
  models: Array<{ modelAlias: string; count: number }>
  recent: Array<{
    id: string
    workspaceId: string
    workspaceName: string
    status: 'SUCCEEDED' | 'FAILED'
    modelAlias: string | null
    durationMs: number
    applied: boolean
    helpful: boolean | null
    failureCode: string | null
    createdAt: Date
  }>
}

export async function getVigentoAdminReport(days: number): Promise<VigentoAdminReport> {
  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000)
  const where = { createdAt: { gte: since } }
  const [total, succeeded, failed, applied, helpful, unhelpful, duration, modelGroups, recent] = await Promise.all([
    prisma.vigentoRun.count({ where }),
    prisma.vigentoRun.count({ where: { ...where, status: 'SUCCEEDED' } }),
    prisma.vigentoRun.count({ where: { ...where, status: 'FAILED' } }),
    prisma.vigentoRun.count({ where: { ...where, applied: true } }),
    prisma.vigentoRun.count({ where: { ...where, helpful: true } }),
    prisma.vigentoRun.count({ where: { ...where, helpful: false } }),
    prisma.vigentoRun.aggregate({ where, _avg: { durationMs: true } }),
    prisma.vigentoRun.groupBy({
      by: ['modelAlias'],
      where,
      _count: { _all: true },
      orderBy: { _count: { modelAlias: 'desc' } },
    }),
    prisma.vigentoRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        workspaceId: true,
        status: true,
        modelAlias: true,
        durationMs: true,
        applied: true,
        helpful: true,
        failureCode: true,
        createdAt: true,
        workspace: { select: { name: true } },
      },
    }),
  ])

  return {
    total,
    succeeded,
    failed,
    applied,
    helpful,
    unhelpful,
    averageDurationMs: Math.round(duration._avg.durationMs ?? 0),
    models: modelGroups.map((row) => ({
      modelAlias: row.modelAlias ?? 'fallback',
      count: row._count._all,
    })),
    recent: recent.map(({ workspace, ...row }) => ({
      ...row,
      workspaceName: workspace.name,
    })),
  }
}

