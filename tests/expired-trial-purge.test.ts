import { beforeEach, describe, expect, it, vi } from 'vitest'

const DAY = 86_400_000
const now = new Date('2026-11-03T10:00:00Z')
const ago = (days: number) => new Date(now.getTime() - days * DAY)

const db = vi.hoisted(() => ({
  candidates: [] as Array<{ id: string; trialPurgeWarnedAt: Date | null; reportEmail: string | null }>,
  lastLoginAt: null as Date | null,
  agentUpdatedAt: null as Date | null,
  workspaceUpdate: vi.fn(),
  conversationUpdateMany: vi.fn(),
  contactUpdateMany: vi.fn(),
  kbDeleteMany: vi.fn(),
  inboundDeleteMany: vi.fn(),
  notify: vi.fn(),
  email: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findFirst: async () => ({ id: 'platform' }),
      findMany: async () => db.candidates,
      update: db.workspaceUpdate,
    },
    user: { findUnique: async () => ({ lastLoginAt: db.lastLoginAt, createdAt: new Date('2026-01-01') }) },
    agent: { aggregate: async () => ({ _max: { updatedAt: db.agentUpdatedAt } }) },
    knowledgeBase: { findMany: async () => [], deleteMany: db.kbDeleteMany },
    inboundEvent: { deleteMany: db.inboundDeleteMany },
  },
  prismaRaw: {
    conversation: { updateMany: db.conversationUpdateMany },
    contact: { updateMany: db.contactUpdateMany },
  },
}))
vi.mock('@/lib/notifications/create', () => ({ notifyWorkspace: db.notify }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: db.email }))
vi.mock('@/lib/storage', () => ({ BUCKETS: { knowledge: 'k' }, deleteFile: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn() }))

const { sweepExpiredTrials } = await import('@/lib/maintenance/expired-trial-purge')

beforeEach(() => {
  vi.clearAllMocks()
  db.lastLoginAt = ago(45)
  db.agentUpdatedAt = ago(50)
})

describe('expired-trial purge', () => {
  it('warns an idle expired trial first and deletes nothing', async () => {
    db.candidates = [{ id: 'w1', trialPurgeWarnedAt: null, reportEmail: 'o@shop.ir' }]
    expect(await sweepExpiredTrials(now)).toEqual({ warned: 1, cancelled: 0, purged: 0 })
    expect(db.workspaceUpdate).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { trialPurgeWarnedAt: now } })
    expect(db.notify).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'w1', title: expect.stringContaining('۳۰ روز دیگر') }))
    expect(db.email).toHaveBeenCalledTimes(1)
    expect(db.conversationUpdateMany).not.toHaveBeenCalled()
  })

  it('leaves an owner who was active in the last 30 days alone', async () => {
    db.candidates = [{ id: 'w1', trialPurgeWarnedAt: null, reportEmail: null }]
    db.agentUpdatedAt = ago(3)
    expect(await sweepExpiredTrials(now)).toEqual({ warned: 0, cancelled: 0, purged: 0 })
    expect(db.notify).not.toHaveBeenCalled()
  })

  it('cancels the warning when the owner comes back', async () => {
    db.candidates = [{ id: 'w1', trialPurgeWarnedAt: ago(10), reportEmail: null }]
    db.lastLoginAt = ago(2)
    expect(await sweepExpiredTrials(now)).toEqual({ warned: 0, cancelled: 1, purged: 0 })
    expect(db.workspaceUpdate).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { trialPurgeWarnedAt: null } })
  })

  it('waits the full 30 days after the warning', async () => {
    db.candidates = [{ id: 'w1', trialPurgeWarnedAt: ago(29), reportEmail: null }]
    expect(await sweepExpiredTrials(now)).toEqual({ warned: 0, cancelled: 0, purged: 0 })
  })

  it('then trashes conversations and customers and deletes knowledge and events', async () => {
    db.candidates = [{ id: 'w1', trialPurgeWarnedAt: ago(31), reportEmail: null }]
    expect(await sweepExpiredTrials(now)).toEqual({ warned: 0, cancelled: 0, purged: 1 })
    expect(db.conversationUpdateMany).toHaveBeenCalledWith({ where: { workspaceId: 'w1', deletedAt: null }, data: { deletedAt: now } })
    expect(db.contactUpdateMany).toHaveBeenCalledWith({ where: { workspaceId: 'w1', deletedAt: null }, data: { deletedAt: now } })
    expect(db.kbDeleteMany).toHaveBeenCalledWith({ where: { workspaceId: 'w1' } })
    expect(db.inboundDeleteMany).toHaveBeenCalledWith({ where: { workspaceId: 'w1' } })
    expect(db.workspaceUpdate).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { trialDataPurgedAt: now } })
  })
})
