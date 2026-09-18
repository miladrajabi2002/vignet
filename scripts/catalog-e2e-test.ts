/**
 * E2E real-chat test through generateReply (full pipeline incl. LLM + grounding)
 * against جواهری's production agent and catalog. Marks each turn PASS/FAIL.
 *
 * Usage: cd /var/www/vigent.ir/public/vignet && npx tsx -r dotenv/config scripts/catalog-e2e-test.ts
 */
import { PrismaClient } from '@prisma/client'
import { generateReply } from '@/lib/ai/chat-engine'
import type { ChatAgent } from '@/lib/ai/chat-types'

const prisma = new PrismaClient()
const WORKSPACE_ID = 'cmtptw34m000jeok40nhf5fnj' // جواهری (آکام چوب)

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

type Expectation = {
  turn: string
  /** Substrings expected in the reply (case-insensitive, any-match semantics per group). */
  anyOf?: string[][]
  mustNot?: string[]
  name: string
}

const SCRIPT: Expectation[] = [
  {
    name: 'TV-stand 160 request',
    turn: 'سلام، میز تلویزیون ۱۶۰ می‌خوام.',
    anyOf: [[ 'میز تلویزیون' ]],
    mustNot: ['پیدا نکردم', 'پیدا نشد'],
  },
  {
    name: 'walnut color request',
    turn: 'رنگ گردویی می‌خوام.',
    anyOf: [[ 'گردویی' ]],
    mustNot: ['پیدا نکردم', 'پیدا نشد'],
  },
  {
    name: 'available sizes question',
    turn: 'میز تلویزیون چه سایزهایی دارید؟',
    anyOf: [[ '140' ], [ '۱۴۰' ], [ '160' ], [ '۱۶۰' ], [ 'سایز' ]],
    mustNot: ['پیدا نکردم', 'پیدا نشد'],
  },
  {
    name: 'cushion-pouf gift request (context-word noise)',
    turn: 'پاف بالشتی برای هدیه می‌خوام',
    anyOf: [[ 'پاف' ]],
    mustNot: ['پیدا نکردم', 'پیدا نشد'],
  },
  {
    name: 'new-arrival phrasing without shopping verb (intent gap fix)',
    turn: 'پاف مراکشی جدید اومده؟',
    anyOf: [[ 'پاف' ]],
    mustNot: ['پیدا نکردم', 'پیدا نشد'],
  },
]

async function main() {
  const agent = (await prisma.agent.findFirst({
    where: { workspaceId: WORKSPACE_ID, productAccessEnabled: true },
    select: AGENT_SELECT,
  })) as ChatAgent | null
  if (!agent) throw new Error('agent not found')

  let conversationId: string | undefined
  let passed = 0
  let failed = 0
  for (const step of SCRIPT) {
    const started = Date.now()
    const result = await generateReply({
      workspaceId: WORKSPACE_ID,
      agent,
      message: step.turn,
      conversationId,
      channel: 'API',
    })
    if ('error' in result) {
      console.log(`✗ [${step.name}] ENGINE ERROR: ${JSON.stringify(result)}`)
      failed++
      continue
    }
    conversationId = result.conversationId
    const reply = result.reply ?? ''
    const hit = (needle: string) => reply.includes(needle)
    const anyOk = !step.anyOf || step.anyOf.some((group) => group.some(hit))
    const clean = !step.mustNot || !step.mustNot.some(hit)
    const ok = anyOk && clean
    if (ok) passed++
    else failed++
    const latency = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`${ok ? '✓' : '✗'} [${step.name}] (${latency}s)`)
    console.log(`   turn: «${step.turn}»`)
    console.log(`   reply: ${reply.replace(/\n+/g, ' ⏎ ').slice(0, 400)}`)
    if (!ok) console.log(`   checks: anyOk=${anyOk} clean=${clean}`)
    console.log('')
  }
  console.log(`SUMMARY: ${passed} passed / ${failed} failed`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error('E2E FAILED:', e); process.exit(1) })
