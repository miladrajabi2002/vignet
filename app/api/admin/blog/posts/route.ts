import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthed } from '@/lib/admin/auth'
import { blogPostSchema } from '@/lib/blog/validations'
import { slugify, readingMinutes, deriveExcerpt } from '@/lib/blog/helpers'

export const dynamic = 'force-dynamic'

// Admin-guard: 401 if not authed. We do NOT use requireUser() here because the
// admin session is a separate cookie-based system (no OTP / workspace context).
function guard(): NextResponse | null {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  return null
}

export async function GET() {
  const unauth = guard()
  if (unauth) return unauth

  // Show posts across ALL workspaces — admin is a global operator.
  const posts = await prisma.blogPost.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      category: { select: { name: true, slug: true } },
      workspace: { select: { id: true, name: true } },
    },
    take: 200,
  })
  return NextResponse.json({ posts })
}

export async function POST(req: Request) {
  const unauth = guard()
  if (unauth) return unauth

  const json = await req.json().catch(() => null)
  const parsed = blogPostSchema.extend({
    workspaceId: z.string().min(1),
  }).safeParse(json)
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
  const publishedAt =
    input.status === 'PUBLISHED'
      ? input.publishedAt
        ? new Date(input.publishedAt)
        : new Date()
      : input.publishedAt
        ? new Date(input.publishedAt)
        : null

  // Verify the workspace exists so we fail gracefully on a bad id.
  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true },
  })
  if (!ws) {
    return NextResponse.json({ error: 'WORKSPACE_NOT_FOUND' }, { status: 404 })
  }

  try {
    const post = await prisma.blogPost.create({
      data: {
        workspaceId: input.workspaceId,
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
    return NextResponse.json({ error: 'CREATE_FAILED', message: msg }, { status: 500 })
  }
}

// `z` is only used inside POST above; import here to keep it tree-shakeable.
import { z } from 'zod'
