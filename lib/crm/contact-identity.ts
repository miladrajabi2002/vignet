import type { ChannelType, Prisma } from '@prisma/client'
import { withContactIdentityLocks } from '@/lib/crm/contact-identity-lock'
import {
  contactPhoneLookupVariants,
  normalizeContactPhone,
} from '@/lib/phone'
import {
  assertWorkspaceResourceCapacity,
  getWorkspaceResourceLimit,
  WorkspaceResourceLimitError,
} from '@/lib/billing/entitlements'

type MessengerType = Extract<
  ChannelType,
  'TELEGRAM' | 'BALE' | 'RUBIKA' | 'WHATSAPP' | 'INSTAGRAM'
>

type ContactRow = Awaited<ReturnType<typeof readContactRows>>[number]

function channelIdField(type: MessengerType) {
  switch (type) {
    case 'TELEGRAM': return 'telegramId' as const
    case 'BALE': return 'baleId' as const
    case 'RUBIKA': return 'rubikaId' as const
    case 'WHATSAPP': return 'whatsappId' as const
    case 'INSTAGRAM': return 'instagramId' as const
  }
}

function profileFields(type: MessengerType) {
  switch (type) {
    case 'TELEGRAM': return { username: 'telegramUsername', avatar: 'telegramAvatarUrl' } as const
    case 'BALE': return { username: 'baleUsername', avatar: 'baleAvatarUrl' } as const
    case 'RUBIKA': return { username: 'rubikaUsername', avatar: 'rubikaAvatarUrl' } as const
    case 'WHATSAPP': return { username: 'whatsappName', avatar: 'whatsappAvatarUrl' } as const
    case 'INSTAGRAM': return { username: 'instagramUsername', avatar: 'instagramAvatarUrl' } as const
  }
}

const contactSelect = {
  id: true,
  name: true,
  phone: true,
  tags: true,
  stage: true,
  notes: true,
  metadata: true,
  createdAt: true,
  lastActivityAt: true,
  telegramId: true,
  whatsappId: true,
  instagramId: true,
  rubikaId: true,
  baleId: true,
  telegramUsername: true,
  telegramAvatarUrl: true,
  baleUsername: true,
  baleAvatarUrl: true,
  rubikaUsername: true,
  rubikaAvatarUrl: true,
  whatsappName: true,
  whatsappAvatarUrl: true,
  instagramUsername: true,
  instagramAvatarUrl: true,
  marketingOptIn: true,
  marketingOptInAt: true,
  marketingOptOutAt: true,
} satisfies Prisma.ContactSelect

