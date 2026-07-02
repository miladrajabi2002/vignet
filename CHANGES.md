# Vignet Improvements — CHANGES.md

این سند تمام تغییرات اعمال‌شده روی پروژه Vignet را به‌صورت فازبه‌فاز توضیح می‌دهد. هر فایل با مسیر کامل نسبت به ریشه پروژه آورده شده است.

---

## فاز ۱ — موتور پرامپت ۶ لایه‌ای + تمپلیت‌های نقش‌محور

### هدف
جایگزینی فیلد تک‌خطی `systemPrompt` با یک موتور ۶ لایه‌ای ساختاریافته: شخصیت، لحن، محدوده (بایدها/نبایدها)، رفتار هنگام عدم آگاهی، فرمت پاسخ، و پرسش‌وپاسخ نمونه. به‌علاوه ۵ قالب نقش آماده (مشاور پیش‌فروش، مشاور فروش/کلوزینگ، پیگیری، پشتیبانی بعد از خرید، پشتیبانی کامل).

### فایل‌های تغییر یافته

#### `prisma/schema.prisma`
- فیلدهای جدید روی `Agent`: `promptConfig Json?`, `roleTemplate String?`, `requireCustomerInfo Boolean @default(false)`, `customerInfoPrompt String? @db.Text`.
- فیلدهای جدید روی `KnowledgeBase`: `lastIngestedAt DateTime?`, `refreshIntervalHours Int @default(0)` (برای بازخوانی خودکار F4).
- فیلدهای جدید روی `Conversation`: `customerInfoState String @default("pending")`, `identifiedAt DateTime?`.
- رابطه `handoffAlerts` روی `Agent`, `Workspace`, `Conversation`.
- مدل‌های جدید: `OperatorChannel`, `HandoffAlert`, `StoreIntegration`, `StoreOrder`, `StoreSyncLog`.
- enum جدید: `StoreType` (WOOCOMMERCE, CUSTOM_URL, SHOPIFY).
- رابطه‌های جدید روی `Workspace`: `operatorChannels`, `storeIntegrations`, `handoffAlerts`.

#### `prisma/migrations/20260703000000_vignet_improvements_f1_f4/migration.sql` (جدید)
- Migration کامل PostgreSQL برای همه تغییرات F1 تا F4 (شامل pgvector و JSONB).

#### `lib/ai/prompt-builder.ts` (جدید)
- موتور ۶ لایه‌ای: `buildLayeredPrompt()`, `resolveSystemPrompt()`.
- ۵ قالب نقش در `ROLE_TEMPLATES`: `pre_sales`, `sales_consult`, `follow_up`, `post_sale_support`, `general_support`.
- هر قالب شامل شخصیت کامل، لحن، بایدها/نبایدها، رفتار fallback، فرمت، و ۲ نمونه پرسش‌وپاسخ.
- سازگار با گذشته: وقتی `promptConfig` خالی باشد، از `systemPrompt` قدیمی استفاده می‌شود.

#### `lib/ai/customer-identification.ts` (جدید)
- استخراج نام و شماره از پیام کاربر (`extractIdentity`) با regex فارسی و انگلیسی + نرمال‌سازی شماره ایرانی.
- `applyExtractedIdentity` برای ذخیره روی contact و به‌روزرسانی وضعیت گفتگو.
- `identificationInstruction` که دستور جمع‌آوری نام+شماره را به پرامپت تزریق می‌کند.
- `channelHasTrustedIdentity` و `initialState` برای تشخیص کانال‌های messanger (که هویت دارند) از وب‌ویجت.

#### `lib/ai/chat-engine.ts`
- اضافه شدن `promptConfig` و `roleTemplate` و `requireCustomerInfo`/`customerInfoPrompt` به `ChatAgent` interface.
- تابع جدید `buildSystemPrompt()` که لایه‌ها را assemble می‌کند + دستور identification را در صورت نیاز تزریق می‌کند.
- `shouldHandoff` حالا `{ handoff, reason }` برمی‌گرداند (دلیل انتقال هم ذخیره می‌شود).
- `notifyHandoff` حالا `createHandoffAlert` را با snapshot کامل مشتری (نام، شماره، کانال، دلیل) صدا می‌زند.
- در هر دو `startChat` و `generateReply`: استخراج identity، به‌روزرسانی contact، و استفاده از layered prompt.
- `resolveConversation` حالا `customerInfoState` را برمی‌گرداند و برای گفتگوهای جدید روی می‌گذارد.

