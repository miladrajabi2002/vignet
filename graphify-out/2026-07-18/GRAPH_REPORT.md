# Graph Report - vignet  (2026-07-18)

## Corpus Check
- 539 files · ~406,957 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3225 nodes · 7455 edges · 204 communities (186 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `efde7d9f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- automation.ts
- cn
- ui.tsx
- loader.js
- prisma.ts
- chat-engine.ts
- qr-config.ts
- charts.ts
- page.tsx
- prompt-builder.ts
- page.tsx
- models.ts
- captureError
- webhook.ts
- page.tsx
- syncOnboarding
- session.ts
- page.tsx
- activity.ts
- registry.ts
- commercial-config.ts
- handler.ts
- rateLimit
- ippanel.ts
- automation-form.tsx
- dependencies
- devDependencies
- woocommerce.ts
- config.ts
- compilerOptions
- Animation Standards Reference
- route.ts
- layout.tsx
- package.json
- registry.ts
- auth.ts
- oauth.ts
- page.tsx
- popular-posts.tsx
- route.ts
- Animation Audit Playbook
- trend-chart.tsx
- route.ts
- jobs.ts
- chat-client.tsx
- material-select.tsx
- getVerticalPack
- vigent-woo.php
- config.ts
- route.ts
- route.ts
- page.tsx
- social-links.tsx
- agent.ts
- Apple Design
- route.ts
- low-credit-alert.ts
- vertical-bookings-vigento.test.ts
- validation.ts
- appointments-workspace.tsx
- iphone-preview.tsx
- types.ts
- helpers.ts
- page.tsx
- agent-wizard.tsx
- route.ts
- contacts-view.tsx
- chat-orchestrator.ts
- ingest.ts
- Glossary
- layout.tsx
- automation-manager.tsx
- charts.ts
- booking-manager.tsx
- instagram.ts
- PageHeader
- page.tsx
- conversation-thread.tsx
- neural-operation-graph.tsx
- getEffectivePlanDefs
- scheduler.ts
- API
- getEffectivePlanDefs
- checkWorkspaceActive
- فایل‌های تغییر یافته
- index.ts
- page.tsx
- isAdminAuthed
- route.ts
- product.ts
- فایل‌های جدید
- entitlements.ts
- index.ts
- VIGENT — Complete Claude Code Project Prompt v2
- route.ts
- page-header.tsx
- page.tsx
- navbar.tsx
- Vignet Improvements — CHANGES.md
- فایل‌های تغییر یافته
- catalog.ts
- scripts
- logo.tsx
- vigento-actions.ts
- ai-usage.ts
- material-select.tsx
- service.ts
- automation-card.tsx
- automation-card.tsx
- build-plugin-zip.mjs
- Quick Reference
- media-uploader.tsx
- automation-manager.tsx
- openrouter.ts
- page.tsx
- فایل‌های جدید
- route.ts
- Design Engineering
- UI/UX Pro Max - Design Intelligence
- route.ts
- key
- vigento-actions.ts
- formatDateTime
- page.tsx
- layout.tsx
- راهنمای قیمت‌گذاری ویجنت
- Component Building Principles
- فایل‌های تغییر یافته
- route.ts
- service-catalog-manager.tsx
- system-errors-panel.tsx
- route.ts
- route.ts
- campaign-composer.tsx
- فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس
- agent.ts
- extends
- Vigent
- The Animation Decision Framework
- clip-path for Animation
- Performance Rules
- Gesture and Drag Interactions
- Pre-Delivery Checklist
- How to Use This Skill
- route.ts
- route.ts
- demo-section.tsx
- نکات اجرایی
- Q: Fix the send-message modal layering in customers and conversations
- setup-server.sh
- setup-whatsapp-bridge.sh
- route.ts
- start-demo.sh
- next-auth.d.ts
- 🚀 PHASES OF IMPLEMENTATION
- CSS Transform Mastery
- The Sonner Principles (Building Loved Components)
- Spring Animations
- Common Rules for Professional UI
- Example Workflow
- route.ts
- Q: میخوام قسمت انیمشن Vigento AI | هوش مصنوعی ویجنتو توی پنل داشبورد کاربر رو برام بهبود بدی و میخوام از neural-operation-graph.tsx یا قسمت مرکز عملیات هوشمند کسب‌وکار توی صفحه اصلی الگو بگیری و افکت اتصال به کارت و مسیر اتصال رو مشابه همین درست کنی
- @prisma/client
- 🎨 DESIGN SYSTEM — PURE BLACK & WHITE MONOCHROME
- 📱 AUTH — PHONE + OTP ONLY (sms.ir)
- 🛍 PRODUCT / SERVICE CATALOG
- 🚀 ONBOARDING — 4-STEP ACTIVATION CHECKLIST
- Core Philosophy
- Debugging Animations
- Tips for Better Results
- When to Apply
- channel-donut.tsx
- route.ts
- route.ts
- Q: الان این 3 تا کنار هم هستن خب چرا زیر هم نمیزاری یا دیزیانشون رو عوض نمیکنی توی اون یه قسمت جا بهترین نحو نشون بدن
- backup.sh
- next.config.mjs
- seed-demo.ts
- tailwind.config.ts
- 🔗 CHANNEL IMPLEMENTATIONS
- 📡 NEW CHANNELS: RUBIKA + BALE
- 🖥 MARKETING WEBSITE — B&W CINEMATIC
- AGENTS.md
- deploy.sh
- setup-db-studio.sh
- postcss.config.mjs
- 📊 ADMIN DASHBOARD — ANALYTICS
- { GET, POST }
- route.ts

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 171 edges
2. `cn()` - 146 edges
3. `requireUser()` - 74 edges
4. `captureError()` - 44 edges
5. `checkWorkspaceActive()` - 36 edges
6. `syncOnboarding()` - 34 edges
7. `rateLimit()` - 34 edges
8. `fa()` - 33 edges
9. `isAdminAuthed()` - 33 edges
10. `buffer` - 30 edges

## Surprising Connections (you probably didn't know these)
- `EditAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/instagram/[automationId]/edit/page.tsx → lib/session.ts
- `EditInstagramAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/instagram/[automationId]/edit/page.tsx → lib/session.ts
- `NewInstagramAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/instagram/new/page.tsx → lib/session.ts
- `AttentionItem()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/overview/page.tsx → lib/utils.ts
- `EditProductPage()` --indirect_call--> `key()`  [INFERRED]
  app/(dashboard)/products/[productId]/edit/page.tsx → lib/channels/webhook-debug.ts

## Import Cycles
- None detected.

## Communities (204 total, 18 thin omitted)

### Community 0 - "automation.ts"
Cohesion: 0.12
Nodes (40): AutomationAction, AutomationRow, AutomationTrigger, checkUserFollows(), DEFAULT_AUTOMATION_POLICY, executeAction(), isReplyMode(), isReplyPolicy() (+32 more)

### Community 1 - "cn"
Cohesion: 0.06
Nodes (41): Message, Proposal, QUICK_PROMPTS, VigentoAdminConsole(), WELCOME, Msg, TestPlayground(), VoiceRecorder (+33 more)

### Community 2 - "ui.tsx"
Cohesion: 0.16
Nodes (19): crawlUrlToKnowledge(), refreshStaleUrlKnowledge(), ChunkOptions, chunkText(), splitBySentence(), contextualChunk(), processIngestion(), resolveText() (+11 more)

### Community 3 - "loader.js"
Cohesion: 0.12
Nodes (44): actionChip(), applyConfig(), applyViewportHeight(), autoGrow(), bubble(), clearIntro(), contrast(), el() (+36 more)

### Community 4 - "prisma.ts"
Cohesion: 0.06
Nodes (41): defaultSettings(), GET(), Params, PATCH(), patchSchema, REPLY_POLICIES, DELETE(), dismissSchema (+33 more)

### Community 5 - "chat-engine.ts"
Cohesion: 0.14
Nodes (28): buildSystemPrompt(), bumpProductQueries(), generateReply(), GenerateReplyResult, hydrateSystemPrompt(), persistHandoff(), prepareTurn(), StartChatResult (+20 more)

### Community 6 - "qr-config.ts"
Cohesion: 0.29
Nodes (12): Params, POST(), PUT(), GET(), Params, newWebhookToken(), bridgeBaseUrl(), bridgeHeaders() (+4 more)

### Community 7 - "charts.ts"
Cohesion: 0.19
Nodes (17): GET(), guard(), POST(), DELETE(), GET(), guard(), Params, PATCH() (+9 more)

### Community 8 - "page.tsx"
Cohesion: 0.07
Nodes (48): AdminAgentDetailPage(), CHANNEL_LABEL, AdminAgentsPage(), AccountStatus(), AdminAiPage(), formatProviderUSD(), formatRequestUSD(), formatRial() (+40 more)

### Community 9 - "prompt-builder.ts"
Cohesion: 0.08
Nodes (32): AgentSettingsData, AgentSettingsForm(), EMPTY_CONFIG, LayerTab, ChatAgent, BaseRoleKey, buildLayeredPrompt(), BUSINESS_ROLE_SPECS (+24 more)

### Community 10 - "page.tsx"
Cohesion: 0.15
Nodes (16): DELETE(), GET(), POST(), POST(), POST(), POST(), POST(), isAdminAuthedRequest() (+8 more)

### Community 11 - "models.ts"
Cohesion: 0.15
Nodes (15): DELETE(), encryptSensitiveFields(), GET(), ownIntegration(), Params, PATCH(), patchSchema, SENSITIVE_FIELDS (+7 more)

### Community 12 - "captureError"
Cohesion: 0.24
Nodes (9): LoginPage(), PAID_PLANS, Intro(), EASE, OTPCredentialLike, PhoneOtpForm(), Step, PERSIAN_DIGITS (+1 more)

### Community 13 - "webhook.ts"
Cohesion: 0.11
Nodes (23): AdminPaymentsPage(), AdminPaymentDetailPage(), GATEWAY_BADGE, PLAN_BADGE, STATUS_BADGE, StatusSummary(), fmtDay(), fmtIRR() (+15 more)

### Community 14 - "page.tsx"
Cohesion: 0.16
Nodes (15): DocsHomePage(), metadata, DocPageRoute(), generateMetadata(), DocContent(), pick(), DocsSidebar(), DocBlock (+7 more)

### Community 15 - "syncOnboarding"
Cohesion: 0.12
Nodes (28): GET(), Params, POST(), PUT(), appUrl(), GET(), POST(), buildInstagramOAuthConfig() (+20 more)

### Community 16 - "session.ts"
Cohesion: 0.14
Nodes (20): AdminLoginPage(), metadata, GET(), ALLOWED, POST(), GET(), DELETE(), GET() (+12 more)

### Community 17 - "page.tsx"
Cohesion: 0.06
Nodes (45): AnalyticsPage(), daysAgo(), nfFa(), STAGE_LABELS_EN, STAGE_LABELS_FA, CHANNEL_LABELS_FA, VALID_CHANNELS, VALID_STATUSES (+37 more)

### Community 18 - "activity.ts"
Cohesion: 0.12
Nodes (18): GET(), bodySchema, Params, POST(), readBotToken(), resolveChannel(), FacebookPagesResult, IgHost (+10 more)

### Community 19 - "registry.ts"
Cohesion: 0.09
Nodes (36): baseUrl(), bodySchema, Params, POST(), WEBHOOK_PATH, baleAdapter(), getBaleBotInfo(), setBaleWebhook() (+28 more)

### Community 20 - "commercial-config.ts"
Cohesion: 0.10
Nodes (25): AdminPlatformSettingsPage(), GET(), nonNegativeInt, planSchema, positiveInt, PUT(), schema, MODEL_META (+17 more)

### Community 21 - "handler.ts"
Cohesion: 0.11
Nodes (25): getContactName(), handleInstagramGlobalInbound(), persistFixedAssistantReply(), persistInboundOnly(), processChannelInbound(), profileFields(), NOTE: do NOT add sender.id here — that's the customer who messaged, reactAfterInstagramReply() (+17 more)

### Community 22 - "rateLimit"
Cohesion: 0.10
Nodes (21): Progress(), AdminUsagePage(), parseRange(), TYPE_LABEL, OPTIONS, RangeKind, RangeSwitch(), ActivationFunnel() (+13 more)

### Community 23 - "ippanel.ts"
Cohesion: 0.14
Nodes (16): createSchema, GET(), POST(), CampaignComposer(), DraftCampaign, Preview, CampaignLaunchButton(), audienceWhere() (+8 more)

### Community 24 - "automation-form.tsx"
Cohesion: 0.15
Nodes (16): bodySchema, Params, POST(), detectUnanswered(), HandoffDecision, HandoffReasonCode, UNANSWERED_PHRASES, createHandoffAlert() (+8 more)

### Community 25 - "dependencies"
Cohesion: 0.07
Nodes (27): @aws-sdk/client-s3, bullmq, clsx, framer-motion, lucide-react, next, next-auth, next-intl (+19 more)

### Community 26 - "devDependencies"
Cohesion: 0.07
Nodes (27): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, postcss (+19 more)

### Community 27 - "woocommerce.ts"
Cohesion: 0.15
Nodes (27): GET(), loadIntegration(), POST(), checkWorkspaceActive(), authHeader(), deleteProductFromWoo(), fetchWooJson(), findContactByEmail() (+19 more)

### Community 28 - "config.ts"
Cohesion: 0.13
Nodes (22): COLOR_PRESETS, WebWidgetChannel(), FONT_FAMILY_BY_KEY, hexToRgba(), shade(), WIDGET_ICON_COMPONENTS, WidgetPreview(), CachedWidgetPayload (+14 more)

### Community 29 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions (+19 more)

### Community 30 - "Animation Standards Reference"
Cohesion: 0.07
Nodes (25): Aggressive Escalation Triggers, Guidelines, Operating Posture, Part 1 — Findings table (REQUIRED), Part 2 — Verdict (REQUIRED), Remedial Preference Hierarchy, Required Output Format, Reviewing Animations (+17 more)

### Community 31 - "route.ts"
Cohesion: 0.15
Nodes (15): BusinessProfileStep(), DetailsStep(), EASE, ICONS, OnboardingFlow(), Phase, Props, skipSetupStep() (+7 more)

### Community 32 - "layout.tsx"
Cohesion: 0.11
Nodes (16): AgentWizard(), BUSINESS_PRESETS, channelLabel(), ConfigDraft, CreatedAgent, draftFromRole(), FormState, VigentoComposer() (+8 more)

### Community 33 - "package.json"
Cohesion: 0.09
Nodes (22): express, dependencies, express, pino, @whiskeysockets/baileys, description, devDependencies, tsx (+14 more)

### Community 34 - "registry.ts"
Cohesion: 0.27
Nodes (11): buildCatalogBlock(), buildMessages(), buildServiceBlock(), CatalogProduct, CatalogService, formatPrice(), RagContext, retrieveContext() (+3 more)

### Community 35 - "auth.ts"
Cohesion: 0.18
Nodes (22): appHeaders(), asRecord(), chatCompletion(), ChatMessage, ChatOptions, ChatTool, ChatToolCall, ChatUsage (+14 more)

### Community 36 - "oauth.ts"
Cohesion: 0.17
Nodes (21): Params, PendingNumber, POST(), appUrl(), connectNumber(), GET(), POST(), buildWhatsappOAuthConfig() (+13 more)

### Community 37 - "page.tsx"
Cohesion: 0.15
Nodes (10): InstagramConnectFlow(), FIELD_SETS, FieldDef, formatRelative(), ICONS, isComplete(), MessengerChannel(), MessengerKind (+2 more)

### Community 38 - "popular-posts.tsx"
Cohesion: 0.16
Nodes (20): Meter(), ModelSelect(), TIER_ICON, ReplyCreditEstimator(), PricingSection(), AGENT_MODELS, ModelAlias, ModelTier (+12 more)

### Community 39 - "route.ts"
Cohesion: 0.14
Nodes (22): GET(), ownAgent(), Params, POST(), appBaseUrl(), createSchema, encryptSensitiveFields(), GET() (+14 more)

### Community 40 - "Animation Audit Playbook"
Cohesion: 0.09
Nodes (21): 1. Purpose & frequency, 2. Easing & duration, 3. Physicality & origin, 4. Interruptibility, 5. Performance, 6. Accessibility, 7. Cohesion & tokens, 8. Missed opportunities (+13 more)

### Community 41 - "trend-chart.tsx"
Cohesion: 0.12
Nodes (33): AdminOverviewPage(), parseRange(), startOfToday(), AdminRevenuePage(), PLAN_BADGE, getAiOverview(), AgentSpark, conversationsDaily() (+25 more)

### Community 42 - "route.ts"
Cohesion: 0.15
Nodes (20): DELETE(), POST(), POST(), NOTE: The bot token is in the URL path because Telegram can only send the, TgMessage, tgSendMessage(), TgUpdate, GET() (+12 more)

### Community 43 - "jobs.ts"
Cohesion: 0.10
Nodes (29): bodySchema, GET(), ownAgent(), Params, PUT(), confirmSchema, Params, POST() (+21 more)

### Community 44 - "chat-client.tsx"
Cohesion: 0.17
Nodes (10): Avatar(), ChatLinkClient(), errorText(), Msg, nextId(), parseAssistant(), ProductCard, Props (+2 more)

### Community 45 - "material-select.tsx"
Cohesion: 0.15
Nodes (23): { handlers, auth, signOut }, isPlatformOwnerPhone(), normalizePhone(), phoneSchema, getRedis(), globalForRedis, formatPersianDate(), generateCode() (+15 more)

### Community 46 - "getVerticalPack"
Cohesion: 0.31
Nodes (9): calculateFinanceSummary(), FinanceInputs, FinanceSummary, parseUsdToIrrRate(), safeNonNegative(), getFinanceSummary(), PlanRevenueRow, RevenueKPIs (+1 more)

### Community 47 - "vigent-woo.php"
Cohesion: 0.22
Nodes (19): vigent_woo_add_admin_menu(), vigent_woo_content_to_payload(), vigent_woo_full_sync(), vigent_woo_get_settings(), vigent_woo_has_wc(), vigent_woo_on_content_delete(), vigent_woo_on_content_save(), vigent_woo_on_order_status_changed() (+11 more)

### Community 48 - "config.ts"
Cohesion: 0.24
Nodes (6): COLOR_PRESETS, LinkState, CHAT_LINK_BACKGROUNDS, ChatLinkBackground, ChatLinkSettings, DEFAULT_CHAT_LINK_SETTINGS

### Community 49 - "route.ts"
Cohesion: 0.22
Nodes (16): bodySchema, GET(), Params, POST(), bodySchema, GET(), Params, POST() (+8 more)

### Community 50 - "route.ts"
Cohesion: 0.13
Nodes (14): DELETE(), EXT_TO_MIME, GET(), Params, resolveFilePath(), authorized(), PROTECTED_PREFIXES, grants (+6 more)

### Community 51 - "page.tsx"
Cohesion: 0.12
Nodes (18): GET(), PATCH(), Props, BOOKING_AGENT_TOOLS, BOOKING_TOOL_SYSTEM_INSTRUCTION, cancelSchema, executeBookingAgentTool(), slotsSchema (+10 more)

### Community 52 - "social-links.tsx"
Cohesion: 0.09
Nodes (15): getWorkspaceId(), PublicBlogIndexPage(), CHANNEL_ICONS, COPY, MobileChannelTab, COPY, Pillar, InstagramIcon() (+7 more)

### Community 53 - "agent.ts"
Cohesion: 0.15
Nodes (13): scripts, build, db:deploy, db:generate, db:migrate, db:push, db:studio, dev (+5 more)

### Community 54 - "Apple Design"
Cohesion: 0.10
Nodes (20): 10. Gesture design details (the "feel" checklist), 11. Frame-level smoothness, 12. Materials & depth — translucency conveys hierarchy, 13. Multimodal feedback — motion + sound + haptics, 14. Reduced motion & accessibility, 15. Typography — optical sizing, tracking, leading, 16. Design foundations — the eight principles, 17. Process (+12 more)

### Community 55 - "route.ts"
Cohesion: 0.12
Nodes (23): agentStateSchema, creditSchema, executeTool(), fileSchema, findAgents(), findUsers(), findWorkspaces(), inputSchema (+15 more)

### Community 56 - "low-credit-alert.ts"
Cohesion: 0.17
Nodes (15): generateMetadata(), getWorkspaceId(), Props, PublicBlogCategoryPage(), PublicPost, PublicPostCard(), TrendSpark(), getPopularPosts() (+7 more)

### Community 57 - "vertical-bookings-vigento.test.ts"
Cohesion: 0.24
Nodes (17): AvailabilityRuleLike, AvailabilityWindow, AvailableSlot, buildAvailableSlots(), BusyAppointmentLike, DateExceptionLike, effectiveAvailabilityWindows(), inspectRequestedSlot() (+9 more)

### Community 58 - "validation.ts"
Cohesion: 0.67
Nodes (4): AdminDatabasePage(), DATABASE_MODELS, readDatabaseModel(), serializeValue()

### Community 59 - "appointments-workspace.tsx"
Cohesion: 0.15
Nodes (12): fmtBytes(), Metrics, Sample, ServerStatsWidget(), CHANNEL_LABELS, FailedJobLog, HealthPayload, HealthState (+4 more)

### Community 60 - "iphone-preview.tsx"
Cohesion: 0.10
Nodes (23): AppointmentsPage(), AppointmentCard(), AppointmentRow, AppointmentStatus, AppointmentsWorkspace(), BookingDialog(), DayMetric(), groupByTimeSlot() (+15 more)

### Community 61 - "types.ts"
Cohesion: 0.21
Nodes (20): AdminVigentoPage(), CAPABILITIES, POST(), recordRun(), requestSchema, inputSchema, POST(), DraftAgent (+12 more)

### Community 62 - "helpers.ts"
Cohesion: 0.09
Nodes (32): CHANNEL_LABEL, STATUS_LABEL, CHANNEL_LABEL, STATUS_META, GATEWAY_BADGE, PLAN_BADGE, STATUS_BADGE, AdminPagination() (+24 more)

### Community 63 - "page.tsx"
Cohesion: 0.10
Nodes (17): ChannelsSection, FaqSection, FeaturesSection, HomePage(), metadata, PricingSection, VigentoSection, COPY (+9 more)

### Community 64 - "agent-wizard.tsx"
Cohesion: 0.24
Nodes (9): WEBHOOK_PATH, ChatLinkChannel(), PendingWhatsappNumber, QrState, StatusResponse, WhatsAppNumberPicker(), WhatsAppQrConnect(), qrcode (+1 more)

### Community 65 - "route.ts"
Cohesion: 0.21
Nodes (15): bodySchema, Params, POST(), campaignDeliveryText(), CampaignJobData, processCampaign(), processRecipient(), SEND_INTERVAL_MS (+7 more)

### Community 66 - "contacts-view.tsx"
Cohesion: 0.27
Nodes (16): generateMetadata(), getWorkspaceId(), Props, PublicBlogPostPage(), BlogEditor(), isFa(), analyzeSeo(), deriveExcerpt() (+8 more)

### Community 67 - "chat-orchestrator.ts"
Cohesion: 0.19
Nodes (17): appUrl(), GET(), handleCallback(), POST(), readPid(), appUrl(), bodySchema, POST() (+9 more)

### Community 68 - "ingest.ts"
Cohesion: 0.14
Nodes (24): AgentAnalyticsPage(), agent_hint_body(), agent_hint_title(), AgentsPage(), ContactsPage(), AttentionItem(), buildTrend(), daysAgo() (+16 more)

### Community 69 - "Glossary"
Cohesion: 0.11
Nodes (17): Animation Vocabulary, Easing — how speed changes over an animation, Entrances & Exits — how elements appear and disappear, Examples, Feedback & Interaction — responding to the user's actions, Glossary, Instructions, Looping & Ambient Motion — animations that run on their own (+9 more)

### Community 70 - "layout.tsx"
Cohesion: 0.13
Nodes (14): AdminPostRow, STATUS_BADGE_CLS, STATUS_LABELS_EN, STATUS_LABELS_FA, BlogCategory, BlogPostData, EMPTY_POST, JsonImportDialog() (+6 more)

### Community 71 - "automation-manager.tsx"
Cohesion: 0.14
Nodes (17): GET(), PATCH(), AgentLayout(), AgentDetailPage(), DashboardLayout(), metadata, OnboardingPage(), SettingsPage() (+9 more)

### Community 72 - "charts.ts"
Cohesion: 0.04
Nodes (46): EditAutomationPage(), InstagramAutomationContent(), normalizeSettings(), EditInstagramAutomationPage(), NewInstagramAutomationPage(), AutomationCard(), MESSAGE_TYPE_ICON, REPLY_MODE_ICON (+38 more)

### Community 73 - "booking-manager.tsx"
Cohesion: 0.36
Nodes (7): GET(), Params, ChatLinkPage(), generateMetadata(), loadLink(), Props, normalizeChatLinkSettings()

### Community 74 - "instagram.ts"
Cohesion: 0.14
Nodes (22): logout(), INSTAGRAM_SERVICE, InstagramServiceSetup(), Props, Header(), MobileNav(), getDashboardNavForProfile(), getDashboardNavFromModules() (+14 more)

### Community 75 - "PageHeader"
Cohesion: 0.07
Nodes (44): GET(), ProductDetailPage(), META, StatusPage(), NotificationBell(), NotificationItem, AddStoreForm(), DIRECTION_LABEL (+36 more)

### Community 76 - "page.tsx"
Cohesion: 0.31
Nodes (10): DELETE(), GET(), ownAgent(), Params, PUT(), putSchema, AgentChannelsPage(), chatLinkUrl() (+2 more)

### Community 77 - "conversation-thread.tsx"
Cohesion: 0.18
Nodes (10): MobilePlanView, PLAN_TRANSLATION_KEY, grantIncludedPlanCredit(), planCreditGrantKey(), PlanCreditGrantResult, envInt(), envNonNegativeInt(), getPlanDefs() (+2 more)

### Community 78 - "neural-operation-graph.tsx"
Cohesion: 0.09
Nodes (12): NeuralConnectionNode(), NeuralConnectionNodeProps, NeuralConnectionPath(), NeuralConnectionPathProps, NeuralNetworkDefs(), NeuralSignalParticle(), NeuralSignalParticleProps, NeuralSignalTrace() (+4 more)

### Community 79 - "getEffectivePlanDefs"
Cohesion: 0.17
Nodes (12): AgentBuilderEntry(), BuildMode, Props, ICONS, Props, SubStep, CapabilityOptions(), Locale (+4 more)

### Community 80 - "scheduler.ts"
Cohesion: 0.18
Nodes (12): createQueueConnection(), QUEUE_NAMES, worker, campaignWorker, connection, inboundWorker, ingestionWorker, notificationWorker (+4 more)

### Community 81 - "API"
Cohesion: 0.12
Nodes (16): API, Available scripts, Environment, `GET /health`, `GET /status?sessionId=<id>`, How it fits in, Install & run, Limits & caveats (+8 more)

### Community 83 - "checkWorkspaceActive"
Cohesion: 0.29
Nodes (8): OPTIONS(), GET(), OPTIONS(), Params, corsHeaders, corsOptions(), getCachedWidgetConfig(), widgetCacheKey()

### Community 84 - "فایل‌های تغییر یافته"
Cohesion: 0.12
Nodes (16): `app/api/agents/[agentId]/route.ts` (PATCH), `app/api/agents/route.ts` (POST), `app/api/chat/route.ts` و `app/api/widget/[agentId]/chat/route.ts`, `app/(dashboard)/agents/[agentId]/settings/page.tsx`, `components/agent-builder/agent-wizard.tsx`, `components/agent-builder/flow-templates.ts`, `components/agents/agent-settings-form.tsx` (بازنویسی کامل), `lib/ai/chat-engine.ts` (+8 more)

### Community 85 - "index.ts"
Cohesion: 0.16
Nodes (14): MessageBuilder(), app, AUTH_ROOT, bootstrap(), __dirname, forwardInbound(), log, newState() (+6 more)

### Community 86 - "page.tsx"
Cohesion: 0.10
Nodes (29): AuxiliaryGeometry, AuxiliaryKind, AuxiliaryLabels(), ConnectionGeometry, ConnectionNetwork(), ConnectionTiming, DEFAULT_MODULES, DESKTOP_LAYOUTS (+21 more)

### Community 87 - "isAdminAuthed"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 88 - "route.ts"
Cohesion: 0.38
Nodes (6): buttonSchema, DELETE(), owns(), Params, PATCH(), updateSchema

### Community 89 - "product.ts"
Cohesion: 0.23
Nodes (11): asReceipt(), ConversationTimelineActivity(), getTimelineActivity(), Locale, MessageActivityReceipts(), Metadata, Receipt, receiptCopy() (+3 more)

### Community 90 - "فایل‌های جدید"
Cohesion: 0.14
Nodes (14): `app/api/integrations/[integrationId]/route.ts`, `app/api/integrations/route.ts`, `app/api/sync/woocommerce/route.ts`, `app/(dashboard)/integrations/page.tsx`, `components/integrations/store-integrations-section.tsx`, `lib/integrations/crawler.ts`, `lib/integrations/woocommerce.ts`, `wordpress-plugin/vigent-woo/readme.txt` (جدید) (+6 more)

### Community 91 - "entitlements.ts"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: قسمت مرکز عملیات ویجنت، سه مورد را بدون تغییر اندازه درست نمایش بده, Source Nodes

### Community 92 - "index.ts"
Cohesion: 0.21
Nodes (18): databaseHealth(), FailedJobLog, GET(), HealthState, openRouterHealth(), POST(), QueueRow, redisAndQueuesHealth() (+10 more)

### Community 93 - "VIGENT — Complete Claude Code Project Prompt v2"
Cohesion: 0.14
Nodes (13): ⚙️ BACKGROUND JOBS (BullMQ), 🗃 DATABASE SCHEMA (Prisma), 📋 ENVIRONMENT VARIABLES, 🗂 FILE STRUCTURE, 💡 IMPLEMENTATION NOTES, 🌐 INTERNATIONALIZATION, 🧠 MANAGED AI + REPLY CREDIT — CRITICAL ARCHITECTURE, Multi-Tenant AI Agent SaaS Platform | vigent.ir (+5 more)

### Community 94 - "route.ts"
Cohesion: 0.23
Nodes (15): alertSilentChannels(), cleanupOldRecords(), ONBOARDING_NEXT_STEP_FA, remindExpiringSubscriptions(), remindUpcomingAppointments(), runAppointmentReminders(), runChannelCheck(), runCleanup() (+7 more)

### Community 95 - "page-header.tsx"
Cohesion: 0.21
Nodes (13): ConversationThreadPage(), ConversationsPage(), ConversationPanel(), HandoffAlertProp, MESSENGER_META, ConversationThread(), ThreadMessage, OperatorReply() (+5 more)

### Community 97 - "navbar.tsx"
Cohesion: 0.35
Nodes (11): buildFallbackSummary(), compact(), ConversationSummaryResult, ensureConversationSummary(), isEmojiOnly(), isGreetingOnly(), isTrivialConversation(), persistSummary() (+3 more)

### Community 98 - "Vignet Improvements — CHANGES.md"
Cohesion: 0.15
Nodes (12): `app/api/agents/[agentId]/knowledge/route.ts`, `app/(dashboard)/agents/[agentId]/knowledge/page.tsx`, `components/knowledge/kb-manager.tsx`, `lib/knowledge/ingest.ts`, `lib/knowledge/vector-store.ts`, `messages/fa.json` و `messages/en.json`, Vignet Improvements — CHANGES.md, فاز ۱ — موتور پرامپت ۶ لایه‌ای + تمپلیت‌های نقش‌محور (+4 more)

### Community 99 - "فایل‌های تغییر یافته"
Cohesion: 0.15
Nodes (13): `app/(dashboard)/agents/[agentId]/analytics/page.tsx`, `app/(dashboard)/contacts/page.tsx`, `app/(dashboard)/conversations/page.tsx`, `app/(dashboard)/overview/page.tsx`, `components/dashboard/charts/conversation-chart.tsx`, `components/dashboard/charts/hourly-heatmap.tsx`, `components/dashboard/charts/satisfaction-gauge.tsx`, `components/dashboard/metrics-explainer.tsx` (جدید) (+5 more)

### Community 100 - "catalog.ts"
Cohesion: 0.19
Nodes (17): callEmbeddings(), embedCacheKey(), EmbedContext, embedText(), embedTexts(), getCachedEmbedding(), getEmbedContext(), setCachedEmbedding() (+9 more)

### Community 101 - "scripts"
Cohesion: 0.26
Nodes (9): GET(), ACTIVE_APPOINTMENT_STATUSES, BookingError, bookInTransaction(), BookResult, findAppointmentWithRelations(), listAvailableSlots(), dateKeyToDatabaseDate() (+1 more)

### Community 103 - "vigento-actions.ts"
Cohesion: 0.06
Nodes (32): setLocale(), BrandHeader(), NAV_ITEMS, NavItem, NavList(), AdminLayout(), metadata, MobileNavTrigger() (+24 more)

### Community 104 - "ai-usage.ts"
Cohesion: 0.27
Nodes (9): bodySchema, Params, POST(), deleteContent(), handleWpContentWebhook(), upsertContent(), WpContentPayload, writeLog() (+1 more)

### Community 105 - "material-select.tsx"
Cohesion: 0.09
Nodes (20): ContactDetailEditor(), Stage, STAGE_KEY, STAGES, DashboardBarList(), NamedPoint, ChannelOption, ConversationFilters() (+12 more)

### Community 106 - "service.ts"
Cohesion: 0.31
Nodes (9): appBaseUrl(), createSchema, GET(), maskBotToken(), PATCH(), patchSchema, POST(), getTelegramBotInfo() (+1 more)

### Community 107 - "automation-card.tsx"
Cohesion: 0.17
Nodes (15): POST(), activateSubscriptionPayment(), BlockReason, ChatGate, getMonthlyMessageCount(), monthKey(), persistSubscription(), sendPurchaseConfirmation() (+7 more)

### Community 108 - "automation-card.tsx"
Cohesion: 0.20
Nodes (8): BUSINESS_ICONS, BusinessScene, COPY, Hero(), HeroCopy, Locale, NeuralOperationGraph(), Spotlight()

### Community 109 - "build-plugin-zip.mjs"
Cohesion: 0.17
Nodes (9): centralParts, centralSize, CRC_TABLE, eocd, files, localParts, outFile, root (+1 more)

### Community 110 - "Quick Reference"
Cohesion: 0.18
Nodes (11): 10. Charts & Data (LOW), 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Style Selection (HIGH), 5. Layout & Responsive (HIGH), 6. Typography & Color (MEDIUM), 7. Animation (MEDIUM) (+3 more)

### Community 111 - "media-uploader.tsx"
Cohesion: 0.33
Nodes (5): VigentoPage(), CAPABILITIES, ChatMessage, Locale, VigentoWorkspace()

### Community 112 - "automation-manager.tsx"
Cohesion: 0.24
Nodes (10): persistAssistantTurn(), buildTurnReceipts(), CONVERSATION_ACTIVITY_VERSION, ConversationReceiptKind, ConversationTimelineActivity, ConversationTimelineKind, metadataWithReceipts(), productCardCount() (+2 more)

### Community 113 - "openrouter.ts"
Cohesion: 0.38
Nodes (8): EmailMessage, escapeHtml(), getClient(), notifyOps(), sendEmail(), NotificationJobData, processNotification(), runInlineNotification()

### Community 114 - "page.tsx"
Cohesion: 0.20
Nodes (10): generateMetadata(), SITE_URL, SOLUTION_META, SolutionPage(), getBlogEntries, sitemap(), getSolution(), Solution (+2 more)

### Community 115 - "فایل‌های جدید"
Cohesion: 0.20
Nodes (10): `app/api/conversations/[conversationId]/handoff/route.ts`, `app/api/handoff-alerts/[alertId]/route.ts`, `app/api/handoff-alerts/route.ts`, `app/api/operator-channel/route.ts`, `app/api/operator-channel/test/route.ts`, `app/api/telegram-operator/webhook/route.ts`, `components/crm/conversation-panel.tsx`, `components/crm/operator-channel-setup.tsx` (+2 more)

### Community 116 - "route.ts"
Cohesion: 0.11
Nodes (24): DELETE(), Params, PATCH(), settingsSchema, bodySchema, GET(), ownAgent(), Params (+16 more)

### Community 117 - "Design Engineering"
Cohesion: 0.22
Nodes (8): Accessibility, Design Engineering, Initial Response, prefers-reduced-motion, Review Checklist, Review Format (Required), Stagger Animations, Touch device hover states

### Community 118 - "UI/UX Pro Max - Design Intelligence"
Cohesion: 0.22
Nodes (8): Available Domains, Available Stacks, How to Use, Output Formats, Prerequisites, Rule Categories by Priority, Search Reference, UI/UX Pro Max - Design Intelligence

### Community 119 - "route.ts"
Cohesion: 0.22
Nodes (8): actionSchema, buttonSchema, createSchema, GET(), messageEntrySchema, Params, POST(), triggerSchema

### Community 120 - "key"
Cohesion: 0.39
Nodes (8): ALLOWED_PREFIXES, execFileAsync, hasFfmpeg(), MIME_TO_EXT, POST(), publicBaseUrl(), transcodeToInstagramAudio(), UploadedFile

### Community 121 - "vigento-actions.ts"
Cohesion: 0.20
Nodes (12): BodySchema, POST(), POST(), schema, ADMIN_OWNER_PHONE, AdminActionInput, AdminActionPayload, createAdminActionToken() (+4 more)

### Community 122 - "formatDateTime"
Cohesion: 0.31
Nodes (7): bodySchema, POST(), fetchGenerationCost(), MIME_BY_FORMAT, SynthesizedAudio, SynthesizeInput, synthesizeSpeech()

### Community 123 - "page.tsx"
Cohesion: 0.07
Nodes (37): AgentCatalogPage(), NewAutomationPage(), AgentKnowledgePage(), AgentLearningPage(), AgentSettingsPage(), BUSINESSES, NewAgentPage(), BillingPage() (+29 more)

### Community 125 - "layout.tsx"
Cohesion: 0.14
Nodes (16): PUT(), schema, GET(), POST(), AgentModel, BY_ALIAS, findModel(), getReplyPriceIRR() (+8 more)

### Community 126 - "راهنمای قیمت‌گذاری ویجنت"
Cohesion: 0.22
Nodes (8): تصمیم تجاری نهایی, داشبوردی که باید هر هفته کنترل شود, راهنمای قیمت‌گذاری ویجنت, سه مدل مدیریت‌شده, فرمول سود و نقطهٔ بازبینی, قبل از انتشار production, هزینهٔ واقعی یک پاسخ معمولی, چهار پیشنهاد روی سایت

### Community 127 - "Component Building Principles"
Cohesion: 0.25
Nodes (8): Animate enter states with @starting-style, Buttons must feel responsive, Component Building Principles, Make popovers origin-aware, Never animate from scale(0), Tooltips: skip delay on subsequent hovers, Use blur to mask imperfect transitions, Use CSS transitions over keyframes for interruptible UI

### Community 129 - "فایل‌های تغییر یافته"
Cohesion: 0.25
Nodes (8): `app/(dashboard)/conversations/[conversationId]/page.tsx`, `app/(dashboard)/settings/page.tsx`, `lib/docs/content.ts`, `lib/docs/nav.ts`, `messages/fa.json` و `messages/en.json`, فاز ۳ — انتقال به اپراتور در تلگرام + شناسایی مشتری + پنل گفتگو, فایل‌های تغییر یافته, هدف

### Community 130 - "route.ts"
Cohesion: 0.33
Nodes (7): AutomationPolicy, AutomationPolicySnapshot, InstagramOAuthConfig, InstagramReplyPolicy, readIgUserId(), readUserToken(), fetchInstagramSenderProfile()

### Community 131 - "service-catalog-manager.tsx"
Cohesion: 0.29
Nodes (6): AiModelPolicyForm(), formatUSD(), ModelAlias, ModelOption, Notice, Policy

### Community 132 - "system-errors-panel.tsx"
Cohesion: 0.43
Nodes (6): bookingErrorResponse(), GET(), POST(), createAppointment(), listAppointmentsForDate(), appointmentListQuerySchema

### Community 133 - "route.ts"
Cohesion: 0.23
Nodes (9): GET(), Params, GET(), LiveResource, contactLiveVersion(), ContactVersionRow, conversationLiveVersion(), ConversationVersionRow (+1 more)

### Community 134 - "route.ts"
Cohesion: 0.47
Nodes (5): GET(), POST(), listBookingServices(), serviceSlug(), serviceCreateSchema

### Community 135 - "campaign-composer.tsx"
Cohesion: 0.53
Nodes (4): POST(), audioFormat(), transcribeAudio(), TranscribeInput

### Community 136 - "فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس"
Cohesion: 0.29
Nodes (7): `lib/docs/content.ts`, `lib/docs/nav.ts`, اعتبارسنجی نهایی, فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس, فایل‌های تغییر یافته, نتیجه, هدف

### Community 137 - "agent.ts"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: بازطراحی اتصال‌های Vigento AI داشبورد با neural-operation-graph.tsx به‌عنوان Source of Truth, Source Nodes

### Community 138 - "extends"
Cohesion: 0.29
Nodes (6): extends, ignorePatterns, mini-services/**, node_modules/**, next/core-web-vitals, next/typescript

### Community 139 - "Vigent"
Cohesion: 0.29
Nodes (6): Vigent, استقرار روی سرور (production), اسکریپت‌های مفید, راه‌اندازی توسعه (لوکال), متغیرهای محیطی, پیش‌نیازها

### Community 140 - "The Animation Decision Framework"
Cohesion: 0.33
Nodes (6): 1. Should this animate at all?, 2. What is the purpose?, 3. What easing should it use?, 4. How fast should it be?, Perceived performance, The Animation Decision Framework

### Community 141 - "clip-path for Animation"
Cohesion: 0.33
Nodes (6): clip-path for Animation, Comparison sliders, Hold-to-delete pattern, Image reveals on scroll, Tabs with perfect color transitions, The inset shape

### Community 142 - "Performance Rules"
Cohesion: 0.33
Nodes (6): CSS animations beat JS under load, CSS variables are inheritable, Framer Motion hardware acceleration caveat, Only animate transform and opacity, Performance Rules, Use WAAPI for programmatic CSS animations

### Community 143 - "Gesture and Drag Interactions"
Cohesion: 0.33
Nodes (6): Damping at boundaries, Friction instead of hard stops, Gesture and Drag Interactions, Momentum-based dismissal, Multi-touch protection, Pointer capture for drag

### Community 144 - "Pre-Delivery Checklist"
Cohesion: 0.33
Nodes (6): Accessibility, Interaction, Layout, Light/Dark Mode, Pre-Delivery Checklist, Visual Quality

### Community 145 - "How to Use This Skill"
Cohesion: 0.33
Nodes (6): How to Use This Skill, Step 1: Analyze User Requirements, Step 2: Generate Design System (REQUIRED), Step 2b: Persist Design System (Master + Overrides Pattern), Step 3: Supplement with Detailed Searches (as needed), Step 4: Stack Guidelines (match your framework)

### Community 147 - "route.ts"
Cohesion: 0.14
Nodes (14): adminLogin(), AdminLoginState, AdminLoginForm(), initial, bodySchema, Params, POST(), POST() (+6 more)

### Community 149 - "نکات اجرایی"
Cohesion: 0.33
Nodes (6): Migration, اعتبارسنجی, سازگاری با گذشته, متغیرهای محیطی جدید (اختیاری), نکات اجرایی, وابستگی‌های جدید

### Community 150 - "Q: Fix the send-message modal layering in customers and conversations"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Fix the send-message modal layering in customers and conversations, Source Nodes

### Community 151 - "setup-server.sh"
Cohesion: 0.60
Nodes (4): apt_update(), ensure_secret(), set_env(), setup-server.sh script

### Community 152 - "setup-whatsapp-bridge.sh"
Cohesion: 0.40
Nodes (5): append_env(), NEXT_JS_BASE_URL, setup-whatsapp-bridge.sh script, WHATSAPP_BRIDGE_PORT, WHATSAPP_BRIDGE_SECRET

### Community 153 - "route.ts"
Cohesion: 0.47
Nodes (5): DELETE(), ownContact(), Params, PATCH(), updateSchema

### Community 154 - "start-demo.sh"
Cohesion: 0.33
Nodes (5): DATABASE_URL, DIRECT_URL, LD_LIBRARY_PATH, PGHOST, start-demo.sh script

### Community 155 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 156 - "🚀 PHASES OF IMPLEMENTATION"
Cohesion: 0.33
Nodes (6): Phase 1: Foundation (Week 1–2), Phase 2: Core Agent Features (Week 3–4), Phase 3: Channels & Voice (Week 5–6), Phase 4: CRM & Analytics (Week 7–8), Phase 5: Polish & Launch (Week 9–10), 🚀 PHASES OF IMPLEMENTATION

### Community 157 - "CSS Transform Mastery"
Cohesion: 0.40
Nodes (5): 3D transforms for depth, CSS Transform Mastery, scale() scales children too, transform-origin, translateY with percentages

### Community 158 - "The Sonner Principles (Building Loved Components)"
Cohesion: 0.40
Nodes (5): Asymmetric enter/exit timing, Cohesion matters, Review your work the next day, The opacity + height combination, The Sonner Principles (Building Loved Components)

### Community 159 - "Spring Animations"
Cohesion: 0.40
Nodes (5): Interruptibility advantage, Spring Animations, Spring-based mouse interactions, Spring configuration, When to use springs

### Community 160 - "Common Rules for Professional UI"
Cohesion: 0.40
Nodes (5): Common Rules for Professional UI, Icons & Visual Elements, Interaction (App), Layout & Spacing, Light/Dark Mode Contrast

### Community 161 - "Example Workflow"
Cohesion: 0.40
Nodes (5): Example Workflow, Step 1: Analyze Requirements, Step 2: Generate Design System (REQUIRED), Step 3: Supplement with Detailed Searches (as needed), Step 4: Stack Guidelines

### Community 162 - "route.ts"
Cohesion: 0.60
Nodes (4): DELETE(), ownAgent(), Params, POST()

### Community 163 - "Q: میخوام قسمت انیمشن Vigento AI | هوش مصنوعی ویجنتو توی پنل داشبورد کاربر رو برام بهبود بدی و میخوام از neural-operation-graph.tsx یا قسمت مرکز عملیات هوشمند کسب‌وکار توی صفحه اصلی الگو بگیری و افکت اتصال به کارت و مسیر اتصال رو مشابه همین درست کنی"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: میخوام قسمت انیمشن Vigento AI | هوش مصنوعی ویجنتو توی پنل داشبورد کاربر رو برام بهبود بدی و میخوام از neural-operation-graph.tsx یا قسمت مرکز عملیات هوشمند کسب‌وکار توی صفحه اصلی الگو بگیری و افکت اتصال به کارت و مسیر اتصال رو مشابه همین درست کنی, Source Nodes

### Community 166 - "@prisma/client"
Cohesion: 0.40
Nodes (4): @prisma/client, @prisma/client, main(), prisma

### Community 167 - "🎨 DESIGN SYSTEM — PURE BLACK & WHITE MONOCHROME"
Cohesion: 0.40
Nodes (5): Animation Library (add GSAP), Color Tokens, 🎨 DESIGN SYSTEM — PURE BLACK & WHITE MONOCHROME, Philosophy, Typography

### Community 168 - "📱 AUTH — PHONE + OTP ONLY (sms.ir)"
Cohesion: 0.40
Nodes (5): API Routes, 📱 AUTH — PHONE + OTP ONLY (sms.ir), Concept, Login Page (single page, two steps), sms.ir Client

### Community 169 - "🛍 PRODUCT / SERVICE CATALOG"
Cohesion: 0.40
Nodes (5): BullMQ Job (auto re-embed on product change), Concept, Product Embedding Pipeline, Product Pages, 🛍 PRODUCT / SERVICE CATALOG

### Community 170 - "🚀 ONBOARDING — 4-STEP ACTIVATION CHECKLIST"
Cohesion: 0.40
Nodes (5): Concept, DB State, 🚀 ONBOARDING — 4-STEP ACTIVATION CHECKLIST, Steps, UI Components

### Community 171 - "Core Philosophy"
Cohesion: 0.50
Nodes (4): Beauty is leverage, Core Philosophy, Taste is trained, not innate, Unseen details compound

### Community 172 - "Debugging Animations"
Cohesion: 0.50
Nodes (4): Debugging Animations, Frame-by-frame inspection, Slow motion testing, Test on real devices

### Community 173 - "Tips for Better Results"
Cohesion: 0.50
Nodes (4): Common Sticking Points, Pre-Delivery Checklist, Query Strategy, Tips for Better Results

### Community 174 - "When to Apply"
Cohesion: 0.50
Nodes (4): Must Use, Recommended, Skip, When to Apply

### Community 179 - "Q: الان این 3 تا کنار هم هستن خب چرا زیر هم نمیزاری یا دیزیانشون رو عوض نمیکنی توی اون یه قسمت جا بهترین نحو نشون بدن"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: الان این 3 تا کنار هم هستن خب چرا زیر هم نمیزاری یا دیزیانشون رو عوض نمیکنی توی اون یه قسمت جا بهترین نحو نشون بدن, Source Nodes

### Community 186 - "🔗 CHANNEL IMPLEMENTATIONS"
Cohesion: 0.67
Nodes (3): Bale, 🔗 CHANNEL IMPLEMENTATIONS, Rubika

### Community 187 - "📡 NEW CHANNELS: RUBIKA + BALE"
Cohesion: 0.67
Nodes (3): Bale (بله), 📡 NEW CHANNELS: RUBIKA + BALE, Rubika (روبیکا)

### Community 188 - "🖥 MARKETING WEBSITE — B&W CINEMATIC"
Cohesion: 0.67
Nodes (3): Homepage Sections, Key Animation Components, 🖥 MARKETING WEBSITE — B&W CINEMATIC

### Community 230 - "route.ts"
Cohesion: 0.13
Nodes (17): DELETE(), Params, PATCH(), GET(), POST(), DELETE(), GET(), ownProduct() (+9 more)

## Knowledge Gaps
- **1027 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `mini-services/**`, `node_modules/**`, `metadata` (+1022 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `service-catalog-manager.tsx`, `page.tsx`, `webhook.ts`, `page.tsx`, `page.tsx`, `commercial-config.ts`, `rateLimit`, `route.ts`, `popular-posts.tsx`, `social-links.tsx`, `validation.ts`, `appointments-workspace.tsx`, `iphone-preview.tsx`, `helpers.ts`, `ingest.ts`, `layout.tsx`, `automation-manager.tsx`, `instagram.ts`, `PageHeader`, `conversation-thread.tsx`, `getEffectivePlanDefs`, `product.ts`, `page-header.tsx`, `vigento-actions.ts`, `material-select.tsx`, `page.tsx`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `page.tsx`, `agent-wizard.tsx`, `ui.tsx`, `@prisma/client`, `logo.tsx`, `route.ts`, `demo-section.tsx`, `isAdminAuthed`, `index.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `prisma.ts` to `system-errors-panel.tsx`, `route.ts`, `qr-config.ts`, `route.ts`, `campaign-composer.tsx`, `models.ts`, `syncOnboarding`, `activity.ts`, `registry.ts`, `route.ts`, `ippanel.ts`, `automation-form.tsx`, `route.ts`, `woocommerce.ts`, `route.ts`, `oauth.ts`, `route.ts`, `route.ts`, `jobs.ts`, `route.ts`, `page.tsx`, `types.ts`, `route.ts`, `chat-orchestrator.ts`, `automation-manager.tsx`, `page.tsx`, `route.ts`, `scripts`, `route.ts`, `ai-usage.ts`, `service.ts`, `route.ts`, `route.ts`, `key`, `formatDateTime`, `page.tsx`, `layout.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `mini-services/**` to the rest of the system?**
  _1027 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `automation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11846689895470383 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.05573770491803279 - nodes in this community are weakly interconnected._
- **Should `loader.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11524822695035461 - nodes in this community are weakly interconnected._