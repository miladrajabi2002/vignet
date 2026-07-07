import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import { subscribePageToApp } from '@/lib/instagram/oauth'
import { buildInstagramOAuthConfig } from '@/lib/instagram/config'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

interface PendingPage {
  pageId: string
  pageName: string
  pageAccessToken: string
  instagram: {
    igBusinessAccountId: string
    username: string
    profilePictureUrl?: string
    followersCount?: number
    biography?: string
  }
}

/**
 * Finalize a multi-page OAuth connection. The callback stashed the resolved
 * pages in a short-lived cookie when the user has more than one IG-linked page;
 * the dashboard page-picker POSTs the chosen `pageId` here. We read the cookie,
 * persist the channel for that page, subscribe it to the webhook, and clear the
 * cookie.
 */
export async function POST(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, workspaceId: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const cookie = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('ig_oauth_pending='))
  if (!cookie) {
    return NextResponse.json({ error: 'NO_PENDING_OAUTH' }, { status: 400 })
  }
  const raw = decodeURIComponent(cookie.slice('ig_oauth_pending='.length))
  let pending: {
    userToken: string
    userTokenExpiresAt: string
    pages: PendingPage[]
  }
  try {
    pending = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'BAD_PENDING' }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as { pageId?: string }
  const page = pending.pages.find((p) => p.pageId === body?.pageId)
  if (!page) return NextResponse.json({ error: 'PAGE_NOT_FOUND' }, { status: 400 })

  const config = buildInstagramOAuthConfig({
    userToken: pending.userToken,
    userTokenExpiresAt: new Date(pending.userTokenExpiresAt),
    pageId: page.pageId,
    pageToken: page.pageAccessToken,
    igBusinessAccountId: page.instagram.igBusinessAccountId,
    username: page.instagram.username,
    profilePictureUrl: page.instagram.profilePictureUrl,
    followersCount: page.instagram.followersCount,
    biography: page.instagram.biography,
  })
  const configJson = config as unknown as Prisma.InputJsonValue

  await subscribePageToApp(page.pageId, page.pageAccessToken).catch((e) =>
    console.error('[instagram:connect] page subscribe failed:', e),
  )

  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
  const webhookUrl = `${base}/api/webhook/instagram`

  await prisma.agentChannel.upsert({
    where: { agentId_type: { agentId: agent.id, type: 'INSTAGRAM' } },
    update: { active: true, config: configJson, webhookUrl },
    create: { agentId: agent.id, type: 'INSTAGRAM', config: configJson, webhookUrl },
  })

  await syncOnboarding(agent.workspaceId)

  const res = NextResponse.json({ ok: true, username: page.instagram.username })
  res.cookies.delete('ig_oauth_pending')
  return res
}
