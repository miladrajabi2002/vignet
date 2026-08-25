# گزارش آمادگی انتشار Vigent (Release Readiness Report)

آخرین به‌روزرسانی: 2026-07-28 · Branch: `main` · خط مبنا: Commit `d819d72`

---

## ۱. خلاصه مدیریتی

### وضعیت کلی
پروژه از نظر مهندسی در وضعیت **بسیار بهتر از حد انتظار** بود: خط مبنا با صفر خطای TypeScript، صفر خطای Lint، Build موفق و ۳۱۳ تست پاس شروع شد. Tenant Isolation در ~۱۱۱ Route API با الگوی یکدستِ `findFirst({ where: { id, workspaceId } })` پیاده شده بود، SSRF به‌صورت مرکزی مهار شده بود، امضای وبهوک متا Timing-safe بررسی می‌شد، اعتبار AI اتمی رزرو/ثبت می‌شد و ادعاهای محصول هرگز از مدل به مشتری نمی‌رسید (بازحل‌شدن از دیتابیس).

اما ممیزی ۱۵بُعدی **۸ مشکل Critical** پیدا کرد که هر یک به‌تنهایی مانع انتشار عمومی بود — سه‌تای آن‌ها نشت داده بین‌مستاجری، یکی XSS ذخیره‌شده، و یکی نشت Connection که تحت بار واقعی کل Rate-limit و OTP را می‌شکست. این‌ها با تست واقعی و ارجاع به کد اثبات شدند، نه حدس.

### میزان آمادگی انتشار
**آماده با ریسک‌های کوچک** — تمام ۸ مورد Critical و ۲۰ مورد High رفع و با Build/Test تأیید شدند. ریسک‌های باقی‌مانده هیچ‌کدام Critical نیستند و در بخش ۹ فهرست شده‌اند.

### مهم‌ترین مشکلات اولیه
۱. سه مسیر نشت داده بین‌مستاجری در وبهوک‌های سراسری متا و در diagnostics اینستاگرام
۲. XSS ذخیره‌شده در صفحهٔ عمومی منو از طریق نام محصول
۳. نشت Connection ردیس در Production (صدها سوکت در دقیقه تا `maxclients`)
۴. گم‌شدن دائمی پیام مشتری در سه سناریوی مستقل (قطع پلن، Restart سرور، خطای گذرا)
۵. توکن‌های OAuth هرگز Refresh نمی‌شدند — هر کانال بعد از ~۶۰ روز بی‌صدا می‌مُرد
۶. نبود Idempotency: بازارسال متا پاسخ و پیام تکراری تولید می‌کرد
۷. قیف کامنت→دایرکت اینستاگرام برای مخاطب جدید هرگز تحویل نمی‌شد
۸. ۶ Composer دست‌ساز مستقل با ۳ قرارداد متفاوت برای جهت پیام

### مهم‌ترین اصلاحات انجام‌شده
- مسیریابی وبهوک متا از Batch-محور به **Entry-محور** بازنویسی شد و idهای سمت فرستنده از کاندیداهای مسیریابی حذف شدند
- مسیرهای سراسری اینستاگرام/واتساپ/QR به **صف پایدار BullMQ** منتقل شدند (با 503 هنگام قطع ردیس تا متا بازارسال کند)
- **Idempotency** و **قفل به‌ازای هر مکالمه** روی کل مسیر ورودی
- **Composer مشترک** ساخته و روی هر ۸ سطح پیام‌رسانی اعمال شد؛ جهت Bubbleها در همه‌جا یکدست شد
- **منوی موبایل** برای هدر سایت (که کاملاً وجود نداشت)
- Job **تمدید خودکار توکن** OAuth با اعلان اتصال مجدد

### ریسک‌های باقی‌مانده
هیچ آسیب‌پذیری Critical شناخته‌شده‌ای باقی نمانده. ریسک‌های اصلی: **عدم امکان تست واقعی کانال‌ها** (نیاز به Credential زنده متا/واتساپ)، **نبود تست بصری مرورگر** (Playwright در دسترس نبود)، و **نبود تست Integration واقعی RAG با PostgreSQL/pgvector و Provider زنده**. جزئیات در بخش ۹.

### تکمیل موج Launch-critical در ۲۸ ژوئیه
- قواعد صنفی واقعی برای تمپلیت‌های غذا، نوبت/درمان، خدمات، آموزش و سایر Verticalها به Prompt توصیه‌شده وصل شد؛ مثال‌های فروشگاهی نامرتبط در صنف‌های غیرتجاری حذف شدند.
- RAG با نرمال‌سازی فارسی، Hybrid Retrieval برداری/لغوی، Relevance gate، اولویت دانش دست‌نویس، اسکن تکرارشوندهٔ HNSW در pgvector 0.8+، Chunk اختصاصی FAQ و حفظ شماره صفحه PDF تقویت شد.
- پیام بلند تلگرام، بله و هر دو حالت واتساپ در مرز خوانا Split می‌شود؛ Timeout شبکه به Worker اجازه Retry می‌دهد و fallback تلگرام فقط برای خطای قطعی 400 اجرا می‌شود تا پیام تکراری نسازد.
- ویجت و چت‌لینک Retry قابل‌فهم، Markdown و لینک امن، مدیریت بهتر viewport موبایل و نمایش محصول در تست ایجنت دریافت کردند.
- صفحه تعرفه FAQ واقعی، Metadata شبکه‌های اجتماعی و JSON-LDهای `SoftwareApplication`، `Offer`، `FAQPage` و `BreadcrumbList` دریافت کرد.
- تست‌های Deterministic برای Chunking/Ranking/Normalization دانش، Split پیام، لینک امن و تفاوت واقعی تمپلیت‌های صنفی اضافه شد. تست زنده کانال و Retrieval دیتابیسی همچنان به Staging و Credential نیاز دارد.

---

## ۲. خط مبنا (مرحله صفر)

| مورد | مقدار |
|---|---|
| Branch / Commit | `main` / `d819d72` — Working tree پاک |
| Node.js / npm | v24.16.0 / 12.0.1 — Package Manager: npm با `package-lock.json` |
| Stack | Next.js 15.5 (App Router) · React 19 · TypeScript 5 · Prisma 6 · BullMQ 5 + ioredis · next-auth v5 beta · next-intl 4 · Tailwind 3 · Vitest 4 |
| Worker | `worker/index.ts` (۷ صف) + `worker/scheduler.ts` (Interval درون‌پروسه) |
| Deploy | PM2 (`deploy/ecosystem.config.js`) + Nginx + اسکریپت `deploy/deploy.sh` |

