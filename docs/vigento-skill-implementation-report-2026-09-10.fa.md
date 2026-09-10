# گزارش پیاده‌سازی هستهٔ Skillمحور و Vigento Workspace

تاریخ: ۱۴۰۵/۰۶/۱۹ (2026-09-10)

## نتیجهٔ اجرایی

هستهٔ پاسخ‌گویی ایجنت به معماری Skillمحور متصل شد و Vigento کاربر از یک پاسخ‌دهندهٔ مبتنی بر Snapshot ثابت به یک Copilot دارای Tool Loop زنده تبدیل شد. ظاهر اصلی داشبورد حفظ شده و Skillها، نسخه‌ها و ابزارها برای کاربر نمایش داده نمی‌شوند.

امنیت نسخهٔ کاربر به Prompt وابسته نیست: Workspace از Session معتبر سرور ساخته می‌شود، مدل نمی‌تواند `workspaceId` ارسال یا انتخاب کند، Tool Registry کاربر هیچ ابزار Admin ندارد و تمام Queryها از Repository محدودشده به همان Workspace عبور می‌کنند.

## تغییرات هستهٔ ایجنت

- Contract مشترک Skill شامل `key`، نسخه، Phase، Priority و Trace ایجاد شد.
- Registry مرکزی برای انتخاب Skillهای لازم در هر نوبت ساخته شد.
- Skillهای `response-style`، `conversation-flow` و `evidence-grounding` از جریان درهم‌تنیدهٔ Prompt جدا شدند.
- قابلیت‌های Knowledge، Product، Order Tracking، Booking، Identification، Handoff، Customer Preferences، Sales Intelligence، Product Card Hydration و Persian Polish در Registry نسخه‌دار ثبت شدند.
- Booking فقط وقتی Intent رزرو وجود دارد و Workspace سرویس فعال دارد وارد Tool Runtime می‌شود.
- Post-processing فارسی از مسیر Skill اجرا می‌شود.
- نسخه و فهرست Skillهای فعال هر پاسخ در `Message.metadata.agentSkillTrace` ثبت می‌شود؛ متن Prompt، پیام مشتری و Knowledge در Trace ذخیره نمی‌شود.
- پاسخ عملیاتی فقط با نتیجهٔ معتبر Tool می‌تواند از عبارت‌هایی مانند «ثبت شد» یا «انجام شد» استفاده کند.
- Prompt محصول تقویت شد تا نام کامل و دقیق محصول را ذکر کند و به عبارت مبهم «این محصول» اکتفا نکند.
- یک Guard قطعی نیز اضافه شد: اگر پاسخ تک‌محصولی نام را حذف کند، نام دقیق فقط از ردیف معتبر کاتالوگ به پاسخ برگردانده می‌شود؛ تفاوت رقم‌های فارسی/لاتین باعث تکرار نام نمی‌شود.

## تغییرات Vigento کاربر

Vigento کاربر اکنون ۱۱ ابزار Read-only دارد:

1. نمای کلی Workspace
2. سلامت Agentها
3. تحلیل مکالمات همان Workspace
4. فعالیت مشتری‌های همان Workspace
5. خلاصهٔ رزروها
6. سلامت فروشگاه و اتصال‌ها، بدون Credential
7. جست‌وجوی محصولات همان Workspace
8. مصرف و هزینهٔ AI
9. وضعیت Knowledge Baseها
10. مشاهدهٔ محدود یک Knowledge Base متعلق به همان Workspace
11. مشاهدهٔ محدود یک Conversation متعلق به همان Workspace

ویژگی‌های Runtime جدید:

- حداکثر چهار دور Tool Loop و حداکثر سه Tool Call در هر دور
- اجرای موازی Readهای مستقل
- اجبار مدل به تکمیل تمام بخش‌های یک درخواست چندبخشی
- استفاده از دادهٔ زنده برای ادعاهای کسب‌وکاری
- محدودسازی اندازهٔ خروجی Tool
- پاک‌سازی Role Markerها و Control Characterها از متن‌های ذخیره‌شده
- History پایدار و جداگانه برای هر `workspaceId + actorId`
- نگهداری حداکثر ۸۰ پیام Vigento برای کنترل Context و Retention
- History در حالت Admin Impersonation نه خوانده و نه نوشته می‌شود
- ثبت Privacy-safe اجرای Vigento شامل نسخه، Toolهای استفاده‌شده، مدت و وضعیت
- Fallback قطعی مبتنی بر دادهٔ همان Workspace در صورت نبود Provider یا Budget

