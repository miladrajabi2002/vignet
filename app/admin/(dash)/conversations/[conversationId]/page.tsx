import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Bot, MessageSquare, UserRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_RELATED_WHERE } from '@/lib/admin/reporting-scope'
import { PageHeader, Card, Badge, fa, fmtDate } from '../../ui'

export const dynamic = 'force-dynamic'

const CHANNEL_LABEL: Record<string, string> = {
  TELEGRAM: 'تلگرام', WHATSAPP: 'واتساپ', INSTAGRAM: 'اینستاگرام',
  RUBIKA: 'روبیکا', BALE: 'بله', WEB_WIDGET: 'ویجت وب', API: 'API', CHAT_LINK: 'لینک چت',
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'باز', RESOLVED: 'بسته‌شده', HANDED_OFF: 'تحویل به اپراتور',
}

export default async function AdminConversationDetailPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params
  const conversation = await prisma.conversation.findFirst({
    where: { ...ADMIN_VISIBLE_RELATED_WHERE, id: conversationId },
    select: {
      id: true, channel: true, status: true, handedOff: true, summary: true,
      rating: true, messageCount: true, createdAt: true, lastMessageAt: true,
      workspace: { select: { id: true, name: true } },
      agent: { select: { id: true, name: true } },
      contact: { select: { name: true, phone: true } },
      messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, contentType: true, audioUrl: true, createdAt: true } },
    },
  })
  if (!conversation) notFound()
  const contactName = conversation.contact?.name || conversation.contact?.phone || 'مخاطب ناشناس'

  return (
    <div className="space-y-5">
      <PageHeader
        title={`گفتگو با ${contactName}`}
        subtitle={`${conversation.workspace.name} · ${conversation.agent.name}`}
        action={<Link href="/admin/conversations" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"><ArrowRight className="h-4 w-4" /> بازگشت</Link>}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-black text-white"><MessageSquare className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-zinc-900">متن کامل گفتگو</div><div className="mt-0.5 text-[10px] text-zinc-400">{fa(conversation.messages.length)} پیام ثبت‌شده</div></div>
            <Badge tone="muted">{STATUS_LABEL[conversation.status] ?? conversation.status}</Badge>
          </div>

          <div className="max-h-[68vh] min-h-[460px] space-y-4 overflow-y-auto bg-white p-4 sm:p-6">
            {conversation.messages.length ? conversation.messages.map((message) => {
              if (message.role === 'SYSTEM') return <div key={message.id} className="mx-auto max-w-xl rounded-xl bg-zinc-100 px-3 py-2 text-center text-[11px] leading-6 text-zinc-500">{message.content}</div>
              const isUser = message.role === 'USER'
              return (
                <div key={message.id} className={`flex items-end gap-2 ${isUser ? 'justify-start' : 'justify-end'}`}>
                  {isUser && <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-zinc-100"><UserRound className="h-3.5 w-3.5" /></div>}
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${isUser ? 'rounded-br-md border border-zinc-150 bg-white text-zinc-800 shadow-sm' : 'rounded-bl-md bg-black text-white'}`}>
                    <p className="whitespace-pre-wrap text-xs leading-6">{message.content}</p>
                    {message.audioUrl && <audio controls src={message.audioUrl} className="mt-2 max-w-full" />}
                    <time className={`mt-2 block text-[9px] ${isUser ? 'text-zinc-400' : 'text-white/45'}`}>{fmtDate(message.createdAt)}</time>
                  </div>
                  {!isUser && <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-black text-white"><Bot className="h-3.5 w-3.5" /></div>}
                </div>
              )
            }) : <div className="grid min-h-[420px] place-items-center text-xs text-zinc-400">متنی برای این گفتگو ثبت نشده است</div>}
          </div>
        </Card>

        <div className="space-y-3">
          <Card><h2 className="mb-4 text-sm font-bold text-zinc-900">مشخصات گفتگو</h2><dl className="space-y-3 text-xs">{[
            ['کسب‌وکار', conversation.workspace.name], ['ایجنت', conversation.agent.name],
            ['مخاطب', contactName], ['کانال', CHANNEL_LABEL[conversation.channel] ?? conversation.channel],
            ['وضعیت', STATUS_LABEL[conversation.status] ?? conversation.status], ['تعداد پیام', fa(conversation.messageCount)],
            ['شروع', fmtDate(conversation.createdAt)], ['آخرین فعالیت', fmtDate(conversation.lastMessageAt ?? conversation.createdAt)],
          ].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3"><dt className="text-zinc-400">{label}</dt><dd className="text-left font-semibold text-zinc-700">{value}</dd></div>)}</dl></Card>
          {conversation.summary && <Card><h2 className="mb-3 text-sm font-bold text-zinc-900">خلاصه هوشمند</h2><p className="text-xs leading-6 text-zinc-600">{conversation.summary}</p></Card>}
          <Card><h2 className="mb-3 text-sm font-bold text-zinc-900">دسترسی سریع</h2><div className="space-y-2"><Link href={`/admin/agents/${conversation.agent.id}`} className="flex min-h-10 items-center justify-between rounded-xl border border-zinc-100 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"><span>جزئیات ایجنت</span><ArrowRight className="h-3.5 w-3.5 rotate-180" /></Link><Link href={`/admin/workspaces/${conversation.workspace.id}`} className="flex min-h-10 items-center justify-between rounded-xl border border-zinc-100 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"><span>جزئیات کسب‌وکار</span><ArrowRight className="h-3.5 w-3.5 rotate-180" /></Link></div></Card>
        </div>
      </div>
    </div>
  )
}