### نتایج Build و Test **قبل** از تغییرات
| بررسی | نتیجه |
|---|---|
| `tsc --noEmit` | ✅ صفر خطا |
| `next build` | ✅ موفق — First Load JS مشترک ۱۰۳kB، Middleware ۸۷kB |
| `vitest run` | ✅ ۶۱ فایل / ۳۱۳ تست — همه پاس |
| `next lint` | ✅ بدون خطا و Warning |

---

## ۳. فهرست تغییرات

### Critical

#### C1 — نشت بین‌مستاجری در وبهوک سراسری اینستاگرام
**دلیل:** `handleInstagramGlobalInbound` کل Batch را به **اولین** کانال منطبق می‌داد، و `changes[].value.from.id` (آیدی کامنت‌گذار) هم جزو کاندیداهای مسیریابی بود. متا رویدادهای چند اکانت مشترک را در یک POST تجمیع می‌کند.
**سناریوی خرابی:** مستاجر A و B هم‌زمان DM می‌گیرند → متا یک POST با `entry[A]` و `entry[B]` می‌فرستد → A اول منطبق می‌شود → پیام مشتری B در Workspace A ذخیره و **از اکانت اینستاگرام A** پاسخ داده می‌شود.
**فایل‌ها:** `lib/channels/handler.ts`
**روش اصلاح:** مسیریابی per-entry با idهای سمت مالک (`entry.id`، `messaging[].recipient.id`، `changes[].value.to/recipient.id`)؛ گروه‌بندی per-channel؛ ایزوله‌سازی خطا؛ Cache جست‌وجو در هر Batch.
**تست:** ۲ تست جدید در `tests/instagram-global-routing.test.ts` — یکی Batch چند‌اکانتی، یکی رد مسیریابی با آیدی کامنت‌گذار.

#### C2 — نشت بین‌مستاجری + گم‌شدن پیام در وبهوک سراسری واتساپ
**دلیل:** Demultiplexer کل Body را به **همهٔ** شماره‌های منطبق می‌داد، در حالی که `parseUpdate` فقط `entry[0].changes[0]` را می‌خواند و هیچ فیلتری روی `phone_number_id` نداشت.
**سناریوی خرابی:** یک Batch با دو شمارهٔ متعلق به دو Workspace → هر دو کانال `entry[0]` را پردازش می‌کنند (پیام مشتری A در Workspace B و پاسخ از شمارهٔ B) و پیام مشتری B در `entry[1]` **بی‌صدا حذف** می‌شود.
**فایل‌ها:** `lib/whatsapp/webhook.ts`، `lib/channels/whatsapp.ts`
**روش اصلاح:** تفکیک Batch به ازای هر `phone_number_id` و ارسال فقط Slice مربوطه؛ `parseUpdate` تمام entryها و changeها را Iterate می‌کند.

#### C3 — گم‌شدن دائمی پیام مشتری هنگام قطع پلن یا اعتبار
**دلیل:** در مسیرهای `PLAN_BLOCKED` / `NO_CREDIT` / `AI_UNAVAILABLE`، خروج **قبل از** `message.create` بود و Handler هم `continue` می‌کرد. وبهوک ۲۰۰ داده بود، پس بازارسالی وجود نداشت. (کامنت خودِ کد ادعا می‌کرد پیام همیشه ذخیره می‌شود.)
**سناریوی خرابی:** پایان Trial یا صفرشدن کیف پول → پیام مشتریان **همهٔ** کانال‌ها برای همیشه گم می‌شود؛ مالک هم هیچ‌چیزی در Inbox نمی‌بیند.
**فایل‌ها:** `lib/ai/chat-engine.ts`
**روش اصلاح:** `persistGatedInbound()` — ذخیرهٔ پیام + به‌روزرسانی شمارنده قبل از بازگشت هر خطای Gate.

#### C4 — نشت Connection ردیس در Production
**دلیل:** `getRedis()` کلاینت را فقط وقتی `NODE_ENV !== 'production'` کش می‌کرد؛ PM2 هر دو پروسه را با `NODE_ENV=production` اجرا می‌کند.
**سناریوی خرابی:** هر Rate-limit، هر Cache امبدینگ (۲ اتصال به‌ازای هر پاسخ AI)، هر بررسی Entitlement (۲ بار در هر مکالمه) و هر Health-ping یک اتصال TCP تازه باز می‌کرد که هیچ‌وقت `quit()` نمی‌شد → با یک اکانت شلوغ (~۱۰۰ رویداد در دقیقه) صدها سوکت در دقیقه تا `maxclients` → از آن لحظه Rate-limit با `failClosed` هر پیام را Drop می‌کند و OTP کار نمی‌کند.
**فایل‌ها:** `lib/redis.ts`
**روش اصلاح:** کش بی‌قید‌و‌شرط یک اتصال Multiplex‌شده به‌ازای هر پروسه.

#### C5 — XSS ذخیره‌شده در صفحهٔ عمومی منو
**دلیل:** نام محصول/کسب‌وکار (ورودی آزاد ۱–۱۶۰ کاراکتری مستاجر) بدون Escape داخل `<script type="application/ld+json">` تزریق می‌شد. `JSON.stringify` کاراکتر `<` را Escape نمی‌کند.
**سناریوی خرابی:** محصولی با نام `</script><script>fetch('/api/...')…</script>` ساخته می‌شود و لینک عمومی `/menu/<slug>` برای پشتیبانی یا اپراتور دیگری فرستاده می‌شود.
**فایل‌ها:** `lib/seo/json-ld.ts` (جدید)، `app/menu/[slug]/page.tsx`، `app/(marketing)/blog/[slug]/page.tsx`، `app/(marketing)/docs/{page,[slug]/page}.tsx`
**روش اصلاح:** Serializer مشترک `jsonLdScript` که `<`، `>` و U+2028/9 را Escape می‌کند.
**تست:** ۴ تست در `tests/json-ld-escaping.test.ts`.

#### C6 — نشت بافر سراسری وبهوک به مستاجرها
**دلیل:** `GET .../instagram-diagnostics` فقط مالکیت ایجنت را چک می‌کرد و سپس بافر Process-global (۵۰ Payload آخر **کل پلتفرم**) را برمی‌گرداند؛ و `categorizePayload` ۵۰ کاراکتر اول متن پیام را داخل `eventType` جا می‌داد.
**سناریوی خرابی:** هر مستاجر با Poll کردن این Endpoint، متن DM مشتریان سایر Workspaceها + آیدی اکانت آن‌ها + ۸ کاراکتر اول webhookToken را دریافت می‌کند (و همان idها ورودی لازم برای حملهٔ C7 است).
**فایل‌ها:** `lib/channels/webhook-debug.ts`، `app/api/agents/[agentId]/channels/instagram-diagnostics/route.ts`
**روش اصلاح:** `getScopedWebhookPayloads` — هر مستاجر فقط Payloadهای **خودش** یا idهای **ادعانشده** (همان حالت عدم‌تطابق id متا که این صفحه برای دیباگش وجود دارد) را می‌بیند؛ فیلد `eventKind` بدون متن مشتری، و `tokenHint` هرگز برگردانده نمی‌شود؛ تعداد Payloadهای سایر مستاجرها فقط شمارش می‌شود.

