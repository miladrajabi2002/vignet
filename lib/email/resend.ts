import { Resend } from 'resend'

/**
 * Transactional email via Resend — strictly a secondary channel.
 *
 * Vigent users authenticate by phone (no email on the User model), so email is
 * used only for platform/ops alerts sent to ALERT_EMAIL. Every function degrades
 * gracefully to a no-op when RESEND_API_KEY (or a recipient) is missing, so the
 * app runs fine without email configured.
 */

const FROM = process.env.RESEND_FROM || 'Vigent <alerts@vigent.ir>'

let client: Resend | null = null
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
}

/** Send an email. Returns false (without throwing) when email isn't configured. */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const resend = getClient()
  if (!resend) return false
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    })
    if (error) {
      console.error('[email] send failed:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('[email] send threw:', e)
    return false
  }
}

/**
 * Send a critical platform alert to the configured ops address. No-op when
 * ALERT_EMAIL is unset. Never throws — alerting must not break the main flow.
 */
export async function notifyOps(subject: string, body: string): Promise<void> {
  const to = process.env.ALERT_EMAIL
  if (!to) return
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.6">
      <h2 style="font-weight:500">⚠ Vigent alert</h2>
      <p>${escapeHtml(subject)}</p>
      <pre style="background:#f4f4f4;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(body)}</pre>
      <p style="color:#888;font-size:12px">Sent automatically by the Vigent platform.</p>
    </div>`
  await sendEmail({ to, subject: `[Vigent] ${subject}`, html })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
