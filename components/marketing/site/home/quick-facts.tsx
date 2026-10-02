import type { CSSProperties } from 'react'
import { ArrowLeftRight, BriefcaseBusiness, CalendarDays, GraduationCap, Inbox, MessageSquare, ShoppingBag, Store, UserRound, Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHANNELS, CheckLine, Container, type IconType, type SiteLocale } from '../ui'

const COPY = {
	fa: {
		pill: 'ویجنت در ۳۰ ثانیه',
title: 'ویجنت را در ۳۰ ثانیه بشناسید',
		lead: 'کوتاه، دقیق و بدون اصطلاح فنی — تا در نیم دقیقه بدانید ویجنت برای کسب‌وکار شما چه می‌کند.',
		whatQ: 'ویجنت چیست؟',
		what: <>یک <em className="not-italic text-[#b9adff]">ایجنت هوش مصنوعی</em> که پیام مشتری‌ها را در همهٔ برنامه‌ها و به زبان خودشان جواب می‌دهد، می‌فروشد، نوبت ثبت می‌کند و هر گفتگو را در <em className="not-italic text-[#b9adff]">یک CRM مشترک</em> نگه می‌دارد.</>,
		verbs: ['پاسخ می‌دهد', 'می‌فروشد', 'رزرو می‌کند', 'در CRM ثبت می‌کند', 'به انسان می‌سپارد'],
		whereQ: 'کجا کار می‌کند؟',
		where: 'هر جا مشتری‌تان هست',
inbox: 'همه در یک صندوق پیام',
		inboxSub: '— با یک ایجنت و یک دانش',
		whoQ: 'برای چه کسی؟',
		who: 'هر کسب‌وکاری که پیام مشتری دارد',
		segments: [
			{ name: 'فروشگاه', note: 'قیمت، موجودی، سفارش' },
			{ name: 'رستوران', note: 'منو و وضعیت سفارش' },
			{ name: 'کلینیک و مشاوره', note: 'نوبت بدون تداخل' },
			{ name: 'آموزش', note: 'ثبت‌نام و سؤال دوره‌ها' },
			{ name: 'خدمات', note: 'سرنخ و ارجاع به کارشناس' },
		],
		setupQ: 'راه‌اندازی چقدر طول می‌کشد؟',
		setupShort: 'راه‌اندازی',
		setupValue: '۷',
		setupUnit: 'دقیقه',
		setupNote: 'تا اولین گفتگوی واقعی',
		setupMobile: 'بدون کدنویسی',
		setupSteps: ['ورود', 'معرفی', 'ایجنت', 'دانش', 'برنامه'],
		setupChecks: ['بدون کدنویسی و نیروی فنی', 'راهنمای قدم‌به‌قدم داخل پنل'],
		controlQ: 'کنترل دست کیست؟',
		controlShort: 'کنترل',
		control: 'همیشه دست شما',
		controlMobile: 'یادگیری فقط با تأیید',
		toggles: ['هر پاسخ قابل بازبینی است', 'موارد حساس به انسان می‌رسد', 'یادگیری فقط با تأیید شما'],
	},
	en: {
		pill: 'Vigent in 30 seconds',
title: 'Get to know Vigent in 30 seconds',
		lead: 'Short, precise and jargon-free — so in half a minute you know what Vigent does for your business.',
		whatQ: 'What is Vigent?',
		what: <>An <em className="not-italic text-[#b9adff]">AI agent</em> that answers customers on every app, in their own language, sells, books appointments and keeps every conversation in <em className="not-italic text-[#b9adff]">one shared CRM</em>.</>,
		verbs: ['Answers', 'Sells', 'Books', 'Logs to CRM', 'Hands off to people'],
		whereQ: 'Where does it work?',
		where: 'Wherever your customers are',
		inbox: 'All in one inbox',
		inboxSub: '— one agent, one knowledge base',
		whoQ: 'Who is it for?',
		who: 'Any business that gets customer messages',
		segments: [
			{ name: 'Stores', note: 'Price, stock, orders' },
			{ name: 'Restaurants', note: 'Menu and order status' },
			{ name: 'Clinics & consulting', note: 'Conflict-free booking' },
			{ name: 'Education', note: 'Enrolment and course questions' },
			{ name: 'Services', note: 'Leads and expert handoff' },
		],
		setupQ: 'How long does setup take?',
		setupShort: 'Setup',
		setupValue: '7',
		setupUnit: 'minutes',
		setupNote: 'to your first real conversation',
		setupMobile: 'No code needed',
		setupSteps: ['Sign in', 'Business', 'Agent', 'Knowledge', 'Channel'],
		setupChecks: ['No code, no technical staff', 'Guided step by step in the panel'],
		controlQ: 'Who is in control?',
		controlShort: 'Control',
		control: 'Always you',
		controlMobile: 'Learns only with approval',
		toggles: ['Every reply can be reviewed', 'Sensitive cases reach a human', 'Learns only with your approval'],
	},
} as const

