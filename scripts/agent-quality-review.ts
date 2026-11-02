/**
 * D2 — judge the real conversations the AI answered, on demand only (never
 * scheduled). Shows how many conversations and the estimated cost first,
 * asks, then grades each one with the same rubric used on 2026-10-23
 * (HANDOFF_MISSED, FALSE_PROMISE, PRODUCT_WRONG, …) and stops at the cap.
 *
 *   npx tsx -r dotenv/config scripts/agent-quality-review.ts --hours 24
 *   … --agent <agentId> --hours 72 --max-usd 0.3 --limit 100 --yes
 *
 * Writes evals/quality-reviews/<date>-<hours>h.json and a .md summary.
 * HANDOFF_MISSED / FALSE_PROMISE are checked against real alerts in the
 * database; HALLUCINATION is the judge's reading without the store's
 * knowledge, so verify it before acting on it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { arg, confirmCost } from './lib/cost-confirm'

const hours = Math.max(1, Number(arg('hours') ?? 24))
const agentId = arg('agent')
const maxUSD = Number(arg('max-usd') ?? 0.5)
const limit = Math.max(1, Number(arg('limit') ?? 400))
const model = process.env.REVIEW_MODEL ?? 'deepseek/deepseek-v4.1-flash-1017'
/** Conservative list price of the model (USD per token) for the estimate. */
const IN_USD = 0.15 / 1e6
const OUT_USD = 0.6 / 1e6
const OUT_TOKENS_PER_REVIEW = 900

const SYSTEM = `You are a strict QA reviewer for an AI customer-service/sales agent used by Iranian small businesses. The owner wants it to feel like their best human salesperson: precise, short, warm, never wasting the customer's time.
Sources: U=customer, AI=the AI agent, SCN=owner's fixed automation reply (not the AI's fault), OP=human operator, HO=system handoff notice (a REAL transfer happened), S=system event. The header says whether a real transfer or owner alert exists (handedOff, alerts).
Judge ONLY the AI messages. Codes: HANDOFF_MISSED, FALSE_PROMISE, PRODUCT_WRONG, PRODUCT_NAME_BAD, PRODUCT_MISSED, IGNORED_QUESTION, REPETITION, HALLUCINATION, VERBOSE_BORING, PUSHY_CONTACT, BAD_LANGUAGE, CONTEXT_LOST, COLD_TONE. Severity 1 polish, 2 hurts, 3 lost customer.
Return STRICT JSON: {"score":1-10,"outcome":"purchase_intent|booking|lead_captured|handoff|info_only|frustrated_left|spam_or_test|unknown","issues":[{"code":"…","sev":1-3,"quote":"<=120 chars","why":"<=160 chars Persian","ideal":"<=200 chars ideal reply in Persian"}],"best":"<=120 chars Persian","rootCause":"<=200 chars English"}
Do not invent defects. You cannot see the store's knowledge: flag HALLUCINATION only for a claim that is clearly invented.`

type Conv = {
  id: string; ws: string; agent: string; channel: string; handedOff: boolean; alerts: number
  msgs: Array<{ s: string; t: string; c: string }>
}

async function exportConversations(prisma: PrismaClient): Promise<Conv[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ j: Conv }>>(`
    select json_build_object(
      'id', c.id, 'ws', w.name, 'agent', a.name, 'channel', c.channel, 'handedOff', c."handedOff",
      'alerts', (select count(*) from "HandoffAlert" h where h."conversationId" = c.id),
      'msgs', (select json_agg(json_build_object(
        's', case when m.role <> 'ASSISTANT' then left(m.role::text, 1)
                  when m.metadata ? 'operator' then 'OP'
                  when m.metadata->'vigentoOutbound' ? 'scenario' then 'SCN'
                  when m.metadata ? 'handoffNotice' then 'HO' else 'AI' end,
        't', to_char(m."createdAt", 'MM-DD HH24:MI'),
        'c', left(regexp_replace(m.content, '\\[\\[product:\\{[^\\n]*?"name":"([^"]*)"[^\\n]*?\\}\\]\\]', '[CARD: \\1]', 'g'), 900)
      ) order by m."createdAt") from (select * from "Message" mm where mm."conversationId" = c.id order by mm."createdAt" desc limit 40) m)
    ) as j
    from "Conversation" c join "Workspace" w on w.id = c."workspaceId" join "Agent" a on a.id = c."agentId"
    where c."lastMessageAt" >= now() - ($1::int * interval '1 hour') and not c."isPlayground" and c."deletedAt" is null
      ${agentId ? 'and c."agentId" = $3' : ''}
      and exists (select 1 from "Message" m where m."conversationId" = c.id and m.role = 'ASSISTANT' and m.metadata ? 'turnCost')
    order by c."lastMessageAt" desc
    limit $2`, hours, limit, ...(agentId ? [agentId] : []))
  return rows.map((row) => row.j)
}

