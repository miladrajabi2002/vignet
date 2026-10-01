import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowLeftRight, CalendarDays, CircleCheck, MoonStar, PackageCheck, ShoppingBag, Sparkles, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHANNELS, ChannelBadge, ForwardArrow, HeroPill, SIGNUP_HREF, btnDark, btnGhost, btnLg, type IconType, type SiteLocale } from '../ui'

const COPY = {
	fa: {
pill: 'ایجنت هوش مصنوعی برای کسب‌وکارها',
		h1a: 'همه برنامه‌ها،',
		h1b: 'یک هوش مصنوعی',
		lead: 'فروش، پشتیبانی و CRM در یک پنل. ویجنت با اطلاعات و محصولات خودتان در اینستاگرام، تلگرام، بله، روبیکا و سایت جواب می‌دهد، می‌فروشد و نوبت ثبت می‌کند.',
		start: 'شروع رایگان',
		how: 'ویجنت در ۳۰ ثانیه',
		stageLabel: 'نمایش زندهٔ عملکرد ویجنت',
		inputs: 'ورودی · همهٔ برنامه‌ها',
		outputs: 'خروجی · نتیجهٔ ثبت‌شده',
		agent: 'ویجنت',
		thinking: 'در حال پاسخ‌گویی از دانش شما',
		incoming: [
			{ who: 'سارا · دایرکت اینستاگرام', color: '#be185d', text: 'سلام! کت گرامی مشکی سایز M موجوده؟' },
			{ who: 'امیر · تلگرام', color: '#0369a1', text: 'سفارش پیتزای من کی می‌رسه؟' },
			{ who: 'نگار · ویجت سایت', color: '#5b3de8', text: 'جمعه ساعت ۵ وقت مشاوره دارید؟' },
		],
		replies: [
			{ text: 'بله سارا جان، M و L موجوده؛ ۲٬۴۸۰٬۰۰۰ تومان. کارت محصول رو فرستادم.', source: 'منبع: کاتالوگ محصولات' },
			{ text: 'سفارش شما در مسیر است و حداکثر ۲۵ دقیقهٔ دیگر می‌رسد.', source: 'منبع: وضعیت سفارش' },
			{ text: 'جمعه ۱۷:۰۰ خالی است؛ با نام و شماره، رزروش قطعی می‌شود.', source: 'منبع: تقویم و ظرفیت زنده' },
		],
		/* One annotation per beat, floating over the reply it explains. */
		chips: ['از موجودی ووکامرس خواند', '۲:۴۰ بامداد، جواب داده شد', 'بدون دخالت شما ثبت شد'],
		results: [
			{ title: 'سفارش ثبت شد', detail: 'کت گرامی مشکی · لینک پرداخت ارسال شد', short: 'لینک پرداخت ارسال شد' },
			{ title: 'نوبت رزرو شد', detail: 'جمعه ۱۷:۰۰ · بدون تداخل زمانی', short: 'بدون تداخل زمانی' },
			{ title: 'پروندهٔ مشتری به‌روز شد', detail: 'برچسب «قصد خرید بالا» در CRM', short: 'قصد خرید بالا', mobileTitle: 'CRM به‌روز شد' },
			{ title: 'تحویل به اپراتور', detail: 'همراه خلاصهٔ کامل گفتگو', short: 'با خلاصهٔ کامل' },
		],
	},
	en: {
pill: 'An AI agent for businesses',
		h1a: 'Every app,',
		h1b: 'one AI',
		lead: 'Sales, support and CRM in one panel. Vigent answers on Instagram, Telegram, Bale, Rubika and your website from your own data — and sells and books for you.',
		start: 'Start free',
		how: 'Vigent in 30 seconds',
		stageLabel: 'Live view of Vigent at work',
		inputs: 'Input · every channel',
		outputs: 'Output · recorded result',
		agent: 'Vigent',
		thinking: 'Answering from your knowledge',
		incoming: [
			{ who: 'Sara · Instagram DM', color: '#be185d', text: 'Hi! Is the black cardigan in size M?' },
			{ who: 'Amir · Telegram', color: '#0369a1', text: 'When will my pizza order arrive?' },
			{ who: 'Negar · Website widget', color: '#5b3de8', text: 'Any consultation slot Friday at 5?' },
		],
		replies: [
			{ text: 'Yes Sara, M and L are in stock — 2,480,000 toman. I sent the product card.', source: 'Source: product catalog' },
			{ text: 'Your order is on its way and arrives within 25 minutes.', source: 'Source: order status' },
			{ text: 'Friday 17:00 is free — share your name and number to confirm.', source: 'Source: live calendar & capacity' },
		],
		chips: ['Read live WooCommerce stock', '2:40 AM · answered', 'Booked without you'],
		results: [
			{ title: 'Order placed', detail: 'Payment link sent', short: 'Payment link sent' },
			{ title: 'Booking confirmed', detail: 'Friday 17:00 · no clash', short: 'No double booking', mobileTitle: 'Booked' },
			{ title: 'CRM record updated', detail: '“High intent” tag added', short: 'High purchase intent', mobileTitle: 'CRM updated' },
			{ title: 'Handed to a human', detail: 'With a full summary', short: 'With full summary', mobileTitle: 'Handed off' },
		],
	},
} as const

