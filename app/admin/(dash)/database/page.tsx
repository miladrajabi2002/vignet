import Link from 'next/link'
import { Database, LockKeyhole, RefreshCw } from 'lucide-react'
import { DATABASE_MODELS, readDatabaseModel } from '@/lib/admin/database-explorer'
import { cn } from '@/lib/utils'
import { Badge, EmptyState, PageHeader, fa } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminDatabasePage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string; page?: string }>
}) {
  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page) || 1)

  let result: Awaited<ReturnType<typeof readDatabaseModel>> | null = null
  let error: string | null = null
  try {
    result = await readDatabaseModel(params.model ?? DATABASE_MODELS[0].key, currentPage)
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'اتصال به دیتابیس برقرار نشد.'
  }

  const selectedKey = result?.model.key ?? params.model ?? DATABASE_MODELS[0].key
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-5">
      <PageHeader
        title="دیتابیس Prisma"
        subtitle="مرور مستقیم و فقط‌خواندنی داده‌های PostgreSQL از طریق Prisma؛ فیلدهای حساس به‌صورت خودکار مخفی می‌شوند."
        icon={Database}
        action={result ? <Badge tone="success">متصل · {result.database}</Badge> : <Badge tone="danger">قطع</Badge>}
      />

      <div className="grid min-h-[36rem] gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="spatial-surface overflow-hidden rounded-[1.5rem] p-2.5">
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold text-black/45">
            <LockKeyhole className="h-3.5 w-3.5" /> فقط‌خواندنی
          </div>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1" aria-label="مدل‌های Prisma">
            {DATABASE_MODELS.map((model) => (
              <Link
                key={model.key}
                href={`/admin/database?model=${model.key}`}
                className={cn(
                  'flex min-h-9 items-center justify-between gap-2 rounded-xl px-2.5 text-[11px] transition-colors',
                  selectedKey === model.key ? 'bg-black font-bold text-white' : 'text-black/55 hover:bg-black/[0.045] hover:text-black',
                )}
              >
                <span className="truncate">{model.label}</span>
                <code dir="ltr" className={cn('text-[9px]', selectedKey === model.key ? 'text-white/45' : 'text-black/25')}>{model.key}</code>
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[1.5rem] border border-black/[0.07] bg-white/85 shadow-[var(--shadow-card)]">
          {error ? (
            <div className="flex min-h-[36rem] flex-col items-center justify-center px-5 text-center">
              <Database className="h-9 w-9 text-red-400" />
              <h2 className="mt-3 text-sm font-bold text-zinc-900">اتصال Prisma برقرار نشد</h2>
              <p dir="ltr" className="mt-2 max-w-xl break-words text-xs leading-6 text-zinc-500">{error}</p>
            </div>
          ) : result ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3.5">
                <div>
                  <div className="flex items-center gap-2"><h2 className="text-sm font-bold text-black">{result.model.label}</h2><Badge tone="muted">{fa(result.total)} رکورد</Badge></div>
                  <p dir="ltr" className="mt-1 text-left text-[10px] text-black/35">{result.version}</p>
                </div>
                <Link href={`/admin/database?model=${result.model.key}&page=${result.page}`} className="admin-toolbar-button" aria-label="تازه‌سازی داده‌ها"><RefreshCw className="h-3.5 w-3.5" /> تازه‌سازی</Link>
              </div>

              {result.rows.length === 0 ? (
                <EmptyState className="m-4 min-h-80" icon={<Database className="h-8 w-8" />}>این مدل هنوز رکوردی ندارد.</EmptyState>
              ) : (
                <div className="max-h-[34rem] overflow-auto [scrollbar-width:thin]">
                  <table dir="ltr" className="w-max min-w-full text-left">
                    <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur-xl">
                      <tr>{result.columns.map((column) => <th key={column} className="whitespace-nowrap border-b border-black/[0.06] px-3 py-2.5 font-mono text-[10px] font-semibold text-zinc-500">{column}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, index) => (
                        <tr key={`${result.model.key}-${result.page}-${index}`} className="border-b border-black/[0.045] align-top hover:bg-blue-50/35">
                          {result.columns.map((column) => <td key={column} className="max-w-[22rem] whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[10px] leading-5 text-zinc-600">{row[column]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <nav className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3 text-xs">
                <Link aria-disabled={result.page <= 1} href={result.page > 1 ? `/admin/database?model=${result.model.key}&page=${result.page - 1}` : '#'} className={cn('admin-toolbar-button', result.page <= 1 && 'pointer-events-none opacity-35')}>قبلی</Link>
                <span className="text-black/45">صفحه {fa(result.page)} از {fa(totalPages)}</span>
                <Link aria-disabled={result.page >= totalPages} href={result.page < totalPages ? `/admin/database?model=${result.model.key}&page=${result.page + 1}` : '#'} className={cn('admin-toolbar-button', result.page >= totalPages && 'pointer-events-none opacity-35')}>بعدی</Link>
              </nav>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
