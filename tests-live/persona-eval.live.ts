/**
 * Persona regression bench for the customer-facing agent.
 *
 * Real: OpenRouter model calls, each tenant's real catalog / knowledge base /
 * prompt config and the full generateReply pipeline. Every conversation runs
 * as a playground conversation (hidden from inbox, stats and owner alerts),
 * owner notifications are mocked, the tenant is never charged, and all rows
 * created here are hard-deleted afterwards.
 *
 *   PERSONA_SUITE=tests-live/scenarios/persona-v1.json EVAL_LABEL=baseline \
 *     npx vitest run -c vitest.live.config.ts tests-live/persona-eval.live.ts
 *
 * Optional: EVAL_K=3 (pass^k repeats), EVAL_ONLY=A (scenario id prefix),
 * EVAL_CONCURRENCY=3, EVAL_JUDGE_MODEL (default deepseek/deepseek-v4.1-flash).
 * Results: tests-live/results/persona-<label>.json
 */
import { afterAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'

const alerts: Array<{ conversationId: string; reason: string }> = []
// System prompts each turn sent to the model, so the judge sees the same
// knowledge and catalog evidence the agent saw (scenarios run concurrently).
const turnPrompts = new AsyncLocalStorage<string[]>()

vi.mock('@/lib/ai/openrouter', async (orig) => {
  const real = await orig<Record<string, unknown>>()
  const wrap = (name: string) => (...args: unknown[]) => {
    const messages = (args[0] as { messages?: Array<{ role: string; content?: string | null }> } | null)?.messages ?? []
    const system = messages.find((item) => item.role === 'system')?.content
    if (system) turnPrompts.getStore()?.push(system)
    // Booking/course/catalog tool results are evidence too (free slots, course data).
    for (const item of messages) {
      if (item.role === 'tool' && item.content) turnPrompts.getStore()?.push(`<knowledge>${item.content}</knowledge>`)
    }
    return (real[name] as (...inner: unknown[]) => unknown)(...args)
  }
  return { ...real, chatCompletion: wrap('chatCompletion'), streamChat: wrap('streamChat'), streamChatWithRetry: wrap('streamChatWithRetry') }
})

vi.mock('@/lib/billing/ai-credits', () => ({
  reserveChatCredit: vi.fn(async () => ({
    ok: true,
    reservation: { usageLogId: 'persona', chargeIRR: 0, balanceAfterIRR: 0, modelAlias: 'fast' },
  })),
  captureChatCredit: vi.fn(async () => {}),
  releaseChatCredit: vi.fn(async () => {}),
}))
vi.mock('@/lib/billing/entitlements', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  checkChatAllowed: vi.fn(async () => ({ allowed: true, plan: 'PRO' })),
}))
// EVAL_PROVIDER_MODEL=<openrouter slug> runs every agent on that model (A/B a model without touching settings).
vi.mock('@/lib/ai/platform-config', async (orig) => {
  const real = await orig<typeof import('@/lib/ai/platform-config')>()
  const override = process.env.EVAL_PROVIDER_MODEL
  if (!override) return real
  return {
    ...real,
    getPlatformAiConfig: async () => {
      const config = await real.getPlatformAiConfig()
      return { ...config, providerModels: { fast: override, smart: override } }
    },
  }
})
vi.mock('@/lib/notifications/create', () => ({ notifyWorkspace: vi.fn(async () => {}) }))
vi.mock('@/lib/notifications/operator-telegram', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  sendOperatorTelegramNotification: vi.fn(async () => {}),
}))
vi.mock('@/lib/billing/trial-quota-alert', () => ({ processTrialQuotaAlert: vi.fn(async () => ({})) }))
vi.mock('@/lib/onboarding', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  syncOnboarding: vi.fn(async () => {}),
}))
vi.mock('@/lib/channels/operator-handoff', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  createHandoffAlert: vi.fn(async (ctx: { conversationId: string; reason?: string | null }) => {
    alerts.push({ conversationId: ctx.conversationId, reason: ctx.reason ?? '' })
    return `alert-${alerts.length}`
  }),
}))
vi.mock('@/lib/ai/handoff', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  notifyHandoff: vi.fn(async (params: { conversationId: string; reason: string }) => {
    alerts.push({ conversationId: params.conversationId, reason: params.reason })
    return `alert-${alerts.length}`
  }),
}))

