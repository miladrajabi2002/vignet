import { AlertTriangle, Inbox } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ADMIN_MAILBOX_ADDRESS } from '@/lib/email/admin-mailbox'
import { AdminMailbox, type AdminMailboxItem } from '@/components/admin/admin-mailbox'
import { PageHeader } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminMailPage() {
  const mailboxReady = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.RESEND_WEBHOOK_SECRET &&
    (process.env.ADMIN_MAIL_FORWARD_TO || process.env.ALERT_EMAIL),
  )
  const rows = await prisma.adminMailboxMessage.findMany({
    orderBy: { receivedAt: 'desc' },
    take: 60,
  })
  const items: AdminMailboxItem[] = rows.map((row) => ({
    id: row.id,
    from: row.from,
    to: row.to,
    subject: row.subject,
    text: row.text,
    preview: row.preview,
    receivedAt: row.receivedAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    repliedAt: row.repliedAt?.toISOString() ?? null,
    replyText: row.replyText,
    attachmentCount: Array.isArray(row.attachments) ? row.attachments.length : 0,
  }))

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Inbox}
        title="صندوق ایمیل"
        subtitle="پیام‌های ورودی را بخوانید و مستقیم از پنل پاسخ بدهید."
        action={<span dir="ltr" className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-black/55 shadow-sm">{ADMIN_MAILBOX_ADDRESS}</span>}
      />
      {!mailboxReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-bold">دریافت ایمیل هنوز فعال نشده است</p>
            <p className="mt-1 text-[11px] leading-5 text-amber-900/65">رکوردهای DNS و تنظیمات Resend را کامل کنید؛ پس از آن پیام‌ها خودکار اینجا می‌آیند و به ایمیل شخصی شما فوروارد می‌شوند.</p>
          </div>
        </div>
      )}
      <AdminMailbox initialItems={items} />
    </div>
  )
}
