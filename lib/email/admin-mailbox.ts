import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getResendClient } from '@/lib/email/resend'

export const ADMIN_MAILBOX_ADDRESS = (
  process.env.ADMIN_MAILBOX_ADDRESS || 'info@vigent.ir'
).trim().toLowerCase()

const ADMIN_MAIL_FROM =
  process.env.ADMIN_MAIL_FROM || 'Vigent <info@vigent.ir>'

export interface InboundEmailEventData {
  email_id: string
  created_at: string
  from: string
  to: string[]
  cc?: string[] | null
  message_id?: string | null
  subject?: string | null
  attachments?: unknown[]
}

function plainPreview(text: string | null | undefined, html: string | null | undefined): string {
  const source = text || html?.replace(/<[^>]*>/g, ' ') || ''
  return source
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280)
}

function bareAddress(value: string): string | null {
  const bracketed = value.match(/<([^<>]+)>/)?.[1]
  const candidate = (bracketed || value).trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null
}

export function isAdminMailboxRecipient(recipients: string[]): boolean {
  return recipients.some((recipient) => bareAddress(recipient) === ADMIN_MAILBOX_ADDRESS)
}

/** Persist one verified Resend inbound event, notify the owner and forward it. */
export async function ingestAdminMailboxEmail(
  event: InboundEmailEventData,
  webhookEventId: string,
): Promise<{ created: boolean; forwarded: boolean }> {
  const resend = getResendClient()
  if (!resend) throw new Error('RESEND_NOT_CONFIGURED')

  const { data: email, error } = await resend.emails.receiving.get(event.email_id)
  if (error || !email) throw new Error(`RESEND_RECEIVE_FAILED:${error?.message || 'unknown'}`)

  let created = false
  let stored = await prisma.adminMailboxMessage.findUnique({
    where: { providerEmailId: event.email_id },
  })

  if (!stored) {
    try {
      stored = await prisma.adminMailboxMessage.create({
        data: {
          providerEmailId: event.email_id,
          webhookEventId,
          messageId: email.message_id || event.message_id || null,
          from: email.from || event.from,
          to: email.to?.length ? email.to : event.to,
          cc: email.cc || event.cc || [],
          replyTo: email.reply_to || [],
          subject: (email.subject || event.subject || '(بدون موضوع)').replace(/[\r\n]+/g, ' ').slice(0, 240),
          text: email.text,
          html: email.html,
          preview: plainPreview(email.text, email.html) || 'پیام بدون متن',
          attachments: (email.attachments || event.attachments || []) as unknown as Prisma.InputJsonValue,
          receivedAt: new Date(email.created_at || event.created_at),
        },
      })
      created = true
    } catch (createError) {
      if (!(createError instanceof Prisma.PrismaClientKnownRequestError) || createError.code !== 'P2002') {
        throw createError
      }
      stored = await prisma.adminMailboxMessage.findUniqueOrThrow({
        where: { providerEmailId: event.email_id },
      })
    }
  }

  if (created) {
    const admin = await prisma.user.findFirst({
      where: { platformRole: 'ADMIN' },
      select: { workspaceId: true },
    })
    if (admin) {
      await prisma.notification.create({
        data: {
          workspaceId: admin.workspaceId,
          type: 'SYSTEM',
          title: `ایمیل جدید: ${stored.subject}`.slice(0, 180),
          body: `${stored.from} — ${stored.preview}`.slice(0, 500),
          link: '/admin/mail',
        },
      }).catch(() => undefined)
    }
  }

  const forwardTo = (process.env.ADMIN_MAIL_FORWARD_TO || process.env.ALERT_EMAIL || '').trim()
  if (!forwardTo || bareAddress(forwardTo) === ADMIN_MAILBOX_ADDRESS || stored.forwardedAt) {
    return { created, forwarded: Boolean(stored.forwardedAt) }
  }

  const forwarded = await resend.emails.receiving.forward({
    emailId: event.email_id,
    to: forwardTo,
    from: ADMIN_MAIL_FROM,
    passthrough: true,
  })
  if (forwarded.error) throw new Error(`RESEND_FORWARD_FAILED:${forwarded.error.message}`)

  await prisma.adminMailboxMessage.update({
    where: { id: stored.id },
    data: { forwardedAt: new Date() },
  })
  return { created, forwarded: true }
}

export async function replyToAdminMailboxMessage(id: string, replyText: string): Promise<void> {
  const resend = getResendClient()
  if (!resend) throw new Error('RESEND_NOT_CONFIGURED')
  const message = await prisma.adminMailboxMessage.findUnique({ where: { id } })
  if (!message) throw new Error('MAIL_NOT_FOUND')

  const recipient = bareAddress(message.replyTo[0] || message.from)
  if (!recipient) throw new Error('MAIL_RECIPIENT_INVALID')
  const subject = /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`
  const headers = message.messageId
    ? { 'In-Reply-To': message.messageId, References: message.messageId }
    : undefined
  const { data, error } = await resend.emails.send({
    from: ADMIN_MAIL_FROM,
    to: recipient,
    subject,
    text: replyText,
    headers,
  })
  if (error || !data) throw new Error(`RESEND_REPLY_FAILED:${error?.message || 'unknown'}`)

  await prisma.adminMailboxMessage.update({
    where: { id },
    data: {
      readAt: message.readAt || new Date(),
      repliedAt: new Date(),
      replyText,
      replyProviderEmailId: data.id,
    },
  })
}
