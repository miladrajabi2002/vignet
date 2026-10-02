/**
 * Demo / test data for design reviews.
 *
 *   tsx -r dotenv/config scripts/demo-data.ts seed-test [phone]  a self-contained test workspace (prompt layers copied from that owner's agent)
 *   tsx -r dotenv/config scripts/demo-data.ts seed-main <phone>  CRM-only sample rows in an existing workspace
 *   tsx -r dotenv/config scripts/demo-data.ts clean-test
 *   tsx -r dotenv/config scripts/demo-data.ts clean-main <phone>
 *
 * Everything written here is inert on purpose:
 *  - conversations use website / chat-link threads with made-up thread ids, so
 *    nothing can be delivered to a real person;
 *  - phone numbers are landline-shaped placeholders (never a mobile number);
 *  - orders, restock alerts and order drafts are created in terminal states
 *    the worker does not act on;
 *  - the test workspace is on a paid plan that never expires, so no trial or
 *    renewal SMS is ever queued for its placeholder owner.
 * Every created row id is written to scripts/.demo-data-manifest.json, which
 * `clean-*` reads back.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient, type ChannelType, type Prisma } from '@prisma/client'
import sharp from 'sharp'

const prisma = new PrismaClient()
const MANIFEST = path.join(process.cwd(), 'scripts', '.demo-data-manifest.json')
const TEST_PHONE = '+980000000001'
const FRESH_PHONE = '+980000000002'
const HOUR = 3_600_000
const DAY = 24 * HOUR
const now = Date.now()
const ago = (ms: number) => new Date(now - ms)

type Manifest = Record<string, Record<string, string[]>>
const readManifest = (): Manifest => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {})
const writeManifest = (m: Manifest) => writeFileSync(MANIFEST, `${JSON.stringify(m, null, 1)}\n`)

function tracker(scope: string) {
	const manifest = readManifest()
	const bucket = (manifest[scope] ??= {})
	return {
		add(model: string, id: string) { (bucket[model] ??= []).push(id); return id },
		save() { writeManifest(manifest) },
	}
}

/* ── Sample content ─────────────────────────────────────────────────── */

const CONTACTS = [
	{ name: 'سارا احمدی', stage: 'customer', tags: ['خرید تکراری', 'تهران'], notes: 'سایز M می‌پوشد؛ رنگ‌های تیره را ترجیح می‌دهد.', channel: 'INSTAGRAM' as const, handle: 'sara.ahmadi', optIn: true },
	{ name: 'علی رضایی', stage: 'qualified', tags: ['قصد خرید بالا'], notes: null, channel: 'WEB_WIDGET' as const, handle: null, optIn: false },
	{ name: 'مریم کریمی', stage: 'lead', tags: [], notes: null, channel: 'CHAT_LINK' as const, handle: null, optIn: false },
	{ name: 'حسین محمدی', stage: 'customer', tags: ['عمده'], notes: 'خرید عمده برای بوتیک خودش در شیراز.', channel: 'WEB_WIDGET' as const, handle: null, optIn: true },
	{ name: 'نگار صادقی', stage: 'qualified', tags: ['نوبت'], notes: null, channel: 'CHAT_LINK' as const, handle: null, optIn: false },
	{ name: 'رضا موسوی', stage: 'lost', tags: ['قیمت'], notes: 'به‌خاطر هزینهٔ ارسال منصرف شد.', channel: 'WEB_WIDGET' as const, handle: null, optIn: false },
	{ name: 'فاطمه حسینی', stage: 'customer', tags: ['خرید تکراری'], notes: null, channel: 'INSTAGRAM' as const, handle: 'fatemeh_h', optIn: true },
	{ name: 'امیر جعفری', stage: 'lead', tags: [], notes: null, channel: 'WEB_WIDGET' as const, handle: null, optIn: false },
	{ name: 'زهرا نوری', stage: 'lead', tags: ['دوره'], notes: null, channel: 'CHAT_LINK' as const, handle: null, optIn: false },
	{ name: 'مهدی کاظمی', stage: 'qualified', tags: ['قرارداد سازمانی'], notes: 'برای ۴۰ نفر پرسنل استعلام گرفته است.', channel: 'WEB_WIDGET' as const, handle: null, optIn: false },
	{ name: 'الهام رحیمی', stage: 'customer', tags: [], notes: null, channel: 'INSTAGRAM' as const, handle: 'elham.rahimi', optIn: false },
	{ name: 'پویا شریفی', stage: 'lead', tags: [], notes: null, channel: 'WEB_WIDGET' as const, handle: null, optIn: false },
	{ name: null, stage: 'lead', tags: [], notes: null, channel: 'WEB_WIDGET' as const, handle: null, optIn: false },
	{ name: 'شیما قاسمی', stage: 'lost', tags: [], notes: null, channel: 'CHAT_LINK' as const, handle: null, optIn: false },
]

