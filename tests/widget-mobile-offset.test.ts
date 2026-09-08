import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')

describe('web widget mobile bottom offset', () => {
  it('reads, validates, and bounds the optional embed attribute', () => {
    const widget = source('public/widget/loader.src.js')

    expect(widget).toContain("script.getAttribute('data-mobile-bottom-offset')")
    expect(widget).toContain('if (!isFinite(parsed)) return 0')
    expect(widget).toContain('Math.min(320, Math.max(0, parsed))')
  })

  it('adds the host offset to the safe area only at the mobile breakpoint', () => {
    const widget = source('public/widget/loader.src.js')

    expect(widget).toContain("root.style.setProperty('--vgt-mobile-bottom-offset', mobileBottomOffset + 'px')")
    expect(widget).toContain(
      '.vgt-root{bottom:calc(max(16px,env(safe-area-inset-bottom)) + var(--vgt-mobile-bottom-offset,0px));}',
    )
    expect(widget.indexOf('@media (max-width:768px){')).toBeLessThan(
      widget.indexOf('var(--vgt-mobile-bottom-offset,0px)'),
    )
  })

  it('ships the option in the minified artifact and documents the embed API', () => {
    const built = source('public/widget/loader.js')
    const docs = source('lib/docs/content.ts')

    expect(built).toContain('data-mobile-bottom-offset')
    expect(built).toContain('--vgt-mobile-bottom-offset')
    expect(docs).toContain('data-mobile-bottom-offset="88"')
  })
})
