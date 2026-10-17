import Link from 'next/link'
import { Database, ExternalLink, LockKeyhole, RefreshCw } from 'lucide-react'
import { DATABASE_MODELS, readDatabaseModel } from '@/lib/admin/database-explorer'
import { cn } from '@/lib/utils'
import { Badge, EmptyState, PageHeader, fa } from '../ui'
import { DatabaseMobileRows, DatabaseModelPicker } from '@/components/admin/database-mobile-view'

export const dynamic = 'force-dynamic'

export default async function AdminDatabasePage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string; page?: string; studio?: string }>
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
    <div className="space-y-6">
      <PageHeader
        title="دیتابیس"
        subtitle="مرور مستقیم و فقط‌خواندنی داده‌های PostgreSQL از طریق Prisma؛ فیلدهای حساس به‌صورت خودکار مخفی می‌شوند."
        icon={Database}
        action={(
          <>
            {result ? <Badge tone="success">متصل · {result.database}</Badge> : <Badge tone="danger">قطع</Badge>}
            <Link
              href="/admin/database/studio"
              target="_blank"
              rel="noreferrer"
              className="admin-primary-button min-h-10 px-3.5 text-[12px]"
            >
              <ExternalLink className="h-3.5 w-3.5" /> بازکردن Prisma Studio
            </Link>
          </>
        )}
      />

      {params.studio === 'unavailable' && (
        <div role="alert" className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
          آدرس امن Prisma Studio تنظیم نشده است. روی سرور یک‌بار دستور <code dir="ltr">bash deploy/setup-db-studio.sh</code> را اجرا کنید.
        </div>
      )}

      <DatabaseModelPicker models={DATABASE_MODELS.map(({ key, label }) => ({ key, label }))} selectedKey={selectedKey} />

      <div className="grid min-h-[24rem] gap-4 lg:min-h-[36rem] lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="spatial-surface hidden overflow-hidden rounded-card p-2.5 lg:block">
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5 text-[12px] font-semibold text-[var(--text-muted)]">
            <LockKeyhole className="h-3.5 w-3.5" /> فقط‌خواندنی
          </div>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1" aria-label="مدل‌های Prisma">
            {DATABASE_MODELS.map((model) => (
              <Link
                key={model.key}
                href={`/admin/database?model=${model.key}`}
                className={cn(
                  'flex min-h-9 items-center justify-between gap-2 rounded-control px-2.5 text-[12px] transition-colors',
                  selectedKey === model.key ? 'bg-[var(--signal-soft)] font-bold text-[var(--signal-strong)]' : 'text-[var(--text-secondary)] hover:bg-black/[0.045] hover:text-[var(--text-primary)]',
                )}
              >
                <span className="truncate">{model.label}</span>
                <code dir="ltr" className={cn('text-[12px] font-normal', selectedKey === model.key ? 'text-[var(--signal)]' : 'text-[var(--text-muted)]')}>{model.key}</code>
              </Link>
            ))}
          </nav>
        </aside>

        <section className="spatial-surface min-w-0 overflow-hidden rounded-card">
          {error ? (
            <div className="flex min-h-[36rem] flex-col items-center justify-center px-5 text-center">
              <Database className="h-9 w-9 text-red-400" />
              <h2 className="ui-h3 mt-3">اتصال Prisma برقرار نشد</h2>
              <p dir="ltr" className="mt-2 max-w-xl break-words text-xs leading-6 text-[var(--text-muted)]">{error}</p>
            </div>
          ) : result ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><h2 className="ui-h3">{result.model.label}</h2><Badge tone="muted">{fa(result.total)} رکورد</Badge></div>
                  <p dir="ltr" className="mt-1 text-left text-[12px] text-[var(--text-muted)]">{result.version}</p>
                </div>
                <Link href={`/admin/database?model=${result.model.key}&page=${result.page}`} className="admin-toolbar-button" aria-label="تازه‌سازی داده‌ها"><RefreshCw className="h-3.5 w-3.5" /> تازه‌سازی</Link>
              </div>

              {result.rows.length === 0 ? (
                <EmptyState className="m-4 min-h-80" icon={<Database className="h-8 w-8" />}>این مدل هنوز رکوردی ندارد.</EmptyState>
              ) : (
                <>
                <DatabaseMobileRows modelLabel={result.model.label} columns={result.columns} rows={result.rows} />
                <div className="admin-scroll hidden max-h-[34rem] overflow-auto md:block">
                  <table dir="ltr" className="w-max min-w-full text-left">
                    <thead className="sticky top-0 z-10 bg-[var(--bg-surface)]">
                      <tr>{result.columns.map((column) => <th key={column} className="whitespace-nowrap border-b border-black/[0.06] px-3 py-2.5 font-mono text-[12px] font-semibold text-[var(--text-muted)]">{column}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, index) => (
                        <tr key={`${result.model.key}-${result.page}-${index}`} className="border-b border-[var(--border-subtle)] align-top hover:bg-[var(--signal-soft)]">
                          {result.columns.map((column) => <td key={column} className="max-w-[22rem] whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[12px] leading-5 text-[var(--text-secondary)]">{row[column]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}

              <nav aria-label="صفحه‌بندی" className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3 text-xs">
                <Link aria-disabled={result.page <= 1} href={result.page > 1 ? `/admin/database?model=${result.model.key}&page=${result.page - 1}` : '#'} className={cn('admin-toolbar-button', result.page <= 1 && 'pointer-events-none opacity-35')}>قبلی</Link>
                <span className="text-[var(--text-muted)]">صفحه {fa(result.page)} از {fa(totalPages)}</span>
                <Link aria-disabled={result.page >= totalPages} href={result.page < totalPages ? `/admin/database?model=${result.model.key}&page=${result.page + 1}` : '#'} className={cn('admin-toolbar-button', result.page >= totalPages && 'pointer-events-none opacity-35')}>بعدی</Link>
              </nav>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
