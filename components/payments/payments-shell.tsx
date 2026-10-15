import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CreditCard, ListChecks, PartyPopper, PlugZap, Settings2, WalletCards } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavigationCountBadge } from '@/components/ui/navigation-count-badge'
import { GatewaySetup } from '@/components/payments/gateway-setup'
import type { GatewayOverview } from '@/lib/payments/card/dashboard'
import { GATEWAY_SETUP_STEPS, gatewaySetupState } from '@/lib/payments/card/setup'

export type PaymentsTab = 'payments' | 'cards' | 'devices' | 'sites' | 'settings'

/**
 * The SMS phone has no tab of its own once the gateway is live: it sits in
 * Settings (with its switch button), and its guide page counts as Settings.
 */
const TABS: Array<{ key: PaymentsTab; href: string; icon: typeof ListChecks; fa: string; en: string }> = [
	{ key: 'payments', href: '/payments', icon: ListChecks, fa: 'پرداخت‌ها', en: 'Payments' },
	{ key: 'cards', href: '/payments/cards', icon: CreditCard, fa: 'کارت‌ها', en: 'Cards' },
	{ key: 'sites', href: '/payments/sites', icon: PlugZap, fa: 'سایت و API', en: 'Sites & API' },
	{ key: 'settings', href: '/payments/settings', icon: Settings2, fa: 'تنظیمات', en: 'Settings' },
]

const PILL = {
	live: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
	setup: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
	danger: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200',
	neutral: 'bg-[var(--bg-muted)] text-[var(--text-secondary)]',
} as const

const LIGHT = { live: 'bg-emerald-500', setup: 'bg-amber-500', alert: 'bg-red-500', off: 'bg-neutral-400' } as const

/** The «it's live» note stays on the gateway's pages for this long after activation. */
const JUST_ACTIVATED_MS = 30 * 60_000

/**
 * The frame every «درگاه پرداخت» page shares, laid out like an agent's page:
 * one card with the gateway's light, title and state, and its tabs along the
 * bottom (four on phones, all five from tablets up).
 *
 * Until the four setup steps are done once, the card has no tabs and the
 * page is the setup and nothing else; the other tabs send the owner back
 * to it.
 */
