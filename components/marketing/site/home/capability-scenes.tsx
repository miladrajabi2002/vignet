import { ArrowLeftRight, Check, Globe, MessageSquare, PackageCheck, ShoppingCart, Sparkles } from '@/components/marketing/site/sprite-icons'
import { Bell, BellRing, Brain, CalendarCheck, CheckCheck, CircleHelp, CreditCard, FileText, Lock, MapPin, Mic, Package, Play, ScanSearch, Send, Shirt, ShieldAlert, ShieldCheck, Target, Truck, UserPlus, Users } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { SiteLocale } from '../ui'

/*
 * The capability demos, shared by the desktop bento and the phone stages
 * (capabilities.tsx). Plain server markup: every step is a CSS animation
 * (site.css `.cap-*`), so a scene costs no client JS. `compact` is the phone
 * layout: a fixed-height box, a little less detail.
 */

const KEY_FA = {
	learn: {
		top: 'منابع پاسخ', topMeta: '۴ منبع · ۴۲۰ صفحه',
		sources: ['PDF · ۴۲ صفحه', 'سایت', 'کاتالوگ · ۳۸۰ کالا', 'پرسش‌های پرتکرار'],
		asked: 'مشتری پرسید:', q: 'ارسال به شیراز چند روز طول می‌کشد؟',
		suggest: 'پیشنهاد ایجنت:', a: 'با پست پیشتاز ۳ تا ۴ روز کاری.', src: 'سیاست ارسال سایت',
		approve: 'تأیید و یادگیری', edit: 'ویرایش',
		done: 'یاد گرفت · دانش ایجنت', from: '۲۴۱', to: '۲۴۲', unit: 'پاسخ',
	},
	sell: {
		tabs: ['درگاه سایت شما', 'کارت‌به‌کارت ویجنت'],
		cart: 'سبد شما', host: 'yourshop.ir', item: 'میز TV آرتا · گردویی', itemPrice: '۶٬۹۰۰٬۰۰۰', ship: 'ارسال', shipPrice: '۸۰٬۰۰۰',
		pay: 'پرداخت ۶٬۹۸۰٬۰۰۰ تومان', paid: 'پرداخت شد با زرین‌پال', order: 'ووکامرس · سفارش #۱۰۴۸',
		card: 'کارت مقصد', cardNo: '6104 •••• 4210', cardNote: 'مشتری مبلغ سفارش را کارت‌به‌کارت می‌کند',
		sms: 'پیامک بانک', smsTime: '۱۴:۰۲', smsPre: 'واریز', smsAmount: '۲٬۴۸۰٬۰۰۰ تومان', smsPost: 'به کارت ۴۲۱۰',
		match: 'با سفارش #۱۰۴۹ تطبیق داده شد', ok: 'پرداخت تأیید شد · بدون اینماد',
	},
	book: {
		ask: 'جمعه عصر وقت دارید؟',
		week: [['ش', '۲۵'], ['ی', '۲۶'], ['د', '۲۷'], ['س', '۲۸'], ['چ', '۲۹'], ['پ', '۳۰'], ['ج', '۱']],
		slots: ['۱۶:۰۰', '۱۷:۰۰', '۱۸:۳۰'],
		done: 'نوبت جمعه ساعت ۱۷:۰۰ ثبت شد', team: 'به تیم خبر داده شد',
	},
	bot: {
		name: 'ربات مدیریت ویجنت', online: 'آنلاین',
		alert: '🙋 سارا به اپراتور سپرده شد: «سفارشم دیر شده»', reply: '✍️ پاسخ', close: '✅ بستن',
		closed: 'گفتگو بسته شد', report: '🌅 گزارش امروز: ۴۲ گفتگو · ۳ سفارش · ۵ نوبت',
	},
	inbox: {
		channels: ['اینستاگرام', 'تلگرام', 'بله', 'روبیکا', 'سایت'],
		/** Newest first; the first three land during the scene. [name, text, channel] */
		rows: [['مینا', 'کد تخفیف دارید؟', 4], ['علی', 'ارسال به تبریز دارید؟', 3], ['رضا', 'کامنت: قیمتش چنده؟', 0], ['نگار', 'وقت جمعه هست؟', 1], ['مهدی', 'قرارداد سازمانی', 2], ['امیر', 'سفارشم کی می‌رسه؟', 1], ['سارا', 'کت مشکی موجوده؟', 0]] as [string, string, number][],
		foot: 'پیام تازه', digits: ['۰', '۱', '۲', '۳'],
	},
	voice: { time: '۰:۰۶', caption: 'متن پیام، هم‌زمان با پخش', words: 'سلام، برای فردا ساعت پنج وقت خالی دارید؟', reply: 'پاسخ صوتی ایجنت · ۰:۰۴' },
	pre: { agent: 'سایز L الان تمام شده؛ رسید خبرتان کنم؟', user: 'آره حتماً', on: 'هشدار موجودی فعال شد', later: 'سه روز بعد', back: 'سایز L رسید! 🎉', buy: 'خرید' },
	crm: {
		initial: 'س', name: 'سارا', channels: ['اینستاگرام', 'سایت', 'تلگرام'],
		intent: 'قصد خرید', intentValue: 'بالا', summaryLabel: 'خلاصه:', summary: 'کت مشکی سایز M، قد ۱۷۰، لینک پرداخت ارسال شد.',
		hand: 'سپرده شد به نگار، با همین خلاصه',
	},
	ctrl: {
		tones: ['محاوره‌ای', 'رسمی'], preview: 'پیش‌نمایش پاسخ ایجنت',
		casual: 'سلام! آره موجوده، سایزت چنده؟ 🙂', formal: 'سلام، بله موجود است. چه سایزی مدنظرتان است؟',
		rules: ['تحویل به انسان هنگام شکایت', 'پاسخ فقط از دانش تأییدشده'],
	},
	rep: { kpis: ['حل خودکار', 'رضایت از ۵', 'سهم اینستاگرام'], percent: "'٪'", days: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'], cost: 'هزینهٔ هوش مصنوعی این ماه', costValue: '۴۸۰٬۰۰۰ تومان' },
}

const KEY_EN: typeof KEY_FA = {
	learn: {
		top: 'Answer sources', topMeta: '4 sources · 420 pages',
		sources: ['PDF · 42 pages', 'Website', 'Catalog · 380 items', 'FAQs'],
		asked: 'A customer asked:', q: 'How many days does shipping to Shiraz take?',
		suggest: 'Agent suggestion:', a: '3 to 4 business days by express post.', src: 'site shipping policy',
		approve: 'Approve & learn', edit: 'Edit',
		done: 'Learned · agent knowledge', from: '241', to: '242', unit: 'answers',
	},
	sell: {
		tabs: ['Your site’s gateway', 'Vigent card-to-card'],
		cart: 'Your cart', host: 'yourshop.ir', item: 'Arta TV stand · walnut', itemPrice: '6,900,000', ship: 'Delivery', shipPrice: '80,000',
		pay: 'Pay 6,980,000 toman', paid: 'Paid with ZarinPal', order: 'WooCommerce · order #1048',
		card: 'Destination card', cardNo: '6104 •••• 4210', cardNote: 'The customer transfers the order total card-to-card',
		sms: 'Bank SMS', smsTime: '14:02', smsPre: 'Deposit of', smsAmount: '2,480,000 toman', smsPost: 'to card 4210',
		match: 'Matched to order #1049', ok: 'Payment confirmed · no Enamad',
	},
	book: {
		ask: 'Any time Friday evening?',
		week: [['Sa', '25'], ['Su', '26'], ['Mo', '27'], ['Tu', '28'], ['We', '29'], ['Th', '30'], ['Fr', '1']],
		slots: ['16:00', '17:00', '18:30'],
		done: 'Booked for Friday at 17:00', team: 'Team notified',
	},
	bot: {
		name: 'Vigent manager bot', online: 'online',
		alert: '🙋 Sara was handed to you: “my order is late”', reply: '✍️ Reply', close: '✅ Resolve',
		closed: 'Conversation resolved', report: '🌅 Today: 42 chats · 3 orders · 5 bookings',
	},
	inbox: {
		channels: ['Instagram', 'Telegram', 'Bale', 'Rubika', 'Website'],
		rows: [['Mina', 'any discount code?', 4], ['Ali', 'do you ship to Tabriz?', 3], ['Reza', 'comment: how much?', 0], ['Negar', 'Friday slot?', 1], ['Mehdi', 'enterprise contract', 2], ['Amir', 'when does my order arrive?', 1], ['Sara', 'black cardigan in stock?', 0]],
		foot: 'New messages', digits: ['0', '1', '2', '3'],
	},
	voice: { time: '0:06', caption: 'Transcript, as it plays', words: 'Hi, any free slot tomorrow at five?', reply: 'Agent voice reply · 0:04' },
	pre: { agent: 'Size L just sold out — shall I tell you when it’s back?', user: 'Yes please', on: 'Back-in-stock alert is on', later: 'Three days later', back: 'Size L is back! 🎉', buy: 'Buy' },
	crm: {
		initial: 'S', name: 'Sara', channels: ['Instagram', 'Website', 'Telegram'],
		intent: 'Purchase intent', intentValue: 'High', summaryLabel: 'Summary:', summary: 'black cardigan size M, height 170, payment link sent.',
		hand: 'Handed to Negar, with this summary',
	},
	ctrl: {
		tones: ['Casual', 'Formal'], preview: 'Agent reply preview',
		casual: 'Hey! Yep, it’s in stock — what size? 🙂', formal: 'Hello, yes, it is in stock. Which size would you like?',
		rules: ['Hand off to a human on complaints', 'Answer only from approved knowledge'],
	},
	rep: { kpis: ['Auto-resolved', 'Rating of 5', 'Instagram share'], percent: "'%'", days: ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'], cost: 'AI cost this month', costValue: '480,000 toman' },
}

const KEY_SCENES = { fa: KEY_FA, en: KEY_EN } satisfies Record<SiteLocale, typeof KEY_FA>

const CHANNEL_COLORS = ['#be185d', '#0369a1', '#00a37a', '#9333ea', '#5b3de8']
/* Which channel pill lights for each landing message (cap-h1..3). */
const CHANNEL_LIT: Record<number, string> = { 0: 'cap-h1', 3: 'cap-h2', 4: 'cap-h3' }
const ROW_LIT = ['cap-h3', 'cap-h2', 'cap-h1']
const SOURCE_ICONS = [FileText, Globe, Package, CircleHelp]

const at = (d: number, extra?: Record<string, string | number>) => ({ '--d': `${d}s`, ...extra }) as CSSProperties

/** One step of a scene: rises in after `d` seconds. */
function Q({ d = 0, className, style, children }: { d?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
	return <div className={cn('cap-q', className)} style={{ ...at(d), ...style }}>{children}</div>
}

/** The demo cursor: glides onto its (relative) parent and clicks it at `d + .7s`. */
function Cursor({ d }: { d: number }) {
	return <i className="cap-cur" style={at(d)}><svg viewBox="0 0 24 24"><path d="M5 3l14 8.2-6.2 1.6L9.9 19z" /></svg></i>
}

function Stage({ compact, tone, className, children }: { compact?: boolean; tone?: 'panel' | 'dark' | 'tg'; className?: string; children: ReactNode }) {
	return (
		<div aria-hidden className={cn('cap-stg', compact && 'cap-box', tone === 'panel' && !compact && 'cap-panel', tone === 'dark' && 'cap-dark', tone === 'tg' && 'cap-tg', className)}>
			{children}
		</div>
	)
}

const ic = 'size-3.5 shrink-0'

export type KeySceneId = 'learn' | 'sell' | 'book' | 'bot' | 'lang' | 'inbox' | 'voice' | 'pre' | 'crm' | 'ctrl' | 'rep'

type SceneProps = { locale: SiteLocale; compact?: boolean }

function LearnScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].learn
	return (
		<Stage compact={compact} tone="panel">
			{compact ? null : <Q className="cap-top"><span>{s.top}</span><em>{s.topMeta}</em></Q>}
			<div className="flex flex-wrap gap-[5px]">
				{s.sources.slice(0, compact ? 3 : 4).map((label, i) => {
					const Icon = SOURCE_ICONS[i]
					return <Q key={label} d={0.15 + i * 0.2} className="cap-src"><Icon className="size-3 text-vg-cap" strokeWidth={1.9} /><span>{label}</span><Check className="cap-tick size-3" strokeWidth={2.4} /></Q>
				})}
			</div>
			<Q d={1.2} className="cap-card"><span className="text-vg-dim">{s.asked}</span> {s.q}</Q>
			<Q d={1.9} className="cap-card cap-card-hi"><span className="font-semibold text-vg-signal">{s.suggest}</span> {s.a} <mark className="cap-mark">{s.src}</mark></Q>
			<Q d={2.6} className="flex gap-1.5">
				<span className="cap-btn cap-press" style={{ '--pd': '3.6s' } as CSSProperties}><Check className={ic} strokeWidth={2.2} />{s.approve}<Cursor d={2.9} /></span>
				<span className="cap-ghost">{s.edit}</span>
			</Q>
			<Q d={3.9} className="cap-chip cap-ok">
				<Sparkles className={ic} strokeWidth={2} />{s.done}{' '}
				<span className="cap-st" style={{ '--sd': '4.3s' } as CSSProperties}><span className="cap-st-a">{s.from}</span><span className="cap-st-b">{s.to}</span></span> {s.unit}
			</Q>
		</Stage>
	)
}

/** `mode` 'both' is the desktop card: its replay wrapper flips `data-alt` between the two paths. */
function SellScene({ locale, compact, mode = 0 }: SceneProps & { mode?: 0 | 1 | 'both' }) {
	const s = KEY_SCENES[locale].sell
	const both = mode === 'both'
	const gateway = (
		<div className={cn('cap-col', both && 'cap-m0')}>
			<Q d={0.3} className="cap-card flex flex-col gap-1">
				<div className="flex items-center justify-between"><b className="inline-flex items-center gap-1.5"><ShoppingCart className={ic} strokeWidth={2} />{s.cart}</b><span dir="ltr" className="inline-flex items-center gap-1 text-vg-dim"><Lock className="size-3 text-vg-ok" strokeWidth={2.2} />{s.host}</span></div>
				<div className="flex justify-between tabular-nums"><span>{s.item}</span><span>{s.itemPrice}</span></div>
				<div className="flex justify-between tabular-nums text-vg-dim"><span>{s.ship}</span><span>{s.shipPrice}</span></div>
			</Q>
			<Q d={0.9}><span className="cap-btn cap-press flex h-[34px] w-full tabular-nums" style={{ '--pd': '2.1s' } as CSSProperties}><CreditCard className={ic} strokeWidth={2} />{s.pay}<Cursor d={1.4} /></span></Q>
			<div className="flex flex-wrap gap-[5px]">
				<Q d={2.6} className="cap-chip cap-ok"><Check className={ic} strokeWidth={2.4} />{s.paid}</Q>
				<Q d={3.1} className="cap-chip cap-vi"><PackageCheck className={ic} strokeWidth={2} />{s.order}</Q>
			</div>
		</div>
	)
	const card = (
		<div className={cn('cap-col', both && 'cap-m1')}>
			<Q d={0.3} className="cap-card flex flex-col gap-0.5">
				<div className="flex items-center justify-between"><b className="inline-flex items-center gap-1.5"><CreditCard className={ic} strokeWidth={2} />{s.card}</b><span dir="ltr" className="tabular-nums text-vg-dim">{s.cardNo}</span></div>
				<div className="text-vg-cap">{s.cardNote}</div>
			</Q>
			<Q d={1.1} className="cap-card cap-sms flex flex-col gap-0.5">
				<div className="flex items-center justify-between"><b className="inline-flex items-center gap-1.5"><MessageSquare className={ic} strokeWidth={2} />{s.sms}</b><span className="tabular-nums text-vg-dim">{s.smsTime}</span></div>
				<div className="tabular-nums">{s.smsPre} <b>{s.smsAmount}</b> {s.smsPost}</div>
			</Q>
			<Q d={1.9} className="cap-chip cap-vi"><ArrowLeftRight className={ic} strokeWidth={2} />{s.match}</Q>
			<Q d={2.7} className="cap-chip cap-ok"><Check className={ic} strokeWidth={2.4} />{s.ok}</Q>
		</div>
	)
	return (
		<Stage compact={compact}>
			<Q className="cap-tabs">
				<span className={cn('cap-tab cap-tab-a', mode !== 1 && 'cap-tab-on')}>{s.tabs[0]}</span>
				<span className={cn('cap-tab cap-tab-b', mode === 1 && 'cap-tab-on')}>{s.tabs[1]}</span>
			</Q>
			{mode === 1 ? null : gateway}
			{mode === 0 ? null : card}
		</Stage>
	)
}

function BookScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].book
	return (
		<Stage compact={compact}>
			<Q className="cap-bub cap-bub-in">{s.ask}</Q>
			<Q d={0.5} className="cap-week">
				{s.week.map(([day, date], i) => (
					<span key={date} className={cn('cap-day', i < 3 && 'cap-day-off')}>
						{day}<b>{date}</b>
						{i === 6 ? <span className="cap-sel" style={at(1)}>{day}<b>{date}</b></span> : null}
					</span>
				))}
			</Q>
			<Q d={1.2} className="flex gap-1.5">
				{s.slots.map((slot, i) => (
					<span key={slot} className={cn('cap-slot', i === 0 && 'cap-slot-x')}>
						{slot}
						{i === 1 ? <><span className="cap-sel" style={at(2.2)}>{slot}</span><Cursor d={1.6} /></> : null}
					</span>
				))}
			</Q>
			<div className="flex flex-wrap gap-[5px]">
				<Q d={2.7} className="cap-chip cap-ok"><CalendarCheck className={ic} strokeWidth={2} />{s.done}</Q>
				<Q d={3.2} className="cap-chip cap-vi"><BellRing className={ic} strokeWidth={2} />{s.team}</Q>
			</div>
		</Stage>
	)
}

function BotScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].bot
	return (
		<Stage compact={compact} tone="tg">
			<Q className="flex items-center gap-2 text-[11.5px]">
				<span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#0369a1] text-white"><Send className="size-3" strokeWidth={2} /></span>
				<b>{s.name}</b>
				<em className="ms-auto text-[10.5px] not-italic text-[#16a34a]">{s.online}</em>
			</Q>
			<Q d={0.4} className="cap-tgm">{s.alert}</Q>
			<Q d={1} className="grid grid-cols-2 gap-[5px]">
				<span className="cap-tgb">{s.reply}</span>
				<span className="cap-tgb cap-press" style={{ '--pd': '2.4s' } as CSSProperties}>{s.close}<Cursor d={1.7} /></span>
			</Q>
			<Q d={2.7} className="cap-sys"><Check className="size-3" strokeWidth={2.4} />{s.closed}</Q>
			<Q d={3.3} className="cap-tgm">{s.report}</Q>
		</Stage>
	)
}

/* The same agent, three languages, each reply in kind (identical in both locales). */
function LangScene({ compact }: SceneProps) {
	return (
		<Stage compact={compact}>
			<Q className="cap-bub cap-bub-in"><span dir="ltr">Do you ship to Dubai?</span></Q>
			<Q d={0.7} className="cap-bub cap-bub-out"><span dir="ltr">Yes! Delivery takes 5–7 days 🚚</span></Q>
			<Q d={1.5} className="cap-bub cap-bub-in"><span dir="rtl">هل يتوفر مقاس L؟</span></Q>
			<Q d={2.2} className="cap-bub cap-bub-out"><span dir="rtl">نعم، مقاس L متوفر ✓</span></Q>
		</Stage>
	)
}

