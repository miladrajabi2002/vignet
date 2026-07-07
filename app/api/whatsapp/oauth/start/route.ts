import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  buildWhatsappAuthUrl,
  signState,
  type WhatsappOAuthState,
} from '@/lib/whatsapp/oauth'

export const dynamic = 'force-dynamic'

/**
 * Start the WhatsApp OAuth flow. The operator clicked "Connect WhatsApp" — we
 * verify they own the agent, build a signed state token (so the callback can
 * trust the redirect), and send the browser to Facebook's OAuth dialog with
 * the WhatsApp Embedded Signup scopes. After the user authorizes, Meta
 * redirects to `/api/whatsapp/oauth/callback`.
 *
 * The agent id is read from the JSON body (NOT from URL params) so this route
 * is self-contained at `/api/whatsapp/oauth/start` (no path params).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let agentId: string | undefined
  let returnTo: string | undefined
  try {
    const json = (await req.json().catch(() => null)) as {
      agentId?: string
      returnTo?: string
    }
    agentId = json?.agentId
    returnTo = json?.returnTo
  } catch {
    /* no body is fine — but then agentId is required */
  }
  if (!agentId) {
    return NextResponse.json({ error: 'AGENT_ID_REQUIRED' }, { status: 400 })
  }

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!agent) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const state: WhatsappOAuthState = {
    agentId: agent.id,
    workspaceId: user.workspaceId,
    nonce: crypto.randomUUID(),
    returnTo,
  }

  const url = buildWhatsappAuthUrl(signState(state))
  return NextResponse.json({ url })
}
