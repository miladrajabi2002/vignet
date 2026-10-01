import { ArrowLeftRight, Bell, BellRing, BookOpen, Brain, CalendarCheck, ChartColumn, Check, ClipboardCheck, CreditCard, Hourglass, Inbox, Languages, Layers, Link2, Lock, Megaphone, Mic, PackageCheck, PenLine, ScanSearch, Shirt, ShieldAlert, ShieldCheck, ShoppingCart, SlidersHorizontal, Sparkles, Target, TimerReset, Truck, UserPlus, UtensilsCrossed } from 'lucide-react'
import type { CSSProperties } from 'react'
import { TelegramIcon } from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'
import { Container, SectionHead, type IconType, type SiteLocale } from '../ui'

const COPY = {
	fa: {
		pill: 'یک سیستم، نه چند ابزار پراکنده',
		title: 'قابلیت‌های کلیدی ویجنت',
		titleShort: 'قابلیت‌های کلیدی ویجنت',
		lead: 'هر کاری که ویجنت برای فروش و پشتیبانی شما انجام می‌دهد، در یک نگاه.',
		leadShort: 'هر کاری که ویجنت برای کسب‌وکارتان انجام می‌دهد، در یک نگاه.',
		learnTitle: 'ایجنت یادگیرنده، از اطلاعات خودتان',
		learnBody: 'PDF، آدرس سایت، پرسش‌های پرتکرار و کاتالوگ منبع پاسخ‌اند. سؤال بی‌پاسخ با پیشنهاد پاسخ به «مرکز یادگیری» می‌رود و با یک تأیید، برای همیشه یاد گرفته می‌شود.',
		learnCenter: 'مرکز یادگیری',
		learnNew: 'سؤال جدید',
		learnAsked: 'مشتری پرسید:',
		learnQ: 'ارسال به شیراز چند روز طول می‌کشد؟',
		learnSuggest: 'پیشنهاد ایجنت:',
		learnA: 'با پست پیشتاز ۳ تا ۴ روز کاری.',
		learnSrc: '[از سیاست ارسال سایت]',
		learnApprove: 'تأیید و یادگیری',
		learnEdit: 'ویرایش',
		learnDone: 'از این به بعد ایجنت این را می‌داند',
		sellTitle: 'خرید کامل داخل گفتگو',
		sellBody: 'ایجنت محصول معرفی می‌کند و سبد می‌چیند؛ مشتری روی سایت خودتان و با درگاه‌های خودتان پرداخت می‌کند و سفارش مستقیم در ووکامرس ثبت می‌شود.',
		sellCart: 'سبد شما',
		sellItem: 'میز TV آرتا · گردویی',
		sellItemPrice: '۶٬۹۰۰٬۰۰۰',
		sellShip: 'ارسال · از سایت شما',
		sellShipPrice: '۸۰٬۰۰۰',
		sellPay: 'پرداخت ۶٬۹۸۰٬۰۰۰ تومان',
		sellHost: 'yourshop.ir',
		sellPaid: 'پرداخت شد با زرین‌پال',
		sellOrder: 'ووکامرس · سفارش #۱۰۴۸ ثبت شد',
		bookTitle: 'رزرو و نوبت‌دهی بدون تداخل',
		bookBody: 'ایجنت وقت‌های خالی تقویم شما را پیشنهاد می‌دهد و نوبت را همان‌جا در گفتگو ثبت می‌کند؛ رزرو و لغو هم به تیمتان خبر داده می‌شود.',
		bookAsk: 'جمعه عصر وقت دارید؟',
		bookSlots: ['۱۶:۰۰', '۱۷:۰۰', '۱۸:۳۰'],
		bookDone: 'نوبت جمعه ساعت ۱۷:۰۰ ثبت شد',
		bookTeam: 'به تیم خبر داده شد',
		botTitle: 'ربات تلگرام مدیریتی',
		botBody: 'گفتگوهای حساس، سفارش‌ها و رزروها در تلگرام خودتان خبر داده می‌شوند؛ از همان‌جا جواب مشتری را می‌دهید و هر صبح گزارش می‌گیرید.',
		botName: 'ربات مدیریت ویجنت',
		botAlert: '🙋 سارا به اپراتور سپرده شد: «سفارشم دیر شده»',
		botReply: '✍️ پاسخ',
		botClose: '✅ بستن',
		botReport: '🌅 گزارش امروز: ۴۲ گفتگو · ۳ سفارش · ۵ نوبت',
		langTitle: 'به زبان خود مشتری جواب می‌دهد',
		langBody: 'فارسی، انگلیسی، عربی یا هر زبان دیگر؛ هر پیام به همان زبانی جواب می‌گیرد که نوشته شده.',
		inboxTitle: 'همهٔ برنامه‌ها، یک صندوق',
		inboxBody: 'دایرکت و کامنت، تلگرام، بله، روبیکا، ویجت سایت و لینک چت — یک ایجنت، یک اینباکس.',
		inboxRows: [
			{ text: 'سارا — کت مشکی موجوده؟', ch: 'اینستاگرام', color: '#be185d' },
			{ text: 'امیر — سفارشم کی میرسه؟', ch: 'تلگرام', color: '#0369a1' },
			{ text: 'مهدی — قرارداد سازمانی', ch: 'بله', color: '#00a37a' },
			{ text: 'نگار — وقت جمعه', ch: 'سایت', color: '#6e56cf' },
		],
		voiceTitle: 'پیام صوتی فارسی را می‌فهمد',
		voiceBody: 'مشتری هرجا راحت‌تر است صحبت می‌کند؛ ایجنت می‌فهمد و در برنامه‌هایی که پشتیبانی می‌کنند، صوتی جواب می‌دهد.',
		voiceTime: '۰:۰۶',
		voiceQuote: '«سلام، برای فردا ساعت پنج وقت خالی دارید؟»',
		preTitle: 'فروش حتی وقتی موجود نیست',
		preNew: 'تازه',
		preBody: 'پیش‌سفارش را همان‌جا در گفتگو ثبت می‌کند و وقتی کالا رسید، خودش به مشتری خبر می‌دهد.',
		preAgent: 'سایز L الان تمام شده؛ رسید خبرتان کنم؟',
		preUser: 'آره حتماً',
		preDone: 'هشدار موجودی فعال شد',
		crmTitle: 'CRM و تحویل به اپراتور',
		crmBody: 'پروندهٔ هر مشتری با همهٔ برنامه‌ها یکجاست؛ موارد حساس با خلاصه به همکار می‌رسد — حتی در تلگرام خودتان.',
		crmName: 'سارا',
		crmInitial: 'س',
		crmChannels: 'اینستاگرام · سایت',
		crmTag: 'قصد خرید بالا',
		crmSummary: 'خلاصه: کت مشکی سایز M، قد ۱۷۰، لینک پرداخت ارسال شد.',
		crmHand: 'ارجاع به همکار در تلگرام',
		ctrlTitle: 'کنترل کامل روی رفتار ایجنت',
		ctrlBody: 'لحن، محدودهٔ پاسخ و قواعد تحویل دست شماست؛ هر تغییر لحظه‌ای اعمال می‌شود.',
		ctrlTone: ['محاوره‌ای', 'رسمی'],
		ctrlRules: ['تحویل به انسان هنگام شکایت', 'پاسخ فقط از دانش تأییدشده'],
		repTitle: 'گزارش شفاف عملکرد',
repBody: 'نرخ حل گفتگو، رضایت، سهم برنامه‌ها و هزینهٔ هوش مصنوعی در یک داشبورد.',
		repSample: 'نمودار نمونه',
		mobile: [
			{ t: 'یادگیری از اطلاعات شما', d: 'PDF، سایت و کاتالوگ؛ با تأیید شما یاد می‌گیرد.' },
			{ t: 'خرید کامل در گفتگو', d: 'سبد، لینک پرداخت و سفارش در ووکامرس.' },
			{ t: 'رزرو و نوبت‌دهی', d: 'وقت خالی را پیشنهاد می‌دهد و ثبت می‌کند.' },
			{ t: 'همهٔ برنامه‌ها، یک صندوق', d: 'یک ایجنت برای شش برنامه.' },
			{ t: 'پیام صوتی فارسی', d: 'صوت را می‌فهمد و جواب می‌دهد.' },
			{ t: 'پیش‌سفارش و هشدار موجودی', d: 'وقتی کالا رسید، خودش خبر می‌دهد.' },
			{ t: 'CRM و تحویل به اپراتور', d: 'موارد حساس با خلاصه به همکار.' },
			{ t: 'ربات تلگرام مدیریتی', d: 'هشدار، پاسخ به مشتری و گزارش در تلگرام.' },
			{ t: 'به زبان خود مشتری', d: 'فارسی، انگلیسی، عربی و هر زبان دیگر.' },
			{ t: 'کنترل کامل رفتار', d: 'لحن، محدوده و قواعد دست شماست.' },
{ t: 'گزارش شفاف', d: 'نرخ حل، رضایت و هزینهٔ هوش مصنوعی.' },
		],
	},
	en: {
		pill: 'One system, not scattered tools',
		title: 'Vigent’s key capabilities',
		titleShort: 'Vigent’s key capabilities',
		lead: 'Everything Vigent does for your sales and support, at a glance.',
		leadShort: 'Everything Vigent does for your business, at a glance.',
		learnTitle: 'An agent that learns from your own data',
		learnBody: 'PDFs, your website, FAQs and the catalog are the sources of truth. Unanswered questions go to the Learning Center with a suggested answer — one approval and it’s learned for good.',
		learnCenter: 'Learning Center',
		learnNew: 'New question',
		learnAsked: 'A customer asked:',
		learnQ: 'How many days does shipping to Shiraz take?',
		learnSuggest: 'Agent suggestion:',
		learnA: '3 to 4 business days by express post.',
		learnSrc: '[from the site’s shipping policy]',
		learnApprove: 'Approve & learn',
		learnEdit: 'Edit',
		learnDone: 'From now on the agent knows this',
		sellTitle: 'Checkout inside the chat',
		sellBody: 'The agent recommends products and builds the cart; the customer pays on your own site with your own gateways, and the order lands straight in WooCommerce.',
		sellCart: 'Your cart',
		sellItem: 'Arta TV stand · walnut',
		sellItemPrice: '6,900,000',
		sellShip: 'Delivery · from your site',
		sellShipPrice: '80,000',
		sellPay: 'Pay 6,980,000 toman',
		sellHost: 'yourshop.ir',
		sellPaid: 'Paid with ZarinPal',
		sellOrder: 'WooCommerce · order #1048 placed',
		bookTitle: 'Conflict-free booking',
		bookBody: 'The agent offers the free slots in your calendar and books right in the chat; new bookings and cancellations reach your team.',
		bookAsk: 'Any time Friday evening?',
		bookSlots: ['16:00', '17:00', '18:30'],
		bookDone: 'Booked for Friday at 17:00',
		bookTeam: 'Team notified',
		botTitle: 'Telegram manager bot',
		botBody: 'Sensitive chats, orders and bookings reach you in your own Telegram; reply to the customer from there and get a report every morning.',
		botName: 'Vigent manager bot',
		botAlert: '🙋 Sara was handed to you: “my order is late”',
		botReply: '✍️ Reply',
		botClose: '✅ Resolve',
		botReport: '🌅 Today: 42 chats · 3 orders · 5 bookings',
		langTitle: 'Replies in the customer’s language',
		langBody: 'Persian, English, Arabic or any other language: every message is answered in the language it was written in.',
		inboxTitle: 'Every channel, one inbox',
		inboxBody: 'DMs and comments, Telegram, Bale, Rubika, the website widget and chat link — one agent, one inbox.',
		inboxRows: [
			{ text: 'Sara — black cardigan in stock?', ch: 'Instagram', color: '#be185d' },
			{ text: 'Amir — when does my order arrive?', ch: 'Telegram', color: '#0369a1' },
			{ text: 'Mehdi — enterprise contract', ch: 'Bale', color: '#00a37a' },
			{ text: 'Negar — Friday slot', ch: 'Website', color: '#6e56cf' },
		],
		voiceTitle: 'Understands Persian voice notes',
		voiceBody: 'Customers talk however they like; the agent understands and, on channels that support it, replies by voice.',
		voiceTime: '0:06',
		voiceQuote: '“Hi, any free slot tomorrow at five?”',
		preTitle: 'Sell even when it’s out of stock',
		preNew: 'New',
		preBody: 'Takes the pre-order right in the conversation and notifies the customer when the item is back.',
		preAgent: 'Size L just sold out — shall I tell you when it’s back?',
		preUser: 'Yes please',
		preDone: 'Back-in-stock alert is on',
		crmTitle: 'CRM and operator handoff',
		crmBody: 'Each customer’s record spans every channel; sensitive cases reach a teammate with a summary — even in your own Telegram.',
		crmName: 'Sara',
		crmInitial: 'S',
		crmChannels: 'Instagram · Website',
		crmTag: 'High purchase intent',
		crmSummary: 'Summary: black cardigan size M, height 170, payment link sent.',
		crmHand: 'Handed to a teammate on Telegram',
		ctrlTitle: 'Full control over the agent’s behaviour',
		ctrlBody: 'Tone, answer scope and handoff rules are yours; every change applies instantly.',
		ctrlTone: ['Casual', 'Formal'],
		ctrlRules: ['Hand off to a human on complaints', 'Answer only from approved knowledge'],
		repTitle: 'Clear performance reports',
		repBody: 'Resolution rate, satisfaction, channel share and AI cost in one dashboard.',
		repSample: 'Sample chart',
		mobile: [
			{ t: 'Learns from your data', d: 'PDFs, site and catalog; learns with your approval.' },
			{ t: 'Checkout in chat', d: 'Cart, payment link and a WooCommerce order.' },
			{ t: 'Booking', d: 'Offers free slots and books them.' },
			{ t: 'Every channel, one inbox', d: 'One agent for six channels.' },
			{ t: 'Persian voice notes', d: 'Understands voice and replies.' },
			{ t: 'Pre-orders & stock alerts', d: 'Notifies customers when items return.' },
			{ t: 'CRM & operator handoff', d: 'Sensitive cases go to a teammate with a summary.' },
			{ t: 'Telegram manager bot', d: 'Alerts, replies and reports in Telegram.' },
			{ t: 'The customer’s language', d: 'Persian, English, Arabic and more.' },
			{ t: 'Full behaviour control', d: 'Tone, scope and rules are yours.' },
			{ t: 'Clear reporting', d: 'Resolution, satisfaction and AI cost.' },
		],
	},
} as const