const VERB_ICONS: IconType[] = [MessageSquare, ShoppingBag, CalendarDays, UserRound, ArrowLeftRight]
const SEGMENT_ICONS: IconType[] = [Store, Utensils, CalendarDays, GraduationCap, BriefcaseBusiness]
// Each segment fills in turn (vg-fN on a 9s clock), so the bar reads as the
// five setup steps being completed, not as a static legend.
const SETUP_BAR = [
	{ grow: 1, color: '#111111', fill: 'vg-f0' },
	{ grow: 2, color: '#3f3f46', fill: 'vg-f2' },
	{ grow: 4, color: '#5b3de8', fill: 'vg-f4' },
	{ grow: 4, color: '#9685fb', fill: 'vg-f6' },
	{ grow: 2, color: '#b9adff', fill: 'vg-f8' },
]
// "Where": the channels light one after another (desktop tiles only).
const CHANNEL_GLOW = ['vg-lg-g1', '', 'vg-lg-g2', '', 'vg-lg-g3', '']
// "What": the verbs are highlighted in turn, as if the agent is doing each.
const VERB_BEAT = ['vg-x0', 'vg-x2', 'vg-x4', 'vg-x6', 'vg-x8']

const card = 'rounded-card border border-vg-line bg-white lg:rounded-sheet'

