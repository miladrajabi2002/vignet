/**
 * Seeds a logged-in test owner with the gateway set up and prints a session
 * cookie, for loading the dashboard pages of a local build. Test database only.
 * Run: tsx -r dotenv/config scripts/pay-gateway-qa-seed.ts
 */
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { deviceTokenFields, newDeviceToken } from '@/lib/payments/card/ingest'
import { addPayCard, claimCardPayment, createCardPayment, cardPayView } from '@/lib/payments/card/service'
import { composeCardPayMessage } from '@/lib/payments/card/pay-card'
import { readPayGatewaySettings } from '@/lib/payments/card/settings'

async function main() {
  if (!/paydev|test/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to run outside a test database')
  const phone = '+989120000077'
  await prisma.user.deleteMany({ where: { phone } })
  await prisma.workspace.deleteMany({ where: { slug: 'qa-gateway' } })
  const workspace = await prisma.workspace.create({
    data: {
      name: 'فروشگاه نگار', slug: 'qa-gateway', plan: 'PRO', onboardingCompleted: true, businessType: 'COMMERCE', payGatewayEnabled: true,
      businessProfile: { businessName: 'فروشگاه نگار', capabilities: ['products', 'support'] },
    },
  })
  const user = await prisma.user.create({ data: { workspaceId: workspace.id, phone, name: 'نگار' } })
  const agent = await prisma.agent.create({ data: { workspaceId: workspace.id, name: 'ایجنت فروش', systemPrompt: '-', orderCaptureEnabled: true, cardPayEnabled: true } })
  await addPayCard(workspace.id, { pan: '6104337712345675', holderName: 'نگار رضایی' })
  await addPayCard(workspace.id, { pan: '6037991234567893', holderName: 'نگار رضایی' }).catch(() => null)
  await prisma.payDevice.create({ data: { workspaceId: workspace.id, name: 'گوشی فروشگاه', phone: '09120000077', method: 'URL', connectedAt: new Date(), ...deviceTokenFields(newDeviceToken()) } })
  const conversation = await prisma.conversation.create({ data: { workspaceId: workspace.id, agentId: agent.id, channel: 'WEB_WIDGET', externalId: 'qa-1' } })
  const paid = await createCardPayment({ workspaceId: workspace.id, baseAmount: 890_000, source: 'LINK', reference: 'K4T8ZR' })
  const review = await createCardPayment({ workspaceId: workspace.id, baseAmount: 1_250_000, source: 'CHAT', reference: 'A7K2Q9', conversationId: conversation.id, customerName: 'سارا احمدی' })
  if (review.ok) {
    const view = cardPayView(review.payment, review.card, readPayGatewaySettings(null), 'fa')
    await prisma.message.create({ data: { conversationId: conversation.id, role: 'USER', content: 'همین کفش رو می‌خوام، کارت به کارت می‌کنم' } })
    await prisma.message.create({ data: { conversationId: conversation.id, role: 'ASSISTANT', content: composeCardPayMessage(view), metadata: { turnCost: { v: 1, replyUSD: 0.0004, auxUSD: 0.0002, totalUSD: 0.0006, replyModel: 'deepseek/deepseek-v4.1-flash', replyTokens: { in: 1800, out: 120, cached: 0 }, calls: [{ purpose: 'understand', model: 'qwen/qwen3', ok: true, in: 900, out: 60, usd: 0.0002, ms: 400 }] } } } })
    await claimCardPayment(review.payment.id)
  }
  if (paid.ok) await prisma.cardPayment.update({ where: { id: paid.payment.id }, data: { status: 'PAID', paidAt: new Date(), confirmedBy: 'AUTO' } })
  await prisma.paymentGatewaySettings.upsert({ where: { id: 'primary' }, create: { id: 'primary', inboundLines: ['30002108015489'], inboundSecret: 'qa-secret' }, update: {} })
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? ''
  const token = { id: user.id, sub: user.id, workspaceId: workspace.id, platformRole: 'USER', phone, name: 'نگار', user: { name: 'نگار' } }
  for (const salt of ['__Secure-authjs.session-token', 'authjs.session-token']) {
    console.log(`${salt}=${await encode({ token, secret, salt })}`)
  }
  console.log(`CONVERSATION=${conversation.id}`)
  console.log(`AUTHORITY=${review.ok ? review.payment.authority : ''}`)
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1) })
