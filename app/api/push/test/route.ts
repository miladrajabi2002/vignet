import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { rateLimit } from '@/lib/ratelimit'
import { sendWorkspacePush, webPushConfigured } from '@/lib/notifications/web-push'

export const dynamic = 'force-dynamic'

/** «ارسال اعلان آزمایشی»: proves the whole path to this user's devices. */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!webPushConfigured()) return NextResponse.json({ error: 'PUSH_DISABLED' }, { status: 503 })
  if (!(await rateLimit(`push-test:${user.id}`, 5, 10 * 60))) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  }

  const result = await sendWorkspacePush({
    workspaceId: user.workspaceId,
    userId: user.id,
    type: 'SYSTEM',
    title: 'اعلان‌های ویجنت فعال است',
    body: 'از این به بعد پیام‌های تازه و درخواست‌های اپراتور همین‌جا نشان داده می‌شوند.',
    link: '/overview',
  })
  return NextResponse.json({ ok: true, sent: result.sent })
}
