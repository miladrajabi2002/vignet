import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ADMIN_OWNER_PHONE, isAdminAuthed } from '@/lib/admin/auth'
import { executeAdminAction } from '@/lib/admin/vigento-actions'
import { prisma } from '@/lib/prisma'

const schema = z.object({ token: z.string().min(32).max(8_000) })

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  try {
    const result = await executeAdminAction(parsed.data.token)
    if (ADMIN_OWNER_PHONE) {
      await prisma.adminVigentoMessage.create({
        data: {
          adminPhone: ADMIN_OWNER_PHONE,
          role: 'assistant',
          content: 'عملیات انجام شد و رسید آن در تاریخچه مدیریت ثبت شد.',
        },
      }).catch(() => undefined)
    }
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ACTION_FAILED' },
      { status: 400 },
    )
  }
}
