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

---

## فاز جدید — فروشندهٔ مشاور (Consult-vs-Show) + تازه‌سازی مدل‌های میان‌رده

### هدف
۱) رفتار «فروشندهٔ ماهر»: درخواست صریح («۵ تا پیراهن بفرست») بدون سؤال فوراً نمایش داده شود؛ درخواست کلی («چی دارین برای فروش؟») به‌جای ریختن ۱۰ کارت، مشاوره بگیرد: معرفی کوتاه زمینهٔ فروشگاه + دسته‌های واقعی + ۲–۳ محصول پرطرفدار + فقط یک سؤال نیازسنجی.
۲) جایگزینی دو مدل میانیِ تکراری با دو مدل به‌صرفه و باکیفیت.

### فایل‌های تغییر یافته

#### `lib/ai/conversation.ts`
- تفکیک `SHOWCASE_INTENT_RE` قدیمی به `SHOWCASE_COMMAND_RE` (امری: بفرست/نشون بده/لیست) و `BROWSE_QUERY_RE` (پرسشی: چی دارید/چی می‌فروشید/what do you have).
- فیلد جدید `discoveryBrowse` در `ProductRequestPlan`: گشت‌وگذار کلی بدون محصول مشخص، بدون تعداد و بدون سابقهٔ محصول → نوبت مشاوره (۶ محصول برای انتخاب هایلایت).
- `priorProductSignal`: پیگیریِ «همه رو نشون بده» بعد از گشت‌وگذار به ویترین کامل تبدیل می‌شود.
- پذیرش پیشنهادِ خود ایجنت: «آره/بله»ی خالی فقط وقتی ویترین می‌شود که آخرین پیام ایجنت واقعاً پیشنهاد نمایش داده باشد (`ASSISTANT_OFFER_RE` هم‌بند: اسم + فعل اول‌شخص در یک جمله؛ «ببینید» و «در مورد» پرکننده حساب می‌شوند).
- کلمات تأیید/سلام/فعل‌های امری مؤدبانه به استاپ‌وردها اضافه شد تا «آره»، «وقت بخیر» یا «کنید» عبارت جستجو نشوند.
- «بیخیال، چی دارین؟» دیگر پاسخ خشک «درخواست جدیدتان را بگویید» نمی‌گیرد؛ ریست + گشت‌وگذار در همان نوبت مشاوره می‌شود.
- اعداد حرفی («یه»، «نه») فقط با واحد شمارش (تا/عدد/محصول…) تعداد حساب می‌شوند — «یه سوال» دیگر یعنی «۱ محصول» نیست.
- نرمال‌سازی متن تاریخچه (ZWNJ و ارقام) قبل از regexها در هر دو حلقهٔ history.
- `fetchCatalogCategories()` جدید: ۱۲ دستهٔ پرتکرار از محصولات فعالِ موجود با مرتب‌سازی قطعی، برای نوبت‌های گشت‌وگذار.

#### `lib/ai/rag.ts`
- دستور نوبت گشت‌وگذار (اگر دسترسی کاتالوگ فعال باشد): معرفی یک‌خطی زمینه + دسته‌های واقعی + حداکثر ۲–۳ هایلایت (کارت فقط وقتی کانال کارت دارد؛ نتیجهٔ خالی = هیچ محصولی نساز) + دقیقاً یک سؤال نیازسنجی.
- دستور «مشاورهٔ محصول» برای سؤال مشخص: اول پاسخ دقیق + دلیل کوتاه، حداکثر یک سؤال تکمیلی، جایگزین برای ناموجود.
- قانون طلایی فروش به `toneInstruction` سراسری اضافه شد.

#### `lib/ai/chat-engine.ts`
- واکشی دسته‌بندی‌ها در نوبت گشت‌وگذار و ارسال به `buildMessages`.

