import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { blogPostSchema } from '@/lib/blog/validations'
import { slugify, readingMinutes, deriveExcerpt } from '@/lib/blog/helpers'

type Params = { params: { postId: string } }

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser()
  const post = await prisma.blogPost.findFirst({
    where: { id: params.postId, workspaceId: user.workspaceId },
    include: { category: { select: { name: true, slug: true } } },
  })
  if (!post) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  return NextResponse.json({ post })
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser()
  const existing = await prisma.blogPost.findFirst({
    where: { id: params.postId, workspaceId: user.workspaceId },
    select: { id: true, status: true, publishedAt: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const json = await req.json().catch(() => null)
  const parsed = blogPostSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const input = parsed.data
  const slug = slugify(input.slug || input.title)
  const excerpt = input.excerpt?.trim() || deriveExcerpt(input.content)
  const readingMins = readingMinutes(input.content)

  // If transitioning to PUBLISHED for the first time, stamp publishedAt.
  let publishedAt = existing.publishedAt
  if (input.status === 'PUBLISHED' && !publishedAt) {
    publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date()
  } else if (input.status !== 'PUBLISHED') {
    publishedAt = input.publishedAt ? new Date(input.publishedAt) : publishedAt
  }

  try {
    const post = await prisma.blogPost.update({
      where: { id: params.postId },
      data: {
        categoryId: input.categoryId || null,
        title: input.title,
        slug,
        excerpt,
        content: input.content,
        coverImage: input.coverImage || null,
        status: input.status,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
        seoKeywords: input.seoKeywords,
        canonicalUrl: input.canonicalUrl || null,
        ogImage: input.ogImage || input.coverImage || null,
        featured: input.featured,
        readingMinutes: readingMins,
        publishedAt,
      },
    })
    return NextResponse.json({ post })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    if (msg.includes('unique')) {
      return NextResponse.json(
        { error: 'SLUG_TAKEN', message: 'این slug قبلاً استفاده شده.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'UPDATE_FAILED', message: msg }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser()
  const existing = await prisma.blogPost.findFirst({
    where: { id: params.postId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  await prisma.blogPost.delete({ where: { id: params.postId } })
  return NextResponse.json({ ok: true })
}
