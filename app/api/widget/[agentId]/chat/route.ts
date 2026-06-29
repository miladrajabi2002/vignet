import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { startChat } from '@/lib/ai/chat-engine'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { normalizeWidgetSettings, isOriginAllowed } from '@/lib/widget/config'

type Params = { params: { agentId: string } }

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  // Accept null too: older/embedded widgets send `conversationId: null` on the
  // first turn, which `.optional()` alone would reject as INVALID.
  conversationId: z.string().nullish(),
})

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request, { params }: Params) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'

  const allowed = await rateLimit(`widget:${params.agentId}:${ip}`, 20, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMIT' },
      { status: 429, headers: corsHeaders },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID' },
      { status: 400, headers: corsHeaders },
    )
  }

  const agent = await prisma.agent.findUnique({
    where: { id: params.agentId },
    select: {
      id: true,
      workspaceId: true,
      active: true,
      systemPrompt: true,
      language: true,
      model: true,
      temperature: true,
      maxTokens: true,
      fallbackMessage: true,
      handoffEnabled: true,
      handoffMessage: true,
      handoffKeywords: true,
      channels: {
        where: { type: 'WEB_WIDGET' },
        select: { config: true },
        take: 1,
      },
    },
  })
  if (!agent || !agent.active) {
    return NextResponse.json(
      { error: 'NOT_FOUND' },
      { status: 404, headers: corsHeaders },
    )
  }

  // Anti-abuse: if the owner configured an allowlist, only embed-able from those
  // domains. Empty allowlist = open (the dashboard warns it is unprotected).
  const settings = normalizeWidgetSettings(agent.channels[0]?.config)
  if (
    !isOriginAllowed(
      req.headers.get('origin'),
      req.headers.get('referer'),
      settings.allowedDomains,
    )
  ) {
    return NextResponse.json(
      { error: 'FORBIDDEN_ORIGIN' },
      { status: 403, headers: corsHeaders },
    )
  }

  const result = await startChat({
    workspaceId: agent.workspaceId,
    agent,
    message: parsed.data.message,
    conversationId: parsed.data.conversationId ?? undefined,
    channel: 'WEB_WIDGET',
  })

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error },
      { status: 400, headers: corsHeaders },
    )
  }

  return new Response(result.stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
