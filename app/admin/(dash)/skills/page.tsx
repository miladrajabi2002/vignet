import { Radar } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '../ui'
import { SkillsCenter, type FindingView, type RunView, type SkillsStatsView } from '@/components/admin/skills-center'

export const dynamic = 'force-dynamic'

export default async function AdminSkillsPage() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)

  const [findingRows, runRows, open, high, acknowledged, resolvedWeek, bySkillRaw, platform] = await Promise.all([
    prisma.skillFinding.findMany({
      orderBy: [{ lastSeenAt: 'desc' }],
      take: 250,
      select: {
        id: true, skillKey: true, dedupeKey: true, severity: true, title: true, diagnosis: true,
        evidence: true, suggestedAction: true, status: true, occurrences: true,
        firstSeenAt: true, lastSeenAt: true, resolvedAt: true, resolvedNote: true,
        workspaceId: true, agentId: true, conversationId: true, contactId: true,
      },
    }),
    prisma.skillRun.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.skillFinding.count({ where: { status: 'OPEN' } }),
    prisma.skillFinding.count({ where: { status: 'OPEN', severity: 'HIGH' } }),
    prisma.skillFinding.count({ where: { status: 'ACKNOWLEDGED' } }),
    prisma.skillFinding.count({ where: { status: 'RESOLVED', resolvedAt: { gt: weekAgo } } }),
    prisma.skillFinding.groupBy({ by: ['skillKey'], where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, _count: { _all: true } }),
    (async () => {
      const [messageRow] = await prisma.$queryRaw<Array<{ userMessages: bigint; unanswered: bigint; assistantMessages: bigint; modelErrors: bigint }>>`
        SELECT COUNT(*) FILTER (WHERE m.role = 'USER') AS "userMessages",
               COUNT(*) FILTER (WHERE m.role = 'USER' AND m.unanswered) AS "unanswered",
               COUNT(*) FILTER (WHERE m.role = 'ASSISTANT') AS "assistantMessages",
               COUNT(*) FILTER (WHERE m.role = 'ASSISTANT' AND m.metadata->'vigentoReceipts' @> '[{"kind":"model_error"}]') AS "modelErrors"
        FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        JOIN "Workspace" w ON w.id = c."workspaceId"
        WHERE m."createdAt" > now() - interval '7 days' AND w."excludeFromAdminReports" = false`
      const [conversationRow] = await prisma.$queryRaw<Array<{ conversations: bigint }>>`
        SELECT COUNT(*) AS conversations FROM "Conversation" c
        JOIN "Workspace" w ON w.id = c."workspaceId"
        WHERE c."lastMessageAt" > now() - interval '7 days' AND w."excludeFromAdminReports" = false`
      const outcomeRows = await prisma.$queryRaw<Array<{ outcome: string; n: bigint }>>`
        SELECT r.result->>'outcome' AS outcome, COUNT(*) AS n
        FROM "ImprovementReview" r
        JOIN "ImprovementRun" run ON run.id = r."runId"
        JOIN "Agent" a ON a.id = run."agentId"
        JOIN "Workspace" w ON w.id = a."workspaceId"
        WHERE r.status = 'DONE' AND run."createdAt" > now() - interval '7 days' AND w."excludeFromAdminReports" = false
        GROUP BY 1`
      const reviews = outcomeRows.reduce((sum, r) => sum + Number(r.n), 0)
      const resolved = Number(outcomeRows.find((r) => r.outcome === 'RESOLVED')?.n ?? 0)
      const userMessages = Number(messageRow?.userMessages ?? 0)
      return {
        conversations: Number(conversationRow?.conversations ?? 0),
        unansweredRate: userMessages > 0 ? Number(messageRow?.unanswered ?? 0) / userMessages : null,
        modelErrors: Number(messageRow?.modelErrors ?? 0),
        assistantMessages: Number(messageRow?.assistantMessages ?? 0),
        resolutionRate: reviews > 0 ? resolved / reviews : null,
        reviews,
      }
    })(),
  ])

  const agentIds = [...new Set(findingRows.map((f) => f.agentId).filter((id): id is string => Boolean(id)))]
  const agents = agentIds.length
    ? await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, workspace: { select: { name: true } } } })
    : []
  const agentById = new Map(agents.map((a) => [a.id, a]))

  const findings: FindingView[] = findingRows.map((f) => ({
    id: f.id,
    skillKey: f.skillKey,
    severity: f.severity as 'HIGH' | 'MEDIUM' | 'LOW',
    title: f.title,
    diagnosis: f.diagnosis,
    evidence: (f.evidence ?? null) as Record<string, unknown> | null,
    suggestedAction: (f.suggestedAction ?? null) as Record<string, unknown> | null,
    status: f.status as 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED',
    occurrences: f.occurrences,
    firstSeenAt: f.firstSeenAt.toISOString(),
    lastSeenAt: f.lastSeenAt.toISOString(),
    resolvedNote: f.resolvedNote,
    agentId: f.agentId,
    agentName: f.agentId ? agentById.get(f.agentId)?.name ?? null : null,
    workspaceName: f.agentId ? agentById.get(f.agentId)?.workspace.name ?? null : null,
    conversationId: f.conversationId,
    contactId: f.contactId,
  }))

  const runs: RunView[] = runRows.map((r) => ({
    id: r.id,
    mode: r.mode as 'FREE' | 'DEEP',
    source: r.source,
    status: r.status,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    durationMs: r.durationMs,
    agentsScanned: r.agentsScanned,
    conversationsScanned: r.conversationsScanned,
    findingsCreated: r.findingsCreated,
    findingsUpdated: r.findingsUpdated,
    findingsResolved: r.findingsResolved,
    llmRequests: r.llmRequests,
  }))

  const stats: SkillsStatsView = {
    open,
    high,
    acknowledged,
    resolvedWeek,
    bySkill: Object.fromEntries(bySkillRaw.map((row) => [row.skillKey, row._count._all])),
    platform,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="اسکیل‌های بهبود ایجنت"
        subtitle="هفت اسکیلی که خودشان مشکل پیدا می‌کنند، رگرسیون فیکس‌ها را می‌سنجند و اثر هر تغییر را با عدد تأیید می‌کنند — فقط برای شما (مالک پلتفرم)."
        icon={Radar}
      />
      <SkillsCenter findings={findings} runs={runs} stats={stats} />
    </div>
  )
}
