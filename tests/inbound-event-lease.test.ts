import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  inboundEvent: {
    updateMany: vi.fn(),
    count: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  InboundEventLeaseLostError,
  type InboundEventLease,
  withInboundEventLease,
} from '@/lib/channels/idempotency'

function lease(): InboundEventLease {
  return {
    id: 'event-1',
    workspaceId: 'workspace-1',
    channelId: 'channel-1',
    externalEventId: 'message-1',
    conversationKey: 'chat-1',
    leaseOwner: 'worker-1',
    leaseToken: 1,
    leaseExpiresAt: new Date(Date.now() + 45_000),
    attempts: 1,
    state: 'PROCESSING',
    payloadHash: 'hash',
    effectsCommittedAt: null,
    deliveryStartedAt: null,
    deliveryCompletedAt: null,
    conversationId: null,
    inboundMessageId: null,
    resultMessageId: null,
    result: null,
  }
}

describe('inbound event lease lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not re-check a lease after a successful callback finalized it', async () => {
    prismaMock.inboundEvent.count.mockResolvedValue(0)

    await expect(
      withInboundEventLease(lease(), async () => 'completed', {
        heartbeatMs: 60_000,
      }),
    ).resolves.toBe('completed')

    expect(prismaMock.inboundEvent.count).not.toHaveBeenCalled()
  })

  it('still fences explicit checks inside the callback', async () => {
    prismaMock.inboundEvent.count.mockResolvedValue(0)

    await expect(
      withInboundEventLease(lease(), async (guard) => {
        await guard.assertActive()
      }, { heartbeatMs: 60_000 }),
    ).rejects.toBeInstanceOf(InboundEventLeaseLostError)
  })
})
