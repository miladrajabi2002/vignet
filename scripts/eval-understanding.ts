/**
 * Turn-understanding evaluation runner.
 *
 *   npx tsx scripts/eval-understanding.ts --system legacy        # offline baseline (regex router)
 *   npx tsx -r dotenv/config scripts/eval-understanding.ts --system llm   # model reading (needs OPENROUTER_API_KEY)
 *   … --system both --model deepseek/deepseek-v4-flash --only G --label before
 *
 * Scores, per case: required acts present, forbidden acts absent (e.g. no
 * order_cancel on a colour change), referenced candidates, cart operations,
 * budget/sort and answers-pending. The model path runs the SAME verification
 * the engine runs (verify.ts), so the score is what the customer would get.
 * Writes evals/results/<label>-<system>.json and prints a markdown summary.
 * Nothing touches the database and no message is sent.
 */
import fs from 'node:fs'
import path from 'node:path'
import { EVAL_CASES } from '../evals/understanding/cases'
import type { EvalCase, EvalProduct } from '../evals/understanding/types'
import { actDomain, legacyReading } from '@/lib/agent/understand/legacy-adapter'
import { buildUnderstandMessages } from '@/lib/agent/understand/prompt'
import { parseUnderstanding, UNDERSTAND_TOOL, UNDERSTAND_TOOL_NAME } from '@/lib/agent/understand/schema'
import { verifyUnderstanding } from '@/lib/agent/understand/verify'
import { tokenizeCatalogText } from '@/lib/ai/conversation'
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { Act, ActType, TurnCandidates, VerifiedUnderstanding } from '@/lib/agent/understand/types'

type System = 'legacy' | 'llm'