/*
 * The stage's timeline (12s loop, the vg-cN / vg-rN clock in site.css):
 * Sara's DM (Instagram) → product reply → "Order placed";
 * Amir's question (Telegram) → order status → "CRM record updated";
 * Negar's request (website) → free slot → "Booking confirmed".
 * `inAt`/`outAt` are packet launch times in seconds (negative = already in
 * flight when the loop starts); `channel` indexes CHANNELS, `result` indexes
 * the results column.
 */
const HERO_BEATS = [
	{ channel: 0, inAt: -0.5, result: 0, outAt: 1.4 },
	{ channel: 1, inAt: 3.3, result: 2, outAt: 5.4 },
	{ channel: 4, inAt: 7.3, result: 1, outAt: 9.4 },
] as const
/* Result cards light when their reply lands; handoff stays at rest (none of
   these three conversations needed a human). */
const RESULT_LIT = ['vg-l1', 'vg-l3', 'vg-l2', '']

/* The chips ride the reply clock (vg-rN) a beat later, so each one lands as
   an annotation on the answer it describes. */
const CHIP_ICONS: { icon: IconType; color: string }[] = [
	{ icon: PackageCheck, color: '#15803d' },
	{ icon: MoonStar, color: '#5b3de8' },
	{ icon: CircleCheck, color: '#1d4ed8' },
]
const REPLY_CLOCK = ['vg-r1', 'vg-r2', 'vg-r3']

function HeroChip({ index, text, small = false }: { index: number; text: string; small?: boolean }) {
	const { icon: Icon, color } = CHIP_ICONS[index]
	return (
		<span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-vg-line bg-white font-medium text-vg-ink shadow-[0_12px_28px_-14px_rgba(17,17,17,0.35)]', small ? 'h-[26px] px-2.5 text-[11.5px]' : 'h-[30px] px-3 text-[12.5px]')}>
			<Icon aria-hidden className={small ? 'size-3.5' : 'size-4'} strokeWidth={2} style={{ color }} />
			{text}
		</span>
	)
}

const RESULT_ICONS: { icon: IconType; tint: string; color: string }[] = [
	{ icon: ShoppingBag, tint: '#dcfce7', color: '#15803d' },
	{ icon: CalendarDays, tint: '#dbeafe', color: '#1d4ed8' },
	{ icon: UserRound, tint: '#f3e8ff', color: '#7e22ce' },
	{ icon: ArrowLeftRight, tint: '#fef3c7', color: '#b45309' },
]

