import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthed } from '@/lib/admin/auth'
import { blogCategorySchema } from '@/lib/blog/validations'
import { slugify } from '@/lib/blog/helpers'

export const dynamic = 'force-dynamic'

function guard(): NextResponse | null {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  return null
}

export async function GET(req: Request) {
  const unauth = guard()
  if (unauth) return unauth

  // Optional ?workspaceId=… filter; otherwise return all categories across workspaces.
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId') ?? undefined

  const categories = await prisma.blogCategory.findMany({
    where: workspaceId ? { workspaceId } : undefined,
    orderBy: { name: 'asc' },
    include: { _count: { select: { posts: true } } },
  })
  return NextResponse.json({ categories })
}

export async function POST(req: Request) {
  const unauth = guard()
  if (unauth) return unauth

  const json = await req.json().catch(() => null)
  const parsed = blogCategorySchema.extend({
    workspaceId: z.string().min(1),
  }).safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const input = parsed.data
  const slug = slugify(input.slug || input.name)
  try {
    const category = await prisma.blogCategory.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        slug,
        description: input.description || null,
      },
    })
    return NextResponse.json({ category })
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

import { z } from 'zod'
