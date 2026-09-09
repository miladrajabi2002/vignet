import 'dotenv/config'
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ completion: vi.fn(), dispatch: vi.fn(), ingest: vi.fn(), retrieve: vi.fn() }))
vi.mock('@/lib/improvement/model', () => ({ improvementCompletion: mocks.completion, parseModelJson: JSON.parse }))
vi.mock('@/lib/queue/jobs', () => ({ dispatchImprovement: mocks.dispatch, dispatchIngestion: mocks.ingest }))
vi.mock('@/lib/widget/cache', () => ({ invalidateWidgetConfig: vi.fn() }))
vi.mock('@/lib/ai/rag', async (original) => ({ ...await original<typeof import('@/lib/ai/rag')>(), retrieveContext: mocks.retrieve }))
import { prisma } from '@/lib/prisma'
import { startImprovement, retryImprovement, improvementOverview } from '@/lib/improvement/service'
import { processImprovement } from '@/lib/improvement/review'
import { applyImprovement, previewImprovement, revertImprovement, saveImprovementDraft } from '@/lib/improvement/actions'
import { draftSchema, selectionSchema, json } from '@/lib/improvement/types'
import { promptConfigSchema } from '@/lib/validations/agent'

// Explicit opt-in: only disposable, report-excluded fixtures; provider/queue calls are mocked.
describe.skipIf(process.env.RUN_IMPROVEMENT_DB_TESTS !== '1')('durable improvement workflow against PostgreSQL', () => {
  let workspaceId: string, foreignWorkspace: string, userId: string, agentId: string, foreignAgent: string
  const messages: string[] = [], conversations: string[] = []
  beforeAll(async () => {
    const tag = crypto.randomUUID()
    const workspace = await prisma.workspace.create({ data: { name: 'Improvement test', slug: `improvement-test-${tag}`, excludeFromAdminReports: true } }); workspaceId = workspace.id
    const foreign = await prisma.workspace.create({ data: { name: 'Improvement isolation test', slug: `improvement-foreign-${tag}`, excludeFromAdminReports: true } }); foreignWorkspace = foreign.id
    const user = await prisma.user.create({ data: { workspaceId, phone: `test-${tag}` } }); userId = user.id
    const agent = await prisma.agent.create({ data: { workspaceId, name: 'Test', active: false, systemPrompt: 'Test', promptConfig: promptConfigSchema.parse({ personality: 'Customer support', format: { length: 'long' } }) } }); agentId = agent.id
    const other = await prisma.agent.create({ data: { workspaceId: foreignWorkspace, name: 'Other', active: false, systemPrompt: 'Other' } }); foreignAgent = other.id
    for (let i = 0; i < 3; i++) {
      const c = await prisma.conversation.create({ data: { workspaceId, agentId, channel: 'API', lastMessageAt: new Date(), messageCount: 2 } }); conversations.push(c.id)
      const m = await prisma.message.create({ data: { conversationId: c.id, role: 'USER', content: i === 0 ? 'x'.repeat(18000) : 'Please answer briefly', createdAt: new Date(Date.now() - 10000) } }); messages.push(m.id)
      await prisma.message.create({ data: { conversationId: c.id, role: 'ASSISTANT', content: 'An unnecessarily long answer', createdAt: new Date(Date.now() - 9000) } })
    }
    mocks.retrieve.mockResolvedValue({ chunks: [], contextText: '' })
  })
  afterAll(async () => {
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
    if (foreignWorkspace) await prisma.workspace.delete({ where: { id: foreignWorkspace } })
    await prisma.$disconnect()
  })
  it('rejects foreign selection and serializes concurrent starts', async () => {
    const c = await prisma.conversation.create({ data: { workspaceId: foreignWorkspace, agentId: foreignAgent, channel: 'API' } })
    await expect(startImprovement(workspaceId, agentId, userId, selectionSchema.parse({ mode: 'selected', ids: [c.id] }))).rejects.toThrow('NO_CONVERSATIONS')
    const runs = await Promise.allSettled([startImprovement(workspaceId, agentId, userId, selectionSchema.parse({ count: 3 })), startImprovement(workspaceId, agentId, userId, selectionSchema.parse({ count: 3 }))])
    expect(runs.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(runs.filter((r) => r.status === 'rejected')).toHaveLength(1)
  })
  it('reviews complete long transcripts independently, merges repeated remedies, and resumes idempotently', async () => {
    mocks.completion.mockImplementation(async (_w, _a, input) => {
      const data = JSON.parse(input[1].content)
      return JSON.stringify({ intent: 'Short response', intentMessageIds: [data.messages[0].id], outcome: 'UNKNOWN', outcomeMessageIds: [], summary: 'The reply was unnecessarily long.', strengths: [], findings: [{ kind: 'BEHAVIOR', scope: 'AGENT', topicKey: 'reply length', title: 'Shorten replies', diagnosis: 'The same need can be answered briefly.', priority: 'MEDIUM', messageIds: [data.messages[0].id], draft: { behaviorPath: 'format.length', behaviorValue: 'short' } }] })
    })
    const run = await prisma.improvementRun.findFirstOrThrow({ where: { agentId } })
    await processImprovement({ runId: run.id })
    expect(mocks.completion).toHaveBeenCalledTimes(4)
    const reviews = await prisma.improvementReview.findMany({ where: { runId: run.id } })
    expect(reviews.every((r) => r.status === 'DONE')).toBe(true)
    const suggestions = await prisma.improvementSuggestion.findMany({ where: { agentId }, include: { evidence: true } })
    expect(suggestions).toHaveLength(1)
    expect(new Set(suggestions[0].evidence.map((e) => e.reviewId)).size).toBe(3)
    await processImprovement({ runId: run.id })
    expect(mocks.completion).toHaveBeenCalledTimes(4)
  })
  it('tests without future replies, applies once, and restores only the affected setting', async () => {
    const suggestion = await prisma.improvementSuggestion.findFirstOrThrow({ where: { agentId } })
    await expect(applyImprovement(workspaceId, agentId, userId, suggestion.id, 1)).rejects.toThrow('TEST_REQUIRED')
    for (const conversationId of conversations) await prisma.message.create({ data: { conversationId, role: 'ASSISTANT', content: 'FUTURE_OPERATOR_SECRET', metadata: { operator: true } } })
    mocks.completion.mockReset().mockResolvedValueOnce('Short answer').mockResolvedValueOnce(JSON.stringify({ improved: true, reason: 'More concise.' }))
    await previewImprovement(workspaceId, agentId, suggestion.id, 1)
    expect(JSON.stringify(mocks.completion.mock.calls)).not.toContain('FUTURE_OPERATOR_SECRET')
    const change = await applyImprovement(workspaceId, agentId, userId, suggestion.id, 1)
    const monitored = await improvementOverview(workspaceId, agentId, 1, true)
    expect(monitored.suggestions.find((s) => s.id === suggestion.id)?.monitoring).toEqual({ reviewed: 0, recurring: 0 })
    const replay = await applyImprovement(workspaceId, agentId, userId, suggestion.id, 1)
    expect(replay.id).toBe(change.id)
    expect(await prisma.improvementChange.count({ where: { suggestionId: suggestion.id } })).toBe(1)
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } })
    const config = promptConfigSchema.parse(agent.promptConfig)
    expect(config.format.length).toBe('short')
    await prisma.agent.update({ where: { id: agentId }, data: { promptConfig: { ...config, tone: 'A newer unrelated edit' } } })
    await revertImprovement(workspaceId, agentId, change.id)
    const restored = promptConfigSchema.parse((await prisma.agent.findUniqueOrThrow({ where: { id: agentId } })).promptConfig)
    expect(restored.format.length).toBe('long'); expect(restored.tone).toBe('A newer unrelated edit')
  })
  it('does not publish missing facts and durably saves/reverts approved knowledge', async () => {
    const review = await prisma.improvementReview.findFirstOrThrow({ where: { run: { agentId }, conversationId: conversations[1] } })
    const suggestion = await prisma.improvementSuggestion.create({ data: { workspaceId, agentId, kind: 'KNOWLEDGE', topicKey: 'returns', title: 'Returns guide', diagnosis: 'Missing returns guide', priority: 'HIGH',
      draft: json(draftSchema.parse({ question: 'How are returns requested?', missing: 'How should the customer request a return?' })), evidence: { create: { reviewId: review.id, messageId: messages[1] } } } })
    await expect(applyImprovement(workspaceId, agentId, userId, suggestion.id, 1)).rejects.toThrow('MISSING_INFORMATION')
    await saveImprovementDraft(workspaceId, agentId, suggestion.id, 1, draftSchema.parse({ question: 'How are returns requested?', answer: 'Contact support in this conversation to request a return.', missing: '' }))
    mocks.completion.mockReset().mockResolvedValueOnce('Contact support in this conversation.').mockResolvedValueOnce(JSON.stringify({ improved: true, reason: 'Grounded answer.' }))
    await previewImprovement(workspaceId, agentId, suggestion.id, 2)
    const change = await applyImprovement(workspaceId, agentId, userId, suggestion.id, 2)
    const approval = await prisma.knowledgeApproval.findUniqueOrThrow({ where: { knowledgeBaseId: change.targetId! } })
    expect(approval.answer).toContain('Contact support'); expect(mocks.ingest).toHaveBeenCalledWith({ kbId: change.targetId })
    await revertImprovement(workspaceId, agentId, change.id)
    expect((await prisma.knowledgeApproval.findUniqueOrThrow({ where: { id: approval.id } })).validUntil).not.toBeNull()
  })
  it('keeps interrupted jobs retryable without duplicating completed reviews', async () => {
    const run = await startImprovement(workspaceId, agentId, userId, selectionSchema.parse({ count: 1, includeReviewed: true }))
    mocks.completion.mockRejectedValue(new Error('Provider unavailable'))
    await processImprovement({ runId: run.id })
    expect((await prisma.improvementRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe('PARTIAL')
    await retryImprovement(workspaceId, agentId, run.id)
    expect((await prisma.improvementRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe('QUEUED')
    await prisma.improvementRun.update({ where: { id: run.id }, data: { status: 'CANCELLED' } })
    mocks.completion.mockClear()
    await processImprovement({ runId: run.id })
    expect(mocks.completion).not.toHaveBeenCalled()
  })
})
