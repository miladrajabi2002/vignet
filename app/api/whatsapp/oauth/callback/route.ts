import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import {
  verifyState,
  exchangeCodeForUserToken,
  exchangeForLongLivedToken,
  listWhatsappBusinessAccounts,
  subscribeWabaToWebhook,
  type WhatsappPhoneNumber,
} from '@/lib/whatsapp/oauth'
import { buildWhatsappOAuthConfig } from '@/lib/whatsapp/config'
import { getCurrentUser } from '@/lib/session'
import { consumeOAuthState } from '@/lib/security/oauth-state'
import { hasWorkspacePermission } from '@/lib/workspace-permissions'
import { sealPendingWhatsappOAuth } from '@/lib/whatsapp/pending-oauth'

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
 *   3. list the user's WhatsApp Business Accounts + phone numbers
 *   4a. if exactly one phone number → connect immediately (zero extra clicks)
 *   4b. if multiple → stash the resolved numbers in a short-lived cookie and
 *       send the user to the number-picker step in the dashboard
 *   5. subscribe the WABA to the app webhook so events start flowing
 *   6. persist the channel + redirect back to the channels page
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
    return NextResponse.redirect(new URL(`/?wa_error=state`, base), {
      status: 303,
    })
  }

  const state = verifyState(stateRaw)
  if (!state) {
    return NextResponse.redirect(new URL(`/?wa_error=state`, base), {
      status: 303,
    })
  }

  const user = await getCurrentUser()
  const bindingMatches =
    !!user &&
    user.id === state.userId &&
    user.workspaceId === state.workspaceId &&
    hasWorkspacePermission(user.role, 'agents:manage')
  if (!bindingMatches) {
    return NextResponse.redirect(new URL(`/?wa_error=state`, base), {
      status: 303,
    })
  }

  const agent = await prisma.agent.findFirst({
    where: { id: state.agentId, workspaceId: state.workspaceId },
    select: { id: true },
  })
  if (!agent) {
    return NextResponse.redirect(new URL(`/?wa_error=state`, base), {
      status: 303,
    })
  }

  let stateConsumed = false
  try {
    stateConsumed = await consumeOAuthState('whatsapp', state.nonce, {
      userId: state.userId,
      workspaceId: state.workspaceId,
      agentId: state.agentId,
    })
  } catch (consumeError) {
    console.error('[whatsapp:oauth:callback] state store failed:', consumeError)
  }
  if (!stateConsumed) {
    return NextResponse.redirect(new URL(`/?wa_error=state`, base), {
      status: 303,
    })
  }

  // A denied flow still consumes the nonce so it cannot be replayed later.
  if (error) {
    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?wa_error=denied`, base),
      { status: 303 },
    )
  }
  if (!code) {
    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?wa_error=state`, base),
      { status: 303 },
    )
  }

  try {
    // 1) code → short-lived user token → long-lived user token
    const shortTok = await exchangeCodeForUserToken(code)
    const longTok = await exchangeForLongLivedToken(shortTok.token)

    // 2) list WhatsApp Business phone numbers
    const numbers = await listWhatsappBusinessAccounts(longTok.token)

    if (!numbers.length) {
      return NextResponse.redirect(
        new URL(`${channelsPath(state.agentId)}?wa_error=no_number`, base),
        { status: 303 },
      )
    }

    // 3a) single phone number → connect now
    if (numbers.length === 1) {
      const num = numbers[0] as WhatsappPhoneNumber
      await connectNumber(state.agentId, longTok.token, longTok.expiresAt, num)
      return NextResponse.redirect(
        new URL(`${channelsPath(state.agentId)}?wa_connected=1`, base),
        { status: 303 },
      )
    }

    // 3b) multiple numbers → stash + redirect to picker
    const payload = {
      userId: state.userId,
      workspaceId: state.workspaceId,
      agentId: state.agentId,
      userToken: longTok.token,
      userTokenExpiresAt: longTok.expiresAt.toISOString(),
      numbers: numbers.map((n) => ({
        wabaId: n.wabaId,
        phoneNumberId: n.phoneNumberId,
        displayPhoneNumber: n.displayPhoneNumber,
        verifiedName: n.verifiedName,
      })),
    }
    const cookieVal = sealPendingWhatsappOAuth(payload)
    const res = NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?wa_pick=1`, base),
      { status: 303 },
    )
    res.cookies.set('wa_oauth_pending', cookieVal, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60, // 10 min to pick a number
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (e) {
    console.error('[whatsapp:oauth:callback] failed:', e)
    return NextResponse.redirect(
      new URL(`${channelsPath(state.agentId)}?wa_error=exchange`, base),
      { status: 303 },
    )
  }
}

/** Persist a chosen phone number as the agent's WHATSAPP channel + subscribe to webhook. */
async function connectNumber(
  agentId: string,
  userToken: string,
  userTokenExpiresAt: Date,
  num: WhatsappPhoneNumber,
): Promise<void> {
  const config = buildWhatsappOAuthConfig({
    userToken,
    userTokenExpiresAt,
    wabaId: num.wabaId,
    phoneNumberId: num.phoneNumberId,
    displayPhoneNumber: num.displayPhoneNumber,
    verifiedName: num.verifiedName,
  })
  const configJson = config as unknown as Prisma.InputJsonValue

  // Subscribe the WABA to the app webhook so Meta starts sending inbound
  // events for it to the global webhook. Best-effort: if it fails the channel
  // is still stored and the operator can retry from the diagnostics panel.
  await subscribeWabaToWebhook(num.wabaId, userToken).catch((e) =>
    console.error('[whatsapp:oauth] WABA subscribe failed:', e),
  )

  const webhookUrl = `${appUrl().replace(/\/$/, '')}/api/webhook/whatsapp`

  await prisma.agentChannel.upsert({
    where: { agentId_type: { agentId, type: 'WHATSAPP' } },
    update: { active: true, config: configJson, webhookUrl },
    create: {
      agentId,
      type: 'WHATSAPP',
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
