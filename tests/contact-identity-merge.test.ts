import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    contact: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
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
  return { tx, withLocks: vi.fn() }
})

vi.mock('@/lib/crm/contact-identity-lock', () => ({
  withContactIdentityLocks: mocks.withLocks,
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
    mocks.tx.campaignRecipient.findMany.mockResolvedValue([])
    mocks.tx.conversation.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.appointment.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.storeOrder.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.instagramFollowGate.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.contact.update.mockResolvedValue({})
    mocks.tx.contact.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('merges legacy phone spellings and moves conversations to the oldest contact', async () => {
    const oldest = contact('contact-old', '2026-01-01T00:00:00.000Z', '09128352271', {
      telegramId: 'telegram-1',
    })
    const newest = contact('contact-new', '2026-02-01T00:00:00.000Z', '989128352271', {
      whatsappId: '989128352271',
    })
    const merged = { ...oldest, phone: '+989128352271', whatsappId: '989128352271' }

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
      ['WHATSAPP:989128352271', 'phone:+989128352271'],
      expect.any(Function),
    )
    expect(mocks.tx.conversation.updateMany).toHaveBeenCalledWith({
      where: { contactId: 'contact-new' },
      data: { contactId: 'contact-old' },
    })
    expect(mocks.tx.contact.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['contact-new'] } },
    })
    expect(mocks.tx.contact.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'contact-old' },
      data: expect.objectContaining({
        phone: '+989128352271',
        whatsappId: '989128352271',
      }),
    }))
  })
})
