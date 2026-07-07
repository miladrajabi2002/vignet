import {
        BookOpen,
        Rocket,
        Bot,
        Database,
        Package,
        Share2,
        HelpCircle,
        Zap,
        Headset,
        UserCheck,
        ShoppingCart,
        KeyRound,
        Cpu,
        CreditCard,
        MessageCircle,
        Camera,
        Wrench,
        Settings,
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
        | { type: 'image'; src: string; alt: T; caption?: T }

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
                slug: 'why-openrouter',
                icon: KeyRound,
                title: { fa: 'چرا اپن‌روتر؟', en: 'Why OpenRouter?' },
                description: {
                        fa: 'چرا ویجنت از OpenRouter استفاده می‌کند و چطور شارژش کنید',
                        en: 'Why Vigent is built on OpenRouter and how to top it up',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'اپن‌روتر (OpenRouter) یک درگاه واحد برای دسترسی به تمام مدل‌های هوش مصنوعی دنیاست: GPT، Claude، Gemini، DeepSeek، Llama و صدها مدل دیگر — همه با یک کلید و یک حساب. ویجنت به‌جای قفل‌کردن شما روی یک ارائه‌دهنده، از کلید اپن‌روترِ خودتان استفاده می‌کند تا کنترل کامل هزینه و انتخاب مدل دست شما باشد.',
                                en: 'OpenRouter is a single gateway to virtually every AI model — GPT, Claude, Gemini, DeepSeek, Llama and hundreds more — behind one key and one account. Instead of locking you into a single provider, Vigent uses your own OpenRouter key so cost and model choice stay in your hands.',
                        },
                        { type: 'h2', fa: 'ارزان‌ترین راه مصرف هوش مصنوعی', en: 'The cheapest way to consume AI' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'پرداخت فقط به‌ازای مصرف — نه اشتراک ماهانه؛ هر توکن با بهترین قیمت بازار.',
                                                en: 'Pure pay-as-you-go — no monthly subscription; every token at the best market price.',
                                        },
                                        {
                                                fa: 'اپن‌روتر هر درخواست را به ارزان‌ترین ارائه‌دهندهٔ همان مدل مسیریابی می‌کند، پس همیشه بهینه‌ترین قیمت را می‌گیرید.',
                                                en: 'OpenRouter routes each request to the cheapest provider serving that model, so you always get the best price automatically.',
                                        },
                                        {
                                                fa: 'مدل‌های اقتصادی مثل DeepSeek کیفیت بالا را با کسری از هزینهٔ مدل‌های پرچم‌دار ارائه می‌دهند.',
                                                en: 'Economy models like DeepSeek deliver high quality at a fraction of flagship pricing.',
                                        },
                                ],
                        },
                        { type: 'h2', fa: 'شارژ با ارز دیجیتال — بدون نیاز به کارت بین‌المللی', en: 'Top up with crypto — no international card needed' },
                        {
                                type: 'p',
                                fa: 'حساب اپن‌روتر را می‌توانید مستقیماً با ارز دیجیتال (USDT، بیت‌کوین، اتریوم و…) شارژ کنید. یعنی برای کاربران ایرانی بدون نیاز به کارت اعتباری خارجی، در چند دقیقه اعتبار هوش مصنوعی دارید.',
                                en: 'You can fund your OpenRouter balance directly with crypto (USDT, BTC, ETH, …) — no international credit card required. For users in Iran this means working AI credit in minutes.',
                        },
                        { type: 'h2', fa: 'مدل‌های رایگان', en: 'Free models' },
                        {
                                type: 'p',
                                fa: 'اپن‌روتر تعدادی مدل کاملاً رایگان هم دارد (پسوند :free). برای شروع و تست ایجنت عالی‌اند، اما محدودیت نرخ دارند: حدود ۲۰ درخواست در دقیقه و ۵۰ درخواست در روز (با شارژ حداقل ۱۰ دلار، سقف روزانه به حدود ۱۰۰۰ درخواست می‌رسد). برای ترافیک واقعی مشتری، مدل‌های اقتصادی پولی مثل DeepSeek V3 را توصیه می‌کنیم.',
                                en: 'OpenRouter also offers fully free models (the :free suffix). They are great for building and testing, but rate-limited: roughly 20 requests/minute and 50 requests/day (about 1,000/day once your account holds $10+ credit). For real customer traffic we recommend cheap paid models like DeepSeek V3.',
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'DeepSeek V3 (رایگان) — بهترین کیفیت بین مدل‌های رایگان، فارسی خوب.',
                                                en: 'DeepSeek V3 (free) — the best quality among free models, good Persian.',
                                        },
                                        {
                                                fa: 'Llama 3.3 70B (رایگان) — چندزبانهٔ قوی برای پاسخ‌های عمومی.',
                                                en: 'Llama 3.3 70B (free) — a strong multilingual generalist.',
                                        },
                                ],
                        },
                        {
                                type: 'callout',
                                fa: 'در ویجنت، مدل‌های رایگان در فهرست انتخاب مدلِ ایجنت با برچسب «رایگان» مشخص شده‌اند — برای شروع یکی از همان‌ها را انتخاب کنید.',
                                en: 'In Vigent, free models are tagged "Free" in the agent model picker — pick one of those to get started.',
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
                        {
                                type: 'h2',
                                fa: 'کانال‌های پیام‌رسان چه می‌کنند؟',
                                en: 'What the messenger channels can do',
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'تلگرام و بله: پاسخ متنی، دکمه‌های سؤال پیشنهادی، نمایش «در حال نوشتن»، دریافت و پاسخ صوتی',
                                                en: 'Telegram & Bale: text replies, suggested-question buttons, typing indicator, inbound & outbound voice',
                                        },
                                        {
                                                fa: 'واتساپ: پاسخ متنی + دکمه‌های پاسخ سریع (حداکثر ۳ دکمه)',
                                                en: 'WhatsApp: text replies + quick-reply buttons (max 3)',
                                        },
                                        {
                                                fa: 'اینستاگرام: پاسخ خودکار به دایرکت‌ها با چیپ‌های سؤال پیشنهادی، و پاسخ عمومی خودکار به کامنت پست‌ها و ریلزها',
                                                en: 'Instagram: auto-replies to DMs with suggested-question chips, plus automatic public replies to post/reel comments',
                                        },
                                        {
                                                fa: 'روبیکا: پاسخ متنی و دریافت پیام صوتی',
                                                en: 'Rubika: text replies and inbound voice messages',
                                        },
                                ],
                        },
                        {
                                type: 'h2',
                                fa: 'دکمه‌های سؤال پیشنهادی',
                                en: 'Suggested-question buttons',
                        },
                        {
                                type: 'p',
                                fa: 'در تنظیمات هر کانال (کارت کانال ← تنظیمات کانال) می‌توانید تا ۴ سؤال پرتکرار تعریف کنید. این سؤالات زیر پاسخ‌های ایجنت به‌صورت دکمه ظاهر می‌شوند و مشتری با یک لمس آن‌ها را می‌پرسد — بدون تایپ. در واتساپ حداکثر ۳ دکمه با متن حداکثر ۲۰ کاراکتر نمایش داده می‌شود.',
                                en: 'In each channel\'s settings (channel card → Channel settings) you can define up to 4 common questions. They appear as buttons under the agent\'s replies so customers ask with one tap — no typing. WhatsApp shows at most 3 buttons with 20-character titles.',
                        },
                ],
        },
        {
                slug: 'instagram-connection',
                icon: Camera,
                title: {
                        fa: 'اتصال اینستاگرام به ویجنت (راهنمای گام‌به‌گام)',
                        en: 'Connect Your Instagram Account to Vigent (Step-by-Step Guide)',
                },
                description: {
                        fa: 'راهنمای کامل اتصال اکانت اینستاگرام Business یا Creator به ویجنت برای پاسخ خودکار به دایرکت، کامنت و استوری',
                        en: 'A clear, step-by-step walkthrough for connecting your Instagram Business or Creator account to Vigent',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'ویجنت به دایرکت‌ها، کامنت‌ها و استوری‌های اینستاگرام شما به‌صورت خودکار و در چند ثانیه پاسخ می‌دهد. برای شروع فقط یک‌بار اکانت اینستاگرام خود را وصل کنید.',
                                en: 'Vigent replies to your Instagram DMs, comments, and story mentions automatically, in seconds. To get started, you only need to connect your Instagram account once.',
                        },
                        {
                                type: 'callout',
                                fa: 'برای اتصال فقط روی دکمه «اتصال» بزنید — مستقیم به اینستاگرام می‌روید (نه فیسبوک)، اجازه می‌دهید و تمام. نیازی به ساخت اپ متا یا کپی توکن نیست. ویجنت اپ خود را دارد و شما فقط اجازه دسترسی می‌دهید.',
                                en: 'To connect, just click the “Connect” button — you go directly to Instagram (not Facebook), grant access, and that’s it. No need to create a Meta app or copy any tokens. Vigent already has its own app; you only grant access.',
                        },
                        {
                                type: 'h2',
                                fa: 'قبل از شروع',
                                en: 'Before you begin',
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'برخلاف روش قدیمی، این جریان به هیچ اکانت یا صفحه فیسبوک نیاز ندارد — مستقیم با اکانت اینستاگرام وصل می‌شوید (جریان Instagram Login).',
                                                en: 'Unlike the old flow, this connection does NOT need any Facebook account or Page — you connect directly with your Instagram account (the Instagram Login flow).',
                                        },
                                        {
                                                fa: 'اکانت شما باید از نوع Business یا Creator باشد. اکانت شخصی قابل اتصال نیست. برای تغییر: اپ اینستاگرام ← تنظیمات ← Account type and tools ← Switch to professional account.',
                                                en: 'You’ll need a Business or Creator account. Personal accounts can’t connect. Switch in the Instagram app: Settings → Account type and tools → Switch to professional account.',
                                        },
                                        {
                                                fa: 'اتصال را حتماً در مرورگر انجام دهید، نه داخل اپلیکیشن اینستاگرام. اپ موبایل مسیر ورود را قطع می‌کند.',
                                                en: 'Do the connection in a web browser — not inside the Instagram app. The app intercepts the login flow and breaks the connection.',
                                        },
                                        {
                                                fa: 'در موبایل، لینک را همیشه در مرورگر (مثل Chrome) باز کنید — داخل اپ باز نشود.',
                                                en: 'On mobile, always open the link in a browser (such as Chrome) — never inside the Instagram app.',
                                        },
                                        {
                                                fa: 'توصیه: اتصال را روی دسکتاپ انجام دهید؛ در گوشی ممکن است لینک داخل اپ باز شود و فرآیند قطع شود.',
                                                en: 'Tip: Connecting on a desktop computer is easier than on mobile, where the link may open inside the app and break the flow.',
                                        },
                                ],
                        },
                        {
                                type: 'h2',
                                fa: 'مراحل اتصال',
                                en: 'Steps to connect',
                        },
                        {
                                type: 'p',
                                fa: 'گام ۱ — در پنل ویجنت، به صفحه کانال‌های ایجنت بروید و روی دکمه سیاه «اتصال» بزنید.',
                                en: 'Step 1 — In your Vigent panel, go to the agent channels page and click the black “Connect” button.',
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/2c27c891-051b-4236-ae07-122ba247f362',
                                alt: {
                                        fa: 'دکمه اتصال اینستاگرام در پنل',
                                        en: 'Instagram connect button in the panel',
                                },
                                caption: {
                                        fa: 'صفحه اتصال اینستاگرام با دکمه اتصال',
                                        en: 'Vigent Instagram connect page',
                                },
                        },
                        {
                                type: 'p',
                                fa: 'گام ۲ — (در موبایل) اگر منوی «Open with…» باز شد، یک مرورگر (مثلاً Chrome) را انتخاب کنید و «Just once» را بزنید — اینستاگرام را انتخاب نکنید.',
                                en: 'Step 2 — (Mobile) If an “Open with…” menu appears, pick a browser (e.g. Chrome) and tap “Just once” — do not choose Instagram.',
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/7490adda-d12c-49b5-8757-c36ff6b426fc',
                                alt: { fa: 'انتخاب مرورگر Chrome', en: 'Choosing Chrome browser' },
                        },
                        {
                                type: 'p',
                                fa: 'گام ۳ — در مرورگر، روی «Log in» بزنید (اپ را باز نکنید). ممکن است صفحه‌ای با دکمه «Log in» یا صفحه «Sorry, this page isn’t available» ببینید — در هر دو روی «Log in» بزنید. اگر پاپ‌آپ «Open Instagram app» ظاهر شد، با ✕ آن را ببندید.',
                                en: 'Step 3 — In the browser, tap “Log in” (don’t open the app). You may see a “Log in” button or a “page isn’t available” screen — tap “Log in” on both. Dismiss any “Open Instagram app” pop-up with ✕.',
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/56d0c9fc-d3df-4435-9e74-5c32c1029365',
                                alt: { fa: 'صفحه ورود اینستاگرام', en: 'Instagram login page' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/10a23732-ffd6-437e-a42f-4392aedf4727',
                                alt: { fa: 'بستن پاپ‌آپ باز کردن اپ', en: 'Dismissing the open-app pop-up' },
                        },
                        {
                                type: 'p',
                                fa: 'گام ۴ — نام کاربری و رمز عبور اینستاگرام را وارد کنید و «Log in» بزنید.',
                                en: 'Step 4 — Enter your Instagram username and password, then tap “Log in”.',
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/dd8b18df-2e00-4459-8c4f-a3cf7c594440',
                                alt: { fa: 'فرم ورود اینستاگرام', en: 'Instagram login form' },
                        },
                        {
                                type: 'p',
                                fa: 'گام ۵ — صفحه دسترسی‌ها باز می‌شود و نشان می‌دهد vigent-IG درخواست دسترسی به پروفایل، کامنت‌ها و پیام‌های شما را دارد. روی «Allow» بزنید. همه این دسترسی‌ها برای کارکرد ویجنت ضروری هستند.',
                                en: 'Step 5 — A permissions screen opens showing what vigent-IG is requesting access to (your profile, comments, and messages). Tap “Allow”. All permissions are required.',
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/5235b323-c884-4b04-ac57-94286e91c3aa',
                                alt: { fa: 'اجازه دسترسی به vigent-IG', en: 'Allowing vigent-IG permissions' },
                        },
                        {
                                type: 'p',
                                fa: 'گام ۶ — تمام! به ویجنت برمی‌گردید و تأیید موفقیت را می‌بینید. روی ادامه بزنید — کانال اینستاگرام شما فعال شد و ویجنت به‌صورت خودکار دایرکت، کامنت و استوری‌های شما را مدیریت می‌کند.',
                                en: 'Step 6 — Done! You return to Vigent and see a success confirmation. Click continue — your Instagram channel is live and Vigent now handles your DMs, comments, and stories automatically.',
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/6855cc9a-b165-4543-86d5-bb79c2725817',
                                alt: { fa: 'تأیید اتصال موفق', en: 'Successful connection confirmation' },
                        },
                        {
                                type: 'h2',
                                fa: 'مشکلات رایج اتصال',
                                en: 'Common connection problems',
                        },
                        {
                                type: 'p',
                                fa: 'اگر هنگام یا بعد از اتصال به یکی از این مشکلات برخوردید، راه‌حل هرکدام در صفحه رفع اشکال هست:',
                                en: 'If you hit one of these during or after connecting, find a fix in the troubleshooting guide:',
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'اپلیکیشن اینستاگرام به‌جای مرورگر باز می‌شود.',
                                                en: 'The Instagram app opens instead of a browser.',
                                        },
                                        {
                                                fa: 'خطای «future activity» هنگام اتصال.',
                                                en: 'You get a “future activity” error while connecting.',
                                        },
                                        {
                                                fa: 'بعد از اتصال، پیام‌ها در پنل نمی‌رسند.',
                                                en: 'After connecting, messages don’t arrive in your panel.',
                                        },
                                ],
                        },
                        {
                                type: 'callout',
                                fa: 'راهنمای رفع اشکال کامل را در صفحه «رفع اشکال اتصال اینستاگرام» (slug: instagram-troubleshooting) بخوانید.',
                                en: 'Read the full troubleshooting guide on the “Instagram troubleshooting” page (slug: instagram-troubleshooting).',
                        },
                ],
        },
        {
                slug: 'instagram-troubleshooting',
                icon: Wrench,
                title: {
                        fa: 'رفع اشکال اتصال اینستاگرام به ویجنت',
                        en: 'Troubleshooting Instagram Connection Issues with Vigent',
                },
                description: {
                        fa: 'راه‌حل سه مشکل رایج اتصال اینستاگرام: باز شدن اپ به‌جای مرورگر، خطای future activity، و نرسیدن پیام‌ها بعد از اتصال',
                        en: 'Fixes for the three most common Instagram connection problems',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'اگر هنگام اتصال اینستاگرام یا بلافاصله بعد از آن به مشکلی برخوردید، تقریباً همیشه یکی از سه مورد زیر است. هرکدام راه‌حل ساده‌ای دارد.',
                                en: 'If you hit a problem while connecting Instagram — or right after — it’s almost always one of these three. Each has a simple fix.',
                        },
                        {
                                type: 'h2',
                                fa: '۱) اپلیکیشن اینستاگرام به‌جای مرورگر باز می‌شود',
                                en: '1) The Instagram app opens instead of the browser',
                        },
                        {
                                type: 'p',
                                fa: 'گاهی لینک اتصال به‌جای مرورگر، داخل اپ اینستاگرام باز می‌شود و صفحه‌ای مثل «Sorry, this page isn’t available» یا پروفایل ناموجود می‌بینید. دلیلش این است که اندروید لینک‌های اینستاگرام را به‌صورت پیش‌فرض به اپ می‌سپارد.',
                                en: 'Sometimes the connect link opens inside the Instagram app instead of a browser, and you see a “Sorry, this page isn’t available” or a missing-profile screen. Android sends Instagram links to the app by default.',
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/dbb6754e-3250-4548-a4c5-c891032998f3',
                                alt: { fa: 'صفحه پروفایل ناموجود', en: 'Profile doesn’t exist page' },
                        },
                        {
                                type: 'p',
                                fa: 'برای رفع این مشکل در اندروید، باید باز شدن خودکار لینک‌های اینستاگرام توسط اپ را غیرفعال کنید:',
                                en: 'To fix this on Android, disable Instagram’s automatic link-opening:',
                        },
                        {
                                type: 'steps',
                                items: [
                                        {
                                                fa: 'از بالا Swipe پایین بکشید، روی آیکون چرخ‌دنده (Settings) بزنید.',
                                                en: 'Swipe down from the top and tap the gear (Settings) icon.',
                                        },
                                        {
                                                fa: 'در نوار جستجو «apps» را سرچ کنید و روی Apps بزنید.',
                                                en: 'Search “apps” in the bar and tap Apps.',
                                        },
                                        {
                                                fa: 'در لیست اپ‌ها، Instagram را پیدا کنید.',
                                                en: 'Find Instagram in the app list.',
                                        },
                                        {
                                                fa: 'به بخش Defaults بروید و Set as default را بزنید.',
                                                en: 'Go to Defaults and tap Set as default.',
                                        },
                                        {
                                                fa: 'گزینه Open supported links را خاموش کنید.',
                                                en: 'Turn off “Open supported links”.',
                                        },
                                ],
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/d9760dee-5953-4bd0-a1a4-2bf87b2b06b0',
                                alt: { fa: 'تنظیمات اندروید', en: 'Android settings' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/66210237-bcaf-440b-80f2-e76fc83c4b4b',
                                alt: { fa: 'جستجوی apps', en: 'Searching apps' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/7cad74ab-d08e-4165-808d-465d6765d08a',
                                alt: { fa: 'انتخاب اینستاگرام', en: 'Selecting Instagram' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/b7c643df-d757-45da-bc79-031da3be87ea',
                                alt: { fa: 'تنظیم به‌عنوان پیش‌فرض', en: 'Set as default' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/22c88ee6-c2ce-480d-969c-4a2e2237fe82',
                                alt: { fa: 'خاموش کردن Open supported links', en: 'Turn off Open supported links' },
                        },
                        {
                                type: 'p',
                                fa: 'راه‌حل جایگزین: اتصال را روی دسکتاپ انجام دهید، یا از گوشی‌ای بدون اپ اینستاگرام استفاده کنید، یا از حالت Incognito مرورگر بهره بگیرید. در صورت لزوم می‌توانید اپ را موقتاً حذف و بعد از اتصال دوباره نصب کنید.',
                                en: 'Alternative: connect on a desktop, use a phone without the Instagram app, or open the link in an incognito browser window. You can also temporarily uninstall and reinstall the app after connecting.',
                        },
                        {
                                type: 'h2',
                                fa: '۲) خطای «future activity» هنگام اتصال',
                                en: '2) The “future activity” error',
                        },
                        {
                                type: 'p',
                                fa: 'گاهی متا هنگام اتصال پیامی نشان می‌دهد که می‌گوید باید «future activity» را روشن کنید. در این صورت باید از داخل تنظیمات اینستاگرام این گزینه را فعال کنید.',
                                en: 'Sometimes Meta shows a message during connection asking you to enable “future activity”. You need to turn it on from inside the Instagram app settings.',
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/a58e3075-5312-49a3-a657-9c9d54a209b3',
                                alt: { fa: 'خطای future activity', en: 'Future activity error' },
                        },
                        {
                                type: 'steps',
                                items: [
                                        {
                                                fa: 'در اپ اینستاگرام، به Settings and activity بروید.',
                                                en: 'In the Instagram app, go to Settings and activity.',
                                        },
                                        {
                                                fa: 'روی Accounts Centre بزنید.',
                                                en: 'Tap Accounts Centre.',
                                        },
                                        {
                                                fa: 'به بخش Your information and permissions بروید.',
                                                en: 'Go to Your information and permissions.',
                                        },
                                        {
                                                fa: 'روی Your activity off Meta technologies بزنید.',
                                                en: 'Tap Your activity off Meta technologies.',
                                        },
                                        {
                                                fa: 'روی Manage future activity بزنید و گزینه Connect future activity را انتخاب کنید.',
                                                en: 'Tap Manage future activity and select Connect future activity.',
                                        },
                                ],
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/790d1232-28db-4796-af63-0c2a3f6f4dca',
                                alt: { fa: 'Accounts Centre', en: 'Accounts Centre' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/1ad16238-7cb2-4bfc-a941-de5006200803',
                                alt: { fa: 'Your information and permissions', en: 'Your information and permissions' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/febc511a-0378-4bdb-acaf-58cb3e4cde2e',
                                alt: { fa: 'Your activity off Meta', en: 'Your activity off Meta' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/31ea9359-ddbf-4923-96ec-518058d7c63a',
                                alt: { fa: 'Manage future activity', en: 'Manage future activity' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/bad0ac08-2e4d-4b2e-adf3-868c2124d0d9',
                                alt: { fa: 'روشن کردن Connect future activity', en: 'Connect future activity on' },
                        },
                        {
                                type: 'h2',
                                fa: '۳) پیام‌ها بعد از اتصال نمی‌رسند',
                                en: '3) Messages don’t arrive after connecting',
                        },
                        {
                                type: 'p',
                                fa: 'اگر اتصال با موفقیت انجام شده ولی پیام‌ها در پنل ویجنت نمی‌رسند، باید دو تنظیم را بررسی کنید: دسترسی به پیام‌ها و دسترسی‌های اپ vigent-IG.',
                                en: 'If the connection succeeded but messages aren’t arriving in your Vigent panel, check two settings: message access and the vigent-IG app permissions.',
                        },
                        {
                                type: 'h2',
                                fa: 'بخش اول: روشن کردن دسترسی به پیام‌ها',
                                en: 'Part 1: Enable message access',
                        },
                        {
                                type: 'steps',
                                items: [
                                        {
                                                fa: 'در اپ اینستاگرام، به Settings and activity ← Messages and story replies بروید.',
                                                en: 'In the Instagram app, go to Settings and activity → Messages and story replies.',
                                        },
                                        {
                                                fa: 'روی Message requests بزنید.',
                                                en: 'Tap Message requests.',
                                        },
                                        {
                                                fa: 'گزینه Allow access to messages را روشن کنید و برای Potential connections گزینه Everyone را انتخاب کنید.',
                                                en: 'Turn on “Allow access to messages” and choose “Everyone” for Potential connections.',
                                        },
                                ],
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/3317ca3d-8edc-436c-a835-ad53ffc10882',
                                alt: { fa: 'Messages and story replies', en: 'Messages and story replies' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/d1d09fc2-1087-4fc2-b502-a23cae72ce6a',
                                alt: { fa: 'Message requests', en: 'Message requests' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/d64a1754-21ea-45b5-8a5c-7e10f7230b20',
                                alt: { fa: 'اجازه دسترسی به پیام‌ها', en: 'Allow access to messages' },
                        },
                        {
                                type: 'h2',
                                fa: 'بخش دوم: بررسی دسترسی‌های اپ vigent-IG',
                                en: 'Part 2: Check the vigent-IG app permissions',
                        },
                        {
                                type: 'steps',
                                items: [
                                        {
                                                fa: 'در اپ اینستاگرام، به Settings and activity ← Website permissions بروید.',
                                                en: 'In the Instagram app, go to Settings and activity → Website permissions.',
                                        },
                                        {
                                                fa: 'روی Apps and websites بزنید و به تب Active بروید.',
                                                en: 'Tap Apps and websites and go to the Active tab.',
                                        },
                                        {
                                                fa: 'vigent-IG را پیدا کنید و روی View and Edit بزنید.',
                                                en: 'Find vigent-IG and click View and Edit.',
                                        },
                                        {
                                                fa: 'هر دو گزینه Access your business message information و Access your business comment information را روشن کنید.',
                                                en: 'Enable both “Access your business message information” and “Access your business comment information”.',
                                        },
                                ],
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/5be0dca7-55ad-480c-a4f8-5612201ddc05',
                                alt: { fa: 'Website permissions', en: 'Website permissions' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/7a9731e0-a3e9-484c-9fae-3c3acf29a0de',
                                alt: { fa: 'Apps and websites', en: 'Apps and websites' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/e98d0e82-6ea1-4fb4-b22c-b210b7dc149',
                                alt: { fa: 'vigent-IG در تب Active', en: 'vigent-IG in the Active tab' },
                        },
                        {
                                type: 'image',
                                src: 'https://apigw.vardast.chat/file-server/view/a9e8a55b-50cb-4cc5-a3ff-386610477983',
                                alt: { fa: 'View and Edit دسترسی‌ها', en: 'View and Edit permissions' },
                        },
                        {
                                type: 'callout',
                                fa: 'اگر باز هم پیام نیامد، اکانت را یک‌بار قطع و دوباره وصل کنید.',
                                en: 'If messages still don’t arrive, disconnect and reconnect the account.',
                        },
                ],
        },
        {
                slug: 'meta-app-setup',
                icon: Settings,
                title: {
                        fa: 'راهنمای صفر تا صد تنظیم اپ متا برای ویجنت',
                        en: 'Complete Meta App setup guide for Vigent',
                },
                description: {
                        fa: 'تنظیمات اپ متا برای پلتفرم ویجنت با جریان Instagram Login (Business Login for Instagram): ساخت اپ، افزودن محصول Instagram، App Review، OAuth، وب‌هوک، Data Deletion و واتساپ',
                        en: 'Meta app configuration for the Vigent platform using the Instagram Login flow (Business Login for Instagram): app creation, Instagram product, App Review, OAuth, webhook, data deletion, WhatsApp',
                },
                blocks: [
                        {
                                type: 'callout',
                                fa: 'این راهنما فقط برای تیم ویجنت (مالک اپ متا) است — کاربران نهایی نیازی به این تنظیمات ندارند و فقط دکمه «اتصال» را می‌زنند. ویجنت از جریان «Instagram API with Instagram Login» استفاده می‌کند — همان Business Login for Instagram که در ژوئیه ۲۰۲۴ معرفی شد و روشی است که Vardast و ManyChat هم به کار می‌برند. در این جریان کاربر مستقیم به api.instagram.com می‌رود، نه فیسبوک؛ بدون ورود به فیسبوک و بدون انتخاب صفحه فیسبوک.',
                                en: 'This guide is only for the Vigent team (the Meta app owner). End users don’t need any of this — they just click “Connect”. Vigent uses the “Instagram API with Instagram Login” flow — the Business Login for Instagram introduced in July 2024, which is what Vardast and ManyChat use too. With this flow the user goes directly to api.instagram.com, not Facebook; no Facebook login and no Facebook Page picker.',
                        },
                        {
                                type: 'h2',
                                fa: 'پیش‌نیازها',
                                en: 'Prerequisites',
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'یک اکانت Meta Developer (از developers.facebook.com)',
                                                en: 'A Meta Developer account (from developers.facebook.com)',
                                        },
                                        {
                                                fa: 'یک دامنه با HTTPS (مثلاً vigent.ir)',
                                                en: 'A domain with HTTPS (e.g. vigent.ir)',
                                        },
                                        {
                                                fa: 'سرور با قابلیت دریافت وب‌هوک عمومی',
                                                en: 'A server that can receive public webhooks',
                                        },
                                ],
                        },
                        {
                                type: 'h2',
                                fa: '۱. ساخت اپ',
                                en: '1. Create the app',
                        },
                        {
                                type: 'steps',
                                items: [
                                        {
                                                fa: 'به developers.facebook.com ← My Apps بروید و روی Create App بزنید.',
                                                en: 'Go to developers.facebook.com → My Apps and click Create App.',
                                        },
                                        {
                                                fa: 'نوع اپ را Business انتخاب کنید.',
                                                en: 'Choose the “Business” app type.',
                                        },
                                        {
                                                fa: 'نام اپ را vigent-IG (یا نام برند خود) وارد کنید و ایمیل تماس را بنویسید.',
                                                en: 'Set the app name to vigent-IG (or your brand name) and provide a contact email.',
                                        },
                                        {
                                                fa: 'روی Create App بزنید.',
                                                en: 'Click Create App.',
                                        },
                                ],
                        },
                        {
                                type: 'h2',
                                fa: '۲. افزودن محصول Instagram',
                                en: '2. Add the Instagram product',
                        },
                        {
                                type: 'p',
                                fa: 'در داشبورد اپ، از بخش Add Products، محصول Instagram Platform را پیدا کنید و Set Up را بزنید. سپس در بین گزینه‌ها، «Instagram API with Instagram Login» را انتخاب کنید — نه Facebook Login. این همان جریان Business Login for Instagram است که از ژوئیه ۲۰۲۴ در دسترس است و به کاربر اجازه می‌دهد مستقیم با اکانت اینستاگرام خود وارد شود، بدون اینکه به فیسبوک برود یا صفحه فیسبوک انتخاب کند.',
                                en: 'In the app dashboard, under Add Products, find the Instagram Platform product and click Set Up. Then choose “Instagram API with Instagram Login” — not Facebook Login. This is the Business Login for Instagram flow available since July 2024, which lets the user sign in directly with their Instagram account, without going to Facebook or picking a Facebook Page.',
                        },
                        {
                                type: 'callout',
                                fa: 'مهم: در این جریان هیچ صفحه فیسبوکی (Facebook Page) لازم نیست و کاربر هرگز وارد فیسبوک نمی‌شود. scope‌های pages_show_list و pages_messaging هم دیگر لازم نیستند و نباید درخواست App Review بزنید.',
                                en: 'Important: with this flow no Facebook Page is required and the user never logs into Facebook. The pages_show_list and pages_messaging scopes are no longer needed — do not submit them for App Review.',
                        },
                        {
                                type: 'h2',
                                fa: '۳. تنظیمات Basic',
                                en: '3. Basic settings',
                        },
                        {
                                type: 'list',
                                items: [
                                        { fa: 'Display Name: vigent-IG', en: 'Display Name: vigent-IG' },
                                        { fa: 'App Domains: vigent.ir', en: 'App Domains: vigent.ir' },
                                        {
                                                fa: 'Privacy Policy URL: https://vigent.ir/privacy',
                                                en: 'Privacy Policy URL: https://vigent.ir/privacy',
                                        },
                                        {
                                                fa: 'Terms of Service URL: https://vigent.ir/terms',
                                                en: 'Terms of Service URL: https://vigent.ir/terms',
                                        },
                                        { fa: 'App Icon (1024×1024)', en: 'App Icon (1024×1024)' },
                                ],
                        },
                        {
                                type: 'h2',
                                fa: '۴. تنظیمات OAuth (Instagram Login)',
                                en: '4. OAuth settings (Instagram Login)',
                        },
                        {
                                type: 'p',
                                fa: 'در منوی سمت چپ اپ، به Instagram ← API Setup with Instagram Login بروید. در این صفحه بخش «Valid OAuth Redirect URIs» را پیدا کنید و آدرس زیر را اضافه کنید:',
                                en: 'In the app’s left-hand menu, go to Instagram → API Setup with Instagram Login. Find the “Valid OAuth Redirect URIs” section there and add the following URL:',
                        },
                        {
                                type: 'code',
                                caption: { fa: 'OAuth Redirect URI اینستاگرام', en: 'Instagram OAuth Redirect URI' },
                                code: `https://vigent.ir/api/instagram/oauth/callback`,
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'Deauthorize Callback URL: https://vigent.ir/api/instagram/deauthorize',
                                                en: 'Deauthorize Callback URL: https://vigent.ir/api/instagram/deauthorize',
                                        },
                                        {
                                                fa: 'Data Deletion Request URL: https://vigent.ir/api/instagram/data-deletion',
                                                en: 'Data Deletion Request URL: https://vigent.ir/api/instagram/data-deletion',
                                        },
                                ],
                        },
                        {
                                type: 'callout',
                                fa: 'این آدرس redirect را حتماً زیر Instagram ← API Setup with Instagram Login وارد کنید — نه زیر Facebook Login. اگر اشتباهاً در Facebook Login وارد شده باشد، جریان OAuth اینستاگرام کار نخواهد کرد.',
                                en: 'This redirect URI must be entered under Instagram → API Setup with Instagram Login — not under Facebook Login. If it is mistakenly entered under Facebook Login, the Instagram OAuth flow will not work.',
                        },
                        {
                                type: 'h2',
                                fa: '۵. تنظیمات وب‌هوک (Webhook)',
                                en: '5. Webhook configuration',
                        },
                        {
                                type: 'p',
                                fa: 'وب‌هوک را یک‌بار در اپ تنظیم کنید. Callback URL: https://vigent.ir/api/webhook/instagram — Verify Token: مقدار META_APP_VERIFY_TOKEN که در env تنظیم کرده‌اید. فیلدهای subscribe: messages، messaging_postbacks، feed، story_mention، mentions. در جریان Instagram Login، وقتی کاربر اکانت خود را وصل می‌کند، اکانت اینستاگرام او به‌صورت خودکار به این وب‌هوک subscribe می‌شود — هیچ فراخوانی subscribePageToApp لازم نیست (برخلاف جریان قدیمی فیسبوک).',
                                en: 'Configure the webhook once in the app. Callback URL: https://vigent.ir/api/webhook/instagram — Verify Token: the value of META_APP_VERIFY_TOKEN from your env. Subscribe to fields: messages, messaging_postbacks, feed, story_mention, mentions. With the Instagram Login flow, when the user connects their account, their Instagram account is automatically subscribed to this webhook — no subscribePageToApp call is needed (unlike the old Facebook flow).',
                        },
                        {
                                type: 'h2',
                                fa: '۶. App Review (برای Advanced Access)',
                                en: '6. App Review (for Advanced Access)',
                        },
                        {
                                type: 'p',
                                fa: 'برای اینکه همه کاربران (نه فقط tester) بتوانند اکانت خود را وصل کنند و دایرکت/کامنت بگیرند، باید scope‌های زیر را به Advanced Access ارتقا دهید. توجه کنید که نام scope‌ها از ۲۷ ژانویه ۲۰۲۵ تغییر کرده و نسخه‌های قدیمی (مثل instagram_basic، instagram_manage_messages و instagram_manage_comments) منسوخ شده‌اند — حالا همه با پیشوند instagram_business_ شروع می‌شوند:',
                                en: 'So that all users (not just testers) can connect their account and send/receive DMs and comments, you need to upgrade the following scopes to Advanced Access. Note that the scope names changed on January 27, 2025 — the old names (e.g. instagram_basic, instagram_manage_messages, instagram_manage_comments) are deprecated and now all start with the instagram_business_ prefix:',
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'instagram_business_basic — دسترسی پایه به پروفایل و اطلاعات اکانت',
                                                en: 'instagram_business_basic — basic access to profile and account info',
                                        },
                                        {
                                                fa: 'instagram_business_manage_messages — نیاز به App Review و screencast (خواندن و پاسخ به دایرکت)',
                                                en: 'instagram_business_manage_messages — requires App Review + screencast (read and reply to DMs)',
                                        },
                                        {
                                                fa: 'instagram_business_manage_comments — نیاز به App Review (خواندن و پاسخ به کامنت‌ها)',
                                                en: 'instagram_business_manage_comments — requires App Review (read and reply to comments)',
                                        },
                                ],
                        },
                        {
                                type: 'callout',
                                fa: 'برای هر scope که App Review می‌زنید، باید screencast (ویدئو) ضبط کنید که نشان می‌دهد اپ چطور از آن دسترسی استفاده می‌کند. در توضیحات بنویسید: «کاربر با دکمه Connect اکانت اینستاگرام خود را مستقیم از طریق Instagram Login وصل می‌کند (بدون فیسبوک و بدون صفحه فیسبوک) و اپ پیام‌ها/کامنت‌های او را برای پاسخ خودکار می‌خواند.»',
                                en: 'For each scope submitted for App Review, you must record a screencast video showing how the app uses that permission. In the description, write: “The user clicks Connect to link their Instagram account directly through Instagram Login (no Facebook, no Facebook Page), and the app reads their messages/comments to reply automatically.”',
                        },
                        {
                                type: 'h2',
                                fa: '۷. App Mode: Live',
                                en: '7. App Mode: Live',
                        },
                        {
                                type: 'p',
                                fa: 'بعد از تکمیل App Review و تنظیم Privacy Policy + Data Deletion، اپ را از Development به Live ببرید. تا زمان Live بودن، فقط tester/admin می‌توانند اتصال را تست کنند.',
                                en: 'After completing App Review and setting up Privacy Policy + Data Deletion, switch the app from Development to Live. Until it’s Live, only testers/admins can test the connection.',
                        },
                        {
                                type: 'h2',
                                fa: '۸. Data Deletion Callback',
                                en: '8. Data Deletion Callback',
                        },
                        {
                                type: 'p',
                                fa: 'متا الزام می‌کند که URLی برای حذف داده کاربر تعریف کنید. در App Settings ← Advanced ← Data Deletion Callback URL: https://vigent.ir/api/instagram/data-deletion. این endpoint باید POST با signed_request دریافت کند و یک confirmation code برگرداند. (این endpoint توسط تیم ویجنت پیاده‌سازی می‌شود.)',
                                en: 'Meta requires a URL for user data deletion. In App Settings → Advanced → Data Deletion Callback URL, set https://vigent.ir/api/instagram/data-deletion. This endpoint must receive a POST with signed_request and return a confirmation code. (This endpoint is implemented by the Vigent team.)',
                        },
                        {
                                type: 'h2',
                                fa: '۹. متغیرهای محیطی (env)',
                                en: '9. Environment variables',
                        },
                        {
                                type: 'code',
                                caption: { fa: 'متغیرهای لازم در .env', en: 'Required env vars' },
                                code: `META_APP_ID=1234567890
META_APP_SECRET=abcdef1234567890...
META_APP_VERIFY_TOKEN=your_random_verify_token_string
NEXT_PUBLIC_APP_URL=https://vigent.ir
ENCRYPTION_KEY=<openssl rand -hex 32>`,
                        },
                        {
                                type: 'h2',
                                fa: '۱۰. جزئیات فنی جریان OAuth',
                                en: '10. OAuth flow technical details',
                        },
                        {
                                type: 'p',
                                fa: 'ویجنت از endpointهای رسمی Instagram Login استفاده می‌کند (نه endpointهای فیسبوک):',
                                en: 'Vigent uses the official Instagram Login endpoints (not the Facebook endpoints):',
                        },
                        {
                                type: 'code',
                                caption: { fa: 'Endpointهای Instagram Login', en: 'Instagram Login endpoints' },
                                code: `# 1) Authorize (browser)
GET https://api.instagram.com/oauth/authorize
    ?client_id={META_APP_ID}
    &redirect_uri=https://vigent.ir/api/instagram/oauth/callback
    &scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments
    &response_type=code

# 2) Exchange code for short-lived token
POST https://api.instagram.com/oauth/access_token

# 3) Exchange to long-lived token (60 days)
GET https://graph.instagram.com/access_token
    ?grant_type=ig_exchange_token
    &client_secret={META_APP_SECRET}

# 4) Send a DM (Instagram Messaging API, Messenger Platform format)
POST https://graph.instagram.com/v21.0/me/messages`,
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'تمام فراخوانی‌های Graph به graph.instagram.com می‌روند، نه graph.facebook.com.',
                                                en: 'All Graph API calls go to graph.instagram.com, not graph.facebook.com.',
                                        },
                                        {
                                                fa: 'دایرکت‌ها از طریق Instagram Messaging API با همان فرمت Messenger Platform ارسال می‌شوند (POST /me/messages).',
                                                en: 'DMs are sent via the Instagram Messaging API using the same format as the Messenger Platform (POST /me/messages).',
                                        },
                                        {
                                                fa: 'توکن بلندمدت هر ۶۰ روز یک‌بار باید refresh شود (GET graph.instagram.com/refresh_access_token).',
                                                en: 'The long-lived token must be refreshed every 60 days (GET graph.instagram.com/refresh_access_token).',
                                        },
                                ],
                        },
                        {
                                type: 'h2',
                                fa: '۱۱. واتساپ (WhatsApp Cloud API)',
                                en: '11. WhatsApp (WhatsApp Cloud API)',
                        },
                        {
                                type: 'p',
                                fa: 'واتساپ هم چون محصول متا است، از همان اپ استفاده می‌کند. محصول WhatsApp Business API را به اپ اضافه کنید، شماره تلفن config کنید، و permission‌های whatsapp_business_messaging و whatsapp_business_management را App Review بزنید. Redirect URI واتساپ: https://vigent.ir/api/whatsapp/oauth/callback. (واتساپ از Facebook Login با Embedded Signup استفاده می‌کند — این جریان جدا از Instagram Login است.)',
                                en: 'WhatsApp is also a Meta product, so it uses the same app. Add the WhatsApp Business API product to the app, configure a phone number, and submit whatsapp_business_messaging and whatsapp_business_management for App Review. The WhatsApp redirect URI is https://vigent.ir/api/whatsapp/oauth/callback. (WhatsApp uses Facebook Login with Embedded Signup — this is a separate flow from Instagram Login.)',
                        },
                        {
                                type: 'h2',
                                fa: '۱۲. تست اتصال',
                                en: '12. Test the connection',
                        },
                        {
                                type: 'steps',
                                items: [
                                        {
                                                fa: 'در اپ متا، Roles ← Instagram Testers ← خودتان را اضافه کنید (در حال Development).',
                                                en: 'In the Meta app, go to Roles → Instagram Testers and add yourself (during Development).',
                                        },
                                        {
                                                fa: 'درخواست tester را در اپ اینستاگرام تست خود تأیید کنید (Settings and activity ← Apps and websites).',
                                                en: 'Accept the tester invitation in your test Instagram account (Settings and activity → Apps and websites).',
                                        },
                                        {
                                                fa: 'در پنل ویجنت، دکمه اتصال را بزنید — مستقیم به Instagram Login می‌روید و فرآیند OAuth را طی می‌کنید.',
                                                en: 'In the Vigent panel, click Connect — you go directly to Instagram Login and complete the OAuth flow.',
                                        },
                                        {
                                                fa: 'یک پیام تست بفرستید و در پنل ویجنت ببینید.',
                                                en: 'Send a test message and watch it appear in the Vigent panel.',
                                        },
                                ],
                        },
                        {
                                type: 'callout',
                                fa: 'بعد از Live شدن اپ و تکمیل App Review، testerها دیگر لازم نیستند — هر کاربری می‌تواند وصل شود.',
                                en: 'After the app is Live and App Review is complete, testers are no longer needed — any user can connect.',
                        },
                        {
                                type: 'h2',
                                fa: '۱۳. ویدئوهای آموزشی',
                                en: '13. Tutorial videos',
                        },
                        {
                                type: 'p',
                                fa: 'این ویدئوها برای درک بهتر فرآیند راه‌اندازی مفید هستند:',
                                en: 'These videos are helpful for understanding the setup process:',
                        },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'Instagram Graph API | Setup Tutorial — https://www.youtube.com/watch?v=BuF9g9_QC04',
                                                en: 'Instagram Graph API | Setup Tutorial — https://www.youtube.com/watch?v=BuF9g9_QC04',
                                        },
                                        {
                                                fa: 'Get started with the Messenger API for Instagram — https://www.youtube.com/watch?v=Pi2KxYeGMXo',
                                                en: 'Get started with the Messenger API for Instagram — https://www.youtube.com/watch?v=Pi2KxYeGMXo',
                                        },
                                        {
                                                fa: 'Connect Meta Graph API (Facebook/Instagram) To n8n — https://www.youtube.com/watch?v=6XAErS9Q0oY',
                                                en: 'Connect Meta Graph API (Facebook/Instagram) To n8n — https://www.youtube.com/watch?v=6XAErS9Q0oY',
                                        },
                                ],
                        },
                ],
        },
        {
                slug: 'handoff',
                icon: Headset,
                title: { fa: 'انتقال به اپراتور', en: 'Operator handoff' },
                description: {
                        fa: 'چگونه گفتگو از ایجنت به اپراتور انسانی منتقل می‌شود و چگونه پاسخ دهید.',
                        en: 'How a conversation is escalated from the agent to a human operator and how you reply.',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'وقتی ایجنت نتوانست پاسخ بدهد یا مشتری درخواست اپراتور کرد، گفتگو به‌صورت خودکار (یا دستی) به یک اپراتور انسانی منتقل می‌شود. در این حالت هوش مصنوعی کنار می‌رود تا اپراتور مستقیماً پاسخ دهد.',
                                en: 'When the agent can’t answer or the customer asks for a human, the conversation is escalated (automatically or manually) to a human operator. The AI steps aside so the operator can reply directly.',
                        },
                        { type: 'h2', fa: 'چه زمانی انتقال رخ می‌دهد؟', en: 'When does handoff happen?' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'کلمه کلیدی: اگر پیام مشتری یکی از کلمات کلیدی انتقال (مثلاً «اپراتور»، «پشتیبانی انسانی») را داشته باشد.',
                                                en: 'Keyword match: when the customer’s message contains one of the handoff keywords (e.g. “agent”, “human support”).',
                                        },
                                        {
                                                fa: 'پاسخ‌های متوالی ناموفق: اگر ایجنت سه بار پشت سر هم پاسخ fallback داد (یعنی نتوانست کمک کند).',
                                                en: 'Repeated fallbacks: when the agent has answered with the fallback message three times in a row.',
                                        },
                                        {
                                                fa: 'انتقال دستی: اپراتور در پنل گفتگو روی دکمهٔ «انتقال به اپراتور» کلیک می‌کند.',
                                                en: 'Manual: the operator clicks “Hand off to operator” in the conversation panel.',
                                        },
                                ],
                        },
                        { type: 'h2', fa: 'پیکربندی بات اپراتور تلگرام', en: 'Configure the operator Telegram bot' },
                        {
                                type: 'p',
                                fa: 'برای دریافت هشدارهای انتقال در تلگرام، یک بات با @BotFather بسازید، شماره chat_id خود را از @userinfobot بگیرید و در «تنظیمات ← بات اپراتور تلگرام» وارد کنید. ویجنت به‌صورت خودکار webhook را ثبت می‌کند.',
                                en: 'To receive handoff alerts in Telegram, create a bot via @BotFather, get your chat_id from @userinfobot, and enter them under “Settings → Operator Telegram bot”. Vigent registers the webhook automatically.',
                        },
                        {
                                type: 'steps',
                                items: [
                                        { fa: 'در تلگرام به @BotFather پیام دهید و /newbot را بزنید.', en: 'Message @BotFather in Telegram and run /newbot.' },
                                        { fa: 'توکن بات را کپی کنید و در پنل ویجنت وارد کنید.', en: 'Copy the bot token and paste it into the Vigent panel.' },
                                        { fa: 'به @userinfobot پیام دهید تا chat_id خود را بگیرید.', en: 'Message @userinfobot to get your chat_id.' },
                                        { fa: 'chat_id را ذخیره و روی «تست اتصال» بزنید.', en: 'Save the chat_id and click “Test connection”.' },
                                ],
                        },
                        { type: 'h2', fa: 'در پنل گفتگو چه می‌بینید؟', en: 'What you see in the conversation panel' },
                        {
                                type: 'p',
                                fa: 'وقتی گفتگویی منتقل می‌شود، در بالای صفحهٔ گفتگو یک بنر «🔔 انتقال به اپراتور» با دلیل و زمان ظاهر می‌شود. زیر آن، مشخصات مشتری (نام، شماره، کانال، ایجنت) و خلاصهٔ گفتگو نمایش داده می‌شود تا بدون خواندن کل تاریخچه سریع تصمیم بگیرید.',
                                en: 'When a conversation is handed off, a “🔔 Operator handoff” banner appears at the top of the thread with the reason and timestamp. Below it you’ll see the customer snapshot (name, phone, channel, agent) and a conversation summary so you can triage without reading the whole history.',
                        },
                        { type: 'h2', fa: 'چگونه پاسخ دهید؟', en: 'How to reply' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'از داخل پنل ویجنت: کادر «پاسخ اپراتور» را پر کنید و ارسال بزنید. پیام مستقیم به مشتری در کانال اصلی (تلگرام/بله/روبیکا/...) می‌رود.',
                                                en: 'From the Vigent panel: fill the “Operator reply” box and hit send. The message is pushed to the customer on their original channel.',
                                        },
                                        {
                                                fa: 'از تلگرام: روی پیام هشدار reply بزنید و پاسخ را بنویسید. ویجنت آن را به مشتری ارسال می‌کند.',
                                                en: 'From Telegram: reply to the alert message and type your answer. Vigent routes it back to the customer.',
                                        },
                                ],
                        },
                        {
                                type: 'callout',
                                fa: 'بهترین روش: قبل از انتقال، مطمئن شوید نام و شماره مشتری گرفته شده — این کار به اپراتور کمک می‌کند سریع‌تر پیگیری کند.',
                                en: 'Best practice: before handing off, make sure the customer’s name and phone have been collected \u2014 it helps the operator follow up much faster.',
                        },
                        { type: 'h2', fa: 'نکات بهبود', en: 'Tips for improvement' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'کلمات کلیدی انتقال را مرتب به‌روز کنید تا الگوهای رایج درخواست اپراتور را پوشش دهد.',
                                                en: 'Keep handoff keywords up to date so they cover the common ways customers ask for a human.',
                                        },
                                        {
                                                fa: 'باز گفتگوهای بازِ منتظر اپراتور را مانیتور کنید و هشدارهای قدیمی را ببندید.',
                                                en: 'Monitor the open handoff alerts queue and resolve stale ones.',
                                        },
                                        {
                                                fa: 'شناسایی مشتری (نام + شماره) را برای کانال‌های وب فعال کنید تا اپراتور اطلاعات کافی داشته باشد.',
                                                en: 'Enable customer identification (name + phone) on web channels so the operator has enough context.',
                                        },
                                ],
                        },
                ],
        },
        {
                slug: 'customer-identification',
                icon: UserCheck,
                title: { fa: 'شناسایی مشتری', en: 'Customer identification' },
                description: {
                        fa: 'جمع‌کردن نام و شماره مشتری در ابتدای گفتگو برای پیگیری بهتر.',
                        en: 'Collecting the customer’s name and phone at the start of a conversation for better follow-up.',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'شناسایی مشتری یعنی گرفتن نام و شماره تماس در ابتدای گفتگو، قبل از پاسخ اصلی. این کار به اپراتور کمک می‌کند مشتری را سریع پیدا کند و به فروش سریع‌تر برسد.',
                                en: 'Customer identification means collecting the customer’s name and phone at the start of a conversation, before the substantive answer. This helps the operator follow up quickly and close sales faster.',
                        },
                        { type: 'h2', fa: 'فعال‌سازی', en: 'Enabling it' },
                        {
                                type: 'p',
                                fa: 'در تنظیمات ایجنت، گزینهٔ «الزام به شناسایی مشتری» (requireCustomerInfo) را فعال کنید. وقتی فعال باشد، ایجنت در ابتدای هر گفتگوی جدید از مشتری نام و شماره می‌خواهد.',
                                en: 'In the agent settings, toggle “require customer info” (requireCustomerInfo). When enabled, the agent will ask for the customer’s name and phone at the start of every new conversation.',
                        },
                        { type: 'h2', fa: 'چه زمانی لازم است؟', en: 'When is it needed?' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'ویجت وب: بله، چون هویت بازدیدکننده ناشناس است و برای پیگیری به نام/شماره نیاز داریم.',
                                                en: 'Web widget: yes, because the visitor’s identity is anonymous and you need a name/phone for follow-up.',
                                        },
                                        {
                                                fa: 'پیام‌رسان‌ها (تلگرام، بله، روبیکا، واتساپ، اینستاگرام): به‌طور پیش‌فرض خیر، چون پلتفرم هویت کاربر را می‌دهد. در صورت نیاز می‌توانید فعال کنید.',
                                                en: 'Messengers (Telegram, Bale, Rubika, WhatsApp, Instagram): off by default because the platform already provides the user identity. Enable if you need an explicit phone number.',
                                        },
                                ],
                        },
                        { type: 'h2', fa: 'نحوه کار استخراج', en: 'How extraction works' },
                        {
                                type: 'p',
                                fa: 'وقتی مشتری نام یا شماره را در پیام می‌نویسد (با الگوهایی مثل «اسمم علی است» یا «0912xxxxxxx»)، ویجنت به‌صورت خودکار آن را استخراج می‌کند و روی پروفایل مخاطب ذخیره می‌کند. وقتی نام گرفته شد، حالت گفتگو به «collected» تغییر می‌کند و ایجنت می‌تواند پاسخ اصلی را بدهد.',
                                en: 'When the customer writes their name or phone in a message (with patterns like “my name is Ali” or “0912xxxxxxx”), Vigent automatically extracts it and saves it on the contact profile. Once a name is captured, the conversation state flips to “collected” and the agent can give the substantive answer.',
                        },
                        {
                                type: 'steps',
                                items: [
                                        { fa: 'مشتری گفتگو را شروع می‌کند؛ حالت گفتگو «pending» است.', en: 'The customer opens the conversation; state is “pending”.' },
                                        { fa: 'ایجنت مودبانه نام و شماره را می‌خواهد (دستورالعمل تزریق‌شده).', en: 'The agent politely asks for name + phone (injected instruction).' },
                                        { fa: 'مشتری اطلاعات را می‌فرستد؛ استخراج‌کننده آن را پیدا می‌کند.', en: 'The customer sends the info; the extractor picks it up.' },
                                        { fa: 'پروفایل مخاطب به‌روز می‌شود و گفتگو به حالت «collected» می‌رود.', en: 'The contact profile is updated and the conversation flips to “collected”.' },
                                ],
                        },
                        {
                                type: 'callout',
                                fa: 'بهترین روش: دستورالعمل پیش‌فرض کافی است، اما می‌توانید پیام سفارشی خود را در تنظیمات ایجنت وارد کنید تا لحن برندتان حفظ شود. اصرار بیش از حد برای شماره نداشته باشید — نام به‌تنهایی کافی است.',
                                en: 'Best practice: the default instruction is enough, but you can enter a custom prompt in the agent settings to match your brand voice. Don’t push too hard for the phone \u2014 a name alone is enough.',
                        },
                ],
        },
        {
                slug: 'woocommerce',
                icon: ShoppingCart,
                title: { fa: 'اتصال ووکامرس', en: 'WooCommerce integration' },
                description: {
                        fa: 'نحوهٔ اتصال فروشگاه ووکامرس/وردپرس به ویجنت؛ نصب افزونه، تنظیم webhook و همگام‌سازی محصولات و سفارش‌ها.',
                        en: 'How to connect a WooCommerce/WordPress store to Vigent: plugin install, webhook setup, and product/order sync.',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'با اتصال ووکامرس به ویجنت، کاتالوگ محصولات و سفارش‌های فروشگاه شما به‌صورت خودکار با ویجنت همگام می‌شود. ایجنت می‌تواند قیمت، موجودی و مشخصات محصولات را از داده‌های واقعی فروشگاه بخواند و وقتی سفارش جدید ثبت می‌شود، به‌صورت خودکار روی پروفایل مخاطب مربوطه ظاهر می‌گردد.',
                                en: 'Connecting WooCommerce to Vigent keeps your store’s product catalog and orders in sync automatically. The agent can read live prices, stock, and product details, and every new order is attached to the matching contact profile.',
                        },
                        { type: 'h2', fa: 'این اتصال چه می‌کند؟', en: 'What this integration does' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'محصولات: ایجاد/ویرایش/حذف هر محصول در ووکامرس، فوراً در کاتالوگ ویجنت منعکس می‌شود (با re-embedding خودکار برای جستجوی معنایی).',
                                                en: 'Products: creating/editing/deleting a product in WooCommerce is mirrored in the Vigent catalog instantly (with automatic re-embedding for semantic search).',
                                        },
                                        {
                                                fa: 'سفارش‌ها: تغییر وضعیت سفارش (مثلاً به «در حال پردازش» یا «تکمیل‌شده») یک رکورد StoreOrder می‌سازد و آن را از روی شماره تماس/ایمیل مشتری به مخاطب مربوطه متصل می‌کند.',
                                                en: 'Orders: an order status change (e.g. to “Processing” or “Completed”) creates a StoreOrder record and links it to the matching contact by phone/email.',
                                        },
                                        {
                                                fa: 'همگام‌سازی دستی: هر زمان دکمهٔ «همگام‌سازی الآن» را بزنید، کل محصولات و سفارش‌های اخیر دوباره fetch می‌شوند.',
                                                en: 'Manual sync: hit “Sync now” any time to re-fetch the full product list and recent orders.',
                                        },
                                        {
                                                fa: 'همگام‌سازی خودکار: هر ۱۰ دقیقه یک‌بار، worker ویجنت فروشگاه‌های فعال را کشش (poll) می‌کند تا تغییراتی که از webhook جا مانده‌اند را جبران کند.',
                                                en: 'Automatic sync: every 10 minutes the Vigent worker polls active stores to catch any changes that missed the webhook.',
                                        },
                                ],
                        },
                        { type: 'h2', fa: 'پیش‌نیازها', en: 'Prerequisites' },
                        {
                                type: 'p',
                                fa: 'به وردپرس ۵.۶ به بالا، ووکامرس ۶ به بالا، و دسترسی مدیریت وردپرس برای نصب افزونه نیاز دارید. افزونه از REST API ووکامرس ( /wp-json/wc/v3 ) با احراز هویت Basic Auth (consumer key/secret) استفاده می‌کند.',
                                en: 'You need WordPress 5.6+, WooCommerce 6+, and admin access to install the plugin. The plugin talks to the WooCommerce REST API ( /wp-json/wc/v3 ) using Basic Auth (consumer key/secret).',
                        },
                        { type: 'h2', fa: 'گام ۱ — ساخت یکپارچه‌سازی در پنل ویجنت', en: 'Step 1 — Create the integration in Vigent' },
                        {
                                type: 'p',
                                fa: 'به «یکپارچه‌سازی‌ها» در داشبورد بروید، در بخش «فروشگاه آنلاین» روی «افزودن فروشگاه» بزنید، نوع «WooCommerce» را انتخاب کنید و آدرس فروشگاه + کلید consumer key/secret را وارد کنید. پس از ذخیره، ویجنت یک webhook URL و یک کلید امنیتی (webhook secret) به شما می‌دهد.',
                                en: 'Go to “Integrations” in the dashboard, click “Add store” in the “Online store” section, pick “WooCommerce”, and enter your store URL plus the consumer key/secret. After saving, Vigent gives you a webhook URL and a webhook secret.',
                        },
                        {
                                type: 'code',
                                caption: {
                                        fa: 'آدرس webhook در پنل یکپارچه‌سازی‌ها نمایش داده می‌شود و قابل کپی است:',
                                        en: 'The webhook URL is shown in the integrations panel and is copyable:',
                                },
                                code: 'https://app.vigent.ir/api/sync/woocommerce?token=WEBHOOK_SECRET',
                        },
                        { type: 'h2', fa: 'گام ۲ — نصب افزونهٔ وردپرس', en: 'Step 2 — Install the WordPress plugin' },
                        {
                                type: 'steps',
                                items: [
                                        {
                                                fa: 'فایل افزونه را از پنل ویجنت (صفحهٔ اتصالات) یا از آدرس /downloads/vigent-wordpress.zip دانلود کنید.',
                                                en: 'Download the plugin zip from the Vigent panel (Integrations page) or from /downloads/vigent-wordpress.zip.',
                                        },
                                        {
                                                fa: 'در وردپرس به «افزونه‌ها ← افزودن ← بارگذاری افزونه» بروید و فایل vigent-woo.zip را آپلود کنید.',
                                                en: 'In WordPress go to “Plugins → Add New → Upload Plugin” and upload vigent-woo.zip.',
                                        },
                                        {
                                                fa: 'افزونه را فعال کنید. یک منوی جدید با نام «ویجنت» در نوار کناری مدیریت ظاهر می‌شود.',
                                                en: 'Activate the plugin. A new “Vigent” menu appears in the WordPress admin sidebar.',
                                        },
                                        {
                                                fa: 'به «ویجنت ← تنظیمات» بروید و آدرس webhook و کلید امنیتی که از پنل ویجنت گرفتید را در فیلدها قرار دهید.',
                                                en: 'Go to “Vigent → Settings” and paste the webhook URL and webhook secret you copied from the Vigent panel.',
                                        },
                                        {
                                                fa: 'روی «ذخیره» و سپس «تست اتصال» بزنید. افزونه یک پیام نمونه به ویجنت می‌فرستد تا اتصال را تأیید کند.',
                                                en: 'Hit “Save” then “Test connection”. The plugin sends a sample ping to Vigent to confirm the link works.',
                                        },
                                ],
                        },
                        { type: 'h2', fa: 'گام ۳ — همگام‌سازی اولیه', en: 'Step 3 — Initial sync' },
                        {
                                type: 'p',
                                fa: 'پس از تست موفق، روی «همگام‌سازی کامل» در صفحهٔ تنظیمات افزونه بزنید تا همهٔ محصولات و سفارش‌های اخیر یک‌بار به ویجنت ارسال شوند. این کار ممکن است برای فروشگاه‌های بزرگ چند دقیقه طول بکشد. پس از آن، هر تغییر محصول/سفارش به‌صورت فوری (push) از طریق webhook به ویجنت می‌رسد.',
                                en: 'After a successful test, click “Full sync” on the plugin settings page to push all products and recent orders to Vigent once. For large stores this can take a few minutes. After that, every product/order change is pushed to Vigent instantly via the webhook.',
                        },
                        {
                                type: 'callout',
                                fa: 'نکته: اگر هاست شما outgoing webhooks را محدود کرده، مطمئن شوید آدرس app.vigent.ir در allow-list است. در غیر این صورت افزونه نمی‌تواند به ویجنت بفرستد و فقط همگام‌سازی کششی (هر ۱۰ دقیقه) کار می‌کند.',
                                en: 'Note: if your host restricts outgoing webhooks, make sure app.vigent.ir is on the allow-list. Otherwise the plugin cannot push to Vigent and only the pull sync (every 10 minutes) will work.',
                        },
                        { type: 'h2', fa: 'گام ۴ — تأیید در پنل ویجنت', en: 'Step 4 — Verify in the Vigent panel' },
                        {
                                type: 'p',
                                fa: 'به بخش «یکپارچه‌سازی‌ها» برگردید. باید ببینید «آخرین همگام‌سازی» به‌روز شده و در زیر آن لاگ‌های اخیر (products/orders + تعداد + نتیجه) ظاهر شده‌اند. اگر پیامی در ستون «خطا» دیدید، روی آن بزنید تا متن خطا نمایش داده شود.',
                                en: 'Back in the “Integrations” panel you should see “Last sync” updated and recent log rows below it (products/orders + count + outcome). If anything shows up in the “Error” column, click it to see the error message.',
                        },
                        { type: 'h2', fa: 'عیب‌یابی', en: 'Troubleshooting' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'محصولات در ویجنت ظاهر نمی‌شوند؟ بررسی کنید consumer key/secret دسترسی «Read» به محصولات داشته باشد (در ووکامرس: WooCommerce → Settings → Advanced → REST API).',
                                                en: 'Products not showing in Vigent? Make sure the consumer key/secret has “Read” permission for products (WooCommerce → Settings → Advanced → REST API).',
                                        },
                                        {
                                                fa: 'سفارش‌ها به مخاطب متصل نمی‌شوند؟ شماره تلفن/ایمیل سفارش باید با همان فیلدی که در پروفایل مخاطب ویجنت ذخیره شده مطابقت داشته باشد (نرمال‌سازی 0 و 98+ پشتیبانی می‌شود).',
                                                en: 'Orders not linking to contacts? The order phone/email must match the field stored on the Vigent contact profile (0 and 98+ normalization is supported).',
                                        },
                                        {
                                                fa: 'webhook خطای 401 می‌دهد؟ کلید امنیتی (token) را در پنل ویجنت دوباره کپی کنید و در افزونه جای‌گذاری کنید. هر تغییر در پنل ویجنت، کلید را بازتولید نمی‌کند مگر اینکه یکپارچه‌سازی را حذف و دوباره بسازید.',
                                                en: 'Webhook returns 401? Re-copy the secret token from the Vigent panel and paste it into the plugin. Changing Vigent settings does not regenerate the token unless you delete and recreate the integration.',
                                        },
                                        {
                                                fa: 'هیچ لاگی در پنل نیست؟ پس از «تست اتصال» در افزونه، یک ردیف لاگ باید فوراً در پنل ویجنت ظاهر شود. اگر نشد، احتمالاً آدرس webhook اشتباه است یا هاست outgoing را بسته است.',
                                                en: 'No log rows in the panel? After “Test connection” in the plugin, a log row should appear in the Vigent panel immediately. If not, the webhook URL is likely wrong or the host is blocking outgoing requests.',
                                        },
                                ],
                        },
                        {
                                type: 'callout',
                                fa: 'بهترین روش: پس از هر آپدیت بزرگ ووکامرس (مثلاً تغییر نسخهٔ اصلی)، یک‌بار «همگام‌سازی کامل» را بزنید تا مطمئن شوید هیچ محصولی جا نمانده است.',
                                en: 'Best practice: after any major WooCommerce upgrade, run a “Full sync” once to make sure no product was left behind.',
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
                slug: 'models',
                icon: Cpu,
                title: { fa: 'انتخاب مدل هوش مصنوعی', en: 'Choosing an AI model' },
                description: {
                        fa: 'مدل‌های رایگان و پولی، کیفیت و هزینه',
                        en: 'Free vs paid models, quality and cost',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'هر ایجنت با یکی از مدل‌های OpenRouter پاسخ می‌دهد. ویجنت یک فهرست منتخب از مدل‌ها را در چهار سطح ارائه می‌کند: رایگان، اقتصادی، متعادل و حرفه‌ای. مدل را می‌توانید هنگام ساخت ایجنت یا از تنظیمات ایجنت تغییر دهید.',
                                en: 'Each agent answers with one of the OpenRouter models. Vigent curates a short list in four tiers: free, economy, balanced and premium. You can change the model when creating an agent or later in its settings.',
                        },
                        { type: 'h2', fa: 'مدل‌های رایگان', en: 'Free models' },
                        {
                                type: 'p',
                                fa: 'مدل‌های رایگان (با پسوند :free) هیچ هزینه‌ای از حساب OpenRouter شما کم نمی‌کنند، اما محدودیت نرخ سراسری دارند: حدود ۲۰ درخواست در دقیقه و ۵۰ درخواست در روز (اگر حساب شما ۱۰ دلار یا بیشتر شارژ داشته باشد، حدود ۱۰۰۰ درخواست در روز). این مدل‌ها برای تست و راه‌اندازی اولیه عالی‌اند ولی برای ترافیک واقعی مشتری توصیه نمی‌شوند.',
                                en: 'Free models (the :free suffix) cost nothing on your OpenRouter account, but have account-wide rate limits: about 20 requests/minute and 50 requests/day (roughly 1000/day once your account holds $10+ credit). Great for testing, not recommended for production traffic.',
                        },
                        {
                                type: 'callout',
                                fa: 'اگر مدل رایگان پاسخ نمی‌دهد، در پنل OpenRouter به Settings ← Privacy بروید و گزینهٔ استفاده از مدل‌های رایگان (اشتراک داده برای آموزش) را فعال کنید؛ بدون آن، OpenRouter درخواست مدل‌های رایگان را رد می‌کند.',
                                en: "If a free model never answers, open your OpenRouter panel → Settings → Privacy and enable free-model usage (training data sharing); without it OpenRouter rejects free-model requests.",
                        },
                        { type: 'h2', fa: 'کدام مدل را انتخاب کنم؟', en: 'Which model should I pick?' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'شروع و تست: مدل‌های رایگان (GPT-OSS 120B یا Llama 3.3 70B)',
                                                en: 'Testing: the free models (GPT-OSS 120B or Llama 3.3 70B)',
                                        },
                                        {
                                                fa: 'اکثر کسب‌وکارها: DeepSeek V3 — کیفیت بالا با کمترین هزینه',
                                                en: 'Most businesses: DeepSeek V3 — high quality at the lowest cost',
                                        },
                                        {
                                                fa: 'حجم پیام بالا و پاسخ کوتاه: Gemini 2.5 Flash Lite',
                                                en: 'High message volume, short replies: Gemini 2.5 Flash Lite',
                                        },
                                        {
                                                fa: 'گفتگوهای حساس و پیچیده: Claude Sonnet 5 یا GPT-4o',
                                                en: 'Complex, sensitive conversations: Claude Sonnet 5 or GPT-4o',
                                        },
                                ],
                        },
                        {
                                type: 'p',
                                fa: 'هزینهٔ توکن‌ها مستقیماً از حساب OpenRouter شما کسر می‌شود (مدل BYOK)، بنابراین همیشه می‌توانید در پنل OpenRouter مصرف دقیق را ببینید.',
                                en: 'Token costs are billed straight to your OpenRouter account (BYOK), so you can always see exact usage in the OpenRouter panel.',
                        },
                ],
        },
        {
                slug: 'billing',
                icon: CreditCard,
                title: { fa: 'پلن‌ها و پرداخت', en: 'Plans & billing' },
                description: {
                        fa: 'دورهٔ آزمایشی، پلن‌ها، سهمیهٔ پیام و روش‌های پرداخت',
                        en: 'Trial, plans, message quota and payment methods',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'با اولین ورود، یک دورهٔ آزمایشی ۱۴ روزه فعال می‌شود. پس از آن برای ادامهٔ کار یکی از پلن‌های استارتر، حرفه‌ای یا سازمانی را از بخش «صورتحساب» داشبورد تهیه کنید. هر پلن، سقف پیام ماهانه و تعداد ایجنت مشخصی دارد.',
                                en: 'Your first login starts a 14-day trial. Afterwards, pick the Starter, Pro or Business plan from the Billing page. Each plan sets a monthly message quota and a max number of agents.',
                        },
                        { type: 'h2', fa: 'سهمیهٔ پیام ماهانه', en: 'Monthly message quota' },
                        {
                                type: 'p',
                                fa: 'هر پاسخ ایجنت (در هر کانالی) یک پیام از سهمیهٔ ماهانه حساب می‌شود. مصرف فعلی را در صفحهٔ نمای کلی و صورتحساب می‌بینید. با پر شدن سهمیه، ایجنت تا شروع ماه بعد یا ارتقای پلن پاسخ نمی‌دهد.',
                                en: 'Every agent reply (on any channel) counts as one message against the monthly quota. Current usage is shown on the Overview and Billing pages. When the quota is exhausted, agents stop replying until the next month or a plan upgrade.',
                        },
                        { type: 'h2', fa: 'روش‌های پرداخت', en: 'Payment methods' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'پرداخت ریالی از طریق درگاه زرین‌پی (کارت‌های شتاب)',
                                                en: 'Rial payments via the ZarinPay gateway (Shetab cards)',
                                        },
                                        {
                                                fa: 'پرداخت ارز دیجیتال (تتر و…) از طریق NowPayments',
                                                en: 'Crypto payments (USDT and more) via NowPayments',
                                        },
                                ],
                        },
                        {
                                type: 'p',
                                fa: 'هر پرداخت موفق، اشتراک را ۳۰ روز تمدید می‌کند. اگر قبل از پایان دوره تمدید کنید، روزهای باقی‌مانده از بین نمی‌روند و به انتهای دوره اضافه می‌شوند.',
                                en: 'Each successful payment extends the subscription by 30 days. Renewing early never loses paid days — the new period is appended to the current one.',
                        },
                        {
                                type: 'callout',
                                fa: 'هزینهٔ پلتفرم جدا از هزینهٔ توکن‌های هوش مصنوعی است؛ توکن‌ها با کلید OpenRouter خودتان و از حساب خودتان پرداخت می‌شوند.',
                                en: 'The platform fee is separate from AI token costs; tokens are paid from your own OpenRouter account (BYOK).',
                        },
                ],
        },
        {
                slug: 'widget',
                icon: MessageCircle,
                title: { fa: 'ویجت چت وب‌سایت', en: 'Website chat widget' },
                description: {
                        fa: 'نصب، شخصی‌سازی و فرم معرفی قبل از چت',
                        en: 'Install, customize, and the pre-chat form',
                },
                blocks: [
                        {
                                type: 'p',
                                fa: 'ویجت چت، ایجنت شما را روی هر وب‌سایتی قرار می‌دهد. کافی است از صفحهٔ کانال‌ها ← ویجت وب، کد اسکریپت را کپی و قبل از بستهٔ </body> سایت خود بچسبانید.',
                                en: 'The chat widget puts your agent on any website. Copy the script tag from Channels → Web Widget and paste it before your site\'s closing </body> tag.',
                        },
                        { type: 'h2', fa: 'شخصی‌سازی ظاهر', en: 'Appearance' },
                        {
                                type: 'list',
                                items: [
                                        {
                                                fa: 'رنگ اصلی، آیکون، فونت فارسی، گردی گوشه‌ها و محل قرارگیری',
                                                en: 'Accent color, icon, Persian fonts, corner radius and position',
                                        },
                                        {
                                                fa: 'عنوان و زیرعنوان هدر، پیام خوش‌آمد و سؤالات پیشنهادی (چیپ‌ها)',
                                                en: 'Header title/subtitle, welcome message and suggested quick replies',
                                        },
                                        {
                                                fa: 'خوش‌آمد خودکار: باز شدن حباب پیام بعد از چند ثانیه',
                                                en: 'Auto-greet: a teaser bubble pops after a few seconds',
                                        },
                                ],
                        },
                        { type: 'h2', fa: 'فرم معرفی قبل از چت', en: 'Pre-chat form' },
                        {
                                type: 'p',
                                fa: 'با فعال کردن «فرم معرفی قبل از چت» در تنظیمات ویجت، دستیار قبل از شروع گفتگو خودش را معرفی می‌کند و نام و شمارهٔ موبایل بازدیدکننده را می‌گیرد. این اطلاعات به‌صورت خودکار به‌عنوان مخاطب در CRM ثبت می‌شود و ایجنت مشتری را با نامش خطاب می‌کند. متن معرفی قابل‌ویرایش است و بازدیدکننده می‌تواند فرم را رد کند.',
                                en: 'Enable the pre-chat form in widget settings and the assistant introduces itself, then asks for the visitor\'s name and mobile number before the chat starts. The visitor is saved to your CRM automatically and the agent addresses them by name. The intro text is editable, and the visitor can skip the form.',
                        },
                        { type: 'h2', fa: 'امنیت دامنه', en: 'Domain security' },
                        {
                                type: 'p',
                                fa: 'در تنظیمات ویجت می‌توانید فهرست دامنه‌های مجاز را مشخص کنید تا ویجت فقط روی سایت‌های خودتان کار کند. فهرست خالی یعنی بدون محدودیت (با هشدار در داشبورد).',
                                en: 'Set an allowlist of domains in the widget settings so the widget only works on your own sites. An empty list means unrestricted (the dashboard warns about this).',
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
