/**
 * Give Instagram DM conversations their customer's name and avatar.
 *
 * Since inbound messengers stopped filing a contact for a sender with no name
 * (an Instagram DM carries only a sender id), the profile fetch that learns the
 * name and avatar never ran for new Instagram senders: their chats showed
 * «کاربر ناشناس» with no picture. And a chat linked to a customer mid-chat (a
 * phone typed into the DM matched an existing profile) never taught that
 * profile the sender id, so the link was lost on the next message.
 *
 * For every live Instagram conversation this:
 *   • with no contact — fetches the sender's profile and files the customer
 *     under that name (or handle) with the avatar, then links the chat;
 *   • linked to a contact with no Instagram id — writes the sender id onto it
 *     (unless another contact of the workspace already holds that id) and
 *     fills its empty Instagram handle and avatar.
 *
 * Dry run (default):  npx tsx -r dotenv/config scripts/backfill-instagram-contacts.ts
 * Apply:              npx tsx -r dotenv/config scripts/backfill-instagram-contacts.ts --apply
 * One workspace:      … --workspace=<workspaceId>
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { resolveInboundContact } from '../lib/crm/contact-identity'
import { cleanContactName } from '../lib/crm/display'
import { fetchInstagramSenderProfile } from '../lib/instagram/sender-profile'

const APPLY = process.argv.includes('--apply')
const WORKSPACE = process.argv.find((arg) => arg.startsWith('--workspace='))?.split('=')[1]

async function senderProfile(configs: Prisma.JsonValue[], senderId: string) {
  for (const config of configs) {
    const profile = await fetchInstagramSenderProfile(config, senderId)
    if (profile) return profile
  }
  return null
}

async function main() {
  const conversations = await prisma.conversation.findMany({
    where: {
      channel: 'INSTAGRAM',
      externalId: { not: null },
      ...(WORKSPACE ? { workspaceId: WORKSPACE } : {}),
      OR: [{ contactId: null }, { contact: { instagramId: null, deletedAt: null } }],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      workspaceId: true,
      agentId: true,
      externalId: true,
      contactId: true,
      contact: { select: { instagramUsername: true, instagramAvatarUrl: true } },
    },
  })
  console.log(`${conversations.length} Instagram conversation(s) to look at${APPLY ? '' : ' (dry run — pass --apply to write)'}`)

  const configsByAgent = new Map<string, Prisma.JsonValue[]>()
  let filed = 0
  let stamped = 0
  let noProfile = 0
  for (const conversation of conversations) {
    const senderId = conversation.externalId!
    if (senderId.startsWith('comment:')) continue
    if (!configsByAgent.has(conversation.agentId)) {
      const channels = await prisma.agentChannel.findMany({
        where: { agentId: conversation.agentId, type: 'INSTAGRAM', active: true },
        orderBy: { createdAt: 'desc' },
        select: { config: true },
      })
      configsByAgent.set(conversation.agentId, channels.map((channel) => channel.config))
    }
    const profile = await senderProfile(configsByAgent.get(conversation.agentId)!, senderId)

    if (!conversation.contactId) {
      const name = cleanContactName(profile?.name) ?? cleanContactName(profile?.username)
      if (!name) {
        noProfile++
        console.log(`  ${conversation.id}: no profile for sender ${senderId}`)
        continue
      }
      console.log(`  ${conversation.id}: file customer (avatar: ${profile?.avatarUrl ? 'yes' : 'no'})`)
      if (!APPLY) continue
      const contactId = await resolveInboundContact({
        workspaceId: conversation.workspaceId,
        channel: 'INSTAGRAM',
        senderId,
        senderName: name,
        senderUsername: profile?.username,
        senderAvatarUrl: profile?.avatarUrl,
      })
      if (!contactId) {
        console.log(`    skipped: workspace ${conversation.workspaceId} is at its customer limit`)
        continue
      }
      await prisma.conversation.updateMany({
        where: { id: conversation.id, contactId: null },
        data: { contactId },
      })
      filed++
      continue
    }

    const holder = await prisma.contact.findFirst({
      where: { workspaceId: conversation.workspaceId, instagramId: senderId },
      select: { id: true },
    })
    if (holder) {
      console.log(`  ${conversation.id}: sender ${senderId} already belongs to contact ${holder.id}, left as is`)
      continue
    }
    console.log(`  ${conversation.id}: write sender id onto contact ${conversation.contactId} (avatar: ${profile?.avatarUrl ? 'yes' : 'no'})`)
    if (!APPLY) continue
    await prisma.contact.updateMany({
      where: { id: conversation.contactId, instagramId: null },
      data: {
        instagramId: senderId,
        ...(!conversation.contact?.instagramUsername && profile?.username
          ? { instagramUsername: profile.username }
          : {}),
        ...(!conversation.contact?.instagramAvatarUrl && profile?.avatarUrl
          ? { instagramAvatarUrl: profile.avatarUrl }
          : {}),
      },
    })
    stamped++
  }

  console.log(
    APPLY
      ? `Done: ${filed} customer(s) filed, ${stamped} contact(s) given their Instagram id, ${noProfile} sender(s) without a profile.`
      : `Dry run: ${noProfile} sender(s) without a profile.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
