import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { Store } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/dashboard/page-header'
import { StoreIntegrationsSection } from '@/components/integrations/store-integrations-section'
import { StoreAccessPrompt } from '@/components/agents/store-access-prompt'
import { AgentStoreAccess } from '@/components/agents/agent-store-access'
import { loadStoreSection } from '@/lib/integrations/store-section'
import { StatusChip } from '@/components/ui/status-chip'

export const dynamic = 'force-dynamic'

/**
 * The WooCommerce tab: everything about the connected store in one place —
 * the connection and its sync, what the agent may read, and how chat orders
 * are paid. «اتصال‌ها» only links here.
 */
export default async function StorePage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const fa = locale === 'fa'
  const [section, agents] = await Promise.all([
    loadStoreSection(user.workspaceId),
    prisma.agent.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true }, take: 12 }),
  ])
  const primaryAgent = agents[0] ?? null
  const connected = section.integrations.some((integration) => integration.type === 'WOOCOMMERCE')
  const store = section.integrations[0] ?? null
  const storeLive = store ? Boolean(store.connectedAt || store.lastWebhookAt || store.lastSyncAt) : false
  const storeHost = store ? store.storeUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '') : null
  // The header answers "is my store connected?" before anything else.
  const headerChip = !store ? null : !store.active
    ? <StatusChip tone="neutral">{fa ? 'متوقف' : 'Paused'}</StatusChip>
    : !storeLive
      ? <StatusChip tone="neutral" dot>{fa ? 'منتظر افزونه' : 'Waiting'}</StatusChip>
      : store.lastSyncStatus === 'error'
        ? <StatusChip tone="danger" dot>{fa ? 'خطای همگام‌سازی' : 'Sync error'}</StatusChip>
        : <StatusChip tone="ok" dot>{fa ? 'متصل' : 'Connected'}</StatusChip>

  return (
    <div className="mx-auto max-w-none space-y-5 sm:space-y-6">
      <PageHeader
        icon={Store}
        title={fa ? 'ووکامرس' : 'WooCommerce'}
        subtitle={storeHost
          ? <><span dir="ltr">{storeHost}</span>{fa ? ' · اتصال، همگام‌سازی و فروش در گفتگو' : ' · connection, sync and in-chat selling'}</>
          : (fa ? 'اتصال، همگام‌سازی محصول و سفارش، و فروش در گفتگو' : 'Connection, product and order sync, and in-chat selling')}
        actions={headerChip}
        // The store's own colour on the tab icon; phones drop the tile so the title keeps its width.
        className="[&_.page-header-icon]:border-[rgba(127,84,179,0.2)] [&_.page-header-icon]:bg-[#f2edf9] [&_.page-header-icon]:text-[#7f54b3] max-sm:[&_.page-header-icon]:hidden"
      />

      {/* A connected store whose access the owner has not chosen yet. */}
      {section.storeAccessChoice.pending && <StoreAccessPrompt initial={section.storeAccessChoice} />}

      <StoreIntegrationsSection
        integrations={section.integrations}
        planLimits={section.planLimits}
        storeAccessHref={primaryAgent ? '#store-access' : null}
        locale={locale}
      />

      {connected && primaryAgent && (
        <>
          <AgentStoreAccess agentId={primaryAgent.id} />
          {agents.length > 1 && (
            <p className="text-[13px] leading-7 text-[var(--text-muted)]">
              {fa ? `این تنظیم‌ها برای ایجنت «${primaryAgent.name}» است. برای ایجنت‌های دیگر:` : `These settings are for the agent “${primaryAgent.name}”. For your other agents:`}{' '}
              {agents.slice(1).map((agent, index) => (
                <span key={agent.id}>{index > 0 ? (fa ? '، ' : ', ') : ''}<Link href={`/agents/${agent.id}/catalog`} className="ui-link">{agent.name}</Link></span>
              ))}
            </p>
          )}
        </>
      )}
    </div>
  )
}
