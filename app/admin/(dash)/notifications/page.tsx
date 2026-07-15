import { BellRing, History, Send } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { AdminBroadcastForm } from '@/components/admin/admin-broadcast-form'
import { PageHeader, Card, fa, fmtDate } from '../ui'

export const dynamic = 'force-dynamic'

function phone(value: string) {
  const normalized = value.replace(/\D/g, '')
  if (normalized.startsWith('0098')) return `0${normalized.slice(4)}`
  if (normalized.startsWith('98')) return `0${normalized.slice(2)}`
  return normalized
}

export default async function AdminNotificationsPage() {
  const [users, history, notificationCount] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, name: true, phone: true, workspace: { select: { name: true, plan: true } } } }),
    prisma.adminAuditLog.findMany({ where: { action: 'ADMIN_BROADCAST' }, orderBy: { createdAt: 'desc' }, take: 12, select: { id: true, targetType: true, targetId: true, payload: true, createdAt: true } }),
    prisma.notification.count({ where: { type: 'SYSTEM' } }),
  ])

  return (
    <div className="space-y-5">
      <PageHeader title="ارسال پیام" subtitle="ارسال تکی یا گروهی اعلان داخل پنل و پیامک" />
      <div className="grid grid-cols-2 gap-3"><Card className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-black text-white"><BellRing className="h-5 w-5" /></div><div><div className="text-lg font-black text-zinc-950">{fa(notificationCount)}</div><div className="text-[10px] text-zinc-400">اعلان سیستمی ثبت‌شده</div></div></Card><Card className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-100"><Send className="h-5 w-5" /></div><div><div className="text-lg font-black text-zinc-950">{fa(history.length)}</div><div className="text-[10px] text-zinc-400">ارسال مدیریتی اخیر</div></div></Card></div>
      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AdminBroadcastForm users={users.map((user) => ({ id: user.id, name: user.name || 'بدون نام', phone: phone(user.phone), workspace: user.workspace.name, plan: user.workspace.plan }))} />
        <Card><div className="mb-4 flex items-center gap-2"><History className="h-4 w-4" /><h2 className="text-sm font-bold text-zinc-900">تاریخچه ارسال‌ها</h2></div><div className="space-y-2">{history.length ? history.map((item) => { const payload = item.payload as Record<string, unknown>; return <div key={item.id} className="rounded-xl border border-zinc-100 p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-zinc-800">{String(payload.title ?? 'پیام مدیریتی')}</span><span className="shrink-0 text-[9px] text-zinc-400">{fmtDate(item.createdAt)}</span></div><p className="mt-2 text-[10px] text-zinc-500">{payload.channel === 'both' ? 'اعلان و پیامک' : payload.channel === 'sms' ? 'پیامک' : 'اعلان'} · {fa(Number(payload.workspaceCount ?? 0))} کسب‌وکار</p></div> }) : <p className="py-8 text-center text-xs text-zinc-400">هنوز ارسالی ثبت نشده است</p>}</div></Card>
      </div>
    </div>
  )
}
