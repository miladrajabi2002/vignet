import { existsSync } from 'fs'
import { rename, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp, { type WebpOptions } from 'sharp'
import {
	BLOG_IMAGE_WIDTHS,
	blogImageVariantFileName,
	type BlogImageWidth,
} from '@/lib/blog/image-variants'

// مسیر مطلق روی دیسک — process.cwd() ریشه پروژه است (PM2 با cwd ریشه اجرا می‌شود)
export const BLOG_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'blog')

const ORIGINAL_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'avif'] as const

// Blog covers are flat illustrations and screenshots; q75 WebP is visually
// lossless for them at a fraction of the PNG size.
const WEBP_OPTIONS: WebpOptions = { quality: 75, effort: 4 }

async function writeVariant(input: Buffer | string, baseName: string, width: BlogImageWidth, dir: string) {
	const target = join(dir, blogImageVariantFileName(baseName, width))
	// Write to a temp name and rename, so a request never reads a half-written file.
	const temp = `${target}.${randomUUID()}.tmp`
	try {
		await sharp(input, { failOn: 'error' })
			.rotate() // honour EXIF orientation from phone photos
			.resize({ width, withoutEnlargement: true })
			.webp(WEBP_OPTIONS)
			.toFile(temp)
		await rename(temp, target)
	} catch (error) {
		await unlink(temp).catch(() => {})
		throw error
	}
	return target
}

/** Generates all device variants for a freshly uploaded original. */
export async function writeBlogImageVariants(input: Buffer, baseName: string, dir = BLOG_UPLOAD_DIR) {
	for (const width of BLOG_IMAGE_WIDTHS) {
		// Sequential on purpose: the server is small and shared with Postgres/Redis.
		await writeVariant(input, baseName, width, dir)
	}
}

function findOriginal(baseName: string, dir: string): string | null {
	for (const ext of ORIGINAL_EXTENSIONS) {
		const path = join(dir, `${baseName}.${ext}`)
		if (existsSync(path)) return path
	}
	return null
}

const inFlight = new Map<string, Promise<string | null>>()

/**
 * Returns the variant's path, generating it from the original on first
 * request. Covers images uploaded before variants existed and any upload whose
 * variant step failed. Concurrent requests share one encode.
 */
export function ensureBlogImageVariant(
	baseName: string,
	width: BlogImageWidth,
	dir = BLOG_UPLOAD_DIR,
): Promise<string | null> {
	const target = join(dir, blogImageVariantFileName(baseName, width))
	if (existsSync(target)) return Promise.resolve(target)

	const pending = inFlight.get(target)
	if (pending) return pending

	const job = (async () => {
		const original = findOriginal(baseName, dir)
		if (!original) return null
		return writeVariant(original, baseName, width, dir)
	})().finally(() => inFlight.delete(target))
	inFlight.set(target, job)
	return job
}
