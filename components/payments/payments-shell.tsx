import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, CreditCard, ListChecks, PlugZap, Settings2, Smartphone, WalletCards } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { cn } from '@/lib/utils'
import type { GatewayOverview } from '@/lib/payments/card/dashboard'
import { GATEWAY_SETUP_STEPS, gatewaySetupState } from '@/lib/payments/card/setup'

export type PaymentsTab = 'payments' | 'cards' | 'devices' | 'sites' | 'settings'

const TABS: Array<{ key: PaymentsTab; href: string; icon: typeof ListChecks; fa: string; en: string }> = [
	{ key: 'payments', href: '/payments', icon: ListChecks, fa: 'پرداخت‌ها', en: 'Payments' },
	{ key: 'cards', href: '/payments/cards', icon: CreditCard, fa: 'کارت‌ها', en: 'Cards' },
	{ key: 'devices', href: '/payments/devices', icon: Smartphone, fa: 'دریافت پیامک', en: 'SMS source' },
	{ key: 'sites', href: '/payments/sites', icon: PlugZap, fa: 'سایت و API', en: 'Sites & API' },
	{ key: 'settings', href: '/payments/settings', icon: Settings2, fa: 'تنظیمات', en: 'Settings' },
]

const PILL = {
	live: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
	setup: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
	danger: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200',
	neutral: 'bg-[var(--bg-muted)] text-[var(--text-secondary)]',
} as const

/**
 * The frame every «درگاه پرداخت» page shares: title, the gateway's state as
 * a coloured pill and the five tabs (a scrolling row on phones). Tabs whose
 * part of the setup is done carry a tick; the SMS tab an amber dot while
 * the phone is the missing piece.
 */
export function PaymentsShell({ active, overview, locale, children }: { active: PaymentsTab; overview: GatewayOverview; locale: 'fa' | 'en'; children: ReactNode }) {
	const fa = locale !== 'en'
	const numbers = fa ? 'fa-IR' : 'en-US'
	const attention = overview.counts.review + overview.counts.unmatched
	const setup = gatewaySetupState(overview)
	const step = setup.current ? GATEWAY_SETUP_STEPS.indexOf(setup.current) + 1 : 4
	const state: { tone: keyof typeof PILL; dot: 'live' | 'setup' | 'alert' | null; text: string } = !overview.platformEnabled
		? { tone: 'neutral', dot: null, text: fa ? 'موقتاً در دسترس نیست' : 'Temporarily unavailable' }
		: overview.suspended
			? { tone: 'danger', dot: 'alert', text: fa ? 'متوقف از طرف ویجنت' : 'Paused by Vigent' }
			: setup.complete || (overview.enabled && overview.ready)
				? { tone: 'live', dot: 'live', text: fa ? 'روشن و آماده' : 'On and ready' }
				: setup.done.test && !overview.enabled
					? { tone: 'neutral', dot: null, text: fa ? 'خاموش' : 'Off' }
					: { tone: 'setup', dot: 'setup', text: fa ? `راه‌اندازی · قدم ${step.toLocaleString(numbers)} از ۴` : `Setup · step ${step} of 4` }
	const tick: Partial<Record<PaymentsTab, boolean>> = { cards: setup.done.card, devices: setup.done.phone }
	return (
		<div className="mx-auto max-w-none space-y-5">
			<PageHeader
				icon={WalletCards}
				title={fa ? 'درگاه پرداخت' : 'Payment gateway'}
				subtitle={fa
					? 'مشتری کارت‌به‌کارت می‌کند و ویجنت از روی پیامک واریز بانک، پرداخت را خودکار تأیید می‌کند.'
					: 'Customers pay by card-to-card and Vigent confirms the payment from your bank’s deposit SMS.'}
				actions={
					<span role="status" className={cn('inline-flex min-h-8 items-center gap-2 rounded-full px-3.5 text-[13px] font-bold', PILL[state.tone])}>
						{state.dot ? <span aria-hidden className={cn('nav-status-dot', `nav-status-${state.dot}`)} /> : null}
						{state.text}
					</span>
				}
			/>
			<nav aria-label={fa ? 'بخش‌های درگاه پرداخت' : 'Payment gateway sections'} className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-white p-1.5 shadow-[var(--elev-1)] [scrollbar-width:none] dark:bg-neutral-900 [&::-webkit-scrollbar]:hidden">
				{TABS.map((tab) => {
					const Icon = tab.icon
					const current = active === tab.key
					return (
						<Link
							key={tab.key}
							href={tab.href}
							aria-current={current ? 'page' : undefined}
							className={cn(
								'inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-[13.5px] transition-colors duration-150',
								current ? 'bg-[var(--text-primary)] font-bold text-white dark:text-neutral-900' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
							)}
						>
							<Icon className="size-4" aria-hidden />
							{fa ? tab.fa : tab.en}
							{tab.key === 'payments' && attention > 0 ? <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">{attention.toLocaleString(numbers)}</span> : null}
							{tick[tab.key] && !current ? <span className="grid size-4 place-items-center rounded-full bg-emerald-600 text-white" title={fa ? 'انجام شده' : 'Done'}><Check className="size-2.5" strokeWidth={3.5} aria-hidden /><span className="sr-only">{fa ? 'انجام شده' : 'done'}</span></span> : null}
							{tab.key === 'devices' && setup.done.card && !setup.done.phone && !current ? <span aria-hidden className="nav-status-dot nav-status-setup" /> : null}
						</Link>
					)
				})}
			</nav>
			{overview.suspended ? (
				<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
					<b>{fa ? 'درگاه پرداخت شما از طرف ویجنت متوقف شده است.' : 'Vigent has paused your payment gateway.'}</b>{' '}
					{fa ? 'تا رفع توقف، کارتی برای پرداخت فرستاده نمی‌شود و ایجنت سفارش را به روش قبلی می‌گیرد.' : 'Until it is resumed no card is sent and the agent takes orders the previous way.'}
					{overview.suspended.reason ? <span className="mt-1 block">{fa ? 'دلیل: ' : 'Reason: '}{overview.suspended.reason}</span> : null}
				</div>
			) : null}
			{children}
		</div>
	)
}
