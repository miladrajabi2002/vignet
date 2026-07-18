# Graph Report - vignet  (2026-07-18)

## Corpus Check
- 537 files · ~406,667 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3216 nodes · 7438 edges · 207 communities (187 shown, 20 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `26e2774d`
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
- route.ts
- instagram-service-setup.tsx
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
- @aws-sdk/client-s3
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
- `AgentCatalogPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/catalog/page.tsx → lib/session.ts
- `EditAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/instagram/[automationId]/edit/page.tsx → lib/session.ts
- `NewAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/instagram/new/page.tsx → lib/session.ts
- `AgentLearningPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/learning/page.tsx → lib/session.ts
- `EditInstagramAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/instagram/[automationId]/edit/page.tsx → lib/session.ts

## Import Cycles
- None detected.

## Communities (207 total, 20 thin omitted)

### Community 0 - "automation.ts"
Cohesion: 0.11
Nodes (42): AutomationAction, AutomationPolicy, AutomationRow, AutomationTrigger, checkUserFollows(), DEFAULT_AUTOMATION_POLICY, executeAction(), isReplyMode() (+34 more)

### Community 1 - "cn"
Cohesion: 0.07
Nodes (31): RangeTabs(), AttentionItem(), MiniTrend(), Message, Proposal, QUICK_PROMPTS, VigentoAdminConsole(), WELCOME (+23 more)

### Community 2 - "ui.tsx"
Cohesion: 0.29
Nodes (8): fmtUSD(), Progress(), AdminUsagePage(), parseRange(), TYPE_LABEL, OPTIONS, RangeKind, RangeSwitch()

### Community 3 - "loader.js"
Cohesion: 0.10
Nodes (48): bodySchema, Params, POST(), getConnectedMessengerChannels(), actionChip(), applyConfig(), applyViewportHeight(), autoGrow() (+40 more)

### Community 4 - "prisma.ts"
Cohesion: 0.07
Nodes (30): defaultSettings(), GET(), Params, PATCH(), patchSchema, REPLY_POLICIES, GET(), ownAgent() (+22 more)

### Community 5 - "chat-engine.ts"
Cohesion: 0.12
Nodes (29): buildSystemPrompt(), bumpProductQueries(), generateReply(), GenerateReplyResult, hydrateSystemPrompt(), persistAssistantTurn(), persistHandoff(), prepareTurn() (+21 more)

### Community 6 - "qr-config.ts"
Cohesion: 0.25
Nodes (14): Params, POST(), Params, POST(), PUT(), GET(), Params, bridgeBaseUrl() (+6 more)

### Community 7 - "charts.ts"
Cohesion: 0.06
Nodes (63): GET(), guard(), POST(), DELETE(), GET(), guard(), Params, PATCH() (+55 more)

### Community 8 - "page.tsx"
Cohesion: 0.19
Nodes (19): AccountStatus(), AdminAiPage(), formatProviderUSD(), formatRequestUSD(), formatRial(), ManagedModels(), ModelUsageTable(), parseRange() (+11 more)

### Community 9 - "prompt-builder.ts"
Cohesion: 0.09
Nodes (29): AgentSettingsData, AgentSettingsForm(), EMPTY_CONFIG, LayerTab, BaseRoleKey, buildLayeredPrompt(), BUSINESS_ROLE_SPECS, BUSINESS_ROLE_TEMPLATES (+21 more)

### Community 10 - "page.tsx"
Cohesion: 0.14
Nodes (15): GET(), POST(), POST(), POST(), POST(), POST(), readBotToken(), handleInstagramGlobalInbound() (+7 more)

### Community 11 - "models.ts"
Cohesion: 0.12
Nodes (18): appBaseUrl(), createSchema, encryptSensitiveFields(), GET(), POST(), SENSITIVE_FIELDS, MessengerConfig, MessengerSettings (+10 more)

### Community 12 - "captureError"
Cohesion: 0.15
Nodes (17): LoginPage(), PAID_PLANS, { handlers, auth, signOut }, EASE, OTPCredentialLike, PhoneOtpForm(), Step, isPlatformOwnerPhone() (+9 more)

### Community 13 - "webhook.ts"
Cohesion: 0.09
Nodes (35): AdminAgentDetailPage(), CHANNEL_LABEL, AdminAgentsPage(), AdminBlogPage(), AdminConversationDetailPage(), CHANNEL_LABEL, STATUS_LABEL, AdminConversationsPage() (+27 more)

### Community 14 - "page.tsx"
Cohesion: 0.21
Nodes (14): DocsHomePage(), metadata, DocPageRoute(), generateMetadata(), DocContent(), pick(), DocBlock, DocPage (+6 more)

### Community 15 - "syncOnboarding"
Cohesion: 0.12
Nodes (28): GET(), Params, POST(), PUT(), appUrl(), GET(), POST(), buildInstagramOAuthConfig() (+20 more)

### Community 16 - "session.ts"
Cohesion: 0.29
Nodes (12): ALLOWED, POST(), createSessionToken(), decodeBase32(), isValidToken(), safeEqual(), secret(), sign() (+4 more)

### Community 17 - "page.tsx"
Cohesion: 0.09
Nodes (26): AgentAnalyticsPage(), AnalyticsPage(), daysAgo(), nfFa(), ContactsPage(), STAGE_LABELS_EN, STAGE_LABELS_FA, ProductsPage() (+18 more)

### Community 18 - "activity.ts"
Cohesion: 0.09
Nodes (25): bodySchema, Params, POST(), FacebookPagesResult, IgHost, IgWebhook, instagramAdapter(), InstagramPageOption (+17 more)

### Community 19 - "registry.ts"
Cohesion: 0.10
Nodes (34): baseUrl(), bodySchema, Params, POST(), WEBHOOK_PATH, appBaseUrl(), createSchema, DELETE() (+26 more)

### Community 20 - "commercial-config.ts"
Cohesion: 0.09
Nodes (25): AdminPlatformSettingsPage(), bodySchema, POST(), MODEL_META, NumberPath, PLAN_META, PlanNumber(), PlatformSettingsForm() (+17 more)

### Community 21 - "handler.ts"
Cohesion: 0.09
Nodes (27): POST(), getContactName(), persistFixedAssistantReply(), persistInboundOnly(), processChannelInbound(), profileFields(), NOTE: do NOT add sender.id here — that's the customer who messaged, reactAfterInstagramReply() (+19 more)

### Community 22 - "rateLimit"
Cohesion: 0.15
Nodes (14): ActivationFunnel(), AXIS, BarList(), CHART_COLORS, DailyPoint, dayFmt, DonutChart(), FormatKind (+6 more)

### Community 23 - "ippanel.ts"
Cohesion: 0.15
Nodes (18): bodySchema, Params, POST(), POST(), createSchema, GET(), POST(), bodySchema (+10 more)

### Community 24 - "automation-form.tsx"
Cohesion: 0.12
Nodes (18): AdminLayout(), AdminLoginForm(), AdminLoginPage(), metadata, GET(), GET(), nonNegativeInt, planSchema (+10 more)

### Community 25 - "dependencies"
Cohesion: 0.07
Nodes (27): @aws-sdk/client-s3, bullmq, clsx, lucide-react, next, next-intl, dependencies, @aws-sdk/client-s3 (+19 more)

### Community 26 - "devDependencies"
Cohesion: 0.07
Nodes (27): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, postcss (+19 more)

### Community 27 - "woocommerce.ts"
Cohesion: 0.13
Nodes (30): GET(), loadIntegration(), POST(), authHeader(), deleteProductFromWoo(), fetchWooJson(), findContactByEmail(), findContactByPhone() (+22 more)

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
Cohesion: 0.10
Nodes (24): BusinessProfileStep(), ICONS, Props, SubStep, CapabilityOptions(), Locale, OPTION_META, optionLabel() (+16 more)

### Community 32 - "layout.tsx"
Cohesion: 0.11
Nodes (15): AgentWizard(), BUSINESS_PRESETS, channelLabel(), ConfigDraft, CreatedAgent, draftFromRole(), FormState, VigentoComposer() (+7 more)

### Community 33 - "package.json"
Cohesion: 0.09
Nodes (22): express, dependencies, express, pino, @whiskeysockets/baileys, description, devDependencies, tsx (+14 more)

### Community 34 - "registry.ts"
Cohesion: 0.27
Nodes (11): buildCatalogBlock(), buildMessages(), buildServiceBlock(), CatalogProduct, CatalogService, formatPrice(), RagContext, retrieveContext() (+3 more)

### Community 35 - "auth.ts"
Cohesion: 0.23
Nodes (13): ChatMessage, ChatUsage, BOOKING_AGENT_TOOLS, BOOKING_TOOL_SYSTEM_INSTRUCTION, appendReceipt(), BookingChatResult, combinedUsage(), hasBookingContext() (+5 more)

### Community 36 - "oauth.ts"
Cohesion: 0.15
Nodes (23): Params, PendingNumber, POST(), appUrl(), connectNumber(), GET(), POST(), newWebhookToken() (+15 more)

### Community 37 - "page.tsx"
Cohesion: 0.15
Nodes (10): InstagramConnectFlow(), FIELD_SETS, FieldDef, formatRelative(), ICONS, isComplete(), MessengerChannel(), MessengerKind (+2 more)

### Community 38 - "popular-posts.tsx"
Cohesion: 0.10
Nodes (32): AdminVigentoPage(), CAPABILITIES, Meter(), ModelSelect(), TIER_ICON, ReplyCreditEstimator(), MobilePlanView, PLAN_TRANSLATION_KEY (+24 more)

### Community 39 - "route.ts"
Cohesion: 0.10
Nodes (33): GET(), ownAgent(), Params, POST(), ChunkOptions, chunkText(), splitBySentence(), contextualChunk() (+25 more)

### Community 40 - "Animation Audit Playbook"
Cohesion: 0.09
Nodes (21): 1. Purpose & frequency, 2. Easing & duration, 3. Physicality & origin, 4. Interruptibility, 5. Performance, 6. Accessibility, 7. Cohesion & tokens, 8. Missed opportunities (+13 more)

### Community 41 - "trend-chart.tsx"
Cohesion: 0.17
Nodes (23): AdminOverviewPage(), parseRange(), startOfToday(), getAiOverview(), AgentSpark, conversationsDaily(), DailyPoint, errorsDaily() (+15 more)

### Community 42 - "route.ts"
Cohesion: 0.13
Nodes (24): POST(), POST(), NOTE: The bot token is in the URL path because Telegram can only send the, TgMessage, tgSendMessage(), TgUpdate, GET(), POST() (+16 more)

### Community 43 - "jobs.ts"
Cohesion: 0.13
Nodes (27): bodySchema, GET(), ownAgent(), Params, PUT(), bodySchema, Params, POST() (+19 more)

### Community 44 - "chat-client.tsx"
Cohesion: 0.15
Nodes (11): Avatar(), ChatLinkClient(), errorText(), Intro(), Msg, nextId(), parseAssistant(), ProductCard (+3 more)

### Community 45 - "material-select.tsx"
Cohesion: 0.12
Nodes (36): crawlUrlToKnowledge(), refreshStaleUrlKnowledge(), notifyWorkspace(), getRedis(), globalForRedis, formatPersianDate(), generateCode(), IppanelMeta (+28 more)

### Community 46 - "getVerticalPack"
Cohesion: 0.18
Nodes (17): AdminPaymentsPage(), AdminRevenuePage(), PLAN_BADGE, fmtIRR(), paymentsDailyByWorkspace(), calculateFinanceSummary(), FinanceInputs, FinanceSummary (+9 more)

### Community 47 - "vigent-woo.php"
Cohesion: 0.22
Nodes (19): vigent_woo_add_admin_menu(), vigent_woo_content_to_payload(), vigent_woo_full_sync(), vigent_woo_get_settings(), vigent_woo_has_wc(), vigent_woo_on_content_delete(), vigent_woo_on_content_save(), vigent_woo_on_order_status_changed() (+11 more)

### Community 48 - "config.ts"
Cohesion: 0.22
Nodes (7): COLOR_PRESETS, LinkState, CHAT_LINK_BACKGROUNDS, ChatLinkBackground, ChatLinkSettings, DEFAULT_CHAT_LINK_SETTINGS, RESERVED_SLUGS

### Community 49 - "route.ts"
Cohesion: 0.17
Nodes (18): POST(), bodySchema, GET(), Params, POST(), bodySchema, GET(), Params (+10 more)

### Community 50 - "route.ts"
Cohesion: 0.13
Nodes (14): DELETE(), EXT_TO_MIME, GET(), Params, resolveFilePath(), authorized(), PROTECTED_PREFIXES, grants (+6 more)

### Community 51 - "page.tsx"
Cohesion: 0.20
Nodes (10): Msg, TestPlayground(), VoiceRecorder, ConversationBubble(), ConversationBubbleTone, ConversationText(), TONES, SpeakButton() (+2 more)

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
Cohesion: 0.11
Nodes (24): agentStateSchema, creditSchema, executeTool(), fileSchema, findAgents(), findUsers(), findWorkspaces(), inputSchema (+16 more)

### Community 56 - "low-credit-alert.ts"
Cohesion: 0.10
Nodes (28): ContactDetailPage(), CHANNEL_LABELS_FA, ConversationsPage(), VALID_CHANNELS, VALID_STATUSES, CHANNEL_LABELS, ChannelBadge(), ICONS (+20 more)

### Community 57 - "vertical-bookings-vigento.test.ts"
Cohesion: 0.06
Nodes (70): GET(), PATCH(), Props, bookingErrorResponse(), GET(), POST(), GET(), POST() (+62 more)

### Community 58 - "validation.ts"
Cohesion: 0.67
Nodes (4): AdminDatabasePage(), DATABASE_MODELS, readDatabaseModel(), serializeValue()

### Community 59 - "appointments-workspace.tsx"
Cohesion: 0.10
Nodes (19): CHANNEL_LABELS, FailedJobLog, HealthPayload, HealthState, QUEUE_LABELS, Service, ServiceHealthPanel(), STATE_META (+11 more)

### Community 60 - "iphone-preview.tsx"
Cohesion: 0.10
Nodes (21): AppointmentCard(), AppointmentRow, AppointmentStatus, AppointmentsWorkspace(), BookingDialog(), DayMetric(), groupByTimeSlot(), Locale (+13 more)

### Community 61 - "types.ts"
Cohesion: 0.19
Nodes (25): POST(), recordRun(), requestSchema, inputSchema, POST(), DraftAgent, draftAnswer(), DraftResult (+17 more)

### Community 62 - "helpers.ts"
Cohesion: 0.09
Nodes (22): CHANNEL_LABEL, STATUS_META, GATEWAY_BADGE, PLAN_BADGE, STATUS_BADGE, AdminPagination(), FilterPills(), TableShell() (+14 more)

### Community 63 - "page.tsx"
Cohesion: 0.09
Nodes (21): ChannelsSection, FaqSection, FeaturesSection, HomePage(), metadata, PricingSection, VigentoSection, BUSINESS_ICONS (+13 more)

### Community 64 - "agent-wizard.tsx"
Cohesion: 0.24
Nodes (9): WEBHOOK_PATH, ChatLinkChannel(), PendingWhatsappNumber, QrState, StatusResponse, WhatsAppNumberPicker(), WhatsAppQrConnect(), qrcode (+1 more)

### Community 65 - "route.ts"
Cohesion: 0.14
Nodes (21): bodySchema, Params, POST(), campaignDeliveryText(), CampaignJobData, processCampaign(), processRecipient(), SEND_INTERVAL_MS (+13 more)

### Community 66 - "contacts-view.tsx"
Cohesion: 0.16
Nodes (15): DELETE(), Params, DELETE(), GET(), getOwnedAgent(), Params, PATCH(), GET() (+7 more)

### Community 67 - "chat-orchestrator.ts"
Cohesion: 0.09
Nodes (38): POST(), appUrl(), GET(), handleCallback(), POST(), readPid(), appUrl(), bodySchema (+30 more)

### Community 68 - "ingest.ts"
Cohesion: 0.18
Nodes (18): agent_hint_body(), agent_hint_title(), AgentsPage(), buildTrend(), daysAgo(), isRecord(), MODULE_META, OverviewPage() (+10 more)

### Community 69 - "Glossary"
Cohesion: 0.11
Nodes (17): Animation Vocabulary, Easing — how speed changes over an animation, Entrances & Exits — how elements appear and disappear, Examples, Feedback & Interaction — responding to the user's actions, Glossary, Instructions, Looping & Ambient Motion — animations that run on their own (+9 more)

### Community 70 - "layout.tsx"
Cohesion: 0.27
Nodes (8): GET(), META, StatusPage(), HealthCheck, HealthReport, runHealthChecks(), timed(), withTimeout()

### Community 71 - "automation-manager.tsx"
Cohesion: 0.18
Nodes (16): GET(), PATCH(), AgentLayout(), DashboardLayout(), metadata, OnboardingPage(), AgentTabItem, AgentTabs() (+8 more)

### Community 72 - "charts.ts"
Cohesion: 0.09
Nodes (14): defaultReplyMode(), emptyTextMessage(), FormState, KeywordFilter, MediaUploader, normalizeMessage(), PostFilter, ProductLite (+6 more)

### Community 73 - "booking-manager.tsx"
Cohesion: 0.36
Nodes (7): GET(), Params, ChatLinkPage(), generateMetadata(), loadLink(), Props, normalizeChatLinkSettings()

### Community 74 - "instagram.ts"
Cohesion: 0.15
Nodes (21): logout(), AgentBuilderEntry(), BuildMode, Props, Header(), MobileNav(), getDashboardNavForProfile(), getDashboardNavFromModules() (+13 more)

### Community 75 - "PageHeader"
Cohesion: 0.24
Nodes (17): LocalizedDatePicker(), PickerPosition, WEEKDAYS, DIVISIONS, formatDate(), asDate(), CalendarMonth, calendarMonthLength() (+9 more)

### Community 76 - "page.tsx"
Cohesion: 0.36
Nodes (9): DELETE(), GET(), ownAgent(), Params, PUT(), putSchema, AgentChannelsPage(), chatLinkUrl() (+1 more)

### Community 77 - "conversation-thread.tsx"
Cohesion: 0.47
Nodes (5): DELETE(), dismissSchema, GET(), ownAgent(), Params

### Community 78 - "neural-operation-graph.tsx"
Cohesion: 0.09
Nodes (12): NeuralConnectionNode(), NeuralConnectionNodeProps, NeuralConnectionPath(), NeuralConnectionPathProps, NeuralNetworkDefs(), NeuralSignalParticle(), NeuralSignalParticleProps, NeuralSignalTrace() (+4 more)

### Community 79 - "getEffectivePlanDefs"
Cohesion: 0.27
Nodes (7): EditAutomationPage(), NewAutomationPage(), EditInstagramAutomationPage(), AutomationForm(), Automation, AutomationAction, AutomationTrigger

### Community 80 - "scheduler.ts"
Cohesion: 0.14
Nodes (18): EmailMessage, escapeHtml(), getClient(), notifyOps(), sendEmail(), NotificationJobData, processNotification(), runInlineNotification() (+10 more)

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

### Community 95 - "page-header.tsx"
Cohesion: 0.19
Nodes (20): ConversationThreadPage(), HandoffAlertProp, ConversationThread(), ThreadMessage, OperatorReply(), InboundSource, InboundSourceKind, inboundSourceLabel() (+12 more)

### Community 97 - "navbar.tsx"
Cohesion: 0.15
Nodes (10): AgentCatalogPage(), AgentLearningPage(), DigitalMenuDashboardPage(), ServicesPage(), LearningCenter(), LearningItem, PageHeader(), IMPORTANT: by request, there is NO kicker / eyebrow text above the title. (+2 more)

### Community 98 - "Vignet Improvements — CHANGES.md"
Cohesion: 0.15
Nodes (12): `app/api/agents/[agentId]/knowledge/route.ts`, `app/(dashboard)/agents/[agentId]/knowledge/page.tsx`, `components/knowledge/kb-manager.tsx`, `lib/knowledge/ingest.ts`, `lib/knowledge/vector-store.ts`, `messages/fa.json` و `messages/en.json`, Vignet Improvements — CHANGES.md, فاز ۱ — موتور پرامپت ۶ لایه‌ای + تمپلیت‌های نقش‌محور (+4 more)

### Community 99 - "فایل‌های تغییر یافته"
Cohesion: 0.15
Nodes (13): `app/(dashboard)/agents/[agentId]/analytics/page.tsx`, `app/(dashboard)/contacts/page.tsx`, `app/(dashboard)/conversations/page.tsx`, `app/(dashboard)/overview/page.tsx`, `components/dashboard/charts/conversation-chart.tsx`, `components/dashboard/charts/hourly-heatmap.tsx`, `components/dashboard/charts/satisfaction-gauge.tsx`, `components/dashboard/metrics-explainer.tsx` (جدید) (+5 more)

### Community 100 - "catalog.ts"
Cohesion: 0.18
Nodes (18): callEmbeddings(), embedCacheKey(), EmbedContext, embedText(), embedTexts(), getCachedEmbedding(), getEmbedContext(), setCachedEmbedding() (+10 more)

### Community 101 - "scripts"
Cohesion: 0.12
Nodes (5): IphonePreview, IphonePreviewProps, ScreenProps, AutomationMessage, ReplyMode

### Community 103 - "vigento-actions.ts"
Cohesion: 0.09
Nodes (19): BrandHeader(), NAV_ITEMS, NavItem, NavList(), metadata, MobileNavTrigger(), adminLogout(), metadata (+11 more)

### Community 104 - "ai-usage.ts"
Cohesion: 0.12
Nodes (17): AiDailyUsage, AiModelUsage, AiUsageTotals, AiWorkspaceUsage, DailyRow, dayKey(), dayLabel(), fillDaily() (+9 more)

### Community 105 - "material-select.tsx"
Cohesion: 0.08
Nodes (22): AiModelPolicyForm(), formatUSD(), ModelAlias, ModelOption, Notice, Policy, ContactDetailEditor(), Stage (+14 more)

### Community 106 - "service.ts"
Cohesion: 0.50
Nodes (4): fmtBytes(), Metrics, Sample, ServerStatsWidget()

### Community 107 - "automation-card.tsx"
Cohesion: 0.21
Nodes (8): BillingPage(), PLAN_KEY, AMOUNTS_IRR, CreditTopup(), PlanCheckout(), NOTE: lucide v1 removed brand icons (incl. Bitcoin) — Coins stands in for crypto, getMonthlyMessageCount(), monthKey()

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
Cohesion: 0.13
Nodes (20): InstagramAutomationContent(), normalizeSettings(), AutomationCard(), MESSAGE_TYPE_ICON, REPLY_MODE_ICON, TYPE_ICON, InstagramAutomationManager(), TabDef (+12 more)

### Community 113 - "openrouter.ts"
Cohesion: 0.19
Nodes (11): setLocale(), estedad, geistMono, geistSans, metadata, RootLayout(), Providers(), dirForLocale() (+3 more)

### Community 114 - "page.tsx"
Cohesion: 0.18
Nodes (11): generateMetadata(), SITE_URL, SOLUTION_META, SolutionPage(), getBlogEntries, sitemap(), Spotlight(), getSolution() (+3 more)

### Community 115 - "فایل‌های جدید"
Cohesion: 0.20
Nodes (10): `app/api/conversations/[conversationId]/handoff/route.ts`, `app/api/handoff-alerts/[alertId]/route.ts`, `app/api/handoff-alerts/route.ts`, `app/api/operator-channel/route.ts`, `app/api/operator-channel/test/route.ts`, `app/api/telegram-operator/webhook/route.ts`, `components/crm/conversation-panel.tsx`, `components/crm/operator-channel-setup.tsx` (+2 more)

### Community 116 - "route.ts"
Cohesion: 0.22
Nodes (11): DELETE(), Params, PATCH(), settingsSchema, bodySchema, GET(), ownAgent(), Params (+3 more)

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
Cohesion: 0.32
Nodes (10): DELETE(), GET(), POST(), isAdminAuthedRequest(), CapturedPayload, categorizePayload(), clearWebhookPayloads(), getWebhookPayloads() (+2 more)

### Community 121 - "vigento-actions.ts"
Cohesion: 0.20
Nodes (12): BodySchema, POST(), POST(), schema, ADMIN_OWNER_PHONE, AdminActionInput, AdminActionPayload, createAdminActionToken() (+4 more)

### Community 122 - "formatDateTime"
Cohesion: 0.21
Nodes (8): ProductDetailPage(), NotificationBell(), NotificationItem, KbItem, KbManager(), KbStatus, Mode, formatDateTime()

### Community 123 - "page.tsx"
Cohesion: 0.12
Nodes (20): AgentKnowledgePage(), AgentDetailPage(), AgentSettingsPage(), BUSINESSES, NewAgentPage(), NewInstagramAutomationPage(), InstagramWorkspacePage(), CHANNELS (+12 more)

### Community 125 - "layout.tsx"
Cohesion: 0.25
Nodes (9): GET(), PUT(), schema, isModelAlias(), MODEL_ALIASES, DEFAULT_PROVIDER_MODELS, FALLBACK, PlatformAiConfig (+1 more)

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
Cohesion: 0.43
Nodes (4): SettingsPage(), OperatorChannelInfo, OperatorChannelSetup(), WeeklyReportCard()

### Community 131 - "service-catalog-manager.tsx"
Cohesion: 0.24
Nodes (6): SectionHeader(), durations, EMPTY_FORM, ServiceCatalogManager(), ServiceItem, DialogShell()

### Community 132 - "system-errors-panel.tsx"
Cohesion: 0.33
Nodes (7): LevelBadge(), computeTrend(), Sparkline(), TrendDirection, SystemErrorsPanel(), errorsDailyByLevel(), errorsDailyBySource()

### Community 133 - "route.ts"
Cohesion: 0.31
Nodes (6): GET(), Params, GET(), LiveResource, versionOf(), mocks

### Community 134 - "route.ts"
Cohesion: 0.31
Nodes (8): DELETE(), encryptSensitiveFields(), GET(), ownIntegration(), Params, PATCH(), patchSchema, SENSITIVE_FIELDS

### Community 135 - "campaign-composer.tsx"
Cohesion: 0.32
Nodes (5): CampaignComposer(), DraftCampaign, Preview, CampaignLaunchButton(), CampaignAudienceInput

### Community 136 - "فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس"
Cohesion: 0.29
Nodes (7): `lib/docs/content.ts`, `lib/docs/nav.ts`, اعتبارسنجی نهایی, فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس, فایل‌های تغییر یافته, نتیجه, هدف

### Community 137 - "agent.ts"
Cohesion: 0.32
Nodes (6): agentCreateSchema, agentUpdateSchema, promptConfigSchema, promptFormatSchema, promptQAPairSchema, roleTemplateKeys

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

### Community 146 - "route.ts"
Cohesion: 0.28
Nodes (7): DELETE(), Params, PATCH(), updateSchema, resumeAiForConversation(), mocks, props

### Community 147 - "route.ts"
Cohesion: 0.38
Nodes (4): adminLogin(), AdminLoginState, initial, ADMIN_COOKIE

### Community 148 - "demo-section.tsx"
Cohesion: 0.29
Nodes (3): COPY, DemoSection(), Scenario

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

### Community 165 - "instagram-service-setup.tsx"
Cohesion: 0.50
Nodes (3): INSTAGRAM_SERVICE, InstagramServiceSetup(), Props

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
Cohesion: 0.16
Nodes (14): DELETE(), Params, PATCH(), GET(), POST(), DELETE(), GET(), ownProduct() (+6 more)

## Knowledge Gaps
- **1022 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `mini-services/**`, `node_modules/**`, `metadata` (+1017 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `ui.tsx`, `service-catalog-manager.tsx`, `charts.ts`, `page.tsx`, `webhook.ts`, `page.tsx`, `commercial-config.ts`, `route.ts`, `route.ts`, `popular-posts.tsx`, `page.tsx`, `social-links.tsx`, `low-credit-alert.ts`, `validation.ts`, `appointments-workspace.tsx`, `iphone-preview.tsx`, `helpers.ts`, `ingest.ts`, `automation-manager.tsx`, `instagram.ts`, `PageHeader`, `product.ts`, `page-header.tsx`, `vigento-actions.ts`, `material-select.tsx`, `service.ts`, `formatDateTime`, `page.tsx`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `page.tsx`, `agent-wizard.tsx`, `@prisma/client`, `logo.tsx`, `automation-card.tsx`, `@aws-sdk/client-s3`, `isAdminAuthed`, `index.ts`, `route.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `prisma.ts` to `loader.js`, `route.ts`, `qr-config.ts`, `route.ts`, `models.ts`, `syncOnboarding`, `activity.ts`, `registry.ts`, `route.ts`, `handler.ts`, `commercial-config.ts`, `ippanel.ts`, `route.ts`, `woocommerce.ts`, `route.ts`, `oauth.ts`, `route.ts`, `route.ts`, `jobs.ts`, `route.ts`, `vertical-bookings-vigento.test.ts`, `types.ts`, `route.ts`, `contacts-view.tsx`, `chat-orchestrator.ts`, `automation-manager.tsx`, `page.tsx`, `conversation-thread.tsx`, `route.ts`, `route.ts`, `route.ts`, `route.ts`, `page.tsx`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `mini-services/**` to the rest of the system?**
  _1022 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `automation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1109936575052854 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06648936170212766 - nodes in this community are weakly interconnected._
- **Should `loader.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09869375907111756 - nodes in this community are weakly interconnected._