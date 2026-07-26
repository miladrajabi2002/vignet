import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  MAX_SHOWCASE_PRODUCTS,
  parseProductShowcaseContent,
} from '@/components/products/product-showcase'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

function marker(product: Record<string, unknown>) {
  return `[[product:${JSON.stringify(product)}]]`
}

describe('product showcase parsing stays server-safe', () => {
  it('is importable outside React so the admin transcript can parse on the server', () => {
    const parser = source('components/products/product-showcase.tsx')

    // A `'use client'` directive here would turn parseProductShowcaseContent()
    // into a client reference and break the admin RSC transcript.
    expect(parser).not.toContain("'use client'")
    expect(parser).not.toContain('lucide-react')
    expect(source('components/products/product-showcase-rail.tsx')).toContain("'use client'")
  })

  it('keeps every product of a multi-product reply up to the cap', () => {
    const raw = `چند گزینه دارم:\n${Array.from({ length: 12 }, (_, index) =>
      marker({ id: `p${index}`, name: `محصول ${index}`, price: 1000 + index }),
    ).join('\n')}`

    const parsed = parseProductShowcaseContent(raw)

    expect(parsed.products).toHaveLength(MAX_SHOWCASE_PRODUCTS)
    expect(parsed.text).toBe('چند گزینه دارم:')
    expect(parsed.products[0].name).toBe('محصول 0')
  })

  it('never renders a non-http product link or image', () => {
    const parsed = parseProductShowcaseContent(
      marker({
        id: 'x1',
        name: 'کیف چرم',
        url: 'javascript:alert(1)',
        image: 'data:image/svg+xml;base64,AAAA',
      }),
    )

    expect(parsed.products[0].productUrl).toBe('')
    expect(parsed.products[0].imageUrl).toBe('')
  })
})

describe('product showcase rail exposes a way to reach hidden cards', () => {
  it('gives the React rail prev/next, a grid toggle and a scroll indicator', () => {
    const rail = source('components/products/product-showcase-rail.tsx')

    expect(rail).toContain('محصول قبلی')
    expect(rail).toContain('محصول بعدی')
    expect(rail).toContain('setExpanded((value) => !value)')
    // `scrollLeft` is negative in RTL: measurement must be sign-agnostic and the
    // buttons must convert back, otherwise "next" scrolls the wrong way in fa.
    expect(rail).toContain('Math.abs(el.scrollLeft)')
    expect(rail).toContain("getComputedStyle(el).direction === 'rtl'")
    expect(rail).toContain('rtl ? -1 : 1')
    // The grid is fluid rather than breakpoint-bound so it fits the widget panel,
    // the operator inbox and a 360px phone without per-surface tuning.
    expect(rail).toContain('repeat(auto-fill,minmax(')
    expect(rail).toContain('aria-expanded={expanded}')
    // Controls must never appear for a single-card reply.
    expect(rail).toContain('const showNav = !expanded && scroll.overflowing')
  })

  it('mirrors the same affordances in the vanilla widget', () => {
    const widget = source('public/widget/loader.js')

    expect(widget).toContain('function createRailShell()')
    expect(widget).toContain('محصول قبلی')
    expect(widget).toContain('همه محصولات')
    expect(widget).toContain('.vgt-card-rail.vgt-grid{display:grid;')
    // The grid override has to beat the mobile `!important` card width.
    expect(widget).toContain('.vgt-card-rail.vgt-grid .vgt-card{width:auto!important;')
    expect(widget).toContain('Math.abs(rail.scrollLeft)')
    expect(widget).toContain("isRtl() ? -1 : 1")
    // One shared resize listener — per-message listeners would leak across a
    // long conversation.
    expect(widget).toContain('var railResizeBound = false')
    expect(widget).toContain('root.querySelectorAll')
    // Touch targets stay ≥40px on phones.
    expect(widget).toContain(".vgt-rail-btn{width:40px!important;height:40px!important;}")
  })

  it('lets every product surface render the rail from one component', () => {
    const chatLink = source('app/c/[slug]/chat-client.tsx')
    const thread = source('components/crm/conversation-thread.tsx')
    const admin = source('app/admin/(dash)/conversations/[conversationId]/page.tsx')

    for (const file of [chatLink, thread, admin]) {
      expect(file).toContain("from '@/components/products/product-showcase-rail'")
      expect(file).toContain('<ProductShowcaseRail')
    }
  })
})