/* Three conversations land on top one by one; their channel lights and the counter ticks (site.css cap-ib). */
function InboxScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].inbox
	return (
		<Stage compact={compact}>
			<div className="cap-chs">
				{s.channels.map((name, i) => (
					<span key={name} className="cap-ch">
						<i style={{ background: CHANNEL_COLORS[i] }} />{name}
						{CHANNEL_LIT[i] ? <span className={cn('cap-ch-on', CHANNEL_LIT[i])}><i style={{ background: CHANNEL_COLORS[i] }} />{name}</span> : null}
					</span>
				))}
			</div>
			<div className="cap-ib" style={{ '--cap-rows': compact ? 3 : 4 } as CSSProperties}>
				<div className="cap-ib-list">
					{s.rows.map(([name, text, channel], i) => (
						<div key={name} className="cap-ibr">
							{i < 3 ? <span className={cn('cap-hl', ROW_LIT[i])} /> : null}
							<i style={{ background: CHANNEL_COLORS[channel] }} />
							<span className="min-w-0 grow truncate"><b>{name}</b> — {text}</span>
							<em>{s.channels[channel]}</em>
						</div>
					))}
				</div>
			</div>
			<div className="flex items-center justify-between text-vg-dim">
				<span>{s.foot}</span>
				<b className="cap-odo"><span className="cap-odo-s">{s.digits.map((digit) => <span key={digit}>{digit}</span>)}</span></b>
			</div>
		</Stage>
	)
}

function VoiceScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].voice
	return (
		<Stage compact={compact} tone="dark">
			<Q className="flex items-center gap-2.5">
				<span className="cap-play"><Play className="size-3.5" strokeWidth={2.2} /></span>
				<span className="cap-wave">
					{Array.from({ length: compact ? 18 : 22 }, (_, i) => <i key={i} className="cap-bar" style={{ '--w': `${((i * 0.137) % 0.6).toFixed(2)}s`, '--l': `${(0.3 + i * 0.1).toFixed(2)}s` } as CSSProperties} />)}
				</span>
				<span className="text-[11px] tabular-nums text-[#a1a1aa]">{s.time}</span>
			</Q>
			<Q d={0.4} className="text-[13px] leading-[1.9] text-[#f4f4f5]">
				<span className="block text-[10.5px] text-[#a1a1aa]">{s.caption}</span>
				{s.words.split(' ').map((word, i) => <span key={i} className="cap-word" style={at(0.6 + i * 0.3)}>{word}</span>)}
			</Q>
			<Q d={3} className="cap-chip cap-lilac">
				<Mic className={ic} strokeWidth={2} />{s.reply}
				<span className="cap-wave cap-wave-sm">{Array.from({ length: 8 }, (_, i) => <i key={i} className="cap-bar-sm" style={{ '--w': `${(i * 0.11).toFixed(2)}s` } as CSSProperties} />)}</span>
			</Q>
		</Stage>
	)
}

function PreScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].pre
	return (
		<Stage compact={compact}>
			<Q className="cap-bub cap-bub-out">{s.agent}</Q>
			<Q d={0.7} className="cap-bub cap-bub-in">{s.user}</Q>
			<Q d={1.3} className="cap-chip cap-vi"><Bell className={ic} strokeWidth={2} />{s.on}</Q>
			<Q d={2} className="flex items-center gap-2 text-[10.5px] text-vg-dim before:h-px before:flex-1 before:bg-black/10 after:h-px after:flex-1 after:bg-black/10">{s.later}</Q>
			<Q d={2.6} className="cap-bub cap-bub-out">
				{s.back}
				<span className="mt-1.5 flex h-[30px] items-center justify-center gap-1.5 rounded-[10px] bg-white text-[11.5px] font-semibold text-vg-ink"><ShoppingCart className={ic} strokeWidth={2} />{s.buy}</span>
			</Q>
		</Stage>
	)
}

function CrmScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].crm
	const colors = [CHANNEL_COLORS[0], CHANNEL_COLORS[4], CHANNEL_COLORS[1]]
	return (
		<Stage compact={compact}>
			<Q className="cap-card flex items-center gap-[9px]">
				<span className="cap-av">{s.initial}</span>
				<div className="min-w-0 grow">
					<b>{s.name}</b>
					<div className="flex flex-wrap items-center gap-1 text-[10.5px] text-vg-dim">
						{s.channels.map((name, i) => <span key={name} className="inline-flex items-center gap-1"><i className="size-1.5 rounded-full" style={{ background: colors[i] }} />{name}</span>)}
					</div>
				</div>
			</Q>
			<Q d={0.7} className="cap-card flex flex-col gap-1">
				<div className="flex justify-between"><span className="text-vg-dim">{s.intent}</span><b>{s.intentValue}</b></div>
				<div className="cap-meter"><b className="cap-meter-b" style={{ '--md': '1.1s' } as CSSProperties} /></div>
			</Q>
			<Q d={1.6} className="cap-card"><span className="text-vg-dim">{s.summaryLabel}</span> {s.summary}</Q>
			<Q d={2.5} className="cap-chip cap-warn"><ArrowLeftRight className={ic} strokeWidth={2} />{s.hand}</Q>
		</Stage>
	)
}

function CtrlScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].ctrl
	return (
		<Stage compact={compact}>
			<Q className="cap-seg">
				<i className="cap-seg-i" />
				<span>{s.tones[0]}</span>
				<span>{s.tones[1]}<Cursor d={0.6} /></span>
			</Q>
			<Q d={0.3} className="cap-card flex flex-col gap-1">
				<span className="text-vg-dim">{s.preview}</span>
				<div className="cap-pv"><span className="cap-pv-a">{s.casual}</span><span className="cap-pv-b">{s.formal}</span></div>
			</Q>
			<Q d={0.6} className="cap-rule"><span>{s.rules[0]}</span><i className="cap-tgl"><i className="cap-knob" /></i></Q>
			<Q d={0.8} className="cap-rule"><span>{s.rules[1]}</span><i className="cap-tgl"><i className="cap-tgl-off" /><i className="cap-knob cap-knob-mv" /></i></Q>
		</Stage>
	)
}

const KPI_VALUES = [{ to: 87, percent: true }, { to: 4, to2: 8 }, { to: 31, percent: true }]

