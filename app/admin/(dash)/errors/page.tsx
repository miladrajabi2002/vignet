import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { LevelBadge, fmtDate, AdminPagination } from '../ui'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: { level?: string; page?: string }
}) {
  const level = searchParams.level === 'warn' || searchParams.level === 'error'
    ? searchParams.level
    : undefined
  const page = Math.max(1, Number(searchParams.page) || 1)

  const where: Prisma.ErrorLogWhereInput = level ? { level } : {}

  const errors = await prisma.errorLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      level: true,
      source: true,
      message: true,
      stack: true,
      workspaceId: true,
      createdAt: true,
    },
  })

  const hasNext = errors.length > PAGE_SIZE
  const items = hasNext ? errors.slice(0, PAGE_SIZE) : errors

  const makeHref = (p: number) => {
    const sp = new URLSearchParams()
    if (level) sp.set('level', level)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/admin/errors?${qs}` : '/admin/errors'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light">خطاها</h1>
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 p-1 text-xs">
          <Filter label="همه" href="/admin/errors" active={!level} />
          <Filter label="خطا" href="/admin/errors?level=error" active={level === 'error'} />
          <Filter label="هشدار" href="/admin/errors?level=warn" active={level === 'warn'} />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-600">
          خطایی ثبت نشده
        </p>
      ) : (
        <div className="divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          {items.map((e) => (
            <details key={e.id} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <LevelBadge level={e.level} />
                <span className="text-xs text-zinc-500">{e.source ?? '—'}</span>
                <span className="ms-auto text-[11px] text-zinc-600">{fmtDate(e.createdAt)}</span>
              </summary>
              <p className="mt-2 text-sm text-zinc-300">{e.message}</p>
              {e.workspaceId ? (
                <p className="mt-1 text-[11px] text-zinc-600">workspace: {e.workspaceId}</p>
              ) : null}
              {e.stack ? (
                <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-500">
                  {e.stack}
                </pre>
              ) : null}
            </details>
          ))}
        </div>
      )}

      <AdminPagination page={page} hasNext={hasNext} makeHref={makeHref} />
    </div>
  )
}

function Filter({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1 transition-colors ${
        active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {label}
    </Link>
  )
}