#### `lib/validations/agent.ts`
- اسکیمای جدید `promptConfigSchema`, `promptFormatSchema`, `promptQAPairSchema`.
- `roleTemplateKeys` enum.
- `agentCreateSchema` و `agentUpdateSchema` حالا `promptConfig`, `roleTemplate`, `requireCustomerInfo`, `customerInfoPrompt` را قبول می‌کنند.

#### `app/api/agents/route.ts` (POST)
- ذخیره `promptConfig`, `roleTemplate`, `requireCustomerInfo`, `customerInfoPrompt`, `handoffKeywords`.

#### `app/api/agents/[agentId]/route.ts` (PATCH)
- مدیریت `Prisma.JsonNull` برای پاک کردن `promptConfig`.

#### `app/api/chat/route.ts` و `app/api/widget/[agentId]/chat/route.ts`
- select اضافه شدن `promptConfig`, `roleTemplate`, `requireCustomerInfo`, `customerInfoPrompt`.
- cast صحیح `JsonValue` → `PromptConfig`.

#### `lib/channels/handler.ts`
- `AGENT_SELECT` حالا فیلدهای جدید را شامل می‌شود.
- ساخت `chatAgent` با `promptConfig`, `roleTemplate`, `requireCustomerInfo`, `customerInfoPrompt`.

#### `components/agents/agent-settings-form.tsx` (بازنویسی کامل)
- UI تب‌دار با ۶ لایه: شخصیت، لحن، محدوده، عدم آگاهی، فرمت، پرسش‌وپاسخ.
- انتخابگر قالب نقش (۵ قالب) که کل config را پر می‌کند.
- پیش‌نمایش زنده پرامپت نهایی assemble شده.
- ویرایشگر لیست برای بایدها/نبایدها.
- ویرایشگر جفت پرسش‌وپاسخ.
- بخش شناسایی مشتری (`requireCustomerInfo` + دستور سفارشی).
- بخش handoff با پیام و کلمات کلیدی.
- حفظ قالب‌های قدیمی (shop/support/restaurant/general) در یک بخش جمع‌شونده برای سازگاری.

#### `components/agent-builder/agent-wizard.tsx`
- انتخابگر قالب نقش با پیش‌نمایش.
- ارسال `roleTemplate` و `promptConfig` در POST.

#### `components/agent-builder/flow-templates.ts`
- اضافه شدن `ROLE_FLOW_TEMPLATES` با ۳ گراف آماده: `pre-sales-flow`, `post-sale-flow`, `follow-up-flow`.
- `getRoleFlowTemplate()` helper.

#### `app/(dashboard)/agents/[agentId]/settings/page.tsx`
- پاس دادن `promptConfig`, `roleTemplate`, `requireCustomerInfo`, `customerInfoPrompt` به فرم.

#### `messages/fa.json` و `messages/en.json`
- کلیدهای جدید تحت `agents.settingsForm.*` برای موتور ۶ لایه‌ای و شناسایی مشتری.
- کلیدهای جدید تحت `agents.wizard.*`: `roleTemplateLabel`, `systemPromptPlaceholderLegacy`.

---

## فاز ۲ — یکپارچه‌سازی وردپرس/ووکامرس + کش دوره‌ای

### هدف
دو راه برای گرفتن محصولات/سفارش‌های به‌روز از سایت مشتری: (الف) افزونه وردپرس که با webhook پوش می‌کند، (ب) کش دوره‌ای URL. به‌علاوه بازخوانی خودکار پایگاه دانش URL.

### فایل‌های جدید

