import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import {
  verifyState,
  exchangeCodeForUserToken,
  exchangeForLongLivedToken,
  listFacebookPagesWithInstagram,
  subscribePageToApp,
  type InstagramPage,
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
 * OAuth callback. Meta redirects here with `?code=...&state=...`. We:
 *   1. verify the signed state (agentId + workspaceId + nonce)
 *   2. exchange the code for a short-lived user token, then a long-lived one
 *   3. list the user's FB Pages + linked IG accounts
 *   4a. if exactly one page has IG → connect immediately (zero extra clicks)
 *   4b. if multiple → stash the resolved pages in a short-lived cookie and send
 *       the user to the page-picker step in the dashboard
 *   5. subscribe the page to the app webhook so events start flowing
 *   6. persist the channel + redirect back to the channels page
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
    // 1) code → short-lived user token → long-lived user token
    const shortTok = await exchangeCodeForUserToken(code)
    const longTok = await exchangeForLongLivedToken(shortTok.token)

    // 2) list pages + IG accounts
    const pages = await listFacebookPagesWithInstagram(longTok.token)
    const igPages = pages.filter((p) => p.instagram)

    if (!igPages.length) {
      return NextResponse.redirect(
        new URL(`${channelsPath(state.agentId)}?ig_error=no_page`, base),
        { status: 303 },
      )
    }

    // 3a) single IG page → connect now
    if (igPages.length === 1) {
      const page = igPages[0] as InstagramPage
      await connectPage(state.agentId, longTok.token, longTok.expiresAt, page)
      return NextResponse.redirect(
        new URL(`${channelsPath(state.agentId)}?ig_connected=1`, base),
        { status: 303 },
      )
    }

    // 3b) multiple IG pages → stash + redirect to picker
    const payload = {
      agentId: state.agentId,
      userToken: longTok.token,
      userTokenExpiresAt: longTok.expiresAt.toISOString(),
      pages: igPages.map((p) => ({
        pageId: p.pageId,
        pageName: p.pageName,
        pageAccessToken: p.pageAccessToken,
        instagram: p.instagram,
      })),
    }
    const cookieVal = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const res = NextResponse.redirect(
      new URL(
        `${channelsPath(state.agentId)}?ig_pick=1`,
        base,
      ),
      { status: 303 },
    )
    res.cookies.set('ig_oauth_pending', cookieVal, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60, // 10 min to pick a page
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (e) {
    console.error('[instagram:oauth:callback] failed:', e)
    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?ig_error=exchange`, base),
      { status: 303 },
    )
  }
}

/** Persist a chosen page as the agent's INSTAGRAM channel + subscribe to webhook. */
async function connectPage(
  agentId: string,
  userToken: string,
  userTokenExpiresAt: Date,
  page: InstagramPage,
): Promise<void> {
  const ig = page.instagram!
  const config = buildInstagramOAuthConfig({
    userToken,
    userTokenExpiresAt,
    pageId: page.pageId,
    pageToken: page.pageAccessToken,
    igBusinessAccountId: ig.igBusinessAccountId,
    username: ig.username,
    profilePictureUrl: ig.profilePictureUrl,
    followersCount: ig.followersCount,
    biography: ig.biography,
  })
  const configJson = config as unknown as Prisma.InputJsonValue

  // Subscribe the page to the app webhook so Meta starts sending events for it
  // to the global webhook. Best-effort: if it fails the channel is still stored
  // and the operator can retry from the diagnostics panel.
  await subscribePageToApp(page.pageId, page.pageAccessToken).catch((e) =>
    console.error('[instagram:oauth] page subscribe failed:', e),
  )

  const webhookUrl = `${appUrl().replace(/\/$/, '')}/api/webhook/instagram`

  await prisma.agentChannel.upsert({
    where: { agentId_type: { agentId, type: 'INSTAGRAM' } },
    update: { active: true, config: configJson, webhookUrl },
    create: {
      agentId,
      type: 'INSTAGRAM',
      config: configJson,
      webhookUrl,
    },
  })

  await syncOnboarding(
    (
      await prisma.agent.findUnique({
        where: { id: agentId },
        select: { workspaceId: true },
      })
    )?.workspaceId ?? '',
  )
}