#### `lib/ai/prompt-builder.ts`
- تمپلیت‌های `full_service` و `sales_consultant`: قانون طلایی، «حداکثر یک سؤال در نوبت»، چک موجودی + جایگزین، پیشنهاد مکمل بعد از انتخاب، و نمونه‌سؤال‌های جدید (درخواست کلی/صریح).
- تمپلیت «پیشنهادی» هر ۸ نوع کسب‌وکار: قانون طلایی و منع سؤال‌پیچ‌کردن به doSay/dontSay ادغامی اضافه شد (سقف ادغام ۲۶/۲۰).

#### `lib/validations/agent.ts`
- سقف آرایه‌های doSay/dontSay از ۲۰ به ۳۰.

#### مدل‌ها — `lib/ai/models.ts`، `lib/ai/platform-config.ts`
- standard: Qwen 3.7 Plus ← **Gemini 3.1 Flash Lite** (`google/gemini-3.1-flash-lite`، ‏0.25/1.50 دلار) با عنوان «هوشمند و خوش‌فهم».
- balanced: Qwen 3.6 35B ← **GPT-5.4 Nano** (`openai/gpt-5.4-nano`، ‏0.20/1.25 دلار) با عنوان «چابک و مقیاس‌پذیر».
- fast (پیش‌فرض) و premium بدون تغییر؛ نقشهٔ aliasهای قدیمی گسترش یافت؛ fallbackهای `resolveModelId` به‌روز شد.

#### `prisma/migrations/20260726130000_refresh_mid_tier_models/migration.sql` (جدید)
- جایگزینی شرطی slugهای تکراری/قدیمی standard و balanced در `PlatformAiSettings.providerModels`؛ سفارشی‌سازی‌های دیگر دست نمی‌خورد.

#### سایر
- `.env.example`: slugهای جدید + `AI_REPLY_PRICE_STANDARD_IRR`.
- `components/admin/platform-settings-form.tsx`: هم‌نام‌سازی MODEL_META با عناوین کاتالوگ.
- `messages/fa.json`, `messages/en.json`: customHint چهار حالت.
- `PRICING-GUIDE.fa.md`: جدول چهار مدل، نرخ مبنای دلار ۱۹۰ هزار تومان، هشدار حاشیهٔ حالت هوشمند.
- `tests/product-request-plan.test.ts`: پوشش گشت‌وگذار، پذیرش پیشنهاد، ریست+گشت‌وگذار، «وقت بخیر»، «یه سوال» و misfire سفارش.

### اعتبارسنجی
- `npx tsc --noEmit` — تمیز ✓
- `npx vitest run` — کل مجموعه پاس ✓
- بازبینی خصمانه ۲۳-ایجنته: ۱۲ یافتهٔ تأییدشده، همه اصلاح شد ✓

---

## فاز Launch-critical — تکمیل AI، RAG، کانال‌ها و تجربه گفتگو

### محدوده
به‌جای ادامهٔ ممیزی کم‌اثر تمام صفحات، موارد مؤثر بر کیفیت پاسخ، از‌دست‌نرفتن پیام، تجربهٔ کانال‌های عمومی و آمادگی معرفی محصول در اولویت قرار گرفتند.

### AI و تمپلیت‌های صنفی
- Overlay واقعی برای هر نوع کسب‌وکار به Prompt توصیه‌شده متصل شد؛ قواعد تخصصی قبل از قطعات عمومی قرار می‌گیرند تا در سقف آرایه حذف نشوند.
- تمپلیت‌های غذا، نوبت/درمان، خدمات، آموزش و سایر Verticalها منطق، محدودیت و Few-shot مخصوص خود را دارند؛ مثال‌های فروشگاهی نامرتبط برای صنف‌های غیرتجاری حذف می‌شوند.
- تست رگرسیون برای قواعد حساسیت غذایی، منع تشخیص/تجویز پزشکی و تأیید انسانی نوبت اضافه شد.

