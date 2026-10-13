import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    contact: { findFirst: vi.fn(), update: vi.fn() },
  }
  return {
    tx,
    contactFindFirst: vi.fn(),
    transaction: vi.fn(),
    applyContactIdentity: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contact: { findFirst: mocks.contactFindFirst },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/crm/contact-identity', () => ({
  applyContactIdentity: mocks.applyContactIdentity,
}))

import { confirmedPersonName, recordConfirmedCustomer } from '@/lib/crm/confirmed-customer'

const base = { workspaceId: 'workspace-1', conversationId: 'conv-1', source: 'order' as const }

describe('confirmedPersonName', () => {
  it('accepts real names', () => {
    expect(confirmedPersonName('علی رضایی')).toBe('علی رضایی')
    expect(confirmedPersonName('  Sara   Ahmadi ')).toBe('Sara Ahmadi')
    expect(confirmedPersonName('هستی')).toBe('هستی')
  })

  it('rejects handles, placeholders and intent phrases', () => {
    expect(confirmedPersonName('milad_rgb')).toBeNull()
    expect(confirmedPersonName('None')).toBeNull()
    expect(confirmedPersonName('شماره تلفن من')).toBeNull()
    expect(confirmedPersonName('🌸')).toBeNull()
    expect(confirmedPersonName('')).toBeNull()
    expect(confirmedPersonName(null)).toBeNull()
  })
})

describe('recordConfirmedCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (operation) => operation(mocks.tx))
    mocks.applyContactIdentity.mockImplementation(async (params) => params.contactId ?? 'contact-created')
    mocks.tx.contact.update.mockResolvedValue({})
  })

  it('gives a name to a profile that only had a phone', async () => {
    // The production case: the order holds «علی رضایی», the customers list
    // showed a bare phone number.
    mocks.contactFindFirst.mockResolvedValue({ name: null, phone: '09128352271' })

    const id = await recordConfirmedCustomer({ ...base, contactId: 'contact-1', name: 'علی رضایی', phone: '+989128352271' })

    expect(id).toBe('contact-1')
    expect(mocks.applyContactIdentity).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
      name: 'علی رضایی',
      // The profile already has a phone: an order for someone else must not
      // replace it or merge two people.
      phone: null,
    })
  })

  it('never replaces a name or phone already on the profile', async () => {
    mocks.contactFindFirst.mockResolvedValue({ name: 'Sara 🌸', phone: '09120000000' })

    const id = await recordConfirmedCustomer({ ...base, contactId: 'contact-1', name: 'علی رضایی', phone: '+989128352271' })

    expect(id).toBe('contact-1')
    expect(mocks.applyContactIdentity).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('adds the phone to a messenger profile that had none', async () => {
    mocks.contactFindFirst.mockResolvedValue({ name: 'Sara', phone: null })

    await recordConfirmedCustomer({ ...base, source: 'booking', contactId: 'contact-1', name: 'سارا احمدی', phone: '+989128352271' })

    expect(mocks.applyContactIdentity).toHaveBeenCalledWith(expect.objectContaining({ name: null, phone: '+989128352271' }))
  })

  it('creates and attaches a profile for a chat that had none', async () => {
    const id = await recordConfirmedCustomer({ ...base, source: 'course', contactId: null, name: 'علی رضایی', phone: '+989128352271' })

    expect(id).toBe('contact-created')
    expect(mocks.contactFindFirst).not.toHaveBeenCalled()
    expect(mocks.applyContactIdentity).toHaveBeenCalledWith(expect.objectContaining({ contactId: null, name: 'علی رضایی', phone: '+989128352271' }))
  })

  it('drops a name that is not a person and still records the phone', async () => {
    mocks.contactFindFirst.mockResolvedValue({ name: null, phone: null })

    await recordConfirmedCustomer({ ...base, contactId: 'contact-1', name: 'سفارش میخوام', phone: '+989128352271' })

    expect(mocks.applyContactIdentity).toHaveBeenCalledWith(expect.objectContaining({ name: null, phone: '+989128352271' }))
  })

  it('writes the confirmed address on the profile the identity resolved to', async () => {
    // The phone matched an older profile: the address belongs on the survivor.
    mocks.contactFindFirst.mockResolvedValue({ name: null, phone: null })
    mocks.applyContactIdentity.mockResolvedValue('contact-old')
    mocks.tx.contact.findFirst.mockResolvedValue({ id: 'contact-old', metadata: { evidenceMemory: {} } })

    const id = await recordConfirmedCustomer({
      ...base,
      contactId: 'contact-1',
      name: 'علی رضایی',
      phone: '+989128352271',
      address: { city: 'تهران', address: 'خیابان ولیعصر، پلاک ۱۰', postalCode: null },
    })

    expect(id).toBe('contact-old')
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(mocks.tx.contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-old' },
      data: {
        metadata: {
          evidenceMemory: {},
          shippingAddress: expect.objectContaining({ city: 'تهران', address: 'خیابان ولیعصر، پلاک ۱۰', source: 'order' }),
        },
      },
    })
  })

  it('writes nothing when the workspace is at its customer limit and the chat has no profile', async () => {
    mocks.applyContactIdentity.mockResolvedValue(null)

    const id = await recordConfirmedCustomer({
      ...base,
      contactId: null,
      name: 'علی رضایی',
      phone: '+989128352271',
      address: { city: 'تهران', address: 'خیابان ولیعصر' },
    })

    expect(id).toBeNull()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
