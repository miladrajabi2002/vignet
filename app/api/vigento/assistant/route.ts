import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { chatCompletion, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { applyPlatformModelPolicy, getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import { resolveModelId } from '@/lib/ai/models'
import { displayPhone } from '@/lib/phone'

const inputSchema = z.object({
  message: z.string().trim().min(2).max(1000),
  language: z.enum(['fa', 'en']).default('fa'),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await rateLimit(`vigento-assistant:${user.workspaceId}`, 8, 60))) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const [workspace, conversations, messages, contacts, handoffs, open, resolved, appointments, spend, activeContacts, recent] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: user.workspaceId }, select: { name: true, plan: true, aiCreditBalanceIRR: true, businessType: true } }),
    prisma.conversation.count({ where: { workspaceId: user.workspaceId, createdAt: { gte: start } } }),
    prisma.message.count({ where: { createdAt: { gte: start }, conversation: { workspaceId: user.workspaceId } } }),
    prisma.contact.count({ where: { workspaceId: user.workspaceId, createdAt: { gte: start } } }),
    prisma.conversation.count({ where: { workspaceId: user.workspaceId, status: 'HANDED_OFF' } }),
    prisma.conversation.count({ where: { workspaceId: user.workspaceId, status: 'OPEN' } }),
    prisma.conversation.count({ where: { workspaceId: user.workspaceId, status: 'RESOLVED', createdAt: { gte: start } } }),
    prisma.appointment.count({ where: { workspaceId: user.workspaceId, startsAt: { gte: start }, status: { in: ['PENDING', 'CONFIRMED'] } } }),
    prisma.usageLog.aggregate({ where: { workspaceId: user.workspaceId, date: { gte: start }, status: 'CAPTURED' }, _sum: { chargedIRR: true } }),
    prisma.contact.findMany({ where: { workspaceId: user.workspaceId, lastActivityAt: { gte: start } }, orderBy: { lastActivityAt: 'desc' }, take: 5, select: { name: true, phone: true, instagramUsername: true, _count: { select: { conversations: true } } } }),
    prisma.conversation.findMany({ where: { workspaceId: user.workspaceId }, orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }], take: 5, select: { status: true, summary: true, messageCount: true, contact: { select: { name: true, phone: true } } } }),
  ])

  const facts = {
    date: start.toISOString().slice(0, 10),
    workspace: workspace.name,
    plan: workspace.plan,
    businessType: workspace.businessType,
    creditToman: Math.round(workspace.aiCreditBalanceIRR / 10),
    today: { conversations, messages, newContacts: contacts, resolved, aiCostToman: Math.round((spend._sum.chargedIRR ?? 0) / 10) },
    attention: { handoffs, openConversations: open, upcomingAppointments: appointments },
    mostRecentlyActiveContacts: activeContacts.map((contact) => ({ identity: contact.name || contact.instagramUsername || displayPhone(contact.phone) || 'unknown', conversationCount: contact._count.conversations })),
    recentCases: recent,
    unavailableData: ['sales/orders are not modeled unless a store integration supplies them'],
  }

  const fa = parsed.data.language === 'fa'
  const fallback = fa
    ? `امروز ${conversations.toLocaleString('fa-IR')} گفتگوی جدید و ${messages.toLocaleString('fa-IR')} پیام ثبت شده است. ${handoffs.toLocaleString('fa-IR')} مورد تحویل به اپراتور و ${open.toLocaleString('fa-IR')} گفتگوی باز نیاز به بررسی دارد. هزینه پاسخ‌های AI امروز ${Math.round((spend._sum.chargedIRR ?? 0) / 10).toLocaleString('fa-IR')} تومان بوده است.`
    : `Today there were ${conversations} new conversations and ${messages} messages. ${handoffs} handoffs and ${open} open conversations need review. AI replies cost ${Math.round((spend._sum.chargedIRR ?? 0) / 10)} toman today.`

  if (!getPlatformOpenRouterKey()) return NextResponse.json({ answer: fallback, source: 'facts' })
  try {
    const config = await getPlatformAiConfig()
    if (!(await hasPlatformAiBudget(config))) return NextResponse.json({ answer: fallback, source: 'facts' })
    const alias = applyPlatformModelPolicy('fast', config)
    const model = resolveModelId(alias, config.providerModels)
    const completion = await chatCompletion({
      model,
      messages: [
        { role: 'system', content: `You are Vigento, a concise workspace operations copilot. Answer only from LIVE_FACTS. Never invent sales, revenue, identities, or outcomes. Clearly say when data is unavailable. This endpoint is READ ONLY: if the user asks to mutate credit, delete data, edit files, or change a record, provide a short preview of the requested operation and state that confirmation-enabled execution is not available yet; never claim it happened. Reply in ${fa ? 'Persian' : 'English'}. LIVE_FACTS=${JSON.stringify(facts)}` },
        { role: 'user', content: parsed.data.message },
      ],
      temperature: 0.2,
      maxTokens: 520,
    })
    await prisma.usageLog.create({ data: { workspaceId: user.workspaceId, type: 'VIGENTO_ASSISTANT', model, promptTokens: completion.usage.promptTokens, completionTokens: completion.usage.completionTokens, reasoningTokens: completion.usage.reasoningTokens, cachedTokens: completion.usage.cachedTokens, providerRequestId: completion.usage.providerRequestId, cost: completion.usage.costUSD } }).catch(() => {})
    return NextResponse.json({ answer: completion.content || fallback, source: 'ai' })
  } catch {
    return NextResponse.json({ answer: fallback, source: 'facts' })
  }
}
