import type { ChannelType, Prisma } from '@prisma/client'
import { contactPhoneLookupVariants } from '@/lib/phone'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const STAGES = new Set(['lead', 'qualified', 'customer', 'lost'])
const CHANNEL_FIELD: Partial<Record<ChannelType, keyof Prisma.ContactWhereInput>> = {
  TELEGRAM: 'telegramId',
  WHATSAPP: 'whatsappId',
  INSTAGRAM: 'instagramId',
  RUBIKA: 'rubikaId',
  BALE: 'baleId',
}

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value)
  // Prevent spreadsheet applications from interpreting user-controlled cells
  // as formulas when the exported file is opened.
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const query = params.get('q')?.trim().slice(0, 120) ?? ''
  const requestedStage = params.get('stage') ?? ''
  const stage = STAGES.has(requestedStage) ? requestedStage : ''
  const requestedChannel = params.get('channel') as ChannelType | null
  const channelField = requestedChannel
    ? CHANNEL_FIELD[requestedChannel]
    : undefined
  const tag = params.get('tag')?.trim().slice(0, 40) ?? ''
  const phoneVariants = contactPhoneLookupVariants(query)

  const where: Prisma.ContactWhereInput = {
    workspaceId: user.workspaceId,
    ...(stage ? { stage } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(channelField ? { [channelField]: { not: null } } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            ...(phoneVariants.length ? [{ phone: { in: phoneVariants } }] : []),
            { telegramUsername: { contains: query, mode: 'insensitive' } },
            { baleUsername: { contains: query, mode: 'insensitive' } },
            { rubikaUsername: { contains: query, mode: 'insensitive' } },
            { whatsappName: { contains: query, mode: 'insensitive' } },
            { instagramUsername: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } },
          ],
        }
      : {}),
  }

  const encoder = new TextEncoder()
  let cursor: string | undefined
  let headerSent = false

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!headerSent) {
          controller.enqueue(
            encoder.encode(
              `\uFEFF${[
                'ID',
                'Name',
                'Phone',
                'Stage',
                'Tags',
                'Channels',
                'Messaging consent',
                'Last activity',
                'Created at',
                'Notes',
              ].map(csvCell).join(',')}\r\n`,
            ),
          )
          headerSent = true
        }

        const rows = await prisma.contact.findMany({
          where,
          orderBy: { id: 'asc' },
          take: 1000,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            name: true,
            phone: true,
            stage: true,
            tags: true,
            notes: true,
            marketingOptIn: true,
            createdAt: true,
            updatedAt: true,
            lastActivityAt: true,
            telegramId: true,
            whatsappId: true,
            instagramId: true,
            rubikaId: true,
            baleId: true,
          },
        })

        if (rows.length === 0) {
          controller.close()
          return
        }

        const body = rows
          .map((contact) => {
            const channels = [
              contact.telegramId && 'Telegram',
              contact.whatsappId && 'WhatsApp',
              contact.instagramId && 'Instagram',
              contact.rubikaId && 'Rubika',
              contact.baleId && 'Bale',
            ].filter(Boolean)
            return [
              contact.id,
              contact.name,
              contact.phone,
              contact.stage,
              contact.tags.join(' | '),
              channels.join(' | '),
              contact.marketingOptIn ? 'Yes' : 'No',
              (contact.lastActivityAt ?? contact.updatedAt).toISOString(),
              contact.createdAt.toISOString(),
              contact.notes,
            ].map(csvCell).join(',')
          })
          .join('\r\n')

        controller.enqueue(encoder.encode(`${body}\r\n`))
        cursor = rows.at(-1)?.id
        if (rows.length < 1000) controller.close()
      } catch (error) {
        console.error('Failed to export contacts', {
          workspaceId: user.workspaceId,
          error,
        })
        controller.error(error)
      }
    },
  })

  const date = new Date().toISOString().slice(0, 10)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vigent-customers-${date}.csv"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