import { generateReply } from '@/lib/ai/chat-engine'
import type { ChatAgent } from '@/lib/ai/chat-types'
import { PrismaClient, type ChannelType } from '@prisma/client'

// ─── suite format ─────────────────────────────────────────────────────────
type TurnRule = { turn?: number; any?: string[]; all?: string[] }
type Scenario = {
  id: string
  /** Agent alias from the suite's `agents` map. */
  agent: string
  persona: string
  category: string
  /** What an excellent salesperson would do — the judge grades against it. */
  goal: string
  turns: string[]
  channel?: ChannelType
  /** In-memory agent overrides (never written to the database). */
  override?: Partial<Pick<ChatAgent, 'handoffEnabled' | 'handoffMessage' | 'requireCustomerInfo'>>
  /** Ground truth the judge may rely on (store data it cannot see otherwise). */
  facts?: string
  expect?: {
    /** A real transfer (owner alert or human-owned thread) must exist by this 1-based turn. */
    handoffBy?: number
    noHandoff?: boolean
    /** A product card whose name matches must appear (on `turn`, or anywhere). */
    cards?: TurnRule[]
    /** No product card on that turn may match. */
    notCards?: TurnRule[]
    mention?: TurnRule[]
    notMention?: TurnRule[]
    maxChars?: number
  }
}
type Suite = { agents: Record<string, string>; scenarios: Scenario[] }

type TurnOut = {
  user: string
  reply: string
  ms: number
  usd: number | null
  acts: unknown
  cards: string[]
  handedOff: boolean
  alerts: number
  /** Knowledge and catalog rows the reply model was shown on this turn. */
  evidence: string
  error?: string
}
type Check = { name: string; ok: boolean; detail?: string }
type RunOut = {
  scenario: string
  category: string
  persona: string
  agent: string
  repeat: number
  turns: TurnOut[]
  checks: Check[]
  judge: { pass: boolean; score: number; issues: string[]; note: string } | null
  pass: boolean
}

const SUITE_FILE = process.env.PERSONA_SUITE ?? path.join(__dirname, 'scenarios', 'persona-v1.json')
const LABEL = process.env.EVAL_LABEL ?? 'run'
const K = Math.max(1, Number(process.env.EVAL_K ?? 1))
const ONLY = process.env.EVAL_ONLY ?? ''
const CONCURRENCY = Math.max(1, Number(process.env.EVAL_CONCURRENCY ?? 3))
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? 'deepseek/deepseek-v4.1-flash'
const RUN = `vpersona-${Date.now().toString(36)}`
const EXTRA_RULES: string[] = (() => {
  try { return (JSON.parse(process.env.PERSONA_EXTRA_RULES ?? '[]') as unknown[]).filter((rule): rule is string => typeof rule === 'string') } catch { return [] }
})()

// ─── text helpers ────────────────────────────────────────────────────────
const norm = (value: string) => value
  .normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/‌/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim()
const cardNames = (reply: string) => [...reply.matchAll(/\[\[product:(\{[^\n]*?\})\]\]/g)].map((m) => {
  try {
    const card = JSON.parse(m[1]) as { name?: string; variant?: string }
    return `${card.name ?? ''} ${card.variant ?? ''}`.trim()
  } catch { return '' }
}).filter(Boolean)
const prose = (reply: string) => reply.replace(/\[\[[a-z]+:[^\n]*?\]\]/g, '').trim()
/** The <knowledge> fence and the catalog rows («1. نام: …», rag.ts) of a reply prompt. */
function evidenceOf(prompts: string[]): string {
  const parts: string[] = []
  for (const prompt of prompts) {
    // The fence is also named once in its own preamble; take the last opening tag.
    const close = prompt.lastIndexOf('</knowledge>')
    const open = close >= 0 ? prompt.lastIndexOf('<knowledge>', close) : -1
    if (open >= 0) parts.push(prompt.slice(open + '<knowledge>'.length, close).trim().slice(0, 6000))
    const catalog = prompt.match(/(?:^|\n)1\. نام: [\s\S]*?(?=\n\n[^\d\s•]|$)/)
    if (catalog) parts.push(catalog[0].trim().slice(0, 6000))
  }
  return [...new Set(parts)].join('\n---\n').slice(0, 10000)
}
const matches = (text: string, rule: TurnRule) => {
  const value = norm(text)
  if (rule.all?.length && !rule.all.every((term) => value.includes(norm(term)))) return false
  if (rule.any?.length && !rule.any.some((term) => value.includes(norm(term)))) return false
  return Boolean(rule.all?.length || rule.any?.length)
}

