import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('closing CTA (dawn + signature)', () => {
	const cta = read('components/marketing/future-cta.tsx')
	const styles = read('components/marketing/site/site.css')

	it('renders the finished card without JS: nothing is measured or hidden by the component', () => {
		expect(cta).not.toContain('useEffect')
		expect(cta).not.toContain('useState')
		expect(cta).not.toMatch(/opacity-0|style=\{\{[^}]*opacity/)
		// The dark card inverts the shared button pair instead of restyling it.
		expect(cta).toContain('onDark')
		expect(styles).not.toContain('vg-lamp')
	})

	it('signs the closing phrase of every title in both languages', () => {
		// Each variant names a lead and the mark the stroke underlines.
		expect(cta.match(/\blead: '/g)).toHaveLength(6)
		expect(cta.match(/\bmark: '/g)).toHaveLength(6)
		expect(cta).toContain("mark: 'خودت می‌بینی'")
		// The stroke is drawn in the reading direction.
		expect(styles).toContain(":dir(ltr) .vg-sig-ln, [dir='ltr'] .vg-sig-ln { transform: scaleX(-1); }")
	})

	it('arms hidden states only after hydration and plays the entrance from the revealed state', () => {
		const hidden = styles.match(/^.*\.vg-(?:dawn|sig)-[\w-]+ \{.*$/gm)?.filter((rule) => /opacity: 0|mask-size: 0%|inset\(-12px -12px -12px calc/.test(rule)) ?? []
		expect(hidden.length).toBeGreaterThanOrEqual(5)
		for (const rule of hidden) expect(rule.startsWith('.vg-rv-ready .vg-cta:not(.vg-in) ')).toBe(true)
		// Transitions hang on `.vg-in`, so arming the hidden state is instant and
		// a visitor who arrives right after hydration never sees it half-applied.
		const transitions = styles.match(/^.*\.vg-(?:dawn|sig)-[\w-]+ \{ transition.*$/gm) ?? []
		expect(transitions.length).toBeGreaterThanOrEqual(6)
		for (const rule of transitions) expect(rule.startsWith('.vg-rv-ready .vg-cta.vg-in ')).toBe(true)
	})

	it('keeps the phone budget: gradients instead of blur layers, loops inside pausable blocks', () => {
		const dawn = styles.slice(styles.indexOf('Closing CTA: dawn + signature'), styles.indexOf('/* Backlight behind the card'))
		// The one blur is the desktop-only word entrance.
		expect(dawn.match(/blur\(/g)).toHaveLength(1)
		expect(dawn).toContain('@media (min-width: 1024px) { .vg-rv-ready .vg-cta:not(.vg-in) .vg-sig-w { filter: blur(6px); } }')
		expect(cta).toContain('className="vg-dawn-sky vg-anim"')
		expect(cta).toContain('className="vg-sig-star vg-anim"')
	})
})
