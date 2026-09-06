import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { PrismaClient } from '@prisma/client'

// Separate a test Instagram identity from a real store customer, preserving
// the customer's orders and store profile. Also remove the retired unmatched
// automation notifications across workspaces. Dry run unless --apply is set.
// npx tsx scripts/repair-instagram-test-contact.ts --contact-id ID --username HANDLE --name NAME [--apply]
const prisma = new PrismaClient()
const { values } = parseArgs({ options: {
  'contact-id': { type: 'string' },
  username: { type: 'string' },
  name: { type: 'string' },
  apply: { type: 'boolean', default: false },
} })
const include = {
  conversations: { include: { memory: true, salesInsight: true, handoffAlerts: true }, orderBy: { id: 'asc' } },
} as const
const retiredNotification = {
  type: 'HANDOFF' as const,
  title: 'پیام مشتری بدون پاسخ خودکار ماند',
}

async function main() {
  const id = values['contact-id']
  if (!id || !values.username || !values.name?.trim()) throw new Error('contact-id, username and name are required')
  const snapshot = await prisma.contact.findUniqueOrThrow({ where: { id }, include })
  if (!snapshot.instagramId || snapshot.instagramUsername !== values.username) {
    throw new Error('Instagram identity does not match; nothing changed')
  }
  const metadata = snapshot.metadata as Record<string, unknown> | null
  if (metadata?.source !== 'woocommerce' || !snapshot.phone) {
    throw new Error('Expected a store customer with a phone; nothing changed')
  }
  const conversations = snapshot.conversations.filter((c) =>
    c.channel === 'INSTAGRAM' && c.externalId === snapshot.instagramId,
  )
  if (!conversations.length || conversations.length !== snapshot.conversations.filter((c) => c.channel === 'INSTAGRAM').length) {
    throw new Error('Ambiguous Instagram conversations; nothing changed')
  }
  const notifications = await prisma.notification.findMany({ where: retiredNotification, orderBy: { id: 'asc' } })
  console.log(JSON.stringify({ apply: values.apply, conversations: conversations.length, retiredNotifications: notifications.length }))
  if (!values.apply) return

  const directory = '/var/backups/vignet/instagram-test-contact-repair'
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const backup = `${directory}/${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  await writeFile(backup, JSON.stringify({ contact: snapshot, notifications }, null, 2), { mode: 0o600, flag: 'wx' })
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.contact.findUniqueOrThrow({ where: { id }, include })
    if (JSON.stringify(current) !== JSON.stringify(snapshot)) throw new Error('Contact changed after backup; retry')
    const contact = await tx.contact.create({ data: {
      workspaceId: snapshot.workspaceId,
      name: values.name!.trim(),
      instagramId: snapshot.instagramId,
      instagramUsername: snapshot.instagramUsername,
      instagramAvatarUrl: snapshot.instagramAvatarUrl,
      lastActivityAt: snapshot.lastActivityAt,
      tags: [],
    } })
    await tx.contact.update({ where: { id }, data: {
      instagramId: null, instagramUsername: null, instagramAvatarUrl: null,
    } })
    const ids = conversations.map((c) => c.id)
    await tx.conversation.updateMany({ where: { id: { in: ids } }, data: {
      contactId: contact.id, customerInfoState: 'skipped', identifiedAt: null, summary: null,
    } })
    // Invalidate derived identity snapshots; original chat messages stay intact.
    await tx.conversationMemory.deleteMany({ where: { conversationId: { in: ids } } })
    await tx.conversationSalesInsight.deleteMany({ where: { conversationId: { in: ids } } })
    await tx.handoffAlert.updateMany({ where: { conversationId: { in: ids } }, data: {
      contactName: contact.name, contactPhone: null, summary: null,
    } })
    const removed = await tx.notification.deleteMany({ where: {
      ...retiredNotification, id: { in: notifications.map((n) => n.id) },
    } })
    return { contactId: contact.id, movedConversations: ids.length, removedNotifications: removed.count }
  }, { isolationLevel: 'Serializable', timeout: 15_000 })
  await writeFile(`${backup}.result.json`, JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ backup, ...result }))
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