type Turn = ['u' | 'a' | 'o', string]
const THREADS: Array<{ contact: number; status: 'OPEN' | 'RESOLVED' | 'HANDED_OFF'; startedAgo: number; rating?: number; summary: string; turns: Turn[]; insight: { leadType: string; stage: string; readiness: string; probability: number; sentiment: string; urgency: string; objections?: string[]; action: string } }> = [
	{ contact: 0, status: 'RESOLVED', startedAgo: 26 * DAY, rating: 5, summary: 'پرسش دربارهٔ موجودی کت پاییزه سایز M؛ لینک پرداخت ارسال و سفارش ثبت شد.', turns: [['u', 'سلام، کت پاییزهٔ مشکی سایز M موجوده؟'], ['a', 'سلام سارا جان 🌿 بله، سایز M و L مشکی موجوده؛ قیمتش ۲٬۴۸۰٬۰۰۰ تومانه. کارت محصول رو براتون فرستادم.'], ['u', 'ارسال به تهران چند روزه می‌رسه؟'], ['a', 'ارسال تهران با پیک، همون روز یا فردا صبح به دستتون می‌رسه. هزینهٔ پیک ۸۰ هزار تومانه.'], ['u', 'عالیه، همین رو می‌خوام'], ['a', 'سبدتون آماده شد. لینک پرداخت رو فرستادم؛ بعد از پرداخت، کد رهگیری همین‌جا براتون میاد.']], insight: { leadType: 'BUYER', stage: 'POST_PURCHASE', readiness: 'CUSTOMER', probability: 96, sentiment: 'POSITIVE', urgency: 'LOW', action: 'پیشنهاد محصول مکمل در خرید بعدی.' } },
	{ contact: 1, status: 'HANDED_OFF', startedAgo: 3 * HOUR, summary: 'مشتری تخفیف خرید ۵ عددی می‌خواهد؛ ایجنت اختیار تخفیف ندارد و به اپراتور سپرد.', turns: [['u', 'سلام، اگه ۵ تا مانتو کتان بخوام تخفیف می‌دید؟'], ['a', 'سلام علی عزیز. مانتو کتان هر عدد ۱٬۸۵۰٬۰۰۰ تومانه. برای خرید چندتایی باید همکارم تأیید کنه؛ الان گفتگو رو با خلاصه براش می‌فرستم.'], ['u', 'باشه، فقط زود جواب بدید لطفاً، امروز می‌خوام سفارش بدم']], insight: { leadType: 'BUYER', stage: 'NEGOTIATION', readiness: 'HOT', probability: 84, sentiment: 'NEUTRAL', urgency: 'HIGH', objections: ['قیمت'], action: 'همین امروز با پیشنهاد تخفیف پلکانی پاسخ دهید.' } },
	{ contact: 2, status: 'OPEN', startedAgo: 40 * 60_000, summary: 'پرسش دربارهٔ جدول سایز.', turns: [['u', 'سلام وقت بخیر'], ['a', 'سلام مریم جان، خوش اومدید 🌸 چطور می‌تونم کمکتون کنم؟'], ['u', 'قد ۱۶۵ و وزن ۵۸ هستم، چه سایزی بردارم؟'], ['a', 'با این مشخصات سایز M براتون مناسبه. اگه راحت‌تر می‌پسندید، L هم گزینهٔ خوبیه.']], insight: { leadType: 'INFORMATION_SEEKER', stage: 'INFORMATION_GATHERING', readiness: 'EXPLORING', probability: 48, sentiment: 'POSITIVE', urgency: 'LOW', action: 'یک محصول پرفروش در سایز M پیشنهاد دهید.' } },
	{ contact: 3, status: 'RESOLVED', startedAgo: 19 * DAY, rating: 4, summary: 'استعلام خرید عمدهٔ شال؛ فهرست قیمت عمده ارسال شد.', turns: [['u', 'برای خرید عمدهٔ شال نخی چه شرایطی دارید؟'], ['a', 'برای خرید بالای ۲۰ عدد، قیمت هر شال ۳۲۰ هزار تومان می‌شه و ارسال رایگانه.'], ['u', 'فهرست رنگ‌ها رو هم بفرستید'], ['a', 'رنگ‌های موجود: کرم، مشکی، طوسی، سبز یشمی و آجری. از هر رنگ حداقل ۵ عدد قابل سفارشه.']], insight: { leadType: 'BUYER', stage: 'CONSIDERATION', readiness: 'WARM', probability: 71, sentiment: 'POSITIVE', urgency: 'MEDIUM', action: 'پیگیری سه روز بعد با پیشنهاد رنگ‌های پرفروش.' } },
	{ contact: 4, status: 'RESOLVED', startedAgo: 6 * DAY, rating: 5, summary: 'رزرو مشاورهٔ استایل برای پنجشنبه ساعت ۱۷.', turns: [['u', 'برای مشاورهٔ استایل این هفته وقت خالی دارید؟'], ['a', 'بله نگار جان. پنجشنبه ساعت ۱۶:۰۰ و ۱۷:۰۰ خالیه. کدوم رو رزرو کنم؟'], ['u', 'ساعت ۵'], ['a', 'نوبت شما برای پنجشنبه ساعت ۱۷:۰۰ ثبت شد ✓ یک روز قبل هم یادآوری می‌فرستم.']], insight: { leadType: 'BUYER', stage: 'PURCHASE_INTENT', readiness: 'HOT', probability: 88, sentiment: 'POSITIVE', urgency: 'MEDIUM', action: 'پس از جلسه، بستهٔ پیشنهادی را ارسال کنید.' } },
	{ contact: 5, status: 'RESOLVED', startedAgo: 12 * DAY, rating: 2, summary: 'مشتری از هزینهٔ ارسال شهرستان ناراضی بود و خرید را ادامه نداد.', turns: [['u', 'هزینهٔ ارسال به مشهد چقدره؟'], ['a', 'ارسال به مشهد با پست پیشتاز ۱۲۰ هزار تومانه و ۳ تا ۴ روز کاری زمان می‌بره.'], ['u', 'خیلی زیاده. جای دیگه رایگان می‌فرستن'], ['a', 'متوجهم. برای خرید بالای ۳ میلیون تومان ارسال رایگانه؛ اگه بخواید می‌تونم یک پیشنهاد مکمل بدم که به این مبلغ برسه.'], ['u', 'نه ممنون']], insight: { leadType: 'BUYER', stage: 'CONSIDERATION', readiness: 'COLD', probability: 14, sentiment: 'NEGATIVE', urgency: 'LOW', objections: ['هزینهٔ ارسال'], action: 'کد ارسال رایگان یک‌باره پیشنهاد دهید.' } },
	{ contact: 6, status: 'RESOLVED', startedAgo: 9 * DAY, rating: 5, summary: 'پیگیری سفارش ۱۰۴۲؛ کد رهگیری اعلام شد.', turns: [['u', 'سفارش من کی می‌رسه؟ شماره‌ش ۱۰۴۲ بود'], ['a', 'سفارش ۱۰۴۲ دیروز به پست تحویل شده. کد رهگیری: ۱۲۳۴۵۶۷۸۹۰۱۲۳ — معمولاً ۲ تا ۳ روز کاری می‌رسه.'], ['u', 'مرسی 🙏']], insight: { leadType: 'EXISTING_CUSTOMER', stage: 'POST_PURCHASE', readiness: 'CUSTOMER', probability: 92, sentiment: 'POSITIVE', urgency: 'LOW', action: 'پس از تحویل، نظرسنجی کوتاه بفرستید.' } },
	{ contact: 7, status: 'OPEN', startedAgo: 2 * HOUR, summary: 'پرسش دربارهٔ روش پرداخت.', turns: [['u', 'پرداخت در محل دارید؟'], ['a', 'پرداخت در محل فقط برای تهران فعاله. برای بقیهٔ شهرها پرداخت آنلاین با درگاه بانکی انجام می‌شه.']], insight: { leadType: 'INFORMATION_SEEKER', stage: 'DISCOVERY', readiness: 'EXPLORING', probability: 35, sentiment: 'NEUTRAL', urgency: 'LOW', action: 'شهر مشتری را بپرسید و گزینهٔ مناسب را پیشنهاد دهید.' } },
	{ contact: 8, status: 'RESOLVED', startedAgo: 4 * DAY, summary: 'ثبت‌نام در کارگاه «ست‌کردن رنگ‌ها».', turns: [['u', 'کارگاه ست‌کردن رنگ‌ها هنوز جا داره؟'], ['a', 'بله زهرا جان، ۶ جای خالی مونده. جمعه ۱۰ صبح تا ۱ برگزار می‌شه و هزینه‌ش ۴۵۰ هزار تومانه. ثبت‌نامتون کنم؟'], ['u', 'آره لطفاً'], ['a', 'ثبت‌نام شما انجام شد ✓ جزئیات پرداخت رو همکارم براتون می‌فرسته.']], insight: { leadType: 'BUYER', stage: 'PURCHASE_INTENT', readiness: 'HOT', probability: 81, sentiment: 'POSITIVE', urgency: 'MEDIUM', action: 'لینک پرداخت دوره را ارسال کنید.' } },
	{ contact: 9, status: 'HANDED_OFF', startedAgo: 20 * HOUR, summary: 'درخواست قرارداد سازمانی برای لباس فرم ۴۰ نفر؛ نیاز به پیش‌فاکتور رسمی.', turns: [['u', 'ما برای ۴۰ نفر لباس فرم می‌خوایم. پیش‌فاکتور رسمی می‌دید؟'], ['a', 'حتماً. برای سفارش سازمانی، همکار فروش پیش‌فاکتور رسمی صادر می‌کنه. جنس و رنگ مدنظرتون رو بفرمایید تا در خلاصه ثبت کنم.'], ['u', 'کتان، سرمه‌ای، با لوگو'], ['a', 'ثبت شد. گفتگو رو به همکارم سپردم؛ تا پایان امروز با شما تماس می‌گیرن.']], insight: { leadType: 'BUYER', stage: 'NEGOTIATION', readiness: 'HOT', probability: 77, sentiment: 'NEUTRAL', urgency: 'HIGH', action: 'پیش‌فاکتور رسمی را تا پایان روز ارسال کنید.' } },
	{ contact: 10, status: 'RESOLVED', startedAgo: 15 * DAY, rating: 4, summary: 'تعویض سایز کفش چرم؛ شرایط تعویض توضیح داده شد.', turns: [['u', 'کفشی که خریدم یک سایز کوچیکه، می‌شه عوضش کرد؟'], ['a', 'بله الهام جان. تا ۷ روز بعد از تحویل، اگه استفاده نشده باشه تعویض رایگانه. سایز جدید رو بفرمایید.'], ['u', '۳۹'], ['a', 'سایز ۳۹ موجوده. پیک فردا برای تعویض هماهنگ می‌کنه.']], insight: { leadType: 'SUPPORT_SEEKER', stage: 'POST_PURCHASE', readiness: 'CUSTOMER', probability: 90, sentiment: 'POSITIVE', urgency: 'MEDIUM', action: 'پس از تعویض، رضایت مشتری را بپرسید.' } },
	{ contact: 11, status: 'RESOLVED', startedAgo: 22 * DAY, summary: 'پرسش دربارهٔ ساعت کاری.', turns: [['u', 'تا چه ساعتی جواب می‌دید؟'], ['a', 'من ۲۴ ساعته پاسخ می‌دم. همکاران فروش شنبه تا پنجشنبه ۱۰ تا ۱۸ در دسترس‌ان.']], insight: { leadType: 'INFORMATION_SEEKER', stage: 'DISCOVERY', readiness: 'COLD', probability: 18, sentiment: 'NEUTRAL', urgency: 'LOW', action: 'نیازی به اقدام نیست.' } },
	{ contact: 12, status: 'OPEN', startedAgo: 15 * 60_000, summary: 'بازدیدکنندهٔ ناشناس دربارهٔ موجودی پرسید.', turns: [['u', 'کیف چرم قهوه‌ای دارید؟'], ['a', 'بله، کیف دوشی چرم قهوه‌ای موجوده؛ ۳٬۲۰۰٬۰۰۰ تومان. اگه اسم و شماره‌تون رو بفرمایید، سفارش رو براتون ثبت می‌کنم.']], insight: { leadType: 'BUYER', stage: 'CONSIDERATION', readiness: 'WARM', probability: 55, sentiment: 'NEUTRAL', urgency: 'LOW', action: 'نام و شمارهٔ مشتری را بگیرید.' } },
	{ contact: 13, status: 'HANDED_OFF', startedAgo: 2 * DAY, summary: 'شکایت از تأخیر ارسال؛ مشتری عصبانی است و اپراتور پاسخ داده.', turns: [['u', 'یک هفته‌ست سفارشم نرسیده! این چه وضعشه؟'], ['a', 'خیلی متأسفم شیما جان. سفارش شما با تأخیر پست مواجه شده. گفتگو رو همین الان به همکارم می‌سپرم تا شخصاً پیگیری کنه.'], ['o', 'سلام، من مسئول ارسال هستم. بستهٔ شما امروز از مرکز پست خارج شده و فردا تحویل می‌شه. بابت تأخیر، کد تخفیف ۱۵٪ برای خرید بعدی براتون فعال کردم.'], ['u', 'باشه، منتظرم']], insight: { leadType: 'EXISTING_CUSTOMER', stage: 'POST_PURCHASE', readiness: 'CUSTOMER', probability: 40, sentiment: 'DISTRESSED', urgency: 'HIGH', objections: ['تأخیر ارسال'], action: 'فردا تحویل را تأیید و عذرخواهی کنید.' } },
]