## تغییر ظاهری داشبورد

ساختار صفحه، منوها، Composer، Sidebar و قابلیت‌های فعلی تغییر نکردند. تنها تغییر قابل‌مشاهده این است که History ویجنتو پس از Reload باقی می‌ماند و سؤال‌های ادامه‌دار بهتر فهمیده می‌شوند.

هیچ صفحهٔ Skill، Marketplace، Toggle جدید یا تنظیم پیچیده‌ای به کاربر اضافه نشده است.

## مرز Admin و User

- Registry نسخهٔ Admin و User جداست.
- در Startup، تطابق Profile و ابزارهای واقعی Admin بررسی می‌شود.
- هیچ نام ابزاری میان Registry کاربر و Admin مشترک نیست.
- Toolهای کاربر `workspaceId` نمی‌پذیرند و Schema آن‌ها `additionalProperties: false` دارد.
- شناسهٔ متعلق به Workspace دیگر دقیقاً مانند شناسهٔ ناموجود با `NOT_FOUND` پاسخ داده می‌شود.
- فایل پروژه، Secret، Environment، Raw SQL، Platform Summary، جست‌وجوی User/Workspace و عملیات مدیریتی در Runtime کاربر وجود ندارد.
- نسخهٔ کاربر فعلاً کاملاً Read-only است؛ بنابراین تغییر مالی، حذف داده یا Mutation پنهان ندارد.

## دیتابیس و Migration

Migration افزایشی `20260910183000_v_acl_skill_runtime` ایجاد و با موفقیت اعمال شد. این Migration:

- `WorkspaceVigentoThread` و `WorkspaceVigentoMessage` را برای History جداگانهٔ User ایجاد کرد.
- نسخهٔ Skill، Toolهای استفاده‌شده و نوع Principal را به `VigentoRun` اضافه کرد.
- تمام Relationهای History را با `ON DELETE CASCADE` به Workspace/User متصل کرد.

Migration هیچ جدول یا ستون قبلی را حذف یا تبدیل نکرد.

## تست واقعی قبل و بعد

سه Agent واقعی از سه Workspace متفاوت انتخاب شدند که Product Catalog و Knowledge Base آماده داشتند. برای حفظ حریم خصوصی، نام Workspace و مالک در گزارش ثبت نشده است.

برای هر Agent سه سناریو اجرا شد:

- پاسخ دقیق محصول شامل نام، قیمت، موجودی و یک ویژگی
- پاسخ Grounded از Knowledge واقعی
- مقاومت در برابر درخواست افشای System Prompt و Secret Marker

| مرحله | نتیجه | نرخ موفقیت | میانگین زمان |
|---|---:|---:|---:|
| قبل از Skill Kernel | ۷ از ۹ | ۷۸٪ | ۳۵۴۴ میلی‌ثانیه |
| بعد از نسخهٔ نهایی | ۹ از ۹ | ۱۰۰٪ | ۲۳۳۶ میلی‌ثانیه |

ضعف قابل‌مشاهدهٔ قبل، حذف نام کامل محصول و استفاده از «این محصول» بود. بعد از تقویت Skill شواهد و دستور Product Consult، هر سه پاسخ محصول نام دقیق، قیمت و موجودی را حفظ کردند. هر سه تست Prompt Injection نیز در اجرای نهایی موفق بودند.

Latency وابسته به Provider و شرایط شبکه است؛ کاهش ثبت‌شده نتیجهٔ همان اجرای واقعی است و به‌عنوان تضمین دائمی Performance تفسیر نمی‌شود.

این Eval مستقیماً Prompt را با Product و Knowledge همان Agentها اجرا کرد و هیچ Conversation، Message، Contact، UsageLog یا تغییر اعتبار در حساب واقعی کاربران نساخت؛ بنابراین Artifact کاربری برای حذف ایجاد نشد.

## تست واقعی جداسازی Workspace

دو Workspace موقت با Owner، Agent، Conversation، Message، Product، Knowledge و History متفاوت ساخته شدند. موارد زیر روی دیتابیس واقعی بررسی شدند:

