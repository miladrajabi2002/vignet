import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { agentCreateSchema } from '@/lib/validations/agent'
import { syncOnboarding } from '@/lib/onboarding'
import { dispatchProductEmbed } from '@/lib/queue/jobs'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { getPlatformAiConfig } from '@/lib/ai/platform-config'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agents = await prisma.agent.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { conversations: true, channels: true } },
    },
  })
  return NextResponse.json({ agents })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // Agent count is intentionally not a plan dimension. Plans limit active
  // channel connections; creating/editing agents only requires active access.
  const access = await checkWorkspaceActive(user.workspaceId)
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 402 })
  }

  const json = await req.json().catch(() => null)
  const parsed = agentCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  if (parsed.data.model) {
    const [workspace, policy] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: user.workspaceId }, select: { plan: true } }),
      getPlatformAiConfig(),
    ])
    const allowed = workspace?.plan === 'TRIAL' ? [policy.trialModel] : policy.enabledModels
    if (!allowed.includes(parsed.data.model)) {
      return NextResponse.json({ error: 'MODEL_DISABLED' }, { status: 400 })
    }
  }

  const data = parsed.data
  const agent = await prisma.agent.create({
    data: {
      workspaceId: user.workspaceId,
      name: data.name,
      description: data.description,
      systemPrompt: data.systemPrompt,
      model: data.model,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      language: data.language ?? 'fa',
      voiceEnabled: data.voiceEnabled ?? false,
      ttsVoice: data.ttsVoice,
      welcomeMessage: data.welcomeMessage,
      fallbackMessage: data.fallbackMessage,
      // Smart handoff is a safety/default capability. Clients may still
      // explicitly disable proactive escalation for an individual agent.
      handoffEnabled: data.handoffEnabled ?? true,
      handoffMessage: data.handoffMessage,
      handoffKeywords: data.handoffKeywords ?? [],
      // ─ F1: layered prompt
      promptConfig: data.promptConfig ?? undefined,
      roleTemplate: data.roleTemplate ?? undefined,
      // ─ F3: customer identification
      requireCustomerInfo: data.requireCustomerInfo ?? false,
      customerInfoPrompt: data.customerInfoPrompt ?? undefined,
      productAccessEnabled: data.productAccessEnabled ?? true,
      orderTrackingEnabled: data.orderTrackingEnabled ?? false,
    },
  })

  // Auto-assign all active workspace products so the agent can answer about
  // them immediately without requiring a manual catalog page visit.
  const activeProducts = await prisma.product.findMany({
    where: { workspaceId: user.workspaceId, active: true },
    select: { id: true },
  })
  if (activeProducts.length > 0) {
    await prisma.agentCatalog.createMany({
      data: activeProducts.map((p) => ({ agentId: agent.id, productId: p.id })),
      skipDuplicates: true,
    })

    // Product embeddings are agent-scoped. Seed them in bounded queue bursts
    // so a newly-created agent can search the existing catalog immediately.
    try {
      for (let offset = 0; offset < activeProducts.length; offset += 20) {
        await Promise.all(
          activeProducts.slice(offset, offset + 20).map((product) =>
            dispatchProductEmbed({
              productId: product.id,
              workspaceId: user.workspaceId,
              agentIds: [agent.id],
            }),
          ),
        )
      }
    } catch (error) {
      // The relational fallback still exposes at most five matching products;
      // a later product update will retry the missing semantic embeddings.
      console.error('[agents] catalog embedding seed failed:', error)
    }
  }

  await syncOnboarding(user.workspaceId)

  return NextResponse.json({ agent, catalogCount: activeProducts.length }, { status: 201 })
}
