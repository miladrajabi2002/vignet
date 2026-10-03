import 'dotenv/config'
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { prisma } from '@/lib/prisma'
import { getAgentCoreReport } from '@/lib/admin/agent-core'

// Explicit opt-in: needs a disposable PostgreSQL with every migration applied.
// The report is platform-wide, so the fixture workspace is report-visible and
// assertions are lower bounds except for the fixture agent's own row.
describe.skipIf(process.env.RUN_AGENT_CORE_DB_TESTS !== '1')('agent-core admin report against PostgreSQL', () => {
  let workspaceId = ''
  let agentId = ''
  beforeAll(async () => {
    const tag = crypto.randomUUID()
    const workspace = await prisma.workspace.create({ data: { name: 'Agent core report test', slug: `agent-core-${tag}`, businessType: 'COMMERCE' } })
    workspaceId = workspace.id
    const agent = await prisma.agent.create({
      data: {
        workspaceId, name: 'Core', systemPrompt: 'x', orderCaptureEnabled: true, payLinkEnabled: true, handoffEnabled: true,
        channels: { create: [{ type: 'WEB_WIDGET', config: {} }] },
      },
    })
    agentId = agent.id
    await prisma.product.createMany({
      data: [
        { workspaceId, name: 'مبل راحتی', price: 15_000_000, stock: 3 },
        { workspaceId, name: 'میز ناهارخوری', price: 9_000_000, stock: 0 },
        { workspaceId, name: 'صندلی', price: 2_000_000 },
      ],
    })
    const conversation = await prisma.conversation.create({ data: { workspaceId, agentId, channel: 'WEB_WIDGET', lastMessageAt: new Date() } })
    const userMessage = await prisma.message.create({ data: { conversationId: conversation.id, role: 'USER', content: 'فردا میرسه دستم؟' } })
    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id, role: 'ASSISTANT', content: 'بله',
          metadata: {
            turnSignal: { v: 1, mood: 'neu', buy: 2, answered: 'y', topic: null, cues: [] },
            turnCost: { v: 1, replyUSD: 0.001, auxUSD: 0.0002, totalUSD: 0.0012, replyModel: 'm', replyTokens: null, calls: [] },
          },
        },
        {
          conversationId: conversation.id, role: 'ASSISTANT', content: 'نمی‌دانم', unanswered: true,
          metadata: { turnSignal: { v: 1, mood: 'neg', buy: 0, answered: 'n', topic: null, cues: [] } },
        },
      ],
    })
    await prisma.usageLog.createMany({
      data: [
        { workspaceId, agentId, conversationId: conversation.id, type: 'CHAT', cost: 0.001, promptTokens: 2000, completionTokens: 150 },
        { workspaceId, agentId, conversationId: conversation.id, type: 'SUMMARY', purpose: 'understand', turnKey: userMessage.id, cost: 0.0002, promptTokens: 1800, completionTokens: 120 },
      ],
    })
    await prisma.turnUnderstandingLog.createMany({
      data: [
        { workspaceId, agentId, conversationId: conversation.id, mode: 'on', status: 'ok', latencyMs: 600, confidence: 0.9, costUSD: 0.0002, acts: ['product_search'], routedDomains: ['products', 'state'], agreed: true },
        {
          workspaceId, agentId, conversationId: conversation.id, messageId: userMessage.id, mode: 'on', status: 'ok', latencyMs: 900, confidence: 0.3,
          acts: ['policy_question'], legacy: { acts: ['booking'] }, diffKinds: ['+general', '-booking'], agreed: false, routedDomains: ['products'],
        },
        { workspaceId, agentId, conversationId: conversation.id, mode: 'on', status: 'fallback', errorCode: 'TIMEOUT', latencyMs: 6000 },
        { workspaceId, agentId, conversationId: conversation.id, mode: 'on', status: 'skipped' },
      ],
    })
    await prisma.conversationSalesInsight.create({ data: { workspaceId, conversationId: conversation.id, satisfaction: 30, buyerProbability: 80 } })
    await prisma.orderDraft.create({ data: { workspaceId, agentId, conversationId: conversation.id, channel: 'WEB_WIDGET', code: `T${tag.slice(0, 8)}`, status: 'SUBMITTED', items: [] } })
  })
  afterAll(async () => {
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  it('aggregates understanding, cost, quality and the exact capabilities of each agent', async () => {
    const report = await getAgentCoreReport(7)
    const u = report.understanding
    expect(u.available).toBe(true)
    expect(u.total).toBeGreaterThanOrEqual(4)
    expect(u.ok).toBeGreaterThanOrEqual(2)
    expect(u.fallback).toBeGreaterThanOrEqual(1)
    expect(u.skipped).toBeGreaterThanOrEqual(1)
    expect(u.lowConfidence).toBeGreaterThanOrEqual(1)
    expect(u.errors.find((row) => row.key === 'TIMEOUT')?.count).toBeGreaterThanOrEqual(1)
    expect(u.acts.map((row) => row.key)).toEqual(expect.arrayContaining(['product_search', 'policy_question']))
    expect(u.routed.map((row) => row.key)).toEqual(expect.arrayContaining(['products', 'state']))
    expect(u.diffs.map((row) => row.key)).toEqual(expect.arrayContaining(['+general', '-booking']))
    expect(u.compared).toBeGreaterThanOrEqual(2)
    expect(u.latencyP95).not.toBeNull()
    const disagreement = u.disagreements.find((row) => row.message === 'فردا میرسه دستم؟')
    expect(disagreement).toMatchObject({ acts: ['policy_question'], legacyActs: ['booking'] })

    expect(report.cost?.turns).toBeGreaterThanOrEqual(1)
    expect(report.cost?.avgTotalUSD).toBeGreaterThan(0)
    expect(report.cost?.purposes.find((row) => row.purpose === 'understand')?.calls).toBeGreaterThanOrEqual(1)
    expect(report.cost?.perReply.current).toBeGreaterThan(0)

    expect(report.quality?.answered.y).toBeGreaterThanOrEqual(1)
    expect(report.quality?.answered.n).toBeGreaterThanOrEqual(1)
    expect(report.quality?.unanswered).toBeGreaterThanOrEqual(1)
    expect(report.quality?.dissatisfied).toBeGreaterThanOrEqual(1)
    expect(report.quality?.hotBuyers).toBeGreaterThanOrEqual(1)
    expect(report.quality?.ordersFiled).toBeGreaterThanOrEqual(1)

    const row = report.agents.find((agent) => agent.id === agentId)
    expect(row).toMatchObject({
      products: 3, inStockProducts: 2, orderCapture: true, payLink: true, handoff: true, channels: ['WEB_WIDGET'], conversations: 1,
    })
  })
})