### RAG و دانش
- نرمال‌سازی حروف و ارقام فارسی/عربی و حذف fillerهای مکالمه برای جست‌وجوی لغوی اضافه شد.
- بازیابی به Hybrid Vector + Lexical RRF ارتقا یافت؛ نتیجهٔ نامرتبط با Relevance gate حذف و دانش FAQ/TEXT دست‌نویس در تعارض‌های نزدیک مقدم می‌شود.
- روی pgvector 0.8+ اسکن تکرارشوندهٔ HNSW فعال می‌شود تا فیلتر Workspace/Agent در دیتابیس بزرگ نتیجه را کم نکند.
- Chunker سقف اندازه را در جمله‌های بسیار بلند هم تضمین می‌کند؛ FAQ سؤال و جواب را کنار هم نگه می‌دارد.
- PDF صفحه‌به‌صفحه پردازش و شماره صفحه در Metadata ذخیره می‌شود تا منبع پاسخ قابل‌ردیابی باشد.
- تست‌های Deterministic برای Chunking، FAQ، Normalization و Ranking اضافه شد.

### کانال‌ها و تحویل پیام
- تلگرام، بله و هر دو حالت WhatsApp Cloud/QR پاسخ‌های بلند را در مرز خوانا و زیر سقف پلتفرم تقسیم می‌کنند؛ Quick reply فقط همراه آخرین بخش ارسال می‌شود.
- Timeout برای درخواست‌های اصلی، typing، avatar و upload اضافه شد تا Worker روی اتصال معلق قفل نشود.
- fallback متن سادهٔ تلگرام فقط روی خطای قطعی HTTP 400 اجرا می‌شود؛ timeout و 5xx به Retry صف سپرده می‌شوند تا ارسال تکراری ساخته نشود.
- Rate-limit وبهوک سه‌حالته شد: مجاز، محدود (429) و Redis/Queue در دسترس نیست (503)؛ پیام اضافه دیگر با ACK موفق حذف نمی‌شود.

### ویجت، چت‌لینک و پنل
- Retry بدون تکرار Bubble کاربر برای خطاهای گذرا به ویجت و چت‌لینک اضافه شد؛ خطاهای قطعی پلن/اپراتور/مبدأ Retry نمی‌شوند.
- viewport صفحهٔ میزبان فقط هنگام بازبودن ویجت تمام‌صفحهٔ موبایل تغییر می‌کند و پس از بستن دقیقاً Restore می‌شود.
- Markdown لینک‌های `http/https` و URLهای عریان را امن رندر می‌کند و فهرست شماره‌دار فارسی/عربی را می‌شناسد.
- کارت محصولات در Test Playground مانند ویجت و چت‌لینک نمایش داده می‌شود و syntax داخلی Streaming روی صفحه Flash نمی‌زند.
- Primitive مرکزی Button و ConfirmDialog دسترس‌پذیر اضافه و حذف Chat Link از `confirm()` بومی خارج شد؛ خطاهای اتصال/ذخیرهٔ Web Widget نیز inline نمایش داده می‌شوند.

### SEO/GEO و صفحه تعرفه
- FAQ واقعی خریدار به صفحه تعرفه اضافه شد.
- Twitter metadata و JSON-LD امن برای `SoftwareApplication`، `Offer`، `FAQPage` و `BreadcrumbList` از همان کاتالوگ قیمت Checkout تولید می‌شود تا قیمت Schema با UI Drift نکند.

### فایل‌های تست جدید
- `tests/knowledge-pipeline.test.ts`
- `tests/outbound-text-chunks.test.ts`
- `tests/markdown-links.test.ts`
- تکمیل `tests/business-role-templates.test.ts`

### عمداً منتقل‌شده به فاز بعد
- تست زنده End-to-end کانال‌ها و Load test (نیازمند Staging و Credential واقعی)
- تست بصری موبایل/Lighthouse (Runner مرورگر در پروژه نصب نیست)
- ورودی Media کامل اینستاگرام و محدودیت رسانه در Rubika
- خلاصهٔ غلتان مکالمات طولانی‌تر از ۱۲ پیام
- Locale مسیرمحور و `hreflang` برای SEO انگلیسی
- قفل توزیع‌شده Scheduler و Dedup نزدیک‌به‌تکراری RAG

