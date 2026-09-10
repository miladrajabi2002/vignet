# تحقیق و معماری پیشنهادی برای Skillمحور کردن هستهٔ ایجنت و توسعهٔ Vigento

تاریخ: ۱۴۰۵/۰۶/۱۹ (2026-09-10)

## خلاصهٔ تصمیم

Skillمحور کردن هستهٔ ایجنت برای این پروژه تصمیم درستی است، به شرطی که Skill را صرفاً یک فایل Prompt یا قابلیت قابل‌مشاهده برای کاربر در نظر نگیریم. Skill باید یک ماژول داخلی، نسخه‌دار و قابل‌آزمایش باشد که بتواند دستورالعمل، جمع‌آوری Context، ابزار، Guard، اعتبارسنجی نتیجه و Post-processing خودش را داشته باشد.

پیشنهاد اصلی:

1. یک `AgentKernel` مشترک ساخته شود که چرخهٔ اجرای ایجنت را مدیریت کند.
2. رفتارهای فعلی مانند لحن پاسخ، استفاده از دانش، معرفی محصول، رهگیری سفارش، رزرو، شناسایی مشتری و تحویل به اپراتور به Skillهای کوچک و مستقل تبدیل شوند.
3. تنظیمات تجاری هر Agent همچنان در دیتابیس بماند؛ Skillها مصرف‌کنندهٔ این تنظیمات باشند، نه اینکه هر رفتار داخلی به یک گزینهٔ قابل‌مشاهده برای کاربر تبدیل شود.
4. Vigento به‌صورت یک خانوادهٔ Skill توسعه یابد، اما نسخهٔ Admin و User دو Runtime و دو Tool Registry مستقل داشته باشند.
5. در نسخهٔ User، محدودهٔ Workspace نباید از Prompt یا ورودی مدل گرفته شود. سرور باید آن را از Session استخراج و به تمام Queryها و Actionها تزریق کند. مدل نباید هیچ راهی برای انتخاب یا تغییر Workspace داشته باشد.

نتیجهٔ مهم: «User Vigento همان Admin Vigento با Prompt ضعیف‌تر» معماری امنی نیست. این دو می‌توانند منطق گفت‌وگویی مشترک داشته باشند، ولی هویت اجرایی، ابزارها، Repositoryها، مجوزها، تاریخچه و مسیرهای API آن‌ها باید جدا باشد.

## وضعیت فعلی پروژه

### هستهٔ ایجنت اصلی

رفتارهای ایجنت اکنون در چند بخش پخش شده‌اند:

- مدل `Agent` هم‌زمان هویت، System Prompt، تنظیمات پاسخ، Handoff، تنظیمات Prompt و قابلیت‌هایی مانند محصول و رهگیری سفارش را نگه می‌دارد (`prisma/schema.prisma`).
- `lib/ai/chat-engine.ts` Prompt نهایی را می‌سازد، اطلاعات مشتری را Hydrate می‌کند، Context دانش/محصول/سفارش را جمع می‌کند و اجرای مدل را انجام می‌دهد.
- `lib/bookings/chat-orchestrator.ts` رزرو را با تشخیص Intent و یک Tool Loop جداگانه اجرا می‌کند.
- `lib/bookings/agent-tools.ts` ابزارهای رزرو را تعریف می‌کند.
- `lib/ai/order-context.ts` Context رهگیری سفارش را به‌شکل Read-only تولید می‌کند.

این ساختار کار می‌کند، اما رشد آن باعث می‌شود منطق رفتار، دسترسی، Prompt و ابزار به هم گره بخورند. نمونهٔ مهم آن رزرو است که Orchestrator مخصوص خود را دارد، در حالی که دانش، محصول و سفارش مستقیماً داخل Chat Engine ترکیب شده‌اند. همچنین نسخه‌های Agent عمدتاً Prompt و Model را Snapshot می‌کنند و نسخهٔ دقیق قابلیت‌هایی که یک پاسخ را ساخته‌اند ثبت نمی‌شود.

Audit قبلی پروژه نیز نشان داده است که مدل می‌تواند دربارهٔ عملیاتی که واقعاً انجام نشده ادعای موفقیت کند. این مسئله با Prompt بهتر به‌تنهایی حل نمی‌شود؛ پاسخ عملیاتی باید به Receipt معتبر از سرور وابسته شود.

