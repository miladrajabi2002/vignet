import { AgentConfiguration } from '@/components/agents/agent-configuration'

export default async function AgentSettingsPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  return <AgentConfiguration agentId={agentId} section="general" />
}
