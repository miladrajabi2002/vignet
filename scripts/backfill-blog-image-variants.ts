/**
 * Builds the mobile / tablet / desktop WebP variants for blog images uploaded
 * before variants existed. Safe to re-run: existing variants are skipped.
 *
 *   npx tsx scripts/backfill-blog-image-variants.ts
 *
 * Not strictly required (the image route builds a missing variant on first
 * request), but running it after deploy means no visitor waits for an encode.
 */
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { BLOG_UPLOAD_DIR, ensureBlogImageVariant } from '@/lib/blog/image-processing'
import { BLOG_IMAGE_WIDTHS, blogImageBaseName } from '@/lib/blog/image-variants'

async function main() {
	const files = await readdir(BLOG_UPLOAD_DIR).catch(() => [] as string[])
	let created = 0
	let originalBytes = 0
	const variantBytes: Record<number, number> = {}
	for (const file of files) {
		const baseName = blogImageBaseName(file)
		if (!baseName) continue
		originalBytes += (await stat(join(BLOG_UPLOAD_DIR, file))).size
		for (const width of BLOG_IMAGE_WIDTHS) {
			const before = Date.now()
			const path = await ensureBlogImageVariant(baseName, width)
			if (!path) continue
			const { size, mtimeMs } = await stat(path)
			if (mtimeMs >= before) created++
			variantBytes[width] = (variantBytes[width] ?? 0) + size
		}
	}
	const kb = (n: number) => `${Math.round(n / 1024)} KB`
	console.log(`created ${created} variants in ${BLOG_UPLOAD_DIR}`)
	console.log(`originals: ${kb(originalBytes)}`)
	for (const width of BLOG_IMAGE_WIDTHS) console.log(`w${width}: ${kb(variantBytes[width] ?? 0)}`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