interface CaseResult {
  id: string
  tags: string[]
  message: string
  predicted: ActType[]
  refs: string[]
  pass: boolean
  checks: Record<string, boolean>
  destructiveFalsePositive: boolean
  latencyMs?: number
  promptTokens?: number
  completionTokens?: number
  costUSD?: number | null
  error?: string
  notes?: string[]
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

/** The closed candidate world of one case, exactly as the engine builds it. */
export function candidatesFor(c: EvalCase): TurnCandidates {
  const product = (item: EvalProduct, ref: string, id: string) => ({
    ref, id, name: item.name, price: item.price ?? null,
    ...(item.variants ? { variants: item.variants } : {}),
    ...(item.unavailable ? { unavailable: true } : {}),
  })
  const vocabulary = [...new Set([
    ...(c.cards ?? []), ...(c.active ? [c.active] : []), ...(c.seen ?? []), ...(c.cart ?? []).map((line) => ({ name: line.name })),
  ].flatMap((item) => tokenizeCatalogText(item.name)))]
  return {
    capabilities: c.capabilities ?? [],
    pending: c.pending ?? null,
    task: c.task ?? null,
    shownCards: (c.cards ?? []).map((item, index) => product(item, `card:${index + 1}`, `p-card-${index + 1}`)),
    cart: (c.cart ?? []).map((line, index) => ({
      ref: `cart:${index + 1}`, line: index + 1, productId: `p-cart-${index + 1}`, name: line.name, variant: line.variant ?? null, quantity: line.qty ?? 1,
    })),
    active: c.active ? product(c.active, 'active', 'p-active') : null,
    seen: (c.seen ?? []).map((item, index) => product(item, `seen:${index + 1}`, `p-seen-${index + 1}`)),
    services: (c.services ?? []).map((name, index) => ({ ref: `svc:${index + 1}`, id: `svc-${index + 1}`, name })),
    courses: (c.courses ?? []).map((name, index) => ({ ref: `course:${index + 1}`, id: `course-${index + 1}`, name })),
    vocabulary: vocabulary.slice(0, 40),
    categories: [],
  }
}

function actRefs(act: Act): string[] {
  switch (act.type) {
    case 'product_question': case 'variants': case 'cheaper_alternative': return [act.target]
    case 'compare': return act.targets
    case 'order_start': return act.items.map((item) => item.target)
    case 'cart_edit': return act.ops.map((op) => op.op === 'add' ? op.target : op.line)
    case 'restock_subscribe': return act.target ? [act.target] : []
    case 'booking': return act.service ? [act.service] : []
    case 'course': return act.course ? [act.course] : []
    default: return []
  }
}

const DESTRUCTIVE: ActType[] = ['order_cancel']

/**
 * Routing = the right domains (product / order / booking / course / restock /
 * tracking / handoff / closing / general) without forbidden ones. Comparable
 * across both systems: the legacy router has no policy/knowledge acts, it
 * just sends such turns to the general knowledge path.
 */
function routingCheck(c: EvalCase, predicted: ActType[]): boolean {
  const predictedDomains = new Set(predicted.length ? predicted.map(actDomain) : ['general'])
  const required = [...new Set(c.expect.acts.map(actDomain))]
  const forbidden = [...new Set((c.expect.notActs ?? []).map(actDomain))].filter((domain) => domain !== 'general')
  return required.every((domain) => predictedDomains.has(domain)) && !forbidden.some((domain) => predictedDomains.has(domain))
}

/** A destructive act nobody asked for. Answering «لغو شود؟» with «آره لغو کن» is asked for. */
function isDestructiveFalsePositive(c: EvalCase, set: Set<ActType>): boolean {
  if (c.pending?.kind === 'confirm_cancel') return false
  return DESTRUCTIVE.some((act) => set.has(act) && !c.expect.acts.includes(act))
}

function score(c: EvalCase, predicted: ActType[], verified: VerifiedUnderstanding | null): Omit<CaseResult, 'id' | 'tags' | 'message'> {
  const set = new Set(predicted)
  const checks: Record<string, boolean> = {}
  checks.routing = routingCheck(c, predicted)
  if (!verified) {
    // The legacy router is scored on routing only (no refs, ops or acts of its own).
    return { predicted, refs: [], checks, pass: checks.routing, destructiveFalsePositive: isDestructiveFalsePositive(c, set) }
  }
  checks.requiredActs = c.expect.acts.every((act) => set.has(act))
  checks.forbiddenActs = !(c.expect.notActs ?? []).some((act) => set.has(act))
  const refs = verified ? verified.acts.flatMap(actRefs).map((ref) => ref === 'entity' ? 'active' : ref) : []
  if (verified && c.expect.refs?.length) checks.refs = c.expect.refs.every((ref) => refs.includes(ref))
  if (verified && c.expect.ops?.length) {
    const ops = verified.acts.flatMap((act) => act.type === 'cart_edit' ? act.ops : [])
    checks.ops = c.expect.ops.every((want) => ops.some((op) => {
      if (op.op !== want.op) return false
      const ref = op.op === 'add' ? op.target : op.line
      if (ref !== want.ref) return false
      if (want.quantity != null && (op.op !== 'set_quantity' || op.quantity !== want.quantity)) return false
      if (want.variant && (op.op !== 'set_variant' || !op.variant.includes(want.variant))) return false
      return true
    }))
  }
  if (verified && (c.expect.maxPrice != null || c.expect.sort)) {
    const search = verified.acts.find((act): act is Extract<Act, { type: 'product_search' }> => act.type === 'product_search')
    checks.budget = Boolean(search)
      && (c.expect.maxPrice == null || search!.maxPrice === c.expect.maxPrice)
      && (!c.expect.sort || search!.sort === c.expect.sort)
  }
  if (verified && c.expect.answersPending != null) checks.answersPending = verified.answersPending === c.expect.answersPending
  const destructiveFalsePositive = isDestructiveFalsePositive(c, set)
  return {
    predicted,
    refs,
    checks,
    pass: Object.values(checks).every(Boolean),
    destructiveFalsePositive,
  }
}

function legacyRun(c: EvalCase): CaseResult {
  const history: ChatMessage[] = (c.history ?? []).map((turn) => ({ role: turn.role, content: turn.text }))
  const capabilities = new Set(c.capabilities ?? [])
  const reading = legacyReading({
    message: c.message,
    history,
    hasDraft: (c.cart ?? []).length > 0,
    capabilities: {
      orderCapture: capabilities.has('order_capture'),
      bookings: capabilities.has('bookings'),
      courses: capabilities.has('courses'),
      restock: capabilities.has('restock'),
      tracking: capabilities.has('order_tracking'),
    },
  })
  const predicted = reading.acts
  return { id: c.id, tags: c.tags, message: c.message, ...score(c, predicted, null) }
}

async function llmRun(c: EvalCase, model: string): Promise<CaseResult> {
  const { chatCompletion } = await import('@/lib/ai/openrouter')
  const candidates = candidatesFor(c)
  const recent = (c.history ?? []).map((turn) => ({ role: turn.role, content: turn.text }))
  const startedAt = Date.now()
  try {
    const result = await chatCompletion({
      model,
      messages: buildUnderstandMessages({ message: c.message, recent, candidates }),
      tools: [UNDERSTAND_TOOL],
      toolChoice: { type: 'function', function: { name: UNDERSTAND_TOOL_NAME } },
      temperature: 0,
      maxTokens: 450,
      timeoutMs: 15_000,
      retries: 1,
    })
    const latencyMs = Date.now() - startedAt
    const call = result.toolCalls.find((item) => item.function.name === UNDERSTAND_TOOL_NAME) ?? result.toolCalls[0]
    const raw = parseUnderstanding(call?.function.arguments ?? result.content)
    if (!raw) {
      return { id: c.id, tags: c.tags, message: c.message, predicted: [], refs: [], pass: false, checks: { parsed: false }, destructiveFalsePositive: false, latencyMs, error: 'MALFORMED' }
    }
    const verified = verifyUnderstanding({
      understanding: raw,
      candidates,
      message: c.message,
      recentText: recent.map((turn) => turn.content).join('\n'),
      vocabulary: new Set(candidates.vocabulary),
    })
    const predicted = verified.acts.map((act) => act.type).filter((type) => type !== 'other')
    return {
      id: c.id,
      tags: c.tags,
      message: c.message,
      ...score(c, predicted, verified),
      latencyMs,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      costUSD: result.usage.costUSD,
      notes: verified.notes.map((note) => `${note.code}:${note.act}${note.detail ? `:${note.detail}` : ''}`),
    }
  } catch (error) {
    return {
      id: c.id, tags: c.tags, message: c.message, predicted: [], refs: [], pass: false, checks: { called: false }, destructiveFalsePositive: false,
      latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message.slice(0, 80) : 'ERROR',
    }
  }
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

export function summarize(system: System, results: CaseResult[]) {
  const byTag = new Map<string, { total: number; pass: number }>()
  for (const result of results) {
    for (const tag of result.tags) {
      const entry = byTag.get(tag) ?? { total: 0, pass: 0 }
      entry.total += 1
      if (result.pass) entry.pass += 1
      byTag.set(tag, entry)
    }
  }
  const latencies = results.flatMap((result) => result.latencyMs != null ? [result.latencyMs] : [])
  const cost = results.reduce((sum, result) => sum + (result.costUSD ?? 0), 0)
  const routingPassed = results.filter((result) => result.checks.routing).length
  return {
    system,
    cases: results.length,
    routingPassed,
    routingRate: results.length ? Math.round((routingPassed / results.length) * 1000) / 10 : 0,
    passed: results.filter((result) => result.pass).length,
    passRate: results.length ? Math.round((results.filter((result) => result.pass).length / results.length) * 1000) / 10 : 0,
    destructiveFalsePositives: results.filter((result) => result.destructiveFalsePositive).map((result) => result.id),
    regressionCasesPassed: results.filter((result) => result.tags.includes('regression') && result.pass).length,
    regressionCases: results.filter((result) => result.tags.includes('regression')).length,
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    costUSD: Math.round(cost * 1_000_000) / 1_000_000,
    avgPromptTokens: latencies.length ? Math.round(results.reduce((sum, r) => sum + (r.promptTokens ?? 0), 0) / latencies.length) : null,
    byTag: Object.fromEntries([...byTag.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, value]) => [tag, `${value.pass}/${value.total}`])),
    failures: results.filter((result) => !result.pass).map((result) => ({
      id: result.id,
      message: result.message,
      predicted: result.predicted,
      failed: Object.entries(result.checks).filter(([, ok]) => !ok).map(([check]) => check),
      ...(result.error ? { error: result.error } : {}),
    })),
  }
}

