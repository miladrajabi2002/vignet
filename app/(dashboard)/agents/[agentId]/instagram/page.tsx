import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Camera, ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { InstagramAutomationManager } from '@/components/instagram/automation-manager'
import type {
  Automation,
  AutomationTrigger,
  AutomationAction,
} from '@/components/instagram/types'

export const dynamic = 'force-dynamic'

/**
 * Per-agent Instagram automation dashboard. Mirrors Vardast's panel: the
 * operator builds scenarios for DMs, comments and stories. The page is a
 * server component that verifies workspace ownership, loads the Instagram
 * channel + its automations, and delegates the interactive UI to the client
 * manager. When Instagram is not connected, a friendly empty state points the
 * user to the channels tab.
 */
export default async function InstagramAutomationPage(
  props: {
    params: Promise<{ agentId: string }>
  },
) {
  const params = await props.params
  const user = await requireUser()

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: {
      id: true,
      name: true,
      channels: {
        where: { type: 'INSTAGRAM' },
        select: { id: true, config: true },
      },
    },
  })
  if (!agent) notFound()

  const igChannel = agent.channels[0]

  // Not connected — friendly empty state with a link back to channels.
  if (!igChannel) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-muted)]">
            <Camera className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-medium text-[var(--text-primary)]">
            اینستاگرام متصل نیست
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
            برای تنظیم اتوماسیون، ابتدا اینستاگرام را وصل کنید.
          </p>
          <Link
            href={`/agents/${agent.id}/channels`}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            رفتن به اتصالات
          </Link>
        </div>
      </div>
    )
  }

  const rows = await prisma.instagramAutomation.findMany({
    where: { agentId: agent.id, channelId: igChannel.id },
    orderBy: [{ type: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  })

  const automations: Automation[] = rows.map((r) => ({
    id: r.id,
    agentId: r.agentId,
    channelId: r.channelId,
    type: r.type,
    name: r.name,
    active: r.active,
    priority: r.priority,
    trigger: r.trigger as unknown as AutomationTrigger,
    action: r.action as unknown as AutomationAction,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))

  return (
    <div className="mx-auto max-w-3xl">
      <InstagramAutomationManager
        agentId={agent.id}
        channelId={igChannel.id}
        initialAutomations={automations}
        connected
      />
    </div>
  )
}
