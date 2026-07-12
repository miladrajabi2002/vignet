import { z } from 'zod'
import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isMessengerType } from '@/lib/channels/registry'

const campaignChannels = ['TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'RUBIKA', 'BALE'] as const

export const campaignAudienceSchema = z
  .object({
    selectedContactIds: z.array(z.string().min(1)).max(500).optional(),
    filters: z.object({
      stage: z.enum(['lead', 'qualified', 'customer', 'lost']).optional(),
      channel: z.enum(campaignChannels).optional(),
      tag: z.string().max(40).optional(),
      query: z.string().max(120).optional(),
    }).optional(),
  })
  .refine(
    (value) => (value.selectedContactIds?.length ?? 0) > 0 || value.filters != null,
    { message: 'Audience selection is required' },
  )

export type CampaignAudienceInput = z.infer<typeof campaignAudienceSchema>

const channelIdentityField: Record<typeof campaignChannels[number], keyof Prisma.ContactWhereInput> = {
  TELEGRAM: 'telegramId',
  WHATSAPP: 'whatsappId',
  INSTAGRAM: 'instagramId',
  RUBIKA: 'rubikaId',
  BALE: 'baleId',
}

function audienceWhere(
  workspaceId: string,
  input: CampaignAudienceInput,
): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = []
  if (input.selectedContactIds?.length) {
    and.push({ id: { in: [...new Set(input.selectedContactIds)] } })
  } else if (input.filters) {
    if (input.filters.stage) and.push({ stage: input.filters.stage })
    if (input.filters.tag?.trim()) and.push({ tags: { has: input.filters.tag.trim() } })
    if (input.filters.channel) {
      const field = channelIdentityField[input.filters.channel]
      and.push({ [field]: { not: null } } as Prisma.ContactWhereInput)
    }
    const query = input.filters.query?.trim()
    if (query) {
      and.push({
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { tags: { has: query } },
        ],
      })
    }
  }
  return { workspaceId, ...(and.length ? { AND: and } : {}) }
}

export interface EligibleCampaignContact {
  id: string
  name: string | null
  phone: string | null
  conversationId: string
  channel: ChannelType
}

export interface CampaignAudienceResult {
  totalMatched: number
  eligible: EligibleCampaignContact[]
  excludedNoConsent: number
  excludedNoChannel: number
  capped: boolean
}

/**
 * Resolve a frozen audience preview. Eligibility requires explicit consent and
 * a real outbound conversation whose agent still has that channel connected.
 */
export async function resolveCampaignAudience(
  workspaceId: string,
  input: CampaignAudienceInput,
): Promise<CampaignAudienceResult> {
  const contacts = await prisma.contact.findMany({
    where: audienceWhere(workspaceId, input),
    orderBy: [{ lastActivityAt: 'desc' }, { updatedAt: 'desc' }],
    take: 501,
    select: {
      id: true,
      name: true,
      phone: true,
      marketingOptIn: true,
      marketingOptOutAt: true,
      conversations: {
        where: { externalId: { not: null } },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          channel: true,
          agent: {
            select: {
              channels: {
                where: { active: true },
                select: { type: true },
              },
            },
          },
        },
      },
    },
  })

  const capped = contacts.length > 500
  const limited = capped ? contacts.slice(0, 500) : contacts
  const eligible: EligibleCampaignContact[] = []
  let excludedNoConsent = 0
  let excludedNoChannel = 0

  for (const contact of limited) {
    if (!contact.marketingOptIn || contact.marketingOptOutAt) {
      excludedNoConsent++
      continue
    }
    const route = contact.conversations.find(
      (conversation) =>
        isMessengerType(conversation.channel) &&
        conversation.agent.channels.some((channel) => channel.type === conversation.channel),
    )
    if (!route) {
      excludedNoChannel++
      continue
    }
    eligible.push({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      conversationId: route.id,
      channel: route.channel,
    })
  }

  return {
    totalMatched: limited.length,
    eligible,
    excludedNoConsent,
    excludedNoChannel,
    capped,
  }
}

export function safeAudienceSnapshot(input: CampaignAudienceInput) {
  return input.selectedContactIds?.length
    ? { mode: 'selected', selectedCount: new Set(input.selectedContactIds).size }
    : { mode: 'filtered', filters: input.filters ?? {} }
}