export function Hero({ locale }: { locale: SiteLocale }) {
	const copy = COPY[locale]
	return (
		// data-vg-hero: the one block allowed to keep looping on phones (MotionPauser).
		<section data-vg-hero className="relative flex flex-col items-center px-4 pt-[88px] text-center lg:pt-[142px]">
			<div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[470px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(199,189,240,0.35),rgba(245,245,243,0))] lg:top-10 lg:h-[520px] lg:w-[900px]" />
			<HeroPill className="relative">{copy.pill}</HeroPill>
			<h1 className="relative mt-[18px] text-[36px] font-bold leading-[1.35] lg:mt-7 lg:text-[76px] lg:leading-[1.18]">
				{copy.h1a}
				<br className="lg:hidden" /> {copy.h1b}
			</h1>
			<p className="relative mt-3.5 max-w-[640px] text-[15px] leading-[1.95] text-vg-sub lg:mt-6 lg:text-[19px] lg:leading-[1.9]">{copy.lead}</p>
			<div className="relative mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3 lg:mt-9">
				<Link href={SIGNUP_HREF} className={cn(btnDark, btnLg, 'vg-sheen w-full sm:w-auto')}>
					{copy.start}
					<ForwardArrow locale={locale} className="size-[18px]" />
				</Link>
				{/* Jumps to the 30-second explainer: a visitor who needs the
				    "what is it?" answer gets it one tap away. The ring is the
				    same timer glyph that section's pill carries. */}
				<a href="#what" className={cn(btnGhost, btnLg, 'w-full sm:w-auto lg:px-6')}>
					<svg aria-hidden viewBox="0 0 36 36" className="size-[18px] shrink-0">
						<circle cx="18" cy="18" r="15" fill="none" stroke="rgba(91,61,232,0.18)" strokeWidth="4" />
						<circle cx="18" cy="18" r="15" fill="none" stroke="#5b3de8" strokeWidth="4" strokeDasharray="70 100" strokeLinecap="round" transform="rotate(-90 18 18)" />
					</svg>
					{copy.how}
				</a>
			</div>

			<div role="img" aria-label={copy.stageLabel} className="vg-anim relative mt-6 w-full lg:mt-14">
				<DesktopStage locale={locale} />
				<MobileStage locale={locale} />
			</div>
		</section>
	)
}

/* ── Desktop stage: channels → agent → recorded results on a 1200×480 grid ── */

const W = 1200
type Box = { x: number; y: number; w: number; h?: number }

function place(box: Box, mirror: boolean, width = W): CSSProperties {
	return { position: 'absolute', top: box.y, left: mirror ? width - box.x - box.w : box.x, width: box.w, ...(box.h ? { height: box.h } : {}) }
}
const mx = (x: number, mirror: boolean, width = W) => (mirror ? width - x : x)

