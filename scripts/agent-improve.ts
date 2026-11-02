/**
 * E3 — one manual Propose → Probe → Compose step in the spirit of Harness²
 * (google-research/harness2): improve the harness around the model, never
 * the model, and keep only what the bench shows.
 *
 *   1. Propose: from one issue cluster of a quality review (scripts/agent-quality-review.ts),
 *      the model writes two candidate rules: an invariant one (any business)
 *      and a domain one (the business type of the examples).
 *   2. Probe: the bench runs the cluster's scenarios plus a fixed guard set
 *      three times over: without a rule, with the invariant rule, with the
 *      domain rule (rules are injected in memory via PERSONA_EXTRA_RULES).
 *   3. Compose: the rule that improves the target scenarios without dropping
 *      the guard set wins; the step is written to docs/agent-lessons/ with its
 *      evidence. Nothing is applied automatically: a winner goes into the
 *      kernel by hand, through the bench gate (scripts/agent-bench.ts).
 *
 *   npx tsx -r dotenv/config scripts/agent-improve.ts --code HANDOFF_MISSED --k 1
 *   … --review evals/quality-reviews/<file>.json --max-usd 0.6 --yes
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { arg, confirmCost } from './lib/cost-confirm'

const k = Math.max(1, Number(arg('k') ?? 1))
const maxUSD = Number(arg('max-usd') ?? 0.6)
const model = process.env.IMPROVE_MODEL ?? 'deepseek/deepseek-v4.1-flash-1017'
const RESULTS = path.join(process.cwd(), 'tests-live', 'results')
const SUITE = path.join(process.cwd(), 'tests-live', 'scenarios', 'persona-v1.json')
const JUDGE_USD_PER_RUN = 0.0015
const USD_PER_TURN = 0.0006

/** Bench scenarios each issue code is measured on. */
const TARGETS: Record<string, string[]> = {
  HANDOFF_MISSED: ['H'], FALSE_PROMISE: ['H', 'K04', 'K05'], COLD_TONE: ['H05', 'H10', 'X01'],
  PRODUCT_WRONG: ['P'], PRODUCT_MISSED: ['P'], PRODUCT_NAME_BAD: ['P'],
  IGNORED_QUESTION: ['K', 'F'], VERBOSE_BORING: ['F', 'K'], REPETITION: ['F'], PUSHY_CONTACT: ['H11', 'F', 'K04'],
  HALLUCINATION: ['K', 'P07', 'P17'], CONTEXT_LOST: ['F04', 'P18', 'H12'], BAD_LANGUAGE: ['P03', 'P14', 'X02'],
}
/** Always run: stable scenarios a new rule must not break. */
const GUARD = ['P01', 'P05', 'P09', 'F02', 'H08', 'K03']

type Review = { rows: Array<{ ws?: string; issues?: Array<{ code: string; quote?: string; why?: string; ideal?: string }> }> }
type Bench = { summary: { passRate: number; judgeAvg: number }; results: Array<{ scenario: string; pass: boolean; judge: { score: number } | null }> }

function latestReview(): string | null {
  const dir = path.join(process.cwd(), 'evals', 'quality-reviews')
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json')).sort()
  return files.length ? path.join(dir, files[files.length - 1]) : null
}

async function propose(code: string, examples: string[]): Promise<{ invariant: string; domain: string; why: string } | null> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'vigent-agent-improve' },
    body: JSON.stringify({
      model, temperature: 0.4, max_tokens: 2500,
      reasoning: { effort: 'low', exclude: true },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You improve the instructions of a Persian customer-service AI agent without changing the model. Given real failures of one kind, write two candidate rules in Persian, each ONE short imperative sentence the agent can follow: "invariant" fixes the general behaviour for every business; "domain" fixes it for the business type seen in the examples. Never ask for a capability the agent lacks; never contradict "only state facts from the data". Return JSON {"invariant":"…","domain":"…","why":"one English sentence"}.' },
        { role: 'user', content: `Issue code: ${code}\nReal examples:\n${examples.join('\n')}` },
      ],
    }),
  })
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  try {
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '') as { invariant?: string; domain?: string; why?: string }
    return parsed.invariant && parsed.domain ? { invariant: parsed.invariant, domain: parsed.domain, why: parsed.why ?? '' } : null
  } catch {
    return null
  }
}

function bench(label: string, only: string[], rules: string[]): Bench | null {
  const run = spawnSync('npx', ['vitest', 'run', '-c', 'vitest.live.config.ts', 'tests-live/persona-eval.live.ts'], {
    stdio: 'inherit',
    env: { ...process.env, EVAL_LABEL: label, EVAL_K: String(k), EVAL_ONLY: only.join(','), PERSONA_EXTRA_RULES: JSON.stringify(rules) },
  })
  if (run.status !== 0) return null
  const file = path.join(RESULTS, `persona-${label}.json`)
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Bench : null
}

