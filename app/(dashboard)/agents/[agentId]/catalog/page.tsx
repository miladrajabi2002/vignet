import { redirect } from 'next/navigation'
export default async function AgentCatalogPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  redirect(`/agents/${agentId}/settings#store-access`)
}