async function main() {
  const system = (arg('system') ?? 'legacy') as System | 'both'
  const only = arg('only')
  const label = arg('label') ?? new Date().toISOString().slice(0, 10)
  const cases = EVAL_CASES.filter((c) => !only || c.id.startsWith(only) || c.tags.includes(only))
  const outDir = path.join(process.cwd(), 'evals', 'results')
  fs.mkdirSync(outDir, { recursive: true })
  const systems: System[] = system === 'both' ? ['legacy', 'llm'] : [system]
  for (const current of systems) {
    let results: CaseResult[]
    if (current === 'legacy') {
      results = cases.map(legacyRun)
    } else {
      const { economicalModel } = await import('@/lib/ai/llm/aux').catch(() => ({ economicalModel: null }))
      const model = arg('model') ?? (economicalModel ? await economicalModel().catch(() => 'deepseek/deepseek-v4-flash') : 'deepseek/deepseek-v4-flash')
      results = []
      const concurrency = Math.max(1, Number(arg('concurrency') ?? 4))
      let cursor = 0
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (cursor < cases.length) {
          const index = cursor++
          results[index] = await llmRun(cases[index], model)
        }
      }))
      console.log(`model: ${model}`)
    }
    const summary = summarize(current, results)
    fs.writeFileSync(path.join(outDir, `${label}-${current}.json`), JSON.stringify({ summary, results }, null, 2))
    console.log(`\n## ${current}: routing ${summary.routingPassed}/${summary.cases} (${summary.routingRate}%) · strict ${summary.passed}/${summary.cases} (${summary.passRate}%)`)
    console.log(`regression cases passed: ${summary.regressionCasesPassed}/${summary.regressionCases}`)
    console.log(`destructive false positives (order_cancel when not asked): ${summary.destructiveFalsePositives.length ? summary.destructiveFalsePositives.join(', ') : 'none'}`)
    if (summary.latencyMs.p50 != null) console.log(`latency p50 ${summary.latencyMs.p50} ms · p95 ${summary.latencyMs.p95} ms · cost ${summary.costUSD} USD · avg prompt ${summary.avgPromptTokens} tokens`)
    console.log('by area:', JSON.stringify(summary.byTag))
    console.log(`failures (${summary.failures.length}):`)
    for (const failure of summary.failures.slice(0, 80)) {
      console.log(`  ${failure.id} [${failure.failed.join(',')}] predicted=${failure.predicted.join('+') || '∅'} ← ${failure.message.replace(/\n/g, ' ')}`)
    }
  }
}

if (process.argv[1] && /eval-understanding/.test(process.argv[1])) {
  void main()
}
