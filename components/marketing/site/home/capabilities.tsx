import { ArrowLeftRight, BookOpen, Inbox, ShoppingCart, TelegramIcon } from '@/components/marketing/site/sprite-icons'
import {
	ArrowLeftRight as ArrowLeftRightLine, BookOpen as BookOpenLine, Brain, CalendarCheck, Bell, ChartColumn, ClipboardCheck, Hourglass, Inbox as InboxLine, Languages, Layers, Megaphone,
	MessagesSquare, Mic, PenLine, ScanSearch, Send, Shirt, ShieldAlert, ShieldCheck, ShoppingCart as ShoppingCartLine, SlidersHorizontal, Sparkles, Target, TimerReset, Truck, UserPlus, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Container, SectionHead, type IconType, type SiteLocale } from '../ui'
import { KeyScene, QuietScene, type KeySceneId, type QuietId } from './capability-scenes'
import { KeyStage, QuietStage, ReplayGrid, type StageCategory } from './capabilities-stage'

type FeatureId = KeySceneId | 'pay'
type Feature = { t: string; b: string; s: string; badge?: string }

const COPY = {
	fa: {
		pill: 'همه‌چیز در یک پنل',
		title: 'قابلیت‌های کلیدی ویجنت',
		lead: 'هر کاری که ویجنت برای فروش و پشتیبانی شما انجام می‌دهد، در یک نگاه.',
		leadShort: 'هر کاری که ویجنت برای کسب‌وکارتان انجام می‌دهد، در یک نگاه.',
		features: {
			learn: { t: 'از اطلاعات خودتان یاد می‌گیرد', b: 'PDF، سایت، کاتالوگ و پرسش‌های پرتکرار منبع پاسخ‌اند. سؤالی که جوابش را نداند با پیشنهاد پاسخ به «مرکز یادگیری» می‌رود؛ با یک تأیید شما، برای همیشه یاد می‌گیرد.', s: 'PDF، سایت و کاتالوگ منبع پاسخ‌اند؛ سؤال تازه با یک تأیید شما یاد گرفته می‌شود.' },
			sell: { t: 'خرید کامل، داخل همان گفتگو', badge: 'تازه', b: 'محصول را معرفی می‌کند، سبد می‌چیند و لینک پرداخت می‌دهد؛ پرداخت روی درگاه سایت خودتان است و سفارش در ووکامرس ثبت می‌شود. سایت ندارید؟ کارت‌به‌کارت را از پیامک بانک تأیید می‌کند، بدون اینماد.', s: 'سبد، پرداخت روی درگاه سایت خودتان و سفارش در ووکامرس.' },
			pay: { t: 'درگاه کارت‌به‌کارت خودکار', b: '', s: 'سایت ندارید؟ واریز از پیامک بانک با سفارش تطبیق داده می‌شود؛ بدون اینماد.' },
			book: { t: 'نوبت می‌دهد، بدون تداخل', b: 'وقت‌های خالی تقویم شما را پیشنهاد می‌دهد و نوبت را همان‌جا در گفتگو ثبت می‌کند؛ هر رزرو و لغو به تیمتان خبر داده می‌شود.', s: 'وقت خالی را پیشنهاد می‌دهد، ثبت می‌کند و به تیم خبر می‌دهد.' },
			bot: { t: 'ربات مدیریت در تلگرام شما', b: 'گفتگوی حساس، سفارش و رزرو در تلگرام خودتان خبر داده می‌شود؛ از همان‌جا جواب می‌دهید یا گفتگو را می‌بندید و هر صبح گزارش می‌گیرید.', s: 'هشدار، جواب به مشتری و گزارش صبحگاهی در تلگرام خودتان.' },
			lang: { t: 'به زبان خود مشتری جواب می‌دهد', b: 'فارسی، انگلیسی، عربی یا هر زبان دیگر؛ هر پیام به همان زبانی جواب می‌گیرد که نوشته شده.', s: '' },
			inbox: { t: 'همهٔ پیام‌ها، یک صندوق', b: 'دایرکت و کامنت اینستاگرام، تلگرام، بله، روبیکا و ویجت سایت؛ یک ایجنت همه را جواب می‌دهد و شما همه را یکجا می‌بینید.', s: 'اینستاگرام، تلگرام، بله، روبیکا و سایت؛ یک صندوق.' },
			voice: { t: 'پیام صوتی فارسی را می‌فهمد', b: 'مشتری هرجا راحت‌تر است حرف می‌زند؛ ایجنت صدا را می‌فهمد و در پیام‌رسان‌هایی که پشتیبانی می‌کنند، صوتی جواب می‌دهد.', s: 'صدا را می‌فهمد و هرجا بشود صوتی جواب می‌دهد.' },
			pre: { t: 'فروش حتی وقتی موجود نیست', badge: 'تازه', b: 'کالای تمام‌شده را همان‌جا پیش‌سفارش می‌گیرد و وقتی رسید، خودش با لینک خرید به مشتری خبر می‌دهد.', s: 'پیش‌سفارش می‌گیرد و وقتی کالا رسید با لینک خرید خبر می‌دهد.' },
			crm: { t: 'هر مشتری، یک پرونده', b: 'گفتگوهای هر مشتری از همهٔ پیام‌رسان‌ها در یک پرونده جمع می‌شود؛ قصد خرید سنجیده می‌شود و موارد حساس با خلاصه به همکارتان می‌رسد.', s: 'گفتگوهای هر مشتری در یک پرونده؛ موارد حساس با خلاصه به همکار.' },
			ctrl: { t: 'لحن و قواعد دست شماست', b: 'لحن، محدودهٔ پاسخ و قواعد تحویل به انسان را تعیین می‌کنید؛ هر تغییر همان لحظه در پاسخ‌ها دیده می‌شود.', s: 'لحن و قواعد را عوض کنید؛ همان لحظه در پاسخ‌ها دیده می‌شود.' },
			rep: { t: 'گزارش شفاف عملکرد', b: 'نرخ حل گفتگو، رضایت، سهم هر کانال و هزینهٔ هوش مصنوعی، در یک داشبورد.', s: 'نرخ حل، رضایت، سهم هر کانال و هزینهٔ هوش مصنوعی.' },
		} satisfies Record<FeatureId, Feature>,
		/** Phone categories. Each holds at most three chips so the row never wraps or scrolls. */
		categories: ['پاسخ', 'فروش', 'تیم', 'کنترل'],
		meta: (n: number) => `${n.toLocaleString('fa-IR')} قابلیت`,
		chips: { inbox: 'صندوق یکپارچه', voice: 'پیام صوتی', sell: 'خرید در گفتگو', pre: 'پیش‌سفارش', book: 'رزرو نوبت', crm: 'CRM و اپراتور', bot: 'ربات تلگرام', learn: 'یادگیری', ctrl: 'لحن و قواعد', rep: 'گزارش' },
	},
	en: {
		pill: 'One system, not scattered tools',
		title: 'Vigent’s key capabilities',
		lead: 'Everything Vigent does for your sales and support, at a glance.',
		leadShort: 'Everything Vigent does for your business, at a glance.',
		features: {
			learn: { t: 'Learns from your own data', b: 'PDFs, your website, the catalog and FAQs are its sources. A question it can’t answer goes to the Learning Center with a suggested reply; one approval and it’s learned for good.', s: 'PDFs, site and catalog are its sources; a new question is learned with one approval.' },
			sell: { t: 'Checkout, right in the chat', badge: 'New', b: 'It recommends products, builds the cart and sends a payment link; the customer pays on your own site’s gateway and the order lands in WooCommerce. No website? It confirms card-to-card transfers from your bank SMS — no Enamad.', s: 'Cart, payment on your own site’s gateway and a WooCommerce order.' },
			pay: { t: 'Automatic card-to-card gateway', b: '', s: 'No website? The bank SMS deposit is matched to the order — no Enamad.' },
			book: { t: 'Books slots, never double', b: 'It offers the free slots in your calendar and books right in the chat; every booking and cancellation reaches your team.', s: 'Offers a free slot, books it and tells your team.' },
			bot: { t: 'A manager bot in your Telegram', b: 'Sensitive chats, orders and bookings reach you in your own Telegram; reply or resolve from there and get a report every morning.', s: 'Alerts, replies to customers and a morning report in your Telegram.' },
			lang: { t: 'Replies in the customer’s language', b: 'Persian, English, Arabic or any other language: every message is answered in the language it was written in.', s: '' },
			inbox: { t: 'Every message, one inbox', b: 'Instagram DMs and comments, Telegram, Bale, Rubika and the website widget; one agent answers them all and you see them in one place.', s: 'Instagram, Telegram, Bale, Rubika and website; one inbox.' },
			voice: { t: 'Understands Persian voice notes', b: 'Customers talk however they like; the agent understands and, on channels that support it, replies by voice.', s: 'Understands voice and replies by voice where it can.' },
			pre: { t: 'Sell even when it’s out of stock', badge: 'New', b: 'It takes the pre-order right in the chat and, when the item is back, messages the customer with a buy link.', s: 'Takes pre-orders and sends a buy link when the item is back.' },
			crm: { t: 'One record per customer', b: 'Every customer’s chats from every channel land in one record; purchase intent is scored and sensitive cases reach a teammate with a summary.', s: 'Each customer’s chats in one record; sensitive cases go to a teammate.' },
			ctrl: { t: 'Tone and rules are yours', b: 'You set the tone, the answer scope and the handoff rules; every change shows in replies right away.', s: 'Change the tone or a rule; replies follow right away.' },
			rep: { t: 'Clear performance reports', b: 'Resolution rate, satisfaction, channel share and AI cost, in one dashboard.', s: 'Resolution, satisfaction, channel share and AI cost.' },
		} satisfies Record<FeatureId, Feature>,
		categories: ['Reply', 'Sell', 'Team', 'Control'],
		meta: (n: number) => `${n} features`,
		chips: { inbox: 'Inbox', voice: 'Voice', sell: 'Checkout', pre: 'Pre-orders', book: 'Booking', crm: 'CRM', bot: 'Telegram bot', learn: 'Learning', ctrl: 'Tone & rules', rep: 'Reports' },
	},
}