### اعتبارسنجی نهایی
- `node --check public/widget/loader.js` — سالم ✓
- `npx tsc --noEmit` — صفر خطا ✓
- `npx vitest run` — ۶۸ فایل / ۳۵۰ تست، همه پاس ✓
- `npm run lint` — صفر خطا و Warning ✓
- `git diff --check` — تمیز ✓


---

## فاز v3.1 — رفع باگ سناریوی کامنت «ارسال در دایرکت» + بیلدر کامل پیام در دایرکت

### باگ
سناریوی COMMENT با گزینه «ارسال در دایرکت» هیچ دایرکتی ارسال نمی‌کرد: فرم، این گزینه را با `replyMode: "SILENT"` + `dmOnComment: true` ذخیره می‌کرد و موتور اجرا پیش از هر ارسالی در شاخه SILENT متوقف می‌شد (`outcome: AUTOMATION_HANDLED` بدون هیچ پیام). متن دایرکت هم به‌دلیل شرط `buildPayload` هرگز در `messages[]` ذخیره نمی‌شد و فیلد «متن دایرکت» فقط یک textarea ساده بود بدون پشتیبانی از پیام چندگانه، عکس، وویس، ویدیو، کلید و ویترین.

### فایل‌های تغییر یافته

#### `components/instagram/automation-form.tsx`
- `CommentActionSelector.pick('SEND_DM')` اکنون `replyMode='STATIC'` تنظیم می‌کند (نه SILENT) — قیف ارسال در دایرکت یک دنباله STATIC است.
- انتخاب «ارسال در دایرکت» حالا همان MessageBuilder کامل سناریوهای دایرکت را نشان می‌دهد (متن، عکس، صوت، ویدیو، کلید، ویترین محصولات) با عنوان «پیام‌های دایرکت». فیلد قدیمی textarea «متن دایرکت» حذف شد.
- `buildPayload`: برای COMMENT با `dmOnComment` کل دنباله غنی ذخیره می‌شود؛ ریپلای عمومی (MULTI_MESSAGE) فقط متن.
- اعتبارسنجی جدید: سناریوی «ارسال در دایرکت» بدون حداقل یک پیام ذخیره نمی‌شود.
- `toFormState`: نرمال‌سازی ردیف‌های قدیمی (SILENT+dm → STATIC) و بازیابی متن legacy از `contentText`.

#### `lib/instagram/automation.ts`
- `readAction`: نرمال‌سازی legacy — `SILENT + dmOnComment` به STATIC تبدیل و `contentText` به‌عنوان messages[] بازیابی می‌شود؛ سناریوهای قدیمی بدون ویرایش مجدد کار می‌کنند.
- حذف public-ack از قیف‌های comment→DM در هر سه مسیر (rich STATIC، تک‌رسانه و MULTI_MESSAGE): «ارسال در دایرکت» یعنی به‌جای ریپلای عمومی؛ نشت محتوای دایرکت (لینک/قیمت) در کامنت عمومی برطرف شد.

#### `components/instagram/iphone-preview.tsx`
- `CommentScreen`: در حالت dmOnComment ریپلای عمومی دیگر نمایش داده نمی‌شود؛ باکس «ارسال دایرکت» کل دنباله پیام‌ها را با آیکون نوع هر پیام (عکس/وویس/ویدیو/کلید/ویترین) و شمارنده رندر می‌کند.

### اعتبارسنجی
- `npx tsc --noEmit` — صفر خطا ✓
- `npx next build` — موفق ✓
- تست End-to-End با تزریق وب‌هوک امضاشده (کامنت «333»): نتیجه از `AUTOMATION_HANDLED` (بدون ارسال) به `AUTOMATION_REPLIED` تغییر کرد و درخواست ارسال دایرکت با target صحیح `private:<commentId>:<senderId>` تا Graph API رفت ✓


