import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Plus, FileText, Edit3 } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { toPersianDigits } from '@/lib/blog/helpers'
import { relativeTime } from '@/lib/format'
import { getLocale } from 'next-intl/server'

const STATUS_LABELS_FA: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PUBLISHED: 'منتشر شده',
  SCHEDULED: 'زمان‌بندی شده',
  ARCHIVED: 'بایگانی',
}
const STATUS_LABELS_EN: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  SCHEDULED: 'Scheduled',
  ARCHIVED: 'Archived',
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
  PUBLISHED: 'bg-success/10 text-success',
  SCHEDULED: 'bg-warning/10 text-warning',
  ARCHIVED: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
}

export default async function BlogIndexPage() {
  const user = await requireUser()
  const t = await getTranslations('blog')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

  const [posts, categories] = await Promise.all([
    prisma.blogPost.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: { category: { select: { name: true } } },
      take: 100,
    }),
    prisma.blogCategory.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const statusLabels = locale === 'fa' ? STATUS_LABELS_FA : STATUS_LABELS_EN

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
        </div>
        <Link
          href="/blog/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          {t('newPost')}
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
          <FileText className="h-8 w-8 text-[var(--text-muted)]" />
          <h2 className="mt-4 text-lg text-[var(--text-primary)]">{t('empty')}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('emptyDesc')}</p>
          <Link
            href="/blog/new"
            className="mt-6 rounded-xl bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)]"
          >
            {t('newPost')}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <table className="w-full text-start text-sm">
            <thead className="bg-[var(--bg-base)] text-xs text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('colTitle')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colCategory')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colStatus')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colViews')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colUpdated')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--bg-hover)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-[var(--text-primary)]">
                        {p.title}
                      </span>
                      {p.featured && (
                        <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">
                          {locale === 'fa' ? 'ویژه' : 'Featured'}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      /blog/{p.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {p.category?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[p.status]}`}>
                      {statusLabels[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {locale === 'fa'
                      ? toPersianDigits(p.views)
                      : p.views.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {relativeTime(p.updatedAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/blog/${p.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      <Edit3 className="h-3 w-3" />
                      {t('edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {categories.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">{t('categories')}</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)]"
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