/* Phone stage: category → chips → steps. The checkout chip plays two steps:
   the site's own gateway, then Vigent's card-to-card path. */
const STAGE: { icon: IconType; chips: { id: keyof (typeof COPY)['fa']['chips']; icon: IconType }[]; steps: { id: FeatureId; chip: number }[] }[] = [
	{ icon: MessagesSquare, chips: [{ id: 'inbox', icon: InboxLine }, { id: 'voice', icon: Mic }], steps: [{ id: 'inbox', chip: 0 }, { id: 'voice', chip: 1 }] },
	{ icon: ShoppingCartLine, chips: [{ id: 'sell', icon: ShoppingCartLine }, { id: 'pre', icon: Bell }, { id: 'book', icon: CalendarCheck }], steps: [{ id: 'sell', chip: 0 }, { id: 'pay', chip: 0 }, { id: 'pre', chip: 1 }, { id: 'book', chip: 2 }] },
	{ icon: Users, chips: [{ id: 'crm', icon: ArrowLeftRightLine }, { id: 'bot', icon: Send }], steps: [{ id: 'crm', chip: 0 }, { id: 'bot', chip: 1 }] },
	{ icon: SlidersHorizontal, chips: [{ id: 'learn', icon: BookOpenLine }, { id: 'ctrl', icon: SlidersHorizontal }, { id: 'rep', icon: ChartColumn }], steps: [{ id: 'learn', chip: 0 }, { id: 'ctrl', chip: 1 }, { id: 'rep', chip: 2 }] },
]

