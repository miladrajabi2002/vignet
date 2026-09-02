import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findWorkspaces: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
  sendActivationComplete: vi.fn(),
  sendActivationReminder: vi.fn(),
  sendTrialExpiring: vi.fn(),
  persistLog: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findMany: mocks.findWorkspaces },
  },
}))

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ set: mocks.redisSet, del: mocks.redisDel }),
}))

vi.mock('@/lib/sms/ippanel', () => ({
  sendActivationCompleteSms: mocks.sendActivationComplete,
  sendActivationReminderSms: mocks.sendActivationReminder,
  sendSubscriptionExpiringSms: vi.fn(),
  sendTrialExpiringSms: mocks.sendTrialExpiring,
}))

vi.mock('@/lib/errors/capture', () => ({
  persistLog: mocks.persistLog,
  captureError: mocks.captureError,
}))

import { runTrialLifecycleSweep } from '@/worker/scheduler'

function stalledWorkspace() {
  const now = Date.now()
  return {
    id: 'workspace-stalled',
    createdAt: new Date(now - 48 * 60 * 60 * 1000),
    onboardingStepUpdatedAt: new Date(now - 25 * 60 * 60 * 1000),
    trialEndsAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
    onboardingStep: 2,
    onboardingCompleted: false,
    owner: { phone: '09128352271' },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findWorkspaces.mockResolvedValue([stalledWorkspace()])
  mocks.redisSet.mockResolvedValue('OK')
  mocks.redisDel.mockResolvedValue(1)
  mocks.persistLog.mockResolvedValue(undefined)
})

describe('trial lifecycle SMS observability', () => {
  it('releases the long-lived dedup claim and records a retry event after failed delivery', async () => {
    mocks.sendActivationReminder.mockResolvedValue(false)

    await runTrialLifecycleSweep()

    expect(mocks.sendActivationReminder).toHaveBeenCalledWith(
      '09128352271',
      { nextStep: 'اتصال اولین کانال' },
      expect.objectContaining({
        workspaceId: 'workspace-stalled',
        metadata: expect.objectContaining({ lifecycleKind: 'activation_reminder' }),
      }),
    )
    expect(mocks.redisDel).toHaveBeenCalledWith('lifecycle_sms:activation_step:workspace-stalled:2')
    expect(mocks.persistLog).toHaveBeenCalledWith(
      'warn',
      'scheduler:trial-lifecycle:retry-enabled',
      'Trial lifecycle SMS failed; deduplication claim was released for retry',
      expect.objectContaining({ workspaceId: 'workspace-stalled' }),
    )
    expect(mocks.persistLog).toHaveBeenCalledWith(
      'info',
      'scheduler:trial-lifecycle:complete',
      'Trial lifecycle sweep completed',
      expect.objectContaining({
        metadata: expect.objectContaining({ attempted: 1, delivered: 0, failed: 1 }),
      }),
    )
  })

  it('keeps the dedup claim and records delivery after provider acceptance', async () => {
    mocks.sendActivationReminder.mockResolvedValue(true)

    await runTrialLifecycleSweep()

    expect(mocks.redisDel).not.toHaveBeenCalled()
    expect(mocks.persistLog).toHaveBeenCalledWith(
      'info',
      'scheduler:trial-lifecycle:delivered',
      'Trial lifecycle SMS delivery was accepted',
      expect.objectContaining({ workspaceId: 'workspace-stalled' }),
    )
  })
})
