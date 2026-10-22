import { AgentStoreAccess } from '@/components/agents/agent-store-access'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('دسترسی فروشگاه', 'Store access')

export default async function AgentCatalogPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  return (
    <div className="mx-auto w-full max-w-[47.5rem] space-y-6">
      <AgentStoreAccess agentId={agentId} />
    </div>
  )
}
