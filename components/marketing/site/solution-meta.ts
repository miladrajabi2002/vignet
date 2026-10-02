import { Bot, Headset, Inbox, Send, ShoppingCart, Store } from 'lucide-react'
import { InstagramGlyph } from '@/components/marketing/social-links'
import type { IconType, SiteLocale } from './ui'

/**
 * Short marketing labels for each solution slug in lib/marketing/solutions.
 * The long H1/meta copy stays in the catalog; these are the card-sized names,
 * one-line pitches and audience tags used across the public pages.
 */
export const SOLUTION_CARDS: Record<string, { icon: IconType; name: Record<SiteLocale, string>; pitch: Record<SiteLocale, string>; card: Record<SiteLocale, string>; tags: Record<SiteLocale, string[]> }> = {
	'unified-inbox': {
		icon: Inbox,
		name: { fa: 'صندوق پیام یکپارچه', en: 'Unified inbox' },
		pitch: { fa: 'پیام‌های همهٔ برنامه‌ها در یک صفحه', en: 'Every channel’s messages on one screen' },
		card: { fa: 'دایرکت اینستاگرام، تلگرام، بله، روبیکا و ویجت سایت در یک صفحه؛ با ایجنت و CRM یکپارچه.', en: 'Instagram DMs, Telegram, Bale, Rubika and your website widget on one screen, with the agent and CRM built in.' },
		tags: { fa: ['همهٔ کسب‌وکارها', '۶ برنامه'], en: ['Every business', '6 channels'] },
	},
	'persian-ai-chatbot': {
		icon: Bot,
		name: { fa: 'چت‌بات فارسی', en: 'Persian AI chatbot' },
		pitch: { fa: 'فارسی روان، با لحن برند شما', en: 'Fluent Persian in your brand’s voice' },
		card: { fa: 'محصولات، قوانین و لحن شما را یاد می‌گیرد و مثل یک عضو تیم پاسخ می‌دهد.', en: 'Learns your products, policies and tone, and answers like a member of your team.' },
		tags: { fa: ['پاسخ ۲۴ ساعته'], en: ['24/7 answers'] },
	},
	'ecommerce-ai': {
		icon: Store,
		name: { fa: 'هوش مصنوعی فروشگاه', en: 'AI for online stores' },
		pitch: { fa: 'برای فروش، نه فقط گفتگو', en: 'Built to sell, not just chat' },
		card: { fa: 'کاتالوگ و سفارش‌ها را به یک دستیار فروش فارسی وصل کنید.', en: 'Connect your catalog and orders to a Persian-speaking sales assistant.' },
		tags: { fa: ['فروشگاه آنلاین'], en: ['Online store'] },
	},
	'customer-support-ai': {
		icon: Headset,
		name: { fa: 'پشتیبانی هوشمند', en: 'AI customer support' },
		pitch: { fa: 'با اپراتور، هرجا لازم است', en: 'With a human wherever it matters' },
		card: { fa: 'سؤال‌های تکراری خودکار؛ موارد حساس با سابقه به تیم شما.', en: 'Repeat questions answered automatically; sensitive cases reach your team with full history.' },
		tags: { fa: ['تیم پشتیبانی'], en: ['Support teams'] },
	},
	instagram: {
		icon: InstagramGlyph as IconType,
		name: { fa: 'پاسخگوی اینستاگرام', en: 'Instagram responder' },
		pitch: { fa: 'دایرکت، کامنت و استوری', en: 'DMs, comments and stories' },
		card: { fa: 'دایرکت و کامنت خودکار، کامنت به دایرکت و چند اکانت.', en: 'Automatic DMs and comments, comment-to-DM and multiple accounts.' },
		tags: { fa: ['پیج فروشگاهی'], en: ['Shop pages'] },
	},
	telegram: {
		icon: Send,
		name: { fa: 'چت‌بات تلگرام', en: 'Telegram chatbot' },
		pitch: { fa: 'مشاوره و فروش در تلگرام', en: 'Advice and sales on Telegram' },
		card: { fa: 'مثل بهترین فروشنده‌تان جواب می‌دهد؛ ۲۴ ساعته و در چند ثانیه.', en: 'Answers like your best salesperson — around the clock, in seconds.' },
		tags: { fa: ['کانال و گروه'], en: ['Channels & groups'] },
	},
	woocommerce: {
		icon: ShoppingCart,
		name: { fa: 'دستیار ووکامرس', en: 'WooCommerce assistant' },
		pitch: { fa: 'افزونهٔ رسمی، همگام خودکار', en: 'Official plugin, automatic sync' },
		card: { fa: 'افزونه را نصب کنید؛ ایجنت از قیمت و موجودی واقعی جواب می‌دهد — روی سایت، تلگرام و اینستاگرام.', en: 'Install the plugin and the agent answers from real price and stock — on your site, Telegram and Instagram.' },
		tags: { fa: ['وردپرس', 'ووکامرس'], en: ['WordPress', 'WooCommerce'] },
	},
}

