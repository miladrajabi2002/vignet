import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

const triggerSchema = z.object({
  keywords: z.array(z.string()).default([]),
  matchMode: z.enum(['EXACT', 'CONTAINS', 'STARTS_WITH']).default('CONTAINS'),
  storyScope: z.enum(['ALL', 'KEYWORD']).default('KEYWORD'),
  postIds: z.array(z.string()).default([]),
})

// A quick-reply button can be a plain string (postback — title is sent back as
// the user's message when tapped) OR an object {title, url?} (web_url button —
// tapping opens the URL). The form's ButtonBuilder submits the object form.
const buttonSchema = z.union([
  z.string(),
  z.object({
    title: z.string().min(1).max(20),
    url: z.string().optional(),
    payload: z.string().optional(),
  }),
])

const messageEntrySchema = z.object({
        type: z
                .enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'QUICK_REPLY', 'PRODUCT'])
                .default('TEXT'),
        text: z.string().optional(),
        mediaUrl: z.string().optional(),
        productId: z.string().optional(),
        buttons: z.array(buttonSchema).max(3).optional(),
})

const actionSchema = z.object({
        replyMode: z
                .enum(['STATIC', 'AI', 'FLOW', 'SILENT', 'STOP_AI', 'MULTI_MESSAGE'])
                .default('STATIC'),
        replyText: z.string().default(''),
        messages: z.array(messageEntrySchema).default([]),
        mediaType: z
                .enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'QUICK_REPLY', 'PRODUCT'])
                .default('TEXT'),
        mediaUrl: z.string().default(''),
        productId: z.string().default(''),
        dmOnComment: z.boolean().default(false),
        followGate: z.boolean().default(false),
        gateMode: z.enum(['SOFT', 'STORY_MENTION']).default('SOFT'),
        gateButtonType: z.enum(['button', 'quick_reply']).default('button'),
        gatePrompt: z.string().default(''),
        gateConfirmKeyword: z.string().default(''),
        gateQuickReply: z.string().default(''),
        contentText: z.string().default(''),
        aiAgentEnabled: z.boolean().default(false),
        followUpEnabled: z.boolean().default(false),
        followUpDelayMin: z.number().int().min(1).default(60),
        followUpMessage: z.string().default(''),
})

const createSchema = z.object({
  type: z.enum(['DIRECT_MESSAGE', 'COMMENT', 'STORY']),
  name: z.string().min(1).max(120),
  active: z.boolean().default(true),
  priority: z.number().int().default(0),
  trigger: triggerSchema,
  action: actionSchema,
})

/** List all automation scenarios for an agent's Instagram channel. */
export async function GET(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, channels: { where: { type: 'INSTAGRAM' }, select: { id: true } } },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const igChannel = agent.channels[0]
  if (!igChannel) return NextResponse.json({ automations: [], connected: false })

  const automations = await prisma.instagramAutomation.findMany({
    where: { agentId: agent.id, channelId: igChannel.id },
    orderBy: [{ type: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ automations, connected: true, channelId: igChannel.id })
}

/** Create a new automation scenario. */
export async function POST(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, channels: { where: { type: 'INSTAGRAM' }, select: { id: true } } },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const igChannel = agent.channels[0]
  if (!igChannel) return NextResponse.json({ error: 'IG_NOT_CONNECTED' }, { status: 400 })

  const json = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID', details: parsed.error.flatten() }, { status: 400 })
  }

  const created = await prisma.instagramAutomation.create({
    data: {
      agentId: agent.id,
      channelId: igChannel.id,
      type: parsed.data.type,
      name: parsed.data.name,
      active: parsed.data.active,
      priority: parsed.data.priority,
      trigger: parsed.data.trigger,
      action: parsed.data.action,
    },
  })
  return NextResponse.json({ automation: created }, { status: 201 })
}
