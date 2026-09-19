/**
 * Live verification of the five Javaheri bug fixes against the real agent
 * catalog (deterministic — no LLM calls). Run on the server via tsx.
 */
import {
  planProductRequest,
  fetchCatalogProducts,
  buildFamilyEnumerationReply,
  extractProductTerms,
} from '../lib/ai/conversation'
import {
  advanceConversationWorkingState,
  contextualizeProductRequest,
  createEmptyConversationWorkingState,
  enrichConversationStateWithCatalog,
  observeAssistantTurn,
} from '../lib/ai/conversation-state'
import { getAgentCatalogLexicon } from '../lib/ai/catalog-lexicon'
import { retrieveContext } from '../lib/ai/rag'
import { prisma } from '../lib/prisma'

const AGENT = 'cmtpul0dx000zeok453jjkavr'

interface Turn {
  role: 'user' | 'assistant'
  content: string
}

async function runScenario(name: string, turns: Turn[]) {
  const lexicon = await getAgentCatalogLexicon(AGENT)
  const corpus = lexicon.identityTokens
  let state = createEmptyConversationWorkingState('verify')
  const history: { role: 'user' | 'assistant'; content: string }[] = []
  console.log(`\n■■■ ${name} ■■■`)
  let tick = 0
  for (const turn of turns) {
    if (turn.role === 'assistant') {
      state = observeAssistantTurn(state, turn.content, `a-${tick}`, new Date())
      history.push({ role: 'assistant', content: turn.content })
      continue
    }
    const raw = planProductRequest(turn.content, history, corpus)
    state = advanceConversationWorkingState({
      state,
      sessionStartId: 'verify',
      message: turn.content,
      messageId: `u-${tick}`,
      createdAt: new Date(Date.now() + tick * 1000),
      productPlan: raw,
    })
    const plan = contextualizeProductRequest(raw, state)
    history.push({ role: 'user', content: turn.content })
    // Mirror prepareTurn: real vector retrieval seeds the product pool.
    const retrievalQuery = plan.isProductTurn && plan.searchTerms.length
      ? plan.searchTerms.join(' ')
      : turn.content
    const { chunks } = await retrieveContext({
      workspaceId: 'cmtptw34m000jeok40nhf5fnj',
      agentId: AGENT,
      query: retrievalQuery,
      limit: plan.isProductTurn ? Math.min(24, Math.max(12, plan.requestedCount * 2)) : 3,
      includeProductCatalog: plan.isProductTurn,
      excludeProductContentFromText: true,
    })
    const productIds = [...new Set(chunks
      .map((chunk) => {
        const metadata = chunk.metadata as Record<string, unknown> | null
        if (!metadata || typeof metadata !== 'object' || !('productId' in metadata)) return null
        if (chunk.similarity < 0.45 && chunk.lexicalRank == null) return null
        return String(metadata.productId)
      })
      .filter((id): id is string => !!id))]
    const products = await fetchCatalogProducts(AGENT, productIds, plan, corpus, state.candidateEntityIds)
    state = enrichConversationStateWithCatalog(state, products)
    console.log(`\n[USER] ${turn.content}`)
    console.log(`  intent=${state.lastTurn?.intent} relation=${state.lastTurn?.relation} slots={${Object.keys(state.slots).join(',')}}`)
    console.log(`  isProductTurn=${plan.isProductTurn} advisory=${plan.advisoryConsult} comparison=${plan.comparisonConsult} variantBrowse=${plan.variantBrowse}`)
    console.log(`  searchTerms=${JSON.stringify(plan.searchTerms)}`)
    console.log(`  anchors=${JSON.stringify(state.searchAnchors)}`)
    console.log(`  candidates=${products.length ? products.map((p) => `${p.name} (${(p.price ?? 0) / 1e6}M)`).join(' | ') : '(none)'}`)
    if (plan.variantBrowse) {
      const enumReply = await buildFamilyEnumerationReply({
        workspaceId: 'cmtptw34m000jeok40nhf5fnj',
        agentId: AGENT,
        lang: 'fa',
        searchTerms: plan.searchTerms,
        corpusTokens: corpus,
      })
      console.log(`  ENUM_REPLY: ${enumReply ?? '(null — falls to consult)'}`)
    }
    tick += 1
  }
}

async function main() {
  // Scenario 1 — Javaheri issue 1: 160 → 190 → «طرحات چیه»
  await runScenario('ISSUE 1: میز تلویزیون ۱۹۰ طرح‌ها', [
    { role: 'user', content: 'سلام میز تلویزیون 160 میخوام' },
    { role: 'assistant', content: 'میز تلویزیون سایز 160 در چند طرح موجوده. طرح مورد نظرت کدومه؟' },
    { role: 'user', content: 'فکر کنم 190 بهتر باشه' },
    { role: 'assistant', content: 'میز تلویزیون سایز 190 هم موجوده. طرح مورد نظرت برای سایز 190 کدومه؟' },
    { role: 'user', content: 'طرحات چیه' },
  ])

  // Scenario 2 — Javaheri issue 2: cream sofa advice
  await runScenario('ISSUE 2: مبل کرم دارم چه طرحی پیشنهاد میدی؟', [
    { role: 'user', content: 'مبل کرم دارم چه طرحی پیشنهاد میدی؟' },
  ])

  // Scenario 3 — Javaheri issue 3: order info + lead time
  await runScenario('ISSUE 3: سفارش جلومبلی + تهران/نقدی/زمان آماده‌سازی', [
    { role: 'user', content: 'جلومبلی نقش طرح شهداد رنگ گردویی میخپام' },
    { role: 'assistant', content: 'میز جلومبلی نقش طرح شهداد با رنگ گردویی قیمتش 23,970,000 تومان هست. برای ثبت سفارش، لطفاً شهر مقصد و روش پرداخت (نقدی یا اعتباری) رو بگید.' },
    { role: 'user', content: 'تهرانم، نقدی میخوام. اماده سازی و ارسالش چقدر طول میکشه؟' },
  ])

  // Scenario 4 — Javaheri issue 5: نگار vs نقش price comparison
  await runScenario('ISSUE 5: نقش و نگار کدومش ارزون‌تره؟', [
    { role: 'user', content: 'مدل نگار به نظرم خیلی ساده‌ست' },
    { role: 'assistant', content: 'میزهای پذیرایی نگار طراحی ساده‌تری نسبت به مدل نقش دارند. کدام مدل براتون اولویت داره؟' },
    { role: 'user', content: 'بین نقش و نگار مرددم، کدوم برای من بهتره؟' },
    { role: 'assistant', content: 'مدل نقش صفحه متحرک و فضای مخفی دارد. اولویت شما کدومه؟' },
    { role: 'user', content: 'کدومش ارزون‌تره؟' },
  ])

  // Scenario 5 — control: exact-match path must stay intact
  await runScenario('CONTROL: میز تلویزیون 160 میخوام (regression)', [
    { role: 'user', content: 'سلام میز تلویزیون 160 میخوام' },
  ])
  // Scenario 6 — control: anti-hallucination fail-closed stays intact
  await runScenario('CONTROL: شلوار پلنگی دارین؟ (anti-hallucination)', [
    { role: 'user', content: 'شلوار پلنگی دارین؟' },
  ])
}

main().then(() => prisma.$disconnect?.()).catch((error) => {
  console.error(error)
  process.exit(1)
})