type CueKey = 'learn' | 'sell' | 'book' | 'inbox' | 'voice' | 'pre' | 'crm' | 'bot' | 'lang' | 'ctrl' | 'rep'
/** Order of COPY.mobile; the last card spans both columns on phones. */
const MOBILE_KEYS: CueKey[] = ['learn', 'sell', 'book', 'inbox', 'voice', 'pre', 'crm', 'bot', 'lang', 'ctrl', 'rep']
const MOBILE_ICONS: Record<CueKey, IconType> = {
	learn: BookOpen, sell: ShoppingCart, book: CalendarCheck, inbox: Inbox, voice: Mic, pre: Bell,
	crm: ArrowLeftRight, bot: TelegramIcon as IconType, lang: Languages, ctrl: SlidersHorizontal, rep: ChartColumn,
}
const BAR_HEIGHTS = [45, 62, 54, 78, 70, 92, 84]
const BAR_COLORS = ['#e4e4e7', '#e4e4e7', '#e4e4e7', '#c7bdf0', '#e4e4e7', '#6e56cf', '#e4e4e7']
const WAVE_DELAYS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.15, 0.35, 0.05, 0.25, 0.45, 0.12]

const bento = 'vg-lift flex flex-col rounded-card border border-vg-line bg-white p-7'