async function readContactRows(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  ids: string[],
) {
  return tx.contact.findMany({
    where: { workspaceId, id: { in: ids } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: contactSelect,
  })
}

function laterDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

function consentState(rows: ContactRow[]) {
  const optInAt = rows.reduce<Date | null>((value, row) => laterDate(value, row.marketingOptInAt), null)
  const optOutAt = rows.reduce<Date | null>((value, row) => laterDate(value, row.marketingOptOutAt), null)
  return {
    marketingOptIn: optInAt && (!optOutAt || optInAt > optOutAt)
      ? true
      : optOutAt
        ? false
        : rows.some((row) => row.marketingOptIn),
    marketingOptInAt: optInAt,
    marketingOptOutAt: optOutAt,
  }
}

function firstValue<K extends keyof ContactRow>(rows: ContactRow[], key: K): ContactRow[K] {
  return rows.find((row) => row[key] != null && row[key] !== '')?.[key] ?? rows[0][key]
}

async function moveCampaignRecipients(
  tx: Prisma.TransactionClient,
  survivorId: string,
  duplicateId: string,
) {
  const recipients = await tx.campaignRecipient.findMany({
    where: { contactId: duplicateId },
    select: { id: true, campaignId: true },
  })
  for (const recipient of recipients) {
    const existing = await tx.campaignRecipient.findFirst({
      where: { campaignId: recipient.campaignId, contactId: survivorId },
      select: { id: true },
    })
    if (existing) {
      await tx.campaignRecipient.delete({ where: { id: recipient.id } })
    } else {
      await tx.campaignRecipient.update({
        where: { id: recipient.id },
        data: { contactId: survivorId },
      })
    }
  }
}

/**
 * Merge duplicate CRM rows without losing their conversations or downstream
 * campaign/booking/order references. The oldest row survives for stable URLs.
 */
async function mergeContacts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  ids: string[],
  canonicalPhone: string | null,
  preferredId?: string | null,
): Promise<ContactRow> {
  const rows = await readContactRows(tx, workspaceId, [...new Set(ids)])
  if (rows.length === 0) throw new Error('CONTACT_IDENTITY_NOT_FOUND')
  if (rows.length === 1) return rows[0]

  const channelKeys = ['telegramId', 'whatsappId', 'instagramId', 'rubikaId', 'baleId'] as const
  const hasChannelConflict = channelKeys.some((key) => (
    new Set(rows.map((row) => row[key]).filter((value): value is string => Boolean(value))).size > 1
  ))
  if (hasChannelConflict) {
    return rows.find((row) => row.id === preferredId) ?? rows[0]
  }

  const survivor = rows[0]
  const duplicates = rows.slice(1)
  for (const duplicate of duplicates) {
    await moveCampaignRecipients(tx, survivor.id, duplicate.id)
    await Promise.all([
      tx.conversation.updateMany({ where: { contactId: duplicate.id }, data: { contactId: survivor.id } }),
      tx.appointment.updateMany({ where: { contactId: duplicate.id }, data: { contactId: survivor.id } }),
      tx.storeOrder.updateMany({ where: { contactId: duplicate.id }, data: { contactId: survivor.id } }),
      tx.instagramFollowGate.updateMany({ where: { contactId: duplicate.id }, data: { contactId: survivor.id } }),
    ])
  }

  const all = [survivor, ...duplicates]
  const notes = [...new Set(all.map((row) => row.notes?.trim()).filter((value): value is string => Boolean(value)))]
  const consent = consentState(all)
  await tx.contact.update({
    where: { id: survivor.id },
    data: {
      name: firstValue(all, 'name'),
      phone: canonicalPhone ?? normalizeContactPhone(firstValue(all, 'phone')) ?? firstValue(all, 'phone'),
      tags: [...new Set(all.flatMap((row) => row.tags))],
      stage: firstValue(all, 'stage'),
      notes: notes.length ? notes.join('\n\n') : null,
      metadata: firstValue(all, 'metadata') ?? undefined,
      lastActivityAt: all.reduce<Date | null>((value, row) => laterDate(value, row.lastActivityAt), null),
      telegramId: firstValue(all, 'telegramId'),
      whatsappId: firstValue(all, 'whatsappId'),
      instagramId: firstValue(all, 'instagramId'),
      rubikaId: firstValue(all, 'rubikaId'),
      baleId: firstValue(all, 'baleId'),
      telegramUsername: firstValue(all, 'telegramUsername'),
      telegramAvatarUrl: firstValue(all, 'telegramAvatarUrl'),
      baleUsername: firstValue(all, 'baleUsername'),
      baleAvatarUrl: firstValue(all, 'baleAvatarUrl'),
      rubikaUsername: firstValue(all, 'rubikaUsername'),
      rubikaAvatarUrl: firstValue(all, 'rubikaAvatarUrl'),
      whatsappName: firstValue(all, 'whatsappName'),
      whatsappAvatarUrl: firstValue(all, 'whatsappAvatarUrl'),
      instagramUsername: firstValue(all, 'instagramUsername'),
      instagramAvatarUrl: firstValue(all, 'instagramAvatarUrl'),
      ...consent,
    },
  })
  await tx.contact.deleteMany({ where: { id: { in: duplicates.map((row) => row.id) } } })
  const [merged] = await readContactRows(tx, workspaceId, [survivor.id])
  return merged
}

