import { prisma } from '@/lib/prisma'
import { fmtDate, AdminPagination } from '../ui'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'باز',
  RESOLVED: 'بسته‌شده',
  HANDED_OFF: 'تحویل به اپراتور',
}

export default async function AdminConversationsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const page = Math.max(1, Number(searchParams.page) || 1)

  const rows = await prisma.conversation.findMany({
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      channel: true,
      status: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true,
      agent: { select: { name: true } },
      workspace: { select: { name: true } },
      contact: { select: { name: true, phone: true } },
    },
  })

  const hasNext = rows.length > PAGE_SIZE
  const items = hasNext ? rows.slice(0, PAGE_SIZE) : rows

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-light">مکالمات</h1>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-600">
          مکالمه‌ای نیست
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-zinc-800 text-xs text-zinc-500">
              <tr>
                <Th>کسب‌وکار</Th>
                <Th>ایجنت</Th>
                <Th>مخاطب</Th>
                <Th>کانال</Th>
                <Th>وضعیت</Th>
                <Th>پیام‌ها</Th>
                <Th>آخرین فعالیت</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((c) => (
                <tr key={c.id} className="text-zinc-300">
                  <Td>{c.workspace.name}</Td>
                  <Td>{c.agent.name}</Td>
                  <Td>{c.contact?.name || c.contact?.phone || '—'}</Td>
                  <Td className="text-zinc-500">{c.channel}</Td>
                  <Td>{STATUS_LABEL[c.status] ?? c.status}</Td>
                  <Td className="text-zinc-500">{c.messageCount.toLocaleString('fa-IR')}</Td>
                  <Td className="text-zinc-500">
                    {fmtDate(c.lastMessageAt ?? c.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination
        page={page}
        hasNext={hasNext}
        makeHref={(p) => (p > 1 ? `/admin/conversations?page=${p}` : '/admin/conversations')}
      />
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-start font-medium">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>
}