const CATEGORIES = ['پوشاک زنانه', 'کیف و کفش', 'اکسسوری', 'حراج']
const PRODUCTS = [
	{ name: 'کت پاییزه مشکی', cat: 0, price: 2_480_000, compare: null, stock: 7, sku: 'DEMO-JK-01', tags: ['پرفروش'], attrs: { رنگ: 'مشکی', سایز: 'M، L' }, hue: 260, desc: 'کت پاییزهٔ آسترکشی با پارچهٔ فوتر؛ مناسب هوای خنک.' },
	{ name: 'مانتو کتان کرم', cat: 0, price: 1_850_000, compare: 2_200_000, stock: 12, sku: 'DEMO-MN-02', tags: ['تخفیف'], attrs: { رنگ: 'کرم', سایز: 'S تا XL' }, hue: 35, desc: 'مانتو کتان خنک با برش آزاد.' },
	{ name: 'شومیز حریر سفید', cat: 0, price: 980_000, compare: null, stock: 2, sku: 'DEMO-SH-03', tags: [], attrs: { رنگ: 'سفید', سایز: 'M' }, hue: 200, desc: 'شومیز حریر آستین‌بلند.' },
	{ name: 'شلوار پارچه‌ای طوسی', cat: 0, price: 1_150_000, compare: null, stock: 0, sku: 'DEMO-PN-04', tags: [], attrs: { رنگ: 'طوسی', سایز: '۳۸ تا ۴۴' }, hue: 220, desc: 'شلوار راسته با فاق متوسط.' },
	{ name: 'کیف دوشی چرم قهوه‌ای', cat: 1, price: 3_200_000, compare: null, stock: 5, sku: 'DEMO-BG-05', tags: ['چرم طبیعی'], attrs: { رنگ: 'قهوه‌ای' }, hue: 22, desc: 'کیف دوشی چرم طبیعی با بند قابل‌تنظیم.' },
	{ name: 'کفش چرم زنانه', cat: 1, price: 2_750_000, compare: 3_100_000, stock: 9, sku: 'DEMO-SH-06', tags: ['تخفیف'], attrs: { رنگ: 'مشکی', سایز: '۳۶ تا ۴۰' }, hue: 0, desc: 'کفش تخت چرم با زیرهٔ ضدلغزش.' },
	{ name: 'کتانی سفید روزمره', cat: 1, price: 1_690_000, compare: null, stock: null, sku: 'DEMO-SN-07', tags: [], attrs: { رنگ: 'سفید', سایز: '۳۶ تا ۴۱' }, hue: 150, desc: 'کتانی سبک برای استفادهٔ روزانه.' },
	{ name: 'شال نخی آجری', cat: 2, price: 390_000, compare: null, stock: 40, sku: 'DEMO-SC-08', tags: ['پرفروش'], attrs: { رنگ: 'آجری' }, hue: 14, desc: 'شال نخی چهارفصل، قواره‌بزرگ.' },
	{ name: 'کمربند چرم', cat: 2, price: 620_000, compare: null, stock: 1, sku: 'DEMO-BL-09', tags: [], attrs: { رنگ: 'مشکی' }, hue: 280, desc: 'کمربند چرم طبیعی با سگک فلزی.' },
	{ name: 'عینک آفتابی', cat: 2, price: 1_100_000, compare: null, stock: 14, sku: 'DEMO-GL-10', tags: [], attrs: {}, hue: 190, desc: 'عینک آفتابی UV400.' },
	{ name: 'پالتو زمستانه (حراج)', cat: 3, price: 2_900_000, compare: 4_800_000, stock: 3, sku: 'DEMO-CT-11', tags: ['حراج'], attrs: { رنگ: 'شتری', سایز: 'L' }, hue: 40, desc: 'پالتو پشمی آخر فصل.' },
	{ name: 'ست هدیهٔ پاییزه', cat: 3, price: null, compare: null, stock: 6, sku: 'DEMO-GF-12', tags: [], attrs: {}, hue: 320, desc: 'ست شال و کیف؛ قیمت هنوز ثبت نشده.' },
]
const ORDERS = [
	{ no: '1042', c: 6, status: 'completed', total: 2_750_000, items: '۱× کفش چرم زنانه', ago: 9 * DAY, track: '1234567890123', courier: 'پست پیشتاز' },
	{ no: '1043', c: 0, status: 'processing', total: 2_560_000, items: '۱× کت پاییزه مشکی', ago: 2 * DAY, track: null, courier: null },
	{ no: '1044', c: 3, status: 'on-hold', total: 7_800_000, items: '۲۰× شال نخی آجری', ago: 1 * DAY, track: null, courier: null },
	{ no: '1045', c: 10, status: 'completed', total: 2_750_000, items: '۱× کفش چرم زنانه', ago: 15 * DAY, track: '9876543210987', courier: 'تیپاکس' },
	{ no: '1046', c: 5, status: 'cancelled', total: 1_850_000, items: '۱× مانتو کتان کرم', ago: 12 * DAY, track: null, courier: null },
	{ no: '1047', c: 13, status: 'processing', total: 3_200_000, items: '۱× کیف دوشی چرم قهوه‌ای', ago: 8 * DAY, track: null, courier: null },
	{ no: '1048', c: 1, status: 'pending', total: 9_250_000, items: '۵× مانتو کتان کرم', ago: 3 * HOUR, track: null, courier: null },
	{ no: '1049', c: 6, status: 'refunded', total: 980_000, items: '۱× شومیز حریر سفید', ago: 20 * DAY, track: null, courier: null },
]

