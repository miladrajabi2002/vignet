import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_RELATED_WHERE, adminVisibleWorkspaceSql } from '@/lib/admin/reporting-scope'
import {
  getUnderstandingConfig,
  type UnderstandingConfig,
  type UnderstandingMode,
} from '@/lib/agent/understand/mode'
import { loadWorkspaceModules } from '@/lib/verticals/workspace-capabilities'

/**
 * Agent-core report for the admin console: how the turn-understanding layer
 * is rolled out, what each customer turn costs, how well replies land, how
 * accurate the reading is against the legacy router, and exactly which
 * capabilities every agent has. Each section is read independently so one
 * missing table (an unapplied migration) never blanks the whole page.
 */

export interface CountRow { key: string; count: number }

export interface UnderstandingSection {
  available: boolean
  total: number
  ok: number
  fallback: number
  skipped: number
  byMode: CountRow[]
  errors: CountRow[]
  avgConfidence: number | null
  lowConfidence: number
  latencyP50: number | null
  latencyP95: number | null
  costUSD: number
  avgCostUSD: number | null
  compared: number
  agreed: number
  acts: CountRow[]
  routed: CountRow[]
  diffs: CountRow[]
  daily: Array<{ day: string; total: number; ok: number; fallback: number }>
  disagreements: Array<{
    id: string
    createdAt: Date
    message: string | null
    acts: string[]
    legacyActs: string[]
    diffKinds: string[]
    confidence: number | null
  }>
}

export interface CostSection {
  turns: number
  avgTotalUSD: number | null
  avgReplyUSD: number | null
  avgAuxUSD: number | null
  p50TotalUSD: number | null
  p95TotalUSD: number | null
  /** Auxiliary calls by job, from UsageLog.purpose. */
  purposes: Array<{ purpose: string; calls: number; costUSD: number; promptTokens: number; completionTokens: number }>
  /** Reply calls (UsageLog type CHAT) in the window. */
  reply: { calls: number; costUSD: number; promptTokens: number; completionTokens: number }
  /** All conversation-linked AI cost ÷ assistant replies, this window vs the one before. */
  perReply: { current: number | null; previous: number | null; currentReplies: number; previousReplies: number }
  /** Provider prompt cache: input tokens served from cache, per call kind. */
  cache: Array<{ key: string; calls: number; promptTokens: number; cachedTokens: number }>
}

export interface QualitySection {
  assistantTurns: number
  withSignal: number
  answered: { y: number; p: number; n: number }
  mood: { pos: number; neu: number; neg: number; ang: number }
  buy: { b0: number; b1: number; b2: number; b3: number }
  unanswered: number
  handoffs: number
  conversations: number
  insights: number
  satisfactionAvg: number | null
  dissatisfied: number
  satisfactionRated: number
  buyerAvg: number | null
  hotBuyers: number
  ordersFiled: number
  ordersPaid: number
  linksSent: number
  cancelled: number
}

export interface AgentCapabilityRow {
  id: string
  name: string
  workspaceId: string
  workspaceName: string
  active: boolean
  language: string
  effectiveMode: UnderstandingMode
  modules: { products: boolean; bookings: boolean; courses: boolean }
  productAccess: boolean
  products: number
  inStockProducts: number
  knowledgeReady: number
  knowledgeTotal: number
  orderCapture: boolean
  payLink: boolean
  restock: boolean
  tracking: boolean
  orderUpdates: boolean
  cartHold: boolean
  handoff: boolean
  services: number
  courses: number
  channels: string[]
  conversations: number
}

export interface AgentCoreReport {
  days: number
  since: Date
  rollout: {
    config: UnderstandingConfig
    envDisabled: boolean
    workspaces: Array<{ id: string; name: string; mode: UnderstandingMode }>
  }
  understanding: UnderstandingSection
  cost: CostSection | null
  quality: QualitySection | null
  agents: AgentCapabilityRow[]
}

const num = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim()) return Number(value)
  if (value instanceof Prisma.Decimal) return value.toNumber()
  return 0
}

const nullableNum = (value: unknown): number | null => (value == null ? null : num(value))

