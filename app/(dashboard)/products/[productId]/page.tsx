import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  Pencil,
  Package,
  Search,
  Bot,
  Boxes,
  Tag,
  ExternalLink,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/format'
import { BackButton } from '@/components/dashboard/back-button'
import { normalizeAttributes } from '@/lib/products/description'
import {
  extractListItems,
  stripListBlocks,
} from '@/lib/products/description'

export default async function ProductDetailPage(
  props: {
    params: Promise<{ productId: string }>
  }
) {
  const params = await props.params;
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

  // ─── Attributes normalization ───────────────────────────────────────────
  // The `attributes` JSON column accepts several shapes depending on the source:
  //
  //   1. Manual product form:   { "color": "blue", "size": "XL" }
  //   2. WooCommerce REST poll: { "color": "blue", "size": "XL" }  (already
  //      flattened by `mapWooProduct` in lib/integrations/woocommerce.ts)
  //   3. WooCommerce webhook:   sometimes { "color": { name, options } } when
  //      the plugin sends a raw attribute object — this is the source of the
  //      `[object Object]` bug.
  //   4. WooCommerce description blob:  the merchant put <ul><li>…</li></ul>
  //      directly inside the description field (or the description is the only
  //      place where attributes live) — this is the source of the raw-HTML
  //      rendering bug.
  //
  // We normalize all of these into a flat `{ label: string, value: string }[]`
  // and also extract any <li> items found inside the description so they show
  // up as proper attribute rows instead of as raw HTML.
  const attributes = normalizeAttributes(product.attributes)

  // If the description contains <ul>…<li>…</li>…</ul> blocks (a common
  // WooCommerce pattern where the merchant puts material/sizing info as a
  // bullet list in the description), extract those <li> items and merge them
  // into the attributes list so they render cleanly instead of as raw HTML.
  const descriptionItems = extractListItems(product.description ?? '')
  const mergedAttributes = [...attributes, ...descriptionItems]

  // Re-render the description without the <ul>/<li> blocks so they don't
  // appear twice (once as attributes, once as raw HTML).
  const cleanDescription = stripListBlocks(product.description ?? '')

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
        <BackButton href="/products" label={t('title')} />
        {/* Edit button — matches the rest of the dashboard's primary-button
            style (min-h-11, rounded-xl, bold) so it doesn't look out of place
            next to the other action buttons. */}
        <Link
          href={`/products/${product.id}/edit`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
        >
          <Pencil className="h-4 w-4" />
          {t('edit')}
        </Link>
      </div>

      {/* Header */}
      <div className="spatial-surface flex flex-col gap-5 rounded-[1.5rem] p-5 sm:flex-row">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[var(--bg-muted)] sm:w-56">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            (<img
              src={product.images[0]}
              alt={product.name}
              width={640}
              height={640}
              decoding="async"
              className="h-full w-full object-cover"
            />)
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
          {/* External product URL — the canonical link on the source store
              (WooCommerce permalink, etc.). Used by the Instagram automation
              engine to render the "View product" button on product cards. */}
          {product.externalUrl && (
            <a
              href={product.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              <ExternalLink className="h-3 w-3" />
              {product.externalUrl.length > 48
                ? `${product.externalUrl.slice(0, 48)}…`
                : product.externalUrl}
            </a>
          )}
          {/* Description — rendered as plain text; <ul>/<li> blocks were
              extracted into the attributes list above so they don't leak raw
              HTML here. */}
          {cleanDescription && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
              {cleanDescription}
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
            className="spatial-surface rounded-[1.5rem] p-5"
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
      <div className="spatial-surface rounded-[1.5rem] p-5">
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

      {/* Attributes — rendered from the normalized list, so <ul>/<li>
          descriptions and `[object Object]` attribute values both resolve
          into clean rows instead of raw HTML / object dumps. */}
      {mergedAttributes.length > 0 && (
        <div className="spatial-surface rounded-[1.5rem] p-5">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            {t('form.attributes')}
          </h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {mergedAttributes.map((attr, idx) => (
              <div
                key={`${attr.label}-${idx}`}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm"
              >
                <dt className="text-[var(--text-muted)]">{attr.label}</dt>
                <dd className="text-[var(--text-primary)]">{attr.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="text-xs text-[var(--text-muted)]">
        {t('detail.updatedAt')}: {formatDateTime(product.updatedAt, locale)}
      </p>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────
// `normalizeAttributes`, `formatAttrValue`, `extractListItems`, and
// `stripListBlocks` live in `lib/products/description.ts` so the Instagram
// automation engine can reuse the same HTML-stripping logic for product card
// subtitles.