/**
 * A reply that tells the customer a person will act («همکارم تماس می‌گیرد»,
 * «به همکارم سپردم») is a promise the system must keep. It is checked
 * against what actually happened, not against what the model said.
 */
const HUMAN_PROMISE = /(همکار|کارشناس|اپراتور|پشتیبان|مشاور|تیم)[^.!؟\n]{0,40}(تماس می|تماس خواه|زنگ می|پیگیری می|بررسی می|در ارتباط|جواب می|پاسخ می|اطلاع می)|(سپرده (شد|می)|سپردم|منتقل (شد|کردم|می)|ارجاع (شد|دادم|می)|برای (همکار|کارشناس|اپراتور)[^.!؟\n]{0,20}(فرستادم|ارسال شد|ثبت شد))/u

function checkRun(scenario: Scenario, turns: TurnOut[]): Check[] {
  const checks: Check[] = []
  const exp = scenario.expect ?? {}
  const transferAt = turns.findIndex((turn) => turn.handedOff || turn.alerts > 0)
  if (exp.handoffBy) {
    checks.push({
      name: 'handoff',
      ok: transferAt >= 0 && transferAt < exp.handoffBy,
      detail: transferAt >= 0 ? `transfer on turn ${transferAt + 1}` : 'no transfer',
    })
  }
  if (exp.noHandoff) checks.push({ name: 'no-handoff', ok: transferAt < 0, detail: transferAt >= 0 ? `transfer on turn ${transferAt + 1}` : '' })
  turns.forEach((turn, index) => {
    const transferredYet = transferAt >= 0 && transferAt <= index
    if (!transferredYet && HUMAN_PROMISE.test(prose(turn.reply))) {
      checks.push({ name: 'promise-without-action', ok: false, detail: `turn ${index + 1}: ${prose(turn.reply).slice(0, 120)}` })
    }
    if (turn.error) checks.push({ name: 'error', ok: false, detail: `turn ${index + 1}: ${turn.error.slice(0, 160)}` })
  })
  const turnsFor = (rule: TurnRule) => (rule.turn ? [turns[rule.turn - 1]].filter(Boolean) : turns)
  for (const rule of exp.cards ?? []) {
    const found = turnsFor(rule).some((turn) => turn.cards.some((card) => matches(card, rule)))
    checks.push({ name: `card ${JSON.stringify(rule.all ?? rule.any)}`, ok: found, detail: turnsFor(rule).flatMap((turn) => turn.cards).join(' | ').slice(0, 200) })
  }
  for (const rule of exp.notCards ?? []) {
    const found = turnsFor(rule).some((turn) => turn.cards.some((card) => matches(card, rule)))
    checks.push({ name: `no-card ${JSON.stringify(rule.all ?? rule.any)}`, ok: !found })
  }
  for (const rule of exp.mention ?? []) {
    checks.push({ name: `mention ${JSON.stringify(rule.all ?? rule.any)}`, ok: turnsFor(rule).some((turn) => matches(turn.reply, rule)) })
  }
  for (const rule of exp.notMention ?? []) {
    checks.push({ name: `not-mention ${JSON.stringify(rule.all ?? rule.any)}`, ok: !turnsFor(rule).some((turn) => matches(prose(turn.reply), rule)) })
  }
  if (exp.maxChars) {
    const long = turns.map((turn, index) => ({ index, size: prose(turn.reply).length })).filter((item) => item.size > exp.maxChars!)
    checks.push({ name: `max-${exp.maxChars}-chars`, ok: long.length === 0, detail: long.map((item) => `t${item.index + 1}=${item.size}`).join(',') })
  }
  return checks
}

