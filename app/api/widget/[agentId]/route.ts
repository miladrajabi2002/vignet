import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { normalizeWidgetSettings } from '@/lib/widget/config'

type Params = { params: { agentId: string } }

export function OPTIONS() {
  return corsOptions()
}

// Public widget config — only safe, non-sensitive fields + appearance settings.
export async function GET(_req: Request, { params }: Params) {
  const agent = await prisma.agent.findUnique({
    where: { id: params.agentId },
    select: {
      id: true,
      name: true,
      welcomeMessage: true,
      language: true,
      avatar: true,
      active: true,
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

  const settings = normalizeWidgetSettings(agent.channels[0]?.config)

  return NextResponse.json(
    {
      id: agent.id,
      name: settings.headerTitle ?? agent.name,
      welcomeMessage: agent.welcomeMessage,
      language: agent.language,
      avatar: agent.avatar,
      // Appearance — consumed by loader.js to theme the widget.
      theme: settings.theme,
      primaryColor: settings.primaryColor,
      position: settings.position,
      launcherLabel: settings.launcherLabel,
      font: settings.font,
      icon: settings.icon,
      subtitle: settings.subtitle,
      corners: settings.corners,
      quickReplies: settings.quickReplies,
      sound: settings.sound,
      autoGreet: settings.autoGreet,
    },
    { headers: corsHeaders },
  )
}
