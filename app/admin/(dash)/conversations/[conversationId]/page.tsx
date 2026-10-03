import Link from 'next/link'
import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import { Bot, ChevronLeft, MessageSquare, UserRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_RELATED_WHERE } from '@/lib/admin/reporting-scope'
import { PageHeader, Card, Panel, Badge, fa, fmtDate } from '../../ui'
import { ConversationBubble, ConversationText } from '@/components/chat/conversation-bubble'
import { parseProductShowcaseContent } from '@/components/products/product-showcase'
import { ProductShowcaseRail } from '@/components/products/product-showcase-rail'
import { displayPhone } from '@/lib/phone'
import { conversationSessionBoundaries } from '@/lib/conversations/session'
import { ConversationSessionDivider } from '@/components/crm/conversation-session-divider'

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
      messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, role: true, content: true, contentType: true, audioUrl: true, createdAt: true } },
    },
  })
  if (!conversation) notFound()
  const contactName = conversation.contact?.name || displayPhone(conversation.contact?.phone) || 'مخاطب ناشناس'
  const sessionBoundaries = conversationSessionBoundaries(conversation.messages)

  const statusTone = conversation.status === 'RESOLVED' ? 'success' : conversation.status === 'HANDED_OFF' ? 'warning' : 'info'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`گفتگو با ${contactName}`}
        subtitle={`${conversation.workspace.name} · ${conversation.agent.name}`}
        back={{ href: '/admin/conversations', label: 'گفتگوها' }}
        icon={MessageSquare}
        action={<Badge tone={statusTone}>{STATUS_LABEL[conversation.status] ?? conversation.status}</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card pad={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
            <h2 className="ui-h3">متن کامل گفتگو</h2>
            <span className="text-[12px] text-[var(--text-muted)]">{fa(conversation.messages.length)} پیام ثبت‌شده</span>
          </div>

          {/* dir=ltr pins the customer to the visual RIGHT and the agent to the LEFT
              regardless of the RTL admin shell, matching every customer-facing
              surface. Each piece of Persian copy inside keeps its own dir=auto. */}
          <div dir="ltr" className="admin-scroll max-h-[68vh] min-h-[18rem] space-y-4 overflow-y-auto bg-white p-4 sm:p-6 md:min-h-[26rem]">
            {conversation.messages.length ? conversation.messages.map((message) => {
              if (message.role === 'SYSTEM') return <div key={message.id} dir="auto" className="mx-auto max-w-xl break-words rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-center text-[12px] leading-6 text-[var(--text-muted)]">{message.content}</div>
              const isUser = message.role === 'USER'
              const showcase = isUser
                ? { text: message.content, products: [] }
                : parseProductShowcaseContent(message.content)
              const hasShowcase = showcase.products.length > 0
              return (
                <Fragment key={message.id}>
                {sessionBoundaries.has(message.id) && <ConversationSessionDivider />}
                <div key={message.id} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && <div className="grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-[#111] text-white"><Bot className="h-3.5 w-3.5" /></div>}
                  <div className={hasShowcase && !isUser ? 'w-full max-w-[46rem]' : 'max-w-[82%]'}>
                    {(showcase.text || message.audioUrl) && (
                      <ConversationBubble
                        side={isUser ? 'end' : 'start'}
                        tone={isUser ? 'light' : 'accent'}
                        className={`px-4 py-3 text-[13px] leading-6 ${isUser ? 'text-[var(--text-primary)]' : 'bg-black text-white'}`}
                      >
                        {showcase.text && <ConversationText text={showcase.text} className="block" />}
                        {message.audioUrl && <audio controls src={message.audioUrl} className="mt-2 max-w-full" />}
                        <time dir="auto" className={`mt-2 block text-[12px] ${isUser ? 'text-[var(--text-muted)]' : 'text-white/60'}`}>{fmtDate(message.createdAt)}</time>
                      </ConversationBubble>
                    )}
                    {!isUser && hasShowcase && (
                      <ProductShowcaseRail
                        products={showcase.products}
                        locale="fa"
                        compact
                        className="mt-2"
                      />
                    )}
                    {!isUser && hasShowcase && !showcase.text && !message.audioUrl && (
                      <time dir="auto" className="mt-0.5 block px-1 text-[12px] text-[var(--text-muted)]">{fmtDate(message.createdAt)}</time>
                    )}
                  </div>
                  {isUser && <div className="grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-[var(--bg-muted)] text-[var(--text-secondary)]"><UserRound className="h-3.5 w-3.5" /></div>}
                </div>
                </Fragment>
              )
            }) : <div dir="auto" className="grid min-h-[16rem] place-items-center text-xs text-[var(--text-muted)]">متنی برای این گفتگو ثبت نشده است</div>}
          </div>
        </Card>

        <div className="space-y-4">
          <Panel title="مشخصات گفتگو">
            <dl className="divide-y divide-[var(--border-subtle)] text-[13px]">
              {[
                ['کسب‌وکار', conversation.workspace.name], ['ایجنت', conversation.agent.name],
                ['مخاطب', contactName], ['کانال', CHANNEL_LABEL[conversation.channel] ?? conversation.channel],
                ['وضعیت', STATUS_LABEL[conversation.status] ?? conversation.status], ['تعداد پیام', fa(conversation.messageCount)],
                ['شروع', fmtDate(conversation.createdAt)], ['آخرین فعالیت', fmtDate(conversation.lastMessageAt ?? conversation.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 py-2">
                  <dt className="shrink-0 text-[var(--text-muted)]">{label}</dt>
                  <dd className="min-w-0 break-words text-end font-medium text-[var(--text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {conversation.summary && (
            <Panel title="خلاصه هوشمند">
              <p className="text-[13px] leading-7 text-[var(--text-secondary)]">{conversation.summary}</p>
            </Panel>
          )}
          <Panel title="دسترسی سریع">
            <div className="-mx-2 -mb-2 divide-y divide-[var(--border-subtle)]">
              <Link href={`/admin/agents/${conversation.agent.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-control px-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"><span>جزئیات ایجنت</span><ChevronLeft className="h-4 w-4 text-[var(--text-hint)]" aria-hidden /></Link>
              <Link href={`/admin/workspaces/${conversation.workspace.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-control px-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"><span>جزئیات کسب‌وکار</span><ChevronLeft className="h-4 w-4 text-[var(--text-hint)]" aria-hidden /></Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