function RepScene({ locale, compact }: SceneProps) {
	const s = KEY_SCENES[locale].rep
	return (
		<Stage compact={compact}>
			<div className="flex gap-1.5">
				{s.kpis.map((label, i) => {
					const kpi = KPI_VALUES[i]
					return (
						<Q key={label} d={i * 0.15} className="cap-kpi">
							<b className={cn('cap-cn', kpi.to2 !== undefined && 'cap-dec')} style={at(i * 0.15, { '--to': kpi.to, '--to2': kpi.to2 ?? 0, ...(kpi.percent ? { '--suf': s.percent } : null) })} />
							<span>{label}</span>
						</Q>
					)
				})}
			</div>
			<div className="cap-area">
				<svg viewBox="0 0 300 90" preserveAspectRatio="none">
					<path className="cap-area-f" d="M0 70 L50 62 L100 66 L150 44 L200 50 L250 26 L300 18 L300 90 L0 90Z" />
					<path className="cap-area-l" pathLength={100} d="M0 70 L50 62 L100 66 L150 44 L200 50 L250 26 L300 18" />
				</svg>
				<i className="cap-dot" />
			</div>
			<div className="flex justify-between text-[10px] text-vg-dim">{s.days.map((day) => <span key={day}>{day}</span>)}</div>
			{compact ? null : <Q d={1.6} className="flex justify-between text-vg-dim"><span>{s.cost}</span><b className="tabular-nums text-vg-ink">{s.costValue}</b></Q>}
		</Stage>
	)
}

export function KeyScene({ id, locale, compact, mode }: { id: KeySceneId; locale: SiteLocale; compact?: boolean; mode?: 0 | 1 | 'both' }) {
	switch (id) {
		case 'learn': return <LearnScene locale={locale} compact={compact} />
		case 'sell': return <SellScene locale={locale} compact={compact} mode={mode} />
		case 'book': return <BookScene locale={locale} compact={compact} />
		case 'bot': return <BotScene locale={locale} compact={compact} />
		case 'lang': return <LangScene locale={locale} compact={compact} />
		case 'inbox': return <InboxScene locale={locale} compact={compact} />
		case 'voice': return <VoiceScene locale={locale} compact={compact} />
		case 'pre': return <PreScene locale={locale} compact={compact} />
		case 'crm': return <CrmScene locale={locale} compact={compact} />
		case 'ctrl': return <CtrlScene locale={locale} compact={compact} />
		case 'rep': return <RepScene locale={locale} compact={compact} />
	}
}

/* ── Quiet capabilities: one small scene each, for the phone detail card ── */

export type QuietId = 'alert' | 'photo' | 'memory' | 'intent' | 'human' | 'truth' | 'lead' | 'paylink' | 'campaign' | 'improve' | 'vigento' | 'order' | 'cart' | 'size'

const QUIET_FA = {
	photo: { found: 'مشابه پیدا شد', name: 'کت پشمی مشکی', price: '۲٬۴۰۰٬۰۰۰ تومان · موجود' },
	size: { ask: 'مشکی می‌خوام', reply: 'مشکی فقط S و M دارد؛ کدام؟' },
	cart: { time: '۵۹:۴۲', held: 'سبد · ۲ کالا رزرو شد', remind: 'نیم ساعت مانده، یادآوری شد', gone: 'کالای تمام‌شده از سبد رفت' },
	paylink: { link: 'لینک پرداخت · ۲٬۴۰۰٬۰۰۰ تومان', sent: 'ارسال شد ۲ ساعت پیش · باز نشده', nudge: 'لینک پرداختتان هنوز باز است؛ کمکی لازم دارید؟', once: 'فقط یک بار، مؤدبانه' },
	order: { steps: ['ثبت', 'ارسال', 'تحویل'], msg: 'بسته‌تان ارسال شد · کد رهگیری ۲۴۸۹۱۳' },
	memory: { initial: 'س', name: 'سارا', last: 'آخرین گفتگو: ۲ ماه پیش', facts: ['شیراز', 'سایز M', 'رنگ تیره'], msg: 'سلام سارا! مدل تیرهٔ جدید سایز M رسید.' },
	intent: { label: 'نشانه‌های قصد خرید', value: '۸۵٪', signs: ['هزینهٔ ارسال را پرسید', 'سایزش را گفت'], flag: 'آمادهٔ خرید · علامت خورد' },
	lead: { ask: 'قبل از ادامه، اسم و شماره‌تان را می‌گویید؟', answer: 'سارا · ۰۹۱۲۳۴۵۶۷۸۹', saved: 'در CRM ثبت شد' },
	alert: { msg: 'سه روزه منتظرم! دیگه خرید نمی‌کنم', flag: 'گفتگوی حساس', hand: 'با خلاصه به همکار سپرده شد' },
	campaign: { name: 'حراج آخر هفته', audience: '۳۲۰ نفر با اجازه', delivered: '۲۹۸ نفر دریافت کردند', rest: 'بقیه هیچ پیامی نگرفتند' },
	human: { stiff: 'با سلام و احترام، از ارتباط شما سپاسگزاریم.', natural: 'سلام! آره موجوده، سایزت چنده؟ 🙂' },
	truth: { ask: 'قیمتش چنده؟ موجوده؟', answer: '۲٬۴۰۰٬۰۰۰ تومان · ۳ عدد موجود', source: 'از ووکامرس · ۲ دقیقه پیش' },
	improve: { title: 'مرور گفتگوهای امروز', count: '۴۲ گفتگو', ideas: '۳ پیشنهاد برای بهتر شدن پاسخ‌ها' },
	vigento: { name: 'ویجنتو', role: 'دستیار پنل', ask: 'این هفته فروش چطور بود؟', answer: '۱۸ سفارش؛ ۲۲٪ بیشتر از هفتهٔ قبل.' },
}