const landline = (i: number) => `0210000${String(1000 + i)}`

async function productImage(workspaceId: string, slug: string, hue: number, label: string): Promise<string> {
	const dir = path.join(process.cwd(), 'public', 'uploads', 'products', workspaceId, 'demo')
	mkdirSync(dir, { recursive: true })
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 88%)"/><stop offset="1" stop-color="hsl(${(hue + 30) % 360} 45% 70%)"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><circle cx="400" cy="360" r="170" fill="hsl(${hue} 40% 96%)" opacity=".85"/><rect x="250" y="560" width="300" height="26" rx="13" fill="hsl(${hue} 30% 35%)" opacity=".5"/><text x="400" y="385" text-anchor="middle" font-family="sans-serif" font-size="72" fill="hsl(${hue} 35% 32%)">${label}</text></svg>`
	await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(path.join(dir, `${slug}.webp`))
	return `/media/products/${workspaceId}/demo/${slug}.webp`
}

/* ── CRM rows (safe in any workspace) ───────────────────────────────── */

async function seedCrm(t: ReturnType<typeof tracker>, workspaceId: string, agentId: string, channels: Record<'INSTAGRAM' | 'WEB_WIDGET' | 'CHAT_LINK', ChannelType>) {
	const contactIds: string[] = []
	for (const [i, c] of CONTACTS.entries()) {
		const thread = THREADS.find((x) => x.contact === i)
		const created = await prisma.contact.create({
			data: {
				workspaceId,
				name: c.name,
				phone: c.name ? landline(i) : null,
				stage: c.stage,
				tags: [...c.tags, 'نمونه'],
				notes: c.notes,
				metadata: { demoSeed: true },
				instagramUsername: channels[c.channel] === 'INSTAGRAM' ? c.handle : null,
				marketingOptIn: c.optIn,
				marketingOptInAt: c.optIn ? ago(20 * DAY) : null,
				createdAt: ago((thread?.startedAgo ?? 10 * DAY) + HOUR),
				lastActivityAt: thread ? ago(Math.max(0, thread.startedAgo - thread.turns.length * 3 * 60_000)) : null,
			},
		})
		contactIds.push(t.add('contact', created.id))
	}

	const conversationIds: string[] = []
	for (const [i, thread] of THREADS.entries()) {
		const contact = CONTACTS[thread.contact]
		const channel = channels[contact.channel]
		const start = now - thread.startedAgo
		const last = start + thread.turns.length * 3 * 60_000
		const conversation = await prisma.conversation.create({
			data: {
				workspaceId,
				agentId,
				contactId: contactIds[thread.contact],
				channel,
				externalId: `demo-seed:${workspaceId.slice(-6)}:${i}`,
				status: thread.status,
				handedOff: thread.status === 'HANDED_OFF',
				rating: thread.rating ?? null,
				summary: thread.summary,
				messageCount: thread.turns.length,
				lastMessageAt: new Date(last),
				// Already "reviewed": keeps scheduled quality reviews off sample threads.
				lastImprovementReviewAt: new Date(last + 1000),
				customerInfoState: contact.name ? 'collected' : 'pending',
				identifiedAt: contact.name ? new Date(start) : null,
				createdAt: new Date(start),
			},
		})
		conversationIds.push(t.add('conversation', conversation.id))
		await prisma.message.createMany({
			data: thread.turns.map(([who, content], n) => ({
				conversationId: conversation.id,
				role: who === 'u' ? 'USER' as const : 'ASSISTANT' as const,
				content,
				metadata: who === 'o' ? { operator: true } : undefined,
				createdAt: new Date(start + n * 3 * 60_000),
			})),
		})
		const insight = thread.insight
		await prisma.conversationSalesInsight.create({
			data: {
				workspaceId,
				conversationId: conversation.id,
				leadType: insight.leadType as Prisma.ConversationSalesInsightCreateInput['leadType'],
				stage: insight.stage as Prisma.ConversationSalesInsightCreateInput['stage'],
				buyerReadiness: insight.readiness as Prisma.ConversationSalesInsightCreateInput['buyerReadiness'],
				buyerProbability: insight.probability,
				sentiment: insight.sentiment as Prisma.ConversationSalesInsightCreateInput['sentiment'],
				urgency: insight.urgency as Prisma.ConversationSalesInsightCreateInput['urgency'],
				confidence: 0.82,
				objections: insight.objections ?? [],
				recommendedAction: insight.action,
				explanation: thread.summary,
				handoffRecommended: thread.status === 'HANDED_OFF',
				analyzedMessageCount: thread.turns.length,
				analyzedAt: new Date(last),
			},
		})
		if (thread.status === 'HANDED_OFF') {
			const alert = await prisma.handoffAlert.create({
				data: {
					workspaceId,
					conversationId: conversation.id,
					agentId,
					contactName: contact.name,
					contactPhone: contact.name ? landline(thread.contact) : null,
					channel,
					reason: 'نیاز به تصمیم انسانی',
					summary: thread.summary,
					state: 'open',
					createdAt: new Date(last),
				},
			})
			t.add('handoffAlert', alert.id)
		}
	}

	const notifications: Array<{ type: 'NEW_MESSAGE' | 'HANDOFF' | 'APPOINTMENT' | 'LEARNING' | 'SYSTEM'; title: string; body: string; link: string; read: boolean; ago: number }> = [
		{ type: 'HANDOFF', title: 'گفتگو به اپراتور انسانی منتقل شد', body: 'علی رضایی تخفیف خرید ۵ عددی می‌خواهد.', link: `/conversations/${conversationIds[1]}`, read: false, ago: 3 * HOUR },
		{ type: 'HANDOFF', title: 'گفتگو به اپراتور انسانی منتقل شد', body: 'مهدی کاظمی پیش‌فاکتور رسمی می‌خواهد.', link: `/conversations/${conversationIds[9]}`, read: false, ago: 20 * HOUR },
		{ type: 'NEW_MESSAGE', title: 'پیام تازه از مریم کریمی', body: 'قد ۱۶۵ و وزن ۵۸ هستم، چه سایزی بردارم؟', link: `/conversations/${conversationIds[2]}`, read: false, ago: 40 * 60_000 },
		{ type: 'LEARNING', title: '۲ پیشنهاد بهبود آمادهٔ بررسی است', body: 'ایجنت در دو گفتگو پاسخ دقیقی برای هزینهٔ ارسال نداشت.', link: '/agents', read: true, ago: 2 * DAY },
		{ type: 'SYSTEM', title: 'گزارش هفتگی آماده شد', body: '۱۴ گفتگو، ۸۶٪ حل خودکار.', link: '/analytics', read: true, ago: 5 * DAY },
	]
	for (const n of notifications) {
		const created = await prisma.notification.create({ data: { workspaceId, type: n.type, title: n.title, body: n.body, link: n.link, read: n.read, createdAt: ago(n.ago) } })
		t.add('notification', created.id)
	}
	return { contactIds, conversationIds }
}

