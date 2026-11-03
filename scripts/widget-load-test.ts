/**
 * How many incoming messages per second, and how many AI replies per second,
 * the live stack handles: the web-widget chat endpoint, the real agent and the
 * real model. Run by hand only — every reply is a real (paid) model call
 * charged to the agent's workspace.
 *
 *   npx tsx -r dotenv/config scripts/widget-load-test.ts --agent <agentId> --origin https://shop.example
 *   … --levels 1,5,10,20   concurrent visitors per step (default 1,5,10,20)
 *   … --per-level 20       messages sent at each step (default 20)
 *   … --base http://127.0.0.1:3003   (default: the app directly, skipping nginx)
 *   … --yes                skip the cost question
 *
 * Use an internal test agent: messages land as real conversations in its
 * inbox and count toward its WIDGET_DAILY_MESSAGE_CAP (1000/day). Each
 * virtual visitor gets its own X-Vigent-Client-IP, so the 20/min per-visitor
 * limit applies per visitor as it does for real traffic. A step that fails
 * more than 20% of its messages stops the run, so a struggling site is not
 * pushed further.
 *
 * Reports per step: incoming/s (messages the server accepted and started
 * answering), replies/s (complete answers), first-token and full-reply
 * latency (p50/p95) and errors by kind.
 */
import { arg, confirmCost } from './lib/cost-confirm'

const agentId = arg('agent')
const origin = arg('origin')
const base = (arg('base') ?? 'http://127.0.0.1:3003').replace(/\/$/, '')
const levels = (arg('levels') ?? '1,5,10,20').split(',').map(Number).filter((n) => n > 0)
const perLevel = Math.max(1, Number(arg('per-level') ?? 20))
const USD_PER_REPLY = 0.0008
const MAX_ERROR_RATE = 0.2

const QUESTIONS = [
  'سلام، ساعت کاری‌تون چنده؟',
  'این محصول موجوده؟',
  'هزینه ارسال به شیراز چقدره؟',
  'چطور می‌تونم سفارشم رو پیگیری کنم؟',
  'تخفیف دارید؟',
  'Hi, do you ship abroad?',
]

type Outcome = { ok: boolean; error?: string; acceptedMs?: number; firstTokenMs?: number; doneMs?: number }

async function sendOne(visitor: number, n: number): Promise<Outcome> {
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  let res: Response
  try {
    res = await fetch(`${base}/api/widget/${agentId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? { Origin: origin } : {}),
        // One synthetic visitor each; 198.18.0.0/15 is reserved for benchmarking.
        'X-Vigent-Client-IP': `198.18.${Math.floor(visitor / 250)}.${(visitor % 250) + 1}`,
        'User-Agent': `vigent-load-test/1 visitor-${visitor}`,
      },
      body: JSON.stringify({ message: QUESTIONS[n % QUESTIONS.length], conversationId: null }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network' }
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: `${res.status} ${body?.error ?? ''}`.trim() }
  }
  const acceptedMs = elapsed()
  let firstTokenMs: number | undefined
  let buffer = ''
  const decoder = new TextDecoder()
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        let evt: { type?: string; error?: string }
        try {
          evt = JSON.parse(line.slice(5).trim())
        } catch {
          continue
        }
        if ((evt.type === 'delta' || evt.type === 'replace') && firstTokenMs === undefined) firstTokenMs = elapsed()
        if (evt.type === 'error') return { ok: false, error: `stream ${evt.error ?? 'error'}`, acceptedMs, firstTokenMs }
        if (evt.type === 'done') return { ok: true, acceptedMs, firstTokenMs: firstTokenMs ?? elapsed(), doneMs: elapsed() }
      }
    }
  } catch {
    return { ok: false, error: 'stream cut', acceptedMs, firstTokenMs }
  }
  return { ok: false, error: 'no done event', acceptedMs, firstTokenMs }
}

function pct(values: number[], p: number): string {
  if (!values.length) return '-'
  const sorted = [...values].sort((a, b) => a - b)
  return `${(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] / 1000).toFixed(2)}s`
}

async function runLevel(concurrency: number, offset: number) {
  let next = 0
  const outcomes: Outcome[] = []
  const acceptedAt: number[] = []
  const doneAt: number[] = []
  const started = performance.now()
  await Promise.all(
    Array.from({ length: concurrency }, async (_, worker) => {
      while (next < perLevel) {
        const n = next++
        const outcome = await sendOne(offset + worker, n)
        outcomes.push(outcome)
        if (outcome.acceptedMs !== undefined) acceptedAt.push(performance.now())
        if (outcome.ok) doneAt.push(performance.now())
      }
    }),
  )
  const wallS = (performance.now() - started) / 1000
  const ok = outcomes.filter((o) => o.ok)
  const errors = new Map<string, number>()
  for (const o of outcomes) if (!o.ok) errors.set(o.error!, (errors.get(o.error!) ?? 0) + 1)
  return {
    concurrency,
    sent: outcomes.length,
    ok: ok.length,
    incomingPerS: acceptedAt.length / wallS,
    repliesPerS: ok.length / wallS,
    firstToken: [pct(ok.map((o) => o.firstTokenMs!), 50), pct(ok.map((o) => o.firstTokenMs!), 95)],
    reply: [pct(ok.map((o) => o.doneMs!), 50), pct(ok.map((o) => o.doneMs!), 95)],
    errors: [...errors].map(([kind, count]) => `${kind}×${count}`).join(', ') || '-',
    errorRate: 1 - ok.length / outcomes.length,
  }
}

async function main() {
  if (!agentId) {
    console.error('--agent <agentId> is required (use an internal test agent)')
    process.exit(1)
  }
  const total = levels.length * perLevel
  const go = await confirmCost(
    [
      `Load test → ${base}/api/widget/${agentId}/chat`,
      `steps: ${levels.join(', ')} concurrent visitors, ${perLevel} messages each (${total} real replies)`,
      'messages appear as real conversations in this agent\'s inbox',
    ],
    total * USD_PER_REPLY,
  )
  if (!go) return

  const rows = []
  let offset = 0
  for (const concurrency of levels) {
    process.stdout.write(`  ${concurrency} concurrent… `)
    const row = await runLevel(concurrency, offset)
    offset += concurrency
    rows.push(row)
    console.log(`${row.ok}/${row.sent} ok, ${row.repliesPerS.toFixed(2)} replies/s`)
    if (row.errorRate > MAX_ERROR_RATE) {
      console.log(`  stopping: ${(row.errorRate * 100).toFixed(0)}% failed at ${concurrency} concurrent (${row.errors})`)
      break
    }
  }
  console.log('')
  console.table(rows.map((r) => ({
    concurrent: r.concurrency,
    'ok/sent': `${r.ok}/${r.sent}`,
    'incoming/s': r.incomingPerS.toFixed(2),
    'replies/s': r.repliesPerS.toFixed(2),
    'first token p50/p95': r.firstToken.join(' / '),
    'full reply p50/p95': r.reply.join(' / '),
    errors: r.errors,
  })))
}

void main()
