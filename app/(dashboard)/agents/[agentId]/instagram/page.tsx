import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Camera, ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { InstagramAutomationManager } from '@/components/instagram/automation-manager'
import {
	DEFAULT_SETTINGS,
	type Automation,
	type AutomationTrigger,
	type AutomationAction,
	type InstagramAutomationSettings,
	type ReplyPolicy,
} from '@/components/instagram/types'

export const dynamic = 'force-dynamic'

/**
 * Per-agent Instagram automation dashboard (v3). Loads the connected IG
 * channel + its automation scenarios + the channel-level
 * `InstagramAutomationSettings`, then mounts the client manager.
 *
 * The form (create/edit) lives on separate routes:
 *   - `/agents/{agentId}/instagram/new?type={tab}` (create)
 *   - `/agents/{agentId}/instagram/{id}/edit`      (edit)
 *
 * v3 settings shape: only `replyPolicy` + `stopWords` + `aiEnabled` are
 * surfaced in the UI (welcomeMessage + followUp* were removed). The backend
 * PATCH treats omitted fields as "skip", so we don't touch them.
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

	// Pull the connected IG account's display info from the channel config.
	const cfg = (igChannel.config ?? {}) as {
		botUsername?: string
		igProfilePictureUrl?: string
	}
	const accountUsername = cfg.botUsername ?? 'vigent.bot'
	const accountAvatarUrl = cfg.igProfilePictureUrl || undefined

	const [rows, settingsRow] = await Promise.all([
		prisma.instagramAutomation.findMany({
			where: { agentId: agent.id, channelId: igChannel.id },
			orderBy: [{ type: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
		}),
		// InstagramAutomationSettings is a model added by BACKEND-AUTO-V2.
		// Look it up by the @unique `agentId` field. Wrapped in optional
		// chaining so the page compiles even before `prisma generate` has run
		// for the new model.
		(prisma as unknown as {
			instagramAutomationSettings?: {
				findUnique: (args: {
					where: { agentId: string }
				}) => Promise<Record<string, unknown> | null>
			}
		}).instagramAutomationSettings?.findUnique({
			where: { agentId: agent.id },
		}),
	])

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

	const settings = normalizeSettings(settingsRow)

	return (
		<div className="mx-auto max-w-6xl">
			<InstagramAutomationManager
				agentId={agent.id}
				channelId={igChannel.id}
				accountUsername={accountUsername}
				accountAvatarUrl={accountAvatarUrl}
				initialAutomations={automations}
				initialSettings={settings}
				connected
			/>
		</div>
	)
}

/** Coerce an unknown settings blob into a fully-typed InstagramAutomationSettings (v3). */
function normalizeSettings(raw: unknown): InstagramAutomationSettings {
	if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS
	const s = raw as Record<string, unknown>
	const replyPolicy = (
		['ALL_AGENT', 'AGENT_EXCEPT_SCENARIOS', 'AUTOMATION_ONLY'].includes(
			String(s.replyPolicy ?? ''),
		)
			? s.replyPolicy
			: 'AGENT_EXCEPT_SCENARIOS'
	) as ReplyPolicy
	return {
		replyPolicy,
		stopWords: Array.isArray(s.stopWords)
			? s.stopWords.filter((x): x is string => typeof x === 'string')
			: [],
		aiEnabled: typeof s.aiEnabled === 'boolean' ? s.aiEnabled : true,
	}
}
