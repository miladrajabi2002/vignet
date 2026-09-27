/**
 * Re-score saved live-eval runs with ONE check set and ONE judge, so a
 * before/after comparison is apples-to-apples even when checks were added
 * after the "before" run. DB-backed checks (stored facts, handoff state)
 * are taken from the run itself; text checks are recomputed here.
 *
 *   npx tsx -r dotenv/config tests-live/rescore.ts before after
 */
import fs from 'node:fs'
import path from 'node:path'
import { judgeTranscript, type JudgeVerdict } from './judge'

type Turn = { user: string; reply: string; ms: number; error?: string }
type Scenario = { id: string; group: string; title: string; turns: Turn[]; checks: Record<string, boolean>; notes: string[]; judge?: JudgeVerdict | null }

const norm = (value: string) => value.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[‌]/g, ' ').replace(/\s+/g, ' ').trim()
const digits = (value: string) => norm(value).replace(/[,،٬]/g, '')
const prose = (reply: string) => reply.replace(/\[\[product:[^\n]*?\]\]/g, '').trim()
const cardCount = (reply: string) => (reply.match(/\[\[product:/g) ?? []).length
const FALSE_NOT_FOUND = /پیدا نکردم|پیدا نشد|در کاتالوگ (?:فعلی )?(?:نیست|ثبت نشده)|ثبت نشده/u

/** Text checks added after the first run; recomputed for every run. */
function textChecks(s: Scenario): Record<string, boolean> {
  const r = (i: number) => s.turns[i]?.reply ?? ''
  const out: Record<string, boolean> = {}
  if (s.id === 'A3') out['t2.staysOnApadana'] = !/لاهیجان|ترکمن|کاشانه|شهداد|ایوان|شاهسون|هنگام|پامنار|هیرمند|سلین/u.test(r(1))
  if (s.id === 'A6') out.noFakeTransfer = !/منتقل (?:می ?کنم|کردم)|اطلاع (?:می ?دم|می ?دهم)|will (?:let you know|get back)|I(?:'ve| have) (?:forwarded|transferred)/iu.test(r(0))
  if (s.id === 'A10') {
    out['t1.exactPrice190'] = digits(r(0)).includes('39970000')
    out['t1.noFalseNotFound'] = !FALSE_NOT_FOUND.test(prose(r(0)))
  }
  if (s.id === 'B1') {
    out.noFalseNotFound = !FALSE_NOT_FOUND.test(prose(r(0)))
    out.mentionsMoroccanPouf = /پاف(?:‌| )?(?:های )?مراکشی/u.test(r(0))
    out.honestStock = /ناموجود/u.test(prose(r(0)))
  }
  if (s.id === 'B4') {
    out.noFalseNotFound = !FALSE_NOT_FOUND.test(prose(r(0)))
    out.mentionsAK85 = /AK-?85/iu.test(r(0))
  }
  if (s.id === 'C3') out['t1.noFalseNotFound'] = !FALSE_NOT_FOUND.test(prose(r(0)))
  if (s.id === 'C5') out['t1.noFalseNotFound'] = !FALSE_NOT_FOUND.test(prose(r(0)))
  if (s.id === 'C4') {
    out['t2.noRepeatedCard'] = cardCount(r(1)) === 0 && prose(r(1)).length <= 80
    out.noAccessDenial = !/دسترسی ندارم|به سابقه|یادم نیست|نمی ?دونم کدوم/u.test(r(2))
  }
  return out
}

/** Checks removed from the harness (they assumed sold-out items get cards). */
const RETIRED = new Set(['B1.atLeastTwoCards', 'B1.allCardsMoroccanPouf', 'B1.cardsHaveIds'])

async function rescore(label: string) {
  const file = path.join(process.cwd(), 'tests-live', 'results', `${label}.json`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { results: Scenario[]; summary: Record<string, unknown>; usageByReply: Array<{ promptTokens: number; completionTokens: number; cachedTokens: number }> }
  for (const s of data.results) {
    s.checks = Object.fromEntries(Object.entries({ ...s.checks, ...textChecks(s) }).filter(([name]) => !RETIRED.has(`${s.id}.${name}`)))
    s.judge = await judgeTranscript(s.title, s.turns)
  }
  const checks = data.results.flatMap((s) => Object.entries(s.checks).map(([name, passed]) => ({ id: `${s.id}.${name}`, passed })))
  const judged = data.results.filter((s) => s.judge)
  const avg = (key: 'naturalness' | 'helpfulness' | 'grounding' | 'memory') =>
    +(judged.reduce((sum, s) => sum + Number(s.judge![key] || 0), 0) / Math.max(1, judged.length)).toFixed(2)
  const turns = data.results.flatMap((s) => s.turns)
  const usage = data.usageByReply ?? []
  const summary = {
    label,
    scenariosFullyPassed: `${data.results.filter((s) => Object.values(s.checks).every(Boolean)).length}/${data.results.length}`,
    checks: `${checks.filter((c) => c.passed).length}/${checks.length}`,
    failed: checks.filter((c) => !c.passed).map((c) => c.id),
    judge: { judged: judged.length, naturalness: avg('naturalness'), helpfulness: avg('helpfulness'), grounding: avg('grounding'), memory: avg('memory') },
    avgLatencyMs: Math.round(turns.reduce((sum, t) => sum + t.ms, 0) / Math.max(1, turns.length)),
    llmReplies: usage.length,
    avgPromptTokens: Math.round(usage.reduce((sum, u) => sum + u.promptTokens, 0) / Math.max(1, usage.length)),
    avgCachedTokens: Math.round(usage.reduce((sum, u) => sum + u.cachedTokens, 0) / Math.max(1, usage.length)),
    avgCompletionTokens: Math.round(usage.reduce((sum, u) => sum + u.completionTokens, 0) / Math.max(1, usage.length)),
  }
  fs.writeFileSync(path.join(process.cwd(), 'tests-live', 'results', `${label}.rescored.json`), JSON.stringify({ summary, results: data.results }, null, 2))
  return summary
}

async function main() {
  const labels = process.argv.slice(2)
  for (const label of labels) console.log(JSON.stringify(await rescore(label), null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
