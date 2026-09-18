/**
 * Direct analyzer validation with the REAL fast model (default tier).
 * Verifies prompt, JSON parsing, keyword/attribute extraction, handoff
 * verdict and usage logging end-to-end, bypassing the gate.
 *
 * Usage: npx tsx -r dotenv/config scripts/analyze-turn-live.ts
 */
import { PrismaClient } from '@prisma/client'
import { analyzeTurn, analyzerSearchTerms } from '@/lib/ai/turn-analyzer'
import { getAgentCatalogLexicon } from '@/lib/ai/catalog-lexicon'

const prisma = new PrismaClient()
const WORKSPACE_ID = 'cmtptw34m000jeok40nhf5fnj'
const AGENT_ID = 'cmtpul0dx000zeok453jjkavr'

async function show(label: string, message: string, phase: 'TERM_BUILD' | 'RESCUE') {
  const t0 = Date.now()
  const lexicon = await getAgentCatalogLexicon(AGENT_ID)
  const analysis = await analyzeTurn({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    message,
    phase,
    corpusTokens: lexicon.identityTokens,
    history: [],
  })
  const ms = Date.now() - t0
  if (!analysis) {
    console.log(`✗ [${label}] (${ms}ms) → NULL (fail-open)`)
    return
  }
  console.log(`✓ [${label}] (${ms}ms)`)
  console.log(`   message: «${message}»`)
  console.log(`   intent=${analysis.intent} | confidence=${analysis.confidence} | handoff=${analysis.handoffUrgent}`)
  console.log(`   keywords=${JSON.stringify(analysis.productKeywords)}`)
  console.log(`   attributes=${JSON.stringify(analysis.attributes)}`)
  if (analysis.intent === 'product' && analysis.productKeywords.length) {
    console.log(`   merged searchTerms=${JSON.stringify(analyzerSearchTerms(analysis, message))}`)
  }
  console.log('')
}

async function main() {
  console.log('── direct turn-analyzer validation (real fast model) ──\n')
  // 1. dark-corner colloquial product wish (the rescue case)
  await show('RESCUE colloquial', 'همون وسیله‌ای که تو استوری گذاشتین رو می‌خوام خاکستری‌شو', 'RESCUE')
  // 2. angry complaint asking for a human (handoff verdict)
  await show('RESCUE angry+human', 'سه بار گفتم سفارشم هنوز نرسیده، خیلی ناراحتم، بذارید با یه کارشناس واقعی صحبت کنم', 'RESCUE')
  // 3. term-building: keyword + attribute extraction on a clear product wish
  await show('TERM_BUILD product', 'میز تلویزیون ۱۶۰ رنگ گردویی می‌خوام', 'TERM_BUILD')
  // 4. knowledge routing (must NOT become product)
  await show('RESCUE knowledge', 'شرایط گارانتی محصولاتتون چطوره؟', 'RESCUE')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('LIVE ANALYZER TEST FAILED:', e)
  process.exit(1)
})