#### C7 — امکان ربودن اکانت اینستاگرام مستاجر دیگر
**دلیل:** `PUT .../instagram-diagnostics` مقدار دلخواه کاربر را (تنها با چک `/^\d+$/`) در `igUserId` — یعنی **کلید مسیریابی وبهوک** — می‌نوشت، بدون هیچ اعتبارسنجی مالکیت و بدون قید یکتایی.
**سناریوی خرابی:** مهاجم اکانت خودش را OAuth می‌کند (توکن معتبر)، igUserId قربانی را ثبت می‌کند → متا رویدادهای قربانی را تحویل می‌دهد → `findFirst` دو ردیف منطبق دارد و بدون ترتیب قطعی → پیام‌های مشتریان قربانی در Workspace مهاجم ذخیره می‌شود و قربانی رویدادها را از دست می‌دهد.
**فایل‌ها:** `app/api/agents/[agentId]/channels/instagram-diagnostics/route.ts`
**روش اصلاح:** پذیرش id تنها با **اثبات مالکیت** — تطابق با پروفایل تأییدشدهٔ متا برای توکن خودمان، یا حضور در Payloadهای اخیرِ ادعانشدهٔ همین اکانت — به‌علاوهٔ رد ۴۰۹ اگر کانال دیگری آن id را ادعا کرده باشد.

#### C8 — مسیرهای سراسری غیرپایدار (گم‌شدن پیام روی هر Deploy)
**دلیل:** مسیرهای سراسری اینستاگرام/واتساپ و WhatsApp-QR بعد از ACK دوی ۲۰۰، پردازش را `void`-شده در پروسهٔ وب اجرا می‌کردند — بدون Retry، بدون سقف Concurrency، بدون Durability. (در مقابل، مسیر per-token از ابتدا صف پایدار داشت.)
**سناریوی خرابی:** یک `pm2 restart` (هر Deploy) یا `max_memory_restart` → همهٔ رویدادهای در حال پردازش، هر یک با یک رفت‌و‌برگشت چند‌ثانیه‌ای LLM، برای همیشه گم می‌شوند.
**فایل‌ها:** `lib/queue/jobs.ts`، `worker/index.ts`، `app/api/webhook/{instagram,whatsapp,whatsapp-qr}/route.ts`، `lib/queue/connection.ts`
**روش اصلاح:** `dispatchGlobalInbound` با jobId مبتنی بر Hash محتوا (Dedup بازارسال)، Demux در Worker، پاسخ **503** هنگام قطع صف تا متا بازارسال کند، و اتصال Producer با `enableOfflineQueue: false` تا `add()` بلافاصله Reject شود نه اینکه Hang کند.
**تست:** `tests/meta-webhook-security.test.ts` بازنویسی شد + تست جدید ۵۰۳.

### High (۲۰ مورد رفع‌شده)