function transcript(conv: Conv): string {
  const lines = conv.msgs.map((m) => `${m.s} ${m.t}: ${String(m.c ?? '').replace(/\s+/g, ' ').slice(0, m.s === 'SCN' ? 160 : 900)}`)
  return `business="${conv.ws}" agent="${conv.agent}" channel=${conv.channel} handedOff=${conv.handedOff} alerts=${conv.alerts}\n\n${lines.join('\n')}`
}

async function judge(conv: Conv): Promise<{ verdict: Record<string, unknown> | null; usd: number }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'vigent-quality-review' },
        body: JSON.stringify({
          model, temperature: 0.1, max_tokens: 3000,
          reasoning: { effort: 'low', exclude: true },
          response_format: { type: 'json_object' }, usage: { include: true },
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: transcript(conv) }],
        }),
      })
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { cost?: number } }
      const usd = body.usage?.cost ?? 0
      const text = body.choices?.[0]?.message?.content ?? ''
      return { verdict: JSON.parse(text.replace(/^```json\s*|```$/g, '')) as Record<string, unknown>, usd }
    } catch { /* one retry */ }
  }
  return { verdict: null, usd: 0 }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const convs = await exportConversations(prisma)
    if (!convs.length) { console.log(`no AI-answered conversations in the last ${hours} h`); return }
    const inputTokens = convs.reduce((sum, conv) => sum + Math.ceil(transcript(conv).length / 3) + 700, 0)
    const estimate = inputTokens * IN_USD + convs.length * OUT_TOKENS_PER_REVIEW * OUT_USD
    const ok = await confirmCost([
      `quality review: ${convs.length} AI-answered conversations from the last ${hours} h${agentId ? ` (agent ${agentId})` : ''}`,
      `model ${model}, ≈ ${Math.round(inputTokens / 1000)}k input tokens`,
    ], estimate, maxUSD)
    if (!ok) { console.log('cancelled'); return }

    let spent = 0
    let index = 0
    const rows: Array<Record<string, unknown>> = []
    const worker = async () => {
      while (index < convs.length && spent < maxUSD) {
        const conv = convs[index++]
        const { verdict, usd } = await judge(conv)
        spent += usd
        rows.push({ id: conv.id, ws: conv.ws, agent: conv.agent, alerts: conv.alerts, handedOff: conv.handedOff, ...(verdict ?? { failed: true }) })
        if (rows.length % 20 === 0) console.log(`${rows.length}/${convs.length} · $${spent.toFixed(3)}`)
      }
    }
    await Promise.all(Array.from({ length: 5 }, worker))
    if (spent >= maxUSD) console.log(`stopped at the $${maxUSD} cap after ${rows.length} conversations`)

    const judged = rows.filter((row) => !row.failed && row.outcome !== 'spam_or_test')
    const codes = new Map<string, { convs: number; severe: number }>()
    for (const row of judged) {
      const seen = new Set<string>()
      for (const issue of (row.issues as Array<{ code: string; sev: number }> | undefined) ?? []) {
        const entry = codes.get(issue.code) ?? { convs: 0, severe: 0 }
        if (!seen.has(issue.code)) entry.convs += 1
        if (issue.sev >= 3) entry.severe += 1
        seen.add(issue.code)
        codes.set(issue.code, entry)
      }
    }
    const avg = judged.reduce((sum, row) => sum + Number(row.score ?? 0), 0) / Math.max(1, judged.length)
    const stamp = new Date().toISOString().slice(0, 10)
    const dir = path.join(process.cwd(), 'evals', 'quality-reviews')
    fs.mkdirSync(dir, { recursive: true })
    const base = path.join(dir, `${stamp}-${hours}h${agentId ? `-${agentId}` : ''}`)
    fs.writeFileSync(`${base}.json`, JSON.stringify({ hours, model, spentUSD: spent, avg, rows }, null, 1))
    const md = [
      `# بازبینی کیفیت گفتگوها — ${stamp} (${hours} ساعت)`,
      '',
      `${judged.length} گفتگو · میانگین نمره ${avg.toFixed(1)} از ۱۰ · هزینه $${spent.toFixed(3)}`,
      '',
      '| کد | گفتگوها | شدید |',
      '| --- | --- | --- |',
      ...[...codes].sort((a, b) => b[1].convs - a[1].convs).map(([code, entry]) => `| ${code} | ${entry.convs} (${Math.round((100 * entry.convs) / Math.max(1, judged.length))}٪) | ${entry.severe} |`),
      '',
      'HANDOFF_MISSED و FALSE_PROMISE با هشدارهای واقعی دیتابیس سنجیده شده‌اند. HALLUCINATION بدون دیدن دانش فروشگاه است؛ قبل از اقدام چک کنید.',
    ].join('\n')
    fs.writeFileSync(`${base}.md`, md)
    console.log(`\n${md}\n\nwritten: ${base}.json / .md`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