function Toggle() {
	return <span aria-hidden className="relative inline-block h-5 w-9 shrink-0 rounded-full bg-vg-ink"><span className="absolute end-0.5 top-0.5 size-4 rounded-full bg-white" /></span>
}

/** Same switch, being flipped on and off (offset from the tone pill). */
function LiveToggle() {
	const timing = { animationDuration: '6s', animationDelay: '-3s' }
	return (
		<span aria-hidden className="relative inline-block h-5 w-9 shrink-0 overflow-hidden rounded-full bg-[#d4d4d8]">
			<span className="vg-knob-track absolute inset-0 rounded-full bg-vg-ink" style={timing} />
			<span className="vg-knob absolute start-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm" style={{ ...timing, '--vg-kd': '16px' } as CSSProperties} />
		</span>
	)
}

const MINI_COPY = {
	fa: { slots: ['۱۶:۰۰', '۱۷:۰۰'], alert: 'هشدار فوری', langs: ['فا', 'EN', 'ع'], sources: ['PDF', 'سایت', 'کاتالوگ'], price: '۶٬۹۸۰٬۰۰۰', time: '۰:۰۶', notify: 'خبر می‌دهیم', tag: 'قصد خرید', initial: 'س' },
	en: { slots: ['16:00', '17:00'], alert: 'Instant alert', langs: ['EN', 'فا', 'ع'], sources: ['PDF', 'Site', 'Catalog'], price: '6,980,000', time: '0:06', notify: 'We’ll notify', tag: 'High intent', initial: 'S' },
} as const
const SOURCE_GLOW = ['vg-g1', 'vg-g2', 'vg-g3']
const INBOX_DOTS = [
	{ color: '#be185d', cls: 'vg-in1' },
	{ color: '#0369a1', cls: 'vg-in2' },
	{ color: '#047857', cls: 'vg-in3' },
	{ color: '#6e56cf', cls: 'vg-in4' },
]

/**
 * The phone grid's live cues: 26px-tall, decorative miniatures of each
 * capability. They reuse the desktop bento's CSS loops, so they cost no JS
 * and pause off-screen with the rest of the `.vg-anim` block.
 */
