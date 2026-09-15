// Isolated live smoke for the shared state engine. It calls the configured
// model, never sends to an external channel, and removes its temporary tenant.
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { generateReply, startChat } from '@/lib/ai/chat-engine'

const GREETING_RE = /^\s*(?:سلام|درود|ممنون\s*(?:که\s*)?(?:پیام|پیگیری)|خوشحال\s*می\s*(?:شم|شوم)\s*(?:که\s*)?(?:کمک|در\s*خدمت)|hi|hello|hey|thanks?\s+for\s+(?:your\s+message|following\s+up|reaching\s+out)|happy\s+to\s+help)(?=\s|[!,.،؟?]|$)/iu
const RESTART_RE = /(?:چطور\s*می.*کمک|دنبال\s*چه\s*(?:محصول|کالا)|چه\s*محصولی|how\s+can\s+i\s+help|what\s+product)/iu
const MESSAGES = [
  'جلومبلی میخواستم',
  'میخوام برای مبل سبز مناسب باشه',
  'مدرنه',
] as const

function parseStream(raw: string): { conversationId: string; reply: string } {
  let conversationId = ''
  let streamed = ''
  let replacement: string | null = null
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue
    const event = JSON.parse(line.slice(5).trim()) as Record<string, unknown>
    if (event.type === 'meta' && typeof event.conversationId === 'string') conversationId = event.conversationId
    if (event.type === 'delta' && typeof event.text === 'string') streamed += event.text
    if (event.type === 'replace' && typeof event.text === 'string') replacement = event.text
    if (event.type === 'error') throw new Error(`stream error: ${String(event.message)}`)
  }
  const reply = replacement ?? streamed
  assert(conversationId && reply.trim(), 'stream returned no conversation or reply')
  return { conversationId, reply: reply.trim() }
}

async function runScenario(
  mode: 'PREVIEW_STREAM' | 'INSTAGRAM_NON_STREAM',
  workspaceId: string,
  agent: Parameters<typeof generateReply>[0]['agent'],
) {
  let conversationId: string | undefined
  const replies: string[] = []
  for (const message of MESSAGES) {
    if (mode === 'PREVIEW_STREAM') {
      const result = await startChat({ workspaceId, agent, conversationId, channel: 'API', message })
      assert(!('error' in result), `preview chat failed: ${JSON.stringify(result)}`)
      const parsed = parseStream(await new Response(result.stream).text())
      conversationId = parsed.conversationId
      replies.push(parsed.reply)
    } else {
      const result = await generateReply({ workspaceId, agent, conversationId, channel: 'INSTAGRAM', message })
      assert(!('error' in result), `Instagram chat failed: ${JSON.stringify(result)}`)
      conversationId = result.conversationId
      replies.push(result.reply)
    }
  }

  assert(conversationId)
  const [stored, lastAssistant] = await Promise.all([
    prisma.conversationState.findUniqueOrThrow({ where: { conversationId } }),
    prisma.message.findFirstOrThrow({
      where: { conversationId, role: 'ASSISTANT' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { metadata: true, content: true },
    }),
  ])
  const state = stored.state as Record<string, unknown>
  const goal = state.activeGoal as Record<string, unknown>
  const slots = state.slots as Record<string, Record<string, unknown>>
  assert.equal(goal.intent, 'PRODUCT')
  assert.equal(goal.label, 'جلومبلی میخواستم')
  assert.equal(slots.color?.normalizedValue, 'سبز')
  assert.equal(slots.style?.normalizedValue, 'مدرن')
  assert(stored.revision >= 2)
  const metadata = lastAssistant.metadata as Record<string, unknown>
  assert(metadata.conversationStateTrace, `${mode} assistant message has no state trace`)
  assert.equal(replies.at(-1), lastAssistant.content, `${mode} stream and persisted reply diverged`)
  for (const reply of replies.slice(1)) {
    const trace = JSON.stringify(metadata.conversationStateTrace)
    assert(!GREETING_RE.test(reply), `${mode} follow-up repeated a greeting (${trace}): ${reply}`)
    assert(!RESTART_RE.test(reply), `${mode} follow-up restarted discovery (${trace}): ${reply}`)
    assert(!/جالباسی|کمد|میز\s*تلویزیون/u.test(reply), `${mode} drifted to another product (${trace}): ${reply}`)
  }
  return {
    mode,
    conversationId,
    replies,
    lastStateTrace: metadata.conversationStateTrace,
    state: { activeGoal: goal, slotKeys: Object.keys(slots).sort(), revision: stored.revision },
  }
}

async function main() {
  const sourceAgentId = process.env.STATE_SMOKE_SOURCE_AGENT_ID?.trim()
  const sourceAgent = sourceAgentId
    ? await prisma.agent.findUniqueOrThrow({ where: { id: sourceAgentId } })
    : null
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Conversation state live smoke',
      slug: `conversation-state-smoke-${Date.now()}`,
      plan: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 60 * 60 * 1000),
      aiCreditBalanceIRR: 100_000,
      excludeFromAdminReports: true,
      onboardingCompleted: true,
    },
  })

  try {
    const agent = await prisma.agent.create({
      data: {
        workspaceId: workspace.id,
        name: 'State smoke agent',
        model: sourceAgent?.model ?? 'fast',
        language: sourceAgent?.language ?? 'fa',
        systemPrompt: sourceAgent?.systemPrompt
          ?? 'فروشندهٔ مبلمان هستی. کوتاه، طبیعی و فقط بر اساس اطلاعات گفتگو پاسخ بده.',
        temperature: sourceAgent?.temperature,
        maxTokens: sourceAgent?.maxTokens,
        fallbackMessage: sourceAgent?.fallbackMessage,
        promptConfig: sourceAgent?.promptConfig ?? undefined,
        roleTemplate: sourceAgent?.roleTemplate,
        active: true,
        productAccessEnabled: true,
        orderTrackingEnabled: false,
        requireCustomerInfo: false,
        handoffEnabled: false,
      },
    })
    const category = await prisma.productCategory.create({
      data: { workspaceId: workspace.id, name: 'جلومبلی', slug: 'coffee-table' },
    })
    const product = await prisma.product.create({
      data: {
        workspaceId: workspace.id,
        categoryId: category.id,
        name: 'جلومبلی مدرن آریا',
        description: 'جلومبلی مدرن با رنگ چوب روشن، مناسب هماهنگی با مبل سبز.',
        price: 12_500_000,
        stock: 3,
        images: [],
        tags: ['جلومبلی', 'مدرن', 'مبل سبز'],
      },
    })
    await prisma.agentCatalog.create({ data: { agentId: agent.id, productId: product.id } })

    const scenarios = await Promise.all([
      runScenario('PREVIEW_STREAM', workspace.id, agent as never),
      runScenario('INSTAGRAM_NON_STREAM', workspace.id, agent as never),
    ])
    const usage = await prisma.usageLog.findMany({
        where: { workspaceId: workspace.id, type: 'CHAT', status: 'CAPTURED' },
        select: { cost: true },
    })
    assert.equal(usage.length, 6, 'the live provider did not capture all six turns')
    const providerCost = usage.reduce((sum, item) => sum + (item.cost ?? 0), 0)
    console.log(JSON.stringify({
      passed: true,
      sourceAgentId: sourceAgent?.id ?? null,
      turns: 6,
      providerCostUSD: providerCost,
      scenarios,
    }, null, 2))
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } })
    await prisma.$disconnect()
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
