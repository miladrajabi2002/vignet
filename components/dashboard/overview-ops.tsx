import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, Bot, Inbox, MessageSquareReply, Plug, Power, ShoppingBag, Sparkles, Wallet, type LucideIcon } from 'lucide-react'
import { TelegramIcon } from '@/components/marketing/social-links'
import { ChannelMark, type ChannelKey } from '@/components/ui/channel-mark'
import { cn } from '@/lib/utils'

/*
 * Overview "operations center" (redesign, 1405).
 *
 * Everything here is server-rendered from the workspace's real numbers; the
 * only motion is CSS (app/ui-system.css `.lf*` flow lines and the site's
 * `.vg-*` sequence), paused off-screen by MotionPauser and frozen for
 * reduced motion. No client JavaScript.
 */

type Locale = 'fa' | 'en'

const CHANNEL_NAMES: Record<ChannelKey, { fa: string; en: string }> = {
	INSTAGRAM: { fa: 'اینستاگرام', en: 'Instagram' },
	TELEGRAM: { fa: 'تلگرام', en: 'Telegram' },
	BALE: { fa: 'بله', en: 'Bale' },
	RUBIKA: { fa: 'روبیکا', en: 'Rubika' },
	WEB_WIDGET: { fa: 'ویجت سایت', en: 'Website' },
	CHAT_LINK: { fa: 'لینک چت', en: 'Chat link' },
	WHATSAPP: { fa: 'واتساپ', en: 'WhatsApp' },
	API: { fa: 'API', en: 'API' },
}

export type FlowInput = { channel: ChannelKey; count: number; connected: boolean }
export type FlowOutput = { key: string; label: string; value: number; href: string; icon: LucideIcon; tone: 'ok' | 'warn' | 'signal' | 'ink' }
export type AttentionTile = { key: string; label: string; hint: string; value: number; href: string; icon: LucideIcon; urgent: boolean }

function fmt(locale: Locale, value: number) {
	return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(value)
}

/* ── Operations center: greeting, status, attention tiles, next actions ── */

export function OpsCenter({
	locale,
	ownerName,
	businessName,
	businessLabel,
	connectedApps,
	attention,
	primaryAction,
	secondaryAction,
	flow,
}: {
	locale: Locale
	ownerName?: string | null
	businessName: string
	businessLabel: string
	connectedApps: number
	attention: AttentionTile[]
	primaryAction: { href: string; label: string; icon: LucideIcon }
	secondaryAction: { href: string; label: string; icon: LucideIcon }
	flow: ReactNode
}) {
	const fa = locale === 'fa'
	const Arrow = fa ? ArrowLeft : ArrowRight
	const urgentCount = attention.filter((tile) => tile.urgent).reduce((sum, tile) => sum + tile.value, 0)
	const firstName = ownerName?.trim().split(/\s+/)[0]
	const today = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
	const PrimaryIcon = primaryAction.icon
	const SecondaryIcon = secondaryAction.icon

	return (
		<section aria-labelledby="ops-title" className="dashboard-arrival dashboard-intro relative overflow-hidden rounded-card border border-[var(--border-subtle)]">
			<div className="grid gap-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<div className="relative p-5 sm:p-7">
					<div className="flex flex-wrap items-center gap-2">
						<span className="ui-chip ui-chip-neutral">{businessLabel}</span>
						<span className={cn('ui-chip', connectedApps > 0 ? 'ui-chip-ok' : 'ui-chip-warn')}>
							<span className="ui-chip-dot" />
							{connectedApps > 0
								? fa ? `${fmt(locale, connectedApps)} برنامه متصل` : `${fmt(locale, connectedApps)} apps connected`
								: fa ? 'هنوز برنامه‌ای وصل نیست' : 'No app connected yet'}
						</span>
						<span className="ms-auto hidden text-[12px] text-[var(--text-muted)] sm:inline">{today}</span>
					</div>

					<h1 id="ops-title" className="ui-h1 mt-5">
						{firstName ? (fa ? `سلام ${firstName}` : `Hi ${firstName}`) : fa ? 'مرکز عملیات' : 'Operations center'}
						<span className="block text-[15px] font-medium leading-7 text-[var(--text-muted)] lg:text-[17px]">
							{urgentCount === 0
								? fa ? `همه‌چیز در ${businessName} روی روال است.` : `Everything at ${businessName} is on track.`
								: fa ? `امروز ${fmt(locale, urgentCount)} مورد در ${businessName} منتظر شماست.` : `${fmt(locale, urgentCount)} items at ${businessName} are waiting for you.`}
						</span>
					</h1>

					<ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
						{attention.map((tile) => {
							const Icon = tile.icon
							return (
								<li key={tile.key}>
									<Link
										href={tile.href}
										className={cn(
											'spatial-press group flex h-full min-h-[4.5rem] items-center gap-3 rounded-2xl border p-3 sm:flex-col sm:items-start sm:gap-2.5 sm:p-3.5',
											tile.urgent ? 'border-amber-300/80 bg-amber-50' : 'border-[var(--border-default)] bg-white',
										)}
									>
										<span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', tile.urgent ? 'bg-white text-amber-800' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]')}>
											<Icon className="h-4 w-4" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="flex items-baseline gap-1.5">
												<b className="text-[22px] font-bold leading-none tabular-nums text-[var(--text-primary)]">{fmt(locale, tile.value)}</b>
												<span className={cn('truncate text-[13px]', tile.urgent ? 'font-bold text-amber-950' : 'font-semibold text-[var(--text-primary)]')}>{tile.label}</span>
											</span>
											<span className={cn('mt-1 block truncate text-[12px]', tile.urgent ? 'text-amber-900/80' : 'text-[var(--text-muted)]')}>{tile.hint}</span>
										</span>
										<Arrow className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 sm:hidden" />
									</Link>
								</li>
							)
						})}
					</ul>

					<div className="mt-4 flex flex-col gap-2 sm:flex-row">
						<Link href={primaryAction.href} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[13.5px] font-semibold text-white shadow-[var(--shadow-control)] hover:bg-[#2a2a2e]">
							<PrimaryIcon className="h-4 w-4" />
							{primaryAction.label}
						</Link>
						<Link href={secondaryAction.href} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-[13.5px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-xs)] hover:border-[var(--border-hover)]">
							<SecondaryIcon className="h-4 w-4" />
							{secondaryAction.label}
						</Link>
					</div>
				</div>

				<div className="border-t border-[var(--border-subtle)] p-4 sm:p-6 xl:border-s xl:border-t-0">{flow}</div>
			</div>
		</section>
	)
}

