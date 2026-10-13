import { describe, expect, it } from 'vitest'
import {
  chatLinkOpenState,
  chatLinkUrl,
  normalizeChatLinkSettings,
  normalizeSourceKey,
} from '@/lib/chat-link/config'

describe('chat link settings', () => {
  it('keeps stored links from before the new fields working', () => {
    const settings = normalizeChatLinkSettings({ primaryColor: '#2563EB', leadCapture: true })

    expect(settings.primaryColor).toBe('#2563EB')
    expect(settings.leadCapture).toBe(true)
    expect(settings.logoUrl).toBeNull()
    expect(settings.showcase).toBe(false)
    expect(settings.hoursEnabled).toBe(false)
    expect(settings.sources).toEqual([])
  })

  it('accepts only safe image and action links', () => {
    const settings = normalizeChatLinkSettings({
      logoUrl: 'https://cdn.example.com/logo.png',
      coverUrl: 'javascript:alert(1)',
      mapUrl: 'http://maps.example.com/x',
      website: 'https://shop.example.com',
      instagram: '@my.shop',
      phone: ' 021 1234 5678 ',
    })

    expect(settings.logoUrl).toBe('https://cdn.example.com/logo.png')
    expect(settings.coverUrl).toBeNull()
    expect(settings.mapUrl).toBeNull()
    expect(settings.website).toBe('https://shop.example.com')
    expect(settings.instagram).toBe('my.shop')
    expect(settings.phone).toBe('021 1234 5678')
    // A protocol-relative address is another site, not a path on this one.
    expect(normalizeChatLinkSettings({ logoUrl: '//evil.example/x.png' }).logoUrl).toBeNull()
    expect(normalizeChatLinkSettings({ logoUrl: '/media/products/a.png' }).logoUrl).toBe('/media/products/a.png')
  })

  it('drops incomplete and duplicate tracking links', () => {
    const { sources } = normalizeChatLinkSettings({
      sources: [
        { key: 'IG', label: 'بیو اینستاگرام' },
        { key: 'ig', label: 'تکراری' },
        { key: '', label: 'بدون شناسه' },
        { key: 'sms', label: '' },
        { key: 'bad key', label: 'فاصله‌دار' },
        { key: 'qr', label: 'کد QR' },
      ],
    })

    expect(sources).toEqual([
      { key: 'ig', label: 'بیو اینستاگرام' },
      { key: 'qr', label: 'کد QR' },
    ])
  })

  it('reads a tracking key from the address and builds its link', () => {
    expect(normalizeSourceKey('IG')).toBe('ig')
    expect(normalizeSourceKey('a b')).toBeNull()
    expect(normalizeSourceKey(undefined)).toBeNull()
    expect(chatLinkUrl('golestan', 'ig')).toMatch(/\/c\/golestan\?src=ig$/)
    expect(chatLinkUrl('golestan')).toMatch(/\/c\/golestan$/)
  })

  it('reports opening hours in Tehran time, only when switched on and complete', () => {
    const hours = normalizeChatLinkSettings({ hoursEnabled: true, openAt: '09:00', closeAt: '23:00' })
    // 08:00 UTC = 11:30 Tehran; 20:00 UTC = 23:30 Tehran.
    expect(chatLinkOpenState(hours, new Date('2026-10-13T08:00:00Z'))).toEqual({ open: true, until: '23:00' })
    expect(chatLinkOpenState(hours, new Date('2026-10-13T20:00:00Z'))).toEqual({ open: false, until: '09:00' })

    expect(chatLinkOpenState({ ...hours, hoursEnabled: false }, new Date())).toBeNull()
    expect(chatLinkOpenState(normalizeChatLinkSettings({ hoursEnabled: true, openAt: '9' }), new Date())).toBeNull()
  })
})
