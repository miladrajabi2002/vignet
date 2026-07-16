import 'server-only'

import { prisma } from '@/lib/prisma'
import {
  AGENT_MODELS,
  getReplyPriceIRR,
  resolveModelId,
  type ModelAlias,
} from '@/lib/ai/models'
import type { PlatformAiConfig } from '@/lib/ai/platform-config'
import type { PlatformCommercialConfig } from '@/lib/platform/commercial-config'

const DASHBOARD_TZ = process.env.DASHBOARD_TZ || 'Asia/Tehran'

export interface AiUsageTotals {
  requests: number
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  cachedTokens: number
  providerCostUSD: number
  chargedIRR: number
  pricedRequests: number
}

export interface AiDailyUsage {
  day: string
  requests: number
  tokens: number
  providerCostUSD: number
  chargedIRR: number
}

export interface AiModelUsage {
  model: string
  requests: number
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  cachedTokens: number
  providerCostUSD: number
  chargedIRR: number
}

export interface AiWorkspaceUsage {
  workspaceId: string
  workspaceName: string
  plan: string
  ownerLabel: string | null
  userCount: number
  requests: number
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  cachedTokens: number
  providerCostUSD: number
  chargedIRR: number
  lastUsedAt: Date
}

export interface RecentAiUsage {
  id: string
  date: Date
  workspaceId: string
  workspaceName: string
  model: string | null
  type: string
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  providerCostUSD: number | null
  chargedIRR: number
}

export interface OpenRouterManagedModel {
  alias: ModelAlias
  name: string
  description: string
  envName: string
  providerId: string
  providerLabel: string
  usingEnvOverride: boolean
  configurationSource: 'panel' | 'environment' | 'default'
  replyPriceIRR: number
  priceEnvName: string
  inputUsdPerMillion: number
  outputUsdPerMillion: number
}

export interface OpenRouterConfigStatus {
  apiKeyConfigured: boolean
  providerSort: string
  zeroDataRetention: boolean
  models: OpenRouterManagedModel[]
}

export interface OpenRouterAccountUsage {
  status: 'connected' | 'unconfigured' | 'unavailable'
  keyLabel: string | null
  keyLimitUSD: number | null
  keyLimitRemainingUSD: number | null
  usageDailyUSD: number | null
  usageWeeklyUSD: number | null
  usageMonthlyUSD: number | null
  usageTotalUSD: number | null
  totalCreditsUSD: number | null
  totalCreditsUsedUSD: number | null
  totalCreditsRemainingUSD: number | null
  accountCreditsAvailable: boolean
}

type TotalsRow = {
  requests: bigint
  promptTokens: bigint
  completionTokens: bigint
  reasoningTokens: bigint
  cachedTokens: bigint
  providerCostUSD: number | null
  chargedIRR: bigint
  pricedRequests: bigint
}

type DailyRow = {
  dayKey: string
  requests: bigint
  tokens: bigint
  providerCostUSD: number | null
  chargedIRR: bigint
}

type ModelRow = {
  model: string | null
  requests: bigint
  promptTokens: bigint
  completionTokens: bigint
  reasoningTokens: bigint
  cachedTokens: bigint
  providerCostUSD: number | null
  chargedIRR: bigint
}

type WorkspaceRow = {
  workspaceId: string
  workspaceName: string
  plan: string
  ownerLabel: string | null
  userCount: bigint
  requests: bigint
  promptTokens: bigint
  completionTokens: bigint
  reasoningTokens: bigint
  cachedTokens: bigint
  providerCostUSD: number | null
  chargedIRR: bigint
  lastUsedAt: Date
}

type RecentRow = {
  id: string
  date: Date
  workspaceId: string
  workspaceName: string
  model: string | null
  type: string
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  providerCostUSD: number | null
  chargedIRR: number
}

function dayKey(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DASHBOARD_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: DASHBOARD_TZ,
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function fillDaily(rows: DailyRow[], days: number): AiDailyUsage[] {
  const byDay = new Map(rows.map((row) => [row.dayKey, row]))
  const result: AiDailyUsage[] = []
  const now = Date.now()

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * 86_400_000)
    const row = byDay.get(dayKey(date))
    result.push({
      day: dayLabel(date),
      requests: Number(row?.requests ?? 0),
      tokens: Number(row?.tokens ?? 0),
      providerCostUSD: Number(row?.providerCostUSD ?? 0),
      chargedIRR: Number(row?.chargedIRR ?? 0),
    })
  }

  return result
}

/**
 * Server-only configuration summary. The OpenRouter key is deliberately reduced
 * to a boolean and is never returned, masked, logged, or sent to the client.
 */