const EMPTY_UNDERSTANDING: UnderstandingSection = {
  available: false,
  total: 0,
  ok: 0,
  fallback: 0,
  skipped: 0,
  byMode: [],
  errors: [],
  avgConfidence: null,
  lowConfidence: 0,
  latencyP50: null,
  latencyP95: null,
  costUSD: 0,
  avgCostUSD: null,
  compared: 0,
  agreed: 0,
  acts: [],
  routed: [],
  diffs: [],
  daily: [],
  disagreements: [],
}

async function understandingSection(since: Date): Promise<UnderstandingSection> {
  const scope = adminVisibleWorkspaceSql(Prisma.sql`t."workspaceId"`)
  try {
    const [totals] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE t.status = 'ok') AS ok,
        COUNT(*) FILTER (WHERE t.status = 'fallback') AS fallback,
        COUNT(*) FILTER (WHERE t.status = 'skipped') AS skipped,
        AVG(t.confidence) FILTER (WHERE t.status = 'ok') AS "avgConfidence",
        COUNT(*) FILTER (WHERE t.status = 'ok' AND t.confidence < 0.35) AS "lowConfidence",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY t."latencyMs") FILTER (WHERE t.status <> 'skipped' AND t."latencyMs" IS NOT NULL) AS p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY t."latencyMs") FILTER (WHERE t.status <> 'skipped' AND t."latencyMs" IS NOT NULL) AS p95,
        COALESCE(SUM(t."costUSD"), 0) AS cost,
        COUNT(*) FILTER (WHERE t."costUSD" IS NOT NULL) AS priced,
        COUNT(*) FILTER (WHERE t.agreed IS NOT NULL) AS compared,
        COUNT(*) FILTER (WHERE t.agreed = true) AS agreed
      FROM "TurnUnderstandingLog" t
      WHERE t."createdAt" >= ${since} AND ${scope}`
    const grouped = (column: Prisma.Sql) => prisma.$queryRaw<Array<{ key: string | null; count: unknown }>>`
      SELECT ${column} AS key, COUNT(*) AS count
      FROM "TurnUnderstandingLog" t
      WHERE t."createdAt" >= ${since} AND ${scope}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 30`
    const unnested = (column: Prisma.Sql) => prisma.$queryRaw<Array<{ key: string | null; count: unknown }>>`
      SELECT item AS key, COUNT(*) AS count
      FROM "TurnUnderstandingLog" t, unnest(${column}) AS item
      WHERE t."createdAt" >= ${since} AND ${scope}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 30`
    const [byMode, errors, acts, routed, diffs, daily, disagreementRows] = await Promise.all([
      grouped(Prisma.sql`t.mode`),
      prisma.$queryRaw<Array<{ key: string | null; count: unknown }>>`
        SELECT t."errorCode" AS key, COUNT(*) AS count
        FROM "TurnUnderstandingLog" t
        WHERE t."createdAt" >= ${since} AND t."errorCode" IS NOT NULL AND ${scope}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
      unnested(Prisma.sql`t.acts`),
      unnested(Prisma.sql`t."routedDomains"`),
      unnested(Prisma.sql`t."diffKinds"`),
      prisma.$queryRaw<Array<{ day: string; total: unknown; ok: unknown; fallback: unknown }>>`
        SELECT to_char(date_trunc('day', t."createdAt"), 'YYYY-MM-DD') AS day,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE t.status = 'ok') AS ok,
          COUNT(*) FILTER (WHERE t.status = 'fallback') AS fallback
        FROM "TurnUnderstandingLog" t
        WHERE t."createdAt" >= ${since} AND ${scope}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Array<{ id: string; createdAt: Date; messageId: string | null; acts: string[]; legacy: unknown; diffKinds: string[]; confidence: number | null }>>`
        SELECT t.id, t."createdAt", t."messageId", t.acts, t.legacy, t."diffKinds", t.confidence
        FROM "TurnUnderstandingLog" t
        WHERE t."createdAt" >= ${since} AND t.agreed = false AND ${scope}
        ORDER BY t."createdAt" DESC LIMIT 15`,
    ])
    const messageIds = disagreementRows.map((row) => row.messageId).filter((id): id is string => Boolean(id))
    const messages = messageIds.length
      ? await prisma.message.findMany({ where: { id: { in: messageIds } }, select: { id: true, content: true } })
      : []
    const contentById = new Map(messages.map((message) => [message.id, message.content]))
    const rows = (list: Array<{ key: string | null; count: unknown }>): CountRow[] =>
      list.map((row) => ({ key: row.key ?? '—', count: num(row.count) }))
    const priced = num(totals?.priced)
    const cost = num(totals?.cost)
    return {
      available: true,
      total: num(totals?.total),
      ok: num(totals?.ok),
      fallback: num(totals?.fallback),
      skipped: num(totals?.skipped),
      byMode: rows(byMode),
      errors: rows(errors),
      avgConfidence: nullableNum(totals?.avgConfidence),
      lowConfidence: num(totals?.lowConfidence),
      latencyP50: nullableNum(totals?.p50),
      latencyP95: nullableNum(totals?.p95),
      costUSD: cost,
      avgCostUSD: priced ? cost / priced : null,
      compared: num(totals?.compared),
      agreed: num(totals?.agreed),
      acts: rows(acts),
      routed: rows(routed),
      diffs: rows(diffs),
      daily: daily.map((row) => ({ day: row.day, total: num(row.total), ok: num(row.ok), fallback: num(row.fallback) })),
      disagreements: disagreementRows.map((row) => {
        const legacy = row.legacy && typeof row.legacy === 'object' ? row.legacy as { acts?: unknown } : {}
        return {
          id: row.id,
          createdAt: row.createdAt,
          message: row.messageId ? (contentById.get(row.messageId) ?? null) : null,
          acts: row.acts ?? [],
          legacyActs: Array.isArray(legacy.acts) ? legacy.acts.filter((act): act is string => typeof act === 'string') : [],
          diffKinds: row.diffKinds ?? [],
          confidence: row.confidence,
        }
      }),
    }
  } catch (error) {
    console.error('[admin/agent-core] understanding report failed:', error)
    return EMPTY_UNDERSTANDING
  }
}

async function costSection(since: Date, previousSince: Date): Promise<CostSection | null> {
  const messageScope = adminVisibleWorkspaceSql(Prisma.sql`c."workspaceId"`)
  const usageScope = adminVisibleWorkspaceSql(Prisma.sql`u."workspaceId"`)
  try {
    const [turnRow] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        COUNT(*) AS turns,
        AVG((m.metadata->'turnCost'->>'totalUSD')::float) AS total,
        AVG((m.metadata->'turnCost'->>'replyUSD')::float) AS reply,
        AVG((m.metadata->'turnCost'->>'auxUSD')::float) AS aux,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY (m.metadata->'turnCost'->>'totalUSD')::float) AS p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY (m.metadata->'turnCost'->>'totalUSD')::float) AS p95
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE m.role = 'ASSISTANT' AND m."createdAt" >= ${since}
        AND m.metadata ? 'turnCost' AND ${messageScope}`
    let purposes: CostSection['purposes'] = []
    try {
      const purposeRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT u.purpose AS purpose, COUNT(*) AS calls, COALESCE(SUM(u.cost), 0) AS cost,
          COALESCE(SUM(u."promptTokens"), 0) AS prompt, COALESCE(SUM(u."completionTokens"), 0) AS completion
        FROM "UsageLog" u
        WHERE u.date >= ${since} AND u.purpose IS NOT NULL AND u.status <> 'RELEASED' AND ${usageScope}
        GROUP BY 1 ORDER BY 3 DESC`
      purposes = purposeRows.map((row) => ({
        purpose: String(row.purpose),
        calls: num(row.calls),
        costUSD: num(row.cost),
        promptTokens: num(row.prompt),
        completionTokens: num(row.completion),
      }))
    } catch {
      // UsageLog.purpose arrives with the agent-core migration.
    }
    const [replyRow] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT COUNT(*) AS calls, COALESCE(SUM(u.cost), 0) AS cost,
        COALESCE(SUM(u."promptTokens"), 0) AS prompt, COALESCE(SUM(u."completionTokens"), 0) AS completion
      FROM "UsageLog" u
      WHERE u.date >= ${since} AND u.type = 'CHAT' AND u.status <> 'RELEASED' AND ${usageScope}`
    const perWindow = async (from: Date, to: Date) => {
      const [spend] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT COALESCE(SUM(u.cost), 0) AS cost
        FROM "UsageLog" u
        WHERE u.date >= ${from} AND u.date < ${to} AND u."conversationId" IS NOT NULL
          AND u.type IN ('CHAT', 'SUMMARY') AND u.status <> 'RELEASED' AND ${usageScope}`
      const [replies] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT COUNT(*) AS replies
        FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE m.role = 'ASSISTANT' AND m."createdAt" >= ${from} AND m."createdAt" < ${to} AND ${messageScope}`
      const count = num(replies?.replies)
      return { perReply: count ? num(spend?.cost) / count : null, replies: count }
    }
    const now = new Date()
    const [current, previous] = await Promise.all([perWindow(since, now), perWindow(previousSince, since)])
    let cache: CostSection['cache'] = []
    const cacheRows = (key: Prisma.Sql) => prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${key} AS key, COUNT(*) AS calls,
        COALESCE(SUM(u."promptTokens"), 0) AS prompt, COALESCE(SUM(u."cachedTokens"), 0) AS cached
      FROM "UsageLog" u
      WHERE u.date >= ${since} AND u.type IN ('CHAT', 'SUMMARY') AND u.status <> 'RELEASED' AND ${usageScope}
      GROUP BY 1 ORDER BY 3 DESC`
    try {
      const rows = await cacheRows(Prisma.sql`COALESCE(u.purpose, CASE WHEN u.type = 'CHAT' THEN 'reply' ELSE 'summary' END)`)
        .catch(() => cacheRows(Prisma.sql`CASE WHEN u.type = 'CHAT' THEN 'reply' ELSE 'summary' END`))
      cache = rows.map((row) => ({ key: String(row.key), calls: num(row.calls), promptTokens: num(row.prompt), cachedTokens: num(row.cached) }))
    } catch {
      cache = []
    }
    return {
      turns: num(turnRow?.turns),
      avgTotalUSD: nullableNum(turnRow?.total),
      avgReplyUSD: nullableNum(turnRow?.reply),
      avgAuxUSD: nullableNum(turnRow?.aux),
      p50TotalUSD: nullableNum(turnRow?.p50),
      p95TotalUSD: nullableNum(turnRow?.p95),
      purposes,
      reply: {
        calls: num(replyRow?.calls),
        costUSD: num(replyRow?.cost),
        promptTokens: num(replyRow?.prompt),
        completionTokens: num(replyRow?.completion),
      },
      perReply: { current: current.perReply, previous: previous.perReply, currentReplies: current.replies, previousReplies: previous.replies },
      cache,
    }
  } catch (error) {
    console.error('[admin/agent-core] cost report failed:', error)
    return null
  }
}

async function qualitySection(since: Date): Promise<QualitySection | null> {
  const messageScope = adminVisibleWorkspaceSql(Prisma.sql`c."workspaceId"`)
  try {
    const [signals] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        COUNT(*) AS turns,
        COUNT(*) FILTER (WHERE m.metadata ? 'turnSignal') AS signal,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'answered' = 'y') AS ay,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'answered' = 'p') AS ap,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'answered' = 'n') AS an,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'mood' = 'pos') AS mpos,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'mood' = 'neu') AS mneu,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'mood' = 'neg') AS mneg,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'mood' = 'ang') AS mang,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'buy' = '0') AS b0,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'buy' = '1') AS b1,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'buy' = '2') AS b2,
        COUNT(*) FILTER (WHERE m.metadata->'turnSignal'->>'buy' = '3') AS b3,
        COUNT(*) FILTER (WHERE m.unanswered) AS unanswered
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE m.role = 'ASSISTANT' AND m."createdAt" >= ${since} AND ${messageScope}`
    const [handoffs, conversations, insight, orders] = await Promise.all([
      prisma.handoffAlert.count({ where: { createdAt: { gte: since }, ...ADMIN_VISIBLE_RELATED_WHERE } }),
      prisma.conversation.count({ where: { lastMessageAt: { gte: since }, ...ADMIN_VISIBLE_RELATED_WHERE } }),
      prisma.conversationSalesInsight.aggregate({
        where: { analyzedAt: { gte: since }, ...ADMIN_VISIBLE_RELATED_WHERE },
        _count: { _all: true },
        _avg: { buyerProbability: true, satisfaction: true },
      }),
      prisma.orderDraft.groupBy({
        by: ['status'],
        where: { updatedAt: { gte: since }, ...ADMIN_VISIBLE_RELATED_WHERE },
        _count: { _all: true },
      }),
    ])
    const [dissatisfied, satisfactionRated, hotBuyers] = await Promise.all([
      prisma.conversationSalesInsight.count({ where: { analyzedAt: { gte: since }, satisfaction: { lt: 40 }, ...ADMIN_VISIBLE_RELATED_WHERE } }),
      prisma.conversationSalesInsight.count({ where: { analyzedAt: { gte: since }, satisfaction: { not: null }, ...ADMIN_VISIBLE_RELATED_WHERE } }),
      prisma.conversationSalesInsight.count({ where: { analyzedAt: { gte: since }, buyerProbability: { gte: 70 }, ...ADMIN_VISIBLE_RELATED_WHERE } }),
    ])
    const byStatus = new Map(orders.map((row) => [row.status, row._count._all]))
    const sum = (...statuses: string[]) => statuses.reduce((total, status) => total + (byStatus.get(status) ?? 0), 0)
    return {
      assistantTurns: num(signals?.turns),
      withSignal: num(signals?.signal),
      answered: { y: num(signals?.ay), p: num(signals?.ap), n: num(signals?.an) },
      mood: { pos: num(signals?.mpos), neu: num(signals?.mneu), neg: num(signals?.mneg), ang: num(signals?.mang) },
      buy: { b0: num(signals?.b0), b1: num(signals?.b1), b2: num(signals?.b2), b3: num(signals?.b3) },
      unanswered: num(signals?.unanswered),
      handoffs,
      conversations,
      insights: insight._count._all,
      satisfactionAvg: insight._avg.satisfaction,
      dissatisfied,
      satisfactionRated,
      buyerAvg: insight._avg.buyerProbability,
      hotBuyers,
      ordersFiled: sum('SUBMITTED', 'CONFIRMED', 'FULFILLED', 'PAID', 'PAYMENT_PENDING', 'ON_HOLD'),
      ordersPaid: sum('PAID'),
      linksSent: sum('LINK_SENT', 'PAYMENT_PENDING', 'PAID', 'ON_HOLD', 'PAYMENT_FAILED', 'EXPIRED'),
      cancelled: sum('CANCELLED'),
    }
  } catch (error) {
    console.error('[admin/agent-core] quality report failed:', error)
    return null
  }
}

