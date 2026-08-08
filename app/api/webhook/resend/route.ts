import { NextResponse } from 'next/server'
import { getResendClient } from '@/lib/email/resend'
import {
  ingestAdminMailboxEmail,
  isAdminMailboxRecipient,
  type InboundEmailEventData,
} from '@/lib/email/admin-mailbox'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const resend = getResendClient()
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!resend || !webhookSecret) {
    return NextResponse.json({ error: 'MAILBOX_NOT_CONFIGURED' }, { status: 503 })
  }

  const payload = await req.text()
  const id = req.headers.get('svix-id')
  const timestamp = req.headers.get('svix-timestamp')
  const signature = req.headers.get('svix-signature')
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: 'MISSING_SIGNATURE' }, { status: 400 })
  }

  let event
  try {
    event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    })
  } catch {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })
  }

  if (event.type !== 'email.received') return NextResponse.json({ ok: true, ignored: true })
  const data = event.data as InboundEmailEventData
  if (!isAdminMailboxRecipient(data.to || [])) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const result = await ingestAdminMailboxEmail(data, id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[admin-mailbox] inbound processing failed:', error)
    // Non-2xx asks Resend to retry. Persistence is idempotent by provider id.
    return NextResponse.json({ error: 'MAILBOX_PROCESSING_FAILED' }, { status: 503 })
  }
}
