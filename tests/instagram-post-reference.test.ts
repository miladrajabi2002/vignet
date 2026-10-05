import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  instagramPostShortcode,
  parseInstagramPostReferences,
} from '@/lib/instagram/post-reference'

describe('Instagram post references', () => {
  it('extracts the public shortcode without guessing Meta scoped media ids', () => {
    expect(instagramPostShortcode('DdMvc4dDhai')).toBe('DdMvc4dDhai')
    expect(instagramPostShortcode('178414123456789')).toBeNull()
  })

  it('accepts copied post and reel URL variants, including an optional username path', () => {
    expect(
      parseInstagramPostReferences([
        'https://www.instagram.com/ceeports.shop/p/DdMvc4dDhai/',
        'instagram.com/reel/Cw7hD0qLZ9x/?igsh=share',
      ].join('\n')),
    ).toEqual({
      ids: [],
      shortcodes: ['DdMvc4dDhai', 'Cw7hD0qLZ9x'],
      invalid: [],
    })
  })

  it('keeps numeric ids, removes duplicates and reports unrecognized links', () => {
    expect(
      parseInstagramPostReferences('178414123456789, 178414123456789، instagram.com/example/'),
    ).toEqual({
      ids: ['178414123456789'],
      shortcodes: [],
      invalid: ['instagram.com/example/'],
    })
  })

  it('resolves copied links through Meta and surfaces the follow-gate recommendation', () => {
    const form = readFileSync('components/instagram/automation-form.tsx', 'utf8')
    const manager = readFileSync('components/instagram/automation-manager.tsx', 'utf8')

    expect(form).toContain('/instagram/media/resolve')
    // The manual permalink input is gone — the visual picker is the only way
    // to scope a scenario now (operator request), and its thumbnails load
    // through the same-origin CDN relay so they render without a VPN.
    expect(form).toContain('igProxySrc')
    expect(form).toContain('انتخاب پست از پیج')
    expect(form).not.toContain('افزودن دستی با لینک')
    expect(form).toContain('فعال‌کردن شرط فالو')
    expect(form).toContain('id="automation-follow-gate"')
    // The "new scenario" action lives in the page header now.
    expect(manager).toContain('actions={(')
    expect(manager).toContain('سناریوی جدید')
  })
})