const QUIET_EN: typeof QUIET_FA = {
	photo: { found: 'Match found', name: 'Black wool coat', price: '2,400,000 toman · in stock' },
	size: { ask: 'I want it in black', reply: 'Black comes in S and M only — which one?' },
	cart: { time: '59:42', held: 'Cart · 2 items reserved', remind: 'Reminder at the half-hour mark', gone: 'Sold-out item left the cart' },
	paylink: { link: 'Payment link · 2,400,000 toman', sent: 'Sent 2 hours ago · not opened', nudge: 'Your payment link is still open — need any help?', once: 'Just once, politely' },
	order: { steps: ['Placed', 'Shipped', 'Delivered'], msg: 'Your parcel has shipped · tracking 248913' },
	memory: { initial: 'S', name: 'Sara', last: 'Last chat: 2 months ago', facts: ['Shiraz', 'Size M', 'Dark colours'], msg: 'Hi Sara! The new dark model just arrived in M.' },
	intent: { label: 'Purchase signals', value: '85%', signs: ['Asked about shipping', 'Gave her size'], flag: 'Ready to buy · flagged' },
	lead: { ask: 'Before we go on, may I have your name and number?', answer: 'Sara · 0912 345 6789', saved: 'Saved to the CRM' },
	alert: { msg: 'Three days waiting! I’m never ordering again', flag: 'Sensitive conversation', hand: 'Handed to a teammate with a summary' },
	campaign: { name: 'Weekend sale', audience: '320 opted-in customers', delivered: 'Delivered to 298', rest: 'Nobody else got a message' },
	human: { stiff: 'Dear valued customer, thank you for contacting us.', natural: 'Hey! Yep, it’s in stock — what size? 🙂' },
	truth: { ask: 'How much is it? In stock?', answer: '2,400,000 toman · 3 in stock', source: 'From WooCommerce · 2 min ago' },
	improve: { title: 'Reviewing today’s chats', count: '42 chats', ideas: '3 suggestions to sharpen replies' },
	vigento: { name: 'Vigento', role: 'panel assistant', ask: 'How were sales this week?', answer: '18 orders, 22% up on last week.' },
}

const QUIET_SCENES = { fa: QUIET_FA, en: QUIET_EN } satisfies Record<SiteLocale, typeof QUIET_FA>

function Mini({ row, children }: { row?: boolean; children: ReactNode }) {
	return <div aria-hidden className={cn('cap-mini', row && 'cap-mini-row')}>{children}</div>
}

