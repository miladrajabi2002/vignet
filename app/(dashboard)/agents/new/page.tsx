import { AgentWizard } from '@/components/agent-builder/agent-wizard'

const BUSINESSES = new Set(['instagram', 'store', 'services', 'education', 'messaging'])

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>
}) {
  const query = await searchParams
  const business = query.business && BUSINESSES.has(query.business)
    ? query.business
    : undefined

  return (
    <div className="py-4">
      <AgentWizard initialBusiness={business} />
    </div>
  )
}
