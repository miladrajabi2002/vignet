import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const variantSource = (variant: number) => read(`components/marketing/home-variants/v${variant}/page.tsx`)
const routeSource = (variant: number) => read(`app/(marketing)/(home-variants)/${variant}/page.tsx`)

describe('marketing homepage variants', () => {
	it('ships five explicit no-index routes with independent compositions', () => {
		for (let variant = 1; variant <= 5; variant += 1) {
			const routePath = `app/(marketing)/(home-variants)/${variant}/page.tsx`
			const componentPath = `components/marketing/home-variants/v${variant}/page.tsx`
			expect(existsSync(join(root, routePath))).toBe(true)
			expect(existsSync(join(root, componentPath))).toBe(true)
			expect(routeSource(variant)).toContain(`Variant${['One', 'Two', 'Three', 'Four', 'Five'][variant - 1]}Page`)
			expect(routeSource(variant)).toContain('index: false')
			expect(routeSource(variant)).toContain('follow: false')
			expect(routeSource(variant)).toContain('noarchive: true')
		}
	})

	it('keeps the shared navigation anchors on every concept', () => {
		const shared = read('components/marketing/home-variants/shared/primitives.tsx')
		expect(shared).toContain('id="solutions"')
		expect(shared).toContain('id="vigento"')
		expect(shared).toContain('id="pricing"')
		for (let variant = 1; variant <= 5; variant += 1) {
			expect(variantSource(variant)).toContain('id="product"')
			expect(variantSource(variant)).toContain('<CapabilitySection')
			expect(variantSource(variant)).toContain('<OnboardingStory')
			expect(variantSource(variant)).toContain('<PricingPreview')
		}
	})

	it('uses real onboarding and plan purchase routes', () => {
		const shared = read('components/marketing/home-variants/shared/primitives.tsx')
		expect(shared).toContain('href="/login?next=/onboarding"')
		expect(shared).toContain('href={`/login?plan=${plan.key}`}')
		expect(shared).not.toContain('getHomeVariantProps')
		expect(read('components/marketing/home-variants/shared/get-variant-props.ts')).toContain('getEffectivePlanDefs()')
	})

	it('does not advertise a retired WhatsApp connection or sub-nine-pixel copy', () => {
		const source = [
			read('components/marketing/home-variants/shared/content.ts'),
			read('components/marketing/home-variants/shared/primitives.tsx'),
			...Array.from({ length: 5 }, (_, index) => variantSource(index + 1)),
		].join('\n')

		expect(source).not.toMatch(/واتساپ|WhatsApp/i)
		const subNine = [...source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
			.map((match) => Number(match[1]))
			.filter((size) => size < 9)
		expect(subNine).toEqual([])
	})

	it('keeps footer section links on the selected concept', () => {
		const footer = read('components/marketing/footer.tsx')
		expect(footer).toContain("const variantBase = /^\\/[1-5]$/.test(pathname) ? pathname : null")
		expect(footer).toContain('`${variantBase}#product`')
		expect(footer).toContain('`${variantBase}#pricing`')
	})
})
