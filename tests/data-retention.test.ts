import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  otpDeleteMany: vi.fn(),
  errorDeleteMany: vi.fn(),
  syncDeleteMany: vi.fn(),
  executeRaw: vi.fn(),
  workspaceFindFirst: vi.fn(),
  workspaceFindMany: vi.fn(),
  workspaceDeleteMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oTPLog: { deleteMany: mocks.otpDeleteMany },
    errorLog: { deleteMany: mocks.errorDeleteMany },
    storeSyncLog: { deleteMany: mocks.syncDeleteMany },
    workspace: {
      findFirst: mocks.workspaceFindFirst,
      findMany: mocks.workspaceFindMany,
      deleteMany: mocks.workspaceDeleteMany,
    },
    $executeRaw: mocks.executeRaw,
  },
}))

import {
  cleanupOldRecords,
  STORE_SYNC_LOGS_PER_INTEGRATION,
} from '@/lib/maintenance/data-retention'

describe('bounded data retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PLATFORM_WORKSPACE_ID', '')
    mocks.otpDeleteMany.mockResolvedValue({ count: 2 })
    mocks.errorDeleteMany.mockResolvedValue({ count: 3 })
    mocks.syncDeleteMany.mockResolvedValue({ count: 4 })
    mocks.executeRaw.mockResolvedValue(5)
    mocks.workspaceFindFirst.mockResolvedValue({ id: 'platform-workspace' })
    mocks.workspaceFindMany.mockResolvedValue([{ id: 'orphan-1' }])
    mocks.workspaceDeleteMany.mockResolvedValue({ count: 1 })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('uses tiered sync-log retention, a hard per-integration cap and safe orphan recheck', async () => {
    const now = new Date('2026-08-08T12:00:00.000Z')
    await expect(cleanupOldRecords(now)).resolves.toEqual({
      otpLogs: 2,
      errorLogs: 3,
      syncLogsByAge: 4,
      syncLogsOverCap: 5,
      orphanWorkspaces: 1,
    })

    expect(mocks.syncDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { outcome: 'ok', createdAt: { lt: new Date('2026-08-01T12:00:00.000Z') } },
          { createdAt: { lt: new Date('2026-07-09T12:00:00.000Z') } },
        ],
      },
    })
    expect(String(mocks.executeRaw.mock.calls[0]?.[0])).toContain('ROW_NUMBER()')
    expect(mocks.executeRaw.mock.calls[0]?.[1]).toBe(STORE_SYNC_LOGS_PER_INTEGRATION)
    expect(mocks.workspaceFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { not: 'platform-workspace' } }),
    }))
    expect(mocks.workspaceDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['orphan-1'] }, owner: { is: null } },
    })
  })
})
