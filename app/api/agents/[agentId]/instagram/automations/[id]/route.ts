import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string; id: string }> }

// A quick-reply button can be a plain string (postback) OR an object {title,
// url?} (web_url). Mirror of the create route's schema.
const buttonSchema = z.union([
  z.string(),
  z.object({
    title: z.string().min(1).max(20),
    url: z.string().optional(),
    payload: z.string().optional(),
  }),
])

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
  priority: z.number().int().optional(),
  trigger: z
    .object({
      keywords: z.array(z.string()).optional(),
      matchMode: z.enum(['EXACT', 'CONTAINS', 'STARTS_WITH']).optional(),
      storyScope: z.enum(['ALL', 'KEYWORD']).optional(),
      postIds: z.array(z.string()).optional(),
    })
    .optional(),
  action: z
    .object({
      replyMode: z
        .enum(['STATIC', 'AI', 'SILENT', 'STOP_AI', 'MULTI_MESSAGE'])
        .optional(),
      replyText: z.string().optional(),
      messages: z
        .array(
          z.object({
            type: z
              .enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'QUICK_REPLY', 'PRODUCT', 'PRODUCT_LIST'])
              .optional(),
            text: z.string().optional(),
            mediaUrl: z.string().optional(),
            productId: z.string().optional(),
            productIds: z.array(z.string()).max(10).optional(),
            buttons: z.array(buttonSchema).max(3).optional(),
            buttonType: z.enum(['button', 'quick_reply']).optional(),
          }),
        )
        .optional(),
      mediaType: z
        .enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'QUICK_REPLY', 'PRODUCT'])
        .optional(),
      mediaUrl: z.string().optional(),
      productId: z.string().optional(),
      dmOnComment: z.boolean().optional(),
      followGate: z.boolean().optional(),
      gateMode: z.enum(['SOFT', 'STORY_MENTION']).optional(),
      gateButtonType: z.enum(['button', 'quick_reply']).optional(),
      gatePrompt: z.string().optional(),
      gateConfirmKeyword: z.string().optional(),
      gateQuickReply: z.string().optional(),
      contentText: z.string().optional(),
      aiAgentEnabled: z.boolean().optional(),
      followUpEnabled: z.boolean().optional(),
      followUpDelayMin: z.number().int().min(1).optional(),
      followUpMessage: z.string().optional(),
    })
    .optional(),
})

async function owns(user: { workspaceId: string }, agentId: string, id: string) {
  const row = await prisma.instagramAutomation.findFirst({
    where: { id, agentId },
    select: { id: true, agent: { select: { workspaceId: true } } },
  })
  return row?.agent.workspaceId === user.workspaceId ? row : null
}

/** Update an automation scenario (partial). */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const row = await owns(user, params.agentId, params.id)
  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.instagramAutomation.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return NextResponse.json({ automation: updated })
}

/** Delete an automation scenario. */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const row = await owns(user, params.agentId, params.id)
  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.instagramAutomation.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
