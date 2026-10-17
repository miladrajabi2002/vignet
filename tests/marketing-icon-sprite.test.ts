import { createElement as h, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Check as LucideCheck } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BaleIcon as InlineBaleIcon } from '@/components/marketing/social-links'

// React only memoizes cache() inside a Server Components render; outside one
// it calls through. Stand in for one page render per test.
const render = vi.hoisted(() => ({ id: 0 }))
vi.mock('react', async (importOriginal) => {
	const react = await importOriginal<typeof import('react')>()
	return {
		...react,
		cache: <T,>(fn: () => T) => {
			let value: { render: number; current: T } | undefined
			return () => (value?.render === render.id ? value : (value = { render: render.id, current: fn() })).current
		},
	}
})
vi.mock('server-only', () => ({}))
beforeEach(() => {
	render.id += 1
})

const { BaleIcon, Check } = await import('@/components/marketing/site/sprite-icons')

describe('homepage icon sprite', () => {
	it('draws each icon once per render and points every copy at it', () => {
		const html = renderToStaticMarkup(
			h(Fragment, null, h(Check, { className: 'size-4', strokeWidth: 1.8 }), h(Check, { className: 'size-5' }), h(BaleIcon, { className: 'size-full' }), h(BaleIcon, { className: 'size-4' })),
		)

		expect(html.match(/<symbol id="vs-check" viewBox="0 0 24 24">/g)).toHaveLength(1)
		expect(html.match(/<symbol id="vs-bale" viewBox="54 4 32 32">/g)).toHaveLength(1)
		expect(html.match(/<use href="#vs-check"><\/use>/g)).toHaveLength(2)
		// Later copies keep lucide's outer attributes, so stroke and size are unchanged.
		expect(html).toContain('<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true"><use href="#vs-check"></use></svg>')
		// <use> fills the viewport from 0 0, so the outer box is the symbol's size.
		expect(html).toContain('<svg viewBox="0 0 32 32" fill="currentColor" class="size-4" aria-hidden="true"><use href="#vs-bale"></use></svg>')
	})

	it('draws the same shapes as the inline icons it replaces', () => {
		const html = renderToStaticMarkup(h(Fragment, null, h(Check, { className: 'size-4' }), h(BaleIcon, { className: 'size-4' })))
		const shapes = (markup: string) => markup.replace(/^<svg[^>]*>|<\/svg>$/g, '')

		expect(html).toContain(`<symbol id="vs-check" viewBox="0 0 24 24">${shapes(renderToStaticMarkup(h(LucideCheck)))}</symbol>`)
		expect(html).toContain(`<symbol id="vs-bale" viewBox="54 4 32 32">${shapes(renderToStaticMarkup(h(InlineBaleIcon)))}</symbol>`)
	})
})
