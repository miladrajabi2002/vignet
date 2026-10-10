import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { agentCreateSchema } from '@/lib/validations/agent'
import { findCheckoutIntegration } from '@/lib/commerce/checkout-service'
import { syncOnboarding } from '@/lib/onboarding'
import { dispatchProductEmbed } from '@/lib/queue/jobs'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { getPlatformAiConfig } from '@/lib/ai/platform-config'
import {
  AGENT_MAX_RESPONSE_TOKENS,
  AGENT_RESPONSE_TEMPERATURE,
} from '@/lib/ai/agent-runtime'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { getRecommendedAgentPreset } from '@/lib/agents/recommended-preset'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agents = await prisma.agent.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { conversations: { where: { deletedAt: null } }, channels: true } },
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
  const recommendedSetup = !!json
    && typeof json === 'object'
    && (json as { setupMode?: unknown }).setupMode === 'recommended'

  let agentInput = json
  if (recommendedSetup) {
    const [workspace, existingAgent] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: { businessType: true, businessProfile: true },
      }),
      prisma.agent.findFirst({
        where: { workspaceId: user.workspaceId },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    if (existingAgent) {
      const catalogCount = await prisma.agentCatalog.count({
        where: { agentId: existingAgent.id },
      })
      return NextResponse.json({ agent: existingAgent, catalogCount, reused: true })
    }
    if (!workspace) {
      return NextResponse.json({ error: 'WORKSPACE_NOT_FOUND' }, { status: 404 })
    }
    const profile = readBusinessProfile(workspace.businessProfile)
    // The setup screen lets the owner adjust the goals, name, greeting, tone
    // and the conversation switches (pre-chat name + number, operator handoff,
    // reading photos) before the agent is made; everything else stays as the template sets it.
    const overrides = json as {
      name?: unknown
      welcomeMessage?: unknown
      formality?: unknown
      goals?: unknown
      requireCustomerInfo?: unknown
      handoffEnabled?: unknown
      imageInputEnabled?: unknown
    }
    const goals = Array.isArray(overrides.goals)
      ? overrides.goals.filter((goal): goal is string => typeof goal === 'string').slice(0, 10)
      : null
    const preset = getRecommendedAgentPreset(workspace.businessType, profile?.businessName, goals)
    const name = typeof overrides.name === 'string' && overrides.name.trim().length >= 2
      ? overrides.name.trim().slice(0, 80)
      : preset.name
    const welcomeMessage = typeof overrides.welcomeMessage === 'string' && overrides.welcomeMessage.trim()
      ? overrides.welcomeMessage.trim().slice(0, 500)
      : preset.welcomeMessage
    const formality = overrides.formality === 'formal' || overrides.formality === 'casual'
      ? overrides.formality
      : null
    agentInput = {
      ...preset,
      name,
      welcomeMessage,
      requireCustomerInfo: typeof overrides.requireCustomerInfo === 'boolean'
        ? overrides.requireCustomerInfo
        : preset.requireCustomerInfo,
      handoffEnabled: typeof overrides.handoffEnabled === 'boolean'
        ? overrides.handoffEnabled
        : preset.handoffEnabled,
      // Billed per analysed image: on only when the owner asked for it.
      imageInputEnabled: overrides.imageInputEnabled === true,
      promptConfig: formality
        ? { ...preset.promptConfig, conversation: { ...preset.promptConfig.conversation, formality } }
        : preset.promptConfig,
    }
  }

  const parsed = agentCreateSchema.safeParse(agentInput)
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
  const [productCount, orderCount, checkoutStore] = await Promise.all([
    prisma.product.count({ where: { workspaceId: user.workspaceId, active: true } }),
    prisma.storeOrder.count({ where: { workspaceId: user.workspaceId } }),
    findCheckoutIntegration(user.workspaceId).then((found) => found.integration),
  ])
  // A store whose plugin takes payments sells in chat by default.
  const sellingReady = Boolean(checkoutStore)
  const agent = await prisma.agent.create({
    data: {
      workspaceId: user.workspaceId,
      name: data.name,
      description: data.description,
      systemPrompt: data.systemPrompt,
      model: data.model,
      temperature: AGENT_RESPONSE_TEMPERATURE,
      maxTokens: AGENT_MAX_RESPONSE_TOKENS,
      language: data.language ?? 'fa',
      voiceInputEnabled: data.voiceInputEnabled ?? true,
      // A15: billed per analysed image — opt-in only, never on by default.
      imageInputEnabled: data.imageInputEnabled ?? false,
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
      productAccessEnabled: data.productAccessEnabled ?? productCount > 0,
      orderTrackingEnabled: data.orderTrackingEnabled ?? orderCount > 0,
      productAccessConfigured: data.productAccessEnabled !== undefined,
      orderTrackingConfigured: data.orderTrackingEnabled !== undefined,
      orderCaptureEnabled: data.orderCaptureEnabled ?? sellingReady,
      payLinkEnabled: data.payLinkEnabled ?? sellingReady,
      orderCaptureConfigured: data.orderCaptureEnabled !== undefined,
      payLinkConfigured: data.payLinkEnabled !== undefined,
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