export function QuickFacts({ locale }: { locale: SiteLocale }) {
	const copy = COPY[locale]
	return (
		<section id="what" aria-labelledby="what-title" className="vg-cv scroll-mt-24 pt-14 md:pt-20 lg:pb-[120px] lg:pt-10">
			<Container>
				<div className="vg-rv flex flex-col items-center gap-10 text-center lg:flex-row lg:items-end lg:justify-between lg:text-start">
					<div className="flex flex-col items-center lg:items-start">
						<span className="vg-sp">
							<span aria-hidden className="vg-sp-spin" />
							<span aria-hidden className="vg-sp-surface" />
							<span className="inline-flex h-8 items-center gap-[7px] px-3 text-[12px] font-medium lg:h-[34px] lg:px-3.5 lg:text-[13px]">
								<svg aria-hidden viewBox="0 0 36 36" className="size-3.5 lg:size-4"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(91,61,232,0.18)" strokeWidth="4" /><circle cx="18" cy="18" r="15" fill="none" stroke="#5b3de8" strokeWidth="4" strokeDasharray="70 100" strokeLinecap="round" transform="rotate(-90 18 18)" /></svg>
								{copy.pill}
							</span>
						</span>
						<h2 id="what-title" className="mt-3 text-[28px] font-bold leading-[1.5] lg:mt-4 lg:text-[48px] lg:leading-[1.35]">{copy.title}</h2>
					</div>
					<p className="hidden max-w-[420px] text-[15px] leading-[1.9] text-vg-sub lg:block">{copy.lead}</p>
				</div>

				<div className="vg-anim vg-rv-group mt-[18px] grid grid-cols-2 gap-2.5 lg:mt-10 lg:grid-cols-12 lg:gap-4" style={{ '--vg-T': '10s' } as CSSProperties}>
					{/* A — definition: the one-paragraph answer to "what is Vigent?" */}
					<article className="relative col-span-2 flex flex-col overflow-hidden rounded-card bg-[#0f0f12] px-5 py-6 text-center text-white lg:col-span-7 lg:h-[390px] lg:rounded-sheet lg:p-[34px] lg:text-start">
						<div aria-hidden className="pointer-events-none absolute -top-[110px] start-[30px] h-[260px] w-[300px] rounded-[50%] bg-[radial-gradient(closest-side,rgba(91,61,232,0.4),rgba(15,15,18,0))] lg:-top-[140px] lg:start-auto lg:end-[-100px] lg:h-[420px] lg:w-[420px]" />
						<h3 className="relative text-[12px] font-normal text-[#a1a1aa] lg:text-[13px]">{copy.whatQ}</h3>
						<p className="relative mt-2 text-[18px] font-medium leading-[1.9] lg:mt-3.5 lg:text-[28px] lg:leading-[1.8]">{copy.what}</p>
						<ul className="relative mt-3.5 flex flex-wrap justify-center gap-1.5 text-[12px] lg:mt-auto lg:justify-start lg:gap-2 lg:text-[13px]">
							{copy.verbs.map((verb, i) => {
								const Icon = VERB_ICONS[i]
								return (
									<li key={verb} className="relative inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.07] px-[11px] py-1.5 lg:h-[34px] lg:px-3 lg:py-0">
										<span aria-hidden className={cn(VERB_BEAT[i], 'absolute -inset-px rounded-full bg-[rgba(199,189,240,0.16)] ring-1 ring-[rgba(199,189,240,0.55)]')} />
										<Icon aria-hidden className="relative hidden size-3.5 text-[#b9adff] lg:block" strokeWidth={1.8} />
										<span className="relative">{verb}</span>
									</li>
								)
							})}
						</ul>
					</article>

					{/* B — where */}
					<article className={cn(card, 'vg-lift col-span-2 flex flex-col px-3 py-[18px] text-center lg:col-span-5 lg:h-[390px] lg:p-[30px] lg:text-start')}>
						<h3 className="text-[12px] font-normal text-vg-cap lg:text-[13px]">{copy.whereQ}</h3>
						<p className="mt-1.5 hidden text-[22px] font-bold lg:block">{copy.where}</p>
						<ul className="mt-3 grid grid-cols-6 lg:mt-5 lg:grid-cols-3 lg:gap-2.5">
							{CHANNELS.map((channel, i) => {
								const Icon = channel.icon
								return (
									<li
										key={channel.id}
										className={cn('flex flex-col items-center gap-1 text-[12px] text-vg-sub lg:gap-2 lg:rounded-card lg:border lg:border-transparent lg:bg-[var(--t)] lg:px-1.5 lg:py-3.5 lg:text-[13px] lg:font-medium lg:text-[var(--c)]', CHANNEL_GLOW[i])}
										style={{ '--t': channel.tint, '--c': channel.color } as CSSProperties}
									>
										<span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--t)] text-[var(--c)] lg:size-auto lg:bg-transparent">
											<span className="inline-flex size-[18px] lg:size-[22px]"><Icon className="size-full" strokeWidth={1.8} /></span>
										</span>
										<span className="lg:hidden">{channel.short[locale]}</span>
										<span className="hidden lg:inline">{channel.id === 'link' ? channel.short[locale] : channel.label[locale]}</span>
									</li>
								)
							})}
						</ul>
						<div className="mt-3 flex items-center justify-center gap-2.5 text-[13px] font-medium lg:mt-auto lg:justify-start lg:rounded-2xl lg:bg-vg-bg lg:px-3.5 lg:py-3 lg:text-[15px] lg:font-normal">
							<span aria-hidden className="relative hidden size-[18px] lg:inline-flex">
								<span className="vg-ring absolute -inset-1.5 rounded-full border border-[rgba(91,61,232,0.4)]" />
								<Inbox className="relative size-full" strokeWidth={1.8} />
							</span>
							<span><b className="font-bold">{copy.inbox}</b> <span className="text-vg-cap">{copy.inboxSub}</span></span>
						</div>
					</article>

					{/* C — who (chips on phones, a list with context on desktop) */}
					<article className={cn(card, 'vg-lift order-last col-span-2 flex flex-col px-3 py-[18px] text-center lg:order-none lg:col-span-4 lg:h-[330px] lg:p-7 lg:text-start')}>
						<h3 className="text-[12px] font-normal text-vg-cap lg:text-[13px]">{copy.whoQ}</h3>
						<p className="mt-1.5 hidden text-[22px] font-bold lg:block">{copy.who}</p>
						<ul className="mt-2.5 flex flex-wrap justify-center gap-1.5 text-[13px] lg:mt-auto lg:flex-col lg:flex-nowrap lg:gap-1 lg:text-[15px]">
							{copy.segments.map((segment, i) => {
								const Icon = SEGMENT_ICONS[i]
								return (
									<li key={segment.name} className="flex items-center gap-2.5 rounded-full bg-[#f4f4f5] px-3 py-1.5 lg:rounded-none lg:border-b lg:border-black/[0.06] lg:bg-transparent lg:px-0 lg:py-[7px] lg:last:border-b-0">
										<span aria-hidden className="hidden size-[30px] items-center justify-center rounded-chip bg-[#f4f4f5] lg:inline-flex"><Icon className="size-[15px]" strokeWidth={1.8} /></span>
										<b className="font-normal lg:font-bold">{segment.name}</b>
										<span className="ms-auto hidden text-[12px] text-vg-cap lg:inline">{segment.note}</span>
									</li>
								)
							})}
						</ul>
					</article>

					{/* D — setup time */}
					<article className={cn(card, 'vg-lift col-span-1 flex flex-col px-3 py-[18px] text-center lg:col-span-4 lg:h-[330px] lg:p-7 lg:text-start')}>
						<h3 className="text-[12px] font-normal text-vg-cap lg:text-[13px]">
							<span className="lg:hidden">{copy.setupShort}</span>
							<span className="hidden lg:inline">{copy.setupQ}</span>
						</h3>
						<p className="mt-1.5 flex items-baseline justify-center gap-1 lg:mt-3.5 lg:justify-start lg:gap-2">
							<span className="text-[36px] font-bold leading-none lg:text-[64px]">{copy.setupValue}</span>
							<span className="text-[15px] font-bold lg:text-[22px]">{copy.setupUnit}</span>
							<span className="hidden text-[15px] text-vg-cap lg:inline">{copy.setupNote}</span>
						</p>
						<p className="mt-1.5 text-[12px] text-vg-sub lg:hidden">{copy.setupMobile}</p>
						<div aria-hidden className="mt-[22px] hidden h-2.5 gap-1 lg:flex" style={{ '--vg-T': '9s' } as CSSProperties}>
							{SETUP_BAR.map((seg) => (
								<span key={seg.color} className="relative overflow-hidden rounded-full bg-black/[0.06]" style={{ flexGrow: seg.grow }}>
									<span className={cn('vg-fx absolute inset-0 rounded-full', seg.fill)} style={{ background: seg.color }} />
								</span>
							))}
						</div>
						<div aria-hidden className="mt-2 hidden justify-between text-[12px] text-vg-cap lg:flex">
							{copy.setupSteps.map((step) => <span key={step}>{step}</span>)}
						</div>
						<ul className="mt-auto hidden flex-col gap-2 text-[15px] lg:flex">
							{copy.setupChecks.map((item) => <li key={item}><CheckLine className="gap-2">{item}</CheckLine></li>)}
						</ul>
					</article>

					{/* E — control */}
					<article className={cn(card, 'vg-lift col-span-1 flex flex-col px-3 py-[18px] text-center lg:col-span-4 lg:h-[330px] lg:p-7 lg:text-start')}>
						<h3 className="text-[12px] font-normal text-vg-cap lg:text-[13px]">
							<span className="lg:hidden">{copy.controlShort}</span>
							<span className="hidden lg:inline">{copy.controlQ}</span>
						</h3>
						<p className="mt-2 text-[15px] font-bold leading-[1.6] lg:mt-1.5 lg:text-[22px]">{copy.control}</p>
						<p className="mt-1.5 text-[12px] text-vg-sub lg:hidden">{copy.controlMobile}</p>
						<ul className="mt-auto hidden flex-col gap-2.5 lg:flex">
							{copy.toggles.map((item) => (
								<li key={item} className="flex items-center justify-between gap-2.5 rounded-control bg-vg-bg px-3.5 py-3 text-[15px]">
									{item}
									<span aria-hidden className="relative h-5 w-9 shrink-0 rounded-full bg-vg-ink"><span className="absolute end-0.5 top-0.5 size-4 rounded-full bg-white" /></span>
								</li>
							))}
						</ul>
					</article>
				</div>
			</Container>
		</section>
	)
}
