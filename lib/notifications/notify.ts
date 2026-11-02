import type { NotificationType } from '@prisma/client'
import { sendEmail, notifyOps } from '@/lib/email/resend'
import { sendWorkspacePush } from '@/lib/notifications/web-push'

/**
 * A unified notification job. The dispatcher routes to email or the ops
 * alert channel. Processing never throws — a failed notification is logged and
 * dropped rather than retried into the caller.
 */
export type NotificationJobData =
  | { kind: 'email'; to: string | string[]; subject: string; html: string }
  | { kind: 'ops'; subject: string; body: string }
  | { kind: 'push'; workspaceId: string; type: NotificationType; title: string; body?: string | null; link?: string | null }

export async function processNotification(
  data: NotificationJobData,
): Promise<void> {
  try {
    switch (data.kind) {
      case 'email':
        await sendEmail({ to: data.to, subject: data.subject, html: data.html })
        return
      case 'ops':
        await notifyOps(data.subject, data.body)
        return
      case 'push':
        await sendWorkspacePush(data)
        return
    }
  } catch (e) {
    console.error('[notifications] delivery failed:', e)
  }
}