export function PaymentsShell({ active, overview, locale, action, children }: { active: PaymentsTab; overview: GatewayOverview; locale: 'fa' | 'en'; action?: ReactNode; children?: ReactNode }) {
	const fa = locale !== 'en'
	const numbers = fa ? 'fa-IR' : 'en-US'
	const setup = gatewaySetupState(overview)
	const settingUp = !overview.activated && setup.current !== null
	if (settingUp && active !== 'payments') redirect('/payments')

	const attention = overview.counts.review + overview.counts.unmatched
	const hasCard = overview.cards.some((card) => card.active)
	const step = setup.current ? GATEWAY_SETUP_STEPS.indexOf(setup.current) + 1 : 4
	const state: { tone: keyof typeof PILL; light: keyof typeof LIGHT; text: string } = !overview.platformEnabled
		? { tone: 'neutral', light: 'off', text: fa ? 'موقتاً در دسترس نیست' : 'Temporarily unavailable' }
		: overview.suspended
			? { tone: 'danger', light: 'alert', text: fa ? 'متوقف از طرف ویجنت' : 'Paused by Vigent' }
			: settingUp
				? { tone: 'setup', light: 'setup', text: fa ? `راه‌اندازی · قدم ${step.toLocaleString(numbers)} از ۴` : `Setup · step ${step} of 4` }
				: overview.enabled && overview.ready
					? { tone: 'live', light: 'live', text: fa ? 'روشن و آماده' : 'On and ready' }
					: overview.enabled
						? { tone: 'setup', light: 'setup', text: fa ? 'روشن · بدون تأیید خودکار' : 'On · no auto-confirm' }
						: { tone: 'neutral', light: 'off', text: fa ? 'خاموش' : 'Off' }
	// A part that broke after activation gets an amber dot on its tab.
	const missing: Partial<Record<PaymentsTab, boolean>> = { cards: !hasCard, settings: !setup.done.phone }
	const shownTab: PaymentsTab = active === 'devices' ? 'settings' : active
	const justActivated = overview.activatedAt != null && Date.now() - Date.parse(overview.activatedAt) < JUST_ACTIVATED_MS

	function tab(item: (typeof TABS)[number], compact: boolean) {
		const Icon = item.icon
		const current = shownTab === item.key
		return (
			<Link
				key={item.key}
				href={item.href}
				aria-current={current ? 'page' : undefined}
				// Same as the agent's tabs: ink text on an ink underline.
				className={cn(
					'group relative inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-chip text-[13px] transition-colors duration-150 after:pointer-events-none after:absolute after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--text-primary)] after:opacity-0 after:transition-opacity after:duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1',
					compact ? 'flex-col gap-1 px-1 py-1.5 text-[12px] after:inset-x-3' : 'shrink-0 whitespace-nowrap px-3.5 after:inset-x-2.5',
					current ? 'font-bold text-[var(--text-primary)] after:opacity-100' : 'font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
				)}
			>
				<span className="relative">
					<Icon
						className={cn('h-[1.05rem] w-[1.05rem] shrink-0 transition-colors duration-150', current ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')}
						strokeWidth={current ? 2.2 : 1.9}
						aria-hidden
					/>
					{missing[item.key] ? <span aria-hidden className="absolute -end-1 -top-1 size-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-neutral-900" /> : null}
				</span>
				<span className="flex max-w-full min-w-0 items-center justify-center gap-1.5">
					<span className="min-w-0 truncate">{fa ? item.fa : item.en}</span>
					{item.key === 'payments' && attention > 0 ? <NavigationCountBadge count={attention} active={current} locale={numbers} label={fa ? 'منتظر تصمیم شما' : 'Waiting for you'} /> : null}
					{missing[item.key] ? <span className="sr-only">{fa ? '(کامل نیست)' : '(incomplete)'}</span> : null}
				</span>
			</Link>
		)
	}

	return (
		<div className="mx-auto max-w-none space-y-5">
			<section className="spatial-surface overflow-hidden rounded-card">
				<div className="flex items-center gap-4 p-4 sm:p-5">
					{/* The gateway's state is a light on its icon, like an agent's. */}
					<div className="relative shrink-0">
						<div className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
							<WalletCards className="h-5 w-5" aria-hidden />
						</div>
						<span className="absolute -end-1 -top-1 flex h-3.5 w-3.5">
							{state.light === 'live' ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" /> : null}
							<span className={cn('relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white dark:border-neutral-900', LIGHT[state.light])} />
						</span>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<h1 className="text-xl font-bold leading-8 tracking-tight text-[var(--text-primary)]">{fa ? 'درگاه پرداخت' : 'Payment gateway'}</h1>
							<span role="status" className={cn('inline-flex min-h-7 items-center rounded-full px-3 text-[12.5px] font-bold', PILL[state.tone])}>{state.text}</span>
						</div>
						<p className="mt-0.5 hidden text-[13px] leading-6 text-[var(--text-secondary)] sm:block">
							{fa
								? 'مشتری کارت‌به‌کارت می‌کند و ویجنت از روی پیامک واریز بانک، پرداخت را خودکار تأیید می‌کند.'
								: 'Customers pay by card-to-card and Vigent confirms the payment from your bank’s deposit SMS.'}
						</p>
					</div>
					{action && !settingUp ? <div className="shrink-0">{action}</div> : null}
				</div>
				{settingUp ? null : (
					<>
						<nav className="grid grid-cols-4 gap-1 border-t border-black/[0.055] px-1.5 md:hidden dark:border-white/[0.06]" aria-label={fa ? 'بخش‌های درگاه پرداخت' : 'Payment gateway sections'}>
							{TABS.map((item) => tab(item, true))}
						</nav>
						<nav className="scrollbar-none hidden gap-1 overflow-x-auto border-t border-black/[0.055] px-2.5 md:flex dark:border-white/[0.06]" aria-label={fa ? 'بخش‌های درگاه پرداخت' : 'Payment gateway sections'}>
							{TABS.map((item) => tab(item, false))}
						</nav>
					</>
				)}
			</section>

			{overview.suspended ? (
				<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
					<b>{fa ? 'درگاه پرداخت شما از طرف ویجنت متوقف شده است.' : 'Vigent has paused your payment gateway.'}</b>{' '}
					{fa ? 'تا رفع توقف، کارتی برای پرداخت فرستاده نمی‌شود و ایجنت سفارش را به روش قبلی می‌گیرد.' : 'Until it is resumed no card is sent and the agent takes orders the previous way.'}
					{overview.suspended.reason ? <span className="mt-1 block">{fa ? 'دلیل: ' : 'Reason: '}{overview.suspended.reason}</span> : null}
				</div>
			) : null}

			{settingUp && setup.current ? (
				<GatewaySetup
					done={setup.done}
					current={setup.current}
					cards={overview.cards}
					devices={overview.devices}
					inboundLines={overview.inboundLines}
					platformEnabled={overview.platformEnabled}
				/>
			) : (
				<>
					{justActivated && active === 'payments' ? (
						<div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13.5px] leading-7 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
							<PartyPopper className="mt-1 size-5 shrink-0" aria-hidden />
							<p>
								<b>{fa ? 'درگاه پرداخت شما فعال شد.' : 'Your payment gateway is live.'}</b>{' '}
								{fa ? 'از این لحظه ایجنت بعد از تأیید هر سفارش، کارت و مبلغ دقیق را می‌فرستد و واریز را از روی پیامک بانک خودش تأیید می‌کند.' : 'From now on the agent sends your card and the exact amount for every confirmed order and confirms the transfer from your bank’s SMS.'}
							</p>
						</div>
					) : null}
					{overview.platformEnabled && !overview.suspended && (!hasCard || !setup.done.phone) && !(hasCard ? ['devices', 'settings'] : ['cards']).includes(active) ? (
						<Link href={hasCard ? '/payments/devices' : '/payments/cards'} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] leading-6 text-amber-900 transition-colors hover:bg-amber-100/70 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
							<span aria-hidden className="size-2 shrink-0 rounded-full bg-amber-500" />
							<span className="min-w-0 flex-1">
								{!hasCard
									? (fa ? 'هیچ کارت فعالی ندارید؛ تا یک کارت روشن نشود، کارتی برای مشتری فرستاده نمی‌شود.' : 'No active card; until one is on, no card is sent to customers.')
									: (fa ? 'گوشی دریافت پیامک وصل نیست؛ پرداخت‌ها تا وصل شدنش برای تأیید دستی به شما می‌رسند.' : 'The SMS phone is not connected; until it is, payments come to you to confirm by hand.')}
							</span>
							<ArrowLeft className="size-4 shrink-0 ltr:rotate-180" aria-hidden />
						</Link>
					) : null}
					{children}
				</>
			)}
		</div>
	)
}
