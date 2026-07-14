import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import { executeAdminAction } from '@/lib/admin/vigento-actions'

const schema = z.object({ token: z.string().min(32).max(8_000) })

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, result: await executeAdminAction(parsed.data.token) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ACTION_FAILED' },
      { status: 400 },
    )
  }
}
