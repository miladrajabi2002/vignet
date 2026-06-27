import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import { buildMessengerConfig } from '@/lib/channels/config'
import { getBotInfo, setWebhook, MESSENGER_TYPES } from '@/lib/channels/registry'

type Params = { params: { agentId: string } }

const bodySchema = z.object({
  type: z.enum(MESSENGER_TYPES),
  botToken: z.string().min(10).max(500),
})

const WEBHOOK_PATH: Record<(typeof MESSENGER_TYPES)[number], string> = {
  TELEGRAM: 'telegram',
  BALE: 'bale',
  RUBIKA: 'rubika',
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  )
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const { type, botToken } = parsed.data

  // Verify the bot token with the platform before storing it.
  const info = await getBotInfo(type, botToken)
  if (!info) return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 400 })

  const config = buildMessengerConfig(botToken, info.username)
  const configJson = config as unknown as Prisma.InputJsonValue
  const webhookUrl = `${baseUrl()}/api/webhook/${WEBHOOK_PATH[type]}/${config.webhookToken}`

  const webhookSet = await setWebhook(type, botToken, webhookUrl)

  const channel = await prisma.agentChannel.upsert({
    where: { agentId_type: { agentId: params.agentId, type } },
    update: { active: true, config: configJson, webhookUrl },
    create: {
      agentId: params.agentId,
      type,
      config: configJson,
      webhookUrl,
    },
    select: { id: true, type: true },
  })

  await syncOnboarding(user.workspaceId)

  return NextResponse.json(
    { channel, botUsername: info.username, webhookSet },
    { status: 201 },
  )
}