function stageCategories(locale: SiteLocale): StageCategory[] {
	const c = COPY[locale]
	return STAGE.map((category, i) => ({
		name: c.categories[i],
		meta: c.meta(category.chips.length),
		icon: <category.icon className="size-[18px]" strokeWidth={1.9} />,
		chips: category.chips.map((chip) => ({ label: c.chips[chip.id], icon: <chip.icon className="size-3.5" strokeWidth={2} /> })),
		entries: category.steps.map(({ id, chip }) => {
			const f: Feature = c.features[id]
			const scene = id === 'pay' ? <KeyScene id="sell" locale={locale} compact mode={1} /> : <KeyScene id={id} locale={locale} compact mode={0} />
			return { chip, title: f.t, text: f.s, badge: f.badge, scene }
		}),
	}))
}

/** Desktop bento, in row order (7 + 5, then three rows of three). */
const BENTO: { id: KeySceneId; icon: IconType; span: string; tone?: 'lead' | 'dark' }[] = [
	{ id: 'learn', icon: BookOpen, span: 'col-span-7 min-h-[470px] flex-row gap-[26px]', tone: 'lead' },
	{ id: 'sell', icon: ShoppingCart, span: 'col-span-5 min-h-[470px]', tone: 'lead' },
	{ id: 'book', icon: CalendarCheck, span: 'col-span-4 min-h-[440px]' },
	{ id: 'bot', icon: TelegramIcon as IconType, span: 'col-span-4 min-h-[440px]' },
	{ id: 'lang', icon: Languages, span: 'col-span-4 min-h-[440px]' },
	{ id: 'inbox', icon: Inbox, span: 'col-span-4 min-h-[440px]' },
	{ id: 'voice', icon: Mic, span: 'col-span-4 min-h-[440px] border-vg-ink bg-vg-ink text-white', tone: 'dark' },
	{ id: 'pre', icon: Bell, span: 'col-span-4 min-h-[440px]' },
	{ id: 'crm', icon: ArrowLeftRight, span: 'col-span-4 min-h-[440px]' },
	{ id: 'ctrl', icon: SlidersHorizontal, span: 'col-span-4 min-h-[440px]' },
	{ id: 'rep', icon: ChartColumn, span: 'col-span-4 min-h-[440px]' },
]