const rate = (result: Bench | null, ids: string[]) => {
  const runs = (result?.results ?? []).filter((run) => ids.some((id) => run.scenario.startsWith(id)))
  return runs.length ? runs.filter((run) => run.pass).length / runs.length : 0
}

async function main() {
  const reviewFile = arg('review') ?? latestReview()
  if (!reviewFile) throw new Error('run scripts/agent-quality-review.ts first (or pass --review)')
  const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8')) as Review
  const counts = new Map<string, number>()
  for (const row of review.rows) for (const issue of row.issues ?? []) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1)
  const code = arg('code') ?? [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!code) throw new Error('the review has no issues')
  const examples = review.rows.flatMap((row) => (row.issues ?? [])
    .filter((issue) => issue.code === code)
    // Phone-like digit runs never reach the lessons file (it is committed).
    .map((issue) => `- [${row.ws ?? ''}] «${issue.quote ?? ''}» — ${issue.why ?? ''} → ideal: ${issue.ideal ?? ''}`.replace(/[0-9۰-۹]{7,}/g, '…')))
    .slice(0, 8)
  const targets = TARGETS[code] ?? ['P', 'F', 'K']
  const suite = JSON.parse(fs.readFileSync(SUITE, 'utf8')) as { scenarios: Array<{ id: string; turns: string[] }> }
  const chosen = suite.scenarios.filter((scenario) => [...targets, ...GUARD].some((prefix) => scenario.id.startsWith(prefix)))
  const turns = chosen.reduce((sum, scenario) => sum + scenario.turns.length, 0) * k * 3
  const estimate = 0.003 + turns * USD_PER_TURN + chosen.length * k * 3 * JUDGE_USD_PER_RUN
  const ok = await confirmCost([
    `improvement step for ${code} (${counts.get(code) ?? 0} occurrences in ${path.basename(reviewFile)})`,
    `1 proposal call + 3 bench variants × ${chosen.length} scenarios × ${k} run(s) = ${turns} agent turns`,
  ], estimate, maxUSD)
  if (!ok) { console.log('cancelled'); return }
  if (estimate > maxUSD) { console.log(`estimate is over the $${maxUSD} cap — lower --k or pass --max-usd`); return }

  const proposal = await propose(code, examples)
  if (!proposal) throw new Error('the proposal call returned no usable rules')
  console.log(`\ninvariant: ${proposal.invariant}\ndomain:    ${proposal.domain}\n`)
  const ids = chosen.map((scenario) => scenario.id)
  const stamp = new Date().toISOString().slice(0, 10)
  const base = bench(`improve-${code}-base`, ids, [])
  const invariant = bench(`improve-${code}-invariant`, ids, [proposal.invariant])
  const domain = bench(`improve-${code}-domain`, ids, [proposal.domain])

  const rows = [['بدون قانون', base], ['قانون عمومی', invariant], ['قانون صنفی', domain]] as const
  const table = rows.map(([name, result]) => `| ${name} | ${Math.round(rate(result, targets) * 100)}٪ | ${Math.round(rate(result, GUARD) * 100)}٪ | ${result?.summary.judgeAvg.toFixed(1) ?? '-'} |`)
  const candidates = [['invariant', invariant, proposal.invariant], ['domain', domain, proposal.domain]] as const
  const baseTarget = rate(base, targets)
  const baseGuard = rate(base, GUARD)
  const winner = candidates
    .filter(([, result]) => rate(result, targets) > baseTarget && rate(result, GUARD) >= baseGuard - 0.05)
    .sort((a, b) => rate(b[1], targets) - rate(a[1], targets))[0]

  const lesson = [
    `# درس ${stamp} — ${code}`,
    '',
    `منبع: ${path.basename(reviewFile)} · ${counts.get(code) ?? 0} مورد · مدل پیشنهاد ${model}`,
    '',
    '## نمونه‌های واقعی',
    ...examples,
    '',
    '## پیشنهادها',
    `- عمومی: ${proposal.invariant}`,
    `- صنفی: ${proposal.domain}`,
    `- چرا: ${proposal.why}`,
    '',
    '## آزمودن (میز تست، هر سناریو × ' + k + ')',
    '| نسخه | سناریوهای هدف | سناریوهای محافظ | نمرهٔ داور |',
    '| --- | --- | --- | --- |',
    ...table,
    '',
    '## ترکیب',
    winner
      ? `برنده: قانون ${winner[0] === 'invariant' ? 'عمومی' : 'صنفی'} — «${winner[2]}». برای اعمال، آن را در اسکیل مربوط در lib/agent-kernel بگذارید و scripts/agent-bench.ts را با --baseline اجرا کنید.`
      : 'هیچ نسخه‌ای بدون افت سناریوهای محافظ بهتر نشد؛ چیزی اعمال نشود.',
  ].join('\n')
  const dir = path.join(process.cwd(), 'docs', 'agent-lessons')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${stamp}-${code}.md`)
  fs.writeFileSync(file, lesson)
  console.log(`\n${lesson}\n\nwritten: ${file}`)
}

main().catch((error) => { console.error(error); process.exit(1) })
