import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    contact: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    conversation: { updateMany: vi.fn(), update: vi.fn() },
    appointment: { updateMany: vi.fn() },
    storeOrder: { updateMany: vi.fn() },
    instagramFollowGate: { updateMany: vi.fn() },
    campaignRecipient: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  }
  class WorkspaceResourceLimitError extends Error {
    constructor(
      public readonly resource: string,
      public readonly limit: number,
    ) {
      super('CUSTOMER_LIMIT')
      this.name = 'WorkspaceResourceLimitError'
    }
  }
  return {
    tx,
    withLocks: vi.fn(),
    getLimit: vi.fn(),
    assertCapacity: vi.fn(),
    WorkspaceResourceLimitError,
  }
})

vi.mock('@/lib/crm/contact-identity-lock', () => ({
  withContactIdentityLocks: mocks.withLocks,
}))

// The plan's customer cap is resolved before the identity lock; keep these
// merge tests off the real database.
vi.mock('@/lib/billing/entitlements', () => ({
  getWorkspaceResourceLimit: mocks.getLimit,
  assertWorkspaceResourceCapacity: mocks.assertCapacity,
  WorkspaceResourceLimitError: mocks.WorkspaceResourceLimitError,
}))

import { resolveInboundContact } from '@/lib/crm/contact-identity'

function contact(id: string, createdAt: string, phone: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: null,
    phone,
    tags: [],
    stage: 'lead',
    notes: null,
    metadata: null,
    createdAt: new Date(createdAt),
    lastActivityAt: null,
    telegramId: null,
    whatsappId: null,
    instagramId: null,
    rubikaId: null,
    baleId: null,
    telegramUsername: null,
    telegramAvatarUrl: null,
    baleUsername: null,
    baleAvatarUrl: null,
    rubikaUsername: null,
    rubikaAvatarUrl: null,
    whatsappName: null,
    whatsappAvatarUrl: null,
    instagramUsername: null,
    instagramAvatarUrl: null,
    marketingOptIn: false,
    marketingOptInAt: null,
    marketingOptOutAt: null,
    ...extra,
  }
}

describe('cross-channel contact identity merge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withLocks.mockImplementation(async (_workspaceId, _identities, operation) => operation(mocks.tx))
    mocks.getLimit.mockResolvedValue({ plan: 'PRO', limit: 1000 })
    mocks.assertCapacity.mockResolvedValue(undefined)
    mocks.tx.campaignRecipient.findMany.mockResolvedValue([])
    mocks.tx.conversation.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.appointment.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.storeOrder.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.instagramFollowGate.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.contact.update.mockResolvedValue({})
    mocks.tx.contact.updateMany.mockResolvedValue({ count: 1 })
  })

  it('merges legacy phone spellings and moves conversations to the oldest contact', async () => {
    const oldest = contact('contact-old', '2026-01-01T00:00:00.000Z', '09128352271', {
      telegramId: 'telegram-1',
    })
    const newest = contact('contact-new', '2026-02-01T00:00:00.000Z', '989128352271', {
      whatsappId: '989128352271',
    })
    const merged = { ...oldest, phone: '09128352271', whatsappId: '989128352271' }

    mocks.tx.contact.findMany
      .mockResolvedValueOnce([{ id: oldest.id }, { id: newest.id }])
      .mockResolvedValueOnce([oldest, newest])
      .mockResolvedValueOnce([merged])

    const id = await resolveInboundContact({
      workspaceId: 'workspace-1',
      channel: 'WHATSAPP',
      senderId: '989128352271',
      senderPhone: '+989128352271',
      senderName: 'Ali',
    })

    expect(id).toBe('contact-old')
    expect(mocks.withLocks).toHaveBeenCalledWith(
      'workspace-1',
      ['WHATSAPP:989128352271', 'phone:09128352271'],
      expect.any(Function),
    )
    expect(mocks.tx.conversation.updateMany).toHaveBeenCalledWith({
      where: { contactId: 'contact-new' },
      data: { contactId: 'contact-old' },
    })
    expect(mocks.tx.contact.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['contact-new'] } },
      data: { deletedAt: expect.any(Date) },
    })
    expect(mocks.tx.contact.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'contact-old' },
      data: expect.objectContaining({
        phone: '09128352271',
        whatsappId: '989128352271',
      }),
    }))
  })

  it('treats canonical phone as primary even when a channel account id changed', async () => {
    const oldest = contact('contact-old', '2026-01-01T00:00:00.000Z', '09128352271', {
      telegramId: 'telegram-old',
    })
    const newest = contact('contact-new', '2026-02-01T00:00:00.000Z', '+989128352271', {
      telegramId: 'telegram-new',
    })
    const merged = { ...oldest, phone: '09128352271', telegramId: 'telegram-new' }

    mocks.tx.contact.findMany
      .mockResolvedValueOnce([{ id: oldest.id }, { id: newest.id }])
      .mockResolvedValueOnce([oldest, newest])
      .mockResolvedValueOnce([merged])

    const id = await resolveInboundContact({
      workspaceId: 'workspace-1',
      channel: 'TELEGRAM',
      senderId: 'telegram-new',
      senderPhone: '09128352271',
    })

    expect(id).toBe('contact-old')
    expect(mocks.tx.conversation.updateMany).toHaveBeenCalledWith({
      where: { contactId: 'contact-new' },
      data: { contactId: 'contact-old' },
    })
    expect(mocks.tx.contact.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'contact-old' },
      data: expect.objectContaining({ telegramId: 'telegram-new', phone: '09128352271' }),
    }))
  })

  it('returns null instead of creating a contact once the plan customer cap is reached', async () => {
    mocks.getLimit.mockResolvedValue({ plan: 'TRIAL', limit: 50 })
    mocks.assertCapacity.mockRejectedValue(new mocks.WorkspaceResourceLimitError('customers', 50))
    mocks.tx.contact.findMany.mockResolvedValueOnce([])

    const id = await resolveInboundContact({
      workspaceId: 'workspace-1',
      channel: 'TELEGRAM',
      senderId: 'telegram-brand-new',
    })

    expect(id).toBeNull()
    expect(mocks.assertCapacity).toHaveBeenCalledWith(mocks.tx, 'workspace-1', 'customers', 50)
    expect(mocks.tx.contact.create).not.toHaveBeenCalled()
  })
})
