import type { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { dispatchNotification } from '@/lib/queue/jobs'
import { captureError } from '@/lib/errors/capture'

export interface NotifyParams {
  workspaceId: string
  type: NotificationType
  title: string
  body?: string
  /** In-app deep link, e.g. /conversations/<id>. */
  link?: string
  /** Also text the workspace owner (critical alerts only — SMS costs money). */
  sms?: boolean
  /** Also send an ops email to ALERT_EMAIL (platform monitoring). */
  opsEmail?: boolean
}

/**
 * Create an in-app notification (the dashboard bell) and optionally fan out to
 * SMS (the workspace owner) and an ops email. Never throws — a failed
 * notification must not break the action that triggered it.
 *
 * Users authenticate by phone (no email on the User model), so customer-facing
 * delivery beyond the bell is SMS; email is reserved for ALERT_EMAIL ops alerts.
 */
export async function notifyWorkspace(params: NotifyParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        workspaceId: params.workspaceId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
      },
    })
  } catch (e) {
    captureError('notify:create', e, { workspaceId: params.workspaceId })
  }

  const text = params.body ? `${params.title}\n${params.body}` : params.title

  if (params.sms) {
    try {
      const owner = await prisma.user.findFirst({
        where: { workspaceId: params.workspaceId },
        orderBy: { createdAt: 'asc' }, // the first user is the OWNER
        select: { phone: true },
      })
      if (owner?.phone) {
        await dispatchNotification({ kind: 'sms', to: owner.phone, message: text })
      }
    } catch (e) {
      captureError('notify:sms', e, { workspaceId: params.workspaceId })
    }
  }

  if (params.opsEmail) {
    try {
      await dispatchNotification({ kind: 'ops', subject: params.title, body: text })
    } catch (e) {
      captureError('notify:ops', e, { workspaceId: params.workspaceId })
    }
  }
}
