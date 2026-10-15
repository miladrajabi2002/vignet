'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { ArrowLeft, Check, Clock, MousePointerClick, Power, UserRound } from 'lucide-react'
import { Switch, SwitchCard } from '@/components/ui/switch'
import { PaymentMethodPicker } from '@/components/payments/payment-method-picker'
import { PAY_TTL_MINUTES, type PayGatewaySettings } from '@/lib/payments/card/settings'
import type { GatewaySetupStep } from '@/lib/payments/card/setup'
import { cn } from '@/lib/utils'
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
	setupDone,
	phone,
}: {
	enabled: boolean
	settings: PayGatewaySettings
	hasCard: boolean
	platformEnabled: boolean
	agents: GatewayAgentRow[]
	store: { host: string; ready: boolean } | null
	/** Which setup steps are done, for the master switch's checklist. */
	setupDone: Record<GatewaySetupStep, boolean>
	/** The SMS phone's card, right under the master switch. */
	phone?: ReactNode
}) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [values, setValues] = useState({ enabled, manualClaim: settings.manualClaim, showHolderName: settings.showHolderName })
	const [saving, setSaving] = useState<Key | null>(null)
	const [error, setError] = useState<string | null>(null)
	const labels = { on: fa ? 'روشن' : 'On', off: fa ? 'خاموش' : 'Off' }

	async function save(body: Record<string, unknown>, key: Key, rollback: () => void) {
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
			<MasterSwitch
				fa={fa}
				on={values.enabled && platformEnabled}
				pending={saving === 'enabled'}
				disabled={saving !== null || !platformEnabled || (!hasCard && !values.enabled)}
				platformEnabled={platformEnabled}
				setupDone={setupDone}
				onChange={(next) => toggle('enabled', next)}
			/>

			{phone}

			<section className="spatial-surface rounded-card p-4 sm:p-5">
				<h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'رفتار درگاه' : 'How the gateway behaves'}</h2>
				<div className="ui-switch-list mt-3 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white dark:bg-neutral-900">
					<SwitchCard
						icon={MousePointerClick}
						title={fa ? 'دکمهٔ «پرداخت کردم»' : '“I have paid” button'}
						description={fa ? 'اگر پیامک بانک نرسد، مشتری این دکمه را می‌زند و پرداخت برای تأیید شما می‌آید: در همان گفتگو قرمز دیده می‌شود و شما تأیید یا ردش می‌کنید. این دکمه هیچ پرداختی را خودکار تأیید نمی‌کند.' : 'If the bank SMS does not arrive, the customer taps this and the payment comes to you: it shows in red in that conversation and you confirm or reject it. The button never confirms a payment by itself.'}
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
						description={fa ? 'مشتری نام را با چیزی که همراه‌بانکش نشان می‌دهد مقایسه می‌کند و مطمئن‌تر می‌پردازد.' : 'The customer compares the name with their bank app and pays with more confidence.'}
						checked={values.showHolderName}
						pending={saving === 'showHolderName'}
						disabled={saving !== null}
						enabledLabel={labels.on}
						disabledLabel={labels.off}
						onChange={(next) => toggle('showHolderName', next)}
					/>
				</div>
				<p className="mt-3 flex items-start gap-2 text-[12.5px] leading-6 text-[var(--text-muted)]">
					<Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
					{fa
						? `مهلت هر پرداخت ${PAY_TTL_MINUTES.toLocaleString('fa-IR')} دقیقه است. پیامکی که تا ۲ ساعت بعد برسد هنوز همان سفارش را تأیید می‌کند.`
						: `Each payment has ${PAY_TTL_MINUTES} minutes. An SMS arriving up to 2 hours later still confirms that order.`}
				</p>
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

const STEP_LINKS: Array<{ step: GatewaySetupStep; href: string; fa: string; en: string }> = [
	{ step: 'card', href: '/payments/cards', fa: 'کارت مقصد', en: 'Destination card' },
	{ step: 'phone', href: '/payments/devices', fa: 'ثبت گوشی', en: 'Register the phone' },
	{ step: 'test', href: '/payments', fa: 'واریز آزمایشی', en: 'Test transfer' },
]

/** The gateway's master switch, with what is still missing when it cannot be on yet. */
function MasterSwitch({ fa, on, pending, disabled, platformEnabled, setupDone, onChange }: { fa: boolean; on: boolean; pending: boolean; disabled: boolean; platformEnabled: boolean; setupDone: Record<GatewaySetupStep, boolean>; onChange: (next: boolean) => void }) {
	const missing = STEP_LINKS.some((item) => !setupDone[item.step])
	return (
		<section className={cn('spatial-surface flex flex-wrap items-center gap-4 rounded-card p-4 sm:p-5', on && 'border-emerald-200 bg-gradient-to-l from-emerald-50/80 to-white dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-transparent')}>
			<span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', on ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-muted)]')}><Power className="size-6" aria-hidden /></span>
			<div className="min-w-0 flex-1 basis-60">
				<h2 className="text-[15.5px] font-bold text-[var(--text-primary)]">
					{!platformEnabled ? (fa ? 'درگاه پرداخت موقتاً در دسترس نیست' : 'The gateway is temporarily unavailable') : on ? (fa ? 'درگاه پرداخت روشن است' : 'The payment gateway is on') : (fa ? 'درگاه پرداخت خاموش است' : 'The payment gateway is off')}
				</h2>
				<p className="mt-0.5 text-[13px] leading-6 text-[var(--text-secondary)]">
					{on
						? (fa ? 'ایجنت بعد از تأیید هر سفارش، کارت و مبلغ دقیق را می‌فرستد. خاموش کردن، پرداخت‌های باز را تا پایان مهلتشان نگه می‌دارد.' : 'The agent sends your card and the exact amount for each confirmed order. Switching off keeps open payments until their deadline.')
						: (fa ? 'خاموش یعنی کارت شما به هیچ مشتری‌ای نشان داده نمی‌شود و سفارش‌های چت مثل قبل به اپراتور می‌رسند.' : 'Off means no customer sees your card and chat orders go to your operator as before.')}
				</p>
				{!on && missing && platformEnabled ? (
					<div className="mt-2 flex flex-wrap gap-1.5">
						{STEP_LINKS.map((item) => setupDone[item.step]
							? <span key={item.step} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[12px] leading-7 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"><Check className="size-3.5" aria-hidden />{fa ? item.fa : item.en}</span>
							: <Link key={item.step} href={item.href} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-white px-2.5 text-[12px] leading-7 text-[var(--text-primary)] hover:border-[var(--border-hover)] dark:bg-neutral-900">{fa ? item.fa : item.en}<ArrowLeft className="size-3.5 ltr:rotate-180" aria-hidden /></Link>)}
					</div>
				) : null}
			</div>
			<Switch checked={on} pending={pending} disabled={disabled} onChange={onChange} aria-label={fa ? 'درگاه پرداخت' : 'Payment gateway'} />
		</section>
	)
}