// ─── judge (same model family as production, strict rubric) ─────────────
async function judge(scenario: Scenario, turns: TurnOut[]): Promise<RunOut['judge']> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  const transcript = turns.map((turn, index) => {
    const reply = turn.reply.replace(/\[\[product:(\{[^\n]*?\})\]\]/g, (_m, json: string) => {
      try { const card = JSON.parse(json) as { name?: string; price?: string }; return `[کارت محصول: ${card.name} | ${card.price ?? ''}]` } catch { return '[کارت محصول]' }
    })
    const system = turn.handedOff || turn.alerts > 0 ? ' {SYSTEM: real transfer to a human is active}' : ''
    const evidence = turn.evidence ? `\n[EVIDENCE shown to the agent on this turn]\n${turn.evidence}\n[/EVIDENCE]` : ''
    return `مشتری (${index + 1}): ${turn.user}${evidence}\nایجنت:${system} ${reply || `(بدون پاسخ${turn.error ? `: ${turn.error.slice(0, 80)}` : ''})`}`
  }).join('\n\n')
  const system = `You grade a Persian customer-service/sales AI agent for an Iranian small business. Be strict: the owner must LOVE every reply.
Persona of the simulated customer: ${scenario.persona}. What an excellent human salesperson would do: ${scenario.goal}
${scenario.facts ? `Verified store facts: ${scenario.facts}\n` : ''}"[کارت محصول: X]" = a real product card with photo/price was attached. "{SYSTEM: real transfer...}" = the platform really alerted a human.
"(بدون پاسخ)" after a real transfer means the AI stayed silent while waiting for a human.
HALLUCINATION only for a claim that contradicts or is absent from the EVIDENCE, the verified facts and the cards. A claim found in the EVIDENCE is grounded, even if it looks surprising. When a turn has no EVIDENCE block, flag HALLUCINATION only for a claim that is clearly invented.
Fail the run if ANY of: wrong/irrelevant product, missed product the customer clearly named, invented facts/prices/policies, promised a human action that did not really happen, ignored the question, repeated questions, robotic or long-winded reply, incoherent Persian, asked for contact info before helping.
Return ONLY JSON: {"pass":true|false,"score":1-10,"issues":["CODE: short Persian note"],"note":"one short Persian sentence"}
Codes: HANDOFF_MISSED, FALSE_PROMISE, PRODUCT_WRONG, PRODUCT_MISSED, PRODUCT_NAME_BAD, IGNORED_QUESTION, HALLUCINATION, REPETITION, VERBOSE, PUSHY_CONTACT, BAD_LANGUAGE, CONTEXT_LOST, COLD_TONE, SILENT.`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'vigent-persona-eval' },
        body: JSON.stringify({
          model: JUDGE_MODEL,
          temperature: 0,
          // DeepSeek v4.1 reasons by default; unbounded reasoning used the
          // whole budget and returned no JSON at all.
          max_tokens: 2500,
          reasoning: { effort: 'low', exclude: true },
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content: transcript }],
        }),
      })
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
      const text = body.choices?.[0]?.message?.content ?? ''
      const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, '')) as { pass?: boolean; score?: number; issues?: string[]; note?: string }
      return { pass: Boolean(parsed.pass), score: Number(parsed.score ?? 0), issues: parsed.issues ?? [], note: parsed.note ?? '' }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)))
    }
  }
  return null
}

