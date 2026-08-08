import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthedRequest } from '@/lib/admin/auth'
import { replyToAdminMailboxMessage } from '@/lib/email/admin-mailbox'

const schema = z.object({ text: z.string().trim().min(1).max(10_000) })
type Params = { params: Promise<{ messageId: string }> }

export async function POST(req: Request, props: Params) {
  if (!(await isAdminAuthedRequest(req))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const input = schema.safeParse(await req.json().catch(() => null))
  if (!input.success) {
    return NextResponse.json({ error: 'INVALID_REPLY' }, { status: 400 })
  }
  const { messageId } = await props.params
  try {
    await replyToAdminMailboxMessage(messageId, input.data.text)
    revalidatePath('/admin/mail')
    revalidatePath('/admin', 'layout')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[admin-mailbox] reply failed:', error)
    return NextResponse.json({ error: 'REPLY_FAILED' }, { status: 502 })
  }
}
