/**
 * D1 — the persona bench, run by hand before shipping a change to the agent
 * core (lib/ai, lib/agent, lib/agent-kernel). Shows the estimated cost, asks,
 * runs tests-live/persona-eval.live.ts, then compares with a baseline and
 * fails (exit 1) when any category dropped more than 5 points or a scenario
 * that passed every run now fails.
 *
 *   npx tsx -r dotenv/config scripts/agent-bench.ts --label after --k 2 --baseline baseline-2026-10-23
 *   … --only H,P          (scenario id prefixes)   … --compare-only   (no run, just the report)
 *   … --yes               (skip the question)
 *
 * Results: tests-live/results/persona-<label>.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { arg, confirmCost } from './lib/cost-confirm'

type Category = { runs: number; passed: number; rate: number; passK: number; scenarios: number }
type Result = {
  summary: { label: string; k: number; passRate: number; passK: number; judgeAvg: number; usdPerTurn: number | null; usdTotal: number; latencyP50: number; latencyP95: number; categories: Record<string, Category> }
  results: Array<{ scenario: string; category: string; pass: boolean; repeat: number; turns: unknown[] }>
}

const RESULTS = path.join(process.cwd(), 'tests-live', 'results')
const SUITE = process.env.PERSONA_SUITE ?? path.join(process.cwd(), 'tests-live', 'scenarios', 'persona-v1.json')
const label = arg('label') ?? `run-${new Date().toISOString().slice(0, 10)}`
const k = Math.max(1, Number(arg('k') ?? 2))
const only = arg('only') ?? ''
const baselineLabel = arg('baseline')
/** Judge call with evidence (≈3–8k tokens in on the -1017 snapshot). */
const JUDGE_USD_PER_RUN = 0.0015
const DEFAULT_USD_PER_TURN = 0.0008

const load = (name: string): Result | null => {
  const file = path.join(RESULTS, `persona-${name}.json`)
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Result : null
}

export function compareBench(after: Result, before: Result): boolean {
  const rows: string[] = []
  let regressed = false
  const categories = new Set([...Object.keys(before.summary.categories), ...Object.keys(after.summary.categories)])
  for (const name of categories) {
    const b = before.summary.categories[name]
    const a = after.summary.categories[name]
    if (!a || !b) continue
    const delta = Math.round((a.rate - b.rate) * 100)
    if (delta < -5) regressed = true
    rows.push(`${name.padEnd(18)} ${String(Math.round(b.rate * 100)).padStart(4)}% → ${String(Math.round(a.rate * 100)).padStart(4)}%  (${delta >= 0 ? '+' : ''}${delta})${delta < -5 ? '  ✗ REGRESSION' : ''}`)
  }
  // A scenario that passed every run before and fails every run now.
  const was = new Map<string, boolean>()
  for (const run of before.results) was.set(run.scenario, (was.get(run.scenario) ?? true) && run.pass)
  const now = new Map<string, boolean>()
  for (const run of after.results) now.set(run.scenario, (now.get(run.scenario) ?? false) || run.pass)
  const broken = [...was].filter(([id, ok]) => ok && now.has(id) && now.get(id) === false).map(([id]) => id)
  if (broken.length) regressed = true
  console.log(`\n== ${before.summary.label} → ${after.summary.label}`)
  console.log(`pass ${Math.round(before.summary.passRate * 100)}% → ${Math.round(after.summary.passRate * 100)}%   pass^k ${Math.round(before.summary.passK * 100)}% → ${Math.round(after.summary.passK * 100)}%   judge ${before.summary.judgeAvg.toFixed(1)} → ${after.summary.judgeAvg.toFixed(1)}`)
  console.log(`cost/turn $${(before.summary.usdPerTurn ?? 0).toFixed(5)} → $${(after.summary.usdPerTurn ?? 0).toFixed(5)}   p50 ${before.summary.latencyP50}ms → ${after.summary.latencyP50}ms`)
  for (const row of rows) console.log(row)
  if (broken.length) console.log(`✗ scenarios that always passed and now fail: ${broken.join(', ')}`)
  console.log(regressed ? '\n✗ GATE: do not ship — a category or a stable scenario regressed.' : '\n✓ GATE: no category regressed.')
  return !regressed
}

async function main() {
  if (process.argv.includes('--compare-only')) {
    const after = load(label)
    const before = baselineLabel ? load(baselineLabel) : null
    if (!after || !before) throw new Error('both --label and --baseline result files must exist')
    process.exit(compareBench(after, before) ? 0 : 1)
  }
  const suite = JSON.parse(fs.readFileSync(SUITE, 'utf8')) as { scenarios: Array<{ id: string; turns: string[] }> }
  const prefixes = only.split(',').map((item) => item.trim()).filter(Boolean)
  const scenarios = suite.scenarios.filter((scenario) => !prefixes.length || prefixes.some((prefix) => scenario.id.startsWith(prefix)))
  const turns = scenarios.reduce((sum, scenario) => sum + scenario.turns.length, 0) * k
  const usdPerTurn = (baselineLabel ? load(baselineLabel)?.summary.usdPerTurn : null) ?? DEFAULT_USD_PER_TURN
  const estimate = turns * usdPerTurn + scenarios.length * k * JUDGE_USD_PER_RUN
  const ok = await confirmCost([
    `persona bench "${label}": ${scenarios.length} scenarios × ${k} runs = ${turns} agent turns + ${scenarios.length * k} judge calls`,
    `agent ≈ $${usdPerTurn.toFixed(5)}/turn (last measured), judge ≈ $${JUDGE_USD_PER_RUN}/run`,
  ], estimate)
  if (!ok) { console.log('cancelled'); return }
  const run = spawnSync('npx', ['vitest', 'run', '-c', 'vitest.live.config.ts', 'tests-live/persona-eval.live.ts'], {
    stdio: 'inherit',
    env: { ...process.env, EVAL_LABEL: label, EVAL_K: String(k), EVAL_ONLY: only, EVAL_CONCURRENCY: process.env.EVAL_CONCURRENCY ?? '3' },
  })
  if (run.status !== 0) process.exit(run.status ?? 1)
  const after = load(label)
  if (!after) throw new Error('the bench wrote no result file')
  console.log(`\nresult: tests-live/results/persona-${label}.json · spent ≈ $${(after.summary.usdTotal + after.results.length * JUDGE_USD_PER_RUN).toFixed(3)}`)
  const before = baselineLabel ? load(baselineLabel) : null
  if (before) process.exit(compareBench(after, before) ? 0 : 1)
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1) })