export const SOLUTION_ORDER = ['unified-inbox', 'persian-ai-chatbot', 'ecommerce-ai', 'customer-support-ai', 'instagram', 'telegram', 'woocommerce'] as const

/**
 * One-sentence definitions shown in the "short answer" box at the top of each
 * solution page — the extractable answer search and AI answer engines quote.
 */
export const SOLUTION_ANSWERS: Record<string, Record<SiteLocale, string>> = {
	'unified-inbox': {
		fa: 'صندوق پیام یکپارچهٔ ویجنت یعنی یک صفحه برای همهٔ برنامه‌ها، یک ایجنت که خودکار پاسخ می‌دهد و یک پروندهٔ CRM برای هر مشتری.',
		en: 'Vigent’s unified inbox is one screen for every channel, one agent that answers automatically and one CRM record per customer.',
	},
	'persian-ai-chatbot': {
		fa: 'چت‌بات فارسی ویجنت یک ایجنت هوش مصنوعی است که از دانش و محصولات خودتان، ۲۴ ساعته و با لحن برندتان به مشتری جواب می‌دهد.',
		en: 'Vigent’s Persian chatbot is an AI agent that answers customers around the clock from your own knowledge and products, in your brand’s tone.',
	},
	'ecommerce-ai': {
		fa: 'هوش مصنوعی فروشگاه ویجنت در دل گفتگو محصول پیدا می‌کند، قیمت و موجودی لحظه‌ای می‌گوید، کارت محصول می‌فرستد و سفارش را پیش می‌برد.',
		en: 'Vigent’s store AI finds products inside the conversation, quotes live price and stock, sends product cards and moves the order forward.',
	},
	'customer-support-ai': {
		fa: 'پشتیبانی هوشمند ویجنت سؤال‌های تکراری را خودکار جواب می‌دهد و گفتگوهای حساس را با خلاصهٔ کامل به اپراتور انسانی می‌سپارد.',
		en: 'Vigent’s AI support answers repeat questions automatically and hands sensitive conversations to a human operator with a full summary.',
	},
	instagram: {
		fa: 'پاسخگوی اینستاگرام ویجنت دایرکت، کامنت و استوری را خودکار جواب می‌دهد؛ سناریوهای ثابت بدون مصرف اعتبار و دایرکت با ایجنت هوشمند.',
		en: 'Vigent’s Instagram responder answers DMs, comments and stories automatically — fixed scenarios use no credit, DMs use the smart agent.',
	},
	telegram: {
		fa: 'چت‌بات تلگرام ویجنت ربات کسب‌وکار شما را به یک ایجنت هوش مصنوعی وصل می‌کند تا در چند ثانیه مشاوره بدهد، بفروشد و سفارش را پیگیری کند.',
		en: 'Vigent’s Telegram chatbot connects your business bot to an AI agent that advises, sells and tracks orders within seconds.',
	},
	woocommerce: {
		fa: 'دستیار ووکامرس ویجنت با افزونهٔ رسمی، محصولات و سفارش‌های فروشگاه وردپرسی را همگام می‌کند تا ایجنت همیشه از قیمت و موجودی واقعی جواب دهد.',
		en: 'Vigent’s WooCommerce assistant syncs your WordPress store’s products and orders through the official plugin, so the agent always answers from real price and stock.',
	},
}

type Stat = { value: string; label: string }

/**
 * Per-solution key facts (the numbers strip under each solution hero) and
 * the titles of its three setup steps. The step bodies stay in the catalog
 * (lib/marketing/solutions.ts); these titles are written to match them.
 */
