import { PrismaClient } from '@prisma/client'

/**
 * LIVE E2E verification for commit d39e5086c (variant vitrine + per-variant
 * cards + conversation reopen). Mirrors the real failing conversation
 * cmtpt3pb80073eovfsyc9onnh (tonik ronaz 0788, 15 طرح, 12 in stock):
 *   1) «0788 طرح 05» must attach the card with طرح 05's OWN photo (not the
 *      parent cover, which is طرح 08's photo);
 *   2) «کاتالوگ طرح های دیگشو میفرستی» must send a deterministic vitrine of
 *      the in-stock طرحs — each card with its own photo — not random products;
 *   3) a RESOLVED conversation must reopen to OPEN when the customer writes.
 */
const prisma = new PrismaClient()
const baseUrl = (process.env.AGENT_SMOKE_BASE_URL || 'http://127.0.0.1:3003').replace(/\/$/, '')
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

type TurnResult = { answer: string; conversationId: string; conversationToken: string }

function parseSse(raw: string): TurnResult {
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
  return { answer: answer.trim(), conversationId, conversationToken }
}

async function sendTurn(
  agentId: string,
  message: string,
  previous?: Pick<TurnResult, 'conversationId' | 'conversationToken'>,
): Promise<TurnResult> {
  const response = await fetch(`${baseUrl}/api/widget/${encodeURIComponent(agentId)}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      // Continuity is authorized via this header (the widget reads it after
      // every turn) — NOT via the SSE meta event.
      ...(previous?.conversationToken
        ? { 'X-Vigent-Conversation-Token': previous.conversationToken }
        : {}),
    },
    body: JSON.stringify({
      message,
      conversationId: previous?.conversationId,
      conversationToken: previous?.conversationToken,
    }),
  })
  if (!response.ok || !response.body) {
    throw new Error(`widget chat HTTP ${response.status}`)
  }
  const headerToken = response.headers.get('x-vigent-conversation-token') ?? ''
  const parsed = parseSse(await response.text())
  return { ...parsed, conversationToken: headerToken || parsed.conversationToken }
}

function markersOf(text: string): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = []
  for (const match of text.matchAll(/\[\[product:(\{.*?\})\]\]/g)) {
    try {
      out.push(JSON.parse(match[1]) as Record<string, string>)
    } catch {
      /* malformed marker — count as absent */
    }
  }
  return out
}

async function main(): Promise<void> {
  let workspaceId: string | null = null
  const results: Array<[string, boolean]> = []
  const check = (name: string, pass: boolean) => {
    results.push([name, pass])
    console.log(`   ${name}: ${pass ? 'PASS ✅' : 'FAIL ❌'}`)
  }
  try {
    const workspace = await prisma.workspace.create({
      data: {
        name: `Variant live verify ${runId}`,
        slug: `variant-verify-${runId}`,
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

    // Real 0788 shape: 15 طرح, 12 in stock, each with its OWN photo.
    const tarh = (id: number, n: string, qty: number) => ({
      id,
      sku: `10705${n}110788`,
      image: `https://cdn.example.com/tarh-${n}.jpg`,
      price: 898000,
      inStock: qty > 0,
      salePrice: 898000,
      attributes: { 'طرح': `طرح ${n}` },
      manageStock: true,
      regularPrice: 998000,
      stockQuantity: qty,
    })
    const ronaz = await prisma.product.create({
      data: {
        workspaceId,
        name: 'تونیک روناز 0788',
        description: 'تونیک کرپ ریزش‌دار فری سایز مناسب 38 تا 48',
        price: 898_000,
        stock: null,
        images: ['https://cdn.example.com/parent-cover.jpg'],
        tags: ['تونیک'],
        active: true,
        attributes: {
          'طرح': 'طرح 01, طرح 02, طرح 03, طرح 04, طرح 05, طرح 06, طرح 07, طرح 08, طرح 09, طرح 10, طرح 11, طرح 12, طرح 13, طرح 14, طرح 15',
          'سایز': 'Free Size',
          '_variations': [
            tarh(77677, '15', 0), tarh(77647, '01', 24), tarh(77648, '02', 18), tarh(77649, '03', 31),
            tarh(77650, '04', 22), tarh(77651, '05', 54), tarh(77652, '06', 13), tarh(77653, '07', 2),
            tarh(77654, '08', 1), tarh(77655, '09', 7), tarh(77656, '10', 5), tarh(77657, '11', 2),
            tarh(77658, '12', 10), tarh(77659, '13', 0), tarh(77660, '14', 0),
          ],
        },
        catalogItems: { create: { agentId } },
      },
    })
    // Decoy products — the OLD bug sent these on «کاتالوگ طرح های دیگشو».
    await prisma.product.create({
      data: {
        workspaceId,
        name: 'شومیز مانیسا 0434',
        description: 'شومیز دانتل سه سایز',
        price: 1_398_000,
        stock: null,
        images: ['https://cdn.example.com/manisa.jpg'],
        tags: ['شومیز'],
        active: true,
        catalogItems: { create: { agentId } },
      },
    })
    await prisma.product.create({
      data: {
        workspaceId,
        name: 'کراپ دلسا 0439',
        description: 'کراپ فانریپ پنبه‌ای',
        price: 398_000,
        stock: null,
        images: ['https://cdn.example.com/delsa.jpg'],
        tags: ['کراپ'],
        active: true,
        catalogItems: { create: { agentId } },
      },
    })

    console.log('── TURN 1: «تونیک روناز 0788» — consult with the product card attached')
    const t1 = await sendTurn(agentId, 'تونیک روناز 0788')
    console.log('   reply (first 160):', t1.answer.replace(/\s+/g, ' ').slice(0, 160))
    const t1Markers = markersOf(t1.answer)
    check('card attached', t1Markers.length === 1 && t1Markers[0].id === ronaz.id)
    check('parent card keeps cover image', t1Markers[0]?.image === 'https://cdn.example.com/parent-cover.jpg')

    console.log('── TURN 2: «کاتالوگ طرح های دیگشو میفرستی» — deterministic variant vitrine')
    const t2 = await sendTurn(agentId, 'کاتالوگ طرح های دیگشو میفرستی', t1)
    const t2Markers = markersOf(t2.answer)
    const t2Images = new Set(t2Markers.map((m) => m.image))
    console.log('   reply (first 160):', t2.answer.replace(/\s+/g, ' ').slice(0, 160))
    console.log(`   cards: ${t2Markers.length}`)
    check('10 variant cards', t2Markers.length === 10)
    check('all cards are طرح variations of ronaz', t2Markers.every((m) => m.id?.startsWith(`${ronaz.id}#v`) && m.name?.includes('طرح ')))
    check('every card carries its own distinct photo', t2Images.size === 10 && [...t2Images].every((url) => url.startsWith('https://cdn.example.com/tarh-')))
    check('out-of-stock طرح 13/14/15 excluded', !t2.answer.includes('طرح 13') || !t2Markers.some((m) => m.name?.includes('طرح 13')))
    check('no random decoy products (مانیسا/دلسا)', !t2.answer.includes('مانیسا') && !t2.answer.includes('دلسا'))
    check('honest count line', t2.answer.includes('طرح') && (t2.answer.includes('۱۲') || t2.answer.includes('12')))

    console.log('── TURN 3: «0788 طرح 05» — the card must show طرح 05\'s own photo')
    const t3 = await sendTurn(agentId, '0788 طرح 05', t2)
    const t3Markers = markersOf(t3.answer)
    console.log('   reply (first 160):', t3.answer.replace(/\s+/g, ' ').slice(0, 160))
    check('exactly one card', t3Markers.length === 1)
    check('card is طرح 05 with its own photo (not the parent cover)', t3Markers[0]?.image === 'https://cdn.example.com/tarh-05.jpg')
    check('card name names طرح 05', t3Markers[0]?.name?.includes('طرح 05') === true)

    console.log('── TURN 4: conversation reopen — mark RESOLVED, then write again')
    await prisma.conversation.update({ where: { id: t3.conversationId }, data: { status: 'RESOLVED' } })
    const before = await prisma.conversation.findUnique({ where: { id: t3.conversationId }, select: { status: true } })
    console.log('   status before new message:', before?.status)
    const t4 = await sendTurn(agentId, 'طرح هاشو بفرست', t3)
    const after = await prisma.conversation.findUnique({ where: { id: t3.conversationId }, select: { status: true } })
    console.log('   status after new message:', after?.status)
    check('RESOLVED conversation reopened to OPEN', after?.status === 'OPEN')
    const t4Markers = markersOf(t4.answer)
    check('variant vitrine still resolves after reopen (from #v marker refs)', t4Markers.length === 10 && t4Markers.every((m) => m.id?.startsWith(`${ronaz.id}#v`)))

    const allPass = results.every(([, pass]) => pass)
    console.log(`\n${results.filter(([, pass]) => pass).length}/${results.length} checks passed`)
    console.log(`OVERALL: ${allPass ? 'ALL PASS ✅' : 'SOME CHECKS FAILED ❌'}`)
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