/* ── Catalog, bookings, courses, orders (test workspace only) ───────── */

async function seedCatalog(t: ReturnType<typeof tracker>, workspaceId: string, agentId: string, contactIds: string[], conversationIds: string[]) {
	const categoryIds: string[] = []
	for (const [i, name] of CATEGORIES.entries()) {
		const c = await prisma.productCategory.create({ data: { workspaceId, name, slug: `demo-cat-${i}`, sortOrder: i } })
		categoryIds.push(t.add('productCategory', c.id))
	}
	const productIds: string[] = []
	for (const [i, p] of PRODUCTS.entries()) {
		const image = i === 9 ? [] : [await productImage(workspaceId, `p${i}`, p.hue, p.sku.slice(5, 7))]
		const created = await prisma.product.create({
			data: {
				workspaceId, categoryId: categoryIds[p.cat], name: p.name, description: p.desc, price: p.price, comparePrice: p.compare,
				sku: p.sku, stock: p.stock, images: image, attributes: p.attrs, tags: p.tags, active: i !== 11,
				// Marked as already alerted so sample low stock does not ping anyone.
				lowStockAlertedAt: p.stock !== null && p.stock <= 3 ? new Date() : null,
				queryCount: [42, 31, 12, 9, 27, 18, 6, 55, 3, 8, 14, 0][i],
				createdAt: ago((30 - i) * DAY),
			},
		})
		productIds.push(t.add('product', created.id))
		await prisma.agentCatalog.create({ data: { agentId, productId: created.id } })
	}

	// A store connection that is switched off: order rows need a parent, and an
	// inactive integration is never polled.
	const integration = await prisma.storeIntegration.create({
		data: { workspaceId, type: 'WOOCOMMERCE', storeUrl: 'https://demo-store.invalid', credentials: {}, pollIntervalMinutes: 0, active: false, lastSyncStatus: 'ok', lastSyncAt: ago(2 * HOUR), connectedAt: ago(30 * DAY), pluginVersion: '5.0.0' },
	})
	t.add('storeIntegration', integration.id)
	for (const o of ORDERS) {
		const contact = CONTACTS[o.c]
		const created = await prisma.storeOrder.create({
			data: {
				integrationId: integration.id, workspaceId, externalOrderId: o.no, contactId: contactIds[o.c], customerName: contact.name, customerPhone: landline(o.c),
				status: o.status, total: o.total, currency: 'IRT', itemCount: 1, itemsSummary: o.items, paymentMethod: 'درگاه بانکی', shippingMethod: o.courier ?? 'پیک',
				trackingCode: o.track, courierName: o.courier, orderDate: ago(o.ago), updatedAt: ago(Math.max(0, o.ago - DAY)),
			},
		})
		t.add('storeOrder', created.id)
	}

	const drafts = [
		{ conv: 0, c: 0, status: 'PAID', mode: 'PAY_LINK', code: 'DM7K2Q', item: 0, qty: 1, paid: true },
		{ conv: 12, c: 12, status: 'EXPIRED', mode: 'PREORDER', code: 'DM4X8P', item: 4, qty: 1, paid: false },
		{ conv: 3, c: 3, status: 'SUBMITTED', mode: 'PREORDER', code: 'DM9T3L', item: 7, qty: 20, paid: false },
	]
	for (const d of drafts) {
		const product = PRODUCTS[d.item]
		const created = await prisma.orderDraft.create({
			data: {
				workspaceId, agentId, conversationId: conversationIds[d.conv], contactId: contactIds[d.c], channel: 'WEB_WIDGET', code: `${d.code}${workspaceId.slice(-3).toUpperCase()}`,
				status: d.status, checkoutMode: d.mode, customerName: CONTACTS[d.c].name, customerPhone: CONTACTS[d.c].name ? landline(d.c) : null, city: 'تهران',
				items: [{ productId: productIds[d.item], variationId: null, name: product.name, variant: null, quantity: d.qty, unitPrice: product.price, url: null, maxQuantity: product.stock }],
				total: (product.price ?? 0) * d.qty, grandTotal: (product.price ?? 0) * d.qty, submittedAt: ago(DAY), paidAt: d.paid ? ago(25 * DAY) : null, resolvedAt: d.status === 'SUBMITTED' ? null : ago(DAY),
				createdAt: ago(d.paid ? 26 * DAY : 2 * DAY),
			},
		})
		t.add('orderDraft', created.id)
	}
	for (const [n, status] of (['NOTIFIED', 'NEEDS_FOLLOW_UP'] as const).entries()) {
		const created = await prisma.restockAlert.create({
			data: { workspaceId, agentId, conversationId: conversationIds[n === 0 ? 2 : 7], contactId: contactIds[n === 0 ? 2 : 7], channel: 'WEB_WIDGET', productId: productIds[3], productName: PRODUCTS[3].name, variantLabel: n === 0 ? 'سایز ۴۰' : 'سایز ۴۲', dedupeKey: `demo:${workspaceId}:${n}`, status, notifiedAt: n === 0 ? ago(DAY) : null, createdAt: ago(5 * DAY) },
		})
		t.add('restockAlert', created.id)
	}

	const services = [
		{ name: 'مشاورهٔ استایل', minutes: 60, price: 350_000, capacity: 1, location: 'شوروم، طبقهٔ اول', desc: 'یک جلسهٔ حضوری برای انتخاب رنگ و فرم مناسب.' },
		{ name: 'پرو و اندازه‌گیری', minutes: 30, price: null, capacity: 2, location: 'شوروم', desc: 'پرو لباس و ثبت اندازه برای دوخت سفارشی.' },
		{ name: 'دوخت سفارشی (جلسهٔ اول)', minutes: 90, price: 900_000, capacity: 1, location: 'کارگاه', desc: 'انتخاب پارچه و الگو با خیاط.' },
	]
	const serviceIds: string[] = []
	for (const [i, s] of services.entries()) {
		const created = await prisma.service.create({
			data: {
				workspaceId, slug: `demo-service-${i}`, name: s.name, description: s.desc, durationMinutes: s.minutes, slotIntervalMinutes: 30, capacity: s.capacity, location: s.location, price: s.price,
				// Saturday → Thursday, 10:00–18:00 (JS weekdays: Sat=6, Sun=0 … Thu=4).
				weeklyRules: { create: [6, 0, 1, 2, 3, 4].map((weekday) => ({ weekday, startMinute: 600, endMinute: 1080 })) },
			},
		})
		serviceIds.push(t.add('service', created.id))
	}
	const at = (dayOffset: number, hour: number, minute = 0) => {
		const d = new Date(now + dayOffset * DAY)
		d.setUTCHours(hour - 3, minute - 30, 0, 0) // Asia/Tehran is UTC+3:30
		return d
	}
	const appointments: Array<{ s: number; c: number; day: number; hour: number; status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'; source: string; notes?: string }> = [
		{ s: 0, c: 4, day: 3, hour: 17, status: 'CONFIRMED', source: 'agent', notes: 'از گفتگو رزرو شد.' },
		{ s: 1, c: 0, day: 3, hour: 11, status: 'CONFIRMED', source: 'dashboard' },
		{ s: 2, c: 3, day: 4, hour: 14, status: 'PENDING', source: 'agent' },
		{ s: 0, c: 6, day: 5, hour: 10, status: 'CONFIRMED', source: 'dashboard' },
		{ s: 1, c: 10, day: 6, hour: 16, status: 'PENDING', source: 'agent' },
		{ s: 0, c: 1, day: 8, hour: 12, status: 'CONFIRMED', source: 'dashboard' },
		{ s: 0, c: 0, day: -2, hour: 15, status: 'COMPLETED', source: 'agent' },
		{ s: 1, c: 5, day: -4, hour: 11, status: 'NO_SHOW', source: 'agent' },
		{ s: 2, c: 13, day: -6, hour: 13, status: 'CANCELLED', source: 'dashboard', notes: 'مشتری لغو کرد.' },
		{ s: 0, c: 10, day: -9, hour: 17, status: 'COMPLETED', source: 'dashboard' },
	]
	for (const a of appointments) {
		const service = services[a.s]
		const startsAt = at(a.day, a.hour)
		const created = await prisma.appointment.create({
			data: {
				workspaceId, serviceId: serviceIds[a.s],
				// Upcoming bookings carry no contact link, so customer reminders have no thread to post to.
				contactId: a.day > 0 ? null : contactIds[a.c],
				customerName: CONTACTS[a.c].name ?? 'مهمان', customerPhone: landline(a.c), startsAt, endsAt: new Date(startsAt.getTime() + service.minutes * 60_000),
				status: a.status, source: a.source, notes: a.notes, cancelledAt: a.status === 'CANCELLED' ? ago(7 * DAY) : null, createdAt: ago(10 * DAY),
			},
		})
		t.add('appointment', created.id)
	}

	const courses = [
		{ title: 'کارگاه ست‌کردن رنگ‌ها', format: 'IN_PERSON' as const, status: 'PUBLISHED' as const, price: 450_000, capacity: 12, instructor: 'نرگس توکلی', location: 'شوروم، سالن آموزش', sessions: [[6, 10, 13]], enroll: [[8, 'CONFIRMED'], [2, 'PENDING'], [4, 'CONFIRMED'], [11, 'CONFIRMED'], [7, 'PENDING'], [13, 'CANCELLED']] },
		{ title: 'دورهٔ آنلاین استایل شخصی', format: 'ONLINE' as const, status: 'PUBLISHED' as const, price: 1_200_000, capacity: 3, instructor: 'نرگس توکلی', location: null, sessions: [[9, 18, 20], [16, 18, 20], [23, 18, 20]], enroll: [[0, 'CONFIRMED'], [6, 'CONFIRMED'], [10, 'CONFIRMED'], [1, 'WAITLISTED']] },
		{ title: 'کارگاه دوخت مقدماتی', format: 'IN_PERSON' as const, status: 'DRAFT' as const, price: null, capacity: 8, instructor: null, location: 'کارگاه', sessions: [], enroll: [] },
	]
	for (const [i, c] of courses.entries()) {
		const created = await prisma.course.create({
			data: {
				workspaceId, slug: `demo-course-${i}`, title: c.title, description: 'نمونه برای بازبینی طراحی.', instructor: c.instructor, format: c.format, location: c.location, price: c.price, capacity: c.capacity, status: c.status,
				sessions: { create: c.sessions.map(([day, from, to], position) => ({ title: `جلسهٔ ${position + 1}`, startsAt: at(day, from), endsAt: at(day, to), position })) },
				enrollments: {
					create: (c.enroll as Array<[number, 'CONFIRMED' | 'PENDING' | 'WAITLISTED' | 'CANCELLED']>).map(([contact, status]) => ({
						// No conversation link: session reminders have nowhere to post.
						workspaceId, contactId: contactIds[contact], name: CONTACTS[contact].name ?? 'مهمان', phone: landline(contact), status, source: 'agent', cancelledAt: status === 'CANCELLED' ? ago(DAY) : null, createdAt: ago(3 * DAY),
					})),
				},
			},
		})
		t.add('course', created.id)
	}

	const kbs = [
		{ name: 'شرایط ارسال و مرجوعی', type: 'TEXT' as const, text: 'ارسال تهران با پیک در همان روز. شهرستان با پست پیشتاز ۳ تا ۴ روز کاری. تعویض تا ۷ روز.', chunks: 2 },
		{ name: 'سؤالات پرتکرار', type: 'FAQ' as const, text: 'پرداخت در محل؟ فقط تهران.\nخرید عمده؟ بالای ۲۰ عدد.', chunks: 4 },
		{ name: 'کاتالوگ پاییز.pdf', type: 'PDF' as const, text: null, chunks: 18 },
	]
	for (const k of kbs) {
		const created = await prisma.knowledgeBase.create({ data: { agentId, workspaceId, name: k.name, type: k.type, sourceText: k.text, fileName: k.type === 'PDF' ? 'autumn-catalog.pdf' : null, fileSize: k.type === 'PDF' ? 2_480_000 : null, status: 'READY', chunkCount: k.chunks, lastIngestedAt: ago(4 * DAY) } })
		t.add('knowledgeBase', created.id)
	}

	const suggestions = [
		{ kind: 'KNOWLEDGE', topicKey: 'shipping cost by city', title: 'هزینهٔ ارسال شهرستان در دانش ایجنت نیست', diagnosis: 'در دو گفتگو مشتری هزینهٔ ارسال به شهر خودش را پرسید و ایجنت فقط عدد تهران را داشت.', priority: 'HIGH', draft: { question: 'هزینهٔ ارسال به شهرستان چقدر است؟', answer: 'ارسال به شهرستان با پست پیشتاز ۱۲۰ هزار تومان است و ۳ تا ۴ روز کاری زمان می‌برد. خرید بالای ۳ میلیون تومان ارسال رایگان دارد.', missing: '', targetKnowledgeId: null, behaviorPath: null, behaviorValue: null, scope: 'AGENT', contactId: null } },
		{ kind: 'BEHAVIOR', topicKey: 'reply length', title: 'پاسخ‌ها کوتاه‌تر شوند', diagnosis: 'در گفتگوهای پیگیری سفارش، پاسخ‌های چندخطی سرعت مشتری را گرفته است.', priority: 'MEDIUM', draft: { question: '', answer: '', missing: '', targetKnowledgeId: null, behaviorPath: 'format.length', behaviorValue: 'short', scope: 'AGENT', contactId: null } },
	]
	for (const s of suggestions) {
		const created = await prisma.improvementSuggestion.create({ data: { agentId, workspaceId, kind: s.kind, topicKey: s.topicKey, title: s.title, diagnosis: s.diagnosis, priority: s.priority, status: 'PENDING', draft: s.draft, createdAt: ago(2 * DAY) } })
		t.add('improvementSuggestion', created.id)
	}

	// 30 days of reply usage so cost and trend cards have something to draw.
	for (let day = 29; day >= 0; day--) {
		const replies = 3 + ((day * 7) % 9)
		const created = await prisma.usageLog.create({ data: { workspaceId, agentId, date: ago(day * DAY + 5 * HOUR), promptTokens: replies * 1800, completionTokens: replies * 260, model: 'fast', chargedIRR: replies * 4000, status: 'CAPTURED', type: 'CHAT', idempotencyKey: `demo:${workspaceId}:${day}` } })
		t.add('usageLog', created.id)
	}
}

