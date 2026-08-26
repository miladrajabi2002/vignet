import type { HomeLocale, HomeVariant } from './types'

export type IconName =
	| 'book'
	| 'box'
	| 'messages'
	| 'users'
	| 'store'
	| 'calendar'
	| 'utensils'
	| 'briefcase'
	| 'graduation'
	| 'instagram'
	| 'mic'
	| 'chart'
	| 'handoff'
	| 'spark'
	| 'target'
	| 'plug'

export type ChatScenario = {
	id: string
	label: string
	icon: IconName
	channel: string
	person: string
	/** Sequential chat playback steps for the live demo mock. */
	messages: Array<
		| { kind: 'user'; text: string }
		| { kind: 'agent'; text: string; source?: string }
		| { kind: 'card'; title: string; lines: string[]; badge?: string; image?: string; price?: string; tag?: string }
		| { kind: 'handoff'; text: string; summary: string }
	>
	outcome: string
	/** Modules suggested for this vertical (interactive picker). */
	modules?: string[]
	channels?: string[]
}

type LocalizedCopy = {
	trialBadge: string
	primaryCta: string
	secondaryCta: string
	compareLabel: string
	proofs: string[]
	pillarsEyebrow: string
	pillarsTitle: string
	pillarsSubtitle: string
	pillars: Array<{
		title: string
		description: string
		icon: IconName
		tags: string[]
	}>
	onboardingEyebrow: string
	onboardingTitle: string
	onboardingSubtitle: string
	onboardingSteps: Array<{
		title: string
		description: string
		result: string
		duration: string
	}>
	pricingEyebrow: string
	pricingTitle: string
	pricingSubtitle: string
	pricingTrialTitle: string
	pricingTrialDescription: string
	pricingPlanCta: string
	pricingMonthly: string
	pricingChannels: string
	pricingCredit: string
	pricingAllFeatures: string
	pricingReplyPrice: string
	faqEyebrow: string
	faqTitle: string
	faqs: Array<{ question: string; answer: string }>
	closingEyebrow: string
	closingTitle: string
	closingDescription: string
	scenarios: ChatScenario[]
	verticals: Array<{ id: string; label: string; icon: IconName; hint: string }>
}

export type PillarItem = LocalizedCopy['pillars'][number]
export type OnboardingStepItem = LocalizedCopy['onboardingSteps'][number]
export type VerticalItem = LocalizedCopy['verticals'][number]
export type FaqItem = LocalizedCopy['faqs'][number]

