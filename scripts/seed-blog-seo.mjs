// Seeds the 2026-09 SEO articles + the first-customer case study DRAFT.
// Idempotent: posts are matched by (workspaceId, slug) and upserted.
//
// Run on the server (or locally via the DB tunnel):
//   DATABASE_URL="postgres://..." node scripts/seed-blog-seo.mjs
//
// What it does:
//   1. Creates/updates 4 published SEO articles (no cover images — the user
//      will upload covers from the admin blog editor).
//   2. Creates the case study as a DRAFT with placeholders for the customer.
//   3. Appends a "related articles" internal-link block to the 3 oldest
//      short posts (thin-content cross-linking), once only.
// Cover images: upload via /admin/blog editor; recommended 1200x630 (16:10
// also renders fine), <300KB, JPG/WebP.

import { PrismaClient } from '@prisma/client'
import { ARTICLES } from './seo-articles-2026-09.mjs'
import { CASE_STUDY } from './seo-case-study-2026-09.mjs'

const prisma = new PrismaClient()

function readingMinutes(markdown) {
	const words = markdown.split(/\s+/).filter(Boolean).length
	const isFa = /[\u0600-\u06FF]/.test(markdown)
	return Math.max(1, Math.round(words / (isFa ? 220 : 250)))
}

const RELATED_BLOCK = (links) => `
---

## مطالب مرتبط

${links.map((l) => `- [${l.title}](/blog/${l.slug})`).join('\n')}
`

const RELATED_MAP = {
	'telegram-chatbot-for-business-in-10-minutes': [
		{ slug: 'instagram-dm-auto-reply', title: 'پاسخ خودکار به دایرکت اینستاگرام؛ راهنمای کامل' },
		{ slug: 'bale-rubika-chatbot', title: 'چت‌بات بله و روبیکا؛ پشتیبانی در پیام‌رسان‌های ایرانی' },
		{ slug: 'unified-inbox-instagram-whatsapp-telegram', title: 'مدیریت دایرکت و تلگرام در یک پنل' },
	],
	'ai-agent-chist-va-taghir-kasb-o-kar-irani': [
		{ slug: 'ai-sales-agent-for-business', title: 'ایجنت فروش هوش مصنوعی چیست؟' },
		{ slug: 'instagram-crm-for-sales', title: 'CRM اینستاگرام؛ از دایرکت تا سفارش ثبت‌شده' },
		{ slug: 'chatbot-price-and-cost-iran', title: 'قیمت چت‌بات و هزینه راه‌اندازی در ایران' },
	],
	'reduce-customer-support-cost-with-ai-chatbot': [
		{ slug: 'chatbot-price-and-cost-iran', title: 'قیمت چت‌بات و هزینه راه‌اندازی در ایران' },
		{ slug: 'ai-knowledge-base-for-business', title: 'پایگاه دانش هوش مصنوعی چیست؟' },
		{ slug: 'instagram-dm-auto-reply', title: 'پاسخ خودکار به دایرکت اینستاگرام' },
	],
}

async function main() {
	const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
	if (!ws) throw new Error('No workspace found')
	console.log('workspace:', ws.id)

	for (const article of ARTICLES) {
		const data = {
			title: article.title,
			excerpt: article.excerpt,
			content: article.content,
			seoTitle: article.title,
			seoDescription: article.seoDescription,
			seoKeywords: article.seoKeywords,
			status: 'PUBLISHED',
			publishedAt: new Date(),
			readingMinutes: readingMinutes(article.content),
		}
		const post = await prisma.blogPost.upsert({
			where: { workspaceId_slug: { workspaceId: ws.id, slug: article.slug } },
			create: { workspaceId: ws.id, slug: article.slug, ...data },
			update: data,
		})
		console.log(`article: ${post.slug} (${post.status}, ${post.readingMinutes} min)`)
	}

	const csData = {
		title: CASE_STUDY.title,
		excerpt: CASE_STUDY.excerpt,
		content: CASE_STUDY.content,
		seoTitle: CASE_STUDY.title,
		seoDescription: CASE_STUDY.seoDescription,
		seoKeywords: CASE_STUDY.seoKeywords,
		status: 'DRAFT',
		readingMinutes: readingMinutes(CASE_STUDY.content),
	}
	const cs = await prisma.blogPost.upsert({
		where: { workspaceId_slug: { workspaceId: ws.id, slug: CASE_STUDY.slug } },
		create: { workspaceId: ws.id, slug: CASE_STUDY.slug, ...csData },
		// Re-running never overwrites the user's filled-in draft.
		update: { title: csData.title, excerpt: csData.excerpt, seoTitle: csData.seoTitle, seoDescription: csData.seoDescription, seoKeywords: csData.seoKeywords },
	})
	console.log(`case study: ${cs.slug} (${cs.status}, ${cs.readingMinutes} min)`)

	// One-time cross-link block on the 3 oldest (short) posts.
	for (const [slug, links] of Object.entries(RELATED_MAP)) {
		const post = await prisma.blogPost.findFirst({
			where: { workspaceId: ws.id, slug },
			select: { id: true, content: true },
		})
		if (!post) {
			console.log(`related-skip (missing): ${slug}`)
			continue
		}
		if (post.content.includes('## مطالب مرتبط')) {
			console.log(`related-skip (already): ${slug}`)
			continue
		}
		await prisma.blogPost.update({
			where: { id: post.id },
			data: {
				content: post.content.trimEnd() + RELATED_BLOCK(links),
				readingMinutes: readingMinutes(post.content),
			},
		})
		console.log(`related-added: ${slug}`)
	}

	console.log('done.')
}

main()
	.catch((e) => {
		console.error(e)
		process.exitCode = 1
	})
	.finally(() => prisma.$disconnect())