/* ── Commands ───────────────────────────────────────────────────────── */

async function seedTest(ownerPhone?: string) {
	if (await prisma.user.findUnique({ where: { phone: TEST_PHONE } })) throw new Error('Test workspace already exists — run clean-test first.')
	// Prompt layers are copied only from the owner's own agent (never another tenant's).
	const owner = ownerPhone ? await prisma.user.findUnique({ where: { phone: ownerPhone }, select: { workspaceId: true } }) : null
	const template = owner ? await prisma.agent.findFirst({ where: { workspaceId: owner.workspaceId }, orderBy: { createdAt: 'asc' }, select: { promptConfig: true } }) : null
	const t = tracker('test')
	const profile = { businessName: 'بوتیک نمونه', capabilities: ['instagram', 'products', 'bookings', 'services', 'digital-menu', 'courses', 'support'], services: ['فروش و مدیریت محصولات', 'رزرو و نوبت‌دهی', 'دوره و ثبت‌نام'] }

	const workspace = await prisma.workspace.create({
		data: {
			name: 'بوتیک نمونه', slug: 'demo-boutique-review', plan: 'BUSINESS', businessType: 'CUSTOM', businessProfile: profile, onboardingStep: 3, onboardingCompleted: true,
			aiCreditBalanceIRR: 4_000_000, excludeFromAdminReports: true, bookingRemindersEnabled: false, lowStockThreshold: 3,
			subscriptions: { create: { plan: 'BUSINESS', status: 'ACTIVE', monthlyPrice: 59_000_000, currentPeriodEnd: new Date('2099-12-31T23:59:59Z') } },
			owner: { create: { phone: TEST_PHONE, name: 'کاربر آزمایشی' } },
		},
		include: { owner: true },
	})
	t.add('workspace', workspace.id)
	const agent = await prisma.agent.create({
		data: {
			workspaceId: workspace.id, name: 'دستیار بوتیک', description: 'فروش، پیگیری سفارش و نوبت‌دهی بوتیک نمونه', systemPrompt: 'تو دستیار فروش و پشتیبانی «بوتیک نمونه» هستی. فقط از اطلاعات فروشگاه پاسخ بده.',
			promptConfig: (template?.promptConfig ?? undefined) as Prisma.InputJsonValue | undefined, roleTemplate: 'general_recommended', temperature: 0.3, handoffEnabled: true, requireCustomerInfo: false,
			welcomeMessage: 'سلام 🌿 به بوتیک نمونه خوش اومدید. چطور می‌تونم کمکتون کنم؟',
			channels: { create: [{ type: 'WEB_WIDGET', config: { theme: 'light', position: 'right', primaryColor: '#111111', autoGreet: true, quickReplies: [], allowedDomains: [] }, healthStatus: 'ok', lastInboundAt: ago(15 * 60_000) }] },
			chatLink: { create: { workspaceId: workspace.id, slug: 'demo-boutique-review', settings: { displayName: 'بوتیک نمونه', primaryColor: '#111111', showAiBadge: true, quickReplies: [] }, views: 184 } },
		},
	})
	const { contactIds, conversationIds } = await seedCrm(t, workspace.id, agent.id, { INSTAGRAM: 'INSTAGRAM', WEB_WIDGET: 'WEB_WIDGET', CHAT_LINK: 'CHAT_LINK' })
	await seedCatalog(t, workspace.id, agent.id, contactIds, conversationIds)

	// A second, untouched account that still has to go through onboarding.
	const fresh = await prisma.workspace.create({
		data: {
			name: 'کسب‌وکار تازه', slug: 'demo-fresh-review', plan: 'BUSINESS', onboardingStep: 0, onboardingCompleted: false, aiCreditBalanceIRR: 1_000_000, excludeFromAdminReports: true,
			subscriptions: { create: { plan: 'BUSINESS', status: 'ACTIVE', monthlyPrice: 59_000_000, currentPeriodEnd: new Date('2099-12-31T23:59:59Z') } },
			owner: { create: { phone: FRESH_PHONE, name: 'کاربر تازه‌وارد' } },
		},
	})
	t.add('workspace', fresh.id)
	t.save()
	console.log(JSON.stringify({ workspaceId: workspace.id, userId: workspace.owner?.id, agentId: agent.id, freshWorkspaceId: fresh.id }))
}