### Vigento User فعلی

مسیر `app/api/vigento/assistant/route.ts` چند ویژگی مثبت دارد:

- کاربر از Session سرور شناسایی می‌شود.
- Queryهای فعلی با `user.workspaceId` محدود می‌شوند.
- پاسخ فعلی Read-only است و ابزار اجرایی ندارد.
- داده‌های زنده به‌صورت Facts محدود به مدل داده می‌شوند.

این یک پایهٔ امن و ساده است، اما هنوز یک دستیار پیشرفته نیست: History پایدار، Tool Loop، Skill Selection، Action امن، Trace نسخهٔ Skill و ارزیابی مستقل ندارد. مهم‌تر اینکه اگر در آینده ده‌ها ابزار اضافه شوند، تکرار دستی `workspaceId` در هر Query احتمال خطای انسانی را بالا می‌برد.

### Vigento Admin فعلی

مسیر `app/api/admin/vigento/route.ts` از مسیر User جداست و ابزارهای Platform-wide در اختیار دارد. عملیات تغییردهنده ابتدا Proposal می‌سازند و در مسیر جداگانه تأیید و اجرا می‌شوند. `lib/admin/vigento-actions.ts` نیز Token امضاشده، انقضا، Nonce، Idempotency و Audit Log دارد.

این الگو پایهٔ مناسبی برای عملیات حساس است، ولی نباید Registry ابزارهای آن در Runtime نسخهٔ User بارگذاری شود؛ حتی اگر Prompt به مدل بگوید از آن‌ها استفاده نکند.

## Skill در معماری پیشنهادی دقیقاً چیست؟

Skill یک واحد داخلی از رفتار ایجنت است که حداقل این ویژگی‌ها را دارد:

```ts
type AgentSkill = {
  key: string;
  version: string;
  phase: "policy" | "context" | "action" | "postprocess";
  description: string;
  trigger: SkillTrigger;
  requirements?: SkillRequirement[];
  instructions?: string;
  provideContext?: (ctx: RunContext) => Promise<SkillContext>;
  tools?: ToolDefinition[];
  beforeModel?: SkillGuard;
  verify?: SkillVerifier;
  afterModel?: SkillPostProcessor;
  evalCases: SkillEvalCase[];
};
```

هر Skill لازم نیست Tool داشته باشد. برای مثال:

- `response-style` سیاست لحن و ساختار پاسخ را فراهم می‌کند.
- `evidence-grounding` مانع ادعاهای بدون مدرک می‌شود.
- `order-tracking` Context سفارش را فقط از Repository مجاز می‌گیرد.
- `appointment-booking` ابزار، State Machine، تأیید و Receipt دارد.
- `persian-response-polish` خروجی را بدون تغییر Facts اصلاح می‌کند.

