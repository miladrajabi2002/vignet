import type { Prisma } from '@prisma/client'
import type { Tx } from '@/lib/prisma'

/**
 * Customers vs audience (Contact.identifiedAt).
 *
 * Everyone who messages a connected channel gets a Contact row so the inbox
 * can show their name and photo — a comment that ran an Instagram scenario, a
 * story reply, a one-line «قیمت؟». That is audience. A customer is someone who
 * gave a name or a phone in a conversation, bought, booked, enrolled, was
 * imported, or was added by the owner. Only customers appear in the customers
 * list and count toward the plan's customer limit.
 */
export const CUSTOMER_WHERE = { identifiedAt: { not: null } } satisfies Prisma.ContactWhereInput
export const AUDIENCE_WHERE = { identifiedAt: null } satisfies Prisma.ContactWhereInput

/**
 * Mark a contact as a customer (no-op when it already is). Used where a real
 * business record proves it — a paid order, a booking, a course place — so it
 * deliberately skips the plan-limit check: a buyer is never left out of the
 * customers list because the workspace is at its limit.
 */
export async function markContactIdentified(
  client: Pick<Tx, 'contact'>,
  workspaceId: string,
  contactId: string,
  at = new Date(),
): Promise<void> {
  await client.contact.updateMany({
    where: { id: contactId, workspaceId, identifiedAt: null },
    data: { identifiedAt: at },
  })
}