function MiniCue({ cue, locale }: { cue: CueKey; locale: SiteLocale }) {
	const m = MINI_COPY[locale]
	const box = 'mt-auto flex h-[26px] w-full items-center justify-center gap-1'
	switch (cue) {
		case 'learn':
			return (
				<div aria-hidden className={box}>
					{m.sources.map((source, i) => (
						<span key={source} className={cn('rounded-md border border-vg-line bg-vg-bg px-1.5 py-0.5 text-[10px] leading-none text-vg-sub', SOURCE_GLOW[i])}>{source}</span>
					))}
				</div>
			)
		case 'sell':
			return (
				<div aria-hidden className={cn(box, 'gap-1.5 rounded-lg bg-vg-bg px-1.5')}>
					<ShoppingCart className="size-3 shrink-0 text-vg-ink" strokeWidth={2.2} />
					<span className="text-[10.5px] font-bold tabular-nums">{m.price}</span>
					<span className="vg-sq3 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[#166534]"><Check className="size-2.5" strokeWidth={3} /></span>
				</div>
			)
		case 'inbox':
			return (
				<div aria-hidden className={cn(box, 'gap-1.5')}>
					{INBOX_DOTS.map((dot) => <span key={dot.color} className={cn('size-2.5 rounded-full', dot.cls)} style={{ background: dot.color }} />)}
					<Inbox className="ms-0.5 size-3.5 text-vg-cap" strokeWidth={2} />
				</div>
			)
		case 'voice':
			return (
				<div aria-hidden className={cn(box, 'gap-[3px] rounded-lg bg-[#1f1f23] px-2')}>
					{WAVE_DELAYS.slice(0, 10).map((delay) => <span key={delay} className="vg-wave h-3.5 w-[2.5px] rounded bg-[#c7bdf0]" style={{ animationDelay: `${delay}s` }} />)}
					<span className="ms-1 text-[10px] tabular-nums text-[#a1a1aa]">{m.time}</span>
				</div>
			)
		case 'pre':
			return (
				<div aria-hidden className={cn(box, 'gap-1.5 text-[10.5px] font-medium text-[#5746af]')}>
					<span className="relative inline-flex size-5 items-center justify-center">
						<span className="vg-ring absolute inset-0 rounded-full border border-[rgba(110,86,207,0.45)]" />
						<Bell className="relative size-3" strokeWidth={2.2} />
					</span>
					{m.notify}
				</div>
			)
		case 'crm':
			return (
				<div aria-hidden className={cn(box, 'gap-1.5')}>
					<span className="inline-flex size-5 items-center justify-center rounded-full bg-vg-soft text-[10px] font-bold text-[#5746af]">{m.initial}</span>
					<span className="vg-sq2 rounded-full bg-[#dcfce7] px-1.5 py-0.5 text-[10px] leading-none text-[#166534]">{m.tag}</span>
				</div>
			)
		case 'ctrl':
			return (
				<div aria-hidden className={cn(box, 'gap-2')}>
					<span className="relative inline-block h-4 w-7 overflow-hidden rounded-full bg-[#d4d4d8]">
						<span className="vg-knob-track absolute inset-0 rounded-full bg-vg-ink" />
						<span className="vg-knob absolute start-0.5 top-0.5 size-3 rounded-full bg-white shadow-sm" />
					</span>
					<span className="h-1 w-8 rounded-full bg-[#e4e4e7]"><span className="vg-knob-track block h-full w-3/4 rounded-full bg-vg-signal" /></span>
				</div>
			)
		case 'book':
			return (
				<div aria-hidden className={cn(box, 'gap-1')}>
					<span className="rounded-md bg-vg-bg px-1.5 py-0.5 text-[10px] leading-none text-vg-dim line-through">{m.slots[0]}</span>
					<span className="vg-g2 rounded-md border border-vg-line bg-white px-1.5 py-0.5 text-[10px] font-bold leading-none">{m.slots[1]}</span>
					<span className="vg-sq3 inline-flex size-4 items-center justify-center rounded-full bg-[#dcfce7] text-[#166534]"><Check className="size-2.5" strokeWidth={3} /></span>
				</div>
			)
		case 'bot':
			return (
				<div aria-hidden className={cn(box, 'gap-1.5 text-[10.5px] font-medium text-[#0369a1]')}>
					<span className="relative inline-flex size-5 items-center justify-center">
						<span className="vg-ring absolute inset-0 rounded-full border border-[rgba(3,105,161,0.45)]" />
						<TelegramIcon className="relative size-3.5" />
					</span>
					{m.alert}
				</div>
			)
		case 'lang':
			return (
				<div aria-hidden className={box}>
					{m.langs.map((lang, i) => (
						<span key={lang} className={cn('rounded-md border border-vg-line bg-vg-bg px-1.5 py-0.5 text-[10px] leading-none text-vg-sub', SOURCE_GLOW[i])}>{lang}</span>
					))}
				</div>
			)
		default:
			return (
				<div aria-hidden className={cn(box, 'items-end gap-[3px] border-b border-black/10 px-3')}>
					{BAR_HEIGHTS.map((h, i) => <span key={i} className="vg-grow w-2 rounded-t-[2px]" style={{ height: `${h}%`, background: BAR_COLORS[i], animationDelay: `${i * 0.15}s` }} />)}
				</div>
			)
	}
}


/**
 * The quieter features that are easy to miss in a demo but matter in daily
 * use — each one maps to a real runtime module (language mirroring, vision,
 * evidence-anchored customer memory, sales intelligence, humanizer, action
 * grounding, customer identification, operator alerts, campaigns, the
 * improvement center, Vigento, the chat link, order status updates, the
 * cart hold, colour/size questions and the restaurant menu).
 */
