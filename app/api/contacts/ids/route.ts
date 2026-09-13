import { NextResponse } from 'next/server'
import type { ChannelType, Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { contactPhoneLookupVariants } from '@/lib/phone'

export const dynamic = 'force-dynamic'

/**
 * Ids of every contact matching the CURRENT list filters — powers the
 * "انتخاب همه N نتیجه" action on the contacts page. Mirrors the where-builder
 * of the contacts list page so the selection matches exactly what the user
 * sees. Capped at 20 000 ids to keep the payload sane.
 */

const FILTER_STAGES = ['lead', 'qualified', 'customer', 'lost'] as const
const FILTER_CHANNELS: ChannelType[] = ['INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'BALE', 'RUBIKA']

const CHANNEL_FILTER_WHERE: Partial<Record<ChannelType, Prisma.ContactWhereInput>> = {
  INSTAGRAM: { instagramId: { not: null } },
  WHATSAPP: { whatsappId: { not: null } },
  TELEGRAM: { telegramId: { not: null } },
  BALE: { baleId: { not: null } },
  RUBIKA: { rubikaId: { not: null } },
}

const MAX_IDS = 20_000

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const query = params.get('q')?.trim().slice(0, 120) || ''
  const stage = FILTER_STAGES.includes(params.get('stage') as (typeof FILTER_STAGES)[number])
    ? (params.get('stage') as (typeof FILTER_STAGES)[number])
    : ''
  const channel = FILTER_CHANNELS.includes(params.get('channel') as ChannelType)
    ? (params.get('channel') as ChannelType)
    : ''
  const tag = params.get('tag')?.trim().slice(0, 40) || ''
  const phoneVariants = contactPhoneLookupVariants(query)

  const where: Prisma.ContactWhereInput = {
    workspaceId: user.workspaceId,
    ...(stage ? { stage } : {}),
    ...(channel ? (CHANNEL_FILTER_WHERE[channel] ?? {}) : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { phone: { contains: query } },
            ...(phoneVariants.length ? [{ phone: { in: phoneVariants } }] : []),
            { telegramUsername: { contains: query, mode: 'insensitive' as const } },
            { baleUsername: { contains: query, mode: 'insensitive' as const } },
            { rubikaUsername: { contains: query, mode: 'insensitive' as const } },
            { whatsappName: { contains: query, mode: 'insensitive' as const } },
            { instagramUsername: { contains: query, mode: 'insensitive' as const } },
            { tags: { has: query } },
          ],
        }
      : {}),
  }

  const rows = await prisma.contact.findMany({
    where,
    orderBy: [{ lastActivityAt: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true },
    take: MAX_IDS,
  })
  const ids = rows.map((row) => row.id)
  return NextResponse.json({ ids, capped: rows.length === MAX_IDS })
}
