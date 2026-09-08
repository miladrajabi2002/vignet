import { redirect } from 'next/navigation'
export default async function AgentLearningPage({ params, searchParams }: {
  params: Promise<{ agentId: string }>; searchParams: Promise<{ view?: string; page?: string }>
}) {
  const { agentId } = await params
  const query = await searchParams
  const next = new URLSearchParams({ tab: 'learning' })
  if (query.view === 'approved') next.set('view', 'approved')
  if (query.page && /^\d+$/.test(query.page)) next.set('page', query.page)
  redirect(`/agents/${agentId}/improve?${next}`)
}