---

## فاز v3.2 — رفع مشکل عکس‌های ویترین محصولات در همه سطوح

### باگ
عکس‌های ویترین محصولات در چند سطح نمایش داده نمی‌شدند:
1. **پیش‌نمایش آیفون فرم سناریو**: کارت‌های PRODUCT/PRODUCT_LIST همیشه placeholder بودند (گرادیانت + «محصول ۱» + «قیمت: —») — هیچ‌وقت عکس واقعی فچ نمی‌شد؛ دقیقاً شبیه «عکس‌ها خرابه».
2. **ارسال واقعی DM به متا**: Generic Template متا فقط JPG/PNG/GIF را رندر می‌کند — تصاویر webp (مثل محصولات haftmin.shop) و URLهای فارسی بدون percent-encoding بی‌صدا drop می‌شدند (کارت بدون عکس).
3. **اینباکس CRM**: پاسخ‌های سناریو اصلاً به‌عنوان پیام ASSISTANT ذخیره نمی‌شدند — اپراتور در گفتگو فقط پیام مشتری را می‌دید و ویترین هیچ‌وقت رندر نمی‌شد.

### فایل‌های تغییر یافته

#### `components/instagram/iphone-preview.tsx`
- `ProductCardBubble` (جدید): کارت محصول با عکس/نام/قیمت واقعی از `/api/products/{id}` با کش ماژول‌سطحی (بدون refetch هنگام تایپ).
- PRODUCT و PRODUCT_LIST حالا کارت‌های واقعی رندر می‌کنند؛ حالت لودینگ (پالس) و خطا (آیکون کم‌رنگ) هم دارد.
- `DmProductRow` (جدید): در باکس «ارسال دایرکت» پیش‌نمایش کامنت، ردیف محصول با thumbnail واقعی + نام + قیمت + نشان تعداد.

#### `lib/instagram/media.ts`
- `metaSafeUrl` (جدید صادرشده): percent-encode امن URL برای payload های متا (مسیرهای فارسی).
- `pickTemplateImageUrl` (جدید صادرشده): انتخاب بهترین عکس برای Generic Template — اولویت JPG/PNG/GIF، webp فقط به‌عنوان آخرین راه، با انکودینگ.
- `sendProductCard` و `sendProductCarousel`: `image_url` و دکمه‌های `web_url` حالا meta-safe هستند.

#### `lib/instagram/automation.ts`
- `resolveProduct`: انتخاب عکس با `pickTemplateImageUrl` (به‌جای images[0] خام).
- رسید (receipt) v3.1: هرچه سناریو واقعاً ارسال می‌کند (متن‌ها، مارکرهای `[[product:{…}]]` از محصولات resolve شده، یادداشت رسانه «[تصویر]/[وویس]/[ویدیو]») به‌صورت idempotent با `resultForInboundEventId` به‌عنوان پیام ASSISTANT ذخیره می‌شود — اینباکس حالا پاسخ سناریو + ریل ویترین با عکس را نشان می‌دهد.
- `cleanReceiptDescription`: پاک‌سازی HTML ووکامرس قبل از نوشتن مارکر.

#### `lib/products/presentation.ts`
- `resolveProductShowcases`: انتخاب عکس با همان قانون Meta-safe (JPG/PNG/GIF) — مسیر AI/وب‌چت هم benefite می‌شود.

### اعتبارسنجی
- `npx tsc --noEmit` — صفر خطا ✓
- `npx next build` — موفق ✓ (+ ری‌استارت vignet-web و vignet-worker)
- تست E2E با تزریق وب‌هوک DM امضاشده («تست»): outcome=AUTOMATION_REPLIED؛ پیام ASSISTANT با مارکرهای ویترین ذخیره شد؛ عکس‌های مارکر percent-encoded و JPG انتخاب شدند؛ تلاش ارسال متن + کاروسل ۳محصولی + کارت تکی تا Graph API رفت ✓
- داده‌های تست پاکسازی شد (گفتگو/پیام/رویداد)

