import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { isAdminAuthedRequest } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ messageId: string }> }

export async function POST(req: Request, props: Params) {
  if (!(await isAdminAuthedRequest(req))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const { messageId } = await props.params
  const updated = await prisma.adminMailboxMessage.updateMany({
    where: { id: messageId, readAt: null },
    data: { readAt: new Date() },
  })
  revalidatePath('/admin', 'layout')
  return NextResponse.json({ ok: true, updated: updated.count })
}