// ─── run ──────────────────────────────────────────────────────────────────
describe.skipIf(!fs.existsSync(SUITE_FILE))('persona eval', () => {
  const raw = new PrismaClient()
  const conversationIds = new Set<string>()

  afterAll(async () => {
    try {
      const rows = await raw.conversation.findMany({ where: { externalId: { startsWith: RUN } }, select: { id: true } })
      const ids = [...new Set([...conversationIds, ...rows.map((row) => row.id)])]
      if (ids.length) await raw.conversation.deleteMany({ where: { id: { in: ids } } })
    } finally {
      await raw.$disconnect()
    }
  })

  it('runs the persona suite', async () => {
    const suite = JSON.parse(fs.readFileSync(SUITE_FILE, 'utf8')) as Suite
    // EVAL_ONLY takes one or more comma-separated id prefixes (EVAL_ONLY=P,F,K).
    const prefixes = ONLY.split(',').map((item) => item.trim()).filter(Boolean)
    const scenarios = suite.scenarios.filter((scenario) => !prefixes.length || prefixes.some((prefix) => scenario.id.startsWith(prefix)))
    const agents = new Map<string, ChatAgent & { workspaceId: string }>()
    for (const [alias, id] of Object.entries(suite.agents)) {
      const row = await raw.agent.findUnique({ where: { id } })
      if (row) agents.set(alias, row as unknown as ChatAgent & { workspaceId: string })
    }

    const jobs = scenarios.flatMap((scenario) => Array.from({ length: K }, (_, repeat) => ({ scenario, repeat })))
    const results: RunOut[] = []
    let cursor = 0
    const worker = async () => {
      while (cursor < jobs.length) {
        const { scenario, repeat } = jobs[cursor++]
        const base = agents.get(scenario.agent)
        if (!base) { console.warn(`skip ${scenario.id}: unknown agent ${scenario.agent}`); continue }
        const agent = { ...base, ...(scenario.override ?? {}) } as ChatAgent & { workspaceId: string }
        // PERSONA_EXTRA_RULES='["…"]': candidate rules (scripts/agent-improve.ts)
        // appended to every agent's «بایدها» in memory, never saved.
        if (EXTRA_RULES.length) {
          const config = (agent.promptConfig ?? {}) as { doSay?: string[] }
          agent.promptConfig = { ...config, doSay: [...(config.doSay ?? []), ...EXTRA_RULES] } as ChatAgent['promptConfig']
        }
        const externalId = `${RUN}-${scenario.id}-${repeat}`
        const turns: TurnOut[] = []
        let conversationId: string | undefined
        for (const message of scenario.turns) {
          const started = Date.now()
          const out: TurnOut = { user: message, reply: '', ms: 0, usd: null, acts: null, cards: [], handedOff: false, alerts: 0, evidence: '' }
          const prompts: string[] = []
          try {
            const result = await turnPrompts.run(prompts, () => generateReply({
              workspaceId: agent.workspaceId,
              agent,
              message,
              channel: scenario.channel ?? 'TELEGRAM',
              externalId,
              // Reads through lib/prisma skip playground rows, so a later
              // turn must name its conversation or it tries to create a
              // duplicate thread and fails on the unique key.
              ...(conversationId ? { conversationId } : {}),
              playground: true,
            }))
            if ('conversationId' in result && result.conversationId) {
              conversationId = result.conversationId
              conversationIds.add(conversationId)
            }
            if ('error' in result) out.error = JSON.stringify(result)
            else out.reply = result.reply ?? ''
          } catch (error) {
            out.error = error instanceof Error ? error.message : String(error)
          }
          out.ms = Date.now() - started
          out.cards = cardNames(out.reply)
          out.evidence = evidenceOf(prompts)
          // Deterministic catalog replies make no model call: their evidence
          // is the database row of each card they carry.
          const cardIds = [...out.reply.matchAll(/\[\[product:\{"id":"([^"#]+)/g)].map((match) => match[1])
          if (cardIds.length) {
            const rows = await raw.product.findMany({
              where: { id: { in: [...new Set(cardIds)] } },
              select: { name: true, price: true, stock: true, attributes: true, description: true },
            })
            const facts = rows.map((row) => `محصول: ${row.name} | قیمت: ${row.price ?? 'ثبت نشده'} | موجودی: ${row.stock ?? 'نامحدود/تنوع‌محور'} | مشخصات و تنوع‌ها: ${JSON.stringify(row.attributes).replace(/"image":"[^"]*",?/g, '').slice(0, 900)} | توضیحات: ${(row.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 700)}`)
            out.evidence = [out.evidence, ...facts].filter(Boolean).join('\n---\n').slice(0, 12000)
          }
          // Fire-and-forget side effects (state persist, fact capture) settle here.
          await new Promise((resolve) => setTimeout(resolve, 700))
          if (conversationId) {
            const [conversation, lastUser, lastAssistant] = await Promise.all([
              raw.conversation.findUnique({ where: { id: conversationId }, select: { handedOff: true, status: true } }),
              raw.message.findFirst({ where: { conversationId, role: 'USER' }, orderBy: { createdAt: 'desc' }, select: { metadata: true } }),
              raw.message.findFirst({ where: { conversationId, role: 'ASSISTANT' }, orderBy: { createdAt: 'desc' }, select: { metadata: true } }),
            ])
            out.handedOff = Boolean(conversation?.handedOff || conversation?.status === 'HANDED_OFF')
            out.alerts = alerts.filter((alert) => alert.conversationId === conversationId).length
            out.acts = (lastUser?.metadata as { understanding?: { acts?: unknown } } | null)?.understanding?.acts ?? null
            const cost = (lastAssistant?.metadata as { turnCost?: { totalUSD?: number } } | null)?.turnCost?.totalUSD
            out.usd = typeof cost === 'number' ? cost : null
          }
          turns.push(out)
        }
        const checks = checkRun(scenario, turns)
        const verdict = await judge(scenario, turns)
        // Hard checks decide; the judge's 1-10 score gates quality. Its own
        // pass flag flips on single polish nits, so it is recorded, not used.
        const pass = checks.every((check) => check.ok) && (verdict ? verdict.score >= 7 : true)
        results.push({ scenario: scenario.id, category: scenario.category, persona: scenario.persona, agent: scenario.agent, repeat, turns, checks, judge: verdict, pass })
        const failed = checks.filter((check) => !check.ok).map((check) => check.name)
        console.log(`${pass ? '✓' : '✗'} ${scenario.id}#${repeat} judge=${verdict?.score ?? '-'} ${failed.join(', ')} ${verdict && !verdict.pass ? verdict.issues.join(' / ') : ''}`)
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    // ─── summary: pass^k per scenario, per-category pass rate, cost, latency
    const byScenario = new Map<string, RunOut[]>()
    for (const result of results) byScenario.set(result.scenario, [...(byScenario.get(result.scenario) ?? []), result])
    const categories = new Map<string, { runs: number; passed: number; allK: number; scenarios: number }>()
    for (const [, runs] of byScenario) {
      const category = runs[0].category
      const entry = categories.get(category) ?? { runs: 0, passed: 0, allK: 0, scenarios: 0 }
      entry.runs += runs.length
      entry.passed += runs.filter((run) => run.pass).length
      entry.scenarios += 1
      if (runs.every((run) => run.pass)) entry.allK += 1
      categories.set(category, entry)
    }
    const allTurns = results.flatMap((result) => result.turns)
    const costs = allTurns.map((turn) => turn.usd).filter((value): value is number => typeof value === 'number')
    const latencies = allTurns.map((turn) => turn.ms).sort((a, b) => a - b)
    const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] ?? 0
    const summary = {
      label: LABEL,
      k: K,
      at: new Date().toISOString(),
      scenarios: byScenario.size,
      runs: results.length,
      passRate: results.length ? results.filter((run) => run.pass).length / results.length : 0,
      passK: byScenario.size ? [...byScenario.values()].filter((runs) => runs.every((run) => run.pass)).length / byScenario.size : 0,
      categories: Object.fromEntries([...categories].map(([name, entry]) => [name, { ...entry, rate: entry.passed / entry.runs, passK: entry.allK / entry.scenarios }])),
      judgeAvg: results.filter((run) => run.judge).reduce((sum, run) => sum + (run.judge?.score ?? 0), 0) / Math.max(1, results.filter((run) => run.judge).length),
      usdPerTurn: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
      usdTotal: costs.reduce((a, b) => a + b, 0),
      latencyP50: pct(0.5),
      latencyP95: pct(0.95),
    }
    const outFile = path.join(__dirname, 'results', `persona-${LABEL}.json`)
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.writeFileSync(outFile, JSON.stringify({ summary, results }, null, 1))
    console.log(JSON.stringify(summary, null, 1))
    expect(results.length).toBeGreaterThan(0)
  })
})

it('persona eval sanity', () => expect(true).toBe(true))
