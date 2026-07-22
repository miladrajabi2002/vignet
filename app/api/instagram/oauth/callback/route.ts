import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import {
  verifyState,
  exchangeCodeForUserToken,
  exchangeForLongLivedToken,
  getInstagramProfile,
  subscribeIgUserToWebhook,
  unsubscribeIgUserFromWebhook,
} from '@/lib/instagram/oauth'
import {
  buildInstagramOAuthConfig,
  readIgUserId,
  readUserToken,
} from '@/lib/instagram/config'
import { getCurrentUser } from '@/lib/session'
import { consumeOAuthState } from '@/lib/security/oauth-state'
import { checkChannelConnectAllowed } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  )
}

/**
 * Instagram Login OAuth callback. Meta redirects here with `?code=...&state=...`.
 *
 * The Instagram Login flow (Business Login for Instagram) is much simpler than
 * Facebook Login:
 *   1. verify the signed state (agentId + workspaceId + nonce)
 *   2. exchange the code for a short-lived IG token
 *   3. exchange for a long-lived IG token (60 days, refreshable)
 *   4. fetch the IG profile (username, avatar, followers)
 *   5. persist the channel — NO page picker needed (the IG account IS the
 *      identity, unlike Facebook Login which required choosing a Page)
 *   6. redirect back to the channels page with ?ig_connected=1
 *
 * With Instagram Login, the IG account is automatically subscribed to the app's
 * webhook when the user authorizes — no need to call subscribePageToApp.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const base = appUrl()
  const channelsPath = (agentId: string) =>
    `/agents/${encodeURIComponent(agentId)}/channels`

  if (!stateRaw) {
    return NextResponse.redirect(new URL(`/?ig_error=state`, base), {
      status: 303,
    })
  }

  const state = verifyState(stateRaw)
  if (!state) {
    return NextResponse.redirect(new URL(`/?ig_error=state`, base), {
      status: 303,
    })
  }

  const user = await getCurrentUser()
  const bindingMatches =
    !!user &&
    user.id === state.userId &&
    user.workspaceId === state.workspaceId
  if (!bindingMatches) {
    return NextResponse.redirect(new URL(`/?ig_error=state`, base), {
      status: 303,
    })
  }

  const agent = await prisma.agent.findFirst({
    where: { id: state.agentId, workspaceId: state.workspaceId },
    select: { id: true },
  })
  if (!agent) {
    return NextResponse.redirect(new URL(`/?ig_error=state`, base), {
      status: 303,
    })
  }

  let stateConsumed = false
  try {
    stateConsumed = await consumeOAuthState('instagram', state.nonce, {
      userId: state.userId,
      workspaceId: state.workspaceId,
      agentId: state.agentId,
    })
  } catch (consumeError) {
    console.error('[instagram:oauth:callback] state store failed:', consumeError)
  }
  if (!stateConsumed) {
    return NextResponse.redirect(new URL(`/?ig_error=state`, base), {
      status: 303,
    })
  }

  // A denied flow still consumes the nonce so it cannot be replayed later.
  if (error) {
    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?ig_error=denied`, base),
      { status: 303 },
    )
  }
  if (!code) {
    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?ig_error=state`, base),
      { status: 303 },
    )
  }

  const gate = await checkChannelConnectAllowed(state.workspaceId, {
    kind: 'AGENT_CHANNEL',
    agentId: state.agentId,
    type: 'INSTAGRAM',
  })
  if (!gate.allowed) {
    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?ig_error=${gate.reason.toLowerCase()}`, base),
      { status: 303 },
    )
  }

  try {
    // 1) code → short-lived IG token (+ igUserId)
    const shortTok = await exchangeCodeForUserToken(code)

    // 2) short-lived → long-lived (60 days)
    const longTok = await exchangeForLongLivedToken(shortTok.token)

    // 3) fetch the IG profile (username, avatar, followers)
    const profile = await getInstagramProfile(longTok.token)

    // 4) persist the channel — single IG account, no page picker
    const previousChannel = await prisma.agentChannel.findUnique({
      where: { agentId_type: { agentId: state.agentId, type: 'INSTAGRAM' } },
      select: { config: true },
    })
    const previousIgUserId = previousChannel
      ? readIgUserId(previousChannel.config)
      : null
    const previousToken = previousChannel
      ? readUserToken(previousChannel.config)
      : null

    const config = buildInstagramOAuthConfig({
      userToken: longTok.token,
      userTokenExpiresAt: longTok.expiresAt,
      igUserId: profile.igUserId,
      username: profile.username,
      profilePictureUrl: profile.profilePictureUrl,
      followersCount: profile.followersCount,
      biography: profile.biography,
    })
    if (previousIgUserId && previousIgUserId !== profile.igUserId) {
      const previousConfig = previousChannel?.config as Record<string, unknown> | null
      const previousIgnoredIds = Array.isArray(previousConfig?.ignoredWebhookIds)
        ? previousConfig.ignoredWebhookIds.map(String)
        : []
      config.ignoredWebhookIds = Array.from(
        new Set([...previousIgnoredIds, previousIgUserId]),
      ).slice(-10)
    }
    const configJson = config as unknown as Prisma.InputJsonValue

    const webhookUrl = `${base.replace(/\/$/, '')}/api/webhook/instagram`

    await prisma.agentChannel.upsert({
      where: { agentId_type: { agentId: state.agentId, type: 'INSTAGRAM' } },
      update: { active: true, config: configJson, webhookUrl },
      create: {
        agentId: state.agentId,
        type: 'INSTAGRAM',
        config: configJson,
        webhookUrl,
      },
    })

    // 5) Subscribe the IG user to the app's webhook fields so Meta starts
    //    delivering message/comment/story events to /api/webhook/instagram.
    //    This is CRITICAL — without it, no webhooks arrive even if the app
    //    is Live and the webhook URL is configured. Best-effort: if it fails,
    //    the channel is still saved and the operator can retry from diagnostics.
    await subscribeIgUserToWebhook(profile.igUserId, longTok.token).catch(
      (e) =>
        console.error('[instagram:oauth] webhook subscription failed:', e),
    )

    if (
      previousIgUserId &&
      previousIgUserId !== profile.igUserId &&
      previousToken
    ) {
      await unsubscribeIgUserFromWebhook(previousIgUserId, previousToken)
    }

    await syncOnboarding(state.workspaceId)

    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?ig_connected=1`, base),
      { status: 303 },
    )
  } catch (e) {
    console.error('[instagram:oauth:callback] failed:', e)
    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?ig_error=exchange`, base),
      { status: 303 },
    )
  }
}
