import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { buildInstagramAuthUrl, signState, type OAuthState } from '@/lib/instagram/oauth'
import { createOAuthState } from '@/lib/security/oauth-state'
import { checkChannelConnectAllowed } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

/**
 * Start the Instagram OAuth flow. The operator clicked "Connect" — we verify
 * they own the agent, build a signed state token (so the callback can trust the
 * redirect), and send the browser to Facebook's OAuth dialog. After the user
 * authorizes, Meta redirects to `/api/instagram/oauth/callback`.
 *
 * The agent id is read from the JSON body (NOT the URL path) so this single
 * route can serve any agent without a dynamic segment.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const json = (await req.json().catch(() => null)) as {
    agentId?: string
    returnTo?: string
  }
  const agentId = json?.agentId
  if (!agentId) {
    return NextResponse.json({ error: 'MISSING_AGENT_ID' }, { status: 400 })
  }

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const gate = await checkChannelConnectAllowed(user.workspaceId, {
    kind: 'AGENT_CHANNEL',
    agentId: agent.id,
    type: 'INSTAGRAM',
  })
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: 402 })
  }

  const nonce = crypto.randomUUID()
  const state: OAuthState = {
    userId: user.id,
    agentId: agent.id,
    workspaceId: user.workspaceId,
    nonce,
    returnTo:
      typeof json.returnTo === 'string' &&
      json.returnTo.startsWith('/') &&
      !json.returnTo.startsWith('//') &&
      json.returnTo.length <= 512
        ? json.returnTo
        : undefined,
  }

  try {
    await createOAuthState('instagram', nonce, {
      userId: user.id,
      workspaceId: user.workspaceId,
      agentId: agent.id,
    })
  } catch (error) {
    console.error('[instagram:oauth:start] state store failed:', error)
    return NextResponse.json(
      { error: 'OAUTH_TEMPORARILY_UNAVAILABLE' },
      { status: 503 },
    )
  }

  const url = buildInstagramAuthUrl(signState(state))
  return NextResponse.json({ url })
}
