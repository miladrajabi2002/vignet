import webpush from 'web-push'
import type { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'

/**
 * Web Push for the installed panel (iPhone 16.4+ home-screen app, Android,
 * Windows/macOS Chrome, Edge, Safari). The dashboard bell only polls while a
 * tab is open; this reaches the device with the app closed.
 *
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https:).
 * Without them every call is a no-op and the panel hides the push option.
 */

let configured: boolean | null = null

export function webPushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null
}

export function webPushConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = webPushPublicKey()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return (configured = false)
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'https://vigent.ir', publicKey, privateKey)
    configured = true
  } catch (error) {
    captureError('push:vapid-config', error)
    configured = false
  }
  return configured
}

export interface WorkspacePush {
  workspaceId: string
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  /** Limit the send to one user's devices (the «send a test» button). */
  userId?: string
}

/** Chat and handoff alerts must wake the phone; the rest can wait for a good moment. */
const URGENT: ReadonlySet<NotificationType> = new Set(['NEW_MESSAGE', 'HANDOFF', 'APPOINTMENT'])

export async function sendWorkspacePush(push: WorkspacePush): Promise<{ sent: number; removed: number }> {
  if (!webPushConfigured()) return { sent: 0, removed: 0 }
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { workspaceId: push.workspaceId, ...(push.userId ? { userId: push.userId } : {}) },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  if (!subscriptions.length) return { sent: 0, removed: 0 }

  const unread = await prisma.notification
    .count({ where: { workspaceId: push.workspaceId, read: false } })
    .catch(() => 0)
  const payload = JSON.stringify({
    title: push.title.slice(0, 120),
    body: push.body?.slice(0, 300) ?? '',
    link: push.link && push.link.startsWith('/') ? push.link : '/overview',
    // Same link → one notification on the lock screen, refreshed in place.
    tag: push.link ?? push.type,
    badge: unread,
  })

  let sent = 0
  const gone: string[] = []
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { TTL: 12 * 60 * 60, urgency: URGENT.has(push.type) ? 'high' : 'normal', timeout: 10_000 },
      )
      sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      // 404/410: the browser dropped the subscription (app removed, permission revoked).
      if (status === 404 || status === 410) gone.push(subscription.id)
      else captureError('push:send', error, { workspaceId: push.workspaceId, metadata: { status: status ?? null } })
    }
  }))

  if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } }).catch(() => {})
  if (sent) {
    await prisma.pushSubscription
      .updateMany({ where: { id: { in: subscriptions.filter((s) => !gone.includes(s.id)).map((s) => s.id) } }, data: { lastSentAt: new Date() } })
      .catch(() => {})
  }
  return { sent, removed: gone.length }
}
