import { PrismaClient } from '@prisma/client'
import { createWorkspaceVigentoContext } from '@/lib/vigento/access'
import { WorkspaceVigentoRepository } from '@/lib/vigento/workspace-repository'
import { executeWorkspaceVigentoTool } from '@/lib/vigento/user-tools'
import { getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { runWorkspaceVigento } from '@/lib/vigento/workspace-agent'

const prisma = new PrismaClient()
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const workspaceIds: string[] = []

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function createSubject(label: string, sequence: number) {
  const workspace = await prisma.workspace.create({
    data: {
      name: `Vigento isolation ${label} ${suffix}`,
      slug: `vigento-isolation-${label.toLowerCase()}-${suffix}`,
      excludeFromAdminReports: true,
      onboardingCompleted: true,
      owner: {
        create: {
          phone: `+9898${String(Date.now()).slice(-8)}${sequence}`,
          name: `Isolation ${label}`,
        },
      },
      agents: {
        create: {
          name: `Agent ${label}`,
          systemPrompt: 'Only answer from trusted workspace data.',
          active: true,
          requireCustomerInfo: false,
        },
      },
    },
    select: {
      id: true,
      owner: { select: { id: true, phone: true, platformRole: true } },
      agents: { take: 1, select: { id: true } },
    },
  })
  workspaceIds.push(workspace.id)
  const owner = workspace.owner
  const agent = workspace.agents[0]
  if (!owner || !agent) throw new Error('Failed to create isolation subject')

  const conversation = await prisma.conversation.create({
    data: {
      workspaceId: workspace.id,
      agentId: agent.id,
      channel: 'WEB_WIDGET',
      customerInfoState: 'skipped',
      messages: {
        create: [
          { role: 'USER', content: `private-${label}-question` },
          { role: 'ASSISTANT', content: `private-${label}-answer` },
        ],
      },
      messageCount: 2,
      lastMessageAt: new Date(),
    },
    select: { id: true },
  })
  const [, knowledgeBase] = await Promise.all([
    prisma.product.create({
      data: {
        workspaceId: workspace.id,
        name: `Product ${label}`,
        price: sequence * 1000,
        stock: sequence,
        images: [],
        tags: [],
        catalogItems: { create: { agentId: agent.id } },
      },
    }),
    prisma.knowledgeBase.create({
      data: {
        workspaceId: workspace.id,
        agentId: agent.id,
        name: `Knowledge ${label}`,
        type: 'TEXT',
        status: 'READY',
        chunkCount: 1,
        chunks: {
          create: {
            workspaceId: workspace.id,
            agentId: agent.id,
            content: `private-${label}-knowledge`,
          },
        },
      },
    }),
  ])

  return {
    workspaceId: workspace.id,
    actorId: owner.id,
    phone: owner.phone,
    platformRole: owner.platformRole,
    agentId: agent.id,
    conversationId: conversation.id,
    knowledgeBaseId: knowledgeBase.id,
  }
}

async function main() {
  let cleanupVerified = false
  try {
    const [a, b] = await Promise.all([createSubject('A', 1), createSubject('B', 2)])
    const repoA = new WorkspaceVigentoRepository(createWorkspaceVigentoContext({
      id: a.actorId,
      workspaceId: a.workspaceId,
      phone: a.phone,
      platformRole: a.platformRole,
    }, 'isolation-a'))
    const repoB = new WorkspaceVigentoRepository(createWorkspaceVigentoContext({
      id: b.actorId,
      workspaceId: b.workspaceId,
      phone: b.phone,
      platformRole: b.platformRole,
    }, 'isolation-b'))

    const [overviewA, agentsA, knowledgeA, storeA, productsA, foreignConversation, foreignKnowledge] = await Promise.all([
      repoA.getOverview(7),
      repoA.getAgentHealth(7),
      repoA.getKnowledgeStatus(),
      repoA.getStoreHealth(),
      repoA.searchProducts('Product', 'ANY', 20),
      repoA.inspectConversation(b.conversationId),
      repoA.inspectKnowledge(b.knowledgeBaseId),
    ])
    const conversationCountA = Object.values(overviewA.conversations).reduce((sum, count) => sum + count, 0)
    assert(conversationCountA === 1, 'Workspace A aggregate included another workspace')
    assert(agentsA.length === 1 && agentsA[0]?.id === a.agentId, 'Agent query crossed workspace scope')
    assert(knowledgeA.length === 1 && knowledgeA[0]?.name === 'Knowledge A', 'Knowledge query crossed workspace scope')
    assert(storeA.products.total === 1, 'Product aggregate crossed workspace scope')
    assert(productsA.length === 1 && productsA[0]?.name === 'Product A', 'Product search crossed workspace scope')
    assert('error' in foreignConversation && foreignConversation.error === 'NOT_FOUND', 'Foreign conversation existence leaked')
    assert('error' in foreignKnowledge && foreignKnowledge.error === 'NOT_FOUND', 'Foreign knowledge existence leaked')

    let forgedWorkspaceRejected = false
    try {
      await executeWorkspaceVigentoTool(
        repoA,
        'get_workspace_overview',
        JSON.stringify({ days: 7, workspaceId: b.workspaceId }),
      )
    } catch {
      forgedWorkspaceRejected = true
    }
    assert(forgedWorkspaceRejected, 'Forged workspaceId was accepted by a user tool')

    await Promise.all([
      repoA.saveMessage('USER', 'history-only-a'),
      repoB.saveMessage('USER', 'history-only-b'),
    ])
    const [historyA, historyB] = await Promise.all([repoA.loadHistory(), repoB.loadHistory()])
    assert(historyA.some((message) => message.content === 'history-only-a'), 'Workspace A history was not saved')
    assert(!historyA.some((message) => message.content === 'history-only-b'), 'Workspace B history leaked to A')
    assert(historyB.some((message) => message.content === 'history-only-b'), 'Workspace B history was not saved')

    const impersonatedRepoA = new WorkspaceVigentoRepository(createWorkspaceVigentoContext({
      id: a.actorId,
      workspaceId: a.workspaceId,
      phone: a.phone,
      platformRole: a.platformRole,
      impersonatedByAdmin: true,
    }, 'isolation-a-impersonated'))
    await impersonatedRepoA.saveMessage('USER', 'must-not-persist-while-impersonating')
    const [impersonatedHistory, regularHistoryAfterImpersonation] = await Promise.all([
      impersonatedRepoA.loadHistory(),
      repoA.loadHistory(),
    ])
    assert(impersonatedHistory.length === 0, 'Impersonated admin could read user Vigento history')
    assert(
      !regularHistoryAfterImpersonation.some((message) => message.content === 'must-not-persist-while-impersonating'),
      'Impersonated admin wrote to user Vigento history',
    )

    let liveAiToolLoop: boolean | 'skipped' = 'skipped'
    if (process.env.VIGENTO_ISOLATION_AI === '1') {
      assert(getPlatformOpenRouterKey(), 'OPENROUTER_API_KEY is required for live Vigento isolation AI check')
      const liveOverview = await runWorkspaceVigento({
        repository: repoA,
        language: 'fa',
        history: [],
        message: 'در ۷ روز گذشته چند گفتگو داشته‌ام؟ فقط از داده زنده همین فضای کاری پاسخ بده.',
      })
      const liveProduct = await runWorkspaceVigento({
        repository: repoA,
        language: 'fa',
        history: [],
        message: 'قیمت و موجودی Product A را از داده زنده بگو.',
      })
      assert(
        liveOverview.toolNames.includes('get_workspace_overview')
          || liveOverview.toolNames.includes('analyze_own_conversations'),
        'Live agent did not read scoped conversation data',
      )
      assert(liveProduct.toolNames.includes('search_own_products'), 'Live agent did not read the scoped product')
      assert(
        !liveOverview.answer.includes('private-B') && !liveProduct.answer.includes('private-B'),
        'Live agent leaked Workspace B data',
      )
      console.log(JSON.stringify({
        liveToolNames: [...new Set([...liveOverview.toolNames, ...liveProduct.toolNames])],
        liveAnswersGrounded: true,
      }))
      liveAiToolLoop = true
    }

    console.log(JSON.stringify({
      passed: true,
      checks: {
        aggregateIsolation: true,
        agentIsolation: true,
        knowledgeIsolation: true,
        productIsolation: true,
        productSearchIsolation: true,
        foreignKnowledgeIsNotFound: true,
        foreignIdIsNotFound: true,
        forgedWorkspaceRejected: true,
        historyIsolation: true,
        impersonationHistoryDisabled: true,
        liveAiToolLoop,
      },
    }, null, 2))
  } finally {
    if (workspaceIds.length) {
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } })
      const [workspaces, conversations, threads] = await Promise.all([
        prisma.workspace.count({ where: { id: { in: workspaceIds } } }),
        prisma.conversation.count({ where: { workspaceId: { in: workspaceIds } } }),
        prisma.workspaceVigentoThread.count({ where: { workspaceId: { in: workspaceIds } } }),
      ])
      cleanupVerified = workspaces === 0 && conversations === 0 && threads === 0
      console.log(JSON.stringify({ cleanupVerified, removedTemporaryWorkspaces: workspaceIds.length }))
    }
    await prisma.$disconnect()
  }
  if (!cleanupVerified) throw new Error('Temporary isolation artifacts were not fully removed')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