### نکته عملیاتی
پس از هر تغییر کد بک‌اند، هم `vignet-web` و هم `vignet-worker` باید ری‌استارت شوند — پردازش وب‌هوک در worker انجام می‌شود.

## فاز v3.3 — رفع عکس ویترین در اینستاگرام (پروکسی تصویر) + آپلود عکس محصول + صفحه‌بندی انتخابگر محصولات

### باگ‌ها
۱. **عکس ویترین در دایرکت اینستاگرام نمی‌آمد** (کاربر «صمدی»، سناریو «تست»): ریشه واقعی **دو** مشکل بود:
   - هاست فروشگاه کاربر (ceeports.ir) به کرالر متا (User-Agent `facebookexternalhit`) **۴۰۳** برمی‌گرداند (محافظت hotlink/WAF) — در حالی که همان URL از سرور ما با UA معمولی ۲۰۰ است. متا عکس Generic Template را server-side فچ می‌کند، پس URL مستقیم ووکامرس هرگز برایش در دسترس نبود. (فرمت jpg مشکلی ندارد؛ haftmin با webp کار می‌کرد چون آن هاست کرالر را بلاک نمی‌کند.)
   - **انکودینگ دوباره URLهای فارسی**: `pickTemplateImageUrl` خروجی percent-encoded می‌دهد و `sendProductCard` دوباره `metaSafeUrl` رویش اجرا می‌کرد → `%D8` تبدیل به `%25D8` می‌شد → کرالر متا ۴۰۴ می‌گرفت → کارت بدون عکس.
۲. **آپلود عکس در «محصول جدید» کار نمی‌کرد**: فایل روی دیسک در `public/uploads/products/...` نوشته می‌شد، اما `next start` فقط فایل‌های موجود در زمان build را از `public/` سرو می‌کند → URL برگشتی ۴۰۴ → تصویر «لود نشده» نمایش داده می‌شد. (الگوی حل‌شدهٔ `app/api/uploads/instagram/[...key]` برای products تکرار نشده بود.)
۳. **کندی انتخاب محصول در ویترین**: انتخابگرها (ProductPicker/MultiProductPicker) کل لیست محصولات را یکجا لود می‌کردند (`/api/products?sort=newest` بدون limit) — با ده‌ها/صدها محصول، کوئری و payload سنگین و لودینگ طولانی.

### فایل‌های تغییر یافته