function DesktopStage({ locale }: { locale: SiteLocale }) {
	const copy = COPY[locale]
	const m = locale === 'en'
	const inPaths = CHANNELS.map((_, i) => {
		const y = 76 + i * 68
		return `M${mx(1000, m)} ${y} C ${mx(850, m)} ${y}, ${mx(820, m)} 240, ${mx(690, m)} 240`
	})
	const outPaths = [96, 198, 300, 402].map((y) => `M${mx(510, m)} 240 C ${mx(400, m)} 240, ${mx(410, m)} ${y}, ${mx(290, m)} ${y}`)
	const glow = ['vg-g1', 'vg-g2', '', '', 'vg-g3', '']
	const bubbleIn = m ? '16px 16px 16px 4px' : '16px 16px 4px 16px'
	const bubbleOut = m ? '16px 16px 4px 16px' : '16px 16px 16px 4px'

	return (
		<div className="hidden justify-center lg:flex">
			<div className="vg-stage vg-dots relative h-[480px] w-[1200px] shrink-0 overflow-hidden rounded-sheet border border-vg-line bg-white text-start shadow-[0_50px_90px_-56px_rgba(17,17,17,0.45)]" aria-hidden>
				<svg width={W} height={480} viewBox={`0 0 ${W} 480`} fill="none" className="absolute inset-0">
					{inPaths.map((d) => <path key={d} className="vg-flow" d={d} stroke="#5b3de8" strokeOpacity={0.35} strokeWidth={1.5} />)}
					{outPaths.map((d) => <path key={d} className="vg-flow" d={d} stroke="#15803d" strokeOpacity={0.35} strokeWidth={1.5} />)}
				</svg>
				{/* One packet per real event: each message leaves its own channel just
				    before its bubble appears, and each recorded result is sent the
				    moment its reply lands (see HERO_BEATS). */}
				{HERO_BEATS.map((beat) => (
					<div key={`in-${beat.channel}`} className="vg-pkt vg-shot" style={{ background: '#5b3de8', boxShadow: '0 0 0 4px rgba(91,61,232,0.15)', offsetPath: `path('${inPaths[beat.channel]}')`, animationDelay: `${beat.inAt}s` }} />
				))}
				{HERO_BEATS.map((beat) => (
					<div key={`out-${beat.result}`} className="vg-pkt vg-shot" style={{ background: '#15803d', boxShadow: '0 0 0 4px rgba(21,128,61,0.15)', offsetPath: `path('${outPaths[beat.result]}')`, animationDelay: `${beat.outAt}s` }} />
				))}

				<div className="text-[12px] font-medium text-vg-cap" style={place({ x: 1000, y: 18, w: 170 }, m)}>{copy.inputs}</div>
				<div className="text-[12px] font-medium text-vg-cap" style={place({ x: 30, y: 18, w: 260 }, m)}>{copy.outputs}</div>

				{CHANNELS.map((channel, i) => (
					<div
						key={channel.id}
						className={cn('flex items-center gap-2.5 rounded-control border border-vg-line bg-white px-2 text-[14px] font-medium', glow[i])}
						style={place({ x: 1000, y: 50 + i * 68, w: 170, h: 52 }, m)}
					>
						<ChannelBadge channel={channel} />
						{channel.label[locale]}
					</div>
				))}

				{copy.incoming.map((msg, i) => (
					<div
						key={msg.who}
						className={cn('border border-vg-line bg-white px-3.5 py-2.5 text-[13px] leading-[1.8] shadow-[0_16px_30px_-20px_rgba(17,17,17,0.4)]', ['vg-c1', 'vg-c2', 'vg-c3'][i])}
						style={{ ...place({ x: 468, y: 52, w: 264 }, m), borderRadius: bubbleIn }}
					>
						<div className="text-[12px] font-medium" style={{ color: msg.color }}>{msg.who}</div>
						{msg.text}
					</div>
				))}

				<div className="vg-ring rounded-full border-[1.5px] border-[rgba(91,61,232,0.45)]" style={place({ x: 516, y: 156, w: 168, h: 168 }, m)} />
				<div className="vg-ring rounded-full border-[1.5px] border-[rgba(91,61,232,0.45)] [animation-delay:1.4s]" style={place({ x: 516, y: 156, w: 168, h: 168 }, m)} />
				<div className="flex items-center justify-center rounded-full border border-vg-line bg-white shadow-[0_24px_50px_-24px_rgba(91,61,232,0.6)]" style={place({ x: 526, y: 166, w: 148, h: 148 }, m)}>
					<div className="flex size-[104px] flex-col items-center justify-center gap-0.5 rounded-full bg-vg-ink text-white">
						<Sparkles className="vg-spin size-6 text-[#b9adff]" strokeWidth={1.8} />
						<span className="text-[15px] font-bold">{copy.agent}</span>
					</div>
				</div>
				<div className="vg-think flex justify-center" style={place({ x: 470, y: 334, w: 260 }, m)}>
					<Thinking label={copy.thinking} />
				</div>

				{copy.replies.map((reply, i) => (
					<div
						key={reply.source}
						className={cn('bg-vg-ink px-3.5 py-2.5 text-[13px] leading-[1.8] text-white', ['vg-r1', 'vg-r2', 'vg-r3'][i])}
						style={{ ...place({ x: 468, y: 378, w: 264 }, m), borderRadius: bubbleOut }}
					>
						{reply.text}
						<div className="mt-0.5 text-[12px] text-[#b9adff]">{reply.source}</div>
					</div>
				))}
				{copy.chips.map((chip, i) => (
					<div
						key={chip}
						className={cn('flex [animation-delay:.4s]', REPLY_CLOCK[i], i === 1 ? 'justify-end' : 'justify-start')}
						style={place({ x: 440, y: 336, w: 320 }, m)}
					>
						<HeroChip index={i} text={chip} />
					</div>
				))}

				{copy.results.map((result, i) => {
					const { icon: Icon, tint, color } = RESULT_ICONS[i]
					return (
						<div
							key={result.title}
							className={cn('flex items-center gap-3 rounded-2xl border border-vg-line bg-white px-3.5', RESULT_LIT[i])}
							style={place({ x: 30, y: 56 + i * 102, w: 260, h: 80 }, m)}
						>
							<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: tint, color }}>
								<Icon className="size-5" strokeWidth={1.8} />
							</span>
							<div>
								<div className="text-[14px] font-bold">{result.title}</div>
								<div className="mt-0.5 text-[12px] text-vg-cap">{result.detail}</div>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function Thinking({ label, small = false }: { label: string; small?: boolean }) {
	return (
		<span className={cn('inline-flex items-center rounded-full bg-vg-tint font-medium text-[#4c2fd0]', small ? 'h-[26px] gap-[7px] px-[11px] text-[11.5px]' : 'h-[30px] gap-2 px-3 text-[12px]')}>
			<span className="inline-flex gap-[3px]">
				{[0, 0.2, 0.4].map((delay) => (
					<span key={delay} className={cn('vg-tdot rounded-full bg-vg-signal', small ? 'size-1' : 'size-[5px]')} style={{ animationDelay: `${delay}s` }} />
				))}
			</span>
			{label}
		</span>
	)
}

/* ── Mobile stage: channels on top, agent in the middle, results below ── */

const MW = 358

function MobileStage({ locale }: { locale: SiteLocale }) {
	const copy = COPY[locale]
	const m = locale === 'en'
	const xs = [318, 262, 207, 151, 96, 40]
	const paths = xs.map((x) => `M${mx(x, m, MW)} 108 C ${mx(x, m, MW)} 170, 179 168, 179 228`)
	const glow = ['vg-g1', 'vg-g2', '', '', 'vg-g3', '']
	const bubbleIn = m ? '16px 16px 16px 4px' : '16px 16px 4px 16px'
	const bubbleOut = m ? '16px 16px 4px 16px' : '16px 16px 16px 4px'

	return (
		<div className="flex justify-center lg:hidden">
			<div className="vg-mstage vg-dots relative h-[606px] w-[358px] shrink-0 overflow-hidden rounded-sheet border border-vg-line bg-white shadow-[0_40px_70px_-48px_rgba(17,17,17,0.5)]" aria-hidden>
				<svg width={MW} height={606} viewBox={`0 0 ${MW} 606`} fill="none" className="absolute inset-0">
					{paths.map((d) => <path key={d} className="vg-flow" d={d} stroke="#5b3de8" strokeOpacity={0.32} strokeWidth={1.4} />)}
					<path className="vg-flow" d="M179 456 L 179 474" stroke="#15803d" strokeOpacity={0.4} strokeWidth={1.4} />
				</svg>
				{HERO_BEATS.map((beat) => (
					<div key={beat.channel} className="vg-pkt vg-shot" style={{ background: '#5b3de8', boxShadow: '0 0 0 4px rgba(91,61,232,0.15)', offsetPath: `path('${paths[beat.channel]}')`, animationDelay: `${beat.inAt}s` }} />
				))}
				<div className="absolute inset-x-0 top-3.5 text-center text-[11.5px] font-medium text-vg-cap">{copy.inputs}</div>
				{CHANNELS.map((channel, i) => (
					<div key={channel.id}>
						<div className={cn('flex items-center justify-center rounded-control border border-vg-line bg-white', glow[i])} style={place({ x: xs[i] - 24, y: 40, w: 48, h: 44 }, m, MW)}>
							<ChannelBadge channel={channel} size={34} iconSize={17} />
						</div>
						<span className="text-center text-[11px] text-vg-sub" style={place({ x: xs[i] - 30, y: 88, w: 60 }, m, MW)}>{channel.short[locale]}</span>
					</div>
				))}
				{copy.incoming.map((msg, i) => (
					<div
						key={msg.who}
						className={cn('border border-vg-line bg-white px-3 py-[9px] text-start text-[13px] leading-[1.75] shadow-[0_14px_28px_-18px_rgba(17,17,17,0.45)]', ['vg-c1', 'vg-c2', 'vg-c3'][i])}
						style={{ ...place({ x: 54, y: 122, w: 250 }, m, MW), borderRadius: bubbleIn }}
					>
						<div className="text-[11px] font-bold" style={{ color: msg.color }}>{msg.who}</div>
						{msg.text}
					</div>
				))}
				<div className="vg-ring absolute left-[131px] top-[228px] size-24 rounded-full border-[1.5px] border-[rgba(91,61,232,0.45)]" />
				<div className="vg-ring absolute left-[131px] top-[228px] size-24 rounded-full border-[1.5px] border-[rgba(91,61,232,0.45)] [animation-delay:1.4s]" />
				<div className="absolute left-[131px] top-[228px] flex size-24 items-center justify-center rounded-full border border-vg-line bg-white shadow-[0_20px_40px_-20px_rgba(91,61,232,0.6)]">
					<div className="flex size-[70px] flex-col items-center justify-center gap-px rounded-full bg-vg-ink text-white">
						<Sparkles className="vg-spin size-[18px] text-[#b9adff]" strokeWidth={1.8} />
						<span className="text-[12px] font-bold">{copy.agent}</span>
					</div>
				</div>
				<div className="vg-think absolute inset-x-0 top-[334px] flex justify-center"><Thinking label={copy.thinking} small /></div>
				{copy.replies.map((reply, i) => (
					<div
						key={reply.source}
						className={cn('bg-vg-ink px-[13px] py-2.5 text-start text-[13px] leading-[1.75] text-white', ['vg-r1', 'vg-r2', 'vg-r3'][i])}
						style={{ ...place({ x: 40, y: 368, w: 278 }, m, MW), borderRadius: bubbleOut }}
					>
						{reply.text}
						<div className="text-[11px] text-[#b9adff]">{reply.source}</div>
					</div>
				))}
				{copy.chips.map((chip, i) => (
					<div
						key={chip}
						className={cn('flex [animation-delay:.4s]', REPLY_CLOCK[i], i === 1 ? 'justify-end' : 'justify-start')}
						style={place({ x: 34, y: 334, w: 290 }, m, MW)}
					>
						<HeroChip index={i} text={chip} small />
					</div>
				))}
				<div className="absolute inset-x-0 top-[440px] text-center text-[11.5px] font-medium text-vg-cap">{copy.outputs}</div>
				<div className="absolute inset-x-3 top-[474px] grid grid-cols-2 gap-2">
					{copy.results.map((result, i) => {
						const { icon: Icon, tint, color } = RESULT_ICONS[i]
						return (
							<div key={result.title} className={cn('flex h-14 items-center gap-[9px] rounded-control border border-vg-line bg-white px-2.5 text-start', RESULT_LIT[i])}>
								<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-chip" style={{ background: tint, color }}>
									<Icon className="size-4" strokeWidth={1.8} />
								</span>
								<span className="min-w-0">
									<span className="block truncate text-[12.5px] font-bold">{'mobileTitle' in result ? result.mobileTitle : result.title}</span>
									<span className="block truncate text-[11px] text-vg-cap">{result.short}</span>
								</span>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