async function agentRows(since: Date, config: UnderstandingConfig): Promise<AgentCapabilityRow[]> {
  try {
    const agents = await prisma.agent.findMany({
      where: { ...ADMIN_VISIBLE_RELATED_WHERE },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
      take: 60,
      select: {
        id: true,
        name: true,
        active: true,
        language: true,
        workspaceId: true,
        productAccessEnabled: true,
        orderTrackingEnabled: true,
        orderCaptureEnabled: true,
        payLinkEnabled: true,
        restockAlertsEnabled: true,
        orderUpdatesEnabled: true,
        cartHoldEnabled: true,
        handoffEnabled: true,
        workspace: { select: { name: true } },
        channels: { where: { active: true }, select: { type: true } },
      },
    })
    if (!agents.length) return []
    const workspaceIds = [...new Set(agents.map((agent) => agent.workspaceId))]
    const agentIds = agents.map((agent) => agent.id)
    const [products, inStock, knowledge, knowledgeReady, services, courses, conversations, modules] = await Promise.all([
      prisma.product.groupBy({ by: ['workspaceId'], where: { workspaceId: { in: workspaceIds }, active: true, deletedAt: null }, _count: { _all: true } }),
      prisma.product.groupBy({
        by: ['workspaceId'],
        where: { workspaceId: { in: workspaceIds }, active: true, deletedAt: null, OR: [{ stock: null }, { stock: { gt: 0 } }] },
        _count: { _all: true },
      }),
      prisma.knowledgeBase.groupBy({ by: ['agentId'], where: { agentId: { in: agentIds } }, _count: { _all: true } }),
      prisma.knowledgeBase.groupBy({ by: ['agentId'], where: { agentId: { in: agentIds }, status: 'READY' }, _count: { _all: true } }),
      prisma.service.groupBy({ by: ['workspaceId'], where: { workspaceId: { in: workspaceIds }, active: true }, _count: { _all: true } }),
      prisma.course.groupBy({ by: ['workspaceId'], where: { workspaceId: { in: workspaceIds }, status: 'PUBLISHED' }, _count: { _all: true } }),
      prisma.conversation.groupBy({ by: ['agentId'], where: { agentId: { in: agentIds }, lastMessageAt: { gte: since } }, _count: { _all: true } }),
      Promise.all(workspaceIds.map(async (id) => [id, await loadWorkspaceModules(id).catch(() => null)] as const)),
    ])
    const countMap = <K extends string>(rows: Array<Record<K, string> & { _count: { _all: number } }>, key: K) =>
      new Map(rows.map((row) => [row[key], row._count._all]))
    const productMap = countMap(products, 'workspaceId')
    const inStockMap = countMap(inStock, 'workspaceId')
    const knowledgeMap = countMap(knowledge, 'agentId')
    const readyMap = countMap(knowledgeReady, 'agentId')
    const serviceMap = countMap(services, 'workspaceId')
    const courseMap = countMap(courses, 'workspaceId')
    const conversationMap = countMap(conversations, 'agentId')
    const moduleMap = new Map(modules)
    return agents.map((agent) => {
      const workspaceModules = moduleMap.get(agent.workspaceId)
      const gates = {
        products: workspaceModules ? workspaceModules.has('products') : true,
        bookings: workspaceModules ? workspaceModules.has('appointments') : true,
        courses: workspaceModules ? workspaceModules.has('courses') : true,
      }
      const productAccess = agent.productAccessEnabled && gates.products
      return {
        id: agent.id,
        name: agent.name,
        workspaceId: agent.workspaceId,
        workspaceName: agent.workspace.name,
        active: agent.active,
        language: agent.language,
        effectiveMode: config.workspaces[agent.workspaceId] ?? config.mode,
        modules: gates,
        productAccess,
        products: productMap.get(agent.workspaceId) ?? 0,
        inStockProducts: inStockMap.get(agent.workspaceId) ?? 0,
        knowledgeReady: readyMap.get(agent.id) ?? 0,
        knowledgeTotal: knowledgeMap.get(agent.id) ?? 0,
        orderCapture: agent.orderCaptureEnabled && gates.products,
        payLink: agent.payLinkEnabled && agent.orderCaptureEnabled && gates.products,
        restock: agent.restockAlertsEnabled && productAccess,
        tracking: agent.orderTrackingEnabled,
        orderUpdates: agent.orderUpdatesEnabled,
        cartHold: agent.cartHoldEnabled,
        handoff: agent.handoffEnabled,
        services: gates.bookings ? (serviceMap.get(agent.workspaceId) ?? 0) : 0,
        courses: gates.courses ? (courseMap.get(agent.workspaceId) ?? 0) : 0,
        channels: agent.channels.map((channel) => channel.type),
        conversations: conversationMap.get(agent.id) ?? 0,
      }
    })
  } catch (error) {
    console.error('[admin/agent-core] agent capability report failed:', error)
    return []
  }
}