export async function resolveInboundContact(params: {
  workspaceId: string
  channel: MessengerType
  senderId: string
  senderName?: string
  senderPhone?: string
  senderUsername?: string
  senderAvatarUrl?: string
}): Promise<string | null> {
  const canonicalPhone = normalizeContactPhone(params.senderPhone)
  const variants = contactPhoneLookupVariants(canonicalPhone)
  const idField = channelIdField(params.channel)
  const profile = profileFields(params.channel)
  const identities = [
    `${params.channel}:${params.senderId}`,
    ...(canonicalPhone ? [`phone:${canonicalPhone}`] : []),
  ]

  const { limit } = await getWorkspaceResourceLimit(params.workspaceId, 'customers')
  try {
    return await withContactIdentityLocks(params.workspaceId, identities, async (tx) => {
    const candidates = await tx.contact.findMany({
      where: {
        workspaceId: params.workspaceId,
        OR: [
          { [idField]: params.senderId },
          ...(variants.length ? [{ phone: { in: variants } }] : []),
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        telegramId: true,
        whatsappId: true,
        instagramId: true,
        rubikaId: true,
        baleId: true,
      },
    })

    let contactId: string
    if (candidates.length === 0) {
      await assertWorkspaceResourceCapacity(tx, params.workspaceId, 'customers', limit)
      const created = await tx.contact.create({
        data: {
          workspaceId: params.workspaceId,
          name: params.senderName ?? null,
          phone: canonicalPhone,
          [idField]: params.senderId,
          [profile.username]: params.senderUsername ?? undefined,
          [profile.avatar]: params.senderAvatarUrl ?? undefined,
          lastActivityAt: new Date(),
        },
        select: { id: true },
      })
      contactId = created.id
    } else {
      const channelCandidate = candidates.find((candidate) => candidate[idField] === params.senderId)
      const merged = await mergeContacts(
        tx,
        params.workspaceId,
        candidates.map((candidate) => candidate.id),
        canonicalPhone,
        channelCandidate?.id,
      )
      contactId = merged.id
      await tx.contact.update({
        where: { id: contactId },
        data: {
          [idField]: params.senderId,
          ...(canonicalPhone ? { phone: canonicalPhone } : {}),
          ...(!merged.name && params.senderName ? { name: params.senderName } : {}),
          ...(params.senderUsername ? { [profile.username]: params.senderUsername } : {}),
          ...(params.senderAvatarUrl ? { [profile.avatar]: params.senderAvatarUrl } : {}),
          lastActivityAt: new Date(),
        },
      })
    }
    return contactId
    })
  } catch (error) {
    if (error instanceof WorkspaceResourceLimitError) return null
    throw error
  }
}

/** Apply a phone/name learned later in a conversation and merge any duplicate. */
export async function applyContactIdentity(params: {
  workspaceId: string
  conversationId: string
  contactId: string | null
  name: string | null
  phone: string | null
}): Promise<string | null> {
  const canonicalPhone = normalizeContactPhone(params.phone)
  const variants = contactPhoneLookupVariants(canonicalPhone)
  const identities = [
    params.contactId ? `contact:${params.contactId}` : `conversation:${params.conversationId}`,
    ...(canonicalPhone ? [`phone:${canonicalPhone}`] : []),
  ]

  const { limit } = await getWorkspaceResourceLimit(params.workspaceId, 'customers')
  try {
    return await withContactIdentityLocks(params.workspaceId, identities, async (tx) => {
    const candidates = await tx.contact.findMany({
      where: {
        workspaceId: params.workspaceId,
        OR: [
          ...(params.contactId ? [{ id: params.contactId }] : []),
          ...(variants.length ? [{ phone: { in: variants } }] : []),
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    })

    let contactId: string
    if (candidates.length === 0) {
      await assertWorkspaceResourceCapacity(tx, params.workspaceId, 'customers', limit)
      const created = await tx.contact.create({
        data: {
          workspaceId: params.workspaceId,
          name: params.name,
          phone: canonicalPhone,
          lastActivityAt: new Date(),
        },
        select: { id: true },
      })
      contactId = created.id
    } else {
      const merged = await mergeContacts(
        tx,
        params.workspaceId,
        candidates.map((candidate) => candidate.id),
        canonicalPhone,
        params.contactId,
      )
      contactId = merged.id
      await tx.contact.update({
        where: { id: contactId },
        data: {
          ...(!merged.name && params.name ? { name: params.name } : {}),
          ...(canonicalPhone ? { phone: canonicalPhone } : {}),
          lastActivityAt: new Date(),
        },
      })
    }

    await tx.conversation.update({
      where: { id: params.conversationId },
      data: { contactId },
    })
    return contactId
    })
  } catch (error) {
    if (error instanceof WorkspaceResourceLimitError) return null
    throw error
  }
}