function BentoCard({ id, icon: Icon, span, tone, locale }: (typeof BENTO)[number] & { locale: SiteLocale }) {
	const f: Feature = COPY[locale].features[id]
	const lead = tone === 'lead'
	const row = id === 'learn'
	const head = (
		<>
			<div className={cn('flex items-center gap-2.5', row && 'flex-col items-start gap-4')}>
				<span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center', lead ? 'size-11 rounded-control bg-vg-ink text-white' : tone === 'dark' ? 'size-9 rounded-xl bg-white/10 text-[#b9adff]' : 'size-9 rounded-xl bg-vg-bg text-vg-signal')}>
					<Icon className={lead ? 'size-5' : 'size-[18px]'} strokeWidth={1.8} />
				</span>
				<h3 className="flex flex-wrap items-center gap-2 text-[20px] font-bold leading-[1.55]">
					{f.t}
					{f.badge ? <span className="rounded-full bg-vg-signal px-2 py-[3px] text-[12px] font-normal leading-normal text-white">{f.badge}</span> : null}
				</h3>
			</div>
			<p className={cn('mt-2 text-[15px] leading-[1.9]', tone === 'dark' ? 'text-[#d4d4d8]' : 'text-vg-sub')}>{f.b}</p>
		</>
	)
	const scene = <KeyScene id={id} locale={locale} mode="both" />
	return (
		<article className={cn('vg-lift flex flex-col overflow-hidden rounded-card border border-vg-line bg-white p-6', span)}>
			{row ? <div className="flex w-[236px] shrink-0 flex-col">{head}</div> : head}
			{id === 'sell'
				? <div data-replay="alt" data-alt="0" className="mt-auto flex flex-col pt-[18px]">{scene}</div>
				: <div data-replay="" className={cn('flex flex-col', row ? 'min-w-0 grow' : 'mt-auto pt-[18px]')}>{scene}</div>}
		</article>
	)
}

/**
 * The quieter features that are easy to miss in a demo but matter in daily
 * use — each one maps to a real runtime module (operator alerts, vision,
 * evidence-anchored customer memory, sales intelligence, humanizer, action
 * grounding, customer identification, payment-link reminders, campaigns, the
 * improvement center, Vigento, order status updates, the cart hold and
 * colour/size questions). The restaurant menu lives on its solution page.
 */
const HIDDEN = {
	fa: {
		title: 'کارهایی که بی‌سروصدا انجام می‌دهد',
		lead: 'قابلیت‌هایی که شاید در نگاه اول نبینید، ولی هر روز به کارتان می‌آیند.',
		items: [
			{ id: 'alert', t: 'گفتگوی حساس را زود تشخیص می‌دهد', d: 'شکایت، عصبانیت یا تهدید را تشخیص می‌دهد و گفتگو را پیش از بالا گرفتن، با خلاصه به همکارتان می‌سپارد.', s: 'شکایت و عصبانیت را می‌بیند و با خلاصه به همکار می‌سپارد.' },
			{ id: 'photo', t: 'عکس محصول را می‌شناسد', d: 'مشتری عکس می‌فرستد و ایجنت مشابهش را در کاتالوگ پیدا می‌کند و قیمت می‌دهد.', s: 'عکس را با کاتالوگ تطبیق می‌دهد و قیمت می‌گوید.' },
			{ id: 'memory', t: 'مشتری را به خاطر می‌سپارد', d: 'شهر، سایز و سلیقهٔ مشتری را از گفتگو یاد می‌گیرد و همه‌جا یادش می‌ماند.', s: 'شهر، سایز و سلیقه را در همهٔ پیام‌رسان‌ها یادش می‌ماند.' },
			{ id: 'intent', t: 'مشتری جدی را تشخیص می‌دهد', d: 'از رفتار گفتگو قصد خرید را می‌سنجد و مشتری آمادهٔ خرید را برایتان علامت می‌زند.', s: 'قصد خرید را می‌سنجد و مشتری آماده را علامت می‌زند.' },
			{ id: 'human', t: 'مثل آدم می‌نویسد، نه ربات', d: 'جمله‌های کلیشه‌ای و ماشینی را کنار می‌گذارد تا پاسخ طبیعی و خودمانی باشد.', s: 'جمله‌های کلیشه‌ای و ماشینی را کنار می‌گذارد.' },
			{ id: 'truth', t: 'چیزی از خودش نمی‌سازد', d: 'قیمت، موجودی و وضعیت سفارش را فقط از دادهٔ واقعی می‌گوید و قول بی‌پشتوانه نمی‌دهد.', s: 'قیمت، موجودی و وضعیت سفارش فقط از دادهٔ واقعی.' },
			{ id: 'lead', t: 'نام و شماره را اول می‌گیرد', d: 'اگر بخواهید، قبل از جواب‌دادن نام و موبایل مشتری را می‌پرسد و در CRM ثبت می‌کند.', s: 'اگر بخواهید، قبل از پاسخ نام و موبایل را در CRM ثبت می‌کند.' },
			{ id: 'paylink', t: 'لینک پرداخت را یادآوری می‌کند', d: 'اگر مشتری لینک پرداخت را باز نکرد، یک بار مؤدبانه یادآوری می‌کند و لینک منقضی را خودش باطل می‌کند.', s: 'لینک بازنشده را یک بار یادآوری می‌کند و لینک منقضی را باطل می‌کند.' },
			{ id: 'campaign', t: 'پیام گروهی به مشتری‌ها', d: 'برای مشتری‌هایی که اجازه داده‌اند، کمپین پیام می‌فرستید؛ بدون مزاحمت برای بقیه.', s: 'کمپین پیام فقط برای مشتری‌هایی که اجازه داده‌اند.' },
			{ id: 'improve', t: 'هر روز خودش را بهتر می‌کند', d: 'گفتگوهای روز را مرور می‌کند، ضعف پاسخ‌ها را پیدا می‌کند و پیشنهاد اصلاح می‌دهد.', s: 'گفتگوهای روز را مرور می‌کند و اصلاح پیشنهاد می‌دهد.' },
			{ id: 'vigento', t: 'ویجنتو، دستیار پنل', d: 'بپرسید «امروز چند گفتگو داشتیم؟»؛ داده‌ها را تحلیل می‌کند و در مدیریت پنل و تنظیمات کمکتان می‌کند.', s: 'از پنل بپرسید؛ داده را تحلیل می‌کند و در تنظیمات کمک می‌کند.' },
			{ id: 'order', t: 'خبر سفارش را خودش می‌دهد', d: 'مشتری‌ای که سفارشش را پیگیری کرده، با هر تغییر وضعیت یا ثبت کد رهگیری همان‌جا خبر می‌گیرد؛ حتی اگر سفارش با شمارهٔ دیگری ثبت شده باشد.', s: 'هر تغییر وضعیت و کد رهگیری را همان‌جا خبر می‌دهد.' },
			{ id: 'cart', t: 'سبد را یک ساعت نگه می‌دارد', d: 'سبد مشتری یک ساعت برایش رزرو می‌ماند، نیم ساعت مانده یادآوری می‌کند و بعد کالای تمام‌شده را خودش از سبد برمی‌دارد.', s: 'سبد یک ساعت رزرو می‌ماند و نیم ساعت مانده یادآوری می‌شود.' },
			{ id: 'size', t: 'رنگ و سایز را دقیق می‌پرسد', d: 'اگر مشتری فقط بگوید «مشکی»، حدس نمی‌زند؛ فقط سایزهای موجودِ همان رنگ را می‌پرسد.', s: 'حدس نمی‌زند؛ فقط سایزهای موجودِ همان رنگ را می‌پرسد.' },
		],
		groups: ['موقع خرید', 'ارتباط با مشتری', 'پشت صحنه'],
	},
	en: {
		title: 'What it quietly does for you',
		lead: 'Capabilities you might not notice at first — but will use every day.',
		items: [
			{ id: 'alert', t: 'Spots sensitive chats early', d: 'Detects complaints, anger or threats and hands the chat to a teammate with a summary before it escalates.', s: 'Sees complaints and anger, and hands off with a summary.' },
			{ id: 'photo', t: 'Recognises product photos', d: 'A customer sends a photo; the agent finds the closest match in your catalog and quotes the price.', s: 'Matches a photo to your catalog and quotes the price.' },
			{ id: 'memory', t: 'Remembers each customer', d: 'Learns city, size and taste from the chat and remembers them across every app.', s: 'Remembers city, size and taste across every app.' },
			{ id: 'intent', t: 'Spots serious buyers', d: 'Reads purchase intent from the conversation and flags customers who are ready to buy.', s: 'Scores purchase intent and flags who is ready to buy.' },
			{ id: 'human', t: 'Writes like a person, not a bot', d: 'Drops stock phrases and robotic wording so replies feel natural.', s: 'Drops stock phrases and robotic wording.' },
			{ id: 'truth', t: 'Never makes things up', d: 'States price, stock and order status only from real data — no promises it can’t keep.', s: 'Price, stock and order status from real data only.' },
			{ id: 'lead', t: 'Asks for name and number first', d: 'If you want, it collects the customer’s name and mobile before answering and saves them to the CRM.', s: 'If you want, saves name and mobile to the CRM first.' },
			{ id: 'paylink', t: 'Reminds about payment links', d: 'If a customer hasn’t opened the payment link, it sends one polite reminder and voids expired links on its own.', s: 'One reminder for an unopened link; expired links are voided.' },
			{ id: 'campaign', t: 'Broadcasts to customers', d: 'Send campaigns to customers who opted in — nobody else gets bothered.', s: 'Campaigns reach opted-in customers only.' },
			{ id: 'improve', t: 'Improves itself every day', d: 'Reviews the day’s conversations, finds weak answers and suggests fixes.', s: 'Reviews the day’s chats and suggests fixes.' },
			{ id: 'vigento', t: 'Vigento, your panel assistant', d: 'Ask “how many chats did we have today?” — it analyses your data and helps manage the panel and settings.', s: 'Ask the panel; it analyses your data and helps with settings.' },
			{ id: 'order', t: 'Sends order updates itself', d: 'A customer who asked about an order hears about every status change or tracking code right there, even if the order used another phone number.', s: 'Every status change and tracking code, right in the chat.' },
			{ id: 'cart', t: 'Holds the cart for an hour', d: 'The cart stays reserved for an hour, gets a reminder at the half-hour mark, and sold-out items leave it on their own.', s: 'The cart stays reserved for an hour, with a reminder at 30 minutes.' },
			{ id: 'size', t: 'Asks colour and size precisely', d: 'If the customer only says “black”, it doesn’t guess; it asks which of that colour’s sizes are in stock.', s: 'No guessing; it asks only for sizes that colour has in stock.' },
		],
		groups: ['While they shop', 'Knowing your customers', 'Behind the scenes'],
	},
} satisfies Record<SiteLocale, { title: string; lead: string; items: { id: QuietId; t: string; d: string; s: string }[]; groups: string[] }>

const HIDDEN_ICONS: Record<QuietId, IconType> = {
	alert: ShieldAlert, photo: ScanSearch, memory: Brain, intent: Target, human: PenLine, truth: ShieldCheck, lead: UserPlus,
	paylink: TimerReset, campaign: Megaphone, improve: ClipboardCheck, vigento: Sparkles, order: Truck, cart: Hourglass, size: Shirt,
}
/** Phone grouping of the quiet capabilities: one marquee row each. */
const HIDDEN_GROUPS: QuietId[][] = [
	['photo', 'size', 'cart', 'paylink', 'order'],
	['memory', 'intent', 'lead', 'alert', 'campaign'],
	['human', 'truth', 'improve', 'vigento'],
]

function HiddenCapabilities({ locale }: { locale: SiteLocale }) {
	const h = HIDDEN[locale]
	const byId = new Map(h.items.map((item) => [item.id, item]))
	const groups = HIDDEN_GROUPS.map((ids, g) => ({
		name: h.groups[g],
		items: ids.map((id) => {
			const item = byId.get(id)!
			const Icon = HIDDEN_ICONS[id]
			return { id, title: item.t, text: item.s, icon: <Icon className="size-4" strokeWidth={1.9} />, scene: <QuietScene id={id} locale={locale} /> }
		}),
	}))
	return (
		<div className="mt-9 lg:mt-16">
			<div className="vg-rv flex flex-col items-center text-center lg:flex-row lg:items-end lg:justify-between lg:text-start">
				<h3 className="text-[22px] font-bold leading-[1.6] lg:text-[28px]">{h.title}</h3>
				<p className="mt-1 max-w-[460px] text-[13px] leading-[1.9] text-vg-sub lg:mt-0 lg:text-[15px]">{h.lead}</p>
			</div>
			{/* Phones and tablets: three drifting rows of pills and one live detail card. */}
			<QuietStage groups={groups} className="vg-rv mt-4 lg:hidden" />
			{/* Desktop: the four-column grid; the two cards of the last row share it. */}
			<ul className="vg-rv-group mt-7 hidden grid-cols-4 gap-3 lg:grid">
				{h.items.map((item) => {
					const Icon = HIDDEN_ICONS[item.id]
					return (
						<li key={item.id} className="vg-lift flex flex-col gap-2.5 rounded-card border border-vg-line bg-white p-5 text-start [&:nth-child(n+13)]:col-span-2">
							<span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-vg-tint text-vg-signal"><Icon className="size-[19px]" strokeWidth={1.8} /></span>
							<div>
								<h4 className="text-[15px] font-bold leading-[1.7]">{item.t}</h4>
								<p className="mt-0.5 text-[13px] leading-[1.85] text-vg-sub">{item.d}</p>
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
		<section id="capabilities" className="vg-cv scroll-mt-24 pt-14 md:pt-20 lg:pb-[120px] lg:pt-0">
			<Container>
				<SectionHead
					pill={c.pill}
					icon={Layers}
					title={c.title}
					lead={<><span className="lg:hidden">{c.leadShort}</span><span className="hidden lg:inline">{c.lead}</span></>}
					titleClassName="lg:max-w-[820px] lg:leading-[1.4]"
					className="vg-rv"
				/>

				{/* Phones and tablets: one live scene under four categories, each a single row of chips. */}
				<KeyStage categories={stageCategories(locale)} className="vg-rv mt-[18px] md:mx-auto md:max-w-[560px] lg:hidden" />

				{/* Desktop: a bento where each card shows the capability working;
				    ReplayGrid replays a card's scene every ~10s while it is on screen. */}
				<ReplayGrid className="vg-anim vg-rv-group mt-12 hidden grid-cols-12 gap-4 lg:grid">
					{BENTO.map((card) => <BentoCard key={card.id} {...card} locale={locale} />)}
				</ReplayGrid>
				<HiddenCapabilities locale={locale} />
			</Container>
		</section>
	)
}