export async function getAgentCoreReport(days: number): Promise<AgentCoreReport> {
  const span = Math.min(90, Math.max(1, Math.round(days)))
  const since = new Date(Date.now() - span * 86_400_000)
  const previousSince = new Date(since.getTime() - span * 86_400_000)
  const config = await getUnderstandingConfig()
  const overrideIds = Object.keys(config.workspaces)
  const [understanding, cost, quality, agents, overrideWorkspaces] = await Promise.all([
    understandingSection(since),
    costSection(since, previousSince),
    qualitySection(since),
    agentRows(since, config),
    overrideIds.length
      ? prisma.workspace.findMany({ where: { id: { in: overrideIds } }, select: { id: true, name: true } }).catch(() => [])
      : Promise.resolve([]),
  ])
  const names = new Map(overrideWorkspaces.map((workspace) => [workspace.id, workspace.name]))
  return {
    days: span,
    since,
    rollout: {
      config,
      envDisabled: process.env.AGENT_UNDERSTANDING_DISABLED === '1' || process.env.AGENT_UNDERSTANDING_DISABLED === 'true',
      workspaces: overrideIds.map((id) => ({ id, name: names.get(id) ?? id, mode: config.workspaces[id] })),
    },
    understanding,
    cost,
    quality,
    agents,
  }
}