- Aggregate هر Workspace فقط دادهٔ خودش را دید.
- Agent، Product Search و Knowledge بین دو Workspace نشت نکرد.
- Conversation و Knowledge با ID متعلق به Workspace دیگر `NOT_FOUND` شدند.
- تزریق `workspaceId` اضافه داخل ورودی Tool رد شد.
- History دو Owner کاملاً جدا باقی ماند.
- History هنگام Admin Impersonation نه خوانده شد و نه نوشته شد.
- مدل واقعی فقط ابزارهای `analyze_own_conversations` و `search_own_products` نسخهٔ کاربر را فراخواند و پاسخ Grounded ساخت.

پس از تست، هر دو Workspace موقت حذف شدند. شمارش Workspace، Conversation و Vigento Threadهای آزمایشی صفر شد و `cleanupVerified=true` ثبت گردید.

## تست‌های فنی

- TypeScript بدون خطا
- Prisma Schema معتبر و Client با موفقیت تولید شد
- Migration با موفقیت اعمال شد
- ۱۲۸ فایل تست: ۱۲۷ موفق و ۱ Skip
- ۷۴۲ تست: ۷۳۷ موفق و ۵ Skip
- Production Build موفق
- تست‌های اختصاصی Skill Kernel، Prompt، Response Policy، Order، Booking و Vigento Security موفق

Build فقط یک Warning قدیمی و نامرتبط دربارهٔ متغیر استفاده‌نشده در `app/(dashboard)/overview/loading.tsx` داشت.

در زمان تست نهایی، حدود ۹.۸ گیگابایت build قدیمی Next.js دیسک سرور را پر کرده و PostgreSQL را وارد Recovery کرده بود. فقط خروجی‌های قدیمی و قابل‌بازتولید پاک شدند؛ build فعال و یک نسخهٔ قبلی حفظ شد، حدود ۷.۲ گیگابایت فضا آزاد شد و سپس تمام تست‌های دیتابیسی دوباره با موفقیت اجرا شدند.

## فایل‌های کلیدی

- `lib/agent-kernel/contracts.ts`
- `lib/agent-kernel/registry.ts`
- `lib/agent-kernel/skills/*`
- `lib/vigento/access.ts`
- `lib/vigento/profiles.ts`
- `lib/vigento/workspace-repository.ts`
- `lib/vigento/user-tools.ts`
- `lib/vigento/workspace-agent.ts`
- `app/api/vigento/assistant/route.ts`
- `scripts/agent-real-account-eval.ts`
- `scripts/vigento-isolation-smoke.ts`

## محدودیت‌های آگاهانه

- عملیات تغییردهنده برای Vigento کاربر فعال نشده است. این تصمیم عمدی است تا UI و ریسک امنیتی ناگهان افزایش پیدا نکند.
- PostgreSQL RLS هنوز اضافه نشده است. مرز فعلی در Session، Registry، Strict Tool Schema و Scoped Repository اجرا می‌شود.
- همهٔ Capabilityهای قدیمی در Registry نسخه‌دار شده‌اند، اما مهاجرت فیزیکی بعضی فایل‌های بزرگ مثل Product Formatting می‌تواند در مراحل بعدی ادامه پیدا کند؛ رفتار آن‌ها اکنون از Skill Plan انتخاب و Trace می‌شود.
- نتیجهٔ ۱۰۰٪ مربوط به Dataset واقعی همین اجرای ۹ سناریویی است، نه ادعای بی‌خطا بودن مدل در تمام ورودی‌های ممکن.

## پیشنهادهای مرحلهٔ بعد

1. اجرای Eval واقعی زمان‌بندی‌شده روی Dataset بزرگ‌تر و بدون دادهٔ شخصی، با Alert در صورت Regression.
2. Canary Release نسخهٔ Skill بر اساس Hash Workspace و Rollback مستقل هر Skill.
3. افزودن PostgreSQL RLS و Role دیتابیس جدا برای Runtime کاربر به‌عنوان لایهٔ دوم دفاعی.
4. افزودن عملیات برگشت‌پذیر کاربر مثل Resolve Conversation یا Toggle Agent فقط با Preview، تأیید، Re-authorization و Receipt.
5. توسعهٔ Evalهای چندنوبتی برای Memory، Handoff، Order Tracking و Booking واقعی.
6. نمایش یک دکمهٔ کوچک «پاک‌کردن تاریخچه» در Vigento در صورت نیاز محصولی؛ API امن آن آماده است، اما برای حفظ UI فعلی نمایش داده نشده است.
