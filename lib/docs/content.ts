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
                                                fa: 'پوشهٔ wordpress-plugin/vigent-woo را از سورس ویجنت دانلود کنید (یا فایل zip آن را ازReleaseها بگیرید).',
                                                en: 'Download the wordpress-plugin/vigent-woo folder from the Vigent source (or grab the zip from the Releases).',
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