export const COMMON_COPY: Record<HomeLocale, LocalizedCopy> = {
	fa: {
		trialBadge: 'یک ماه استفاده رایگان · بدون نیاز به کارت بانکی',
		primaryCta: 'شروع رایگان — یک ماه',
		secondaryCta: 'دیدن دموی محصول',
		compareLabel: 'نسخه‌های پیشنهادی صفحهٔ اصلی',
		proofs: [
			'راه‌اندازی بدون کدنویسی',
			'اتوماسیون ثابت اینستاگرام رایگان',
			'کسر اعتبار فقط بعد از پاسخ موفق AI',
			'تحویل گفتگو به انسان با خلاصه کامل',
			'درک پیام صوتی فارسی',
			'همهٔ کانال‌ها در یک صندوق گفتگو',
			'رزرو بدون تداخل زمانی',
			'همگام‌سازی محصول و سفارش ووکامرس',
		],
		pillarsEyebrow: 'یک سیستم، نه چند ابزار پراکنده',
		pillarsTitle: 'از اولین پیام مشتری تا نتیجه‌ای که در کسب‌وکار ثبت می‌شود',
		pillarsSubtitle:
			'ویجنت فقط جواب نمی‌دهد؛ دانش، محصول، رزرو، مشتری و کار تیم را در یک جریان قابل‌کنترل به هم وصل می‌کند.',
		pillars: [
			{
				title: 'ایجنت یادگیرنده، از اطلاعات خودتان',
				description:
					'فایل PDF، آدرس سایت، پرسش‌های پرتکرار و کاتالوگ محصول منبع پاسخ‌اند. هر سؤال بی‌پاسخ با پیشنهاد پاسخ در «مرکز یادگیری» ثبت می‌شود و با یک تأیید شما، برای همیشه یاد گرفته می‌شود.',
				icon: 'book',
				tags: ['پایگاه دانش', 'یادگیری با تأیید', 'به‌روزرسانی خودکار سایت'],
			},
			{
				title: 'فروش، سفارش و رزرو در دل گفتگو',
				description:
					'قیمت و موجودی لحظه‌ای را می‌داند، محصول مرتبط پیشنهاد می‌دهد، وضعیت سفارش را از ووکامرس می‌خواند و زمان خالی تقویم را بدون تداخل رزرو می‌کند.',
				icon: 'box',
				tags: ['ووکامرس', 'کاتالوگ محصول', 'رزرو و نوبت‌دهی'],
			},
			{
				title: 'همهٔ کانال‌ها، یک صندوق گفتگو',
				description:
					'اینستاگرام دایرکت و کامنت، تلگرام، بله، روبیکا، ویجت سایت و لینک چت اختصاصی — همه با همان ایجنت و همان دانش پاسخ می‌گیرند و همه در یک اینباکس قابل پیگیری‌اند.',
				icon: 'messages',
				tags: ['دایرکت و کامنت', 'لینک چت بیویی', 'کمپین هدفمند'],
			},
			{
				title: 'CRM، تیم و تصمیم‌های بهتر',
				description:
					'پروندهٔ مشتری با تمام کانال‌ها یکجا است؛ موارد حساس با خلاصهٔ خودکار به اپراتور می‌رسد (حتی در تلگرام خودتان) و عملکرد در گزارش هفتگی دیده می‌شود.',
				icon: 'users',
				tags: ['CRM یکپارچه', 'تحویل به اپراتور', 'گزارش عملکرد'],
			},
			{
				title: 'اتوماسیون کامل اینستاگرام',
				description:
					'پاسخ خودکار دایرکت، کامنت پست‌ها و منشن استوری با سناریوهای دقیق؛ قیف «کامنت بگذار و فالو کن» برای رشد صفحه — همه بدون مصرف اعتبار AI.',
				icon: 'instagram',
				tags: ['دایرکت · کامنت · استوری', 'قیف فالو', 'بدون اعتبار AI'],
			},
			{
				title: 'درک پیام صوتی فارسی',
				description:
					'مشتری هرجا راحت‌تر است صحبت می‌کند؛ ایجنت پیام صوتی را می‌فهمد و در کانال‌های supported پاسخ صوتی برمی‌گرداند.',
				icon: 'mic',
				tags: ['تبدیل گفتار به متن', 'پاسخ صوتی', 'محاوره‌ای و رسمی'],
			},
			{
				title: 'کنترل کامل روی رفتار ایجنت',
				description:
					'لحن، محدودهٔ پاسخ، قواعد تحویل به انسان و سیاست شناسایی مشتری دست شماست؛ هر پاسخ قابل بازبینی و هر تغییری لحظه‌ای اعمال می‌شود.',
				icon: 'target',
				tags: ['شخصیت و لحن', 'قواعد تحویل', 'بازبینی پاسخ‌ها'],
			},
			{
				title: 'گزارش و تحلیل عملکرد',
				description:
					'نرخ حل گفتگو، رضایت مشتری، توزیع کانال‌ها و هزینهٔ پاسخ‌های AI — همه در یک داشبورد شفاف.',
				icon: 'chart',
				tags: ['نرخ حل گفتگو', 'رضایت مشتری', 'هزینهٔ شفاف'],
			},
		],
		onboardingEyebrow: 'شروع روشن و کوتاه',
		onboardingTitle: 'بعد از ثبت‌نام دقیقاً چه اتفاقی می‌افتد؟',
		onboardingSubtitle:
			'' + 'همه‌چیز با یک شماره موبایل شروع می‌شود؛ هر مرحله چند دقیقه بیشتر نمی‌گیرد و همان لحظه یک خروجی قابل‌دیدن دارد.',
		onboardingSteps: [
			{
				title: 'با شماره موبایل وارد شوید',
				description: 'بدون رمز و فرم طولانی؛ فقط یک کد پیامکی. فضای کاری شما با یک ماه اعتبار رایگان ساخته می‌شود.',
				result: '۳۰ روز فرصت کامل + اعتبار اولیهٔ پاسخ',
				duration: '۳۰ ثانیه',
			},
			{
				title: 'کسب‌وکارتان را معرفی کنید',
				description: 'نوع کسب‌وکار را انتخاب می‌کنید؛ ویجنت مسیر راه‌اندازی، پیشنهادها و قالب ایجنت را متناسب با آن آماده می‌کند.',
				result: 'مسیر پیشنهادی متناسب با کار شما',
				duration: '۱ دقیقه',
			},
			{
				title: 'ایجنت را بسازید',
				description: 'هدف، لحن و محدودهٔ پاسخ‌گویی را مشخص می‌کنید؛ یا توضیح ساده بدهید تا ویجنتو پیش‌نویس شش‌لایه را بسازد.',
				result: 'یک ایجنت آماده برای آزمایش',
				duration: '۲ دقیقه',
			},
			{
				title: 'دانش و محصول را اضافه کنید',
				description: 'فایل و آدرس سایت را می‌دهید یا ووکامرس را وصل می‌کنید تا محصول و سفارش‌ها خودکار همگام شوند.',
				result: 'پاسخ از دادهٔ واقعی شما',
				duration: '۲ دقیقه',
			},
			{
				title: 'یک کانال را وصل کنید',
				description: 'اینستاگرام، تلگرام، بله، روبیکا یا ویجت سایت؛ اولین گفتگوی واقعی در همان داشبورد می‌نشیند.',
				result: 'اولین گفتگوی واقعی، زنده',
				duration: '۱ دقیقه',
			},
		],
		pricingEyebrow: 'شروع بدون ریسک',
		pricingTitle: 'اول یک ماه بسازید و امتحان کنید؛ بعد پلن بخرید',
		pricingSubtitle:
			'اشتراک، هزینهٔ پلتفرم و اتصال‌هاست. اعتبار پاسخ جدا است، منقضی نمی‌شود و فقط بعد از یک پاسخ موفق کم می‌شود.',
		pricingTrialTitle: 'یک ماه تجربهٔ رایگان',
		pricingTrialDescription: 'امکانات اصلی، اعتبار اولیهٔ پاسخ و یک اتصال فعال — بدون کارت بانکی، بدون تعهد.',
		pricingPlanCta: 'انتخاب این پلن',
		pricingMonthly: 'تومان / ماه',
		pricingChannels: 'اتصال فعال',
		pricingCredit: 'تومان اعتبار پاسخ هدیه',
		pricingAllFeatures: 'همهٔ قابلیت‌ها + ایجنت نامحدود',
		pricingReplyPrice: 'تومان به‌ازای هر پاسخ موفق',
		faqEyebrow: 'پاسخ‌های کوتاه و روشن',
		faqTitle: 'قبل از شروع شاید این‌ها را بپرسید',
		faqs: [
			{
				question: 'برای راه‌اندازی به دانش فنی نیاز دارم؟',
				answer:
					'خیر. مسیر شروع برای صاحب کسب‌وکار طراحی شده است: نوع کسب‌وکار را انتخاب می‌کنید، اطلاعات را وارد می‌کنید و کانال را با راهنمای مرحله‌ای متصل می‌کنید. کل راه‌اندازی معمولاً زیر ۱۰ دقیقه است.',
			},
			{
				question: 'اگر ایجنت جواب سؤال را نداند چه می‌شود؟',
				answer:
					'دو کار می‌کند: گفتگو را همراه خلاصهٔ کامل به اپراتور انسانی تحویل می‌دهد و سؤال را با یک پاسخ پیشنهادی در «مرکز یادگیری» ثبت می‌کند. شما تأیید می‌کنید و از آن پس ایجنت آن را می‌داند.',
			},
			{
				question: 'هزینهٔ پاسخ‌های هوش مصنوعی چطور حساب می‌شود؟',
				answer:
					'اشتراک هزینهٔ پلتفرم و اتصال‌هاست. اعتبار پاسخ جدا و پیش‌پرداخت است و فقط پس از یک پاسخ موفق کم می‌شود؛ پاسخ ناموفق هزینه ندارد و اعتبار منقضی نمی‌شود. اتوماسیون ثابت اینستاگرام هم اصلاً اعتبار مصرف نمی‌کند.',
			},
			{
				question: 'کدام کانال‌ها پشتیبانی می‌شوند؟',
				answer:
					'اینستاگرام (دایرکت، کامنت، استوری)، تلگرام، بله، روبیکا، ویجت وب قابل نصب روی هر سایتی و لینک چت اختصاصی برای بیو. افزونهٔ وردپرس/ووکامرس هم محصول و سفارش‌ها را همگام می‌کند.',
			},
			{
				question: 'پیام صوتی فارسی را هم می‌فهمد؟',
				answer:
					'بله؛ مشتری می‌تواند صوت بفرستد و ایجنت با درک محتوای آن پاسخ می‌دهد. لحن پاسخ هم قابل تنظیم است — از محاوره‌ای تا کاملاً رسمی.',
			},
			{
				question: 'دورهٔ رایگان واقعاً یک ماه است؟',
				answer:
					'بله. از اولین ورود ۳۰ روز فرصت دارید با امکانات اصلی، اعتبار اولیهٔ پاسخ و یک اتصال فعال، محصول را روی جریان واقعی خودتان آزمایش کنید.',
			},
		],
		closingEyebrow: 'Vigento AI | هوش مصنوعی ویجنتو',
		closingTitle: 'اولین پاسخ هوشمند کسب‌وکارتان را همین امروز ببینید',
		closingDescription:
			'در یک ماه رایگان، ایجنت را با اطلاعات خودتان بسازید، یک کانال واقعی را وصل کنید و بعد با اطمینان تصمیم بگیرید.',
		scenarios: [
			{
				id: 'store',
				label: 'فروشگاه',
				icon: 'store',
				channel: 'اینستاگرام',
				person: 'سارا',
				messages: [
					{ kind: 'user', text: 'سلام! کت گرامی مشکی موجود هست؟ رنگ‌هاش رو دیدم 🧥' },
					{ kind: 'agent', text: 'سلام سارا عزیز 🌸 بله، کت گرامی مشکی در سایزهای M و L موجود است. قیمتش ۲٬۴۸۰٬۰۰۰ تومانه. کارت محصول رو می‌فرستم:', source: 'کاتالوگ محصول + موجودی ووکامرس' },
					{ kind: 'card', title: 'کت گرامی — مشکی', image: '🧥', price: '۲٬۴۸۰٬۰۰۰ تومان', lines: ['سایز M و L · موجود', 'ارسال از انبار تهران · ۲ تا ۳ روز', 'گارانتی بازگشت ۷ روزه'], badge: 'کاتالوگ' },
					{ kind: 'user', text: 'سایز M برای قد ۱۷۰ چطوره؟' },
					{ kind: 'agent', text: 'برای قد ۱۷۰، سایز M انتخاب خوبیه. راهنمای سایز رو هم برات می‌فرستم 📏', source: 'پایگاه دانش — راهنمای سایز' },
					{ kind: 'user', text: 'عالیه، سفارش میدم 🙏' },
					{ kind: 'agent', text: 'ثبت شد ✅ لینک پرداخت ارسال شد؛ به‌محض پرداخت، سفارش از انبار آماده می‌شه.', source: 'درگاه پرداخت + انبار' },
				],
				outcome: 'سرنخ با برچسب «قصد خرید بالا» در CRM ثبت شد',
				modules: ['کاتالوگ محصول', 'همگام‌سازی ووکامرس', 'پاسخ صوتی', 'کمپین بازگشت مشتری'],
				channels: ['اینستاگرام', 'ویجت سایت', 'تلگرام'],
			},
			{
				id: 'food',
				label: 'سفارش غذا',
				icon: 'utensils',
				channel: 'تلگرام',
				person: 'امیر',
				messages: [
					{ kind: 'user', text: 'سفارش من کی میرسه؟ 🔥' },
					{ kind: 'agent', text: 'سفارش پیتزای خانواده شما آمادهٔ ارساله و حداکثر ۲۵ دقیقهٔ دیگه به دستتون می‌رسه 🛵', source: 'وضعیت سفارش + محدودهٔ ارسال' },
					{ kind: 'user', text: 'ممنون! یه نوشابه هم اضافه کنید' },
					{ kind: 'agent', text: 'ثبت شد ✅ یک بطری نوشابه به سفارش اضافه شد؛ مبلغ جدید:', source: 'وضعیت سفارش' },
					{ kind: 'card', title: 'بروزرسانی سفارش #۲۸۴۱', image: '🍕', price: '۸۹۰٬۰۰۰ تومان', lines: ['پیتزا خانواده + نوشابه', 'زمان تحویل: ۲۵ دقیقه', 'وضعیت: در مسیر ارسال'], badge: 'پیگیری سفارش' },
				],
				outcome: 'درخواست بدون دخالت اپراتور حل شد',
				modules: ['منوی دیجیتال', 'وضعیت سفارش', 'ساعات کاری', 'محدودهٔ ارسال'],
				channels: ['تلگرام', 'اینستاگرام', 'لینک چت'],
			},
			{
				id: 'booking',
				label: 'نوبت‌دهی',
				icon: 'calendar',
				channel: 'ویجت سایت',
				person: 'نگار',
				messages: [
					{ kind: 'user', text: 'سلام، برای جمعه ساعت ۵ بعدازظهر وقت خالی دارید؟' },
					{ kind: 'agent', text: 'سلام! بله، جمعه ساعت ۱۷ خالیه. جلسهٔ مشاوره ۴۵ دقیقه‌ست. برای نهایی‌کردن فقط نام و شمارهٔ موبایل رو بفرست 👇', source: 'تقویم + ظرفیت زنده' },
					{ kind: 'user', text: 'نگار موسوی — ۰۹۱۲۳۴۵۶۷۸۹' },
					{ kind: 'agent', text: 'رزرو شد ✅ جمعه ساعت ۱۷:۰۰ به نام شما ثبت شد. یادآوری یک روز قبل براتون پیام می‌شه.', source: 'ابزار رزرو بدون تداخل' },
					{ kind: 'card', title: 'نوبت ثبت‌شده', image: '📅', price: 'جمعه · ۱۷:۰۰', lines: ['مشاورهٔ اول · ۴۵ دقیقه', 'یادآوری خودکار ارسال می‌شود', 'لغو تا ۲۴ ساعت قبل رایگان'], badge: 'رزرو قطعی' },
				],
				outcome: 'نوبت بدون تداخل ثبت و یادآوری شد',
				modules: ['تقویم و ظرفیت', 'خدمات و مدت‌ها', 'قواعد لغو', 'یادآوری خودکار'],
				channels: ['ویجت سایت', 'تلگرام', 'بله'],
			},
			{
				id: 'service',
				label: 'خدمات',
				icon: 'briefcase',
				channel: 'بله',
				person: 'مهدی',
				messages: [
					{ kind: 'user', text: 'سلام، برای قرارداد سازمانی باید با کارشناس صحبت کنم.' },
					{ kind: 'agent', text: 'حتماً 👔 این مورد رو همراه خلاصهٔ درخواست شما به کارشناس سازمانی منتقل می‌کنم؛ همکارم تا چند دقیقهٔ دیگه ادامه می‌ده.', source: 'قاعدهٔ تحویل به انسان' },
					{ kind: 'handoff', text: 'گفتگو به کارشناس منتقل شد', summary: 'مشتری: مهدی · درخواست قرارداد سازمانی · بودجه اعلام‌نشده · ارجاع: تیم فروش سازمانی' },
					{ kind: 'user', text: 'ممنون از پیگیری سریعتون 🙏' },
				],
				outcome: 'کارشناس بدون پرسیدن دوباره ادامه داد',
				modules: ['قواعد تحویل به انسان', 'خلاصهٔ خودکار گفتگو', 'هشدار تلگرام اپراتور'],
				channels: ['بله', 'تلگرام', 'روبیکا'],
			},
			{
				id: 'education',
				label: 'آموزش',
				icon: 'graduation',
				channel: 'روبیکا',
				person: 'رضا',
				messages: [
					{ kind: 'user', text: 'دورهٔ طراحی سایت پیش‌نیاز داره؟' },
					{ kind: 'agent', text: 'سلام رضا! خیر، دوره از سطح صفر شروع می‌شه و پیش‌نیازی نداره. جلسهٔ اول رایگانه 🎓', source: 'سرفصل دوره + پرسش‌های تأییدشده' },
					{ kind: 'user', text: 'کلاس‌ها آنلاینه یا حضوری؟' },
					{ kind: 'agent', text: 'هر دو! کلاس‌های آنلاین ضبط می‌شن و جلسات پرسش‌وپاسخ حضوری در تهران برگزار می‌شه. سرفصل کامل:', source: 'پایگاه دانش' },
					{ kind: 'card', title: 'دورهٔ طراحی سایت', image: '💻', price: '۱٬۲۰۰٬۰۰۰ تومان', lines: ['۱۲ جلسه · آنلاین + ضبط', 'جلسهٔ اول رایگان', 'شروع از سطح صفر'], badge: 'کارت دوره' },
				],
				outcome: 'علاقه‌مندی دوره در پروندهٔ مشتری ثبت شد',
				modules: ['سرفصل دوره‌ها', 'ثبت‌نام', 'پرسش‌های متداول', 'مرکز یادگیری'],
				channels: ['روبیکا', 'تلگرام', 'ویجت سایت'],
			},
			{
				id: 'instagram',
				label: 'اینستاگرام',
				icon: 'instagram',
				channel: 'اینستاگرام (دایرکت)',
				person: 'نگار',
				messages: [
					{ kind: 'user', text: 'سلام، این مدل رنگ دیگه‌ای هم داره؟' },
					{ kind: 'agent', text: 'سلام نگار! 🌸 این مدل در سه رنگ کرم، سرمه‌ای و صورتی موجوده. عکس‌ها رو این‌جا می‌فرستم:', source: 'کاتالوگ محصول' },
					{ kind: 'card', title: 'شال گردن پشم — بافت', image: '🧣', price: '۹۸۰٬۰۰۰ تومان', lines: ['کرم · سرمه‌ای · صورتی', 'موجود در انبار', 'ارسال از تهران'], badge: 'کاتالوگ' },
					{ kind: 'user', text: 'کرم رو می‌خوام 🙏' },
					{ kind: 'agent', text: 'عالی! لینک پرداخت ارسال شد ✅ موجودی تأیید شد، ارسال از امروز.', source: 'کاتالوگ + درگاه پرداخت' },
				],
				outcome: 'فروش در دایرکت اینستاگرام ثبت شد',
				modules: ['کاتالوگ محصول', 'درگاه پرداخت', 'پاسخ هوشمند دایرکت', 'CRM اینستاگرام'],
				channels: ['اینستاگرام', 'تلگرام', 'ویجت سایت'],
			},
		],
		verticals: [
			{ id: 'commerce', label: 'فروشگاه اینترنتی', icon: 'store', hint: 'کاتالوگ، ووکامرس، پیشنهاد محصول' },
			{ id: 'food', label: 'رستوران و کافه', icon: 'utensils', hint: 'منوی دیجیتال، سفارش، وضعیت ارسال' },
			{ id: 'appointments', label: 'نوبت‌دهی', icon: 'calendar', hint: 'تقویم، رزرو بدون تداخل، یادآوری' },
			{ id: 'services', label: 'خدمات', icon: 'briefcase', hint: 'مشاوره، تحویل به کارشناس' },
			{ id: 'education', label: 'آموزش', icon: 'graduation', hint: 'دوره‌ها، ثبت‌نام، سرفصل‌ها' },
			{ id: 'support', label: 'پشتیبانی', icon: 'messages', hint: 'پایگاه دانش، تیکت، حل خودکار' },
			{ id: 'social', label: 'اینستاگرام', icon: 'instagram', hint: 'دایرکت، کامنت، استوری، قیف فالو' },
			{ id: 'custom', label: 'سفارشی', icon: 'spark', hint: 'هر مدل کسب‌وکاری' },
		],
	},
	en: {
		trialBadge: 'One month free · no card required',
		primaryCta: 'Start free — one month',
		secondaryCta: 'Watch the product demo',
		compareLabel: 'Homepage concepts',
		proofs: [
			'No-code setup',
			'Free deterministic Instagram automation',
			'AI credit only after a successful reply',
			'Human handoff with full context',
			'Persian voice-message understanding',
			'Every channel in one inbox',
			'Conflict-free booking',
			'WooCommerce product and order sync',
		],
		pillarsEyebrow: 'One system, not scattered tools',
		pillarsTitle: 'From the first customer message to an outcome recorded in your business',
		pillarsSubtitle:
			'Vigent connects knowledge, products, bookings, customers and team work in one controllable flow.',
		pillars: [
			{
				title: 'A learning agent grounded in your data',
				description: 'PDFs, your website, approved FAQs and the product catalog ground every answer. Unanswered questions return to the Learning Center with a suggested reply; one approval makes the agent smarter forever.',
				icon: 'book',
				tags: ['Knowledge base', 'Approved learning', 'Auto site refresh'],
			},
			{
				title: 'Sales, orders and booking in chat',
				description: 'Live price and stock, product recommendations, WooCommerce order status and conflict-free calendar booking — all inside the conversation.',
				icon: 'box',
				tags: ['WooCommerce', 'Product catalog', 'Booking'],
			},
			{
				title: 'Every channel, one inbox',
				description: 'Instagram DM and comments, Telegram, Bale, Rubika, your web widget and a dedicated chat link — one agent, one knowledge base, one inbox.',
				icon: 'messages',
				tags: ['DM and comments', 'Bio chat link', 'Targeted campaigns'],
			},
			{
				title: 'CRM, team and better decisions',
				description: 'One customer profile across channels; sensitive cases reach your operator (even in your own Telegram) with an automatic summary, and weekly reports show the outcome.',
				icon: 'users',
				tags: ['Unified CRM', 'Human handoff', 'Performance reports'],
			},
			{
				title: 'Full Instagram automation',
				description: 'Auto-reply for DMs, post comments and story mentions with precise scenarios; a comment-to-follow funnel grows the page — none of it consumes AI credit.',
				icon: 'instagram',
				tags: ['DM · Comment · Story', 'Follow funnel', 'Zero AI credit'],
			},
			{
				title: 'Understands Persian voice notes',
				description: 'Customers speak where it is easiest; the agent understands voice messages and can answer with voice too.',
				icon: 'mic',
				tags: ['Speech to text', 'Voice replies', 'Casual to formal tone'],
			},
			{
				title: 'Full control over agent behavior',
				description: 'Tone, scope, handoff rules and customer identification policy are yours to set; every answer is reviewable and changes apply instantly.',
				icon: 'target',
				tags: ['Persona and tone', 'Handoff rules', 'Answer review'],
			},
			{
				title: 'Reporting and analytics',
				description: 'Resolution rate, customer satisfaction, channel mix and AI reply cost — transparent, in one dashboard.',
				icon: 'chart',
				tags: ['Resolution rate', 'CSAT', 'Transparent cost'],
			},
		],
		onboardingEyebrow: 'A short, clear start',
		onboardingTitle: 'What happens after you sign up?',
		onboardingSubtitle: 'Everything starts with a phone number; each step takes minutes and produces something you can see right away.',
		onboardingSteps: [
			{ title: 'Sign in with your phone', description: 'No passwords, no long forms — one SMS code. Your workspace starts with a full month of free access.', result: '30 full days + starter reply credit', duration: '30 sec' },
			{ title: 'Describe your business', description: 'Pick your business type; Vigent tailors the setup path, suggestions and agent template to it.', result: 'A setup path tailored to you', duration: '1 min' },
			{ title: 'Build your agent', description: 'Set its goal, voice and boundaries — or describe the business and let Vigento draft the six-layer blueprint.', result: 'An agent ready to test', duration: '2 min' },
			{ title: 'Add knowledge and products', description: 'Drop files and your website URL, or connect WooCommerce to sync products and orders automatically.', result: 'Answers grounded in your data', duration: '2 min' },
			{ title: 'Connect one channel', description: 'Instagram, Telegram, Bale, Rubika or the web widget; the first real conversation lands in your dashboard.', result: 'Your first live conversation', duration: '1 min' },
		],
		pricingEyebrow: 'Start without risk',
		pricingTitle: 'Build and test free for a month. Pick a plan when ready.',
		pricingSubtitle: 'The subscription covers the platform and connections. Reply credit is separate, never expires and is deducted only after a successful reply.',
		pricingTrialTitle: 'One month free',
		pricingTrialDescription: 'Core features, starter reply credit and one active connection — no card, no commitment.',
		pricingPlanCta: 'Choose this plan',
		pricingMonthly: 'toman / month',
		pricingChannels: 'active connections',
		pricingCredit: 'toman included reply credit',
		pricingAllFeatures: 'All features + unlimited agents',
		pricingReplyPrice: 'toman per successful reply',
		faqEyebrow: 'Short, clear answers',
		faqTitle: 'Questions you may have before starting',
		faqs: [
			{ question: 'Do I need technical skills?', answer: 'No. The guided flow is made for business owners: pick your business type, add information and connect a channel step by step. Setup usually takes under 10 minutes.' },
			{ question: 'What if the agent does not know an answer?', answer: 'It hands the conversation to a person with a full summary, and logs the question in the Learning Center with a suggested answer. You approve it once — the agent knows it forever.' },
			{ question: 'How is AI usage charged?', answer: 'The subscription covers the platform and connections. Prepaid reply credit is deducted only after a successful reply; failed replies are free and credit never expires. Deterministic Instagram automation uses no credit at all.' },
			{ question: 'Which channels are supported?', answer: 'Instagram (DM, comments, stories), Telegram, Bale, Rubika, a web widget for any site and a dedicated chat-link for your bio. The WordPress/WooCommerce plugin syncs products and orders.' },
			{ question: 'Does it understand Persian voice messages?', answer: 'Yes. Customers can send voice notes and the agent understands and answers them. The tone is configurable — from casual to fully formal.' },
			{ question: 'Is the free period really one month?', answer: 'Yes. Your first sign-in starts 30 days with core features, starter reply credit and one active connection.' },
		],
		closingEyebrow: 'Vigento AI',
		closingTitle: 'See your business answer intelligently today',
		closingDescription: 'Build with your own data, connect one real channel and decide with confidence after a month of hands-on use.',
		scenarios: [
			{
				id: 'store',
				label: 'Commerce',
				icon: 'store',
				channel: 'Instagram',
				person: 'Sara',
				messages: [
					{ kind: 'user', text: 'Hi! Is the Grami jacket available in black? I saw the colors 🧥' },
					{ kind: 'agent', text: 'Hi Sara! Yes — the Grami jacket is in stock in M and L, at 2,480,000 toman. Here is the product card:', source: 'Product catalog + WooCommerce stock' },
					{ kind: 'card', title: 'Grami Jacket — Black', image: '🧥', price: '2,480,000 toman', lines: ['Size M and L · in stock', 'Ships from Tehran · 2–3 days', '7-day return guarantee'], badge: 'Catalog' },
					{ kind: 'user', text: 'Is M right for 170cm?' },
					{ kind: 'agent', text: 'For 170cm, M is a good fit. Sending the size guide too 📏', source: 'Knowledge base — size guide' },
					{ kind: 'user', text: 'Great, I will order it 🙏' },
					{ kind: 'agent', text: 'Done ✅ checkout link sent; the order is prepared from stock as soon as you pay.', source: 'Checkout + warehouse' },
				],
				outcome: 'Lead tagged “high intent” and saved to CRM',
				modules: ['Product catalog', 'WooCommerce sync', 'Voice replies', 'Win-back campaign'],
				channels: ['Instagram', 'Web widget', 'Telegram'],
			},
			{
				id: 'food',
				label: 'Food orders',
				icon: 'utensils',
				channel: 'Telegram',
				person: 'Amir',
				messages: [
					{ kind: 'user', text: 'When does my order arrive? 🔥' },
					{ kind: 'agent', text: 'Your family pizza is out for delivery and arrives within 25 minutes. 🛵', source: 'Order status + delivery zone' },
					{ kind: 'user', text: 'Thanks! Please add a drink too' },
					{ kind: 'agent', text: 'Done ✅ a drink is added to the order; the new total:', source: 'Order status' },
					{ kind: 'card', title: 'Order #2841 updated', image: '🍕', price: '890,000 toman', lines: ['Family pizza + drink', 'ETA: 25 minutes', 'Status: on the way'], badge: 'Order tracking' },
				],
				outcome: 'Resolved without touching an operator',
				modules: ['Digital menu', 'Order status', 'Working hours', 'Delivery zones'],
				channels: ['Telegram', 'Instagram', 'Chat link'],
			},
			{
				id: 'booking',
				label: 'Booking',
				icon: 'calendar',
				channel: 'Web widget',
				person: 'Negar',
				messages: [
					{ kind: 'user', text: 'Hi, is Friday 5pm available?' },
					{ kind: 'agent', text: 'Hi! Yes, Friday 17:00 is open. The consultation runs 45 minutes. Just send your name and phone to confirm 👇', source: 'Calendar + live capacity' },
					{ kind: 'user', text: 'Negar Mousavi — 09123456789' },
					{ kind: 'agent', text: 'Booked ✅ Friday 17:00 is yours. A reminder arrives the day before.', source: 'Conflict-free booking tool' },
					{ kind: 'card', title: 'Appointment confirmed', image: '📅', price: 'Friday · 17:00', lines: ['First consultation · 45 min', 'Automatic reminder scheduled', 'Free cancel up to 24h before'], badge: 'Confirmed' },
				],
				outcome: 'A conflict-free booking with a reminder',
				modules: ['Calendar and capacity', 'Services', 'Cancellation rules', 'Automatic reminders'],
				channels: ['Web widget', 'Telegram', 'Bale'],
			},
			{
				id: 'service',
				label: 'Services',
				icon: 'briefcase',
				channel: 'Bale',
				person: 'Mehdi',
				messages: [
					{ kind: 'user', text: 'Hi, I need to talk to an expert about an enterprise contract.' },
					{ kind: 'agent', text: 'Of course 👔 I am handing this to our enterprise specialist with a summary of your request; they continue in a few minutes.', source: 'Human handoff rule' },
					{ kind: 'handoff', text: 'Conversation handed to specialist', summary: 'Customer: Mehdi · enterprise contract · budget undisclosed · routed: enterprise sales' },
					{ kind: 'user', text: 'Thanks for the fast follow-up 🙏' },
				],
				outcome: 'The specialist continued without asking twice',
				modules: ['Handoff rules', 'Auto summary', 'Operator Telegram alerts'],
				channels: ['Bale', 'Telegram', 'Rubika'],
			},
			{
				id: 'education',
				label: 'Education',
				icon: 'graduation',
				channel: 'Rubika',
				person: 'Reza',
				messages: [
					{ kind: 'user', text: 'Does the web design course need prerequisites?' },
					{ kind: 'agent', text: 'Hi Reza! No — the course starts from zero with no prerequisites, and the first session is free. 🎓', source: 'Syllabus + approved FAQs' },
					{ kind: 'user', text: 'Are classes online or in person?' },
					{ kind: 'agent', text: 'Both! Online sessions are recorded, and Q&A meets in person in Tehran. Full syllabus:', source: 'Knowledge base' },
					{ kind: 'card', title: 'Web Design Course', image: '💻', price: '1,200,000 toman', lines: ['12 sessions · online + recorded', 'First session free', 'Starts from zero'], badge: 'Course card' },
				],
				outcome: 'Course interest saved to the profile',
				modules: ['Course syllabus', 'Enrollment', 'FAQs', 'Learning center'],
				channels: ['Rubika', 'Telegram', 'Web widget'],
			},
			{
				id: 'instagram',
				label: 'Instagram',
				icon: 'instagram',
				channel: 'Instagram (DM)',
				person: 'Negar',
				messages: [
					{ kind: 'user', text: 'Hi, does this model come in other colors?' },
					{ kind: 'agent', text: 'Hi Negar! 🌸 This model comes in cream, navy and pink. Here are the photos:', source: 'Product catalog' },
					{ kind: 'card', title: 'Wool Scarf — Knit', image: '🧣', price: '980,000 toman', lines: ['Cream · Navy · Pink', 'In stock', 'Ships from Tehran'], badge: 'Catalog' },
					{ kind: 'user', text: 'I want the cream one 🙏' },
					{ kind: 'agent', text: 'Great! Checkout link sent ✅ stock confirmed, ships today.', source: 'Catalog + checkout' },
				],
				outcome: 'A DM sale recorded on Instagram',
				modules: ['Product catalog', 'Checkout', 'Intelligent DM replies', 'Instagram CRM'],
				channels: ['Instagram', 'Telegram', 'Web widget'],
			},
		],
		verticals: [
			{ id: 'commerce', label: 'Online store', icon: 'store', hint: 'Catalog, WooCommerce, recommendations' },
			{ id: 'food', label: 'Restaurant & café', icon: 'utensils', hint: 'Digital menu, orders, delivery status' },
			{ id: 'appointments', label: 'Appointments', icon: 'calendar', hint: 'Calendar, conflict-free booking, reminders' },
			{ id: 'services', label: 'Services', icon: 'briefcase', hint: 'Consultation, handoff to experts' },
			{ id: 'education', label: 'Education', icon: 'graduation', hint: 'Courses, enrollment, syllabus' },
			{ id: 'support', label: 'Support', icon: 'messages', hint: 'Knowledge base, tickets, auto resolution' },
			{ id: 'social', label: 'Instagram', icon: 'instagram', hint: 'DM, comments, stories, follow funnel' },
			{ id: 'custom', label: 'Custom', icon: 'spark', hint: 'Any business model' },
		],
	},
}

