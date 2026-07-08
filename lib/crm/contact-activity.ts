import { prisma } from '@/lib/prisma'

/**
 * Bump the contact's denormalized `lastActivityAt` to now.
 *
 * Called from every code path that writes a message (inbound webhook, AI reply,
 * operator dashboard reply, operator Telegram-bot reply) so the contacts list
 * shows the true "last activity" time — the most recent message across any of
 * the contact's conversations — instead of `Contact.updatedAt`, which only
 * changes when the contact row itself is structurally edited.
 *
 * Fire-and-forget: a failure here must never block the message pipeline. The
 * relation filter (`conversations: { some: { id } }`) updates the single
 * contact linked to this conversation (or zero rows when the conversation has
 * no contact, e.g. an anonymous widget visitor).
 */
export function bumpContactActivity(conversationId: string): void {
  prisma.contact
    .updateMany({
      where: { conversations: { some: { id: conversationId } } },
      data: { lastActivityAt: new Date() },
    })
    .catch((e) => console.error('[contact-activity] bump failed:', e))
}
