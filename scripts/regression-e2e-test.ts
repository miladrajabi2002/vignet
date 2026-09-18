/**
 * Full regression + bug-fix battery (default model, real LLM, fresh conversation per scenario)
 *
 * Groups:
 *   BUG-FIX       — the two original جواهری bugs (must now succeed)
 *   REGRESSION    — cases that already worked before the deploy (must stay identical in kind)
 *   NEW-CAPABILITY— data-driven intent/semantic-probe behaviours
 *   MULTI-TURN    — context retention across turns
 *
 * Usage: cd /var/www/vigent.ir/public/vignet && npx tsx -r dotenv/config scripts/regression-e2e-test.ts
 */
import { PrismaClient } from '@prisma/client'
import { generateReply } from '@/lib/ai/chat-engine'
import type { ChatAgent } from '@/lib/ai/chat-types'

const prisma = new PrismaClient()
const WORKSPACE_ID = 'cmtptw34m000jeok40nhf5fnj' // جواهری (آکام چوب)
const AGENT_ID = 'cmtpul0dx000zeok453jjkavr' // آناهیتا — model: fast (deepseek-v4-flash)

const AGENT_SELECT = {
  id: true,
  systemPrompt: true,
  language: true,
  model: true,
  temperature: true,
  maxTokens: true,
  fallbackMessage: true,
  handoffEnabled: true,
  handoffMessage: true,
  handoffKeywords: true,
  promptConfig: true,
  roleTemplate: true,
  requireCustomerInfo: true,
  customerInfoPrompt: true,
  productAccessEnabled: true,
  orderTrackingEnabled: true,
} as const

type Turn = { turn: string; anyOf?: string[][]; mustNot?: string[] }
type Scenario = { name: string; group: string; turns: Turn[] }

const SCENARIOS: Scenario[] = [
  // ── BUG-FIX: the two reported failures ─────────────────────────
  {
    group: 'BUG-FIX',
    name: 'original bug #1 — TV stand 160',
    turns: [{ turn: 'سلام، میز تلویزیون ۱۶۰ می‌خوام.', anyOf: [['میز تلویزیون', '۱۶۰', '160']], mustNot: ['پیدا نکردم', 'پیدا نشد'] }],
  },
  {
    group: 'BUG-FIX',
    name: 'original bug #2 — walnut color',
    turns: [{ turn: 'رنگ گردویی می‌خوام.', anyOf: [['گردویی'], ['چه محصولی', 'کدوم محصول', 'مد نظرتون']], mustNot: ['پیدا نکردم', 'پیدا نشد'] }],
  },
  {
    group: 'BUG-FIX',
    name: 'pre-deploy live failure — conversational verb «اومدید»',
    turns: [{ turn: 'میز عسلی اومدید؟', anyOf: [['میز عسلی']], mustNot: ['پیدا نکردم', 'پیدا نشد'] }],
  },
  // ── REGRESSION: previously-correct answers must stay correct ────
  {
    group: 'REGRESSION',
    name: 'exact catalog product (fullTermMatch path)',
    turns: [{ turn: 'میز عسلی طرح ترکمن رو دارید؟', anyOf: [['ترکمن']], mustNot: ['پیدا نکردم', 'پیدا نشد'] }],
  },
  {
    group: 'REGRESSION',
    name: 'KB question — shipping cost (must stay knowledge answer)',
    turns: [{ turn: 'هزینه ارسال چقدره و چند روز طول می‌کشه؟', anyOf: [['ارسال', 'حمل', 'پست', 'تیپاکس']], mustNot: ['پیدا نکردم', 'پیدا نشد'] }],
  },
  {
    group: 'REGRESSION',
    name: 'KB question — installment purchase',
    turns: [{ turn: 'خرید قسطی دارید؟', anyOf: [['قسط', 'اقساط', 'بیعانه', 'پیش']] }],
  },
  {
    group: 'REGRESSION',
    name: 'small talk — greeting',
    turns: [{ turn: 'سلام', anyOf: [['سلام', 'خوش آمد', 'چطور می', 'چه کمکی']], mustNot: ['پیدا نکردم', 'پیدا نشد'] }],
  },
  {
    group: 'REGRESSION',
    name: 'anti-hallucination — item NOT in catalog',
    turns: [{ turn: 'شلوار پلنگی دارید؟', anyOf: [['پیدا نکردم', 'پیدا نشد', 'نداریم', 'موجود نیست', 'خارج از', 'جزو محصولات', 'نیست']], mustNot: [] }],
  },
  // ── NEW-CAPABILITY ──────────────────────────────────────────────
  {
    group: 'NEW-CAPABILITY',
    name: 'product intent WITHOUT shopping verb (lexicon)',
    turns: [{ turn: 'پاف مراکشی جدید اومده؟', anyOf: [['پاف']], mustNot: ['پیدا نکردم', 'پیدا نشد'] }],
  },
  {
    group: 'NEW-CAPABILITY',
    name: 'sizes question (KB specs)',
    turns: [{ turn: 'میز تلویزیون چه سایزهایی دارید؟', anyOf: [['۱۴۰', '140', '۱۶۰', '160', 'سایز']], mustNot: ['پیدا نکردم', 'پدا نشد'] }],
  },
  {
    group: 'NEW-CAPABILITY',
    name: 'context-word noise — «پاف بالشتی» (compound alias)',
    turns: [{ turn: 'پاف بالشتی برای هدیه می‌خوام', anyOf: [['پاف']], mustNot: ['پیدا نکردم', 'پیدا نشد'] }],
  },
  {
    group: 'RESCUE-ANALYZER',
    name: 'out-of-domain item → honest fail-closed (no invention)',
    turns: [{ turn: 'قابلمه ضدخش دارین؟', anyOf: [['پیدا نکردم', 'نداریم', 'موجود نیست', 'جزو محصولات', 'تولید']], mustNot: [] }],
  },
  {
    group: 'RESCUE-ANALYZER',
    name: 'typo variant «پوف» → still finds پاف',
    turns: [{ turn: 'پوف مراکشی چقدره؟', anyOf: [['پاف']], mustNot: [] }],
  },
  // ── MULTI-TURN: context retention ───────────────────────────────
  {
    group: 'MULTI-TURN',
    name: 'follow-up with pronoun context',
    turns: [
      { turn: 'میز تلویزیون ۱۶۰ می‌خوام.', anyOf: [['میز تلویزیون', '۱۶۰', '160']], mustNot: ['پیدا نکردم', 'پیدا نشد'] },
      { turn: 'رنگ گردویی‌شو می‌خوام، قیمتش چنده؟', anyOf: [['گردویی']], mustNot: ['پیدا نکردم', 'پیدا نشد'] },
      { turn: 'همون طرح ترکمنشو هم نشونم بده', anyOf: [['ترکمن']], mustNot: ['پیدا نکردم', 'پیدا نشد'] },
    ],
  },
]

