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

export type ProductScenario = {
	id: string
	label: string
	icon: IconName
	channel: string
	person: string
	message: string
	answer: string
	source: string
	action: string
	outcome: string
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
	faqEyebrow: string
	faqTitle: string
	faqs: Array<{ question: string; answer: string }>
	closingEyebrow: string
	closingTitle: string
	closingDescription: string
	scenarios: ProductScenario[]
}

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
		],
		pillarsEyebrow: 'یک سیستم، نه چند ابزار پراکنده',
		pillarsTitle: 'از اولین پیام مشتری تا نتیجه‌ای که در کسب‌وکار ثبت می‌شود',
		pillarsSubtitle:
			'ویجنت فقط جواب نمی‌دهد؛ دانش، محصول، رزرو، مشتری و کار تیم را در یک جریان قابل‌کنترل به هم وصل می‌کند.',
		pillars: [
			{
				title: 'پاسخ دقیق، از اطلاعات خودتان',
				description:
					'فایل‌ها، سایت، سؤال‌های تأییدشده و قوانین کسب‌وکار شما منبع پاسخ‌اند؛ هر پاسخ قابل بازبینی است.',
				icon: 'book',
				tags: ['پایگاه دانش', 'یادگیری با تأیید', 'درک پیام صوتی فارسی'],
			},
			{
				title: 'فروش، سفارش و رزرو در دل گفتگو',
				description:
					'قیمت و موجودی را می‌داند، محصول پیشنهاد می‌دهد، سفارش را پیگیری می‌کند و زمان خالی را بدون تداخل رزرو می‌کند.',
				icon: 'box',
				tags: ['ووکامرس', 'کاتالوگ محصول', 'رزرو و نوبت‌دهی'],
			},
			{
				title: 'همهٔ کانال‌ها، یک صندوق گفتگو',
				description:
					'اینستاگرام، تلگرام، بله، روبیکا و ویجت سایت با همان ایجنت و همان دانش پاسخ می‌گیرند.',
				icon: 'messages',
				tags: ['دایرکت و کامنت', 'لینک چت اختصاصی', 'کمپین هدفمند'],
			},
			{
				title: 'CRM، تیم و تصمیم‌های بهتر',
				description:
					'پرونده مشتری و نتیجه گفتگو ثبت می‌شود؛ موارد حساس با خلاصه به همکار تحویل می‌شوند و عملکرد در گزارش دیده می‌شود.',
				icon: 'users',
				tags: ['CRM یکپارچه', 'تحویل به اپراتور', 'گزارش عملکرد'],
			},
		],
		onboardingEyebrow: 'شروع روشن و کوتاه',
		onboardingTitle: 'بعد از ثبت‌نام دقیقاً چه اتفاقی می‌افتد؟',
		onboardingSubtitle:
			'ویجنت از همان ابتدا قدم‌به‌قدم همراهتان است؛ هر مرحله یک خروجی قابل‌دیدن دارد و هرجا بخواهید می‌توانید بعداً ادامه دهید.',
		onboardingSteps: [
			{
				title: 'کسب‌وکارتان را معرفی کنید',
				description: 'نوع کسب‌وکار، نام و خدمات اصلی را انتخاب می‌کنید.',
				result: 'مسیر پیشنهادی متناسب با کار شما',
			},
			{
				title: 'ایجنت را بسازید',
				description: 'هدف، لحن و محدوده پاسخ‌گویی ایجنت را مشخص می‌کنید.',
				result: 'یک ایجنت آماده برای آزمایش',
			},
			{
				title: 'دانش و محصول را اضافه کنید',
				description: 'فایل، محصول و سؤال‌های پرتکرار را دستی یا از ووکامرس وارد می‌کنید.',
				result: 'پاسخ از دادهٔ واقعی شما',
			},
			{
				title: 'یک کانال را وصل کنید',
				description: 'اینستاگرام، تلگرام یا ویجت سایت را متصل می‌کنید.',
				result: 'اولین گفتگوی واقعی در یک داشبورد',
			},
		],
		pricingEyebrow: 'شروع بدون ریسک',
		pricingTitle: 'اول بسازید و امتحان کنید؛ بعد پلن مناسب را انتخاب کنید',
		pricingSubtitle:
			'یک ماه فرصت دارید ایجنت، دانش و اولین کانال را با اعتبار اولیهٔ پاسخ راه بیندازید. بعد از آن فقط متناسب با تعداد اتصال‌های فعال رشد کنید.',
		pricingTrialTitle: 'یک ماه تجربهٔ رایگان',
		pricingTrialDescription: 'امکانات اصلی، اعتبار اولیهٔ پاسخ و یک اتصال فعال برای آزمایش واقعی محصول.',
		pricingPlanCta: 'انتخاب این پلن',
		pricingMonthly: 'تومان / ماه',
		pricingChannels: 'اتصال فعال',
		pricingCredit: 'تومان اعتبار پاسخ هدیه',
		pricingAllFeatures: 'همهٔ قابلیت‌های اصلی + ایجنت نامحدود',
		faqEyebrow: 'پاسخ‌های کوتاه و روشن',
		faqTitle: 'قبل از شروع شاید این‌ها را بپرسید',
		faqs: [
			{
				question: 'برای راه‌اندازی به دانش فنی نیاز دارم؟',
				answer:
					'خیر. مسیر شروع برای صاحب کسب‌وکار طراحی شده است: اطلاعات را وارد می‌کنید، ایجنت را می‌سازید و کانال را با راهنمای مرحله‌ای متصل می‌کنید.',
			},
			{
				question: 'اگر ایجنت جواب سؤال را نداند چه می‌شود؟',
				answer:
					'می‌تواند گفتگو را همراه خلاصه به همکار انسانی تحویل دهد و سؤال را برای یادگیری ثبت کند؛ پاسخ جدید فقط با تأیید شما وارد دانش می‌شود.',
			},
			{
				question: 'هزینهٔ پاسخ‌های هوش مصنوعی چطور حساب می‌شود؟',
				answer:
					'اشتراک هزینهٔ پلتفرم و اتصال‌هاست. اعتبار پاسخ جدا و پیش‌پرداخت است و فقط پس از یک پاسخ موفق کم می‌شود؛ پاسخ ناموفق هزینه ندارد.',
			},
			{
				question: 'دورهٔ رایگان واقعاً یک ماه است؟',
				answer:
					'بله. از اولین ورود ۳۰ روز فرصت دارید با امکانات اصلی، اعتبار اولیه و یک اتصال فعال محصول را روی جریان واقعی خودتان آزمایش کنید.',
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
				message: 'رنگ مشکی این مدل موجوده؟',
				answer: 'بله، رنگ مشکی سایز ۴۲ موجود است. لینک خرید را همین‌جا می‌فرستم.',
				source: 'کاتالوگ + موجودی ووکامرس',
				action: 'ارسال کارت محصول و لینک خرید',
				outcome: 'سرنخ و محصول موردعلاقه در CRM ثبت شد',
			},
			{
				id: 'food',
				label: 'سفارش غذا',
				icon: 'utensils',
				channel: 'تلگرام',
				person: 'امیر',
				message: 'سفارشم چه زمانی می‌رسه؟',
				answer: 'سفارش شما آماده ارسال است و حداکثر تا ۳۰ دقیقه دیگر تحویل می‌شود.',
				source: 'وضعیت سفارش + محدوده ارسال',
				action: 'ارسال وضعیت و ادامهٔ پیگیری',
				outcome: 'درخواست بدون نیاز به اپراتور پاسخ داده شد',
			},
			{
				id: 'booking',
				label: 'نوبت‌دهی',
				icon: 'calendar',
				channel: 'ویجت سایت',
				person: 'نگار',
				message: 'برای جمعه ساعت ۵ وقت خالی دارید؟',
				answer: 'بله، ساعت ۵ خالی است. برای نهایی‌شدن فقط نام و شماره تماس را بفرستید.',
				source: 'تقویم + ظرفیت زنده',
				action: 'نگه‌داشتن موقت زمان رزرو',
				outcome: 'نوبت بدون تداخل آماده ثبت شد',
			},
			{
				id: 'service',
				label: 'خدمات',
				icon: 'briefcase',
				channel: 'بله',
				person: 'مهدی',
				message: 'قبل از ثبت سفارش باید با کارشناس صحبت کنم.',
				answer: 'حتماً؛ گفتگو را همراه خلاصه درخواست شما به کارشناس منتقل می‌کنم.',
				source: 'قواعد تحویل به انسان',
				action: 'تحویل هوشمند همراه خلاصه',
				outcome: 'کارشناس بدون پرسیدن دوباره ادامه می‌دهد',
			},
			{
				id: 'education',
				label: 'آموزش',
				icon: 'graduation',
				channel: 'روبیکا',
				person: 'رضا',
				message: 'این دوره پیش‌نیاز برنامه‌نویسی دارد؟',
				answer: 'خیر، دوره از سطح مقدماتی شروع می‌شود و پیش‌نیاز ندارد.',
				source: 'سرفصل دوره + پرسش‌های تأییدشده',
				action: 'ارسال سرفصل و دکمه ثبت‌نام',
				outcome: 'علاقه‌مندی به دوره در پرونده مشتری ثبت شد',
			},
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
		],
		pillarsEyebrow: 'One system, not scattered tools',
		pillarsTitle: 'From the first customer message to an outcome recorded in your business',
		pillarsSubtitle:
			'Vigent connects knowledge, products, bookings, customers and team work in one controllable flow.',
		pillars: [
			{
				title: 'Accurate answers from your own data',
				description: 'Files, websites, approved answers and business rules ground every response.',
				icon: 'book',
				tags: ['Knowledge base', 'Approved learning', 'Persian voice'],
			},
			{
				title: 'Sales, orders and booking in chat',
				description: 'Use live price, stock, product suggestions, order status and conflict-free availability.',
				icon: 'box',
				tags: ['WooCommerce', 'Product catalog', 'Booking'],
			},
			{
				title: 'Every channel in one inbox',
				description: 'Instagram, Telegram, Bale, Rubika and your web widget share one agent and one knowledge base.',
				icon: 'messages',
				tags: ['DM and comments', 'Dedicated chat link', 'Campaigns'],
			},
			{
				title: 'CRM, team and better decisions',
				description: 'Keep customer context, hand sensitive cases to people and see outcomes in reporting.',
				icon: 'users',
				tags: ['Unified CRM', 'Human handoff', 'Performance reports'],
			},
		],
		onboardingEyebrow: 'A short, clear start',
		onboardingTitle: 'What happens after you sign up?',
		onboardingSubtitle: 'Each guided step produces something you can see and test. You can continue later at any point.',
		onboardingSteps: [
			{ title: 'Describe your business', description: 'Choose the business type, name and main services.', result: 'A setup path tailored to you' },
			{ title: 'Build your agent', description: 'Set its goal, voice and response boundaries.', result: 'An agent ready to test' },
			{ title: 'Add knowledge and products', description: 'Bring files, products and FAQs manually or from WooCommerce.', result: 'Answers grounded in your data' },
			{ title: 'Connect one channel', description: 'Connect Instagram, Telegram or the web widget.', result: 'Your first live conversation in one inbox' },
		],
		pricingEyebrow: 'Start without risk',
		pricingTitle: 'Build and test first. Pick the right plan when you are ready.',
		pricingSubtitle: 'Use the core product, initial reply credit and one live connection free for a month.',
		pricingTrialTitle: 'One month free',
		pricingTrialDescription: 'Core features, initial reply credit and one active connection for a real test.',
		pricingPlanCta: 'Choose this plan',
		pricingMonthly: 'toman / month',
		pricingChannels: 'active connections',
		pricingCredit: 'toman included reply credit',
		pricingAllFeatures: 'All core features + unlimited agents',
		faqEyebrow: 'Short, clear answers',
		faqTitle: 'Questions you may have before starting',
		faqs: [
			{ question: 'Do I need technical skills?', answer: 'No. The guided flow is made for business owners: add information, build an agent and connect a channel step by step.' },
			{ question: 'What if the agent does not know an answer?', answer: 'It can hand the conversation to a person with a summary and log the question for learning. New knowledge is added only with your approval.' },
			{ question: 'How is AI usage charged?', answer: 'The subscription covers the platform and connections. Prepaid reply credit is deducted only after a successful AI reply.' },
			{ question: 'Is the free period really one month?', answer: 'Yes. Your first sign-in starts 30 days with core features, starter credit and one active connection.' },
		],
		closingEyebrow: 'Vigento AI',
		closingTitle: 'See your business answer intelligently today',
		closingDescription: 'Build with your own data, connect one real channel and decide with confidence after a month of hands-on use.',
		scenarios: [
			{ id: 'store', label: 'Commerce', icon: 'store', channel: 'Instagram', person: 'Sara', message: 'Is this available in black?', answer: 'Yes. Black in size 42 is in stock, and here is the checkout link.', source: 'Catalog + live WooCommerce stock', action: 'Send product card and checkout link', outcome: 'Lead and product interest saved to CRM' },
			{ id: 'food', label: 'Food orders', icon: 'utensils', channel: 'Telegram', person: 'Amir', message: 'When will my order arrive?', answer: 'It is ready to dispatch and will arrive within 30 minutes.', source: 'Order status + delivery area', action: 'Send status and keep following up', outcome: 'Resolved without a human operator' },
			{ id: 'booking', label: 'Booking', icon: 'calendar', channel: 'Web widget', person: 'Negar', message: 'Is Friday at 5 available?', answer: 'Yes. Send your name and phone number to confirm.', source: 'Calendar + live availability', action: 'Hold the selected time', outcome: 'A conflict-free booking is ready' },
			{ id: 'service', label: 'Services', icon: 'briefcase', channel: 'Bale', person: 'Mehdi', message: 'I need to speak to an expert first.', answer: 'Of course. I will hand this over with a summary of your request.', source: 'Human handoff rules', action: 'Handoff with full context', outcome: 'The teammate continues without asking twice' },
			{ id: 'education', label: 'Education', icon: 'graduation', channel: 'Rubika', person: 'Reza', message: 'Does this course need coding experience?', answer: 'No. It begins at the introductory level and has no prerequisite.', source: 'Syllabus + approved answers', action: 'Send syllabus and enrollment action', outcome: 'Course interest saved to the customer profile' },
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
			title: 'هر پیام مشتری را',
			accent: 'به فروش، رزرو یا پاسخ دقیق تبدیل کنید',
			subtitle: 'یک ایجنت فارسی که همهٔ کانال‌ها را می‌بیند، از اطلاعات واقعی شما پاسخ می‌دهد و نتیجه را تا انتها در CRM ثبت می‌کند.',
		},
		en: {
			kicker: 'Live customer operations',
			title: 'Turn every customer message into',
			accent: 'a sale, a booking or a clear answer',
			subtitle: 'One agent sees every channel, answers from your real business data and records the outcome in CRM.',
		},
	},
	2: {
		fa: {
			kicker: 'از پیام تا نتیجه',
			title: 'یک پیام وارد می‌شود؛',
			accent: 'یک کار واقعی انجام می‌شود',
			subtitle: 'ویجنت مسیر کامل پیام را نشان می‌دهد: ورود از کانال، پیدا کردن منبع، پاسخ، اقدام و ثبت نتیجه — بدون جعبه‌سیاه.',
		},
		en: {
			kicker: 'From message to outcome',
			title: 'A message arrives.',
			accent: 'Real work gets done.',
			subtitle: 'See the whole path: channel, trusted source, answer, action and a recorded outcome — no black box.',
		},
	},
	3: {
		fa: {
			kicker: 'شروع شخصی‌سازی‌شده در چند دقیقه',
			title: 'نوع کسب‌وکارتان را بگویید؛',
			accent: 'ویجنت مسیر شروع را آماده می‌کند',
			subtitle: 'قبل از ثبت‌نام ببینید چه ایجنتی برای شما ساخته می‌شود و بعد همان مسیر را با یک ماه فرصت رایگان ادامه دهید.',
		},
		en: {
			kicker: 'A tailored start in minutes',
			title: 'Tell us how your business works.',
			accent: 'Vigent prepares the starting path.',
			subtitle: 'Preview the agent built for you, then continue that exact setup with a full month free.',
		},
	},
	4: {
		fa: {
			kicker: 'Vigento AI | هوش مصنوعی ویجنتو',
			title: 'همهٔ کانال‌ها؛',
			accent: 'یک مغز عملیاتی قابل‌کنترل',
			subtitle: 'مسیر هر پاسخ را از پیام و منبع تا اقدام و تحویل انسانی دنبال کنید؛ سریع، فارسی و قابل‌بازبینی.',
		},
		en: {
			kicker: 'Vigento AI',
			title: 'Every channel.',
			accent: 'One controllable operating intelligence.',
			subtitle: 'Trace every answer from message and source to action or human handoff — fast, reviewable and built for Persian.',
		},
	},
	5: {
		fa: {
			kicker: 'برای مدل واقعی کسب‌وکار شما',
			title: 'ویجنت متناسب با',
			accent: 'روش فروش و پشتیبانی شما عمل می‌کند',
			subtitle: 'فروشگاه، رستوران، نوبت‌دهی، خدمات یا آموزش؛ یک سناریوی آشنا را انتخاب کنید و همان نتیجه را زنده ببینید.',
		},
		en: {
			kicker: 'Built around how your business works',
			title: 'Vigent adapts to',
			accent: 'the way you sell and support',
			subtitle: 'Commerce, food, booking, services or education — choose a familiar scenario and watch the outcome live.',
		},
	},
}
