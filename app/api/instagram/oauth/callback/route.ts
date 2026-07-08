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
} from '@/lib/instagram/oauth'
import { buildInstagramOAuthConfig } from '@/lib/instagram/config'

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
  const channelsPath = (agentId: string) => `/agents/${agentId}/channels`

  // User declined the consent screen.
  if (error) {
    return NextResponse.redirect(
      new URL(`${channelsPath('')}?ig_error=denied`, base),
      { status: 303 },
    )
  }
  if (!code || !stateRaw) {
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

  try {
    // 1) code → short-lived IG token (+ igUserId)
    const shortTok = await exchangeCodeForUserToken(code)

    // 2) short-lived → long-lived (60 days)
    const longTok = await exchangeForLongLivedToken(shortTok.token)

    // 3) fetch the IG profile (username, avatar, followers)
    const profile = await getInstagramProfile(longTok.token)

    // 4) persist the channel — single IG account, no page picker
    const config = buildInstagramOAuthConfig({
      userToken: longTok.token,
      userTokenExpiresAt: longTok.expiresAt,
      igUserId: profile.igUserId,
      username: profile.username,
      profilePictureUrl: profile.profilePictureUrl,
      followersCount: profile.followersCount,
      biography: profile.biography,
    })
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