#### `lib/instagram/media.ts`
- `metaSafeUrl`: **idempotent** شد — اگر URL از قبل percent-escape دارد، دست نمی‌زند (رفع انکودینگ دوباره در همه مسیرها).
- `templateImageUrl` (جدید): قبل از تحویل `image_url` به متا، عکس خارجی را **server-side دانلود** می‌کند (با `safeHttpGet`؛ محدود ۸MB، فقط image/*)، در bucket مشترک `products/proxy/{sha1}.{ext}` روی MinIO/S3 کش می‌کند و URL روی دامنه خودمان (`S3_PUBLIC_URL`/`NEXT_PUBLIC_APP_URL`) برمی‌گرداند — کرالر متا دیگر با هاست بلاک‌کننده طرف نیست. URLهای روی دامنه خودمان hand-off مستقیم؛ در خطا fallback به کش دیسک قدیمی یا URL اصلی. هرگز throw نمی‌کند.
- `sendProductCard` و `sendProductCarousel`: `image_url` حالا از `templateImageUrl` می‌گذرد (کاروسل با `Promise.all` موازی).

#### `app/api/uploads/products/[...key]/route.ts` (جدید)
- GET عمومی (بدون لاگین) برای سرو فایل‌های bucket اشتراکی `products` (شامل `proxy/`) با fallback فایل‌های قدیمی روی دیسک، Content-Type درست، **Content-Length صریح** (الزام کرالر متا)، Cache-Control یک‌ساله، CORS برای متا، و محافظت path-traversal.
- DELETE با احراز هویت، scoped به workspace، و غیرمجاز برای کش مشترک `proxy/`.

#### `app/api/uploads/products/route.ts`
- فایل جدید در MinIO/S3 ذخیره می‌شود و URL برگشتی POST حالا `/media/products/{ws}/{y}/{m}/{file}` است (مسیر عمومی خارج از `/api`)؛ در محیط توسعه بدون object storage، دیسک fallback است.

#### `app/api/products/route.ts`
- GET: پارامترهای اختیاری `limit` (۱..۱۰۰) و `offset` + شمارش `total` در پاسخ — بدون `limit` رفتار قبلی (لیست کامل) برای سازگاری با صفحه کاتالوگ.

#### `components/instagram/automation-form.tsx`
- `useProductPickerPages` (هوک جدید مشترک): صفحه اول = **۱۰ محصول آخر** (sort=newest)، جستجوی server-side با debounce ۳۰۰ms، **اسکرول بی‌نهایت** (فچ صفحه بعد نزدیک انتهای لیست) + دکمه «نمایش بیشتر»، sequence-guard برای رد پاسخ‌های قدیمی، dedup بر اساس id.
- `PickerListFooter` (جدید): نمایش «x از y محصول» + اسپینر «در حال بارگذاری».
- `ProductPicker` و `MultiProductPicker` از هوک مشترک استفاده می‌کنند؛ کش `{id→ProductLite}` در MultiProductPicker از آیتم‌های لودشده گرم نگه داشته می‌شود.

### اعتبارسنجی
- `npx tsc --noEmit` — صفر خطا ✓
- `npx next build` — موفق ✓ (مسیر `/api/uploads/products/[...key]` در build ثبت شد) + ری‌استارت vignet-web و vignet-worker ✓
- سرو فایل آپلود شده قبلی (که ۴۰۴ بود): حالا ۲۰۰ `image/png` — هم مستقیم و هم از `https://vigent.ir` با UA کرالر متا ✓؛ path-traversal بلاک ✓
- تست مستقیم `templateImageUrl` روی ۳ محصول واقعی (۲ URL فارسی + ۱ ASCII): هر ۳ تا دانلود و کش شدند (۶۱/۸۰/۴۷KB)، سرو ۲۰۰ `image/jpeg` با UA کرالر متا ✓؛ قبل از فیکس idempotent، URLهای فارسی با خطای double-encoding به fallback می‌افتادند (تایید باگ ریشه)
- E2E با تزریق وب‌هوک DM امضاشده («تست»): رویداد COMPLETED، رسید با مارکر محصول ذخیره، ارسال TEXT/کاروسل/کارت تا Graph رفت و خطای «کاربر یافت نشد» فقط به‌خاطر گیرنده فیک؛ کاروسل بعد از فیکس ۱۶۰ms بعد از متن ارسال شد (cache-hit) ✓
- صفحه‌بندی: صفحه۱=۱۰ جدیدترین، صفحه۲=۱۰ بعدی بدون هم‌پوشانی، جستجوی «تیشرت»=۱۰ نتیجه ✓
- داده‌های تست پاکسازی شد (گفتگو/پیام/رویداد m_test)

### نکته عملیاتی
- کش `proxy/` با sha1(URL) کلید می‌شود — تغییر عکس روی همان URL در ووکامرس تا تغییر خود URL دیده نمی‌شود (فایل‌های ووکامرس عملاً immutable هستند).
- عکس‌های آپلودی کاربر از این پس از `/media/products/...` سرو می‌شوند و در bucket اشتراکی `products` قرار می‌گیرند؛ فایل‌های قدیمیِ موجود روی دیسک بدون مهاجرت همچنان خوانده می‌شوند.
- `public/uploads/products/` در `.gitignore` است؛ فایل‌های واقعی کاربران و کش تصاویر وارد repository و commit نمی‌شوند.
