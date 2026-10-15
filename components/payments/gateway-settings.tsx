'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Hourglass, MousePointerClick, Power, UserRound } from 'lucide-react'
import { SwitchCard } from '@/components/ui/switch'
import { PaymentMethodPicker } from '@/components/payments/payment-method-picker'
import { PAY_TTL_RANGE, type PayGatewaySettings } from '@/lib/payments/card/settings'
import type { GatewayAgentRow } from '@/lib/payments/card/dashboard'

type Key = 'enabled' | 'manualClaim' | 'showHolderName'

/** The gateway's master switch, its behaviour, and how each agent takes payment. */
export function GatewaySettings({
	enabled,
	settings,
	hasCard,
	platformEnabled,
	agents,
	store,
}: {
	enabled: boolean
	settings: PayGatewaySettings
	hasCard: boolean
	platformEnabled: boolean
	agents: GatewayAgentRow[]
	store: { host: string; ready: boolean } | null
}) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [values, setValues] = useState({ enabled, manualClaim: settings.manualClaim, showHolderName: settings.showHolderName })
	const [ttl, setTtl] = useState(settings.ttlMinutes)
	const [saving, setSaving] = useState<Key | 'ttl' | null>(null)
	const [error, setError] = useState<string | null>(null)
	const labels = { on: fa ? 'روشن' : 'On', off: fa ? 'خاموش' : 'Off' }

	async function save(body: Record<string, unknown>, key: Key | 'ttl', rollback: () => void) {
		setSaving(key)
		setError(null)
		try {
			const response = await fetch('/api/payments/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as { error?: string } | null
				rollback()
				setError(data?.error === 'NO_ACTIVE_CARD' ? (fa ? 'برای روشن کردن درگاه، اول یک کارت فعال اضافه کنید.' : 'Add an active card before switching the gateway on.') : (fa ? 'ذخیره نشد؛ دوباره تلاش کنید.' : 'Not saved; try again.'))
				return
			}
			router.refresh()
		} catch {
			rollback()
			setError(fa ? 'ذخیره نشد؛ دوباره تلاش کنید.' : 'Not saved; try again.')
		} finally {
			setSaving(null)
		}
	}
	function toggle(key: Key, next: boolean) {
		const previous = values[key]
		setValues((current) => ({ ...current, [key]: next }))
		void save({ [key]: next }, key, () => setValues((current) => ({ ...current, [key]: previous })))
	}

	const gatewayReady = values.enabled && hasCard && platformEnabled

	return (
		<div className="space-y-5">
			<section className="spatial-surface rounded-card p-4 sm:p-5">
				<h2 className="text-lg font-bold text-[var(--text-primary)]">{fa ? 'درگاه' : 'Gateway'}</h2>
				<div className="ui-switch-list mt-3 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
					<SwitchCard
						icon={Power}
						title={fa ? 'درگاه پرداخت' : 'Payment gateway'}
						description={fa ? 'کلید اصلی. خاموش یعنی کارت شما به هیچ مشتری‌ای نشان داده نمی‌شود و سفارش‌های چت مثل قبل به اپراتور می‌رسند. پرداخت‌هایی که الان باز هستند تا پایان مهلت‌شان تأیید می‌شوند.' : 'The master switch. Off means your card is shown to no customer and chat orders go to your operator as before. Payments that are open now are still confirmed until their deadline.'}
						checked={values.enabled && platformEnabled}
						pending={saving === 'enabled'}
						disabled={saving !== null || !platformEnabled || (!hasCard && !values.enabled)}
						lockedReason={!platformEnabled ? (fa ? 'درگاه پرداخت موقتاً از طرف ویجنت در دسترس نیست.' : 'The gateway is temporarily unavailable.') : !hasCard && !values.enabled ? (fa ? 'اول از تب «کارت‌ها» یک کارت اضافه کنید.' : 'Add a card in the Cards tab first.') : undefined}
						enabledLabel={labels.on}
						disabledLabel={labels.off}
						onChange={(next) => toggle('enabled', next)}
					/>
					<SwitchCard
						icon={MousePointerClick}
						title={fa ? 'دکمهٔ «پرداخت کردم»' : '“I have paid” button'}
						description={fa ? 'پرداخت در حالت عادی خودکار تأیید می‌شود و مشتری لازم نیست کاری کند. اگر پیامک بانک نرسد و مشتری این دکمه را بزند، پرداخت به «بررسی» می‌رود: در همان گفتگو با رنگ قرمز دیده می‌شود و شما تأیید یا ردش می‌کنید. هیچ پرداختی با زدن این دکمه خودکار تأیید نمی‌شود.' : 'Payments normally confirm by themselves and the customer does nothing. If the bank SMS does not arrive and the customer taps this, the payment goes to review: it shows in red in that conversation and you confirm or reject it. Tapping it never confirms a payment by itself.'}
						checked={values.manualClaim}
						pending={saving === 'manualClaim'}
						disabled={saving !== null}
						enabledLabel={labels.on}
						disabledLabel={labels.off}
						onChange={(next) => toggle('manualClaim', next)}
					/>
					<SwitchCard
						icon={UserRound}
						title={fa ? 'نمایش نام صاحب کارت' : 'Show the cardholder’s name'}
						description={fa ? 'مشتری پیش از واریز، نام را با چیزی که همراه‌بانک نشان می‌دهد مقایسه می‌کند و مطمئن‌تر پرداخت می‌کند.' : 'Before transferring, the customer compares the name with what their bank app shows and pays with more confidence.'}
						checked={values.showHolderName}
						pending={saving === 'showHolderName'}
						disabled={saving !== null}
						enabledLabel={labels.on}
						disabledLabel={labels.off}
						onChange={(next) => toggle('showHolderName', next)}
					/>
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white p-3.5">
					<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)]"><Hourglass className="size-4" aria-hidden /></span>
					<label htmlFor="pay-ttl" className="min-w-0 flex-1">
						<span className="block text-sm font-bold text-[var(--text-primary)]">{fa ? 'مهلت پرداخت' : 'Payment deadline'}</span>
						<span className="mt-0.5 block text-[13px] leading-6 text-[var(--text-secondary)]">{fa ? 'بعد از این زمان پرداخت منقضی می‌شود. پیامکی که تا ۲ ساعت بعد برسد هنوز همان سفارش را تأیید می‌کند.' : 'After this the payment expires. An SMS arriving up to 2 hours later still confirms that order.'}</span>
					</label>
					<select
						id="pay-ttl"
						className="input w-auto min-w-[8.5rem]"
						value={ttl}
						disabled={saving !== null}
						onChange={(event) => {
							const next = Number(event.target.value)
							const previous = ttl
							setTtl(next)
							void save({ ttlMinutes: next }, 'ttl', () => setTtl(previous))
						}}
					>
						{[10, 15, 20, 30, 45, 60].filter((value) => value >= PAY_TTL_RANGE.min && value <= PAY_TTL_RANGE.max).map((value) => (
							<option key={value} value={value}>{value.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'دقیقه' : 'minutes'}</option>
						))}
					</select>
				</div>
				{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
			</section>

			<section className="spatial-surface rounded-card p-4 sm:p-5">
				<h2 className="text-lg font-bold text-[var(--text-primary)]">{fa ? 'پرداخت سفارش‌های چت' : 'Payment for chat orders'}</h2>
				<p className="mt-1 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{fa ? 'برای هر ایجنت مشخص کنید بعد از تأیید سفارش، پرداخت چطور انجام شود. همین انتخاب در صفحهٔ خود ایجنت هم دیده می‌شود.' : 'For each agent, choose how an order is paid once the customer confirms it. The same choice appears on the agent’s own page.'}</p>
				<div className="mt-4 grid gap-5">
					{agents.length === 0 && <p className="text-sm text-[var(--text-muted)]">{fa ? 'هنوز ایجنتی نساخته‌اید.' : 'You have not created an agent yet.'}</p>}
					{agents.map((agent) => (
						<div key={agent.id}>
							{agents.length > 1 && <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">{agent.name}</h3>}
							<PaymentMethodPicker agentId={agent.id} initial={{ cardPayEnabled: agent.cardPayEnabled, payLinkEnabled: agent.payLinkEnabled }} gatewayReady={gatewayReady} store={store} compact />
							{!agent.orderCaptureEnabled && <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">{fa ? 'این ایجنت هنوز در چت سفارش نمی‌گیرد؛ با انتخاب یک روش پرداخت، «گرفتن سفارش در چت» هم برایش روشن می‌شود.' : 'This agent does not take orders in chat yet; choosing a payment method also switches order taking on.'}</p>}
						</div>
					))}
				</div>
			</section>
		</div>
	)
}