export function QuietScene({ id, locale }: { id: QuietId; locale: SiteLocale }) {
	const q = QUIET_SCENES[locale]
	switch (id) {
		case 'photo': return (
			<Mini row>
				<div className="cap-photo"><Shirt className="size-9 opacity-90" strokeWidth={1.6} /><b className="cap-scan" /></div>
				<div className="flex min-w-0 grow flex-col gap-1.5">
					<Q d={0.9} className="cap-chip cap-vi"><ScanSearch className={ic} strokeWidth={2} />{q.photo.found}</Q>
					<Q d={1.4} className="cap-card"><b>{q.photo.name}</b><div className="tabular-nums text-vg-dim">{q.photo.price}</div></Q>
				</div>
			</Mini>
		)
		case 'size': return (
			<Mini>
				<Q className="cap-bub cap-bub-in">{q.size.ask}</Q>
				<Q d={0.5} className="cap-sizes"><span className="cap-size">S</span><span className="cap-size">M</span><span className="cap-size cap-size-x">L</span><span className="cap-size cap-size-x">XL</span></Q>
				<Q d={1.1} className="cap-bub cap-bub-out">{q.size.reply}</Q>
			</Mini>
		)
		case 'cart': return (
			<Mini row>
				<div className="cap-ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" /><circle className="cap-ring-fg" cx="22" cy="22" r="19" /></svg><b>{q.cart.time}</b></div>
				<div className="flex min-w-0 grow flex-col gap-1.5">
					<Q d={0.2} className="cap-card inline-flex items-center gap-1.5"><ShoppingCart className={ic} strokeWidth={2} />{q.cart.held}</Q>
					<Q d={0.9} className="cap-chip cap-warn"><Bell className={ic} strokeWidth={2} />{q.cart.remind}</Q>
					<Q d={1.6} className="cap-chip bg-white text-vg-dim line-through">{q.cart.gone}</Q>
				</div>
			</Mini>
		)
		case 'paylink': return (
			<Mini>
				<Q className="cap-card"><b className="inline-flex items-center gap-1.5"><CreditCard className={ic} strokeWidth={2} />{q.paylink.link}</b><div className="text-vg-dim">{q.paylink.sent}</div></Q>
				<Q d={0.8} className="cap-bub cap-bub-out">{q.paylink.nudge}</Q>
				<Q d={1.5} className="cap-chip cap-warn"><Bell className={ic} strokeWidth={2} />{q.paylink.once}</Q>
			</Mini>
		)
		case 'order': return (
			<Mini>
				<div className="cap-trk"><i className="cap-trk-l"><b /></i><span className="cap-trk-w"><span className="cap-truck"><Truck className="size-4 rtl:-scale-x-100" strokeWidth={2} /></span></span></div>
				<div className="flex justify-between text-[10.5px] text-vg-dim">{q.order.steps.map((step) => <span key={step}>{step}</span>)}</div>
				<Q d={1.5} className="cap-bub cap-bub-out">{q.order.msg}</Q>
			</Mini>
		)
		case 'memory': return (
			<Mini>
				<Q className="flex items-center gap-2"><span className="cap-av size-[26px] text-[11px]">{q.memory.initial}</span><b>{q.memory.name}</b><span className="text-vg-dim">{q.memory.last}</span></Q>
				<div className="flex flex-wrap gap-[5px]">
					{q.memory.facts.map((fact, i) => <Q key={fact} d={0.5 + i * 0.3} className="cap-chip cap-vi">{i === 0 ? <MapPin className={ic} strokeWidth={2} /> : null}{fact}</Q>)}
				</div>
				<Q d={1.7} className="cap-bub cap-bub-out">{q.memory.msg}</Q>
			</Mini>
		)
		case 'intent': return (
			<Mini>
				<Q className="flex justify-between"><span>{q.intent.label}</span><b className="tabular-nums">{q.intent.value}</b></Q>
				<Q d={0.2} className="cap-meter"><b className="cap-meter-b" /></Q>
				<div className="flex flex-wrap gap-[5px]">{q.intent.signs.map((sign, i) => <Q key={sign} d={0.6 + i * 0.3} className="cap-chip cap-plain">{sign}</Q>)}</div>
				<Q d={1.5} className="cap-chip cap-ok"><Target className={ic} strokeWidth={2} />{q.intent.flag}</Q>
			</Mini>
		)
		case 'lead': return (
			<Mini>
				<Q className="cap-bub cap-bub-out">{q.lead.ask}</Q>
				<Q d={0.7} className="cap-bub cap-bub-in tabular-nums">{q.lead.answer}</Q>
				<Q d={1.4} className="cap-chip cap-ok"><UserPlus className={ic} strokeWidth={2} />{q.lead.saved}</Q>
			</Mini>
		)
		case 'alert': return (
			<Mini>
				<Q className="cap-bub cap-bub-in">{q.alert.msg}</Q>
				<Q d={0.7} className="cap-chip cap-danger cap-alarm"><ShieldAlert className={ic} strokeWidth={2} />{q.alert.flag}</Q>
				<Q d={1.4} className="cap-chip cap-warn"><ArrowLeftRight className={ic} strokeWidth={2} />{q.alert.hand}</Q>
			</Mini>
		)
		case 'campaign': return (
			<Mini>
				<Q className="cap-card flex items-center justify-between gap-2"><b className="inline-flex items-center gap-1.5"><MessageSquare className={ic} strokeWidth={2} />{q.campaign.name}</b><span className="inline-flex items-center gap-1 text-vg-dim"><Users className="size-3" strokeWidth={2} />{q.campaign.audience}</span></Q>
				<Q d={0.8} className="cap-chip cap-vi"><CheckCheck className={ic} strokeWidth={2} />{q.campaign.delivered}</Q>
				<Q d={1.5} className="cap-chip cap-ok"><ShieldCheck className={ic} strokeWidth={2} />{q.campaign.rest}</Q>
			</Mini>
		)
		case 'human': return (
			<Mini>
				<Q className="self-end"><div className="cap-bub cap-bub-out cap-strike max-w-none">{q.human.stiff}</div></Q>
				<Q d={1.2} className="cap-bub cap-bub-out">{q.human.natural}</Q>
			</Mini>
		)
		case 'truth': return (
			<Mini>
				<Q className="cap-bub cap-bub-in">{q.truth.ask}</Q>
				<Q d={0.7} className="cap-bub cap-bub-out tabular-nums">{q.truth.answer}</Q>
				<Q d={1.4} className="cap-chip cap-ok"><ShieldCheck className={ic} strokeWidth={2} />{q.truth.source}</Q>
			</Mini>
		)
		case 'improve': return (
			<Mini>
				<Q className="flex justify-between"><b className="inline-flex items-center gap-1.5"><Brain className={ic} strokeWidth={2} />{q.improve.title}</b><span className="text-vg-dim">{q.improve.count}</span></Q>
				<svg className="cap-spark" viewBox="0 0 200 40" preserveAspectRatio="none"><path className="cap-line" style={{ '--spd': '.4s' } as CSSProperties} pathLength={100} d="M2 32 L40 33 L80 25 L120 27 L160 15 L198 7" /></svg>
				<Q d={1.3} className="cap-chip cap-vi"><Sparkles className={ic} strokeWidth={2} />{q.improve.ideas}</Q>
			</Mini>
		)
		case 'vigento': return (
			<Mini>
				<Q className="cap-top"><Sparkles className="size-3.5 text-vg-signal" strokeWidth={2} /><span className="font-semibold text-vg-signal">{q.vigento.name}</span><em>{q.vigento.role}</em></Q>
				<Q d={0.2} className="cap-bub cap-bub-in">{q.vigento.ask}</Q>
				<div className="cap-stack">
					<span className="cap-typing justify-self-end"><i /><i /><i /></span>
					<Q d={1.7} className="cap-bub cap-bub-out justify-self-end">{q.vigento.answer}</Q>
				</div>
			</Mini>
		)
	}
}
