import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/blog/helpers'
import { ensureBlogImageVariant, writeBlogImageVariants } from '@/lib/blog/image-processing'
import { blogImageSources, parseBlogImageVariant } from '@/lib/blog/image-variants'

const BASE = '1784500899592-fef93ed2-8f9b-4ecf-9893-caa5138fdea8'

describe('blog image variants', () => {
	it('builds a srcset for uploaded images only', () => {
		expect(blogImageSources(`/api/uploads/blog/${BASE}.png`)).toEqual({
			src: `/api/uploads/blog/${BASE}-w960.webp`,
			srcSet: [480, 960, 1600].map((w) => `/api/uploads/blog/${BASE}-w${w}.webp ${w}w`).join(', '),
		})
		expect(blogImageSources(`https://vigent.ir/uploads/blog/${BASE}.jpg`)?.src).toBe(`/api/uploads/blog/${BASE}-w960.webp`)
		// GIFs keep their animation; external and malformed URLs pass through.
		expect(blogImageSources(`/api/uploads/blog/${BASE}.gif`)).toBeNull()
		expect(blogImageSources('https://cdn.example.com/a.png')).toBeNull()
		expect(blogImageSources('/api/uploads/blog/../../etc/passwd.png')).toBeNull()
		expect(blogImageSources(null)).toBeNull()
	})

	it('parses only known variant widths', () => {
		expect(parseBlogImageVariant(`${BASE}-w480.webp`)).toEqual({ baseName: BASE, width: 480 })
		expect(parseBlogImageVariant(`${BASE}-w123.webp`)).toBeNull()
		expect(parseBlogImageVariant(`${BASE}.png`)).toBeNull()
	})

	it('renders markdown images with srcset and lazy loading', () => {
		const html = renderMarkdown(`![cover](/api/uploads/blog/${BASE}.png)`)
		expect(html).toContain(`srcset="/api/uploads/blog/${BASE}-w480.webp 480w`)
		expect(html).toContain('loading="lazy"')
		expect(renderMarkdown('![x](https://cdn.example.com/a.png)')).toContain('src="https://cdn.example.com/a.png"')
	})

	describe('generation', () => {
		let dir = ''
		afterAll(() => (dir ? rm(dir, { recursive: true, force: true }) : undefined))

		it('writes three WebP sizes without upscaling, and regenerates missing ones', async () => {
			dir = await mkdtemp(join(tmpdir(), 'blog-img-'))
			const png = await sharp({ create: { width: 1200, height: 750, channels: 3, background: '#336699' } }).png().toBuffer()
			await writeFile(join(dir, `${BASE}.png`), png)
			await writeBlogImageVariants(png, BASE, dir)

			expect((await readdir(dir)).sort()).toEqual(
				[`${BASE}-w1600.webp`, `${BASE}-w480.webp`, `${BASE}-w960.webp`, `${BASE}.png`].sort(),
			)
			expect((await sharp(join(dir, `${BASE}-w480.webp`)).metadata()).width).toBe(480)
			expect((await sharp(join(dir, `${BASE}-w1600.webp`)).metadata()).width).toBe(1200)

			await rm(join(dir, `${BASE}-w960.webp`))
			const [a, b] = await Promise.all([ensureBlogImageVariant(BASE, 960, dir), ensureBlogImageVariant(BASE, 960, dir)])
			expect(a).toBe(join(dir, `${BASE}-w960.webp`))
			expect(b).toBe(a)
			expect(await ensureBlogImageVariant('1784500899592-00000000-0000-0000-0000-000000000000', 960, dir)).toBeNull()
		})
	})
})
