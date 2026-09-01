import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  checkWorkspaceActive: vi.fn(),
  contactFindFirst: vi.fn(),
  contactCreate: vi.fn(),
  contactFindMany: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/billing/entitlements', () => ({
  checkWorkspaceActive: mocks.checkWorkspaceActive,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      findFirst: mocks.contactFindFirst,
      create: mocks.contactCreate,
      findMany: mocks.contactFindMany,
    },
  },
}))

import { POST } from '@/app/api/contacts/route'
import { GET as EXPORT } from '@/app/api/contacts/export/route'

describe('POST /api/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.checkWorkspaceActive.mockResolvedValue({ allowed: true })
    mocks.contactFindFirst.mockResolvedValue(null)
    mocks.contactCreate.mockResolvedValue({ id: 'contact-new' })
  })

  it('requires an authenticated active workspace', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const response = await POST(
      new Request('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sara' }),
      }),
    )

    expect(response.status).toBe(401)
    expect(mocks.checkWorkspaceActive).not.toHaveBeenCalled()
  })

  it('normalizes phone, deduplicates tags, and records explicit consent', async () => {
    const response = await POST(
      new Request('http://localhost/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '  Sara Ahmadi  ',
          phone: '+98 912 123 4567',
          stage: 'qualified',
          tags: ['vip', 'vip', ' returning '],
          notes: ' Follow up ',
          marketingOptIn: true,
        }),
      }),
    )

    expect(response.status).toBe(201)
    expect(mocks.contactFindFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        phone: {
          in: expect.arrayContaining(['09121234567', '+989121234567']),
        },
      },
      select: { id: true },
    })
    expect(mocks.contactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        name: 'Sara Ahmadi',
        phone: '09121234567',
        stage: 'qualified',
        tags: ['vip', 'returning'],
        notes: 'Follow up',
        marketingOptIn: true,
        marketingOptInAt: expect.any(Date),
      }),
      select: { id: true },
    })
    expect(await response.json()).toEqual({ contact: { id: 'contact-new' } })
  })

  it('rejects duplicate or malformed phone identities', async () => {
    mocks.contactFindFirst.mockResolvedValueOnce({ id: 'contact-existing' })
    const duplicate = await POST(
      new Request('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ phone: '09121234567' }),
      }),
    )
    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toEqual({
      error: 'DUPLICATE_PHONE',
      contactId: 'contact-existing',
    })

    const malformed = await POST(
      new Request('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ phone: 'not-a-phone' }),
      }),
    )
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toEqual({ error: 'INVALID_PHONE' })
  })
})

describe('GET /api/contacts/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.contactFindMany.mockResolvedValue([
      {
        id: 'contact-1',
        name: '=HYPERLINK("https://example.com")',
        phone: '09121234567',
        stage: 'customer',
        tags: ['vip'],
        notes: 'customer note',
        marketingOptIn: true,
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-08-02T10:00:00.000Z'),
        lastActivityAt: null,
        telegramId: null,
        whatsappId: null,
        instagramId: 'instagram-1',
        rubikaId: null,
        baleId: null,
      },
    ])
  })

  it('streams a workspace-scoped, Excel-compatible UTF-8 CSV safely', async () => {
    const response = await EXPORT(
      new Request(
        'http://localhost/api/contacts/export?q=Sara&stage=customer&channel=INSTAGRAM&tag=vip',
      ),
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    const body = new TextDecoder().decode(bytes)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain(
      'vigent-customers-',
    )
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(body).toContain("'=HYPERLINK")
    expect(body).toContain('Instagram')
    expect(mocks.contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          stage: 'customer',
          tags: { has: 'vip' },
          instagramId: { not: null },
          OR: expect.any(Array),
        }),
        take: 1000,
      }),
    )
  })

  it('does not query contact data for anonymous requests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const response = await EXPORT(
      new Request('http://localhost/api/contacts/export'),
    )

    expect(response.status).toBe(401)
    expect(mocks.contactFindMany).not.toHaveBeenCalled()
  })
})
