import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getReceiving: vi.fn(),
  forward: vi.fn(),
  send: vi.fn(),
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  adminFindFirst: vi.fn(),
  notificationCreate: vi.fn(),
}))

vi.mock('@/lib/email/resend', () => ({
  getResendClient: () => ({
    emails: {
      receiving: { get: mocks.getReceiving, forward: mocks.forward },
      send: mocks.send,
    },
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminMailboxMessage: {
      findUnique: mocks.findUnique,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      create: mocks.create,
      update: mocks.update,
    },
    user: { findFirst: mocks.adminFindFirst },
    notification: { create: mocks.notificationCreate },
  },
}))

import {
  ingestAdminMailboxEmail,
  isAdminMailboxRecipient,
  replyToAdminMailboxMessage,
} from '@/lib/email/admin-mailbox'

const stored = {
  id: 'mail-1',
  providerEmailId: 'provider-1',
  from: 'Customer <customer@example.com>',
  replyTo: [],
  subject: 'Need help',
  preview: 'Hello there',
  messageId: '<message-1@example.com>',
  forwardedAt: null,
  readAt: null,
}

describe('admin mailbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ADMIN_MAIL_FORWARD_TO', 'owner@example.com')
    mocks.findUnique.mockResolvedValue(null)
    mocks.getReceiving.mockResolvedValue({
      data: {
        id: 'provider-1',
        from: stored.from,
        to: ['info@vigent.ir'],
        cc: [],
        reply_to: [],
        subject: stored.subject,
        text: 'Hello there',
        html: null,
        message_id: stored.messageId,
        attachments: [],
        created_at: '2026-08-08T10:00:00.000Z',
      },
      error: null,
    })
    mocks.create.mockResolvedValue(stored)
    mocks.adminFindFirst.mockResolvedValue({ workspaceId: 'admin-workspace' })
    mocks.notificationCreate.mockResolvedValue({ id: 'notification-1' })
    mocks.forward.mockResolvedValue({ data: { id: 'forward-1' }, error: null })
    mocks.update.mockResolvedValue(stored)
    mocks.send.mockResolvedValue({ data: { id: 'reply-1' }, error: null })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('accepts only the configured info address', () => {
    expect(isAdminMailboxRecipient(['Info@Vigent.ir'])).toBe(true)
    expect(isAdminMailboxRecipient(['sales@vigent.ir'])).toBe(false)
  })

  it('stores, notifies and forwards a verified inbound email', async () => {
    await expect(ingestAdminMailboxEmail({
      email_id: 'provider-1',
      created_at: '2026-08-08T10:00:00.000Z',
      from: stored.from,
      to: ['info@vigent.ir'],
      subject: stored.subject,
      message_id: stored.messageId,
    }, 'svix-1')).resolves.toEqual({ created: true, forwarded: true })

    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceId: 'admin-workspace', link: '/admin/mail' }),
    })
    expect(mocks.forward).toHaveBeenCalledWith(expect.objectContaining({
      emailId: 'provider-1',
      to: 'owner@example.com',
      passthrough: true,
    }))
  })

  it('replies in the original email thread', async () => {
    mocks.findUnique.mockResolvedValue(stored)
    await replyToAdminMailboxMessage('mail-1', 'Thanks, we are checking this.')
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'customer@example.com',
      subject: 'Re: Need help',
      headers: {
        'In-Reply-To': '<message-1@example.com>',
        References: '<message-1@example.com>',
      },
    }))
  })
})
