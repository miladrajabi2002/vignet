import { describe, expect, it } from 'vitest'
import { formatContactAddress, readContactAddress, withContactAddress } from '@/lib/crm/contact-address'

const now = new Date('2026-10-13T10:00:00.000Z')

describe('contact delivery address', () => {
  it('writes a confirmed order address without touching other metadata', () => {
    const metadata = withContactAddress(
      { evidenceMemory: { 'agent-1': { facts: [] } } },
      { city: 'تهران', address: '  خیابان ولیعصر،  پلاک ۱۰ ', postalCode: '1234567890' },
      'order',
      now,
    )
    expect(metadata).toEqual({
      evidenceMemory: { 'agent-1': { facts: [] } },
      shippingAddress: {
        city: 'تهران',
        address: 'خیابان ولیعصر، پلاک ۱۰',
        postalCode: '1234567890',
        province: null,
        source: 'order',
        updatedAt: '2026-10-13T10:00:00.000Z',
      },
    })
    expect(readContactAddress(metadata)).toEqual({
      city: 'تهران',
      address: 'خیابان ولیعصر، پلاک ۱۰',
      postalCode: '1234567890',
      province: null,
    })
  })

  it('reports no change for the same address or an empty one', () => {
    const saved = withContactAddress(null, { city: 'تهران', address: 'خیابان ولیعصر' }, 'order', now)
    expect(withContactAddress(saved, { city: 'تهران', address: 'خیابان ولیعصر' }, 'order')).toBeNull()
    expect(withContactAddress(saved, { city: ' ', address: null }, 'order')).toBeNull()
    expect(withContactAddress(saved, null, 'order')).toBeNull()
  })

  it('lets the newest full address supersede the old one', () => {
    const saved = withContactAddress(null, { city: 'تهران', address: 'خیابان ولیعصر', postalCode: '111' }, 'order', now)
    const moved = withContactAddress(saved, { city: 'مشهد', address: 'بلوار وکیل‌آباد' }, 'order', now)
    expect(readContactAddress(moved)).toEqual({ city: 'مشهد', address: 'بلوار وکیل‌آباد', postalCode: null, province: null })
  })

  it('does not let a bare city erase a full address on file', () => {
    const saved = withContactAddress(null, { city: 'تهران', address: 'خیابان ولیعصر', postalCode: '111' }, 'order', now)
    const cityOnly = withContactAddress(saved, { city: 'شیراز' }, 'order', now)
    expect(readContactAddress(cityOnly)).toEqual({ city: 'شیراز', address: 'خیابان ولیعصر', postalCode: '111', province: null })
  })

  it('falls back to the address a WooCommerce sync stored', () => {
    expect(readContactAddress({ billingCity: 'کرج', billingAddress: 'مهرشهر', billingPostcode: '31' })).toEqual({
      city: 'کرج',
      address: 'مهرشهر',
      postalCode: '31',
      province: null,
    })
    expect(readContactAddress({ email: 'a@b.c' })).toBeNull()
    expect(readContactAddress(null)).toBeNull()
  })

  it('formats one display line and never prints the city twice', () => {
    expect(formatContactAddress({ city: 'تهران', address: 'خیابان ولیعصر', postalCode: '111', province: null }, 'کد پستی', 'fa'))
      .toBe('تهران، خیابان ولیعصر · کد پستی: 111')
    expect(formatContactAddress({ city: 'تهران', address: 'تهران، ونک', postalCode: null, province: null }, 'کد پستی', 'fa'))
      .toBe('تهران، ونک')
    expect(formatContactAddress({ city: 'Tehran', address: null, postalCode: null, province: null }, 'Postal code', 'en'))
      .toBe('Tehran')
  })
})