export const VARIANT_COPY: Record<
	HomeVariant,
	Record<HomeLocale, { kicker: string; title: string; accent: string; subtitle: string }>
> = {
	1: {
		fa: {
			kicker: 'مرکز عملیات زندهٔ مشتری',
			title: 'سفر یک پیام را دنبال کنید:',
			accent: 'از اینستاگرام تا فروش ثبت‌شده',
			subtitle: 'با اسکرول کنید و ببینید یک پیام مشتری چطور از کانال وارد می‌شود، از دانش شما پاسخ می‌گیرد و به نتیجه‌ای واقعی می‌رسد.',
		},
		en: {
			kicker: 'Live customer operations',
			title: 'Follow one message:',
			accent: 'from Instagram to a recorded sale',
			subtitle: 'Scroll to watch a customer message arrive, get answered from your data and turn into a real outcome.',
		},
	},
	2: {
		fa: {
			kicker: 'صفحهٔ محصول ویجنت',
			title: 'یک ایجنت فارسی که',
			accent: 'فروش و پشتیبانی شما را واقعاً انجام می‌دهد',
			subtitle: 'همهٔ کانال‌ها، دانش، محصولات، رزرو و تیم — در یک داشبورد. پایین بروید تا هر قابلیت را زنده ببینید.',
		},
		en: {
			kicker: 'The Vigent product page',
			title: 'One Persian agent that',
			accent: 'actually runs your sales and support',
			subtitle: 'Every channel, knowledge, products, booking and team — in one dashboard. Scroll to see each capability live.',
		},
	},
	3: {
		fa: {
			kicker: 'شروع شخصی‌سازی‌شده در چند دقیقه',
			title: 'نوع کسب‌وکارتان را انتخاب کنید؛',
			accent: 'ویجنت بقیه‌اش را می‌سازد',
			subtitle: 'همین‌جا، بدون ثبت‌نام، ایجنت پیشنهادی و اولین گفتگوی کسب‌وکار خودتان را ببینید — بعد با یک ماه رایگان ادامه دهید.',
		},
		en: {
			kicker: 'A tailored start in minutes',
			title: 'Pick your business type.',
			accent: 'Vigent builds the rest.',
			subtitle: 'Right here, before signing up, see your suggested agent and first conversation — then continue with a full month free.',
		},
	},
	4: {
		fa: {
			kicker: 'Vigento AI | مغز عملیاتی کسب‌وکار',
			title: 'هر تصمیم ایجنت،',
			accent: 'شفاف و قابل ردیابی',
			subtitle: 'مسیر هر پاسخ را ببینید: از کدام منبع خواند، چه ابزاری صدا زد و کی گفتگو را به انسان تحویل داد — بدون جعبه‌سیاه.',
		},
		en: {
			kicker: 'Vigento AI | the operating brain',
			title: 'Every agent decision,',
			accent: 'transparent and traceable',
			subtitle: 'See each answer’s path: which source it read, which tool it called and when it handed off to a human — no black box.',
		},
	},
	5: {
		fa: {
			kicker: 'گالری قابلیت‌های ویجنت',
			title: 'یک پلتفرم،',
			accent: 'هفت ابرقابلیت در یک خط',
			subtitle: 'با اسکرول کنید؛ گالری قابلیت‌ها افقی حرکت می‌کند — از گفتگوی زنده تا گزارش عملکرد.',
		},
		en: {
			kicker: 'The Vigent capability gallery',
			title: 'One platform,',
			accent: 'seven superpowers in one line',
			subtitle: 'Keep scrolling — the capability gallery moves sideways, from live chat to performance reports.',
		},
	},
}