#### `lib/integrations/woocommerce.ts`
- `syncWooProducts()` — fetch از `/wp-json/wc/v3/products` با Basic Auth، upsert در `Product`، re-embed.
- `syncWooOrders()` — fetch از `/wp-json/wc/v3/orders`، upsert در `StoreOrder`، تطبیق با `Contact`.
- `handleWooWebhook()` — مدیریت `product.created/updated/deleted` و `order.created/updated`.
- `verifyWooWebhookSignature()` — HMAC-SHA256 با مقایسه constant-time.
- `findContactByPhone()` و `findContactByEmail()`.

#### `lib/integrations/crawler.ts`
- `crawlUrlToKnowledge()` — بازخوانی یک KB نوع URL.
- `refreshStaleUrlKnowledge()` — پیدا کردن KBهای URL که `refreshIntervalHours` شده، و بازخوانی.

#### `app/api/sync/woocommerce/route.ts`
- POST — دریافت webhook از افزونه (با `?token=webhookSecret`).
- GET — ماشه دستی sync (با auth کاربر).

#### `app/api/integrations/route.ts`
- GET — لیست `StoreIntegration` های workspace.
- POST — ایجاد `StoreIntegration` با رمزنگاری credentials (AES-256-GCM) + تولید `webhookSecret`.

#### `app/api/integrations/[integrationId]/route.ts`
- GET / PATCH / DELETE برای یک integration.

#### `components/integrations/store-integrations-section.tsx`
- بخش UI در صفحه Integrations: لیست فروشگاه‌ها، فرم افزودن، دکمه sync now، webhook URL قابل کپی، لاگ sync.

#### `wordpress-plugin/vigent-woo/vigent-woo.php` (جدید)
- افزونه وردپرس کامل با صفحه تنظیمات فارسی.
- hook به `woocommerce_product_created/updated/deleted` و `woocommerce_order_status_changed`.
- ارسال POST به webhook ویجنت با امضای HMAC-SHA256.
- دکمه «هم‌گام‌سازی کامل دستی» که همه محصولات/سفارش‌ها را در دسته‌های ۵۰تایی پوش می‌کند.
- nonce + capability check + sanitize.

#### `wordpress-plugin/vigent-woo/readme.txt` (جدید)
- راهنمای نصب فارسی.

### فایل‌های تغییر یافته

#### `app/(dashboard)/integrations/page.tsx`
- اضافه شدن بخش «فروشگاه آنلاین» با `<StoreIntegrationsSection>`.

#### `worker/scheduler.ts`
- `syncStoreIntegrations()` — هر ۱۰ دقیقه، poll فروشگاه‌های WooCommerce فعال.
- `runKnowledgeRefresh()` — هر ساعت، بازخوانی KBهای URL که stale شده‌اند.

---

## فاز ۳ — انتقال به اپراتور در تلگرام + شناسایی مشتری + پنل گفتگو

### هدف
وقتی handoff رخ می‌دهد: چک کن ایجنت به تلگرام/بله/ربیکا وصل است، alert + خلاصه + شناسایی مشتری را به اپراتور بفرست (در تلگرام و در پنل)، اپراتور در همان پنل گفتگو پاسخ می‌دهد.

### فایل‌های جدید

#### `lib/channels/operator-handoff.ts`
- `createHandoffAlert()` — ساخت ردیف `HandoffAlert` با snapshot + نوتیفیکیشن in-app/SMS + push به بات تلگرام اپراتور.
- `getConnectedMessengerChannels()` — لیست کانال‌های messanger وصل‌شده به ایجنت.
- `pushAlertToOperatorBot()` — ارسال پیام به بات تلگرام با inline keyboard.
- `routeOperatorReplyFromTelegram()` — مسیریابی پاسخ اپراتور از تلگرام به کانال اصلی مشتری.
- `resolveHandoffAlert()`.
- `readOperatorBotToken()` — decrypt توکن.

#### `app/api/telegram-operator/webhook/route.ts`
- Webhook بات اپراتور: مدیریت `/start`, `/chats`, و reply-to-message (مسیریابی پاسخ).
- فقط پیام‌های `operatorChatId` پذیرفته می‌شود.