/* ── Live flow: real 7-day traffic from each app → agent → outcomes ───── */

export function LiveFlow({
	locale,
	agentName,
	inputs,
	outputs,
	automationRate,
}: {
	locale: Locale
	agentName: string
	inputs: FlowInput[]
	outputs: FlowOutput[]
	automationRate: number | null
}) {
	const fa = locale === 'fa'
	const connected = inputs.filter((input) => input.connected)
	const total = inputs.reduce((sum, input) => sum + input.count, 0)
	const shown = (connected.length ? connected : inputs).slice(0, 5)
	const outputTone: Record<FlowOutput['tone'], string> = {
		ok: 'bg-[var(--ok-soft)] text-[var(--ok-ink)]',
		warn: 'bg-[var(--warn-soft)] text-[var(--warn-ink)]',
		signal: 'bg-[var(--signal-soft)] text-[var(--signal-strong)]',
		ink: 'bg-[var(--text-primary)] text-white',
	}

	return (
		<div dir={fa ? 'rtl' : 'ltr'} className="lf vg-anim">
			<div className="flex items-center gap-2">
				<h2 className="ui-h3">{fa ? 'جریان ۷ روز اخیر' : 'The last 7 days, flowing'}</h2>
				<span className="ui-chip ui-chip-ok">
					<span className="relative inline-flex"><span className="absolute inset-0 animate-ping rounded-full bg-current opacity-40 motion-reduce:animate-none" /><span className="ui-chip-dot relative" /></span>
					{fa ? 'داده زنده' : 'Live data'}
				</span>
				<span className="ms-auto text-[12px] tabular-nums text-[var(--text-muted)]">
					{fa ? `${fmt(locale, total)} گفتگو` : `${fmt(locale, total)} chats`}
				</span>
			</div>

			{/* Desktop / tablet: apps → agent → outcomes, left to right in reading order. */}
			<div className="mt-5 hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center sm:grid">
				<ul className="flex flex-col gap-2">
					{shown.length ? shown.map((input, index) => {
						const name = CHANNEL_NAMES[input.channel][locale]
						return (
							<li key={input.channel}>
								<Link href={`/conversations?channel=${input.channel}`} className="group flex items-center gap-2 rounded-xl py-1 pe-0 ps-1 hover:bg-[var(--bg-surface)]">
									<ChannelMark channel={input.channel} size="sm" />
									<span className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{name}</span>
									<span className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">{fmt(locale, input.count)}</span>
									<span className={cn('lf-line ms-1 min-w-6 flex-1', input.count === 0 && 'lf-line-idle')}>
										{input.count > 0 ? <span className="lf-run" style={{ animationDelay: `${index * 0.45}s` } as CSSProperties}><i /></span> : null}
									</span>
								</Link>
							</li>
						)
					}) : (
						<li>
							<Link href="/integrations" className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-[var(--border-hover)] px-3 text-[12.5px] font-semibold text-[var(--text-secondary)]">
								<Plug className="h-4 w-4" />
								{fa ? 'اتصال اولین برنامه' : 'Connect your first app'}
							</Link>
						</li>
					)}
				</ul>

				<AgentNode locale={locale} agentName={agentName} automationRate={automationRate} />

				<ul className="flex flex-col gap-2">
					{outputs.map((output, index) => {
						const Icon = output.icon
						return (
							<li key={output.key}>
								<Link href={output.href} className="group flex items-center gap-2 rounded-xl py-1 pe-1 ps-0 hover:bg-[var(--bg-surface)]">
									<span className={cn('lf-line lf-line-ok me-1 min-w-6 flex-1', output.value === 0 && 'lf-line-idle')}>
										{output.value > 0 ? <span className="lf-run lf-run-ok" style={{ animationDelay: `${1.2 + index * 0.5}s` } as CSSProperties}><i /></span> : null}
									</span>
									<span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', outputTone[output.tone])}><Icon className="h-3.5 w-3.5" /></span>
									<span className="min-w-0">
										<b className="block text-[14px] font-bold leading-5 tabular-nums text-[var(--text-primary)]">{fmt(locale, output.value)}</b>
										<span className="block truncate text-[11.5px] text-[var(--text-muted)]">{output.label}</span>
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			</div>

			{/* Phones: the same story top to bottom. */}
			<div className="mt-4 sm:hidden">
				<ul className="flex flex-wrap justify-center gap-1.5">
					{shown.length ? shown.map((input) => (
						<li key={input.channel}>
							<Link href={`/conversations?channel=${input.channel}`} className="flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-white py-1 pe-2.5 ps-1">
								<ChannelMark channel={input.channel} size="sm" className="rounded-full" />
								<span className="text-[12px] font-semibold">{CHANNEL_NAMES[input.channel][locale]}</span>
								<span className="text-[12px] tabular-nums text-[var(--text-muted)]">{fmt(locale, input.count)}</span>
							</Link>
						</li>
					)) : (
						<li>
							<Link href="/integrations" className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-[var(--border-hover)] px-3 text-[12.5px] font-semibold text-[var(--text-secondary)]">
								<Plug className="h-4 w-4" />
								{fa ? 'اتصال اولین برنامه' : 'Connect your first app'}
							</Link>
						</li>
					)}
				</ul>
				<div className="mx-auto mt-2 flex h-7 justify-center"><span className={cn('lf-vline', total === 0 && 'lf-line-idle')}>{total > 0 ? <span className="lf-vrun"><i /></span> : null}</span></div>
				<div className="flex justify-center"><AgentNode locale={locale} agentName={agentName} automationRate={automationRate} compact /></div>
				<div className="mx-auto mb-2 flex h-7 justify-center"><span className="lf-vline lf-vline-ok"><span className="lf-vrun lf-vrun-ok" style={{ animationDelay: '1.1s' }}><i /></span></span></div>
				<ul className="grid grid-cols-2 gap-2">
					{outputs.map((output) => {
						const Icon = output.icon
						return (
							<li key={output.key}>
								<Link href={output.href} className="flex min-h-14 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white p-2">
									<span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', outputTone[output.tone])}><Icon className="h-4 w-4" /></span>
									<span className="min-w-0">
										<b className="block text-[15px] font-bold leading-5 tabular-nums">{fmt(locale, output.value)}</b>
										<span className="block truncate text-[11.5px] text-[var(--text-muted)]">{output.label}</span>
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

function AgentNode({ locale, agentName, automationRate, compact = false }: { locale: Locale; agentName: string; automationRate: number | null; compact?: boolean }) {
	const fa = locale === 'fa'
	return (
		<div className={cn('relative flex flex-col items-center', compact ? 'px-0' : 'px-1')}>
			<div className={cn('relative grid place-items-center', compact ? 'h-[5.5rem] w-[5.5rem]' : 'h-28 w-28')}>
				<span aria-hidden className="vg-ring absolute inset-2 rounded-full border-[1.5px] border-[rgba(110,86,207,0.4)]" />
				<span aria-hidden className="vg-ring absolute inset-2 rounded-full border-[1.5px] border-[rgba(110,86,207,0.4)] [animation-delay:1.4s]" />
				<span className={cn('relative grid place-items-center rounded-full border border-[var(--border-default)] bg-white shadow-[0_20px_40px_-20px_rgba(110,86,207,0.6)]', compact ? 'h-[4.5rem] w-[4.5rem]' : 'h-24 w-24')}>
					<span className={cn('flex flex-col items-center justify-center gap-0.5 rounded-full bg-[var(--text-primary)] text-white', compact ? 'h-14 w-14' : 'h-[4.5rem] w-[4.5rem]')}>
						<Bot className="h-5 w-5 text-[#c7bdf0]" strokeWidth={1.8} />
						<span className="max-w-[4rem] truncate text-[10.5px] font-bold">{agentName}</span>
					</span>
				</span>
			</div>
			{automationRate !== null ? (
				<span className="ui-chip ui-chip-signal mt-1 whitespace-nowrap">
					{fa ? `${fmt(locale, automationRate)}٪ خودکار` : `${fmt(locale, automationRate)}% automated`}
				</span>
			) : null}
		</div>
	)
}

/* ── Vigento copilot card ─────────────────────────────────────────────── */

export function VigentoCard({
	locale,
	liveAnswer,
}: {
	locale: Locale
	/** A real one-line answer built from today's numbers, shown in the demo. */
	liveAnswer: string
}) {
	const fa = locale === 'fa'
	const Arrow = fa ? ArrowLeft : ArrowRight
	const questions = fa
		? ['امروز چه چیزی نیاز به توجه دارد؟', 'کدام محصول بیشتر پرسیده شد؟', 'هزینهٔ هوش مصنوعی این هفته چقدر بود؟']
		: ['What needs attention today?', 'Which product was asked about most?', 'What did AI cost this week?']
	return (
		<section aria-labelledby="vigento-card-title" className="relative overflow-hidden rounded-sheet bg-[#0f0f12] p-5 text-white sm:p-7">
			<div aria-hidden className="pointer-events-none absolute -top-24 end-[-4rem] h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(110,86,207,0.45),rgba(15,15,18,0))]" />
			<div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
				<div>
					<div className="flex items-center gap-2.5">
						<span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-black"><Sparkles className="h-5 w-5" /></span>
						<div>
							<h2 id="vigento-card-title" className="text-[18px] font-bold leading-7">{fa ? 'ویجنتو' : 'Vigento'}</h2>
							<p className="text-[12.5px] text-white/60">{fa ? 'دستیار هوشمند پنل شما' : 'Your panel’s AI assistant'}</p>
						</div>
					</div>
					<p className="mt-4 max-w-md text-[14px] leading-7 text-white/75">
						{fa
							? 'به‌جای گشتن بین صفحه‌ها، بپرسید. ویجنتو گفتگوها، مشتری‌ها، فروشگاه، نوبت‌ها و هزینهٔ هوش مصنوعی را از دادهٔ زنده بررسی می‌کند و جواب کوتاه و دقیق می‌دهد.'
							: 'Instead of hunting through pages, ask. Vigento reads conversations, customers, store, bookings and AI cost from live data and answers briefly and precisely.'}
					</p>
					<ul className="mt-4 flex flex-wrap gap-2">
						{questions.map((question) => (
							<li key={question}>
								<Link href={`/vigento?q=${encodeURIComponent(question)}`} className="spatial-press inline-flex min-h-10 items-center rounded-full border border-white/15 bg-white/[0.06] px-3.5 text-[12.5px] text-white/85 hover:bg-white/[0.12]">
									{question}
								</Link>
							</li>
						))}
					</ul>
					<Link href="/vigento" className="spatial-press mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-[13.5px] font-bold text-black">
						{fa ? 'گفتگو با ویجنتو' : 'Chat with Vigento'}
						<Arrow className="h-4 w-4" />
					</Link>
				</div>

				{/* A short real exchange on a 10s loop: question → thinking → answer. */}
				<div aria-hidden className="vg-anim rounded-card border border-white/10 bg-white/[0.04] p-4 [--vg-T:11s]" dir={fa ? 'rtl' : 'ltr'}>
					<div className="flex items-center gap-2 text-[11.5px] text-white/55">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
						{fa ? 'ویجنتو · داده زنده' : 'Vigento · live data'}
					</div>
					{/* Same sides as the Vigento page: you on the right, Vigento on the left. */}
					<div dir="ltr" className="mt-3 flex flex-col gap-2.5">
						<p dir={fa ? 'rtl' : 'ltr'} className="vg-t0 max-w-[88%] self-end rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-[13px] leading-6 text-black">{questions[0]}</p>
						<div dir={fa ? 'rtl' : 'ltr'} className="relative min-h-[4.5rem] self-start">
							<span className="vg-x1 absolute end-0 top-0 inline-flex h-8 items-center gap-1 rounded-full bg-white/10 px-3">
								{[0, 0.2, 0.4].map((delay) => <span key={delay} className="vg-tdot h-1.5 w-1.5 rounded-full bg-[#c7bdf0]" style={{ animationDelay: `${delay}s` }} />)}
							</span>
							<p className="vg-t2 max-w-[92%] rounded-2xl rounded-bl-md bg-[#26262c] px-3.5 py-2.5 text-[13px] leading-6 text-white/90">{liveAnswer}</p>
						</div>
						<div dir={fa ? 'rtl' : 'ltr'} className="vg-t4 flex flex-wrap gap-1.5">
							<span className="rounded-full bg-[rgba(199,189,240,0.14)] px-2.5 py-1 text-[11px] text-[#ddd6f6]">{fa ? 'منبع: گفتگوهای امروز' : 'Source: today’s chats'}</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

/* ── Telegram manager bot card ────────────────────────────────────────── */

// Titles stay short so the phone layout can show them two-up without the
// second line; the detail line only appears from `sm` up.
const BOT_CAPABILITIES: { icon: LucideIcon; fa: [string, string]; en: [string, string] }[] = [
	{ icon: MessageSquareReply, fa: ['پاسخ به مشتری', 'از همان تلگرام؛ نوشتن یا پاسخ آماده'], en: ['Reply to customers', 'Right from Telegram, typed or one-tap'] },
	{ icon: Inbox, fa: ['صف اپراتور', 'خلاصه و آخرین پیام‌های هر گفتگو'], en: ['Operator queue', 'Summary and last messages per case'] },
	{ icon: BarChart3, fa: ['گزارش‌ها', 'لحظه‌ای، و صبحگاهی ساعت ۹'], en: ['Reports', 'Live, plus a 9 a.m. brief'] },
	{ icon: ShoppingBag, fa: ['سفارش و نوبت', 'به‌محض ثبت در گفتگو'], en: ['Orders & bookings', 'The moment they are placed'] },
	{ icon: Power, fa: ['کنترل ایجنت‌ها', 'توقف یا روشن کردن با یک لمس'], en: ['Agent control', 'Pause or resume in one tap'] },
	{ icon: Wallet, fa: ['اعتبار و هشدار', 'موجودی، مصرف و انتخاب هشدارها'], en: ['Credit & alerts', 'Balance, usage, alert choices'] },
]

function BotCapabilities({ fa, live = false }: { fa: boolean; live?: boolean }) {
	return (
		<ul className="grid grid-cols-2 gap-1.5">
			{BOT_CAPABILITIES.map(({ icon: Icon, fa: faText, en }) => (
				<li key={en[0]} className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--bg-surface)] px-2 py-1.5 sm:gap-2.5 sm:px-2.5 sm:py-2">
					<span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-[#0284c7] shadow-[var(--shadow-xs)] sm:h-8 sm:w-8">
						<Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
						{live ? <span aria-hidden className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--ok)] ring-2 ring-white" /> : null}
					</span>
					<span className="min-w-0">
						<span className="block truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{fa ? faText[0] : en[0]}</span>
						<span className="hidden truncate text-[11.5px] text-[var(--text-muted)] sm:block">{fa ? faText[1] : en[1]}</span>
					</span>
				</li>
			))}
		</ul>
	)
}

export function OperatorBotCard({ locale, connected = false, paused = false, botUsername }: { locale: Locale; connected?: boolean; paused?: boolean; botUsername?: string | null }) {
	const fa = locale === 'fa'
	const Arrow = fa ? ArrowLeft : ArrowRight
	const username = botUsername?.replace(/^@/, '')
	return (
		<section aria-labelledby="operator-bot-title" className="spatial-surface overflow-hidden rounded-sheet">
			<div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<div className="p-4 sm:p-6">
					<div className="flex items-start gap-3">
						<span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2aabee] text-white shadow-[0_8px_20px_-10px_rgba(42,171,238,0.9)]">
							<TelegramIcon className="h-6 w-6" />
							{connected ? <span className="absolute -bottom-0.5 -end-0.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--ok)] text-[9px] font-bold text-white ring-2 ring-white">✓</span> : null}
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<h2 id="operator-bot-title" className="ui-h2">{fa ? 'ربات مدیریت تلگرام' : 'Telegram manager bot'}</h2>
								{connected && paused ? (
									<span className="ui-chip ui-chip-warn"><span className="ui-chip-dot" />{fa ? 'متصل · هشدارها خاموش' : 'Connected · alerts off'}</span>
								) : connected ? (
									<span className="ui-chip ui-chip-ok">
										<span className="relative inline-flex"><span className="absolute inset-0 animate-ping rounded-full bg-current opacity-40 motion-reduce:animate-none" /><span className="ui-chip-dot relative" /></span>
										{fa ? 'متصل' : 'Connected'}
									</span>
								) : null}
							</div>
							{connected && username ? <p dir="ltr" className="mt-0.5 text-start text-[12px] font-medium text-[var(--text-muted)]">@{username}</p> : null}
							<p className="ui-body mt-1">
								{connected
									? fa
										? 'مرکز مدیریت کسب‌وکارتان در تلگرام؛ همه‌چیز با دکمه، بدون تایپ دستور.'
										: 'Your business control center in Telegram — all buttons, no commands to type.'
									: fa
										? 'کسب‌وکارتان را از داخل تلگرام اداره کنید: به مشتری‌ها جواب بدهید، گزارش بگیرید و از هر سفارش و نوبت همان لحظه باخبر شوید.'
										: 'Run your business from inside Telegram: answer customers, get reports and hear about every order and booking the moment it lands.'}
							</p>
						</div>
					</div>

					<div className="mt-4 border-t border-[var(--border-subtle)] pt-4 sm:mt-5 sm:pt-5">
						<p className="mb-2 text-[12.5px] font-bold text-[var(--text-primary)]">
							{connected ? (fa ? 'در ربات شما فعال است' : 'Live in your bot') : (fa ? 'این ربات چه کارهایی می‌کند؟' : 'What the bot does')}
						</p>
						<BotCapabilities fa={fa} live={connected} />
					</div>

					<div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
						{connected ? (
							<>
								{username ? (
									<a href={`https://t.me/${encodeURIComponent(username)}?start=menu`} target="_blank" rel="noopener noreferrer" className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2aabee] px-4 text-[13.5px] font-semibold text-white shadow-[0_10px_24px_-14px_rgba(42,171,238,0.95)] hover:bg-[#229ed9]">
										<TelegramIcon className="h-4 w-4" />
										{fa ? 'باز کردن ربات' : 'Open the bot'}
									</a>
								) : null}
								<Link href="/settings#telegram-operator" className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-[13.5px] font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)]">
									{fa ? 'تنظیمات اتصال' : 'Connection settings'}
									<Arrow className="h-4 w-4" />
								</Link>
							</>
						) : (
							<Link href="/settings#telegram-operator" className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[13.5px] font-semibold text-white shadow-[var(--shadow-control)] hover:bg-[#2a2a2e]">
								<TelegramIcon className="h-4 w-4" />
								{fa ? 'وصل کردن ربات' : 'Connect the bot'}
								<Arrow className="h-4 w-4" />
							</Link>
						)}
					</div>
				</div>

				{connected ? <TelegramBriefPreview fa={fa} /> : <TelegramReplyPreview fa={fa} />}
			</div>
		</section>
	)
}

/*
 * Telegram mock. Rules that keep it believable:
 * - a bot message and its inline keyboard are ONE element on the sequence
 *   clock, so the buttons never pop in after the text (Telegram sends them
 *   together);
 * - every bubble carries its time in the bottom corner, and only the owner's
 *   own message gets Telegram's drawn double tick, not text glyphs;
 * - dir=ltr pins the sides the way every messenger does: you on the right,
 *   the bot on the left; each bubble sets its own text direction.
 * All copy mirrors what the real bot sends (lib/channels/operator-bot*.ts,
 * app/api/telegram-operator/webhook/route.ts).
 */

const TG_WALL = { backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1.4px, transparent 1.4px)', backgroundSize: '16px 16px' }
const TG_IN = 'rounded-2xl rounded-bl-md bg-white px-3 pb-1.5 pt-2 text-[12px] leading-6 text-[#111] shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
const TG_KEY = 'relative block overflow-hidden rounded-lg bg-[#6f8f67]/80 px-1 py-1.5 text-center text-[11px] font-semibold leading-5 text-white'

function TelegramTopBar({ fa }: { fa: boolean }) {
	return (
		<div dir={fa ? 'rtl' : 'ltr'} className="flex items-center gap-2.5 bg-white/95 px-4 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
			<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#72d5fd] to-[#2a9ef1] text-[13px] font-bold text-white">{fa ? 'م' : 'M'}</span>
			<span className="min-w-0 leading-tight">
				<span className="block truncate text-[13px] font-bold text-[#111]">{fa ? 'مدیر فروشگاه من' : 'My shop manager'}</span>
				<span className="block text-[11px] text-[#8a8f98]">{fa ? 'ربات' : 'bot'}</span>
			</span>
		</div>
	)
}

/** Telegram's read receipt: two drawn ticks, the second tucked under the first. */
function ReadTicks() {
	return (
		<svg viewBox="0 0 16 10" className="h-[9px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M1 5.4 3.9 8.3 10.2 1.7" />
			<path d="M7.4 7.8 7.9 8.3 14.2 1.7" />
		</svg>
	)
}

function TgMeta({ fa, time, out = false }: { fa: boolean; time: [string, string]; out?: boolean }) {
	return (
		<span dir="ltr" className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none tabular-nums', out ? 'text-[#4fae4e]' : 'text-[#a0a5ad]')}>
			{fa ? time[0] : time[1]}
			{out ? <ReadTicks /> : null}
		</span>
	)
}

function TgKeyboard({ fa, rows, tap }: { fa: boolean; rows: string[][]; tap?: { row: number; col: number; className: string } }) {
	return (
		<div dir={fa ? 'rtl' : 'ltr'} className="mt-1 space-y-1">
			{rows.map((row, r) => (
				<div key={r} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
					{row.map((label, c) => (
						<span key={label} className={TG_KEY}>
							{label}
							{tap && tap.row === r && tap.col === c ? <span className={cn('absolute inset-0 rounded-lg bg-white/40', tap.className)} /> : null}
						</span>
					))}
				</div>
			))}
		</div>
	)
}

/**
 * Not connected yet: the headline use case end to end. An Instagram chat is
 * handed off, the owner taps «نوشتن پاسخ», types the answer in Telegram and
 * the bot confirms it went out on Instagram.
 */
function TelegramReplyPreview({ fa }: { fa: boolean }) {
	const d = fa ? 'rtl' : 'ltr'
	return (
		<div aria-hidden className="vg-anim flex flex-col border-t border-[var(--border-subtle)] bg-[#dde6d2] [--vg-T:14s] md:border-s md:border-t-0" style={TG_WALL}>
			<TelegramTopBar fa={fa} />
			<div dir="ltr" className="flex flex-1 flex-col justify-end gap-1.5 px-3 py-3.5 sm:px-4">
				<div className="vg-t0 w-[88%] max-w-[19rem] self-start">
					<div dir={d} className={TG_IN}>
						<p className="font-bold">{fa ? '🙋 یک گفتگو به شما سپرده شد' : '🙋 A chat was handed to you'}</p>
						<p>{fa ? '👤 سارا · اینستاگرام' : '👤 Sara · Instagram'}</p>
						<p className="mt-0.5 rounded-md border-s-2 border-[#2aabee] bg-[#f1f7fd] px-2 text-[11.5px] leading-6 text-[#3b4452]">
							{fa ? 'پرداخت کردم ولی سفارشم ثبت نشده' : 'I paid but my order isn’t showing'}
						</p>
						<TgMeta fa={fa} time={['۱۰:۱۴', '10:14']} />
					</div>
					<TgKeyboard
						fa={fa}
						rows={fa ? [['✍️ نوشتن پاسخ', '⚡ پاسخ آماده'], ['🙋 قبول گفتگو', '✅ حل شد']] : [['✍️ Write a reply', '⚡ Quick reply'], ['🙋 Claim', '✅ Resolved']]}
						tap={{ row: 0, col: 0, className: 'vg-x2' }}
					/>
				</div>
				<div dir={d} className={cn('vg-t3 max-w-[82%] self-start', TG_IN)}>
					<p className="font-bold">{fa ? '✍️ پاسخ به سارا' : '✍️ Reply to Sara'}</p>
					<p className="text-[11.5px] text-[var(--text-secondary)]">{fa ? 'همین‌جا بنویسید؛ در اینستاگرام برایش ارسال می‌شود.' : 'Type it here — it goes out on Instagram.'}</p>
					<TgMeta fa={fa} time={['۱۰:۱۵', '10:15']} />
				</div>
				<div dir={d} className="vg-t5 max-w-[78%] self-end rounded-2xl rounded-br-md bg-[#effdde] px-3 pb-1.5 pt-2 text-[12px] leading-6 text-[#111] shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
					<p>{fa ? 'سلام سارا جان، سفارشت ثبت شد و امروز ارسال می‌شه 🌸' : 'Hi Sara, your order is in and ships today 🌸'}</p>
					<TgMeta fa={fa} time={['۱۰:۱۶', '10:16']} out />
				</div>
				<div className="vg-t7 w-[74%] max-w-[16rem] self-start">
					<div dir={d} className={TG_IN}>
						<p>{fa ? <>✅ برای <b>سارا</b> ارسال شد.</> : <>✅ Sent to <b>Sara</b>.</>}</p>
						<TgMeta fa={fa} time={['۱۰:۱۶', '10:16']} />
					</div>
					<TgKeyboard fa={fa} rows={[fa ? ['📥 صف اپراتور', '🏠 خانه'] : ['📥 Queue', '🏠 Home']]} />
				</div>
			</div>
		</div>
	)
}

/**
 * Connected: a day with the bot. The 9 a.m. brief arrives on its own, then a
 * pre-order and a handed-off chat drop in as they happen, each with the
 * buttons the real bot attaches.
 */
function TelegramBriefPreview({ fa }: { fa: boolean }) {
	const d = fa ? 'rtl' : 'ltr'
	return (
		<div aria-hidden className="vg-anim flex flex-col border-t border-[var(--border-subtle)] bg-[#dde6d2] [--vg-T:14s] md:border-s md:border-t-0" style={TG_WALL}>
			<TelegramTopBar fa={fa} />
			<div dir="ltr" className="flex flex-1 flex-col justify-end gap-1.5 px-3 py-3.5 sm:px-4">
				<div className="vg-t0 w-[90%] max-w-[20rem] self-start">
					<div dir={d} className={TG_IN}>
						<p className="font-bold">{fa ? '🌅 صبح بخیر! گزارش فروشگاه من' : '🌅 Good morning! My shop report'}</p>
						<p>{fa ? '💬 ۲۴ گفتگو · 🤖 ۸۶٪ خودکار' : '💬 24 chats · 🤖 86% automated'}</p>
						<p>{fa ? '📥 منتظر شما: ' : '📥 Waiting: '}<b>{fa ? '۲' : '2'}</b>{fa ? ' · 💳 ' : ' · 💳 '}<b>{fa ? '۴۸۰٬۰۰۰ تومان' : '480,000 toman'}</b></p>
						<TgMeta fa={fa} time={['۰۹:۰۰', '09:00']} />
					</div>
					<TgKeyboard fa={fa} rows={[fa ? ['📥 صف اپراتور', '📊 گزارش کامل'] : ['📥 Queue', '📊 Full report']]} />
				</div>
				<div className="vg-t3 w-[84%] max-w-[18rem] self-start">
					<div dir={d} className={TG_IN}>
						<p className="font-bold">{fa ? '🛒 پیش‌سفارش جدید' : '🛒 New pre-order'}</p>
						<p>{fa ? 'مریم · ۲ قلم · ۱٬۸۴۰٬۰۰۰ تومان' : 'Maryam · 2 items · 1,840,000 toman'}</p>
						<TgMeta fa={fa} time={['۱۱:۲۰', '11:20']} />
					</div>
					<TgKeyboard fa={fa} rows={[fa ? ['🖥 مشاهده در پنل', '🏠 مرکز مدیریت'] : ['🖥 Open in panel', '🏠 Control center']]} />
				</div>
				<div className="vg-t6 w-[88%] max-w-[19rem] self-start">
					<div dir={d} className={TG_IN}>
						<p className="font-bold">{fa ? '🙋 یک گفتگو به شما سپرده شد' : '🙋 A chat was handed to you'}</p>
						<p>{fa ? '👤 علی · تلگرام — «برای خرید عمده تخفیف دارید؟»' : '👤 Ali · Telegram — “Any bulk discount?”'}</p>
						<TgMeta fa={fa} time={['۱۲:۰۵', '12:05']} />
					</div>
					<TgKeyboard fa={fa} rows={[fa ? ['✍️ نوشتن پاسخ', '⚡ پاسخ آماده'] : ['✍️ Write a reply', '⚡ Quick reply']]} />
				</div>
			</div>
		</div>
	)
}
