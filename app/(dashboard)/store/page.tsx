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

  return (
    <div className="mx-auto max-w-none space-y-6">
      <PageHeader
        icon={Store}
        title={fa ? 'ووکامرس' : 'WooCommerce'}
        subtitle={fa
          ? 'اتصال سایت، همگام‌سازی محصول و سفارش، و فروش در گفتگو؛ همه در همین صفحه.'
          : 'The store connection, product and order sync, and in-chat selling — all on this page.'}
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
