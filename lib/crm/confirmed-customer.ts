import { prisma } from '@/lib/prisma'
import { looksLikePersonName } from '@/lib/ai/customer-identification'
import { applyContactIdentity } from '@/lib/crm/contact-identity'
import { withContactAddress, type ContactAddress } from '@/lib/crm/contact-address'
import { cleanContactName } from '@/lib/crm/display'

/**
 * Details a customer CONFIRMED while buying, booking or enrolling belong on
 * their CRM profile, not only on that one order. Without this a customer who
 * gave «علی رضایی، ۰۹۱۲…» for an order stayed «کاربر اینستاگرام» (or a bare
 * phone number) in the customers list.
 *
 * Deliberately narrower than chat-wide name extraction (see the v1 audit in
 * lib/ai/customer-identification.ts): the name comes from a structured slot
 * the customer saw in a summary and accepted, never from free prose.
 *
 *   • name  — written only when the profile has none. A channel profile name
 *             or one the operator typed is never replaced.
 *   • phone — written only when the profile has none; it goes through the
 *             locked identity path, so a second profile with that number is
 *             merged instead of duplicated.
 *   • address — the newest confirmed delivery address supersedes the old one.
 */

/** A slot value that reads as a person's name, or null. */
export function confirmedPersonName(value: string | null | undefined): string | null {
  const name = cleanContactName(value)?.replace(/\s+/g, ' ') ?? null
  if (!name || !/^[\p{L}\p{M}\s.'\u200c-]{2,60}$/u.test(name)) return null
  return looksLikePersonName(name, { contextual: true }) ? name : null
}

export interface ConfirmedCustomerParams {
  workspaceId: string
  conversationId: string
  contactId: string | null
  name: string | null
  phone: string | null
  address?: Partial<ContactAddress> | null
  source: 'order' | 'booking' | 'course'
}

/**
 * Returns the profile the conversation belongs to afterwards (it can change
 * when the phone matched an older profile), or null when there is none — an
 * anonymous visitor on a workspace that reached its customer limit.
 */
export async function recordConfirmedCustomer(params: ConfirmedCustomerParams): Promise<string | null> {
  const current = params.contactId
    ? await prisma.contact.findFirst({
        where: { id: params.contactId, workspaceId: params.workspaceId },
        select: { name: true, phone: true },
      })
    : null
  const name = current && cleanContactName(current.name) ? null : confirmedPersonName(params.name)
  const phone = current?.phone ? null : params.phone

  const contactId = name || phone
    ? await applyContactIdentity({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        contactId: params.contactId,
        name,
        phone,
      })
    : params.contactId
  if (!contactId || !params.address) return contactId

  // Read-modify-write of the JSON column under a row lock, like every other
  // metadata writer (fact capture, improvement approvals, contact merge).
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Contact" WHERE id = ${contactId} AND "workspaceId" = ${params.workspaceId} FOR UPDATE`
    const contact = await tx.contact.findFirst({
      where: { id: contactId, workspaceId: params.workspaceId },
      select: { id: true, metadata: true },
    })
    if (!contact) return
    const metadata = withContactAddress(contact.metadata, params.address, params.source)
    if (metadata) await tx.contact.update({ where: { id: contact.id }, data: { metadata: metadata as object } })
  })
  return contactId
}
