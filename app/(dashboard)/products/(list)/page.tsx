import { LowStockCard } from '@/components/products/low-stock-card'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { Plus, Package, FolderTree } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ProductGrid, ProductsToolbar } from '@/components/products/product-grid'
import { ProductTable } from '@/components/products/product-table'
import { cn } from '@/lib/utils'
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
import { PlanLimitNotice, type PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { checkWorkspaceResourceCreateAllowed } from '@/lib/billing/entitlements'
import { getEffectivePlanDefs, planResourceLimit, recommendedUpgradePlan } from '@/lib/billing/plans'
import { searchVariants } from '@/lib/search/persian'
import { LiveEmptyState } from '@/components/ui/live-empty-state'
import { PRODUCTS_VIEW_COOKIE } from '@/lib/products/view-preference'

const PAGE_SIZE = 20

export default async function ProductsPage(
  props: {
    searchParams: Promise<{ q?: string; sort?: string; categoryId?: string; stock?: string; page?: string; view?: string }>
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
  const stock = ['in_stock', 'out_of_stock', 'low_stock', 'hidden'].includes(searchParams.stock ?? '')
    ? searchParams.stock!
    : ''
  // An explicit ?view= wins; otherwise the last view this browser picked.
  const savedView = (await cookies()).get(PRODUCTS_VIEW_COOKIE)?.value
  const view = searchParams.view === 'cards' || searchParams.view === 'table'
    ? searchParams.view
    : savedView === 'cards' ? 'cards' : 'table'
  const page = Math.max(1, Number(searchParams.page) || 1)

  const stockAlert = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { lowStockThreshold: true, operatorChannels: { where: { active: true }, select: { operatorChatId: true }, take: 1 } },
  })
  const lowStockThreshold = stockAlert?.lowStockThreshold ?? 3
  // Tracked stock at or under the level: products using the default level,
  // plus any product already alerted under its own override.
  const lowStockWhere: Prisma.ProductWhereInput = {
    stock: { not: null },
    OR: [
      { lowStockAlertedAt: { not: null } },
      ...(lowStockThreshold > 0 ? [{ lowStockThreshold: null, stock: { lte: lowStockThreshold } }] : []),
    ],
  }

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
        : stock === 'low_stock'
          ? lowStockWhere
          : stock === 'hidden'
            ? { active: false }
            : {}),
    ...(q
      ? {
          AND: [{
            OR: searchVariants(q).flatMap((term): Prisma.ProductWhereInput[] => [
              { name: { contains: term, mode: 'insensitive' } },
              { sku: { contains: term, mode: 'insensitive' } },
            ]),
          }],
        }
      : {}),
  }

  // ── Note: we intentionally do NOT fetch syncLogs / "recent events" here.
  //    The recent-events panel was noisy and duplicated what the WooSetupCard
  //    already shows. Removing it keeps the products page focused on the
  //    catalog itself.
  const [products, categories, totalProducts, topProductsByQuery, productTrend7, wooIntegrationRaw, productCapacity, planDefs, lowStockCount, trackedStockCount, allCount, inStockCount, outOfStockCount, hiddenCount] = await Promise.all([
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
        _count: { select: { orders: { where: { deletedAt: null } }, syncLogs: true } },
      },
    }),
    checkWorkspaceResourceCreateAllowed(user.workspaceId, 'products'),
    getEffectivePlanDefs(),
    prisma.product.count({ where: { workspaceId: user.workspaceId, active: true, ...lowStockWhere } }),
    prisma.product.count({ where: { workspaceId: user.workspaceId, stock: { not: null } } }),
    // Counts for the status tabs: the whole catalog, not the current search.
    prisma.product.count({ where: { workspaceId: user.workspaceId } }),
    prisma.product.count({ where: { workspaceId: user.workspaceId, OR: [{ stock: null }, { stock: { gt: 0 } }] } }),
    prisma.product.count({ where: { workspaceId: user.workspaceId, stock: 0 } }),
    prisma.product.count({ where: { workspaceId: user.workspaceId, active: false } }),
  ])

  const recommendedPlan = recommendedUpgradePlan(
    planDefs,
    productCapacity.plan,
    'products',
    productCapacity.used,
  )
  const productLimit: PlanLimitInfo = {
    resource: 'products',
    plan: productCapacity.plan,
    used: productCapacity.used,
    limit: productCapacity.limit,
    recommendedPlan,
    recommendedLimit: recommendedPlan ? planResourceLimit(planDefs[recommendedPlan], 'products') : null,
  }

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
    if (view === 'cards') sp.set('view', 'cards')
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/products?${qs}` : '/products'
  }

  // Total pages for the numeric pager. We cap at 1 when there's nothing.
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE))

  const nf = (value: number) => value.toLocaleString(fa ? 'fa-IR' : 'en-US')
  const tabHref = (key: string) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (sort !== 'newest') sp.set('sort', sort)
    if (categoryId) sp.set('categoryId', categoryId)
    if (key) sp.set('stock', key)
    if (view === 'cards') sp.set('view', 'cards')
    const qs = sp.toString()
    return qs ? `/products?${qs}` : '/products'
  }
  const statusTabs = [
    { key: '', label: fa ? 'همه' : 'All', count: allCount, tone: '' },
    { key: 'in_stock', label: t('inStock'), count: inStockCount, tone: '' },
    ...(trackedStockCount > 0 ? [{ key: 'low_stock', label: t('lowStock'), count: lowStockCount, tone: lowStockCount > 0 ? 'warn' : '' }] : []),
    { key: 'out_of_stock', label: t('outOfStock'), count: outOfStockCount, tone: outOfStockCount > 0 ? 'danger' : '' },
    { key: 'hidden', label: fa ? 'پنهان' : 'Hidden', count: hiddenCount, tone: '' },
  ]
  const storeLabel = !wooIntegration
    ? (fa ? 'اتصال فروشگاه' : 'Connect a store')
    : wooIntegration.active
      ? (wooIntegration.lastSyncStatus === 'error' || wooIntegration.lastSyncError ? (fa ? 'فروشگاه: خطا در همگام‌سازی' : 'Store: sync error') : (fa ? 'فروشگاه: همگام' : 'Store: synced'))
      : (fa ? 'فروشگاه: همگام‌سازی خاموش' : 'Store: sync is off')
  const storeTone: 'ok' | 'warn' | 'neutral' = !wooIntegration || !wooIntegration.active ? 'neutral' : wooIntegration.lastSyncError ? 'warn' : 'ok'
  const storeCard = (
    <WooSetupCard
      integration={wooIntegration}
      productLimit={!productCapacity.allowed ? productLimit : null}
    />
  )
  const emptyCatalog = products.length === 0 && !q && !categoryId && !stock

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={Package}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {/* At the limit the notice under the tabs carries the upgrade; no second button for it here. */}
            {productCapacity.allowed && (
              <Link
                href="/products/new"
                aria-label={t('new')}
                title={t('new')}
                className="inline-flex min-h-11 w-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-0 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 sm:w-auto sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t('new')}</span>
              </Link>
            )}
            <Link
              href="/products/categories"
              aria-label={t('manageCategories')}
              title={t('manageCategories')}
              className="spatial-press inline-flex min-h-11 w-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-0 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:w-auto sm:px-4"
            >
              <FolderTree className="h-4 w-4" />
              <span className="hidden sm:inline">{t('manageCategories')}</span>
            </Link>
            <BulkDeleteButton
              countEndpoint="/api/products/bulk"
              deleteEndpoint="/api/products/bulk"
              restoreEndpoint="/api/products/bulk/restore"
              undoKind="product"
              entityLabel={fa ? 'محصولات' : 'products'}
              entitySingularLabel={fa ? 'محصول' : 'product'}
              buttonLabel={t('deleteAll')}
              compactOnMobile
            />
          </>
        }
      />

      <CommerceTabs
        active="products"
        productsLabel={t('title')}
        ordersLabel={t('orders.title')}
        requestsLabel={t('orders.requestsTab')}
      />

      {!productCapacity.allowed && (
        <PlanLimitNotice limit={productLimit} locale={fa ? 'fa' : 'en'} />
      )}

      {emptyCatalog ? (
        <>
          {storeCard}
          <LiveEmptyState icon={Package} preview="cards" title={t('empty')} description={t('emptyDesc')} action={{ href: '/products/new', label: t('new') }} />
        </>
      ) : (
        <>
          {/* Stock state is the first cut of a catalog, so the counts are the tabs.
              Phones pick stock in the filter sheet instead, so the tabs are desktop only. */}
          <nav aria-label={t('stockFilter')} className="-mb-2 hidden gap-1 md:flex overflow-x-auto border-b border-[var(--border-subtle)] [scrollbar-width:none]">
            {statusTabs.map((tab) => {
              const active = stock === tab.key
              return (
                <Link
                  key={tab.key || 'all'}
                  href={tabHref(tab.key)}
                  scroll={false}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    '-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]',
                    active
                      ? 'border-[var(--text-primary)] font-bold text-[var(--text-primary)]'
                      : 'border-transparent font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {tab.label}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[12px] font-bold leading-none tabular-nums', tab.tone === 'warn' ? 'bg-amber-100 text-amber-900' : tab.tone === 'danger' ? 'bg-red-50 text-red-700' : 'bg-black/[0.06] text-[var(--text-secondary)]')}>{nf(tab.count)}</span>
                </Link>
              )
            })}
          </nav>

          <ProductsToolbar
            categories={categories}
            defaultQuery={q}
            defaultSort={sort}
            defaultCategory={categoryId}
            defaultStock={stock}
            totalResults={totalProducts}
            view={view}
            storeLabel={storeLabel}
            storeTone={storeTone}
            storeCard={storeCard}
          />

          {/* The alert level lives with the products it is about. */}
          {stock === 'low_stock' && (
            <LowStockCard
              fa={fa}
              lowCount={lowStockCount}
              threshold={lowStockThreshold}
              telegramConnected={Boolean(stockAlert?.operatorChannels[0]?.operatorChatId)}
              filtering
            />
          )}

          {pageProducts.length === 0 ? (
            <p className="rounded-card border border-dashed border-[var(--border-default)] px-4 py-10 text-center text-[13px] text-[var(--text-muted)]">
              {fa ? 'محصولی با این فیلتر پیدا نشد.' : 'No product matches this filter.'}
            </p>
          ) : view === 'cards' ? (
            <ProductGrid products={pageProducts} />
          ) : (
            <ProductTable
              products={pageProducts}
              lowStockThreshold={lowStockThreshold}
              storeSynced={Boolean(wooIntegration?.active)}
            />
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            hasNext={hasNext}
            makeHref={makeHref}
          />
        </>
      )}

      {/* ─── 7-day trend chart + top products: under the list, hidden when filtering/searching ─── */}
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
    </div>
  )
}
