import { AgentConfiguration } from '@/components/agents/agent-configuration'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('تنظیمات ایجنت', 'Agent settings')

export default async function AgentSettingsPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  return <AgentConfiguration agentId={agentId} section="general" />
}
