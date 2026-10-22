import { redirect } from 'next/navigation'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('دانش ایجنت', 'Agent knowledge')
export default async function AgentKnowledgePage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  redirect(`/agents/${agentId}/improve?tab=knowledge`)
}