export function getOpenRouterConfigStatus(
  platformPolicy?: PlatformAiConfig,
  commercialConfig?: PlatformCommercialConfig,
): OpenRouterConfigStatus {
  const envByAlias: Record<ModelAlias, string> = {
    fast: 'OPENROUTER_MODEL_FAST',
    standard: 'OPENROUTER_MODEL_STANDARD',
    balanced: 'OPENROUTER_MODEL_BALANCED',
    premium: 'OPENROUTER_MODEL_PREMIUM',
  }

  const providerDisplayName = (providerId: string) => {
    const [provider, rawModel = providerId] = providerId.split('/', 2)
    const clean = rawModel.replace(/[-_:]+/g, ' ').replace(/\s+/g, ' ').trim()
    const providerName = provider === 'openai'
      ? 'OpenAI'
      : provider === 'anthropic'
        ? 'Anthropic'
        : provider === 'google'
          ? 'Google'
          : provider === 'deepseek'
            ? 'DeepSeek'
            : provider === 'qwen'
              ? 'Qwen'
              : provider.charAt(0).toUpperCase() + provider.slice(1)
    return `${providerName} · ${clean}`
  }

  return {
    apiKeyConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    providerSort: commercialConfig?.providerSort || process.env.OPENROUTER_PROVIDER_SORT?.trim() || 'price',
    zeroDataRetention: commercialConfig?.zeroDataRetention ?? process.env.OPENROUTER_ZDR?.trim().toLowerCase() !== 'false',
    models: AGENT_MODELS.map((model) => {
      const envName = envByAlias[model.id]
      const providerId = resolveModelId(model.id, platformPolicy?.providerModels)
      const configuredInPanel = Boolean(platformPolicy?.providerModels[model.id]?.trim())
      const configuredInEnvironment = !configuredInPanel && Boolean(process.env[envName]?.trim())
      return {
        alias: model.id,
        name: model.name,
        description: model.descFa,
        envName,
        providerId,
        providerLabel: providerDisplayName(providerId),
        usingEnvOverride: configuredInEnvironment,
        configurationSource: configuredInPanel ? 'panel' : configuredInEnvironment ? 'environment' : 'default',
        replyPriceIRR: commercialConfig?.replyPricesIRR[model.id] ?? getReplyPriceIRR(model.id),
        priceEnvName: `AI_REPLY_PRICE_${model.id.toUpperCase()}_IRR`,
        inputUsdPerMillion: model.inputUsdPerMillion,
        outputUsdPerMillion: model.outputUsdPerMillion,
      }
    }),
  }
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Read-only live account health from OpenRouter. The inference key can report
 * its own limits/usage; full purchased-credit totals require a management key.
 * Neither credential nor provider error bodies ever leave this server module.
 */
export async function getOpenRouterAccountUsage(): Promise<OpenRouterAccountUsage> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    return {
      status: 'unconfigured',
      keyLabel: null,
      keyLimitUSD: null,
      keyLimitRemainingUSD: null,
      usageDailyUSD: null,
      usageWeeklyUSD: null,
      usageMonthlyUSD: null,
      usageTotalUSD: null,
      totalCreditsUSD: null,
      totalCreditsUsedUSD: null,
      totalCreditsRemainingUSD: null,
      accountCreditsAvailable: false,
    }
  }

  const managementKey = process.env.OPENROUTER_MANAGEMENT_KEY?.trim() || apiKey
  const headers = (key: string) => ({ Authorization: `Bearer ${key}` })
  const [keyResult, creditsResult] = await Promise.allSettled([
    fetch('https://openrouter.ai/api/v1/key', {
      headers: headers(apiKey),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    }),
    fetch('https://openrouter.ai/api/v1/credits', {
      headers: headers(managementKey),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    }),
  ])

  let keyData: Record<string, unknown> | null = null
  if (keyResult.status === 'fulfilled' && keyResult.value.ok) {
    const payload = (await keyResult.value.json().catch(() => null)) as
      | { data?: Record<string, unknown> }
      | null
    keyData = payload?.data ?? null
  }

  let creditsData: Record<string, unknown> | null = null
  if (creditsResult.status === 'fulfilled' && creditsResult.value.ok) {
    const payload = (await creditsResult.value.json().catch(() => null)) as
      | { data?: Record<string, unknown> }
      | null
    creditsData = payload?.data ?? null
  }

  const totalCredits = finiteNumber(creditsData?.total_credits)
  const totalUsage = finiteNumber(creditsData?.total_usage)
  return {
    status: keyData ? 'connected' : 'unavailable',
    keyLabel: typeof keyData?.label === 'string' ? keyData.label : null,
    keyLimitUSD: finiteNumber(keyData?.limit),
    keyLimitRemainingUSD: finiteNumber(keyData?.limit_remaining),
    usageDailyUSD: finiteNumber(keyData?.usage_daily),
    usageWeeklyUSD: finiteNumber(keyData?.usage_weekly),
    usageMonthlyUSD: finiteNumber(keyData?.usage_monthly),
    usageTotalUSD: finiteNumber(keyData?.usage),
    totalCreditsUSD: totalCredits,
    totalCreditsUsedUSD: totalUsage,
    totalCreditsRemainingUSD:
      totalCredits !== null && totalUsage !== null ? Math.max(0, totalCredits - totalUsage) : null,
    accountCreditsAvailable: Boolean(creditsData),
  }
}

