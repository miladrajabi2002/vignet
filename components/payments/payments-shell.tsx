import type { ReactNode } from 'react'
import Link from 'next/link'
import { CreditCard, ListChecks, PlugZap, Settings2, Smartphone, WalletCards } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatusChip } from '@/components/ui/status-chip'
import type { GatewayOverview } from '@/lib/payments/card/dashboard'

export type PaymentsTab = 'payments' | 'cards' | 'devices' | 'sites' | 'settings'

const TABS: Array<{ key: PaymentsTab; href: string; icon: typeof ListChecks; fa: string; en: string }> = [
	{ key: 'payments', href: '/payments', icon: ListChecks, fa: 'پرداخت‌ها', en: 'Payments' },
	{ key: 'cards', href: '/payments/cards', icon: CreditCard, fa: 'کارت‌ها', en: 'Cards' },
	{ key: 'devices', href: '/payments/devices', icon: Smartphone, fa: 'دریافت پیامک', en: 'SMS source' },
	{ key: 'sites', href: '/payments/sites', icon: PlugZap, fa: 'سایت و API', en: 'Sites & API' },
	{ key: 'settings', href: '/payments/settings', icon: Settings2, fa: 'تنظیمات', en: 'Settings' },
]

/**
 * The frame every «درگاه پرداخت» page shares: title, the gateway's one-line
 * state and the five tabs (a scrolling row on phones).
 */
export function PaymentsShell({ active, overview, locale, children }: { active: PaymentsTab; overview: GatewayOverview; locale: 'fa' | 'en'; children: ReactNode }) {
	const fa = locale !== 'en'
	const attention = overview.counts.review + overview.counts.unmatched
	const state = !overview.platformEnabled
		? { tone: 'neutral' as const, text: fa ? 'موقتاً در دسترس نیست' : 'Temporarily unavailable' }
		: !overview.enabled
			? { tone: 'neutral' as const, text: fa ? 'خاموش' : 'Off' }
			: !overview.ready
				? { tone: 'warn' as const, text: fa ? 'روشن · راه‌اندازی ناتمام' : 'On · setup unfinished' }
				: { tone: 'ok' as const, text: fa ? 'روشن و آماده' : 'On and ready' }
	return (
		<div className="mx-auto max-w-none space-y-5">
			<PageHeader
				icon={WalletCards}
				title={fa ? 'درگاه پرداخت' : 'Payment gateway'}
				subtitle={fa
					? 'مشتری کارت‌به‌کارت می‌کند و ویجنت از روی پیامک واریز بانک، پرداخت را خودکار تأیید می‌کند.'
					: 'Customers pay by card-to-card and Vigent confirms the payment from your bank’s deposit SMS.'}
				actions={<StatusChip tone={state.tone} dot>{state.text}</StatusChip>}
			/>
			<nav aria-label={fa ? 'بخش‌های درگاه پرداخت' : 'Payment gateway sections'} className="ui-ftabs border-b border-[var(--border-subtle)]">
				{TABS.map((tab) => {
					const Icon = tab.icon
					return (
						<Link key={tab.key} href={tab.href} aria-current={active === tab.key ? 'page' : undefined} className="ui-ftab">
							<Icon className="size-4" aria-hidden />
							{fa ? tab.fa : tab.en}
							{tab.key === 'payments' && attention > 0 ? <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">{attention.toLocaleString(fa ? 'fa-IR' : 'en-US')}</span> : null}
						</Link>
					)
				})}
			</nav>
			{children}
		</div>
	)
}