| # | مشکل | فایل کلیدی |
|---|---|---|
| H1 | توکن‌های OAuth اینستاگرام/واتساپ هرگز Refresh نمی‌شدند؛ `refreshLongLivedToken` صفر Caller داشت — هر کانال بعد از ~۶۰ روز بی‌صدا می‌مُرد و تنها سیگنال، هشدار «۳ روز سکوت» بود | `worker/scheduler.ts` |
| H2 | استخراج‌گر نام فارسی جمله‌های خرید را نام مشتری می‌کرد: «من دنبال یه گوشی هستم» → مخاطب CRM با نام «دنبال یه گوشی»؛ همچنین State شناسایی را زودهنگام `collected` می‌کرد و `{customer_name}` را خراب می‌کرد | `lib/ai/customer-identification.ts` |
| H3 | سقف `max_price` کهنه (Substring روی `qwen3.5`) پس از چرخش مدل‌ها، تیرهای پولی را زیر نرخ مرجع خودشان Cap می‌کرد → احتمالاً هر درخواست ۴۰۴ و همیشه Fallback | `lib/ai/openrouter.ts` |
| H4 | نبود Idempotency رویداد ورودی: بازارسال متا/تلگرام و Re-run Jobهای Stalled → پاسخ AI و پیام تکراری، مصرف دوبارهٔ اعتبار | `lib/channels/idempotency.ts` (جدید) |
| H5 | نبود Serialization به‌ازای مکالمه: دو پیام سریع یک مشتری هم‌زمان پردازش، هر کدام History را بدون دیگری می‌خواند → دو پاسخ با ترتیب معکوس | `lib/channels/conversation-lock.ts` (جدید) |
| H6 | خطاهای per-message بلعیده می‌شدند، پس `attempts` صف کد مرده بود: یک Timeout گذرای Prisma پیام مشتری را بی‌صدا دور می‌ریخت | `lib/channels/handler.ts` |
| H7 | Deploy، Jobهای در حال اجرا را با پیش‌فرض ۱.۶ ثانیهٔ PM2 SIGKILL می‌کرد و BullMQ آن‌ها را Re-run می‌کرد → ارسال دوبارهٔ پاسخ‌های تحویل‌شده | `deploy/ecosystem.config.js` |
| H8 | حالت Debug ورود ادمین، `ADMIN_TOTP_SECRET` (Seed کامل 2FA) را در هر تلاش ناموفق در لاگ می‌نوشت + Oracle مرحله‌به‌مرحله به کلاینت ناشناس می‌داد | `lib/admin/auth.ts`، `app/admin/login/actions.ts` |
| H9 | Session ادمین Stateless و غیرقابل ابطال تا ۱۲ ساعت | `lib/admin/auth.ts` (کلید مشتق از `ADMIN_PASS`) |
| H10 | قیف کامنت→دایرکت با `recipient.id` ارسال می‌شد؛ متا شروع DM با کامنت‌گذار بدون Thread قبلی را فقط با Private Reply اجازه می‌دهد → برای اکثر ورودی‌های قیف هرگز تحویل نمی‌شد (خطای #100) | `lib/instagram/private-reply.ts` (جدید) |
| H11 | ورودی دانش ابتدا حذف می‌کرد بعد Embed، و صف Backoff نداشت → یک قطعی گذرای Provider، KB را با صفر Chunk رها می‌کرد | `lib/knowledge/ingest.ts` |
| H12 | Fallback تک‌کانالی اینستاگرام: شمارش «تنها کانال **فعال**» بود، پس Pause شدن ایجنت مستاجر B یا Decrypt نشدن توکنش، DMهای او را به Workspace A می‌داد | `lib/channels/handler.ts` |
| H13 | قطع اتصال کاربر در میانهٔ Streaming: `controller.enqueue` بدون Guard → `start()` Reject و `captureChatCredit` + `persistAssistantTurn` هرگز اجرا نمی‌شدند → سؤال مشتری بی‌پاسخ در دیتابیس | `lib/ai/chat-engine.ts` |
| H14 | API ویجت بعد از غیرفعال‌سازی کانال کار می‌کرد و allowlist دامنه به «اجازه به همه» برمی‌گشت | `app/api/widget/[agentId]/chat/route.ts` |
| H15 | بن‌بست lead capture ویجت: `visitorSent` قبل از موفقیت Latch می‌شد → `LEAD_REQUIRED` تا ابد | `public/widget/loader.js` |
| H16 | پیام «خطا، دوباره تلاش کنید» برای پیام‌های **تحویل‌شده** در فاز اپراتور → ارسال مکرر و پرشدن Inbox از تکرار | `public/widget/loader.js` |
| H17 | ساخت Workspace+User غیر Transactional → Workspace بی‌مالک با اعتبار Trial | `auth.ts` |
| H18 | نبود منوی موبایل در هدر سایت: زیر ۱۰۲۴px تمام ناوبری و **سوییچ زبان** غیرقابل‌دسترس | `components/marketing/mobile-menu.tsx` (جدید) |
| H19 | زوم خودکار iOS روی تقریباً همهٔ فرم‌ها (مقیاس تایپوگرافی حتی `text-base` را ۱۵px تعریف کرده) | `app/globals.css` |
| H20 | ۶ Composer دست‌ساز با ۳ قرارداد متفاوت جهت پیام؛ SVG ارسال در ۳ جا Copy-paste و ۴ Composer با ۳ رفتار RTL متفاوت | `components/chat/chat-composer.tsx` (جدید) |

### مرحله چهارم — یکپارچه‌سازی Composer (طبق تصویر مرجع)

کامپوننت مشترک `components/chat/chat-composer.tsx` ساخته شد: **Pill گرد + دکمهٔ ارسال دایره‌ای تیره با فلش رو‌به‌بالا** — دقیقاً مطابق تصویر مرجع. طبق دستور، دکمهٔ «+» و انتخاب‌گر مدل تصویر مرجع **منتقل نشدند**.

قرارداد هندسی واحد (`COMPOSER_GEOMETRY`): دکمه ۴۰px، آیکون ۱۸px، حداقل ارتفاع ۴۰px، حداکثر ۱۳۲px، شعاع ۱.۵rem — همین قرارداد در CSS وانیلی ویجت هم آینه شده است.

رفتارهای یکدست‌شده که قبلاً در هر سطح متفاوت بودند: Enter ارسال / Shift+Enter خط جدید، Guard ترکیب IME (قبلاً فقط ویجت داشت)، Auto-grow (قبلاً ۳ سقف متفاوت ۱۱۰/۱۲۰/۱۶۰px و ۲ Composer بدون آن)، غیرفعال‌شدن روی خالی/مشغول، Spinner، و ۱۶px برای جلوگیری از زوم iOS.

| سطح | وضعیت |
|---|---|
| چت‌لینک `/c/[slug]` | ✅ Composer مشترک — SendIcon و autoGrow محلی حذف شد |
| Inbox اپراتور (پنل کاربر) | ✅ Composer مشترک + جهت Bubbleها اصلاح شد |
| تست ایجنت (Playground) | ✅ Composer مشترک (میکرو در Slot `leading`) + جهت + Scroll |
| Vigento (پنل کاربر) | ✅ Composer مشترک — **Enter-to-send را که کلاً نداشت به دست آورد** |
| Vigento (پنل ادمین) | ✅ Composer مشترک — دکمهٔ Quick-prompt موجود حفظ شد |
| ویجت وب (وانیلی) | ✅ CSS و آیکون هم‌تراز با قرارداد مشترک |
| Previewهای کانال (۲ مورد) | ✅ `SendButton` مشترک + اصلاح جهت اشتباه در RTL |
| نمایشگر مکالمهٔ ادمین | ✅ Primitiveهای مشترک + `break-words` + `dir="auto"` |

**جهت پیام‌ها:** قبلاً ۳ قرارداد متفاوت هم‌زمان وجود داشت و در سطوح داخلی با تغییر Locale آینه می‌شد. الان همهٔ سطوح لیست پیام را `dir="ltr"` Pin می‌کنند و **پیام کاربر/مشتری سمت راست و ایجنت/اپراتور سمت چپ** است — یکسان در فارسی و انگلیسی. متن داخل Bubble با `dir="auto"` جهت درست خود را حفظ می‌کند.

### Medium (رفع‌شده)
- لینک‌های فوتر به صفحات اشتباه: «خدمات و رزرو» صفحهٔ پشتیبانی را باز می‌کرد و «پشتیبانی مشتری» صفحهٔ چت‌بات فارسی را (راستی‌آزمایی با slugهای `lib/marketing/solutions.ts`)
- پسوند دوگانهٔ برند در عنوان هر ۱۷ صفحهٔ مستندات: «… — Vigent Docs — Vigent»
- صفحهٔ فهرست بلاگ بدون هیچ Metadata (عنوان/توضیح پیش‌فرض سایت، بدون Canonical) در حالی که Sitemap آن را با Priority 0.8 و Crawl روزانه تبلیغ می‌کرد
- `nofollow` + `target=_blank` روی **لینک‌های داخلی** بلاگ → مقالات SEO خود پلتفرم هیچ اعتباری به `/pricing` و `/solutions/*` منتقل نمی‌کردند
- ناهمخوانی Workspace بلاگ بین Sitemap و صفحات: با تنظیم `PLATFORM_WORKSPACE_ID`، Sitemap آدرس‌های ۴۰۴ تبلیغ می‌کرد (۳ Resolver محلی حذف و به یک منبع مشترک تبدیل شد)
- Scroll آزاردهنده: چت‌لینک روی هر Delta و هر Poll اپراتور به پایین می‌پرید (شاخهٔ «احترام به خواننده» کد مرده بود)؛ Playground روی هر توکن؛ Vigento اصلاً Container اسکرول نداشت
- برچسب Hardcoded فارسی «پیام‌های جدید ↓» در کامپوننت Locale-aware

---

## ۴. گزارش تست‌ها

| تست | نتیجهٔ واقعی |
|---|---|
| **Type Check** (`tsc --noEmit`) | ✅ صفر خطا — اجرای نهایی 2026-07-28 |
| **Lint** (`next lint`) | ✅ صفر خطا و Warning — اجرای نهایی 2026-07-28 |
| **Build** (`next build`) | ✅ در موج قبلی موفق (First Load JS مشترک ۱۰۳kB)؛ در موج متمرکز فعلی برای پرهیز از اجرای غیرضروری تکرار نشد |
| **Unit + Integration** (`vitest run`) | ✅ **۶۸ فایل / ۳۵۰ تست** — همه پاس (خط مبنای موج فعلی: ۳۴۲؛ **+۸ تست جدید**) |
| **Syntax ویجت** (`node --check`) | ✅ `public/widget/loader.js` سالم — اجرای نهایی 2026-07-28 |
| **End-to-End** | ❌ **اجرا نشد** — این پروژه Runner E2E ندارد (Playwright/Cypress نصب نیست) |
| **Mobile (بصری)** | ❌ **اجرا نشد** — مرورگر و Automation در دسترس نبود؛ همهٔ یافته‌های موبایل مبتنی بر کد است |
| **Security (فعال)** | ❌ Scan فعال اجرا نشد — ممیزی، مبتنی بر خواندن کد و بازتولید منطقی بود |
| **Performance (Core Web Vitals)** | ❌ **اندازه‌گیری نشد** — نیاز به مرورگر واقعی/Lighthouse |
| **Load Test** | ❌ **اجرا نشد** — نیاز به محیط Staging با ردیس/دیتابیس واقعی |

### تست‌های جدید اضافه‌شده در ممیزی اولیه (۱۵ مورد)
- `tests/customer-identification.test.ts` (۷) — رگرسیون استخراج نام فارسی، شامل چهار جملهٔ خریدی که قبلاً نام می‌شدند
- `tests/json-ld-escaping.test.ts` (۴) — Escape شدن `</script>`، هر دو Angle bracket، U+2028/9، و صحت JSON نهایی
- `tests/instagram-global-routing.test.ts` (۳ جدید) — Batch چند‌اکانتی، رد مسیریابی با آیدی کامنت‌گذار، رد Fallback وقتی کانال غیرفعال دیگری وجود دارد
- `tests/meta-webhook-security.test.ts` (۱ جدید + بازنویسی) — پاسخ ۵۰۳ هنگام قطع صف

### تست‌های جدید موج تکمیلی (۸ مورد)
- `tests/knowledge-pipeline.test.ts` (۴) — سقف Chunk، حفظ Q/A، نرمال‌سازی فارسی و Relevance/Curated ranking
- `tests/outbound-text-chunks.test.ts` (۲) — حفظ متن زیر سقف پلتفرم و عدم شکستن Emoji surrogate pair
- `tests/markdown-links.test.ts` (۱) — Allowlist مطلق HTTP(S) و رد `javascript:`/`data:`/URL نسبی
- `tests/business-role-templates.test.ts` (۱) — قواعد واقعی غذا و نوبت/درمان و حذف مثال‌های Commerce نامرتبط

> **صداقت روی ادعاها:** هیچ بخشی را «سالم» اعلام نکردم مگر با ارجاع به کد یا تست. مواردی که قابل تأیید نبودند صریحاً در بخش ۹ آمده‌اند.

---

## ۵. گزارش AI و RAG

### کیفیت Templateها — بهتر از انتظار
Templateهای نقش، **Prompt عمومی سطحی نیستند**: ۸ Vertical × قطعات فروش/پس‌از‌فروش/پشتیبانی در یک Config توصیه‌شده Merge می‌شوند و شامل مدیریت اعتراض، قواعد ضدHallucination («هرگز قیمت را حدس نزن — فقط از کاتالوگ»، «قول تخفیف نده مگر در دانش باشد»)، مسیر ارجاع به اپراتور و Few-shot Q&A هستند. System Prompt از ۶ لایه (`promptConfig`) ساخته می‌شود.

**شکاف واقعی:** فیلد «ساعات کاری» در مدل وجود ندارد و در Prompt تزریق نمی‌شود.

### کیفیت Prompt و مهار Hallucination — نقطهٔ قوی معماری
ادعاهای محصول **نمی‌توانند** ساختگی به مشتری برسند: هر Marker `[[product:{…}]]` در `products/presentation.ts` مجدداً از ردیف‌های فعالِ منتسب به همان ایجنت در دیتابیس حل می‌شود؛ قیمت و شناسهٔ تولیدشدهٔ مدل هرگز نمایش داده نمی‌شود. Chunkهای بازیابی‌شده داخل Fence دادهٔ `<knowledge>` با Defusing تزریق قرار می‌گیرند.

**اصلاح شد:** Fence با `</knowledge>` قابل شکستن بود (سند خزیده‌شدهٔ آلوده) — به‌عنوان Defense-in-depth ثبت شد.
**ثبت شد (رفع‌نشده):** هیچ دستور ضدافشا در Prompt نیست، پس مشتری می‌تواند معمولاً System Prompt (لایه‌های شخصیت، قواعد کسب‌وکار، بلوک کاتالوگ) را استخراج کند. مرز مستاجری نمی‌شکند، ولی قواعد داخلی افشا می‌شود.

### کیفیت Retrieval — تأییدشده
- **Tenant Isolation در SQL تأیید شد:** تنها کوئری برداری کد، در **هر دو** CTE برداری و لغوی `workspaceId` و `agentId` را فیلتر می‌کند (`lib/knowledge/vector-store.ts`)؛ grep روی `<=>` تأیید کرد کوئری دیگری وجود ندارد
- **ایندکس HNSW cosine** در Migration موجود است و با عملگر `<=>` تطابق دارد؛ ایندکس GIN با `to_tsvector('simple', content)` هم‌خوان است
- **Retrieval واقعاً در پاسخ استفاده می‌شود** (مسیر `chat-engine → retrieveContext → buildMessages` ردیابی شد)
- Hybrid Search با RRF Fusion + Boost تازگی؛ ابعاد ۱۵۳۶ صریحاً Pin شده
- امنیت آپلود: Allowlist پسوند، Magic bytes برای PDF، اعتبارسنجی UTF-8، سقف ۲۰MB در جریان Body، Budget روزانهٔ Fail-closed، SSRF مهارشده با DNS Pinning

**بهبود اعمال‌شده:** ورودی نسل‌بندی‌شده (Shadow generation) با Swap اتمی — یک قطعی Provider دیگر KB را خالی نمی‌کند.
**بهبود موج تکمیلی:** Relevance gate برداری/لغوی، نرمال‌سازی فارسی، اولویت دانش دست‌نویس، Chunk اختصاصی FAQ و تست‌های Deterministic اضافه شد. **محدودیت باقی‌مانده:** Dedup نزدیک‌به‌تکراری و تست Integration با PostgreSQL/pgvector و Provider واقعی هنوز وجود ندارد.

### مدیریت حافظه و Context
`HISTORY_LIMIT = 12` پیام ثابت، **بدون خلاصه‌سازی** و بدون Budget توکن. مکالمات طولانی (Threadهای چسبندهٔ پیام‌رسان‌ها) هر چیزی قدیمی‌تر از ۱۲ پیام را از دست می‌دهند: بودجهٔ اعلام‌شده، سایز، انتخاب‌های توافق‌شده. **ثبت شد به‌عنوان Improvement** — نیاز به خلاصهٔ غلتان روی ردیف Conversation.

**Tenant Isolation در ساخت Context تأیید شد:** مکالمه با `(workspaceId, agentId)`، History با `conversationId`، کاتالوگ با انتساب `agentId`، سفارش‌ها با `workspaceId` + هویت مخاطب. هیچ مسیر نشت بین‌مستاجری یا بین‌مخاطبی پیدا نشد. Cache امبدینگ ردیس Input-pure است (Hash مدل+متن).

### تست‌های انجام‌شده روی AI
مجموعهٔ ارزیابی کیفی زندهٔ مدل ساخته نشد، چون به فراخوانی واقعی Provider، هزینه و Credential نیاز دارد. در عوض، تست‌های Deterministic برای استخراج نام، رفتار صنفی Prompt، Chunking/Ranking/Normalization دانش و برنامه‌ریزی درخواست محصول اضافه شده‌اند. نتیجهٔ نهایی کل Suite در بخش ۴ ثبت می‌شود.

---

## ۶. گزارش کانال‌ها

> **محدودیت صریح:** هیچ کانالی با Credential زنده تست نشد. همهٔ نتایج زیر از خواندن کامل کد و مسیر اجرا به‌دست آمده‌اند. **ادعای سالم‌بودن کامل هیچ کانالی مطرح نمی‌شود.**

| کانال | اتصال | دریافت | ارسال | Media | Retry | Rate Limit | امنیت | وضعیت |
|---|---|---|---|---|---|---|---|---|
| **Instagram** | OAuth سراسری (Instagram Login) + Legacy | ✅ صف پایدار (اصلاح‌شده) | ✅ Split در ۱۹۰۰ کاراکتر، Probe دو Host | ⚠️ تصویر/ویدیو/کاروسل ✅ — **ورودی Media بی‌صدا Drop می‌شود** | ✅ ۳ تلاش + Backoff (اصلاح‌شده) | ⚠️ Per-provider ندارد | ✅ HMAC + State امضاشده | **رفع‌شده، تست‌نشده** |
| **Telegram** | Bot token | ✅ صف پایدار (از قبل) | ✅ Split خوانای زیر سقف ۴۰۹۶ + fallback امن HTML | ✅ صوت دوطرفه | ✅ + Timeout | ⚠️ ۱۲۰/دقیقه per-token | ✅ Token تصادفی ۲۴ بایتی | **کامل‌ترین کانال** |
| **Bale** | Bot token | ✅ صف پایدار | ⚠️ **Markdown خام `**` نمایش می‌دهد** | ✅ صوت | ✅ | ⚠️ | ✅ | تقریباً کامل |
| **Rubika** | Bot token (API غیررسمی) | ✅ صف پایدار | ⚠️ فقط متن | ❌ **پیام صوتی Parse می‌شود ولی بی‌صدا Drop** | ⚠️ خطای داخل Body 200 تشخیص نمی‌شود | ⚠️ | ✅ | **Stub — باید به مالکان اعلام شود** |
| **Website Widget** | Public + Token HMAC | ✅ SSE | ✅ Streaming | ✅ کارت محصول | ✅ | ✅ Fail-closed | ✅ + گیت کانال (اصلاح‌شده) | **رفع‌شده** |
| **Chat Link** | Public + Token HMAC | ✅ SSE | ✅ Streaming | ✅ | ✅ | ✅ | ✅ | خوب |
| **Operator (Telegram)** | Bot per-workspace | ✅ | ✅ | — | ✅ | ✅ | ✅ HMAC مشتق از workspace+token | ⚠️ Diagnostics خراب |

### Mock و Integration Test ایجادشده
برای کانال‌هایی که Credential نداشتند، تست‌های Mock نوشته/تقویت شد: مسیریابی سراسری اینستاگرام (۵ تست)، امنیت وبهوک متا (۵ تست)، وبهوک Bot اپراتور، تحویل خروجی، Config کانال‌ها، Entitlement کانال.

---

## ۷. گزارش Performance

- **Bundle:** First Load JS مشترک **۱۰۳kB** بدون تغییر پس از تمام اصلاحات. Middleware ۸۷.۳kB. سنگین‌ترین مسیرها: `/settings` ۱۸.۶kB، `/products` ۱۳.۴kB، `/onboarding` ۱۱.۶kB
- **بهبود واقعی:** رفع نشت Connection ردیس (C4) بزرگ‌ترین برد Performance تحت بار است — قبلاً هر پاسخ AI دو اتصال TCP تازه می‌ساخت
- **Queryها:** ثبت شد که `/blog/[slug]` حدود ۷ کوئری بدون Cache به‌ازای هر بازدید اجرا می‌کند (`generateMetadata` و بدنهٔ صفحه همان ردیف‌ها را دو بار می‌خوانند) — **رفع‌نشده**، نیاز به `cache()` یا ISR
- **مسیریابی کانال:** ثبت شد که Resolve کانال اینستاگرام روی Miss، Full-table scan در حافظه انجام می‌دهد (JSON path در Postgres بدون ایندکس Expression پشتیبانی ایندکسی ندارد) — **رفع‌نشده**، نیاز به ستون‌های ایندکس‌دار
- **Core Web Vitals:** ❌ **اندازه‌گیری نشد** — نیاز به مرورگر واقعی. هیچ ادعایی درباره LCP/CLS/INP مطرح نمی‌شود

---

## ۸. گزارش امنیت

### رفع‌شده
۳ مورد Critical نشت داده (C1، C2، C6)، ۱ مورد Critical ربودن هویت (C7)، ۱ مورد Critical XSS ذخیره‌شده (C5)، افشای Seed 2FA در لاگ (H8)، Oracle ورود مرحله‌به‌مرحله (H8)، Session ادمین غیرقابل‌ابطال (H9)، گیت کانال ویجت و بازگشت خطرناک allowlist دامنه (H14).

### نقاط قوی تأییدشده (با ارجاع به کد)
- **Tenant Isolation:** الگوی یکدست `findFirst({ where: { id, workspaceId } })` در ~۱۱۱ Route؛ هر ۱۳ Handler زیر `app/api/admin/**` جداگانه Gate دارند؛ `platformRole === 'ADMIN'` روی کاربر عادی هیچ دسترسی به پنل ادمین نمی‌دهد
- **ابطال Session:** `lib/session.ts` ردیف User را در **هر** درخواست از دیتابیس می‌خواند، پس حذف کاربر یا جابه‌جایی Workspace فوراً JWTهای کهنه را باطل می‌کند
- **SSRF:** مهار مرکزی در `lib/security/safe-http.ts` با DNS Pinning، Blocklist آدرس‌های خصوصی، اعتبارسنجی مجدد Redirect و سقف بایت
- **OTP:** `randomInt` رمزنگاشتی، TTL ده‌دقیقه‌ای، Lua اتمی Compare-and-delete، سقف ۳ ارسال/شماره/ساعت + ۱۰ در ساعت per-IP + ۱۰ تلاش تأیید/شماره و ۳۰/کلاینت — همه Fail-closed
- **امضای وبهوک:** HMAC روی بایت‌های خام با `timingSafeEqual`
- **رمزنگاری در Rest:** AES-256-GCM برای همهٔ توکن‌های کانال
- **پرداخت:** تأیید امضا/مبلغ و Idempotency در Callback

### ریسک‌های باقی‌مانده (رفع‌نشده)
- **Session ادمین همچنان Stateless** است (ابطال فقط با تغییر `ADMIN_PASS` — بهبود یافت ولی Nonce Store ندارد)
- **شناسایی کاربر از `/api/auth/otp/send`**: پاسخ `isNewUser` مشخص می‌کند کدام شماره ثبت‌نام کرده (محدود به ۱۰/ساعت per-IP؛ Tradeoff عمدی UX)
- **Matcher میدل‌ور Drift دارد**: ورودی‌های `/api/*` در Matcher عملاً چیزی محافظت نمی‌کنند (هر Route خودش `getCurrentUser` را چک می‌کند، پس افشای واقعی نیست — ولی حس امنیت کاذب می‌دهد)
- **Route عمومی `channels` POST**: Config دلخواه می‌پذیرد و می‌تواند Credential ذخیره‌شده را Overwrite کند (ربودن ممکن نیست چون Ciphertext جعل‌شدنی نیست، ولی DoS با Drop پیام ممکن است)
- **افشای System Prompt** با Prompt Injection (مرز مستاجری نمی‌شکند)

### مواردی که نیاز به بررسی انسانی یا Credential واقعی دارند
۱. رفتار واقعی Batching متا در Production (اصلاح C1/C2 بر پایهٔ رفتار مستند پلتفرم است)
۲. تأیید اینکه Private Reply (H10) در عمل تحویل می‌دهد — نیاز به اکانت زنده
۳. صحت استخراج متن فارسی از PDF توسط `pdf-parse` (ترتیب RTL، Ligature)
۴. اینکه آیا OpenRouter برای مدل‌های Qwen با سقف قیمت جدید Provider دارد
۵. Scan فعال امنیتی (SAST/DAST) و تست نفوذ

---

## ۹. ریسک‌های باقی‌مانده

| ریسک | شدت | توضیح |
|---|---|---|
| هیچ کانالی با Credential زنده تست نشد | **بالا** | همهٔ اصلاحات کانال از Build/Test/بازبینی کد عبور کرده‌اند، ولی مسیر واقعی متا/واتساپ تأیید نشده. **قبل از تبلیغات، یک تست دستی end-to-end روی هر کانال الزامی است** |
| نبود تست بصری موبایل | متوسط | Playwright در دسترس نبود؛ همهٔ یافته‌های موبایل مبتنی بر کد است. اصلاحات Composer و منوی موبایل نیاز به تأیید چشمی روی دستگاه واقعی دارند |
| نبود تست Integration زنده RAG | متوسط | Primitiveهای Chunking، Normalization و Ranking تست دارند، اما SQL واقعی pgvector، PDFهای فارسی دشوار و Provider امبدینگ فقط در Staging قابل تأییدند |
| Context ثابت ۱۲ پیام بدون خلاصه‌سازی | متوسط | مکالمات طولانی اطلاعات قبلی را از دست می‌دهند |
| ورودی Media اینستاگرام Drop می‌شود | متوسط | مشتری عکس محصول می‌فرستد → سکوت کامل و اپراتور هم نمی‌بیند |
| Locale کوکی‌محور بدون hreflang | متوسط | کل بومی‌سازی EN برای خزنده‌ها نامرئی است — تصمیم محصولی لازم است |
| Rubika در سطح Stub | پایین | باید در UI به مالکان به‌عنوان «فقط متن» اعلام شود |
| Scheduler درون‌پروسه بدون قفل | پایین | با بیش از یک Worker، Sweepها هم‌پوشانی می‌کنند (قفل ردیس فقط برای یادآور نوبت وجود دارد) |

---

## ۱۰. چک‌لیست Deploy

> اسکریپت `deploy/deploy.sh` موجود، **کیفیت بالایی دارد** و بیشتر این مراحل را خودکار انجام می‌دهد: Pull با `--ff-only`، `npm ci` (قفل‌شده)، اعتبارسنجی env، `prisma generate`، **Build قبل از تغییر دیتابیس**، **Backup اجباری قبل از Migration** (Fail-closed)، `migrate deploy`، سپس Restart با Gate سلامت (۳ بررسی متوالی با PID یکسان).

### قبل از Deploy
- [ ] `git status` پاک باشد و روی `main` باشید
- [ ] **کامیت موج Launch-critical این گزارش Deploy شود** و hash آن در Release ثبت شود
- [ ] `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm test` ✅ · `npm run build` ✅ (همه تأیید شدند)
- [ ] `npm run check:production-env` روی سرور اجرا شود
- [ ] `.env` سرور شامل: `REDIS_URL`، `DATABASE_URL`، `OPENROUTER_API_KEY`، `META_APP_SECRET`، `META_APP_VERIFY_TOKEN`، `INSTAGRAM_APP_SECRET`، `ADMIN_OWNER_PHONE`، `ADMIN_PASS`، `ADMIN_TOTP_SECRET`، `ADMIN_SESSION_SECRET`، `AUTH_SECRET`، `TRUST_PROXY_HEADERS=1`
- [ ] `package-lock.json` با `package.json` هم‌خوان باشد (این کار هیچ Dependency جدیدی اضافه نکرده — صفر تغییر در `package.json`)
- [ ] Backup دستی تأیید شود: `bash deploy/backup.sh` و وجود فایل Dump بررسی شود
- [ ] **مهم:** با اعمال این نسخه، وبهوک‌های سراسری متا حالا **۵۰۳** برمی‌گردانند اگر ردیس در دسترس نباشد. مطمئن شوید ردیس قبل از Deploy سالم است، وگرنه متا رویدادها را صف می‌کند

### هنگام Deploy
- [ ] `bash deploy/deploy.sh` (خودش Backup و Gate سلامت دارد)
- [ ] هیچ Migration مخربی در این تغییرات وجود ندارد — **صفر Migration جدید** (تغییر ورودی دانش از فیلد `metadata` موجود استفاده می‌کند)
- [ ] خروجی `pm2 status` بررسی شود: `vignet-web` و `vignet-worker` هر دو `online`
- [ ] تأیید شود Worker با `kill_timeout: 60000` جدید بالا آمده (`pm2 describe vignet-worker`)

### بعد از Deploy
- [ ] `curl -sf http://127.0.0.1:3003/api/health` پاسخ ۲۰۰ بدهد
- [ ] **صف کار می‌کند:** یک پیام تست به یک کانال متصل بفرستید و در `pm2 logs vignet-worker` عبارت `inbound-message job` را ببینید — این ثابت می‌کند مسیر جدید صف فعال است
- [ ] **Idempotency:** همان پیام دوباره ارسال نشود (بازارسال متا) — یک پاسخ باید بیاید نه دو
- [ ] یک گفتگو در ویجت وب انجام دهید: Streaming، کارت محصول، و **قطع Tab در میانهٔ پاسخ** → پاسخ باید در Inbox ذخیره شده باشد
- [ ] هدر سایت را روی موبایل (≤۷۶۸px) باز کنید: منوی جدید، سوییچ زبان و CTA باید کار کنند
- [ ] `/menu/<slug>` یک Workspace با محصول بررسی شود (تأیید اصلاح XSS و صحت JSON-LD)
- [ ] `/admin/errors` را برای خطاهای جدید `webhook:*` و `scheduler:oauth-token-refresh` رصد کنید
- [ ] `redis-cli info clients` — تعداد `connected_clients` باید **پایدار** بماند (تأیید رفع C4؛ قبلاً مدام رشد می‌کرد)
- [ ] Login ادمین تست شود (پیام خطا حالا عمومی است — این تغییر عمدی است)

---

## ۱۱. برنامه Rollback

### ۱. Rollback کد (بدون ازدست‌رفتن داده)
این نسخه **هیچ Migration دیتابیسی ندارد**، پس Rollback کد کامل و بی‌خطر است:
```bash
cd /path/to/vignet
git log --oneline -5                 # کامیت پایدار قبلی را پیدا کنید
git checkout <commit-پایدار>
npm ci
npx prisma generate
npm run build
pm2 restart deploy/ecosystem.config.js --update-env
curl -sf http://127.0.0.1:3003/api/health
```

### ۲. نکات مهم Rollback
- **Migration لازم نیست برگردد** — Schema تغییری نکرده است
- **دادهٔ نسل‌بندی دانش:** Chunkهای جدید یک فیلد `generation` در `metadata` دارند؛ کد قدیمی این فیلد را نادیده می‌گیرد (سازگار به عقب)
- **Jobهای صف:** با Rollback، Jobهای `inbound-global` در صف باقی می‌مانند و Worker قدیمی آن‌ها را نمی‌شناسد. **قبل از Rollback** صف را خالی کنید یا اجازه دهید تخلیه شود:
  ```bash
  pm2 logs vignet-worker --lines 50   # صبر کنید تا صف خالی شود
  ```
- **Config کانال‌ها:** Job تمدید توکن ممکن است توکن‌ها را به‌روز کرده باشد؛ این‌ها با کد قدیمی هم کار می‌کنند (فقط دیگر Refresh نمی‌شوند)

### ۳. بازگردانی دیتابیس (فقط در صورت Corruption)
```bash
ls -lh /var/backups/vignet/          # آخرین Dump قبل از Deploy
pm2 stop vignet-web vignet-worker
gunzip -c /var/backups/vignet/<dump>.sql.gz | psql "$DATABASE_URL"
pm2 start vignet-web vignet-worker
```
> ⚠️ بازگردانی دیتابیس، پیام‌ها و مکالمات بعد از زمان Backup را از دست می‌دهد. فقط در صورت Corruption واقعی انجام شود، نه برای باگ کد.

### ۴. Rollback جزئی (توصیه‌شده در صورت مشکل کانال)
اگر فقط مسیر صف مشکل داشت، بدون Rollback کامل: `DISABLE_QUEUE=1` را در `.env` بگذارید و Web را Restart کنید — مسیرهای سراسری به پردازش Inline برمی‌گردند (غیرپایدار ولی فعال) تا مشکل ردیس حل شود.

---

## ۱۲. نتیجه نهایی

# ✅ Ready with Minor Risks

**مبنای این نتیجه:**

**آنچه تأیید شده است (با شواهد):**
- Build بدون خطا · صفر خطای TypeScript · صفر خطای Lint · ۳۲۸/۳۲۸ تست پاس
- هر ۸ مورد Critical رفع و برای موارد کلیدی تست رگرسیون اضافه شد
- Tenant Isolation در ~۱۱۱ Route API و در SQL بازیابی RAG با ارجاع به کد بازبینی شد
- پیام‌ها در سه سناریوی گم‌شدن (قطع پلن، Restart، خطای گذرا) حالا حفظ می‌شوند
- وبهوک‌ها Idempotent هستند (Claim اتمی ردیس روی `platformMessageId`)
- مسیرهای ورودی همه از صف پایدار عبور می‌کنند و روی قطع صف ۵۰۳ می‌دهند
- رابط گفتگو در هر ۸ سطح یکپارچه شد؛ پیام کاربر سمت راست و ایجنت سمت چپ در همهٔ Localeها
- Deploy و Rollback مستند و قابل‌اجرا هستند و Migration مخربی وجود ندارد

**چرا «Minor Risks» و نه «Ready for Production» کامل:**
هیچ کانالی با Credential زنده تست نشد و هیچ تست بصری مرورگر انجام نشد. این‌ها محدودیت محیط بودند، نه انتخاب. اصلاحات کانال از نظر کد و تست درست‌اند ولی مسیر واقعی متا تأیید نشده است.

**توصیهٔ عملی برای انتشار:**
۱. این تغییرات را Commit و Deploy کنید (چک‌لیست بخش ۱۰)
۲. **قبل از شروع تبلیغات**، یک بار دستی هر کانال متصل را end-to-end تست کنید — یک DM، یک کامنت با قیف، یک پیام واتساپ، یک گفتگوی ویجت
۳. ۴۸ ساعت `redis-cli info clients` و `/admin/errors` را رصد کنید
۴. سپس با اطمینان کاربر واقعی جذب کنید

**پیشنهاد اولویت بعدی (پس از انتشار):** تست Integration زنده RAG · ورودی Media اینستاگرام · خلاصهٔ غلتان Context · تصمیم درباره Locale مسیرمحور برای SEO انگلیسی · قفل توزیع‌شده Scheduler.
