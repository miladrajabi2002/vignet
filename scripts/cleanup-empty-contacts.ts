/**
 * Remove identity-less contacts from the customers list.
 *
 * A customer is someone we can name or reach. The v1 name extractor mined
 * names out of ordinary prose («من دیروز درخواست دادم…» → contact «دیروز
 * درخو») and created contacts for anonymous web-widget visitors; when those
 * junk names were cleared, the rows stayed behind with no name, no phone and
 * no channel identity — empty «بدون نام» entries in /contacts.
 *
 * This detaches the conversation (an anonymous visitor's conversation has no
 * contact — the normal state for the widget) and soft-deletes the shell. A
 * contact is touched only when it has NOTHING: no name, phone, channel id or
 * username, tags, notes, orders, appointments, campaigns, enrollments, drafts,
 * restock alerts or follow gates.
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
      AND k."telegramId" IS NULL AND k."whatsappId" IS NULL AND k."instagramId" IS NULL
      AND k."rubikaId" IS NULL AND k."baleId" IS NULL
      AND k."telegramUsername" IS NULL AND k."instagramUsername" IS NULL
      AND k."baleUsername" IS NULL AND k."rubikaUsername" IS NULL AND k."whatsappName" IS NULL
      AND COALESCE(CARDINALITY(k.tags), 0) = 0
      AND COALESCE(BTRIM(k.notes), '') = ''
      AND NOT EXISTS (SELECT 1 FROM "StoreOrder" o WHERE o."contactId" = k.id)
      AND NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."contactId" = k.id)
      AND NOT EXISTS (SELECT 1 FROM "CampaignRecipient" r WHERE r."contactId" = k.id)
      AND NOT EXISTS (SELECT 1 FROM "CourseEnrollment" e WHERE e."contactId" = k.id)
      AND NOT EXISTS (SELECT 1 FROM "OrderDraft" d WHERE d."contactId" = k.id)
      AND NOT EXISTS (SELECT 1 FROM "RestockAlert" s WHERE s."contactId" = k.id)
      AND NOT EXISTS (SELECT 1 FROM "InstagramFollowGate" g WHERE g."contactId" = k.id)
    ORDER BY k."createdAt"
  `

  console.log(`${shells.length} identity-less contact(s) found${APPLY ? '' : ' (dry run — pass --apply to clean up)'}`)
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
      await tx.conversation.updateMany({
        where: { contactId: shell.id, deletedAt: undefined },
        data: { contactId: null },
      })
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
