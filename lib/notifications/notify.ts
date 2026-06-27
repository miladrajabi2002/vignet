import { sendEmail, notifyOps } from '@/lib/email/resend'
import { sendSms } from '@/lib/sms/smsir'

/**
 * A unified notification job. The dispatcher routes to email, SMS, or the ops
 * alert channel. Processing never throws — a failed notification is logged and
 * dropped rather than retried into the caller.
 */
export type NotificationJobData =
  | { kind: 'email'; to: string | string[]; subject: string; html: string }
  | { kind: 'sms'; to: string; message: string }
  | { kind: 'ops'; subject: string; body: string }

export async function processNotification(
  data: NotificationJobData,
): Promise<void> {
  try {
    switch (data.kind) {
      case 'email':
        await sendEmail({ to: data.to, subject: data.subject, html: data.html })
        return
      case 'sms':
        await sendSms(data.to, data.message)
        return
      case 'ops':
        await notifyOps(data.subject, data.body)
        return
    }
  } catch (e) {
    console.error('[notifications] delivery failed:', e)
  }
}
