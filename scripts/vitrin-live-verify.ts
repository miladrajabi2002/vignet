import { PrismaClient } from '@prisma/client'

/**
 * LIVE E2E verification for the identified-product vitrin fix (commit 14444da01).
 * Creates a temporary workspace + agent + catalog (like agent-live-smoke.ts),
 * sends the exact customer phrasing from conversation cmtpt3pb80073eovfsyc9onnh
 * through the real widget API, asserts product cards are attached, then cleans up.
 */
const prisma = new PrismaClient()
const baseUrl = (process.env.AGENT_SMOKE_BASE_URL || 'http://127.0.0.1:3003').replace(/\/$/, '')
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

type TurnResult = { answer: string; conversationId: string; conversationToken: string }

function parseSse(raw: string): { answer: string; conversationId: string; conversationToken: string } {
  let answer = ''
  let conversationId = ''
  let conversationToken = ''
  for (const block of raw.split(/\n\n+/)) {
    for (const line of block.split('\n')) {
      if (!line.trimStart().startsWith('data:')) continue
      try {
        const event = JSON.parse(line.slice(line.indexOf('data:') + 5).trim()) as Record<string, unknown>
        if (event.type === 'meta') {
          conversationId = String(event.conversationId ?? '')
          conversationToken = String(event.conversationToken ?? '')
        } else if (event.type === 'delta' && typeof event.text === 'string') {
          answer += event.text
        } else if (event.type === 'replace' && typeof event.text === 'string') {
          answer = event.text
        } else if (event.type === 'error') {
          throw new Error(`stream error: ${String(event.message || event.error || 'unknown')}`)
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue
        throw error
      }
    }
  }
  if (!conversationId) throw new Error('AI response did not include a conversation id')
  if (!answer.trim()) throw new Error('AI response was empty')
  return { answer: answer.trim(), conversationId, conversationToken }
}

async function sendTurn(
  agentId: string,
  message: string,
  previous?: Pick<TurnResult, 'conversationId' | 'conversationToken'>,
): Promise<TurnResult> {
  const response = await fetch(`${baseUrl}/api/widget/${encodeURIComponent(agentId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      message,
      conversationId: previous?.conversationId,
      conversationToken: previous?.conversationToken,
    }),
  })
  if (!response.ok || !response.body) {
    throw new Error(`widget chat HTTP ${response.status}`)
  }
  const raw = await response.text()
  return parseSse(raw)
}

async function main(): Promise<void> {
  let workspaceId: string | null = null
  try {
    const workspace = await prisma.workspace.create({
      data: {
        name: `Vitrin live verify ${runId}`,
        slug: `vitrin-verify-${runId}`,
        plan: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        aiCreditBalanceIRR: 100_000_000,
        excludeFromAdminReports: true,
        onboardingCompleted: true,
        agents: {
          create: {
            name: 'مشاور فروش آزمایشی',
            language: 'fa',
            active: true,
            productAccessEnabled: true,
            requireCustomerInfo: false,
            systemPrompt: 'تو مشاور فروش فروشگاه لباس هستی؛ قیمت و موجودی را فقط از کاتالوگ بگو.',
            channels: {
              create: { type: 'WEB_WIDGET', active: true, config: { allowedDomains: [], leadCapture: false } },
            },
          },
        },
      },
      select: { id: true, agents: { select: { id: true }, take: 1 } },
    })
    workspaceId = workspace.id
    const agentId = workspace.agents[0]?.id
    if (!agentId) throw new Error('Temporary agent was not created')

    // Catalog mirrors the real failing store: ASCII-digit codes in names.
    const ronaz = await prisma.product.create({
      data: {
        workspaceId,
        name: 'تونیک روناز 0788',
        description: 'تونیک کرپ ریزش‌دار فری سایز مناسب 38 تا 48 با 15 طرح متنوع',
        price: 898_000,
        stock: null,
        images: ['https://cdn.example.com/ronaz.jpg'],
        tags: ['تونیک'],
        active: true,
        catalogItems: { create: { agentId } },
      },
    })
    await prisma.product.create({
      data: {
        workspaceId,
        name: 'تونیک پریان 0649',
        description: 'تونیک کرپ مجلسی فری سایز',
        price: 948_000,
        stock: null,
        images: ['https://cdn.example.com/perian.jpg'],
        tags: ['تونیک'],
        active: true,
        catalogItems: { create: { agentId } },
      },
    })

    console.log('── TURN 1: the exact failing phrasing «تونیک روناز ۰۷۸۸» (Persian digits)')
    const t1 = await sendTurn(agentId, 'تونیک روناز ۰۷۸۸')
    const cardCount1 = (t1.answer.match(/\[\[product:/g) ?? []).length
    const hasRonazCard = t1.answer.includes(`"id":"${ronaz.id}"`)
    console.log('   reply (first 200):', t1.answer.replace(/\s+/g, ' ').slice(0, 200))
    console.log(`   cards: ${cardCount1} | ronaz card: ${hasRonazCard}`)
    console.log(`   TURN1 RESULT: ${cardCount1 >= 1 && hasRonazCard ? 'PASS ✅' : 'FAIL ❌'}`)

    console.log('── TURN 2: imperative showcase «تونیک روناز ۰۷۸۸ رو بفرست»')
    const t2 = await sendTurn(agentId, 'تونیک روناز ۰۷۸۸ رو بفرست', t1)
    const cardCount2 = (t2.answer.match(/\[\[product:/g) ?? []).length
    const hasRonazCard2 = t2.answer.includes(`"id":"${ronaz.id}"`)
    const narrowed = cardCount2 === 1 && hasRonazCard2
    console.log('   reply (first 200):', t2.answer.replace(/\s+/g, ' ').slice(0, 200))
    console.log(`   cards: ${cardCount2} | narrowed to ronaz: ${narrowed}`)
    console.log(`   TURN2 RESULT: ${narrowed ? 'PASS ✅' : 'FAIL ❌'}`)

    console.log('── TURN 3: bare phrase vitrin «تونیک» still shows the multi-card showcase')
    const t3 = await sendTurn(agentId, 'تونیک', t2)
    const cardCount3 = (t3.answer.match(/\[\[product:/g) ?? []).length
    console.log('   reply (first 160):', t3.answer.replace(/\s+/g, ' ').slice(0, 160))
    console.log(`   cards: ${cardCount3}`)
    console.log(`   TURN3 RESULT: ${cardCount3 >= 2 ? 'PASS ✅' : 'FAIL ❌'}`)

    const allPass = cardCount1 >= 1 && hasRonazCard && narrowed && cardCount3 >= 2
    console.log(`\nOVERALL: ${allPass ? 'ALL PASS ✅' : 'SOME CHECKS FAILED ❌'}`)
    process.exitCode = allPass ? 0 : 1
  } finally {
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch((error) => {
        console.error('Failed to remove temporary verification workspace:', error)
      })
      console.log('cleanup: temporary workspace removed')
    }
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('verification failed:', error)
  process.exit(1)
})