/** Lightweight 30-day metrics used on the main admin overview. */
export async function getAiOverview(days = 30): Promise<AiUsageTotals> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<TotalsRow[]>`
    SELECT count(*) AS "requests",
           COALESCE(sum("promptTokens"), 0) AS "promptTokens",
           COALESCE(sum("completionTokens"), 0) AS "completionTokens",
           COALESCE(sum("reasoningTokens"), 0) AS "reasoningTokens",
           COALESCE(sum("cachedTokens"), 0) AS "cachedTokens",
           COALESCE(sum("cost"), 0) AS "providerCostUSD",
           COALESCE(sum("chargedIRR"), 0) AS "chargedIRR",
           count("cost") AS "pricedRequests"
    FROM "UsageLog"
    WHERE "date" >= ${since} AND "status" = 'CAPTURED'
  `
  const row = rows[0]

  return {
    requests: Number(row?.requests ?? 0),
    promptTokens: Number(row?.promptTokens ?? 0),
    completionTokens: Number(row?.completionTokens ?? 0),
    reasoningTokens: Number(row?.reasoningTokens ?? 0),
    cachedTokens: Number(row?.cachedTokens ?? 0),
    providerCostUSD: Number(row?.providerCostUSD ?? 0),
    chargedIRR: Number(row?.chargedIRR ?? 0),
    pricedRequests: Number(row?.pricedRequests ?? 0),
  }
}

/** Exact provider spend for the current UTC calendar month (same boundary as enforcement). */
export async function getCurrentMonthAiSpendUSD(): Promise<number> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const rows = await prisma.$queryRaw<{ providerCostUSD: number | null }[]>`
    SELECT COALESCE(sum("cost"), 0) AS "providerCostUSD"
    FROM "UsageLog"
    WHERE "date" >= ${monthStart} AND "status" = 'CAPTURED'
  `
  return Number(rows[0]?.providerCostUSD ?? 0)
}

