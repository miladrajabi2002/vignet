import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { channelAvatarFor, channelHandleFor, contactDisplayName } from '@/lib/crm/display'
import { contactAvatarSrc } from '@/lib/crm/avatar'
import { INSTAGRAM_WINDOW_MS } from '@/lib/payments/card/request'

export const dynamic = 'force-dynamic'

/**
 * Customers a payment can be sent to: recent conversations, newest first,
 * searched by name, phone or handle. Instagram threads outside Meta's
 * 24-hour window come back marked, since a card cannot be sent there.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 60) ?? ''
  const contains = (field: string): Prisma.ContactWhereInput => ({ [field]: { contains: q, mode: 'insensitive' } })
  const conversations = await prisma.conversation.findMany({
    where: {
      workspaceId: user.workspaceId,
      deletedAt: null,
      channel: { not: 'WHATSAPP' },
      ...(q ? { contact: { OR: ['name', 'phone', 'instagramUsername', 'telegramUsername', 'baleUsername', 'rubikaUsername'].map(contains) } } : {}),
    },
    orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }],
    take: 8,
    select: {
      id: true,
      channel: true,
      externalId: true,
      contactId: true,
      lastMessageAt: true,
      contact: { select: { name: true, phone: true, telegramUsername: true, telegramAvatarUrl: true, baleUsername: true, baleAvatarUrl: true, rubikaUsername: true, rubikaAvatarUrl: true, whatsappName: true, whatsappAvatarUrl: true, instagramUsername: true, instagramAvatarUrl: true } },
      messages: { where: { role: 'USER' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })
  const now = Date.now()
  return NextResponse.json({
    recipients: conversations.map((conversation) => {
      const contact = conversation.contact
      const handle = contact ? channelHandleFor({ channel: conversation.channel, ...contact }) : null
      const lastUser = conversation.messages[0]?.createdAt
      return {
        conversationId: conversation.id,
        channel: conversation.channel,
        name: contactDisplayName({ name: contact?.name, phone: contact?.phone, handle, channel: conversation.channel, channelId: conversation.externalId, anonymousLabel: 'مشتری' }),
        handle,
        avatar: contactAvatarSrc({ contactId: conversation.contactId, channel: conversation.channel, rawUrl: contact ? channelAvatarFor({ channel: conversation.channel, ...contact }) : null }),
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        blocked: conversation.channel === 'INSTAGRAM' && (!lastUser || now - lastUser.getTime() > INSTAGRAM_WINDOW_MS) ? 'WINDOW_CLOSED' : null,
      }
    }),
  })
}
