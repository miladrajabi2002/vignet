import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { webPushConfigured, webPushPublicKey } from '@/lib/notifications/web-push'

export const dynamic = 'force-dynamic'

/**
 * This device's Web Push subscription (see lib/notifications/web-push).
 *   GET    → the VAPID public key the browser subscribes with
 *   POST   → save the browser's subscription for the signed-in user
 *   DELETE → forget it (the «turn off» switch, or logout on this device)
 */

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine((url) => url.startsWith('https://'), 'HTTPS_ONLY'),
  keys: z.object({
    p256dh: z.string().min(16).max(256),
    auth: z.string().min(8).max(128),
  }),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const publicKey = webPushConfigured() ? webPushPublicKey() : null
  return NextResponse.json({ publicKey }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!webPushConfigured()) return NextResponse.json({ error: 'PUSH_DISABLED' }, { status: 503 })

  const parsed = subscriptionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const { endpoint, keys } = parsed.data
  const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null

  // Keyed by endpoint: the same browser re-subscribing (or another account on
  // this device logging in) moves the row instead of duplicating alerts.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: user.id, workspaceId: user.workspaceId, userAgent },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: user.id, workspaceId: user.workspaceId, userAgent },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: user.id } })
  return NextResponse.json({ ok: true })
}
