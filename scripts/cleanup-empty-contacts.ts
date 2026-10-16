/**
 * Remove contacts with no name and no phone from the customers list.
 *
 * A customer is someone we can name or reach. Inbound messengers used to file
 * a contact for every new sender — an Instagram DM carries only a sender id
 * and a handle — and the v1 name extractor created contacts for anonymous
 * web-widget visitors. Those rows have no name and no phone: empty «بدون نام»
 * entries in /contacts. A channel id or a handle does not make them customers.
 *
 * This detaches their conversations (a conversation with no contact is the
 * normal state until the visitor gives a name or a phone — applyContactIdentity
 * then files the customer and links the chat's carts, course places and
 * restock requests back to them), unlinks those chat records and follow gates,
 * and soft-deletes the shell. A contact is kept when it has a real business
 * record: a store order, an appointment or a campaign delivery.
 *
 * Dry run (default):  npx tsx -r dotenv/config scripts/cleanup-empty-contacts.ts
 * Apply:              npx tsx -r dotenv/config scripts/cleanup-empty-contacts.ts --apply
 *
 * Reversible: contacts are soft-deleted (`deletedAt`), and every detached
 * (contact → conversations) pair is printed so it can be re-linked.
 */
import { prisma } from '../lib/prisma'

const APPLY = process.argv.includes('--apply')

type Shell = { id: string; workspaceId: string; createdAt: Date }

async function main() {
  const shells = await prisma.$queryRaw<Shell[]>`
    SELECT k.id, k."workspaceId", k."createdAt"
    FROM "Contact" k
    WHERE k."deletedAt" IS NULL
      AND COALESCE(BTRIM(k.name), '') = ''
      AND COALESCE(BTRIM(k.phone), '') = ''
      AND NOT EXISTS (SELECT 1 FROM "StoreOrder" o WHERE o."contactId" = k.id)
      AND NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."contactId" = k.id)
      AND NOT EXISTS (SELECT 1 FROM "CampaignRecipient" r WHERE r."contactId" = k.id)
    ORDER BY k."createdAt"
  `

  console.log(`${shells.length} contact(s) with no name and no phone found${APPLY ? '' : ' (dry run — pass --apply to clean up)'}`)
  let cleaned = 0
  for (const shell of shells) {
    const conversations = await prisma.conversation.findMany({
      where: { contactId: shell.id, deletedAt: undefined },
      select: { id: true, channel: true },
    })
    console.log(
      `  contact ${shell.id} (workspace ${shell.workspaceId}, created ${shell.createdAt.toISOString()})`
      + ` ← conversations: ${conversations.map((c) => `${c.id}[${c.channel}]`).join(', ') || 'none'}`,
    )
    if (!APPLY) continue
    await prisma.$transaction(async (tx) => {
      const unlink = { where: { contactId: shell.id }, data: { contactId: null } }
      await tx.conversation.updateMany({
        where: { contactId: shell.id, deletedAt: undefined },
        data: { contactId: null },
      })
      await tx.orderDraft.updateMany(unlink)
      await tx.courseEnrollment.updateMany(unlink)
      await tx.restockAlert.updateMany(unlink)
      await tx.instagramFollowGate.updateMany(unlink)
      await tx.skillFinding.updateMany(unlink)
      await tx.contact.updateMany({
        where: { id: shell.id, deletedAt: null },
        data: { deletedAt: new Date() },
      })
    })
    cleaned++
  }
  if (APPLY) console.log(`cleaned ${cleaned} contact(s)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('cleanup-empty-contacts failed:', e)
  await prisma.$disconnect()
  process.exit(1)
})