#### `app/api/operator-channel/route.ts`
- GET / POST / PATCH / DELETE برای مدیریت بات اپراتور.
- POST: setWebhook + getMe + رمزنگاری توکن.

#### `app/api/operator-channel/test/route.ts`
- ارسال پیام تست به بات.

#### `app/api/conversations/[conversationId]/handoff/route.ts`
- POST — ماشه دستی handoff + بازگرداندن `connectedChannels`.

#### `app/api/handoff-alerts/route.ts`
- GET — لیست alertهای open/claimed.

#### `app/api/handoff-alerts/[alertId]/route.ts`
- GET / PATCH (state, claimedBy, resolvedAt).

#### `components/crm/conversation-panel.tsx`
- پنل بالا گفتگو: بنر alert، snapshot مشتری، pillهای کانال‌های متصل، باکس پاسخ اپراتور، دکمه بستن alert.

#### `components/crm/operator-channel-setup.tsx`
- کارت تنظیمات بات اپراتور: connect/test/toggle/delete.

### فایل‌های تغییر یافته

#### `app/(dashboard)/conversations/[conversationId]/page.tsx`
- query اضافه شدن `handoffAlerts` و `agentChannel`.
- رندر `<ConversationPanel>` وقتی handoff فعال است.

#### `app/(dashboard)/settings/page.tsx`
- اضافه شدن بخش «بات اپراتور تلگرام» با `<OperatorChannelSetup>`.

#### `lib/docs/nav.ts`
- دو صفحه مستندات جدید: `handoff` و `customer-identification`.

#### `lib/docs/content.ts`
- دو DocPage کامل دوزبانه با بلاک‌های p/h2/steps/list/callout.

#### `messages/fa.json` و `messages/en.json`
- namespace جدید `operatorChannel` (۱۶ کلید).
- کلیدهای `conversations.handoff*` (۱۱ کلید).

---

## فاز ۴ — تازگی دانش + RAG بهبودیافته

### هدف
اطمینان از اینکه اطلاعات RAG به‌روز است: بازخوانی خودکار KBهای URL، اولویت‌دهی chunkهای تازه در retrieval، نمایش آخرین بروزرسانی در UI.

### فایل‌های تغییر یافته

#### `lib/knowledge/vector-store.ts`
- `retrieveChunks` حالا `kbLastIngestedAt` را هم JOIN می‌کند.
- Recency boost: chunkهای URL که تازه بازخوانی شده‌اند +۰٫۰۵ similarity می‌گیرند که در ۷ روز به صفر می‌رسد.
- candidate set بزرگ‌تر (۳×limit) برای re-rank.

#### `lib/knowledge/ingest.ts`
- (بدون تغییر ساختاری — crawler از `processIngestion` استفاده می‌کند.)

#### `components/knowledge/kb-manager.tsx`
- `KbItem` حالا `lastIngestedAt` و `refreshIntervalHours` دارد.
- انتخابگر بازه بازخوانی (دستی/۶h/۱۲h/۲۴h/۳d/۷d) برای KBهای URL.
- نمایش «آخرین بازخوانی» و «بازه: هر N ساعت» در لیست.
- نمایش هشدار «بازخوانی زمان‌بندی شده» وقتی هنوز اجرا نشده.

#### `app/api/agents/[agentId]/knowledge/route.ts`
- POST حالا `refreshIntervalHours` را قبول می‌کند (برای URL، ۰ تا ۱۶۸ ساعت).

#### `app/(dashboard)/agents/[agentId]/knowledge/page.tsx`
- select اضافه شدن `lastIngestedAt` و `refreshIntervalHours`.

#### `messages/fa.json` و `messages/en.json`
- کلیدهای `knowledge.refreshInterval*`, `knowledge.lastRefreshed`, `knowledge.refreshEvery`, `knowledge.refreshScheduled`.

---

## نکات اجرایی

### Migration
دستور لازم پس از کپی فایل‌ها:
```bash
bun run db:migrate   # یا npx prisma migrate deploy
```

### متغیرهای محیطی جدید (اختیاری)
- `NEXT_PUBLIC_APP_URL` — آدرس عمومی برنامه برای setWebhook تلگرام (پیش‌فرض: `https://vigent.ir`).

