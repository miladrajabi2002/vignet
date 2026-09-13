import { NextResponse } from 'next/server'
import type { ChannelType, ConvStatus, Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Ids of every conversation matching the CURRENT list filters — powers the
 * "انتخاب همه N نتیجه" action on the conversations page. Mirrors the
 * where-builder of the conversations list page. Capped at 20 000 ids.
 */

const VALID_STATUSES = new Set<ConvStatus>(['OPEN', 'RESOLVED', 'HANDED_OFF'])
const VALID_CHANNELS = new Set<ChannelType>([
  'TELEGRAM',
  'WHATSAPP',
  'INSTAGRAM',
  'RUBIKA',
  'BALE',
  'WEB_WIDGET',
  'API',
  'CHAT_LINK',
])
type SalesFilter = 'HIGH_INTENT' | 'BUYER' | 'INFORMATION_SEEKER' | 'EXISTING_CUSTOMER' | 'SUPPORT_SEEKER'
const VALID_SALES_FILTERS = new Set<SalesFilter>([
  'HIGH_INTENT',
  'BUYER',
  'INFORMATION_SEEKER',
  'EXISTING_CUSTOMER',
  'SUPPORT_SEEKER',
])

const MAX_IDS = 20_000

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const channelFilter = VALID_CHANNELS.has(params.get('channel') as ChannelType)
    ? (params.get('channel') as ChannelType)
    : undefined
  const statusFilter = VALID_STATUSES.has(params.get('status') as ConvStatus)
    ? (params.get('status') as ConvStatus)
    : undefined
  const agentFilter = params.get('agent')?.trim().slice(0, 64) || undefined
  const salesFilter = VALID_SALES_FILTERS.has(params.get('sales') as SalesFilter)
    ? (params.get('sales') as SalesFilter)
    : undefined
  const query = params.get('q')?.trim().slice(0, 120) || undefined

  const where: Prisma.ConversationWhereInput = { workspaceId: user.workspaceId }
  if (channelFilter) where.channel = channelFilter
  if (statusFilter) where.status = statusFilter
  if (agentFilter) where.agentId = agentFilter
  if (salesFilter === 'HIGH_INTENT') {
    where.salesInsight = { is: { buyerProbability: { gte: 50 }, leadType: 'BUYER' } }
  } else if (salesFilter) {
    where.salesInsight = { is: { leadType: salesFilter } }
  }
  if (query) {
    where.OR = [
      { summary: { contains: query, mode: 'insensitive' } },
      { contact: { name: { contains: query, mode: 'insensitive' } } },
      { contact: { phone: { contains: query } } },
      { contact: { telegramUsername: { contains: query, mode: 'insensitive' } } },
      { contact: { baleUsername: { contains: query, mode: 'insensitive' } } },
      { contact: { rubikaUsername: { contains: query, mode: 'insensitive' } } },
      { contact: { instagramUsername: { contains: query, mode: 'insensitive' } } },
      { messages: { some: { content: { contains: query, mode: 'insensitive' } } } },
    ]
  }

  const rows = await prisma.conversation.findMany({
    where,
    orderBy: [{ handedOff: 'desc' }, { lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
    take: MAX_IDS,
  })
  const ids = rows.map((row) => row.id)
  return NextResponse.json({ ids, capped: rows.length === MAX_IDS })
}