const HIDDEN = {
	fa: {
		title: 'کارهایی که بی‌سروصدا انجام می‌دهد',
		lead: 'قابلیت‌هایی که شاید در نگاه اول نبینید، ولی هر روز به کارتان می‌آیند.',
		items: [
			{ t: 'گفتگوی حساس را زود تشخیص می‌دهد', d: 'شکایت، عصبانیت یا تهدید را تشخیص می‌دهد و گفتگو را پیش از بالا گرفتن، با خلاصه به همکارتان می‌سپارد.' },
			{ t: 'عکس محصول را می‌شناسد', d: 'مشتری عکس می‌فرستد و ایجنت مشابهش را در کاتالوگ پیدا می‌کند و قیمت می‌دهد.' },
			{ t: 'مشتری را به خاطر می‌سپارد', d: 'شهر، سایز و سلیقهٔ مشتری را از گفتگو یاد می‌گیرد و در همهٔ برنامه‌ها یادش می‌ماند.' },
			{ t: 'مشتری جدی را تشخیص می‌دهد', d: 'از رفتار گفتگو قصد خرید را می‌سنجد و مشتری آمادهٔ خرید را برایتان علامت می‌زند.' },
			{ t: 'مثل آدم می‌نویسد، نه ربات', d: 'جمله‌های کلیشه‌ای و ماشینی را کنار می‌گذارد تا پاسخ طبیعی و خودمانی باشد.' },
			{ t: 'چیزی از خودش نمی‌سازد', d: 'قیمت، موجودی و وضعیت سفارش را فقط از دادهٔ واقعی می‌گوید و قول بی‌پشتوانه نمی‌دهد.' },
			{ t: 'نام و شماره را اول می‌گیرد', d: 'اگر بخواهید، قبل از جواب‌دادن نام و موبایل مشتری را می‌پرسد و در CRM ثبت می‌کند.' },
			{ t: 'لینک پرداخت را یادآوری می‌کند', d: 'اگر مشتری لینک پرداخت را باز نکرد، یک بار مؤدبانه یادآوری می‌کند و لینک منقضی را خودش باطل می‌کند.' },
			{ t: 'پیام گروهی به مشتری‌ها', d: 'برای مشتری‌هایی که اجازه داده‌اند، کمپین پیام می‌فرستید؛ بدون مزاحمت برای بقیه.' },
			{ t: 'هر روز خودش را بهتر می‌کند', d: 'گفتگوهای روز را مرور می‌کند، ضعف پاسخ‌ها را پیدا می‌کند و پیشنهاد اصلاح می‌دهد.' },
			{ t: 'ویجنتو، دستیار پنل', d: 'بپرسید «امروز چند گفتگو داشتیم؟»؛ داده‌ها را تحلیل می‌کند و در مدیریت پنل و تنظیمات کمکتان می‌کند.' },
			{ t: 'لینک چت برای بیو و QR', d: 'یک لینک اختصاصی که در بیو، استوری یا روی QR می‌گذارید تا مشتری مستقیم با ایجنت حرف بزند.' },
			{ t: 'خبر سفارش را خودش می‌دهد', d: 'مشتری‌ای که سفارشش را پیگیری کرده، با هر تغییر وضعیت یا ثبت کد رهگیری همان‌جا خبر می‌گیرد؛ حتی اگر سفارش با شمارهٔ دیگری ثبت شده باشد.' },
			{ t: 'سبد را یک ساعت نگه می‌دارد', d: 'سبد مشتری یک ساعت برایش رزرو می‌ماند، نیم ساعت مانده یادآوری می‌کند و بعد کالای تمام‌شده را خودش از سبد برمی‌دارد.' },
			{ t: 'رنگ و سایز را دقیق می‌پرسد', d: 'اگر مشتری فقط بگوید «مشکی»، حدس نمی‌زند؛ فقط سایزهای موجودِ همان رنگ را می‌پرسد.' },
			{ t: 'منوی دیجیتال رستوران', d: 'منوی QR شیک با تم و رنگ برند شما، دو زبانه، با دستیار «از منو بپرس» که همان ایجنت شماست.' },
		],
	},
	en: {
		title: 'What it quietly does for you',
		lead: 'Capabilities you might not notice at first — but will use every day.',
		items: [
			{ t: 'Spots sensitive chats early', d: 'Detects complaints, anger or threats and hands the chat to a teammate with a summary before it escalates.' },
			{ t: 'Recognises product photos', d: 'A customer sends a photo; the agent finds the closest match in your catalog and quotes the price.' },
			{ t: 'Remembers each customer', d: 'Learns city, size and taste from the chat and remembers them across every app.' },
			{ t: 'Spots serious buyers', d: 'Reads purchase intent from the conversation and flags customers who are ready to buy.' },
			{ t: 'Writes like a person, not a bot', d: 'Drops stock phrases and robotic wording so replies feel natural.' },
			{ t: 'Never makes things up', d: 'States price, stock and order status only from real data — no promises it can’t keep.' },
			{ t: 'Asks for name and number first', d: 'If you want, it collects the customer’s name and mobile before answering and saves them to the CRM.' },
			{ t: 'Reminds about payment links', d: 'If a customer hasn’t opened the payment link, it sends one polite reminder and voids expired links on its own.' },
			{ t: 'Broadcasts to customers', d: 'Send campaigns to customers who opted in — nobody else gets bothered.' },
			{ t: 'Improves itself every day', d: 'Reviews the day’s conversations, finds weak answers and suggests fixes.' },
			{ t: 'Vigento, your panel assistant', d: 'Ask “how many chats did we have today?” — it analyses your data and helps manage the panel and settings.' },
			{ t: 'Chat link for bio and QR', d: 'A dedicated link for your bio, stories or a QR code so customers talk to the agent directly.' },
			{ t: 'Sends order updates itself', d: 'A customer who asked about an order hears about every status change or tracking code right there, even if the order used another phone number.' },
			{ t: 'Holds the cart for an hour', d: 'The cart stays reserved for an hour, gets a reminder at the half-hour mark, and sold-out items leave it on their own.' },
			{ t: 'Asks colour and size precisely', d: 'If the customer only says “black”, it doesn’t guess; it asks which of that colour’s sizes are in stock.' },
			{ t: 'Digital restaurant menu', d: 'A polished QR menu in your brand’s theme and colour, bilingual, with an “Ask the menu” assistant that is your own agent.' },
		],
	},
} as const
const HIDDEN_ICONS: IconType[] = [ShieldAlert, ScanSearch, Brain, Target, PenLine, ShieldCheck, UserPlus, TimerReset, Megaphone, ClipboardCheck, Sparkles, Link2, Truck, Hourglass, Shirt, UtensilsCrossed]

