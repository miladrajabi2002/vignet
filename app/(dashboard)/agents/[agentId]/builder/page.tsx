import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { Node, Edge } from '@xyflow/react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { FlowEditor } from '@/components/agent-builder/flow-editor'

export default async function AgentBuilderPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('builder')

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, name: true, flowConfig: true },
  })
  if (!agent) notFound()

  const flow = (agent.flowConfig as { nodes?: Node[]; edges?: Edge[] } | null) ?? {}
  const initialNodes = Array.isArray(flow.nodes) ? flow.nodes : []
  const initialEdges = Array.isArray(flow.edges) ? flow.edges : []

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {t('subtitle')}
        </p>
      </div>

      <FlowEditor
        agentId={agent.id}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </div>
  )
}
