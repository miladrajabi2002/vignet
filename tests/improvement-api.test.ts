import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ user: vi.fn(), agent: vi.fn(), conversations: vi.fn(), raw: vi.fn(), rate: vi.fn(), start: vi.fn(), preview: vi.fn(), apply: vi.fn(), overview: vi.fn() }))
vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/lib/prisma', () => ({ prisma: { agent: { findFirst: mocks.agent }, conversation: { findMany: mocks.conversations }, $queryRaw: mocks.raw } }))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: mocks.rate }))
vi.mock('@/lib/improvement/service', () => ({ startImprovement: mocks.start, improvementOverview: mocks.overview, publicError: () => 'FAILED' }))
vi.mock('@/lib/improvement/actions', () => ({ previewImprovement: mocks.preview, applyImprovement: mocks.apply }))
import { GET, POST } from '@/app/api/agents/[agentId]/improvement/route'
const props = { params: Promise.resolve({ agentId: 'agent' }) }
const req = (body: unknown) => new Request('http://localhost/api/agents/agent/improvement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
describe('improvement API authorization and cost controls', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: 'owner', workspaceId: 'workspace' }); mocks.agent.mockResolvedValue({ id: 'agent' }); mocks.rate.mockResolvedValue(true) })
  it('rejects unauthenticated reads and writes', async () => {
    mocks.user.mockResolvedValue(null)
    expect((await POST(req({ action: 'start', selection: {} }), props)).status).toBe(401)
    expect((await GET(new Request('http://localhost'), props)).status).toBe(401)
    expect(mocks.start).not.toHaveBeenCalled()
  })
  it('does not access another workspace agent', async () => {
    mocks.agent.mockResolvedValue(null)
    expect((await POST(req({ action: 'preview', id: 'suggestion', version: 1 }), props)).status).toBe(404)
    expect(mocks.agent).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'agent', workspaceId: 'workspace' } }))
    expect(mocks.preview).not.toHaveBeenCalled()
  })
  it('limits AI calls before starting a job', async () => {
    mocks.rate.mockResolvedValue(false)
    expect((await POST(req({ action: 'start', selection: { count: 100 } }), props)).status).toBe(429)
    expect(mocks.start).not.toHaveBeenCalled()
  })
  it('passes only the authenticated owner and validated selection', async () => {
    mocks.start.mockResolvedValue({ id: 'run' })
    expect((await POST(req({ action: 'start', workspaceId: 'foreign', selection: { count: 100 } }), props)).status).toBe(202)
    expect(mocks.start).toHaveBeenCalledWith('workspace', 'agent', 'owner', expect.objectContaining({ count: 100 }))
  })
  it('reports the amount that will be deducted from credit', async () => {
    mocks.conversations.mockResolvedValue([{ id: 'conversation' }])
    mocks.raw.mockResolvedValue([{ chars: 1000n }])
    const response = await POST(req({ action: 'estimate', selection: { count: 1 } }), props)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ count: 1, estimatedCreditIRR: 0 })
  })
  it('requires optimistic version numbers for edits', async () => {
    expect((await POST(req({ action: 'apply', id: 'suggestion' }), props)).status).toBe(400)
    expect(mocks.apply).not.toHaveBeenCalled()
  })
})
