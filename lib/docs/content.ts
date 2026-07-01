import {
	BookOpen,
	Rocket,
	Bot,
	Database,
	Package,
	Share2,
	HelpCircle,
	Zap,
	type LucideIcon,
} from 'lucide-react'

export type Locale = 'fa' | 'en'
type T = { fa: string; en: string }

export type DocBlock =
	| { type: 'p'; fa: string; en: string }
	| { type: 'h2'; fa: string; en: string }
	| { type: 'list'; items: T[] }
	| { type: 'steps'; items: T[] }
	| { type: 'code'; code: string; caption?: T }
	| { type: 'callout'; fa: string; en: string }

export interface DocPage {
	slug: string
	icon: LucideIcon
	title: T
	description: T
	blocks: DocBlock[]
}

export const DOCS: DocPage[] = [
	{
		slug: 'introduction',
		icon: BookOpen,
		title: { fa: 'معرفی', en: 'Introduction' },
		description: {
			fa: 'ویجنت چیست و چگونه کار می‌کند',
			en: 'What Vigent is and how it works',
		},
		blocks: [
			{
				type: 'p',
				fa: 'ویجنت یک پلتفرم چندمستأجری برای ساخت ایجنت‌های هوش مصنوعی است؛ ایجنت‌هایی که از داده‌های کسب‌وکار شما پاسخ می‌دهند و در کانال‌های مختلف با مشتریان شما گفتگو می‌کنند.',
				en: 'Vigent is a multi-tenant platform for building AI agents that answer from your own business data and talk to your customers across multiple channels.',
			},
			{
				type: 'h2',
				fa: 'مدل «کلید خودت را بیاور» (BYOK)',
				en: 'Bring Your Own Key (BYOK)',
			},
			{
				type: 'p',
				fa: 'ویجنت از کلید OpenRouter شما برای تمام فراخوانی‌های هوش مصنوعی استفاده می‌کند. یعنی هزینهٔ توکن‌ها مستقیماً از حساب OpenRouter شما کسر می‌شود و ویجنت فقط بابت پلتفرم هزینه می‌گیرد. شما کنترل کامل روی هزینه و مدل‌ها دارید.',
				en: 'Vigent uses your OpenRouter key for every AI call. Token costs are billed directly to your OpenRouter account and Vigent only charges for the platform — so you stay in full control of cost and model choice.',
			},
			{
				type: 'h2',
				fa: 'چه چیزهایی می‌سازید',
				en: 'What you can build',
			},
			{
				type: 'list',
				items: [
					{
						fa: 'ایجنت پشتیبانی که از مستندات شما پاسخ می‌دهد',
						en: 'A support agent that answers from your docs',
					},
					{
						fa: 'ایجنت فروش که محصولات شما را می‌شناسد و پیشنهاد می‌دهد',
						en: 'A sales agent that knows and recommends your products',
					},
					{ fa: 'ویجت چت برای وب‌سایت شما', en: 'A chat widget for your website' },
				],
			},
			{
				type: 'callout',
				fa: 'برای شروع فقط به یک شماره موبایل و یک کلید OpenRouter نیاز دارید.',
				en: 'To get started you only need a phone number and an OpenRouter key.',
			},
		],
	},
	{
		slug: 'getting-started',
		icon: Rocket,
		title: { fa: 'شروع به کار', en: 'Getting started' },
		description: {
			fa: 'ورود، ساخت فضای کاری و افزودن کلید',
			en: 'Sign in, create your workspace, add your key',
		},
		blocks: [
			{ type: 'h2', fa: '۱. ورود با شماره موبایل', en: '1. Sign in with your phone' },
			{
				type: 'p',
				fa: 'ویجنت رمز عبور ندارد. کافی است شماره موبایل خود را وارد کنید تا یک کد تأیید شش‌رقمی دریافت کنید. با اولین ورود، یک فضای کاری (Workspace) به‌طور خودکار برای شما ساخته می‌شود.',
				en: 'Vigent has no passwords. Enter your mobile number to receive a 6-digit verification code. On your first login, a workspace is created for you automatically.',
			},
			{
				type: 'steps',
				items: [
					{
						fa: 'به صفحهٔ ورود بروید و شمارهٔ موبایل خود را وارد کنید',
						en: 'Go to the login page and enter your mobile number',
					},
					{
						fa: 'کد تأیید ارسال‌شده را وارد کنید',
						en: 'Enter the verification code you receive',
					},
					{
						fa: 'در اولین ورود، نام خود را وارد کنید',
						en: 'On first login, enter your name',
					},
				],
			},
			{ type: 'h2', fa: '۲. افزودن کلید OpenRouter', en: '2. Add your OpenRouter key' },
			{
				type: 'p',
				fa: 'برای فعال شدن هوش مصنوعی، باید کلید OpenRouter خود را اضافه کنید. به بخش تنظیمات ← کلیدهای هوش مصنوعی بروید و کلید خود را وارد کنید. کلید شما اعتبارسنجی و به‌صورت رمزنگاری‌شده ذخیره می‌شود و هرگز به‌صورت کامل نمایش داده نمی‌شود.',
				en: 'To power the AI, add your OpenRouter key. Go to Settings → AI Keys and paste your key. It is validated and stored encrypted, and never shown again in full.',
			},
			{
				type: 'callout',
				fa: 'کلید OpenRouter خود را از openrouter.ai دریافت کنید. کلیدها با sk-or- شروع می‌شوند.',
				en: 'Get your OpenRouter key from openrouter.ai. Keys start with sk-or-.',
			},
			{ type: 'h2', fa: '۳. چک‌لیست راه‌اندازی', en: '3. The activation checklist' },
			{
				type: 'p',
				fa: 'پس از ورود، یک چک‌لیست پنج‌مرحله‌ای شما را تا فعال‌سازی کامل ایجنت راهنمایی می‌کند: افزودن کلید، ساخت ایجنت، افزودن دانش یا محصول، اتصال یک کانال و تست ایجنت.',
				en: 'After signing in, a 5-step checklist guides you to a fully activated agent: add your key, create an agent, add knowledge or products, connect a channel, and test your agent.',
			},
		],
	},
	{
		slug: 'agents',
		icon: Bot,
		title: { fa: 'ساخت ایجنت', en: 'Building agents' },
		description: {
			fa: 'ساخت، پیکربندی و تست ایجنت',
			en: 'Create, configure and test an agent',
		},
		blocks: [
			{ type: 'h2', fa: 'ساخت ایجنت', en: 'Create an agent' },
			{
				type: 'p',
				fa: 'به بخش ایجنت‌ها بروید و روی «ایجنت جدید» کلیک کنید. یک راهنمای سه‌مرحله‌ای شما را در ساخت ایجنت همراهی می‌کند.',
				en: 'Go to Agents and click “New agent”. A 3-step wizard walks you through creation.',
			},
			{
				type: 'steps',
				items: [
					{
						fa: 'اطلاعات پایه: نام و توضیح کوتاه ایجنت',
						en: 'Basics: the agent’s name and a short description',
					},
					{
						fa: 'شخصیت: دستورالعمل سیستمی که رفتار ایجنت را تعیین می‌کند',
						en: 'Persona: the system prompt that defines its behaviour',
					},
					{
						fa: 'پیکربندی: مدل، زبان، خلاقیت و طول پاسخ',
						en: 'Config: model, language, creativity and response length',
					},
				],
			},
			{ type: 'h2', fa: 'دستورالعمل سیستمی', en: 'The system prompt' },
			{
				type: 'p',
				fa: 'دستورالعمل سیستمی مهم‌ترین بخش شخصیت ایجنت است. به ایجنت بگویید کیست، چه لحنی داشته باشد و چه کارهایی انجام دهد یا ندهد. می‌توانید از متغیرهایی مانند نام کسب‌وکار استفاده کنید.',
				en: 'The system prompt is the heart of your agent’s persona. Tell it who it is, what tone to use, and what it should or shouldn’t do. You can use variables such as your business name.',
			},
			{
				type: 'code',
				caption: { fa: 'نمونهٔ دستورالعمل', en: 'Example prompt' },
				code: "You are the friendly sales assistant for {{business}}.\nAlways answer politely and concisely.\nIf you don't know an answer, offer to connect the customer to a human.",
			},
			{ type: 'h2', fa: 'تنظیمات مدل', en: 'Model settings' },
			{
				type: 'list',
				items: [
					{
						fa: 'مدل: خالی بگذارید تا مدل پیش‌فرض فضای کاری استفاده شود، یا یک مدل OpenRouter مشخص کنید',
						en: 'Model: leave blank to use the workspace default, or set a specific OpenRouter model',
					},
					{
						fa: 'خلاقیت (Temperature): مقدار کمتر = پاسخ‌های دقیق‌تر و قابل‌پیش‌بینی‌تر',
						en: 'Creativity (temperature): lower = more precise, predictable answers',
					},
					{
						fa: 'حداکثر طول پاسخ: سقف تعداد توکن‌های هر پاسخ',
						en: 'Max response length: the token ceiling per reply',
					},
				],
			},
			{ type: 'h2', fa: 'تست ایجنت', en: 'Test your agent' },
			{
				type: 'p',
				fa: 'در صفحهٔ هر ایجنت یک محیط تست زنده وجود دارد. پیام بفرستید و پاسخ ایجنت را به‌صورت استریم (کلمه‌به‌کلمه) ببینید. این اولین گفتگو، مرحلهٔ پنجم چک‌لیست راه‌اندازی را کامل می‌کند.',
				en: 'Every agent page has a live test playground. Send a message and watch the agent stream its reply word by word. This first conversation completes step 5 of the activation checklist.',
			},
		],
	},
	{
		slug: 'knowledge-base',
		icon: Database,
		title: { fa: 'پایگاه دانش', en: 'Knowledge base' },
		description: {
			fa: 'افزودن داده تا ایجنت از آن پاسخ دهد',
			en: 'Add data so your agent answers from it',
		},
		blocks: [
			{
				type: 'p',
				fa: 'پایگاه دانش به ایجنت اجازه می‌دهد از داده‌های شما پاسخ دهد. هر منبعی که اضافه می‌کنید به قطعات کوچک تقسیم، به بردار تبدیل و در پایگاه دادهٔ برداری ذخیره می‌شود (RAG). هنگام گفتگو، مرتبط‌ترین قطعات بازیابی و به ایجنت داده می‌شوند.',
				en: 'The knowledge base lets your agent answer from your data. Each source you add is split into chunks, embedded into vectors, and stored in a vector database (RAG). During a conversation the most relevant chunks are retrieved and given to the agent.',
			},
			{ type: 'h2', fa: 'انواع منابع', en: 'Source types' },
			{
				type: 'list',
				items: [
					{
						fa: 'متن: متن یا سوال و جواب را مستقیماً جای‌گذاری کنید',
						en: 'Text: paste text or Q&A directly',
					},
					{
						fa: 'لینک: آدرس یک صفحهٔ وب که محتوای آن استخراج می‌شود',
						en: 'URL: a web page whose content is extracted',
					},
					{
						fa: 'فایل: PDF یا CSV (حداکثر ۲۰ مگابایت)',
						en: 'File: PDF or CSV (up to 20MB)',
					},
				],
			},
			{ type: 'h2', fa: 'افزودن دانش', en: 'Adding knowledge' },
			{
				type: 'steps',
				items: [
					{ fa: 'به صفحهٔ ایجنت ← دانش بروید', en: 'Go to the agent → Knowledge' },
					{
						fa: 'نوع منبع را انتخاب کنید (متن، لینک یا فایل)',
						en: 'Pick a source type (text, URL or file)',
					},
					{ fa: 'محتوا را وارد و ذخیره کنید', en: 'Enter the content and save' },
					{
						fa: 'منتظر بمانید تا وضعیت به «آماده» تغییر کند',
						en: 'Wait until the status turns to “Ready”',
					},
				],
			},
			{
				type: 'callout',
				fa: 'پردازش هر منبع چند لحظه طول می‌کشد. وضعیت به‌صورت خودکار به‌روزرسانی می‌شود: در صف ← در حال پردازش ← آماده.',
				en: 'Processing each source takes a moment. The status updates automatically: Queued → Processing → Ready.',
			},
			{
				type: 'p',
				fa: 'برای آپلود فایل، باید فضای ذخیره‌سازی Supabase پیکربندی شده باشد. منابع متنی و لینک بدون آن نیز کار می‌کنند.',
				en: 'File upload requires Supabase Storage to be configured. Text and URL sources work without it.',
			},
		],
	},
	{
		slug: 'products',
		icon: Package,
		title: { fa: 'کاتالوگ محصولات', en: 'Product catalog' },
		description: {
			fa: 'محصولات خود را به ایجنت بشناسانید',
			en: 'Teach your agent about your products',
		},
		blocks: [
			{
				type: 'p',
				fa: 'کاتالوگ محصولات به ایجنت اجازه می‌دهد دربارهٔ قیمت، موجودی، ویژگی‌ها و مقایسهٔ محصولات پاسخ دهد. محصولاتی که به یک ایجنت اختصاص می‌دهید، به‌صورت خودکار به پایگاه دانش آن ایجنت تبدیل می‌شوند.',
				en: 'The product catalog lets your agent answer about pricing, availability, features and comparisons. Products you assign to an agent are automatically embedded into that agent’s knowledge.',
			},
			{ type: 'h2', fa: 'افزودن محصول', en: 'Add a product' },
			{
				type: 'p',
				fa: 'به بخش محصولات بروید و روی «افزودن محصول» کلیک کنید. نام، توضیحات، قیمت، قیمت اصلی (برای نمایش تخفیف)، کد محصول (SKU)، موجودی، دسته‌بندی، تگ‌ها، تصاویر و مشخصات را وارد کنید.',
				en: 'Go to Products and click “Add product”. Fill in name, description, price, original price (to show a discount), SKU, stock, category, tags, images and attributes.',
			},
			{ type: 'h2', fa: 'دسته‌بندی‌ها', en: 'Categories' },
			{
				type: 'p',
				fa: 'در بخش «مدیریت دسته‌ها» می‌توانید دسته‌بندی‌های سلسله‌مراتبی (والد و فرزند) بسازید و محصولات را در آن‌ها سازمان‌دهی کنید.',
				en: 'Under “Manage categories” you can create hierarchical categories (parent and child) and organise products within them.',
			},
			{ type: 'h2', fa: 'اختصاص به ایجنت', en: 'Assign to an agent' },
			{
				type: 'steps',
				items: [
					{ fa: 'به صفحهٔ ایجنت ← محصولات بروید', en: 'Go to the agent → Products' },
					{
						fa: 'محصولاتی که این ایجنت باید بشناسد را انتخاب کنید',
						en: 'Select the products this agent should know about',
					},
					{
						fa: 'ذخیره کنید تا محصولات به دانش ایجنت اضافه شوند',
						en: 'Save to embed them into the agent’s knowledge',
					},
				],
			},
			{
				type: 'callout',
				fa: 'هر بار که محصولی را تغییر دهید، اطلاعات آن برای همهٔ ایجنت‌هایی که آن را می‌شناسند به‌صورت خودکار به‌روزرسانی می‌شود.',
				en: 'Whenever you edit a product, its information is automatically refreshed for every agent that knows about it.',
			},
		],
	},
	{
		slug: 'channels',
		icon: Share2,
		title: { fa: 'کانال‌ها و ویجت وب', en: 'Channels & web widget' },
		description: {
			fa: 'ایجنت را روی سایت خود قرار دهید',
			en: 'Put your agent on your website',
		},
		blocks: [
			{
				type: 'p',
				fa: 'کانال‌ها مشخص می‌کنند که ایجنت کجا با مشتریان گفتگو می‌کند. ویجت وب و کانال‌های پیام‌رسان (تلگرام، واتساپ، اینستاگرام، روبیکا، بله) همگی در دسترس هستند.',
				en: 'Channels define where your agent talks to customers. The web widget and messaging channels (Telegram, WhatsApp, Instagram, Rubika, Bale) are all available.',
			},
			{ type: 'h2', fa: 'فعال‌سازی ویجت وب', en: 'Enable the web widget' },
			{
				type: 'steps',
				items: [
					{ fa: 'به صفحهٔ ایجنت ← کانال‌ها بروید', en: 'Go to the agent → Channels' },
					{
						fa: 'روی «فعال‌سازی» در بخش ویجت وب کلیک کنید',
						en: 'Click “Enable” under Web widget',
					},
					{ fa: 'کد نصب را کپی کنید', en: 'Copy the embed code' },
				],
			},
			{ type: 'h2', fa: 'افزودن به سایت', en: 'Add it to your site' },
			{
				type: 'p',
				fa: 'کد نصب را درست قبل از تگ بستن </body> در صفحات سایت خود قرار دهید. یک دکمهٔ چت در گوشهٔ صفحه ظاهر می‌شود.',
				en: 'Paste the embed code just before the closing </body> tag on your site’s pages. A chat button appears in the corner.',
			},
			{
				type: 'code',
				caption: { fa: 'کد نصب نمونه', en: 'Example embed code' },
				code: '<script src="https://your-domain/widget/loader.js" data-agent-id="YOUR_AGENT_ID"></script>',
			},
			{
				type: 'callout',
				fa: 'فقط ایجنت‌های فعال در ویجت پاسخ می‌دهند. اگر ایجنت را غیرفعال کنید، ویجت نیز پاسخ نمی‌دهد.',
				en: 'Only active agents respond in the widget. If you deactivate an agent, the widget stops responding too.',
			},
		],
	},
	{
		slug: 'caching',
		icon: Zap,
		title: { fa: 'سیستم کش', en: 'Caching system' },
		description: {
			fa: 'نحوه کار کش Redis، چه داده‌هایی کش می‌شوند و چگونه invalidate می‌شود.',
			en: 'How the Redis cache works, what is cached, and how it is invalidated.',
		},
		blocks: [
			{ type: 'h2', fa: 'نمای کلی', en: 'Overview' },
			{
				type: 'p',
				fa: 'ویجنت از PostgreSQL به‌عنوان منبع حقیقت و Redis به‌عنوان لایه کش استفاده می‌کند. هدف کاهش latency و هزینه API برای درخواست‌های پربازدید است. تمام عملیات‌های کش «best-effort» هستند: اگر Redis قطع شود، درخواست‌ها از دیتابیس خوانده می‌شوند و چیزی block نمی‌شود.',
				en: 'Vigent uses PostgreSQL as the source of truth and Redis as the cache layer. The goal is to cut latency and external-API cost for hot reads. All cache operations are best-effort: if Redis is down, requests fall through to the DB and nothing blocks.',
			},
			{ type: 'h2', fa: 'چه چیزهایی کش می‌شوند؟', en: 'What is cached?' },
			{
				type: 'list',
				items: [
					{
						fa: 'کد OTP ورود — TTL کوتاه (دقیقه)، در Redis ذخیره می‌شود.',
						en: 'Login OTP — short TTL (minutes), stored only in Redis.',
					},
					{
						fa: 'شمارنده rate-limit (مثلاً ۲۰ پیام در دقیقه برای ویجت) — در Redis به‌صورت atomic.',
						en: 'Rate-limit counters (e.g. 20 msgs/min for the widget) — atomic in Redis.',
					},
					{
						fa: 'Embedding متن پرسش‌ها — TTL ۷ روز. وقتی کاربر سؤالی می‌پرسد که قبلاً embedding شده، بدون فراخوانی API از کش برمی‌گردد.',
						en: 'Text-question embeddings — 7-day TTL. Repeated questions skip the embedding API entirely.',
					},
					{
						fa: 'پیکربندی عمومی ویجت (نام، رنگ، تم، موقعیت، فونت) — TTL ۶۰ ثانیه. هر پیام جدید این کانفیگ را می‌خواند.',
						en: 'Public widget config (name, color, theme, position, font) — 60s TTL. Read on every chat message.',
					},
				],
			},
			{ type: 'h2', fa: 'روند کار کش ویجت', en: 'Widget config cache flow' },
			{
				type: 'steps',
				items: [
					{
						fa: 'ویجت در مرورگر، /api/widget/{agentId} را GET می‌کند.',
						en: 'The widget browser GETs /api/widget/{agentId}.',
					},
					{
						fa: 'سرور، کلید widget:cfg:{agentId} را از Redis می‌خواند (~۱ms).',
						en: 'Server reads widget:cfg:{agentId} from Redis (~1ms).',
					},
					{
						fa: 'اگر Hit بود: کانفیگ برگردانده می‌شود.',
						en: 'If hit: return config immediately.',
					},
					{
						fa: 'اگر Miss بود: یک کوئری Prisma (۱۰–۳۰ms) اجرا و سپس در Redis با TTL ۶۰ ثانیه ذخیره می‌شود (write-back).',
						en: 'If miss: run a Prisma query (10–30ms), then write-back to Redis with 60s TTL.',
					},
					{
						fa: 'وقتی شما تنظیمات ویجت را در داشبورد ذخیره می‌کنید، کلید کش invalidate می‌شود تا بازدیدکنندگان جدید تنظیمات جدید را ببینند.',
						en: 'When you save widget settings in the dashboard, the cache key is invalidated so new visitors see the change instantly.',
					},
				],
			},
			{
				type: 'h2',
				fa: 'چرا از Postgres کش نمی‌گیریم؟',
				en: 'Why not cache Postgres rows directly?',
			},
			{
				type: 'p',
				fa: 'چون invalidation سخت می‌شود. ما به‌جای کش کردن کل ردیف‌های دیتابیس، فقط داده‌های امن و عمومی (مثل کانفیگ ویجت) را در یک ساختار مشخص کش می‌کنیم و invalidate را در همان‌جایی که write اتفاق می‌افتد (مثلاً web-widget-channel بعد از save) صدا می‌زنیم. این الگو «cache-aside» نام دارد و قابل‌اعتمادترین روش برای سیستم‌های چندنفره است.',
				en: 'Because invalidation gets hard. Instead of caching raw DB rows, we cache only safe public data (like widget config) under a well-defined key, and invalidate at the exact write site (e.g. web-widget-channel after save). This is the "cache-aside" pattern, the most reliable for multi-user systems.',
			},
			{
				type: 'callout',
				fa: 'نکته: اگر Redis قطع شود، ویجنت همچنان کار می‌کند — فقط کمی کندتر. هیچ داده‌ای از بین نمی‌رود چون PostgreSQL منبع اصلی است.',
				en: 'Note: if Redis goes down, Vigent still works — just slightly slower. No data is lost because Postgres remains the source of truth.',
			},
		],
	},
	{
		slug: 'faq',
		icon: HelpCircle,
		title: { fa: 'سوالات متداول', en: 'FAQ' },
		description: {
			fa: 'پاسخ پرسش‌های رایج',
			en: 'Answers to common questions',
		},
		blocks: [
			{
				type: 'h2',
				fa: 'چرا ایجنت من پاسخ نمی‌دهد؟',
				en: 'Why isn’t my agent responding?',
			},
			{
				type: 'p',
				fa: 'مطمئن شوید کلید OpenRouter را در تنظیمات اضافه کرده‌اید و کلید معتبر و دارای اعتبار است. همچنین ایجنت باید فعال باشد.',
				en: 'Make sure you’ve added your OpenRouter key in Settings and that it’s valid and has credit. The agent must also be active.',
			},
			{
				type: 'h2',
				fa: 'هزینهٔ توکن‌ها چگونه محاسبه می‌شود؟',
				en: 'How are token costs charged?',
			},
			{
				type: 'p',
				fa: 'تمام فراخوانی‌های هوش مصنوعی با کلید OpenRouter شما انجام می‌شود، بنابراین هزینهٔ توکن‌ها مستقیماً از حساب OpenRouter شما کسر می‌شود. ویجنت فقط بابت اشتراک پلتفرم هزینه می‌گیرد.',
				en: 'All AI calls use your OpenRouter key, so token costs are billed directly to your OpenRouter account. Vigent only charges for the platform subscription.',
			},
			{
				type: 'h2',
				fa: 'آیا ایجنت به چند زبان پاسخ می‌دهد؟',
				en: 'Does the agent answer in multiple languages?',
			},
			{
				type: 'p',
				fa: 'بله. زبان پیش‌فرض هر ایجنت را در تنظیمات آن انتخاب کنید. کل داشبورد و وب‌سایت نیز بین فارسی و انگلیسی قابل تغییر است.',
				en: 'Yes. Set each agent’s default language in its settings. The entire dashboard and website can also switch between Persian and English.',
			},
			{
				type: 'h2',
				fa: 'داده‌های من کجا ذخیره می‌شوند؟',
				en: 'Where is my data stored?',
			},
			{
				type: 'p',
				fa: 'هر فضای کاری کاملاً ایزوله است و داده‌های آن فقط برای خودش قابل دسترسی است. کلیدهای API به‌صورت رمزنگاری‌شده (AES-256-GCM) ذخیره می‌شوند.',
				en: 'Each workspace is fully isolated and its data is only accessible to itself. API keys are stored encrypted (AES-256-GCM).',
			},
		],
	},
]

export function getDoc(slug: string): DocPage | undefined {
	return DOCS.find((d) => d.slug === slug)
}
