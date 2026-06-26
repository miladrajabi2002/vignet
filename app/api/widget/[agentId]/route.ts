import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { corsHeaders, corsOptions } from '@/lib/cors'

type Params = { params: { agentId: string } }

export function OPTIONS() {
  return corsOptions()
}

// Public widget config — only safe, non-sensitive fields.
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
    },
  })

  if (!agent || !agent.active) {
    return NextResponse.json(
      { error: 'NOT_FOUND' },
      { status: 404, headers: corsHeaders },
    )
  }

  return NextResponse.json(
    {
      id: agent.id,
      name: agent.name,
      welcomeMessage: agent.welcomeMessage,
      language: agent.language,
      avatar: agent.avatar,
    },
    { headers: corsHeaders },
  )
}