async function main() {
  const agent = (await prisma.agent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: AGENT_SELECT,
  })) as ChatAgent | null
  if (!agent) throw new Error('agent آناهیتا not found')
  console.log(`AGENT model alias = ${agent.model} (default) → resolved by engine\n`)

  let passed = 0
  let failed = 0
  const convIds: string[] = []

  for (const sc of SCENARIOS) {
    let conversationId: string | undefined
    let scOk = true
    console.log(`■ [${sc.group}] ${sc.name}`)
    for (const step of sc.turns) {
      const started = Date.now()
      let reply = ''
      try {
        const result = await generateReply({
          workspaceId: WORKSPACE_ID,
          agent,
          message: step.turn,
          conversationId,
          channel: 'API',
        })
        if ('error' in result) {
          console.log(`   ✗ ENGINE ERROR: ${JSON.stringify(result)}`)
          scOk = false
          continue
        }
        conversationId = result.conversationId
        convIds.push(result.conversationId)
        reply = result.reply ?? ''
      } catch (e) {
        console.log(`   ✗ EXCEPTION: ${(e as Error).message}`)
        scOk = false
        continue
      }
      const latency = ((Date.now() - started) / 1000).toFixed(1)
      const hit = (needle: string) => reply.includes(needle)
      const anyOk = !step.anyOf || step.anyOf.some((group) => group.some(hit))
      const clean = !step.mustNot || !step.mustNot.some(hit)
      const ok = anyOk && clean
      if (!ok) scOk = false
      console.log(`   ${ok ? '✓' : '✗'} (${latency}s) «${step.turn}»`)
      console.log(`      → ${reply.replace(/\n+/g, ' ⏎ ').slice(0, 360)}`)
      if (!ok) console.log(`      checks: anyOk=${anyOk} clean=${clean}`)
    }
    if (scOk) passed++
    else failed++
    console.log('')
  }

  // token usage per reply of this run
  const logs = await prisma.usageLog.findMany({
    where: { conversationId: { in: convIds }, date: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
    orderBy: { date: 'asc' },
    select: { promptTokens: true, completionTokens: true, cost: true, chargedIRR: true, model: true },
  })
  const totPrompt = logs.reduce((s, r) => s + r.promptTokens, 0)
  const totCompl = logs.reduce((s, r) => s + r.completionTokens, 0)
  const totCost = logs.reduce((s, r) => s + (r.cost ?? 0), 0)
  const totIRR = logs.reduce((s, r) => s + (r.chargedIRR ?? 0), 0)
  const llmRows = logs.filter((r) => r.promptTokens > 0)

  console.log('──────── TOKEN / COST OF THIS RUN ────────')
  console.log(`LLM replies: ${llmRows.length} (deterministic/zero-token replies: ${logs.length - llmRows.length})`)
  console.log(
    `avg prompt=${Math.round(totPrompt / Math.max(1, llmRows.length))} tok | avg completion=${Math.round(totCompl / Math.max(1, llmRows.length))} tok`
  )
  console.log(`provider cost: $${totCost.toFixed(4)} | tenant charged: ${totIRR.toLocaleString()} IRR`)

  const analyzerCalls = await prisma.usageLog.count({
    where: { conversationId: { in: convIds }, type: 'SUMMARY', date: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
  })
  console.log(`turn-analyzer calls during this run: ${analyzerCalls}`)
  console.log(`\nSUMMARY: ${passed} scenarios passed / ${failed} failed (of ${SCENARIOS.length})`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('E2E FAILED:', e)
  process.exit(1)
})
