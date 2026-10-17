'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { MessageSquareMore } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { GatewayAgentRow } from '@/lib/payments/card/dashboard'

/**
 * The setup's last question: should the agent take the payment inside the
 * chat with this gateway? One switch per agent (the same choice «تنظیمات ›
 * پرداخت سفارش‌های چت» holds), so the owner leaves the setup knowing whether
 * customers will see the card or not.
 */
export function ChatCheckoutChoice({ agents }: { agents: GatewayAgentRow[] }) {
	const fa = useLocale() !== 'en'
	const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(agents.map((agent) => [agent.id, agent.cardPayEnabled])))
	const [saving, setSaving] = useState<string | null>(null)
	const [error, setError] = useState(false)

	async function toggle(agentId: string, next: boolean) {
		setSaving(agentId)
		setError(false)
		setOn((current) => ({ ...current, [agentId]: next }))
		try {
			const response = await fetch('/api/payments/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: { id: agentId, cardPayEnabled: next } }) })
			if (!response.ok) throw new Error('save failed')
		} catch {
			setOn((current) => ({ ...current, [agentId]: !next }))
			setError(true)
		} finally {
			setSaving(null)
		}
	}

	if (!agents.length) return null
	return (
		<div className="grid gap-3 rounded-2xl border border-[var(--border-default)] bg-white p-4 dark:bg-neutral-900">
			<div className="flex items-start gap-3">
				<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]"><MessageSquareMore className="size-5" aria-hidden /></span>
				<div className="min-w-0">
					<p className="text-[14.5px] font-bold text-[var(--text-primary)]">{fa ? 'خرید داخل گفتگو فعال شود؟' : 'Take payment inside the chat?'}</p>
					<p className="mt-0.5 text-[12.5px] leading-6 text-[var(--text-muted)]">
						{fa
							? 'روشن: ایجنت بعد از تأیید سفارش، کارت شما و مبلغ دقیق را در همان گفتگو می‌فرستد و واریز خودکار تأیید می‌شود. خاموش: درگاه فقط برای لینک‌های دستی و سایت‌های متصل کار می‌کند.'
							: 'On: once the customer confirms an order, the agent sends your card and the exact amount in the chat and the transfer is confirmed automatically. Off: the gateway works only for hand-made links and connected sites.'}
					</p>
				</div>
			</div>
			<ul className="grid gap-2">
				{agents.map((agent) => (
					<li key={agent.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-surface)] px-3 py-2.5">
						<span className="min-w-0">
							<span className="block truncate text-[13.5px] font-semibold text-[var(--text-primary)]">{agent.name}</span>
							<span className="block text-[12px] text-[var(--text-muted)]">{on[agent.id] ? (fa ? 'خرید در گفتگو روشن است' : 'In-chat checkout is on') : (fa ? 'خرید در گفتگو خاموش است' : 'In-chat checkout is off')}</span>
						</span>
						<Switch checked={Boolean(on[agent.id])} pending={saving === agent.id} disabled={saving !== null} onChange={(next) => void toggle(agent.id, next)} aria-label={fa ? `خرید داخل گفتگو برای ${agent.name}` : `In-chat checkout for ${agent.name}`} />
					</li>
				))}
			</ul>
			{error ? <p role="alert" className="text-[12.5px] text-red-600">{fa ? 'ذخیره نشد؛ دوباره تلاش کنید.' : 'Not saved; try again.'}</p> : null}
		</div>
	)
}