export const SOLUTION_FACTS: Record<string, { stats: Record<SiteLocale, Stat[]>; steps: Record<SiteLocale, string[]> }> = {
	'unified-inbox': {
		stats: {
			fa: [{ value: '۶', label: 'برنامه در یک صندوق' }, { value: '۱', label: 'پرونده برای هر مشتری' }, { value: '۰', label: 'پیام گم‌شده' }, { value: '۲۴/۷', label: 'پاسخ خودکار' }],
			en: [{ value: '6', label: 'apps in one inbox' }, { value: '1', label: 'record per customer' }, { value: '0', label: 'lost messages' }, { value: '24/7', label: 'automatic replies' }],
		},
		steps: { fa: ['ساخت ایجنت و افزودن دانش', 'اتصال برنامه‌ها', 'رسیدگی از یک صفحه'], en: ['Build the agent and add knowledge', 'Connect your apps', 'Handle everything on one screen'] },
	},
	'persian-ai-chatbot': {
		stats: {
			fa: [{ value: '۲۴/۷', label: 'پاسخ‌گویی، حتی شب‌ها' }, { value: 'هر زبان', label: 'پاسخ به زبان خود مشتری' }, { value: 'صوتی', label: 'پیام صوتی را هم می‌فهمد' }, { value: '۰', label: 'خط کدنویسی' }],
			en: [{ value: '24/7', label: 'answers, even at night' }, { value: 'Any', label: 'language the customer writes in' }, { value: 'Voice', label: 'notes understood too' }, { value: '0', label: 'lines of code' }],
		},
		steps: { fa: ['انتخاب نمونهٔ آماده', 'افزودن دانش و محصولات', 'تست و فعال‌سازی'], en: ['Pick a ready template', 'Add knowledge and products', 'Test and go live'] },
	},
	'ecommerce-ai': {
		stats: {
			fa: [{ value: 'لحظه‌ای', label: 'قیمت و موجودی' }, { value: 'کارت', label: 'محصول داخل گفتگو' }, { value: 'پیش‌سفارش', label: 'حتی برای کالای ناموجود' }, { value: '۲۴/۷', label: 'فروش، حتی شب‌ها' }],
			en: [{ value: 'Live', label: 'price and stock' }, { value: 'Cards', label: 'products inside the chat' }, { value: 'Pre-orders', label: 'even when out of stock' }, { value: '24/7', label: 'selling, even at night' }],
		},
		steps: { fa: ['ساخت ایجنت فروشگاهی', 'افزودن محصولات یا ووکامرس', 'تست خرید و فعال‌سازی'], en: ['Build a store agent', 'Add products or WooCommerce', 'Test a purchase and go live'] },
	},
	'customer-support-ai': {
		stats: {
			fa: [{ value: 'خودکار', label: 'جواب سؤال‌های تکراری' }, { value: 'خلاصه', label: 'تحویل به اپراتور با خلاصه' }, { value: 'فوری', label: 'هشدار در تلگرام تیم' }, { value: '۲۴/۷', label: 'پشتیبانی' }],
			en: [{ value: 'Auto', label: 'answers to repeat questions' }, { value: 'Summary', label: 'handed to an operator' }, { value: 'Instant', label: 'alerts in your team’s Telegram' }, { value: '24/7', label: 'support' }],
		},
		steps: { fa: ['انتخاب نمونه و لحن', 'افزودن راهنماها و قوانین', 'فعال‌سازی و مسیر اپراتور'], en: ['Pick a template and tone', 'Add guides and policies', 'Go live with an operator path'] },
	},
	instagram: {
		stats: {
			fa: [{ value: 'رایگان', label: 'همهٔ اتوماسیون‌های ثابت' }, { value: 'خودکار', label: 'کامنت به دایرکت' }, { value: 'استوری', label: 'پاسخ به منشن و ری‌اکشن' }, { value: 'رسمی', label: 'اتصال از API متا' }],
			en: [{ value: 'Free', label: 'every fixed automation' }, { value: 'Auto', label: 'comment to DM' }, { value: 'Stories', label: 'mention and reaction replies' }, { value: 'Official', label: 'Meta API connection' }],
		},
		steps: { fa: ['ساخت ایجنت و افزودن محصولات', 'اتصال حساب اینستاگرام', 'پاسخ خودکار دایرکت و کامنت'], en: ['Build the agent and add products', 'Connect your Instagram account', 'Automatic DM and comment replies'] },
	},
	telegram: {
		stats: {
			fa: [{ value: '۱', label: 'توکن تا اتصال ربات' }, { value: '۲۴/۷', label: 'مشاوره و فروش' }, { value: 'پیگیری', label: 'وضعیت سفارش در چت' }, { value: 'هشدار', label: 'به تیم در همین تلگرام' }],
			en: [{ value: '1', label: 'token to connect the bot' }, { value: '24/7', label: 'advice and sales' }, { value: 'Tracking', label: 'order status in chat' }, { value: 'Alerts', label: 'to your team on Telegram' }],
		},
		steps: { fa: ['ثبت‌نام و ساخت ایجنت', 'افزودن محصولات و دانش', 'وارد کردن توکن ربات'], en: ['Sign up and build the agent', 'Add products and knowledge', 'Paste the bot token'] },
	},
	woocommerce: {
		stats: {
			fa: [{ value: 'رسمی', label: 'افزونهٔ وردپرس' }, { value: 'خودکار', label: 'همگام‌سازی قیمت و موجودی' }, { value: 'سفارش', label: 'پیگیری از ووکامرس' }, { value: 'همه‌جا', label: 'سایت، تلگرام و اینستاگرام' }],
			en: [{ value: 'Official', label: 'WordPress plugin' }, { value: 'Auto', label: 'price and stock sync' }, { value: 'Orders', label: 'tracked from WooCommerce' }, { value: 'Everywhere', label: 'site, Telegram and Instagram' }],
		},
		steps: { fa: ['ساخت ایجنت', 'نصب افزونه روی وردپرس', 'همگام‌سازی کامل'], en: ['Build the agent', 'Install the WordPress plugin', 'Run a full sync'] },
	},
}
