import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Plus, Package, FolderTree } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ProductGrid, ProductsToolbar } from '@/components/products/product-grid'
import { Pagination } from '@/components/ui/pagination'
import { DashboardPanel } from '@/components/dashboard/panel'
import { DashboardBarList } from '@/components/dashboard/bar-list'
import { ConversationChart } from '@/components/dashboard/charts/lazy'
import { productsDailyByWorkspace } from '@/lib/dashboard/charts'
import { PageHeader } from '@/components/dashboard/page-header'
import { dateLocaleTag } from '@/lib/localized-date'
import { WooSetupCard, type WooIntegrationState } from '@/components/products/woo-setup-card'
import { CommerceTabs } from '@/components/products/commerce-tabs'
import { BulkDeleteButton } from '@/components/ui/bulk-delete-button'

const PAGE_SIZE = 20

export default async function ProductsPage(
  props: {
    searchParams: Promise<{ q?: string; sort?: string; categoryId?: string; stock?: string; page?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser()
  const t = await getTranslations('products')
  const locale = await getLocale()
  const fa = locale === 'en' ? false : true

  const q = searchParams.q?.trim() ?? ''
  const sort = searchParams.sort ?? 'newest'
  const categoryId = searchParams.categoryId ?? ''
  const stock = ['in_stock', 'out_of_stock'].includes(searchParams.stock ?? '')
    ? searchParams.stock!
    : ''
  const page = Math.max(1, Number(searchParams.page) || 1)

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === 'price_asc'
      ? { price: 'asc' }
      : sort === 'price_desc'
        ? { price: 'desc' }
        : sort === 'queried'
          ? { queryCount: 'desc' }
          : { createdAt: 'desc' }

  const productWhere: Prisma.ProductWhereInput = {
    workspaceId: user.workspaceId,
    ...(categoryId ? { categoryId } : {}),
    ...(stock === 'in_stock'
      ? { OR: [{ stock: null }, { stock: { gt: 0 } }] }
      : stock === 'out_of_stock'
        ? { stock: 0 }
        : {}),
    ...(q
      ? {
          AND: [{
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
            ],
          }],
        }
      : {}),
  }

  // ── Note: we intentionally do NOT fetch syncLogs / "recent events" here.
  //    The recent-events panel was noisy and duplicated what the WooSetupCard
  //    already shows. Removing it keeps the products page focused on the
  //    catalog itself.
  const [products, categories, totalProducts, topProductsByQuery, productTrend7, wooIntegrationRaw] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      orderBy,
      include: { category: { select: { name: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1, // one extra row signals whether a next page exists
    }),
    prisma.productCategory.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.product.count({ where: productWhere }),
    prisma.product.findMany({
      where: { workspaceId: user.workspaceId, queryCount: { gt: 0 } },
      orderBy: { queryCount: 'desc' },
      take: 5,
      select: { name: true, queryCount: true },
    }),
    productsDailyByWorkspace(user.workspaceId, 7),
    prisma.storeIntegration.findFirst({
      where: { workspaceId: user.workspaceId, type: 'WOOCOMMERCE' },
      orderBy: { createdAt: 'desc' },
      // Only fetch the lightweight fields needed for the setup card's status
      // row — we no longer pull the full syncLogs list (recent events are
      // dropped from this page on purpose).
      select: {
        id: true,
        storeUrl: true,
        webhookSecret: true,
        pollIntervalMinutes: true,
        active: true,
        connectedAt: true,
        lastWebhookAt: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        _count: { select: { orders: true, syncLogs: true } },
      },
    }),
  ])

  // Map the raw Prisma row to the client component's expected shape.
  let wooIntegration: WooIntegrationState | null = null
  if (wooIntegrationRaw) {
    wooIntegration = {
      id: wooIntegrationRaw.id,
      storeUrl: wooIntegrationRaw.storeUrl,
      webhookSecret: wooIntegrationRaw.webhookSecret,
      pollIntervalMinutes: wooIntegrationRaw.pollIntervalMinutes,
      active: wooIntegrationRaw.active,
      connectedAt: wooIntegrationRaw.connectedAt?.toISOString() ?? null,
      lastWebhookAt: wooIntegrationRaw.lastWebhookAt?.toISOString() ?? null,
      lastSyncAt: wooIntegrationRaw.lastSyncAt ? wooIntegrationRaw.lastSyncAt.toISOString() : null,
      lastSyncStatus: wooIntegrationRaw.lastSyncStatus,
      lastSyncError: wooIntegrationRaw.lastSyncError,
      hasCredentials: false, // deprecated field, kept for type compat
      _count: {
        orders: wooIntegrationRaw._count.orders,
        syncLogs: wooIntegrationRaw._count.syncLogs,
      },
      // Recent events intentionally omitted — see comment above.
      syncLogs: [],
    }
  }

  const hasNext = products.length > PAGE_SIZE
  const pageProducts = hasNext ? products.slice(0, PAGE_SIZE) : products

  const makeHref = (p: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (sort !== 'newest') sp.set('sort', sort)
    if (categoryId) sp.set('categoryId', categoryId)
    if (stock) sp.set('stock', stock)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/products?${qs}` : '/products'
  }

  // Total pages for the numeric pager. We cap at 1 when there's nothing.
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={Package}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Link
              href="/products/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t('new')}
            </Link>
            <Link
              href="/products/categories"
              aria-label={t('manageCategories')}
              title={t('manageCategories')}
              className="inline-flex min-h-11 w-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-0 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] sm:w-auto sm:px-4"
            >
              <FolderTree className="h-4 w-4" />
              <span className="hidden sm:inline">{t('manageCategories')}</span>
            </Link>
            <BulkDeleteButton
              countEndpoint="/api/products/bulk"
              deleteEndpoint="/api/products/bulk"
              entityLabel={fa ? 'محصولات' : 'products'}
              buttonLabel={fa ? 'حذف همه محصولات' : 'Delete all'}
              compactOnMobile
            />
          </>
        }
      />

      <CommerceTabs
        active="products"
        productsLabel={t('title')}
        ordersLabel={t('orders.title')}
      />

      <WooSetupCard integration={wooIntegration} />

      {/* ─── 7-day trend chart + top products (hidden when filtering/searching) ─── */}
      {!q && !categoryId && !stock && (
        <div className="grid gap-4 lg:grid-cols-2">
          <DashboardPanel
            title={fa ? 'محصولات — ۷ روز' : 'Products — 7 days'}
            subtitle={fa ? `کل: ${totalProducts.toLocaleString('fa-IR')} محصول` : `Total: ${totalProducts.toLocaleString('en-US')} products`}
            action={
              <span className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {productTrend7.total.toLocaleString(fa ? 'fa-IR' : 'en-US')}
              </span>
            }
          >
            <ConversationChart
              data={productTrend7.series.map((value, i) => {
                const d = new Date()
                d.setDate(d.getDate() - (productTrend7.series.length - 1 - i))
                const label = new Intl.DateTimeFormat(dateLocaleTag(fa ? 'fa' : 'en'), {
                  month: 'short',
                  day: 'numeric',
                }).format(d)
                return { label, value }
              })}
            />
          </DashboardPanel>
          <DashboardPanel title={fa ? 'پربازدیدترین محصولات' : 'Most viewed products'} subtitle={fa ? 'بر اساس تعداد جستجو توسط ایجنت' : 'By agent query count'}>
            <DashboardBarList
              data={topProductsByQuery.map((p) => ({ label: p.name, value: p.queryCount }))}
              emptyText={fa ? 'هنوز محصولی جستجو نشده است' : 'No products queried yet'}
            />
          </DashboardPanel>
        </div>
      )}

      {products.length === 0 && !q && !categoryId && !stock ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
          <Package className="h-8 w-8 text-[var(--text-muted)]" />
          <h2 className="mt-4 text-lg text-[var(--text-primary)]">{t('empty')}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('emptyDesc')}</p>
          <Link href="/products/new" className="mt-6 rounded-xl bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)]">
            {t('new')}
          </Link>
        </div>
      ) : (
        <>
          <ProductsToolbar
            categories={categories}
            defaultQuery={q}
            defaultSort={sort}
            defaultCategory={categoryId}
            defaultStock={stock}
            totalResults={totalProducts}
          />
          <ProductGrid products={pageProducts} />
          <Pagination
            page={page}
            totalPages={totalPages}
            hasNext={hasNext}
            makeHref={makeHref}
          />
        </>
      )}
    </div>
  )
}