### وابستگی‌های جدید
- هیچ npm package جدیدی اضافه نشده است.
- افزونه وردپرس مستقل است (بدون composer).

### سازگاری با گذشته
- همه ایجنت‌های موجود بدون تغییر کار می‌کنند (وقتی `promptConfig` و `roleTemplate` خالی باشند، از `systemPrompt` قدیمی استفاده می‌شود).
- فیلدهای جدید در schema همه optional یا default دارند.

### اعتبارسنجی
- `npx tsc --noEmit` — تمیز ✓
- `npx next lint` — بدون خطا ✓
- `npx vitest run` — ۴۱/۴۱ تست پاس شد ✓

---

## فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس

### هدف
کاربر گزارش داده بود که آدرس `/docs/woocommerce` با خطای 404 برمی‌گردد. علت این بود که slug `woocommerce` در آرایهٔ `DOCS` در `lib/docs/content.ts` و در `DOCS_NAV` در `lib/docs/nav.ts` وجود نداشت. این فاز آن را اضافه می‌کند.

### فایل‌های تغییر یافته

#### `lib/docs/nav.ts`
- اضافه شدن آیکن `ShoppingCart` به import از `lucide-react`.
- اضافه شدن entry جدید در `DOCS_NAV` برای slug `woocommerce` (با href `/docs/woocommerce` و عنوان دوزبانه «اتصال ووکامرس» / «WooCommerce integration») بین `customer-identification` و `caching`.

#### `lib/docs/content.ts`
- اضافه شدن آیکن `ShoppingCart` به import از `lucide-react`.
- اضافه شدن `DocPage` جدید با slug `woocommerce` به آرایهٔ `DOCS` (بین `customer-identification` و `caching`). شامل:
  - عنوان و توضیح دوزبانه (fa/en).
  - بلاک مقدمه (`p`) — توضیح اینکه اتصال ووکامرس چه می‌کند.
  - بلاک `h2` + `list` با ۴ آیتم: همگام‌سازی محصولات، سفارش‌ها، دستی و خودکار.
  - بلاک `h2` + `p` پیش‌نیازها (وردپرس ۵.۶+، ووکامرس ۶+، Basic Auth).
  - بلاک `h2` + `p` برای گام ۱ (ساخت یکپارچه‌سازی در پنل ویجنت).
  - بلاک `code` با caption دوزبانه که آدرس نمونهٔ webhook (`https://app.vigent.ir/api/sync/woocommerce?token=WEBHOOK_SECRET`) را نشان می‌دهد.
  - بلاک `h2` + `steps` با ۵ گام نصب افزونهٔ وردپرس.
  - بلاک `h2` + `p` برای گام ۳ (همگام‌سازی اولیه).
  - بلاک `callout` دربارهٔ allow-list هاست.
  - بلاک `h2` + `p` برای گام ۴ (تأیید در پنل ویجنت).
  - بلاک `h2` + `list` عیب‌یابی با ۴ آیتم (محصولات، سفارش‌ها، 401، لاگ).
  - بلاک `callout` نهایی بهترین روش.
  - مجموعاً بیش از ۱۲ بلاک — بیش از حداقل ۶ بلاک خواسته‌شده.

### نتیجه
- مسیر `/docs/woocommerce` حالا از طریق `getDoc('woocommerce')` در `app/(marketing)/docs/[slug]/page.tsx` پیدا و رندر می‌شود.
- در سایدبار مستندات نیز نمایش داده می‌شود (به‌خاطر `DOCS_NAV`).
- در `generateStaticParams` برای pre-render استاتیک پدیدار می‌شود.

### اعتبارسنجی نهایی
- `npx tsc --noEmit` — تمیز ✓
- `npx next lint` — بدون خطا ✓
- `npx vitest run` — ۴۱/۴۱ تست پاس شد ✓

---

## بهبودهای رابط کاربری — رنگ چارت‌ها + راهنمای اعداد + نوار ناوبری

