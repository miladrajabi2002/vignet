/**
 * Root-cause diagnostic for the catalog vs knowledge-base routing problem.
 * Runs the DETERMINISTIC pipeline (no LLM) against جواهری's real agent and catalog:
 *   planProductRequest → findAssignedCatalogReference → retrieveContext → fetchCatalogProducts
 * WITH the new corpus-derived lexicon + semantic promotion (data-driven intent).
 *
 * Usage: cd /var/www/vigent.ir/public/vignet && npx tsx -r dotenv/config scripts/catalog-intent-diagnose.ts
 */
import { PrismaClient } from '@prisma/client'
import {
  planProductRequest,
  extractProductTerms,
  findAssignedCatalogReference,
  fetchCatalogProducts,
} from '@/lib/ai/conversation'
import { retrieveContext } from '@/lib/ai/rag'
import { getAgentCatalogLexicon } from '@/lib/ai/catalog-lexicon'

const prisma = new PrismaClient()
const WORKSPACE_ID = 'cmtptw34m000jeok40nhf5fnj' // جواهری (آکام چوب)

async function main() {
  const agent = await prisma.agent.findFirst({
    where: { workspaceId: WORKSPACE_ID, productAccessEnabled: true },
    select: { id: true, name: true, productAccessEnabled: true },
  })
  if (!agent) {
    console.log('NO AGENT WITH CATALOG ACCESS FOUND')
    return
  }
  console.log(`AGENT: ${agent.name} (${agent.id})`)

  const lexicon = await getAgentCatalogLexicon(agent.id)
  console.log(`LEXICON: ${lexicon.identityTokens.size} identity tokens from ${lexicon.productCount} products`)
  const corpusTokens = lexicon.identityTokens

  const battery: Array<{ group: string; query: string }> = [
    { group: 'A-مبلمان', query: 'سلام، میز تلویزیون ۱۶۰ می‌خوام.' },
    { group: 'A-مبلمان', query: 'رنگ گردویی می‌خوام.' },
    { group: 'A-مبلمان', query: 'میز تلویزیون چه سایزهایی دارید؟' },
    { group: 'A-مبلمان', query: 'میز عسلی میخواستم' },
    { group: 'A-مبلمان', query: 'جلومبلی میخوام' },
    { group: 'B-بدون-فعل', query: 'میز عسلی اومدید؟' },
    { group: 'B-بدون-فعل', query: 'پاف مراکشی جدید اومده؟' },
    { group: 'B-بدون-فعل', query: 'کوسن نقش دارین؟' },
    { group: 'B-بدون-فعل', query: 'قیمت میز جلومبلی نقش چنده؟' },
    { group: 'C-آشپزخونه', query: 'قابلمه ضدخش اومدید؟' },
    { group: 'C-آشپزخونه', query: 'ست قاشق چنگال می‌خوام' },
    { group: 'C-آشپزخونه', query: 'سرویس چای خوری دارین؟' },
    { group: 'C-پوشاک-مردونه', query: 'پیراهن مردونه مجلسی اومدید؟' },
    { group: 'C-پوشاک-مردونه', query: 'شلوار جین مردونه می‌خوام' },
    { group: 'C-الکترونیک', query: 'هدفون بی‌سیم اومدید؟' },
    { group: 'C-الکترونیک', query: 'ساعت کلاسیک دارین؟' },
    { group: 'D-پروب-معنایی', query: 'پاف بالشتی برای هدیه می‌خوام' },
    { group: 'D-پروب-معنایی', query: 'رومیزی میز غذاخوری اومدید؟' },
  ]

  console.log('\n=== INTENT + RECALL DIAGNOSTIC (WITH corpus lexicon + semantic promotion) ===\n')
  const rows: string[] = []
  for (const { group, query } of battery) {
    const plan = planProductRequest(query, [], corpusTokens)
    const terms = extractProductTerms(query)
    let reference = '—'
    let recall = '—'
    let promoted = false

    if (agent.productAccessEnabled) {
      const ref = await findAssignedCatalogReference(agent.id, query).catch(() => null)
      reference = ref ? `${ref.match}(${ref.productIds.length})` : 'null'

      const semanticProbeAllowed = !plan.isProductTurn && !plan.requestNewTopic && query.trim().length >= 4
      const retrievalQuery = plan.isProductTurn && plan.searchTerms.length
        ? plan.searchTerms.join(' ')
        : query
      const { chunks } = await retrieveContext({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        query: retrievalQuery,
        limit: plan.isProductTurn ? 12 : (semanticProbeAllowed ? 6 : 3),
        includeProductCatalog: true,
        excludeProductContentFromText: true,
      }).catch(() => ({ chunks: [], contextText: '' }))
      const productChunks = chunks.filter((c) => {
        const m = c.metadata as Record<string, unknown> | null
        return m && typeof m === 'object' && 'productId' in m
      })
      const bestSim = chunks.length ? Math.max(...chunks.map((c) => c.similarity)).toFixed(2) : '0'
      recall = `chunks=${chunks.length} prodChunks=${productChunks.length} bestSim=${bestSim}`

      // semantic promotion (mirrors chat-engine)
      const SEMANTIC_SIM = 0.45
      const strong = productChunks.filter((c) => c.similarity >= SEMANTIC_SIM)
      if (semanticProbeAllowed && strong.length > 0) promoted = true

      const productIds = [
        ...(ref?.productIds ?? []),
        ...productChunks
          .filter((c) => c.similarity >= 0.45 || c.lexicalRank != null)
          .map((c) => String((c.metadata as Record<string, unknown>).productId)),
      ]
      const fetched = await fetchCatalogProducts(agent.id, productIds, plan, corpusTokens).catch(() => [])
      const result = fetched.length
        ? `${fetched.length} [${fetched.slice(0, 3).map((p) => p.name.slice(0, 38)).join(' | ')}]`
        : 'NONE'
      const flag = (b: boolean) => (b ? '✓' : '✗')
      rows.push(
        `[${group}] «${query}»\n` +
          `   intent: productTurn=${flag(plan.isProductTurn || promoted)}${promoted ? '(semantic↑)' : ''} ` +
          `corpus=[${(plan.corpusSubjectTerms ?? []).join('،')}]\n` +
          `   terms: [${terms.join('، ')}] | lexicalRef: ${reference}\n` +
          `   retrieval: ${recall}\n` +
          `   RESULT: ${result}\n`,
      )
    }
  }
  console.log(rows.join('\n'))

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('DIAGNOSTIC FAILED:', error)
  process.exit(1)
})