function HiddenCapabilities({ locale }: { locale: SiteLocale }) {
	const h = HIDDEN[locale]
	return (
		<div className="mt-9 lg:mt-16">
			<div className="vg-rv flex flex-col items-center text-center lg:flex-row lg:items-end lg:justify-between lg:text-start">
				<h3 className="text-[20px] font-bold leading-[1.6] lg:text-[28px]">{h.title}</h3>
				<p className="mt-1 max-w-[460px] text-[13.5px] leading-[1.9] text-vg-sub lg:mt-0 lg:text-[15px]">{h.lead}</p>
			</div>
			<ul className="vg-rv-group mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-7 lg:grid-cols-4 lg:gap-3">
				{h.items.map((item, i) => {
					const Icon = HIDDEN_ICONS[i]
					return (
						<li key={item.t} className="vg-lift flex gap-3 rounded-card border border-vg-line bg-white p-3.5 text-start lg:flex-col lg:gap-2.5 lg:p-5">
							<span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-vg-tint text-vg-signal"><Icon className="size-[19px]" strokeWidth={1.8} /></span>
							<div>
								<h4 className="text-[14.5px] font-bold leading-[1.7] lg:text-[15.5px]">{item.t}</h4>
								<p className="mt-0.5 text-[12.5px] leading-[1.85] text-vg-sub lg:text-[13.5px]">{item.d}</p>
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

export function Capabilities({ locale }: { locale: SiteLocale }) {
	const c = COPY[locale]
	return (
		<section id="capabilities" className="vg-cv scroll-mt-24 pt-[52px] lg:pb-[120px] lg:pt-5">
			<Container>
				<SectionHead
					pill={c.pill}
					icon={Layers}
					title={<><span className="lg:hidden">{c.titleShort}</span><span className="hidden lg:inline">{c.title}</span></>}
					lead={<><span className="lg:hidden">{c.leadShort}</span><span className="hidden lg:inline">{c.lead}</span></>}
					titleClassName="lg:max-w-[820px] lg:leading-[1.4]"
					className="vg-rv"
				/>

				{/* Phones: a compact 2×4 grid; each card carries a tiny live cue of
				    the same demo the desktop bento shows (voice wave, chart, sync…). */}
				<ul className="vg-anim vg-rv-group mt-[18px] grid grid-cols-2 gap-2.5 lg:hidden">
					{c.mobile.map((item, i) => {
						const cue = MOBILE_KEYS[i]
						const Icon = MOBILE_ICONS[cue]
						const dark = cue === 'voice'
						return (
							<li key={item.t} className={cn('relative flex flex-col items-center gap-2 rounded-card px-3 pb-3.5 pt-[18px] text-center', dark ? 'bg-vg-ink text-white' : 'border border-vg-line bg-white', i === MOBILE_KEYS.length - 1 && MOBILE_KEYS.length % 2 === 1 && 'col-span-2')}>
								{cue === 'sell' ? <span className="absolute start-2.5 top-2.5 rounded-full bg-vg-signal px-[7px] py-0.5 text-[11px] text-white">{c.preNew}</span> : null}
								<span aria-hidden className={cn('inline-flex size-[42px] items-center justify-center rounded-control', dark ? 'bg-white/10 text-[#c7bdf0]' : 'bg-vg-ink text-white')}>
									<Icon className="size-[19px]" strokeWidth={1.8} />
								</span>
								<h3 className="text-[14px] font-bold leading-[1.6]">{item.t}</h3>
								<p className={cn('text-[12px] leading-[1.8]', dark ? 'text-[#d4d4d8]' : 'text-vg-sub')}>{item.d}</p>
								<MiniCue cue={cue} locale={locale} />
							</li>
						)
					})}
				</ul>

				{/* Desktop: a bento where each card shows the capability working. */}
				<div className="vg-anim vg-rv-group mt-12 hidden grid-cols-12 gap-4 lg:grid">
					<article className={cn(bento, 'col-span-7 h-[420px] flex-row gap-7')}>
						<div className="flex w-[250px] shrink-0 flex-col">
							<span aria-hidden className="inline-flex size-11 items-center justify-center rounded-control bg-vg-ink text-white"><BookOpen className="size-5" strokeWidth={1.8} /></span>
							<h3 className="mt-[18px] text-[21px] font-bold leading-[1.6]">{c.learnTitle}</h3>
							<p className="mt-2 text-[14px] leading-[1.95] text-vg-sub">{c.learnBody}</p>
						</div>
						<div aria-hidden className="flex grow flex-col gap-2.5 rounded-card bg-vg-bg p-[18px]">
							<div className="flex justify-between text-[12px] text-vg-cap"><span>{c.learnCenter}</span><span className="text-[#b45309]">{c.learnNew}</span></div>
							<div className="vg-sq1 rounded-control bg-white px-3.5 py-3 text-[13px] leading-[1.8]"><span className="text-vg-cap">{c.learnAsked}</span> {c.learnQ}</div>
							<div className="vg-sq2 rounded-control border border-[rgba(110,86,207,0.3)] bg-white px-3.5 py-3 text-[13px] leading-[1.8]"><span className="font-medium text-vg-signal">{c.learnSuggest}</span> {c.learnA} <span className="text-[#9ca3af]">{c.learnSrc}</span></div>
							<div className="vg-sq3 flex gap-2">
								<span className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-vg-ink px-3.5 text-[12px] text-white"><Check className="size-3.5" strokeWidth={2.2} />{c.learnApprove}</span>
								<span className="inline-flex h-9 items-center rounded-chip border border-black/10 bg-white px-3.5 text-[12px]">{c.learnEdit}</span>
							</div>
							<div className="vg-sq4 inline-flex h-[30px] items-center self-start rounded-full bg-[#dcfce7] px-3 text-[12px] font-medium text-[#166534]">{c.learnDone}</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-5 h-[420px]')}>
						<div className="flex items-center justify-between">
							<span aria-hidden className="inline-flex size-11 items-center justify-center rounded-control bg-vg-ink text-white"><ShoppingCart className="size-5" strokeWidth={1.8} /></span>
							<span className="rounded-full bg-vg-signal px-2 py-[3px] text-[12px] text-white">{c.preNew}</span>
						</div>
						<h3 className="mt-[18px] text-[21px] font-bold">{c.sellTitle}</h3>
						<p className="mt-2 text-[14px] leading-[1.95] text-vg-sub">{c.sellBody}</p>
						{/* Cart → payment link → paid on the store's own gateway → WooCommerce order, on the sq clock. */}
						<div aria-hidden className="mt-auto flex flex-col gap-2">
							<div className="vg-sq1 flex flex-col gap-1.5 rounded-card bg-vg-bg p-3 text-[12px]">
								<div className="flex items-center justify-between">
									<span className="inline-flex items-center gap-1.5 font-bold"><ShoppingCart className="size-3.5" strokeWidth={2} />{c.sellCart}</span>
									<span className="inline-flex items-center gap-1 text-[11px] text-vg-cap" dir="ltr"><Lock className="size-3 text-vg-ok" strokeWidth={2.2} />{c.sellHost}</span>
								</div>
								<div className="flex justify-between tabular-nums"><span>{c.sellItem}</span><span>{c.sellItemPrice}</span></div>
								<div className="flex justify-between tabular-nums text-vg-cap"><span>{c.sellShip}</span><span>{c.sellShipPrice}</span></div>
								<div className="vg-sq2 relative mt-0.5 flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded-chip bg-vg-ink font-semibold text-white tabular-nums">
									<CreditCard className="size-3.5" strokeWidth={2} />{c.sellPay}
									<span className="vg-sheen-x absolute inset-y-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
								</div>
							</div>
							<div className="flex items-center gap-2">
								<span className="vg-sq3 inline-flex h-7 items-center gap-1.5 rounded-full bg-[#dcfce7] px-2.5 text-[12px] font-medium text-[#166534]"><Check className="size-3.5" strokeWidth={2.4} />{c.sellPaid}</span>
								<span className="vg-sq4 inline-flex h-7 min-w-0 items-center gap-1.5 truncate rounded-full bg-vg-tint px-2.5 text-[12px] font-medium text-[#5746af]"><PackageCheck className="size-3.5 shrink-0" strokeWidth={2} /><span className="truncate">{c.sellOrder}</span></span>
							</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[360px]')}>
						<h3 className="text-[20px] font-bold">{c.bookTitle}</h3>
						<p className="mt-2 text-[14px] leading-[1.9] text-vg-sub">{c.bookBody}</p>
						{/* A question, the free slots (one taken), the pick, the confirmation. */}
						<div aria-hidden className="mt-auto flex flex-col gap-2">
							<div className="vg-sq1 self-start rounded-[14px_14px_4px_14px] bg-[#f4f4f5] px-3 py-[7px] text-[12px] ltr:self-end ltr:rounded-[14px_14px_14px_4px]">{c.bookAsk}</div>
							<div className="vg-sq2 flex gap-1.5">
								{c.bookSlots.map((slot, i) => (
									<span key={slot} className={cn('flex h-9 grow items-center justify-center rounded-xl border text-[12.5px] font-semibold tabular-nums', i === 0 ? 'border-transparent bg-vg-bg text-vg-dim line-through' : i === 1 ? 'border-vg-signal bg-vg-tint text-[#5746af] shadow-[0_0_0_3px_rgba(110,86,207,0.08)]' : 'border-vg-line bg-white')}>{slot}</span>
								))}
							</div>
							<div className="flex flex-wrap items-center gap-1.5">
								<span className="vg-sq3 inline-flex h-7 items-center gap-1.5 rounded-full bg-[#dcfce7] px-2.5 text-[12px] font-medium text-[#166534]"><CalendarCheck className="size-3.5" strokeWidth={2} />{c.bookDone}</span>
								<span className="vg-sq4 inline-flex h-7 items-center gap-1.5 rounded-full bg-vg-tint px-2.5 text-[12px] font-medium text-[#5746af]"><BellRing className="size-3.5" strokeWidth={2} />{c.bookTeam}</span>
							</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[360px]')}>
						<div className="flex items-center gap-2.5">
							<span aria-hidden className="inline-flex size-9 items-center justify-center rounded-xl bg-[#eff6ff] text-[#0369a1]"><TelegramIcon className="size-[18px]" /></span>
							<h3 className="text-[20px] font-bold">{c.botTitle}</h3>
						</div>
						<p className="mt-2 text-[14px] leading-[1.9] text-vg-sub">{c.botBody}</p>
						{/* An alert lands with glass buttons, then the morning report. */}
						<div aria-hidden className="mt-auto flex flex-col gap-1.5 rounded-card bg-[#eef3f8] p-2.5">
							<div className="vg-sq1 rounded-[14px_14px_14px_4px] bg-white px-3 py-2 text-[12px] leading-[1.8] shadow-[0_1px_1px_rgba(17,17,17,0.06)] ltr:rounded-[14px_14px_4px_14px]">
								<span className="block text-[11px] font-semibold text-[#0369a1]">{c.botName}</span>
								{c.botAlert}
							</div>
							<div className="vg-sq2 grid grid-cols-2 gap-1.5">
								<span className="flex h-8 items-center justify-center rounded-lg bg-white/80 text-[12px] font-medium text-[#0369a1]">{c.botReply}</span>
								<span className="flex h-8 items-center justify-center rounded-lg bg-white/80 text-[12px] font-medium text-[#0369a1]">{c.botClose}</span>
							</div>
							<div className="vg-sq3 rounded-[14px_14px_14px_4px] bg-white px-3 py-2 text-[12px] leading-[1.8] shadow-[0_1px_1px_rgba(17,17,17,0.06)] ltr:rounded-[14px_14px_4px_14px]">{c.botReport}</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[360px]')}>
						<h3 className="text-[20px] font-bold">{c.langTitle}</h3>
						<p className="mt-2 text-[14px] leading-[1.9] text-vg-sub">{c.langBody}</p>
						{/* The same agent, three languages, each reply in kind. */}
						<div aria-hidden className="mt-auto flex flex-col gap-1.5 text-[12px] leading-[1.7]">
							<div dir="ltr" className="vg-sq1 self-end rounded-[14px_14px_4px_14px] bg-[#f4f4f5] px-3 py-1.5 rtl:self-start rtl:rounded-[14px_14px_14px_4px]">Do you ship to Dubai?</div>
							<div dir="ltr" className="vg-sq2 self-start rounded-[14px_14px_14px_4px] bg-vg-ink px-3 py-1.5 text-white rtl:self-end rtl:rounded-[14px_14px_4px_14px]">Yes! Delivery takes 5–7 days 🚚</div>
							<div dir="rtl" className="vg-sq3 self-start rounded-[14px_14px_4px_14px] bg-[#f4f4f5] px-3 py-1.5 ltr:self-end">هل يتوفر مقاس L؟</div>
							<div dir="rtl" className="vg-sq4 self-end rounded-[14px_14px_14px_4px] bg-vg-ink px-3 py-1.5 text-white ltr:self-start">نعم، مقاس L متوفر ✓</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[360px]')}>
						<h3 className="text-[20px] font-bold">{c.inboxTitle}</h3>
						<p className="mt-2 text-[14px] leading-[1.9] text-vg-sub">{c.inboxBody}</p>
						{/* A live inbox: every few seconds a new conversation lands on top
						    and the rest shift down (seamless conveyor, see .vg-conv). */}
						<div aria-hidden className="relative mt-auto h-[178px] overflow-hidden" style={{ '--vg-row': '46px' } as CSSProperties}>
							<div className="absolute inset-0 flex flex-col gap-1.5">
								{[0, 1, 2, 3].map((slot) => (
									<div key={slot} className="relative h-10 shrink-0 rounded-xl bg-vg-bg">
										{slot === 0 ? <span className="vg-land absolute inset-0 rounded-xl bg-vg-tint ring-1 ring-[rgba(110,86,207,0.18)]" /> : null}
									</div>
								))}
							</div>
							<div className="vg-conv relative flex flex-col gap-1.5">
								{[...c.inboxRows, ...c.inboxRows].map((row, i) => (
									<div key={`${row.text}-${i}`} className="flex h-10 shrink-0 items-center gap-2.5 px-2.5">
										<span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
										<span className="grow truncate text-[13px]">{row.text}</span>
										<span className="text-[12px] text-vg-cap">{row.ch}</span>
									</div>
								))}
							</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[360px] border-vg-ink bg-vg-ink text-white')}>
						<h3 className="text-[20px] font-bold">{c.voiceTitle}</h3>
						<p className="mt-2 text-[14px] leading-[1.9] text-[#d4d4d8]">{c.voiceBody}</p>
						<div aria-hidden className="mt-auto rounded-card bg-[#1f1f23] p-4">
							<div className="flex h-10 items-center gap-1">
								{WAVE_DELAYS.map((delay) => <span key={delay} className="vg-wave h-9 w-1 rounded bg-[#c7bdf0]" style={{ animationDelay: `${delay}s` }} />)}
								<span className="ms-auto text-[12px] text-[#a1a1aa]">{c.voiceTime}</span>
							</div>
							<div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/10"><span className="vg-scan block h-full rounded-full bg-[#c7bdf0]" /></div>
							<div className="mt-2.5 text-[13px] leading-[1.8] text-[#e4e4e7]">{c.voiceQuote}</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[360px]')}>
						<div className="flex items-center gap-2"><h3 className="text-[20px] font-bold">{c.preTitle}</h3><span className="rounded-full bg-vg-signal px-2 py-[3px] text-[12px] text-white">{c.preNew}</span></div>
						<p className="mt-2 text-[14px] leading-[1.9] text-vg-sub">{c.preBody}</p>
						<div aria-hidden className="mt-auto flex flex-col gap-2">
							<div className="vg-sq1 self-end rounded-[14px_14px_14px_4px] bg-vg-ink px-3 py-[9px] text-[12px] leading-[1.8] text-white ltr:self-start">{c.preAgent}</div>
							<div className="vg-sq2 self-start rounded-[14px_14px_4px_14px] bg-[#f4f4f5] px-3 py-[9px] text-[12px] ltr:self-end">{c.preUser}</div>
							<div className="vg-sq3 flex items-center gap-2 rounded-xl bg-vg-tint px-3 py-2.5 text-[12px] font-medium text-[#5746af]"><Bell className="size-[15px]" strokeWidth={1.8} />{c.preDone}</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[340px]')}>
						<h3 className="text-[20px] font-bold">{c.crmTitle}</h3>
						<p className="mt-2 text-[14px] leading-[1.9] text-vg-sub">{c.crmBody}</p>
						<div aria-hidden className="mt-auto flex flex-col gap-2.5 rounded-card bg-vg-bg p-3.5">
							<div className="flex items-center gap-2.5">
								<span className="inline-flex size-[34px] items-center justify-center rounded-full bg-vg-soft text-[13px] font-bold text-[#5746af]">{c.crmInitial}</span>
								<div className="grow"><div className="text-[13px] font-bold">{c.crmName}</div><div className="text-[12px] text-vg-cap">{c.crmChannels}</div></div>
								<span className="vg-sq2 rounded-full bg-[#dcfce7] px-2 py-1 text-[12px] text-[#166534]">{c.crmTag}</span>
							</div>
							<div className="vg-sq3 text-[12px] leading-[1.8] text-vg-sub">{c.crmSummary}</div>
							<div className="vg-sq4 inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-[#fef3c7] px-2.5 text-[12px] font-medium text-[#92400e]"><ArrowLeftRight className="size-3.5" strokeWidth={2} />{c.crmHand}</div>
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[340px]')}>
						<h3 className="text-[20px] font-bold">{c.ctrlTitle}</h3>
						<p className="mt-2 text-[14px] leading-[1.9] text-vg-sub">{c.ctrlBody}</p>
						<div aria-hidden className="mt-auto flex flex-col gap-2">
							{/* The owner flips tone and a rule; the pill glides, the knob slides. */}
							<div className="relative flex rounded-xl bg-[#f4f4f5] p-1 text-[12px]">
								<span className="vg-seg absolute inset-y-1 start-1 w-[calc(50%-4px)] rounded-chip bg-white shadow-[0_1px_2px_rgba(17,17,17,0.08)]" />
								<span className="relative grow basis-0 p-[7px] text-center font-medium">{c.ctrlTone[0]}</span>
								<span className="relative grow basis-0 p-[7px] text-center font-medium">{c.ctrlTone[1]}</span>
							</div>
							{c.ctrlRules.map((rule, i) => <div key={rule} className="flex items-center justify-between px-0.5 py-1.5 text-[13px]">{rule}{i === 0 ? <Toggle /> : <LiveToggle />}</div>)}
						</div>
					</article>

					<article className={cn(bento, 'col-span-4 h-[340px]')}>
						<h3 className="text-[20px] font-bold">{c.repTitle}</h3>
						<p className="mt-2 text-[14px] leading-[1.9] text-vg-sub">{c.repBody}</p>
						<div aria-hidden className="mt-auto flex h-[110px] items-end gap-2.5 border-b border-black/10 px-1">
							{BAR_HEIGHTS.map((h, i) => <span key={i} className="vg-grow grow rounded-t-md" style={{ height: `${h}%`, background: BAR_COLORS[i], animationDelay: `${i * 0.15}s` }} />)}
						</div>
						<div className="mt-1.5 text-[12px] text-[#9ca3af]">{c.repSample}</div>
					</article>
				</div>
				<HiddenCapabilities locale={locale} />
			</Container>
		</section>
	)
}
