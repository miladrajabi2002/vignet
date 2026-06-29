import { prisma } from '@/lib/prisma'
import { fmtDate } from '../ui'

export const dynamic = 'force-dynamic'

const SILENT_AFTER_MS = 48 * 60 * 60 * 1000 // a channel silent >48h is suspect

export default async function AdminAgentsPage() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      name: true,
      active: true,
      createdAt: true,
      workspace: { select: { name: true } },
      _count: { select: { conversations: true } },
      channels: {
        select: { id: true, type: true, active: true, lastInboundAt: true },
      },
    },
  })

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-light">ایجنت‌ها و کانال‌ها</h1>

      {agents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-600">
          ایجنتی ساخته نشده
        </p>
      ) : (
        <div className="space-y-3">
          {agents.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">{a.name}</span>
                <span className="text-xs text-zinc-500">· {a.workspace.name}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                    a.active
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-zinc-700/40 text-zinc-400'
                  }`}
                >
                  {a.active ? 'فعال' : 'غیرفعال'}
                </span>
                <span className="ms-auto text-[11px] text-zinc-600">
                  {a._count.conversations.toLocaleString('fa-IR')} مکالمه
                </span>
              </div>

              {a.channels.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.channels.map((ch) => {
                    const health = channelHealth(ch.active, ch.lastInboundAt)
                    return (
                      <span
                        key={ch.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                        {ch.type}
                        <span className="text-[10px] text-zinc-600">
                          {ch.lastInboundAt ? fmtDate(ch.lastInboundAt) : 'بدون پیام'}
                        </span>
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-600">بدون کانال متصل</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function channelHealth(active: boolean, lastInboundAt: Date | null) {
  if (!active) return { dot: 'bg-zinc-600' }
  if (!lastInboundAt) return { dot: 'bg-amber-400' }
  const silent = Date.now() - lastInboundAt.getTime() > SILENT_AFTER_MS
  return { dot: silent ? 'bg-amber-400' : 'bg-emerald-400' }
}
