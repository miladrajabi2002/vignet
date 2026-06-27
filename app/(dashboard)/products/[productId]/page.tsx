import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  ArrowLeft,
  Pencil,
  Package,
  Search,
  Bot,
  Boxes,
  Tag,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/format'

export default async function ProductDetailPage({
  params,
}: {
  params: { productId: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('products')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const fmt = (n: number) => n.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')

  const product = await prisma.product.findFirst({
    where: { id: params.productId, workspaceId: user.workspaceId },
    include: {
      category: { select: { name: true } },
      catalogItems: {
        select: { agent: { select: { id: true, name: true } } },
      },
    },
  })
  if (!product) notFound()

  const stockLabel =
    product.stock === null
      ? t('unlimited')
      : product.stock > 0
        ? `${fmt(product.stock)}`
        : t('outOfStock')

  const attributes =
    product.attributes && typeof product.attributes === 'object'
      ? Object.entries(product.attributes as Record<string, unknown>)
      : []

  const stats = [
    {
      icon: Search,
      label: t('detail.queryCount'),
      value: fmt(product.queryCount),
    },
    {
      icon: Bot,
      label: t('detail.agentCoverage'),
      value: fmt(product.catalogItems.length),
    },
    {
      icon: Boxes,
      label: t('detail.stock'),
      value: stockLabel,
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('title')}
        </Link>
        <Link
          href={`/products/${product.id}/edit`}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <Pencil className="h-4 w-4" />
          {t('edit')}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:flex-row">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[var(--bg-muted)] sm:w-56">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--text-hint)]">
              <Package className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-light text-[var(--text-primary)]">
              {product.name}
            </h1>
            {!product.active && (
              <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                {t('detail.inactive')}
              </span>
            )}
          </div>
          {product.category && (
            <span className="mt-1 inline-block text-sm text-[var(--text-muted)]">
              {product.category.name}
            </span>
          )}
          <div className="mt-3 flex items-baseline gap-2">
            {product.price != null && (
              <span className="text-xl text-[var(--text-primary)]">
                {fmt(product.price)}{' '}
                <span className="text-sm text-[var(--text-muted)]">
                  {t('toman')}
                </span>
              </span>
            )}
            {product.comparePrice != null && (
              <span className="text-sm text-[var(--text-muted)] line-through">
                {fmt(product.comparePrice)}
              </span>
            )}
          </div>
          {product.sku && (
            <p className="mt-2 text-xs text-[var(--text-muted)]" dir="ltr">
              SKU: {product.sku}
            </p>
          )}
          {product.description && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {product.description}
            </p>
          )}
          {product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analytics stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
          >
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <s.icon className="h-4 w-4" />
              {s.label}
            </div>
            <p className="mt-2 text-2xl font-light text-[var(--text-primary)]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Agent coverage */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">
          {t('detail.knownByAgents')}
        </h2>
        {product.catalogItems.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {t('detail.noAgents')}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {product.catalogItems.map(({ agent }) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <Bot className="h-3.5 w-3.5" />
                {agent.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Attributes */}
      {attributes.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            {t('form.attributes')}
          </h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {attributes.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm"
              >
                <dt className="text-[var(--text-muted)]">{key}</dt>
                <dd className="text-[var(--text-primary)]">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        {t('detail.updatedAt')}: {formatDateTime(product.updatedAt, locale)}
      </p>
    </div>
  )
}