/** Full operational report for the platform-managed OpenRouter account. */
export async function getAiUsageReport(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000)

  const [totalsRows, dailyRows, modelRows, workspaceRows, recentRows] = await Promise.all([
    prisma.$queryRaw<TotalsRow[]>`
      SELECT count(*) AS "requests",
             COALESCE(sum("promptTokens"), 0) AS "promptTokens",
             COALESCE(sum("completionTokens"), 0) AS "completionTokens",
             COALESCE(sum("reasoningTokens"), 0) AS "reasoningTokens",
             COALESCE(sum("cachedTokens"), 0) AS "cachedTokens",
             COALESCE(sum("cost"), 0) AS "providerCostUSD",
             COALESCE(sum("chargedIRR"), 0) AS "chargedIRR",
             count("cost") AS "pricedRequests"
      FROM "UsageLog"
      WHERE "date" >= ${since} AND "status" = 'CAPTURED'
    `,
    prisma.$queryRaw<DailyRow[]>`
      SELECT to_char(date_trunc('day', "date" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS "dayKey",
             count(*) AS "requests",
             COALESCE(sum("promptTokens" + "completionTokens"), 0) AS "tokens",
             COALESCE(sum("cost"), 0) AS "providerCostUSD",
             COALESCE(sum("chargedIRR"), 0) AS "chargedIRR"
      FROM "UsageLog"
      WHERE "date" >= ${since} AND "status" = 'CAPTURED'
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<ModelRow[]>`
      SELECT "model",
             count(*) AS "requests",
             COALESCE(sum("promptTokens"), 0) AS "promptTokens",
             COALESCE(sum("completionTokens"), 0) AS "completionTokens",
             COALESCE(sum("reasoningTokens"), 0) AS "reasoningTokens",
             COALESCE(sum("cachedTokens"), 0) AS "cachedTokens",
             COALESCE(sum("cost"), 0) AS "providerCostUSD",
             COALESCE(sum("chargedIRR"), 0) AS "chargedIRR"
      FROM "UsageLog"
      WHERE "date" >= ${since} AND "status" = 'CAPTURED'
      GROUP BY "model"
      ORDER BY "providerCostUSD" DESC, "requests" DESC
    `,
    prisma.$queryRaw<WorkspaceRow[]>`
      WITH usage_by_workspace AS (
        SELECT "workspaceId",
               count(*) AS "requests",
               COALESCE(sum("promptTokens"), 0) AS "promptTokens",
               COALESCE(sum("completionTokens"), 0) AS "completionTokens",
               COALESCE(sum("reasoningTokens"), 0) AS "reasoningTokens",
               COALESCE(sum("cachedTokens"), 0) AS "cachedTokens",
               COALESCE(sum("cost"), 0) AS "providerCostUSD",
               COALESCE(sum("chargedIRR"), 0) AS "chargedIRR",
               max("date") AS "lastUsedAt"
        FROM "UsageLog"
        WHERE "date" >= ${since} AND "status" = 'CAPTURED'
        GROUP BY "workspaceId"
      )
      SELECT usage."workspaceId" AS "workspaceId",
             workspace."name" AS "workspaceName",
             workspace."plan"::text AS "plan",
             (
               SELECT COALESCE(NULLIF(member."name", ''), member."phone")
               FROM "User" member
               WHERE member."workspaceId" = workspace."id"
               ORDER BY CASE WHEN member."role" = 'OWNER' THEN 0 ELSE 1 END,
                        member."createdAt" ASC
               LIMIT 1
             ) AS "ownerLabel",
             (SELECT count(*) FROM "User" member WHERE member."workspaceId" = workspace."id") AS "userCount",
             usage."requests",
             usage."promptTokens",
             usage."completionTokens",
             usage."reasoningTokens",
             usage."cachedTokens",
             usage."providerCostUSD",
             usage."chargedIRR",
             usage."lastUsedAt"
      FROM usage_by_workspace usage
      JOIN "Workspace" workspace ON workspace."id" = usage."workspaceId"
      ORDER BY usage."providerCostUSD" DESC, usage."requests" DESC
      LIMIT 50
    `,
    prisma.$queryRaw<RecentRow[]>`
      SELECT usage."id",
             usage."date",
             usage."workspaceId",
             workspace."name" AS "workspaceName",
             usage."model",
             usage."type"::text AS "type",
             usage."promptTokens",
             usage."completionTokens",
             usage."reasoningTokens",
             usage."cost" AS "providerCostUSD",
             usage."chargedIRR"
      FROM "UsageLog" usage
      JOIN "Workspace" workspace ON workspace."id" = usage."workspaceId"
      WHERE usage."status" = 'CAPTURED'
      ORDER BY usage."date" DESC
      LIMIT 12
    `,
  ])

  const total = totalsRows[0]
  const totals: AiUsageTotals = {
    requests: Number(total?.requests ?? 0),
    promptTokens: Number(total?.promptTokens ?? 0),
    completionTokens: Number(total?.completionTokens ?? 0),
    reasoningTokens: Number(total?.reasoningTokens ?? 0),
    cachedTokens: Number(total?.cachedTokens ?? 0),
    providerCostUSD: Number(total?.providerCostUSD ?? 0),
    chargedIRR: Number(total?.chargedIRR ?? 0),
    pricedRequests: Number(total?.pricedRequests ?? 0),
  }

  const models: AiModelUsage[] = modelRows.map((row) => ({
    model: row.model ?? 'نامشخص',
    requests: Number(row.requests),
    promptTokens: Number(row.promptTokens),
    completionTokens: Number(row.completionTokens),
    reasoningTokens: Number(row.reasoningTokens),
    cachedTokens: Number(row.cachedTokens),
    providerCostUSD: Number(row.providerCostUSD ?? 0),
    chargedIRR: Number(row.chargedIRR),
  }))

  const workspaces: AiWorkspaceUsage[] = workspaceRows.map((row) => ({
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    plan: row.plan,
    ownerLabel: row.ownerLabel,
    userCount: Number(row.userCount),
    requests: Number(row.requests),
    promptTokens: Number(row.promptTokens),
    completionTokens: Number(row.completionTokens),
    reasoningTokens: Number(row.reasoningTokens),
    cachedTokens: Number(row.cachedTokens),
    providerCostUSD: Number(row.providerCostUSD ?? 0),
    chargedIRR: Number(row.chargedIRR),
    lastUsedAt: row.lastUsedAt,
  }))

  const recent: RecentAiUsage[] = recentRows.map((row) => ({
    ...row,
    promptTokens: Number(row.promptTokens),
    completionTokens: Number(row.completionTokens),
    reasoningTokens: Number(row.reasoningTokens),
    providerCostUSD: row.providerCostUSD === null ? null : Number(row.providerCostUSD),
    chargedIRR: Number(row.chargedIRR),
  }))

  return {
    totals,
    daily: fillDaily(dailyRows, days),
    models,
    workspaces,
    recent,
  }
}
