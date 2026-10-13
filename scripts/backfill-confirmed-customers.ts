/**
 * One-time backfill: put the details customers already confirmed in past
 * in-chat orders onto their CRM profile.
 *
 * Before lib/crm/confirmed-customer.ts the name and address a customer gave
 * for an order lived only on the OrderDraft, and a cart opened before the
 * customer was known was never linked to them. This applies the same rules
 * the live flow now follows to the orders that predate it:
 *
 *   • link   — every unlinked cart whose conversation has a customer.
 *   • name   — only from a cart the customer confirmed, only when the profile
 *              has no name, and only when it reads as a person's name.
 *   • address — from the customer's newest confirmed cart.
 *
 * A profile's phone is never changed here (that needs the merge path), and
 * `lastActivityAt` is left alone so the customers list keeps its order.
 *
 * Dry run (default):  npx tsx -r dotenv/config scripts/backfill-confirmed-customers.ts
 * Apply:              npx tsx -r dotenv/config scripts/backfill-confirmed-customers.ts --apply
 *
 * Idempotent. Output carries ids and field names only, never personal values.
 */
import { prisma } from '@/lib/prisma'
import { confirmedPersonName } from '@/lib/crm/confirmed-customer'
import { withContactAddress } from '@/lib/crm/contact-address'
import { cleanContactName } from '@/lib/crm/display'

const APPLY = process.argv.includes('--apply')

/** Statuses a cart only reaches after the customer accepted its summary. */
const CONFIRMED = ['SUBMITTED', 'LINK_SENT', 'PAYMENT_PENDING', 'PAID', 'ON_HOLD', 'PAYMENT_FAILED', 'EXPIRED', 'REFUNDED', 'SUPERSEDED']

async function main() {
  const drafts = await prisma.orderDraft.findMany({
    where: {
      OR: [
        { contactId: null },
        { status: { in: CONFIRMED }, OR: [{ customerName: { not: null } }, { address: { not: null } }, { city: { not: null } }] },
      ],
    },
    // Oldest first: the newest confirmed address is written last and wins.
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, workspaceId: true, status: true, contactId: true,
      customerName: true, city: true, address: true, postalCode: true, province: true,
      conversation: { select: { contactId: true } },
    },
  })

  const totals = { scanned: drafts.length, linked: 0, named: 0, addressed: 0, noCustomer: 0 }
  for (const draft of drafts) {
    const contactId = draft.contactId ?? draft.conversation.contactId
    if (!contactId) {
      totals.noCustomer += 1
      continue
    }
    const actions = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Contact" WHERE id = ${contactId} AND "workspaceId" = ${draft.workspaceId} FOR UPDATE`
      // The soft-delete extension hides trashed profiles: those are skipped.
      const contact = await tx.contact.findFirst({
        where: { id: contactId, workspaceId: draft.workspaceId },
        select: { id: true, name: true, metadata: true },
      })
      if (!contact) return null

      const done: string[] = []
      if (!draft.contactId) {
        if (APPLY) await tx.orderDraft.updateMany({ where: { id: draft.id, contactId: null }, data: { contactId: contact.id } })
        done.push('link')
      }
      if (!CONFIRMED.includes(draft.status)) return done

      const name = cleanContactName(contact.name) ? null : confirmedPersonName(draft.customerName)
      const metadata = withContactAddress(
        contact.metadata,
        { city: draft.city, address: draft.address, postalCode: draft.postalCode, province: draft.province },
        'order',
      )
      if (name) done.push('name')
      if (metadata) done.push('address')
      if (APPLY && (name || metadata)) {
        await tx.contact.update({
          where: { id: contact.id },
          data: { ...(name ? { name } : {}), ...(metadata ? { metadata: metadata as object } : {}) },
        })
      }
      return done
    })

    if (!actions) {
      totals.noCustomer += 1
      continue
    }
    if (!actions.length) continue
    if (actions.includes('link')) totals.linked += 1
    if (actions.includes('name')) totals.named += 1
    if (actions.includes('address')) totals.addressed += 1
    console.log(`  cart ${draft.id} [${draft.status}] → customer ${contactId}: ${actions.join(', ')}`)
  }

  console.log(
    `${APPLY ? 'applied' : 'dry run — pass --apply to write'}: scanned ${totals.scanned} cart(s); `
    + `linked ${totals.linked}, names filled ${totals.named}, addresses written ${totals.addressed}, `
    + `without a customer ${totals.noCustomer}`,
  )
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('backfill-confirmed-customers failed:', error)
  await prisma.$disconnect()
  process.exit(1)
})