### هدف
۱. رنگ labelهای چارت «فعالیت بر اساس روز و ساعت» و سایر چارت‌ها تیره‌تر و واضح‌تر شود.
۲. بخش راهنما «این اعداد از کجا می‌آیند؟» به صفحات بیشتری اضافه شود.
۳. نوار ناوبری صفحه اصلی بر اساس مسیر و اسکرول، آیتم فعال را درست نمایش دهد.

### فایل‌های تغییر یافته

#### `components/dashboard/charts/hourly-heatmap.tsx`
- labelهای روز هفته: از `text-[var(--text-muted)]` (۲۵٪ opacity در dark) به `text-[var(--text-secondary)]` (۵۵٪) + `font-medium`.
- labelهای ساعت (۰/۶/۱۲/۱۸/۲۳): از `text-[var(--text-hint)]` (۱۲٪ — تقریباً نامرئی!) به `text-[var(--text-secondary)]` + `font-medium` + اندازه ۱۰px.

#### `components/dashboard/charts/conversation-chart.tsx`
- رنگ tickهای محور X و Y: از `rgba(var(--ink-rgb),0.4)` (۴۰٪) به `rgba(var(--ink-rgb),0.65)` (۶۵٪) + `fontWeight: 500`.
- رنگ axis line: از ۰٫۰۸ به ۰٫۱۲ برای وضوح بهتر.

#### `components/dashboard/charts/satisfaction-gauge.tsx`
- متن تعداد رأی‌ها (count): از `text-[var(--text-muted)]` به `text-[var(--text-secondary)]`.

#### `components/dashboard/metrics-explainer.tsx` (جدید)
- کامپوننت reusable برای نمایش پنل «این اعداد از کجا می‌آیند؟».
- لیست آیتم‌ها با آیکون + ترم bold + توضیح.
- قابل استفاده در هر صفحه داشبورد.

#### `app/(dashboard)/overview/page.tsx`
- بازنویسی بخش explainer با کامپوننت `MetricsExplainer`.
- اضافه شدن ۳ آیتم توضیحی جدید: «روند گفتگوها»، «فعالیت بر اساس روز و ساعت»، «محصولات پرجستجو» (مجموع ۷ آیتم).

#### `app/(dashboard)/agents/[agentId]/analytics/page.tsx`
- اضافه شدن پنل `MetricsExplainer` در انتهای صفحه با ۸ آیتم توضیحی: تعداد گفتگوها، نرخ تکمیل، میانگین رضایت، توکن مصرفی، روند، تفکیک کانال‌ها، محصولات پرجستجو، سؤالات بی‌پاسخ.

#### `app/(dashboard)/conversations/page.tsx`
- اضافه شدن پنل `MetricsExplainer` با عنوان «این لیست چگونه مرتب می‌شود؟» و ۳ آیتم: ترتیب نمایش، محصولات نمایش، به‌روزرسانی.

#### `app/(dashboard)/contacts/page.tsx`
- اضافه شدن پنل `MetricsExplainer` با عنوان «این مخاطبین از کجا می‌آیند؟» و ۴ آیتم: ایجاد خودکار، یکپارچه‌سازی بین کانال‌ها، مرحله (Stage)، تگ‌ها.
- بازنویسی ساختار صفحه برای render کردن ContactsView + explainer در یک wrapper.

#### `components/marketing/navbar.tsx`
- اضافه شدن `usePathname()` برای تشخیص مسیر فعلی.
- تشخیص مسیر: `/blog` → active='blog'، `/docs` → active='docs'.
- در صفحه اصلی: scroll-spy فقط روی `/` فعال است؛ وقتی هیچ section در view نیست (بالای صفحه یا بین sectionها)، active='home' می‌شود.
- رفع مشکل: قبلاً «امکانات» همیشه فعال بود چون `active` پیش‌فرض empty بود و IntersectionObserver درست تشخیص نمی‌داد.

### اعتبارسنجی
- `npx tsc --noEmit` — تمیز ✓
- `npx next lint` — بدون خطا ✓
- `npx vitest run` — ۴۱/۴۱ تست پاس شد ✓