Skillها بهتر است در ابتدا Code-curated و داخل Repository باشند، نه اینکه از یک Marketplace عمومی یا ورودی مستقیم کاربران بارگذاری شوند. طبق مستند رسمی OpenAI، Skillها بسته‌های نسخه‌دار شامل Manifest و دستورالعمل هستند و محتوای آن‌ها در سطح User Prompt قرار می‌گیرد؛ همچنین Skill یا Repository نامطمئن می‌تواند مسیر Prompt Injection و نشت داده ایجاد کند. خود OpenAI نیز برای محصولات مصرف‌کننده توصیه می‌کند Workflowهای محدود ارائه شوند و عملیات مهم پشت تأیید صریح قرار بگیرند. بنابراین امنیت هستهٔ Vigento نباید به متن `SKILL.md` متکی باشد و باید در Policy و کد سرور enforce شود. منبع: [مستند رسمی OpenAI دربارهٔ Skills](https://developers.openai.com/api/docs/guides/tools-skills).

## تقسیم‌بندی Skillهای هستهٔ ایجنت

### ۱. Skillهای Policy که همیشه فعال‌اند

- `response-style`: لحن، طول، زبان، Emoji، Formality و قواعد پایان پاسخ.
- `evidence-grounding`: تفکیک Fact، استنباط و پیشنهاد؛ ممنوعیت ادعای انجام عملیات بدون Receipt.
- `conversation-flow`: جلوگیری از تکرار، مدیریت سؤال روشن‌کننده و ادامهٔ طبیعی مکالمه.
- `safety-and-boundaries`: قواعد ثابت امنیتی و حدود پاسخ.

### ۲. Skillهای Context که بر اساس نیاز فعال می‌شوند

- `knowledge-retrieval`
- `product-consultation`
- `order-tracking`
- `customer-preferences`
- `conversation-memory`

### ۳. Skillهای Action و Workflow

- `appointment-booking`
- `customer-identification`
- `operator-handoff`
- در آینده: `workspace-settings-draft` و `integration-retry`

این Skillها باید State Machine مشخص داشته باشند. برای مثال، رزرو از حالت `collecting_fields` به `awaiting_confirmation` و سپس `executing` می‌رود. وجود عبارت «بله، رزرو کن» در متن به‌تنهایی نباید جای State و Authorization سرور را بگیرد.

### ۴. Skillهای Post-processing

- `product-card-hydration`
- `channel-adaptation`
- `persian-response-polish`
- `pii-redaction`

Post-processor اجازه ندارد Fact جدید بسازد یا نتیجهٔ Tool را تغییر معنایی دهد.

## چرخهٔ اجرای AgentKernel

```text
Session/Auth
    ↓
Principal + immutable scope
    ↓
Policy preflight
    ↓
Skill selection
    ↓
Scoped context collection
    ↓
Model/tool loop with bounded rounds
    ↓
Receipt verification
    ↓
Post-processing
    ↓
Persist response + execution trace
```

ترتیب حل تعارض باید ثابت باشد:

```text
Security
> Authorization
> Verified tool/data result
> Active workflow state
> Current user request
> Business behavior
> Response style
```

در نتیجه هیچ Skill مربوط به لحن یا فروش نمی‌تواند روی مرز دسترسی یا نتیجهٔ واقعی Tool غلبه کند.

## معماری Vigento: یک خانواده، دو Capability Profile مستقل

### پروفایل Platform Admin

`VIGENTO_PLATFORM_ADMIN` برای مالک یا اپراتور پلتفرم است و می‌تواند این Skillها را داشته باشد:

- خلاصهٔ سلامت کل پلتفرم، مصرف و درآمد.
- جست‌وجوی Workspace، User، Agent و Conversation.
- تحلیل خطاهای پلتفرم با Redaction.
- خواندن فایل‌های مجاز پروژه با Allowlist.
- ساخت Proposal برای عملیات مدیریتی مجاز.
- اجرای عملیات فقط پس از تأیید، Re-authorization و ثبت Audit.

### پروفایل Workspace User

`VIGENTO_WORKSPACE_OWNER` فقط Cockpit همان Workspace است:

- تحلیل مکالمات، مشتریان، رزروها و مصرف همان Workspace.
- مشاهدهٔ Agentها و وضعیت Knowledge Base همان Workspace.
- تحلیل محصولات، سفارش‌ها و سلامت Store همان Workspace.
- پیشنهاد بهبود Prompt یا تنظیمات به‌صورت Draft.
- در نسخه‌های بعد، عملیات برگشت‌پذیر مانند Resolve کردن مکالمهٔ خود یا فعال/غیرفعال کردن Agent خود با Preview و تأیید.

موارد زیر در نسخهٔ User مطلقاً نباید وجود داشته باشند:

- آمار کل پلتفرم یا شمارش Workspaceهای دیگر.
- جست‌وجوی Workspace یا User دلخواه.
- دریافت فایل پروژه، Environment، Log عمومی یا Raw SQL.
- پذیرفتن `workspaceId` از ورودی Tool یا Request Body.
- ابزار Admin، حتی در حالت Hidden یا با دستور «استفاده نکن».
- Query مستقیم Prisma از داخل Skillهای User.

## مرز امنیتی غیرقابل‌مذاکره برای نسخهٔ User

اصل سیستم باید این Invariant باشد:

```text
برای هر رکورد خوانده‌شده یا تغییریافته:
record.workspaceId === authenticatedContext.workspaceId
```

این اصل باید با کد قطعی اجرا شود، نه با قضاوت مدل.

### ۱. Context فقط از سرور

```ts
type VigentoContext =
  | {
      kind: "platform-admin";
      actorId: string;
      requestId: string;
    }
  | {
      kind: "workspace-owner";
      actorId: string;
      workspaceId: WorkspaceId;
      requestId: string;
      impersonated: boolean;
    };
```

`workspaceId` از Session معتبر استخراج می‌شود. هیچ مقدار ارسال‌شده توسط Browser یا مدل جایگزین آن نمی‌شود.

### ۲. Tool Registry فیزیکی جدا

```text
adminVigentoRegistry  → فقط Admin Runtime
userVigentoRegistry   → فقط Workspace Runtime
```

انتخاب Registry باید قبل از اجرای مدل و بر اساس Principal احرازشده انجام شود. مدل نباید نام Profile یا Registry را تعیین کند.

### ۳. Scoped Repository

Skillهای User به‌جای Prisma فقط یک Repository محدود دریافت می‌کنند:

```ts
const repo = createWorkspaceRepository({
  workspaceId: session.workspaceId,
  requestId,
});

await repo.conversations.findById(conversationId);
```

Repository خودش همیشه شرط Workspace را اضافه می‌کند. Toolهایی مانند `inspect_conversation` فقط `conversationId` می‌پذیرند؛ `workspaceId` اصلاً در Schema آن‌ها نیست. اگر ID متعلق به Workspace دیگری باشد، پاسخ باید همان `NOT_FOUND` عمومی باشد تا وجود آن رکورد نیز افشا نشود.

### ۴. Allowlist در خروجی

هر Repository باید `select` صریح داشته باشد. Secret، Credential، Token اتصال، Internal Note یا دادهٔ حساس نباید ابتدا خوانده و سپس با Prompt پنهان شود.

### ۵. Action مبتنی بر Proposal و Receipt

برای عملیات تغییردهنده:

```text
request → validate → preview proposal → explicit confirmation
→ re-auth/re-authorize → execute → receipt → answer
```

Proposal باید به این موارد Bind شود:

- `actorId` و نوع Principal
- `workspaceId`
- نام Action
- Payload نرمال‌شده یا Hash آن
- Target ID و Version مورد انتظار
- زمان انقضا
- Nonce تک‌مصرف

هنگام اجرا باید مجوز و مالکیت Target دوباره بررسی شود. مدل فقط در صورت وجود Receipt موفق می‌تواند بگوید عملیات انجام شد.

### ۶. Impersonation

اگر Admin وارد محیط کاربر شده باشد، Vigento User بهتر است Read-only شود. هر Mutation باید از مسیر Admin، با ثبت هویت Admin، Workspace مقصد و Audit مستقل انجام شود. این تصمیم جلوی نسبت‌دادن عملیات Admin به کاربر را می‌گیرد.

### ۷. دفاع دیتابیسی اختیاری ولی ارزشمند

در مرحلهٔ بلوغ می‌توان PostgreSQL Row-Level Security را به‌عنوان لایهٔ دوم اضافه کرد:

- Role دیتابیس نسخهٔ User نباید Owner جدول یا دارای `BYPASSRLS` باشد.
- Workspace جاری در Transaction به‌شکل Local تنظیم شود.
- Admin از Credential یا Role مجزا استفاده کند.
- Scoped Repository همچنان باقی بماند؛ RLS جایگزین کنترل Application نیست.

این مرحله نیازمند طراحی دقیق Connection Pooling و Transaction در Prisma است و بهتر است بعد از تثبیت Repository انجام شود.

## Toolهای پیشنهادی Vigento User

### Read-only در نسخهٔ اول

- `get_workspace_overview`
- `get_agent_health`
- `analyze_own_conversations`
- `get_own_customer_insights`
- `get_own_booking_summary`
- `get_own_store_health`
- `get_own_product_insights`
- `inspect_own_conversation`
- `get_own_usage_and_billing`
- `get_knowledge_status`

کلمهٔ `own` صرفاً برای خوانایی است؛ امنیت واقعی را Context و Repository اجرا می‌کنند.

### Writeهای پیشنهادی برای مراحل بعد

- `propose_resolve_own_conversation`
- `propose_toggle_own_agent`
- `propose_update_agent_behavior`
- `propose_add_approved_faq`
- `propose_retry_own_integration_sync`

هرکدام باید Preview، تأیید، Re-authorization، Idempotency و Receipt داشته باشند. عملیات مالی، حذف گسترده یا تغییرات Platform در Profile کاربر وجود نخواهد داشت.

## حافظه، Audit و Observability

تاریخچهٔ Admin و User باید در جداول جدا یا حداقل با مدل‌های کاملاً جدا نگهداری شود. پیشنهاد:

- `WorkspaceVigentoThread`
- `WorkspaceVigentoMessage`
- `VigentoProposal`
- `VigentoReceipt`
- `SkillExecutionTrace`

Trace هر Run بهتر است این موارد را ثبت کند:

- `requestId`
- `principalKind`
- `actorId`
- `workspaceId` در صورت User بودن
- `skillKey` و `skillVersion`
- Toolهای فراخوانی‌شده و Status آن‌ها
- Latency، Token Usage و Error Code
- `receiptId` برای عملیات

Prompt کامل، Tool Arguments خام و دادهٔ مشتری نباید بدون سیاست Retention و Redaction وارد Log شوند.

## نسخه‌گذاری و انتشار Skillها

ساختار پیشنهادی:

```text
lib/agent-kernel/
  kernel.ts
  registry.ts
  policies/
  repositories/
  receipts/
  tracing/
  skills/
    response-style/
    evidence-grounding/
    knowledge-retrieval/
    product-consultation/
    order-tracking/
    appointment-booking/
    vigento-admin/
    vigento-workspace/
```

هر Skill نسخهٔ مستقل، Eval Dataset و Feature Flag دارد. Trace باید نشان دهد هر پاسخ با کدام نسخه ساخته شده است. انتشار با Canary روی درصد کمی از Workspaceها انجام شود و Rollback فقط با برگرداندن Pointer نسخه ممکن باشد.

تنظیمات قابل‌مدیریت مشتری مثل Tone، Emoji، طول پاسخ یا دسترسی محصول همچنان دادهٔ Agent هستند. منطق تفسیر و اجرای آن‌ها در Skill نسخه‌دار قرار می‌گیرد. به این ترتیب تغییر داخلی برای مشتری قابل‌مشاهده نیست، ولی توسعه، تست و بازگشت نسخه ساده می‌شود.

## آزمون‌های اجباری امنیتی

پیش از فعال‌سازی Vigento User پیشرفته، این تست‌ها باید Automation شوند:

1. کاربر درخواست «اطلاعات کسب‌وکارهای دیگر» می‌دهد.
2. ID معتبر متعلق به Workspace دیگر را حدس می‌زند.
3. در JSON یا متن، `workspaceId` جعلی تزریق می‌کند.
4. متن مخرب داخل نام محصول، پیام مشتری یا Conversation ذخیره شده است.
5. History قبلی حاوی دستور جعلی Admin است.
6. کاربر نام دقیق یکی از Admin Toolها را درخواست می‌کند.
7. Confirmation Token جعل، منقضی یا Replay می‌شود.
8. رکورد بین Preview و Execute حذف، منتقل یا ویرایش می‌شود.
9. Errorها نباید ID، تعداد یا وجود دادهٔ Workspace دیگر را افشا کنند.
10. Snapshot رجیستری User باید دقیقاً صفر Admin Tool داشته باشد.
11. هیچ User Tool نباید پارامتر `workspaceId` داشته باشد.
12. هیچ Skill کاربری نباید Prisma خام را Import کند.
13. Prompt Injection نباید Principal، Scope یا Tool Registry را تغییر دهد.
14. تعداد ادعاهای موفقیت بدون Receipt باید صفر باشد.

برای اثبات «عدم دسترسی به هیچ محیط دیگر»، فقط Unit Test کافی نیست. باید Integration Test با حداقل دو Workspace، Property-based Test برای IDهای تصادفی و تست منفی روی همهٔ Repositoryها وجود داشته باشد.

## ارزیابی کیفیت Skillهای عمومی ایجنت

برای هر Skill مجموعه تست مستقل لازم است:

- آیا در Intent درست فعال شده است؟
- آیا در Intent نامرتبط خاموش مانده است؟
- آیا Facts پاسخ از Context معتبر آمده‌اند؟
- آیا پاسخ، عملیات انجام‌نشده را انجام‌شده معرفی کرده است؟
- آیا لحن بدون تخریب اطلاعات درست اعمال شده است؟
- آیا Skillها با هم تعارض دارند؟
- آیا خاموش یا Rollback کردن یک Skill رفتار قبلی را بازمی‌گرداند؟

شاخص‌های پیشنهادی:

- Tool-selection precision/recall
- Intent resolution rate
- Claims-without-receipt، با هدف دقیقاً صفر
- Cross-tenant denial pass rate، با هدف ۱۰۰٪
- Latency و Token Cost به تفکیک Skill/Version
- Tool failure و Fallback rate
- میزان تحویل موفق به اپراتور
- رضایت کاربر و نرخ حل مسئله

## نقشهٔ مهاجرت کم‌ریسک

### فاز ۰: Baseline

رفتار فعلی با Conversationهای واقعیِ Redactشده به Eval Dataset تبدیل و Metrics پایه ثبت شود.

### فاز ۱: AgentKernel بدون تغییر رفتار

یک Facade روی Chat Engine فعلی ساخته شود. در این مرحله خروجی نباید تغییر معنادار کند؛ هدف ایجاد Context، Registry، Trace و Adapter است.

### فاز ۲: Skillهای رفتاری

`response-style`، `conversation-flow` و `evidence-grounding` استخراج شوند. این مرحله کم‌خطرترین نقطه برای سنجش معماری است.

### فاز ۳: Skillهای Context

دانش، محصول، سفارش و ترجیحات مشتری از Chat Engine خارج و پشت Interface یکسان قرار گیرند.

### فاز ۴: Skillهای Workflow

رزرو، Handoff و شناسایی مشتری به State Machine، Guard و Receipt مجهز شوند.

### فاز ۵: Vigento Family

منطق مشترک تحلیل و پاسخ ساخته شود، ولی Admin/User Profile، Route، Registry، Repository و History جدا باقی بمانند. نسخهٔ User ابتدا فقط Read-only باشد.

### فاز ۶: عملیات امن Workspace

Proposal و Receipt برای Writeهای برگشت‌پذیر کاربر اضافه شود. Mutation هنگام Impersonation خاموش باشد.

### فاز ۷: سخت‌سازی دیتابیس

در صورت نیاز RLS، Role مجزای دیتابیس، تست نفوذ و Chaos Testing ابزارها افزوده شود.

## معیار پذیرش نهایی

این معماری زمانی آمادهٔ Production است که:

- رفتارهای هسته‌ای به Skillهای مستقل با Owner، Version و Eval تبدیل شده باشند.
- Security Policy خارج از Prompt و در کد قطعی اجرا شود.
- Admin و User هیچ Tool Registry مشترک اجرایی نداشته باشند.
- Scope نسخهٔ User فقط از Session سرور تولید شود.
- همهٔ دسترسی‌های User از Scoped Repository عبور کنند.
- هیچ Query یا Aggregate کاربر بدون Scope اجرا نشود.
- تمام Writeها Proposal، تأیید، Re-authorization، Idempotency، Audit و Receipt داشته باشند.
- هر پاسخ عملیاتی به Receipt قابل‌ردیابی متصل باشد.
- Skill Version هر پاسخ قابل‌ردیابی و Rollback باشد.
- تست‌های Cross-tenant و Prompt Injection در CI اجباری باشند.

## توصیهٔ نهایی

بهترین مسیر این نیست که تمام Prompt فعلی را به چند فایل `SKILL.md` تقسیم کنیم. آن کار فقط پراکندگی Prompt را بیشتر می‌کند. مسیر درست، ساخت یک AgentKernel کوچک و پایدار و انتقال تدریجی قابلیت‌ها به Skillهای دارای Contract است.

برای Vigento نیز یک تجربهٔ محصول مشترک کافی است، اما Runtime مشترک با ابزارهای Admin خطرناک است. نسخهٔ User باید از ابتدا با اصل Least Authority طراحی شود: مدل فقط ابزارهای محیط خودش را می‌بیند، ابزارها Workspace نمی‌پذیرند، Repository Scope را اجبار می‌کند، خروجی Redact می‌شود و هیچ Action بدون تأیید و Receipt معتبر موفق تلقی نمی‌شود.

این طراحی هم توسعهٔ رفتار ایجنت را سریع‌تر می‌کند، هم امکان Eval و Rollback مستقل می‌دهد، و هم مرز امنیتی نسخهٔ User را از «امید به تبعیت مدل» به «محدودیت قطعی در سطح کد و داده» منتقل می‌کند.