async function seedMain(phone: string) {
	const user = await prisma.user.findUnique({ where: { phone }, select: { workspaceId: true } })
	if (!user) throw new Error(`No user with phone ${phone}`)
	const scope = `main:${user.workspaceId}`
	if (readManifest()[scope]) throw new Error('Sample rows already exist for this workspace — run clean-main first.')
	const agent = await prisma.agent.findFirst({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
	if (!agent) throw new Error('Workspace has no agent.')
	const t = tracker(scope)
	// Website / chat-link threads only: nothing here can be sent to a connected Instagram or Telegram account.
	await seedCrm(t, user.workspaceId, agent.id, { INSTAGRAM: 'CHAT_LINK', WEB_WIDGET: 'WEB_WIDGET', CHAT_LINK: 'CHAT_LINK' })
	t.save()
	console.log(JSON.stringify({ workspaceId: user.workspaceId, agentId: agent.id }))
}

async function cleanScope(scope: string) {
	const manifest = readManifest()
	const bucket = manifest[scope]
	if (!bucket) { console.log(`nothing recorded for ${scope}`); return }
	const del = async (model: string, run: (ids: string[]) => Promise<{ count: number }>) => {
		const ids = bucket[model]
		if (ids?.length) console.log(model, (await run(ids)).count)
	}
	if (bucket.workspace) {
		// Deleting the workspace cascades to everything inside it.
		for (const id of bucket.workspace) rmSync(path.join(process.cwd(), 'public', 'uploads', 'products', id), { recursive: true, force: true })
		await prisma.appointment.deleteMany({ where: { workspaceId: { in: bucket.workspace } } })
		await del('workspace', (ids) => prisma.workspace.deleteMany({ where: { id: { in: ids } } }))
	} else {
		await del('notification', (ids) => prisma.notification.deleteMany({ where: { id: { in: ids } } }))
		await del('handoffAlert', (ids) => prisma.handoffAlert.deleteMany({ where: { id: { in: ids } } }))
		await del('conversation', (ids) => prisma.conversation.deleteMany({ where: { id: { in: ids } } }))
		await del('contact', (ids) => prisma.contact.deleteMany({ where: { id: { in: ids } } }))
	}
	delete manifest[scope]
	writeManifest(manifest)
}

async function main() {
	const [command, phone] = process.argv.slice(2)
	if (command === 'seed-test') return seedTest(phone)
	if (command === 'clean-test') return cleanScope('test')
	if ((command === 'seed-main' || command === 'clean-main') && phone) {
		if (command === 'seed-main') return seedMain(phone)
		const user = await prisma.user.findUnique({ where: { phone }, select: { workspaceId: true } })
		if (!user) throw new Error(`No user with phone ${phone}`)
		return cleanScope(`main:${user.workspaceId}`)
	}
	console.log('usage: demo-data.ts seed-test | clean-test | seed-main <+98…> | clean-main <+98…>')
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
