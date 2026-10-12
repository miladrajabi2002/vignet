/**
 * Provider benchmark for the platform's reply models.
 *
 *   npx tsx -r dotenv/config scripts/benchmark-providers.ts
 *   … --models deepseek/deepseek-v4-flash --runs 8 --out evals/results/providers.json
 *
 * For every OpenRouter endpoint of each model it sends the same turn-reading
 * request (≈3k tokens in, ≈100 out, one JSON object) pinned to that provider
 * and reports the median and worst time, failures, malformed replies and the
 * real cost per call. The ranking it prints is what the provider order in
 * lib/ai/provider-routing.ts is chosen from. Requests use evaluation
 * fixtures only: nothing touches the database and no customer text is sent.
 */
import fs from 'node:fs'
import { EVAL_CASES } from '../evals/understanding/cases'
import { candidatesFor } from './eval-understanding'
import { buildUnderstandMessages } from '@/lib/agent/understand/prompt'
import { AGENT_MODELS } from '@/lib/ai/models'

interface Endpoint { provider_name: string; tag: string; pricing: { prompt: string; completion: string }; status: number }
interface Row { model: string; provider: string; tag: string; runs: number; ok: number; malformed: number; medianMs: number | null; maxMs: number | null; costUSD: number | null; listIn: number; listOut: number; errors: string[] }

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

const KEY = process.env.OPENROUTER_API_KEY
const RUNS = Number(arg('runs') ?? 6)
const cases = EVAL_CASES.filter((_, index) => index % 9 === 4).slice(0, RUNS)

async function call(model: string, tag: string, caseIndex: number): Promise<{ ms: number; cost: number; json: boolean } | { error: string }> {
  const c = cases[caseIndex % cases.length]
  const messages = buildUnderstandMessages({
    message: c.message,
    recent: (c.history ?? []).map((item) => ({ role: item.role, content: item.text })),
    candidates: candidatesFor(c),
  })
  const startedAt = Date.now()
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages, temperature: 0, max_tokens: 450, stream: false,
        reasoning: { enabled: false }, response_format: { type: 'json_object' },
        provider: { only: [tag], data_collection: 'deny', allow_fallbacks: false },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const body = await res.json() as { provider?: string; usage?: { cost?: number }; error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> }
    if (!body.provider) return { error: (body.error?.message ?? `HTTP ${res.status}`).slice(0, 50) }
    let json = false
    try {
      const content = (body.choices?.[0]?.message?.content ?? '').replace(/```(?:json)?/g, '')
      json = Array.isArray(JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)).acts)
    } catch { /* malformed */ }
    return { ms: Date.now() - startedAt, cost: body.usage?.cost ?? 0, json }
  } catch (error) {
    return { error: (error as Error).name }
  }
}

async function benchmark(model: string, endpoint: Endpoint): Promise<Row> {
  const times: number[] = []
  const errors: string[] = []
  let cost = 0
  let malformed = 0
  for (let run = 0; run < RUNS; run += 1) {
    const result = await call(model, endpoint.tag, run)
    if ('error' in result) { errors.push(result.error); continue }
    times.push(result.ms)
    cost += result.cost
    if (!result.json) malformed += 1
  }
  times.sort((a, b) => a - b)
  return {
    model, provider: endpoint.provider_name, tag: endpoint.tag, runs: RUNS, ok: times.length, malformed,
    medianMs: times.length ? times[Math.floor(times.length / 2)] : null,
    maxMs: times.length ? times[times.length - 1] : null,
    costUSD: times.length ? cost / times.length : null,
    listIn: Number(endpoint.pricing.prompt) * 1e6, listOut: Number(endpoint.pricing.completion) * 1e6,
    errors: [...new Set(errors)],
  }
}

/** Fast first, cheap second: one second of waiting weighs like the cheapest provider's whole price. */
function rank(rows: Row[]): Row[] {
  const usable = rows.filter((row) => row.ok === row.runs && row.malformed === 0 && row.medianMs !== null && row.costUSD !== null)
  const cheapest = Math.min(...usable.map((row) => row.costUSD as number))
  const score = (row: Row) => (row.medianMs as number) / 1000 + (row.maxMs as number) / 4000 + (row.costUSD as number) / cheapest
  return [...usable].sort((a, b) => score(a) - score(b))
}

async function main() {
  if (!KEY) throw new Error('OPENROUTER_API_KEY is not set')
  const models = (arg('models')?.split(',') ?? [...new Set(AGENT_MODELS.map((item) => item.providerId))]).filter(Boolean)
  const all: Row[] = []
  for (const model of models) {
    const listing = await fetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`).then((res) => res.json()) as { data?: { endpoints?: Endpoint[] } }
    const endpoints = listing.data?.endpoints ?? []
    const rows: Row[] = []
    for (let index = 0; index < endpoints.length; index += 4) {
      rows.push(...await Promise.all(endpoints.slice(index, index + 4).map((endpoint) => benchmark(model, endpoint))))
    }
    all.push(...rows)
    const ranked = rank(rows)
    console.log(`\n## ${model} — ${endpoints.length} endpoints, ${RUNS} runs each`)
    for (const row of [...ranked, ...rows.filter((row) => !ranked.includes(row))]) {
      const place = ranked.indexOf(row)
      console.log([
        place >= 0 ? `#${place + 1}`.padEnd(4) : 'x   ',
        row.tag.padEnd(24),
        `ok ${row.ok}/${row.runs}`,
        row.malformed ? `malformed ${row.malformed}` : '',
        row.medianMs !== null ? `median ${row.medianMs}ms max ${row.maxMs}ms` : '',
        row.costUSD !== null ? `$${row.costUSD.toFixed(6)}/call` : '',
        `list $${row.listIn.toFixed(3)}/$${row.listOut.toFixed(3)} per M`,
        row.errors.length ? `errors: ${row.errors.join('; ')}` : '',
      ].filter(Boolean).join(' | '))
    }
    console.log(`order: ${JSON.stringify(ranked.slice(0, 5).map((row) => row.tag))}`)
  }
  const out = arg('out')
  if (out) fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), runs: RUNS, rows: all }, null, 2))
}

main().then(() => process.exit(0))
