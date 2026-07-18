# Graph Report - vignet  (2026-07-18)

## Corpus Check
- 541 files · ~408,386 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3232 nodes · 7457 edges · 205 communities (185 shown, 20 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bbe9b121`
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
- automation-manager.tsx
- scheduler.ts
- API
- getEffectivePlanDefs
- checkWorkspaceActive
- فایل‌های تغییر یافته
- index.ts
- page.tsx
- isAdminAuthed
- auth.ts
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
- agent-settings-form.tsx
- logo.tsx
- vigento-actions.ts
- layout.tsx
- material-select.tsx
- service.ts
- automation-card.tsx
- automation-card.tsx
- build-plugin-zip.mjs
- Quick Reference
- media-uploader.tsx
- page.tsx
- automation-card.tsx
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
- types.ts
- page-header.tsx
- embeddings.ts
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
- page.tsx
- route.ts
- page.tsx
- نکات اجرایی
- Q: Fix the send-message modal layering in customers and conversations
- setup-server.sh
- setup-whatsapp-bridge.sh
- conversation-panel.tsx
- start-demo.sh
- next-auth.d.ts
- 🚀 PHASES OF IMPLEMENTATION
- CSS Transform Mastery
- The Sonner Principles (Building Loved Components)
- Spring Animations
- Common Rules for Professional UI
- Example Workflow
- docs-sidebar.tsx
- Q: میخوام قسمت انیمشن Vigento AI | هوش مصنوعی ویجنتو توی پنل داشبورد کاربر رو برام بهبود بدی و میخوام از neural-operation-graph.tsx یا قسمت مرکز عملیات هوشمند کسب‌وکار توی صفحه اصلی الگو بگیری و افکت اتصال به کارت و مسیر اتصال رو مشابه همین درست کنی
- route.ts
- next-auth
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
- `AgentLearningPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/learning/page.tsx → lib/session.ts
- `EditInstagramAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/instagram/[automationId]/edit/page.tsx → lib/session.ts
- `IntegrationsPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/integrations/page.tsx → lib/session.ts
- `AttentionItem()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/overview/page.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (205 total, 20 thin omitted)

### Community 0 - "automation.ts"
Cohesion: 0.11
Nodes (42): AutomationAction, AutomationPolicy, AutomationRow, AutomationTrigger, checkUserFollows(), DEFAULT_AUTOMATION_POLICY, executeAction(), isReplyMode() (+34 more)

### Community 1 - "cn"
Cohesion: 0.05
Nodes (51): fmtBytes(), Metrics, Sample, ServerStatsWidget(), Msg, TestPlayground(), VoiceRecorder, ConversationBubble() (+43 more)

### Community 2 - "ui.tsx"
Cohesion: 0.22
Nodes (14): crawlUrlToKnowledge(), refreshStaleUrlKnowledge(), ChunkOptions, chunkText(), splitBySentence(), contextualChunk(), IngestionJobData, processIngestion() (+6 more)

### Community 3 - "loader.js"
Cohesion: 0.08
Nodes (56): CHANNELS, IntegrationsPage(), AddStoreForm(), DIRECTION_LABEL, ENTITY_LABEL, formatDate(), IntegrationCard(), StoreIntegrationItem (+48 more)

### Community 4 - "prisma.ts"
Cohesion: 0.05
Nodes (55): bodySchema, Params, POST(), GET(), ownAgent(), Params, POST(), saveSchema (+47 more)

### Community 5 - "chat-engine.ts"
Cohesion: 0.08
Nodes (46): buildSystemPrompt(), bumpProductQueries(), generateReply(), GenerateReplyOptions, GenerateReplyResult, hydrateSystemPrompt(), persistAssistantTurn(), persistHandoff() (+38 more)

### Community 6 - "qr-config.ts"
Cohesion: 0.28
Nodes (12): Params, POST(), Params, POST(), PUT(), GET(), Params, bridgeBaseUrl() (+4 more)

### Community 7 - "charts.ts"
Cohesion: 0.19
Nodes (17): GET(), guard(), POST(), DELETE(), GET(), guard(), Params, PATCH() (+9 more)

### Community 8 - "page.tsx"
Cohesion: 0.12
Nodes (32): AdminAgentDetailPage(), CHANNEL_LABEL, AdminAgentsPage(), AccountStatus(), AdminAiPage(), formatProviderUSD(), formatRequestUSD(), formatRial() (+24 more)

### Community 9 - "prompt-builder.ts"
Cohesion: 0.17
Nodes (15): BaseRoleKey, buildLayeredPrompt(), BUSINESS_ROLE_SPECS, BUSINESS_ROLE_TEMPLATES, BusinessRoleSpec, BusinessType, formatFormatLayer(), formatLengthInstruction() (+7 more)

### Community 10 - "page.tsx"
Cohesion: 0.14
Nodes (15): GET(), POST(), POST(), POST(), POST(), POST(), readBotToken(), handleInstagramGlobalInbound() (+7 more)

### Community 11 - "models.ts"
Cohesion: 0.16
Nodes (12): AgentWizard(), BUSINESS_PRESETS, channelLabel(), ConfigDraft, CreatedAgent, draftFromRole(), FormState, AgentSettingsForm() (+4 more)

### Community 12 - "captureError"
Cohesion: 0.10
Nodes (11): AutomationForm(), defaultReplyMode(), emptyTextMessage(), KeywordFilter, MediaUploader, normalizeMessage(), PostFilter, ProductLite (+3 more)

### Community 13 - "webhook.ts"
Cohesion: 0.08
Nodes (34): AdminPaymentsPage(), AdminPaymentDetailPage(), GATEWAY_BADGE, PLAN_BADGE, STATUS_BADGE, StatusSummary(), AdminRevenuePage(), PLAN_BADGE (+26 more)

### Community 14 - "page.tsx"
Cohesion: 0.21
Nodes (14): DocsHomePage(), metadata, DocPageRoute(), generateMetadata(), DocContent(), pick(), DocBlock, DocPage (+6 more)

### Community 15 - "syncOnboarding"
Cohesion: 0.11
Nodes (30): GET(), Params, POST(), PUT(), appUrl(), GET(), POST(), readIgUserId() (+22 more)

### Community 16 - "session.ts"
Cohesion: 0.13
Nodes (16): AdminLoginForm(), AdminLoginPage(), metadata, GET(), PUT(), schema, GET(), BodySchema (+8 more)

### Community 17 - "page.tsx"
Cohesion: 0.14
Nodes (14): AnalyticsPage(), daysAgo(), nfFa(), CHANNEL_LABELS, ChannelBadge(), ICONS, BarItem, BarList() (+6 more)

### Community 18 - "activity.ts"
Cohesion: 0.10
Nodes (22): DELETE(), Params, PATCH(), settingsSchema, bodySchema, GET(), ownAgent(), Params (+14 more)

### Community 19 - "registry.ts"
Cohesion: 0.06
Nodes (53): baseUrl(), bodySchema, Params, POST(), WEBHOOK_PATH, appBaseUrl(), createSchema, GET() (+45 more)

### Community 20 - "commercial-config.ts"
Cohesion: 0.08
Nodes (32): AdminPlatformSettingsPage(), GET(), nonNegativeInt, planSchema, positiveInt, PUT(), schema, bodySchema (+24 more)

### Community 21 - "handler.ts"
Cohesion: 0.09
Nodes (27): POST(), getContactName(), persistFixedAssistantReply(), persistInboundOnly(), processChannelInbound(), profileFields(), NOTE: do NOT add sender.id here — that's the customer who messaged, reactAfterInstagramReply() (+19 more)

### Community 22 - "rateLimit"
Cohesion: 0.10
Nodes (21): Progress(), AdminUsagePage(), parseRange(), TYPE_LABEL, OPTIONS, RangeKind, RangeSwitch(), ActivationFunnel() (+13 more)

### Community 23 - "ippanel.ts"
Cohesion: 0.13
Nodes (20): confirmSchema, Params, POST(), POST(), createSchema, GET(), POST(), bodySchema (+12 more)

### Community 24 - "automation-form.tsx"
Cohesion: 0.29
Nodes (6): AiModelPolicyForm(), formatUSD(), ModelAlias, ModelOption, Notice, Policy

### Community 25 - "dependencies"
Cohesion: 0.07
Nodes (27): @aws-sdk/client-s3, bullmq, clsx, lucide-react, next, next-intl, dependencies, @aws-sdk/client-s3 (+19 more)

### Community 26 - "devDependencies"
Cohesion: 0.07
Nodes (27): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, postcss (+19 more)

### Community 27 - "woocommerce.ts"
Cohesion: 0.16
Nodes (26): GET(), loadIntegration(), POST(), checkWorkspaceActive(), authHeader(), deleteProductFromWoo(), fetchWooJson(), findContactByEmail() (+18 more)

### Community 28 - "config.ts"
Cohesion: 0.12
Nodes (23): COLOR_PRESETS, WebWidgetChannel(), FONT_FAMILY_BY_KEY, hexToRgba(), shade(), WIDGET_ICON_COMPONENTS, WidgetPreview(), CachedWidgetPayload (+15 more)

### Community 29 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions (+19 more)

### Community 30 - "Animation Standards Reference"
Cohesion: 0.07
Nodes (25): Aggressive Escalation Triggers, Guidelines, Operating Posture, Part 1 — Findings table (REQUIRED), Part 2 — Verdict (REQUIRED), Remedial Preference Hierarchy, Required Output Format, Reviewing Animations (+17 more)

### Community 31 - "route.ts"
Cohesion: 0.07
Nodes (38): SettingsPage(), BuildMode, Props, Header(), ChangeDetail, MODULES, VerticalChangeNotice(), BusinessProfileStep() (+30 more)

### Community 32 - "layout.tsx"
Cohesion: 0.47
Nodes (3): AgentLearningPage(), LearningCenter(), LearningItem

### Community 33 - "package.json"
Cohesion: 0.09
Nodes (22): express, dependencies, express, pino, @whiskeysockets/baileys, description, devDependencies, tsx (+14 more)

### Community 34 - "registry.ts"
Cohesion: 0.67
Nodes (4): AdminDatabasePage(), DATABASE_MODELS, readDatabaseModel(), serializeValue()

### Community 35 - "auth.ts"
Cohesion: 0.39
Nodes (10): appHeaders(), asRecord(), chatCompletion(), ChatOptions, ChatToolCall, firstChoice(), parseUsage(), requestBody() (+2 more)

### Community 36 - "oauth.ts"
Cohesion: 0.15
Nodes (22): Params, PendingNumber, POST(), appUrl(), connectNumber(), GET(), POST(), buildWhatsappOAuthConfig() (+14 more)

### Community 37 - "page.tsx"
Cohesion: 0.15
Nodes (10): InstagramConnectFlow(), FIELD_SETS, FieldDef, formatRelative(), ICONS, isComplete(), MessengerChannel(), MessengerKind (+2 more)

### Community 38 - "popular-posts.tsx"
Cohesion: 0.14
Nodes (25): Meter(), ModelSelect(), TIER_ICON, ReplyCreditEstimator(), PricingSection(), AGENT_MODELS, AgentModel, BY_ALIAS (+17 more)

### Community 39 - "route.ts"
Cohesion: 0.17
Nodes (17): appBaseUrl(), createSchema, encryptSensitiveFields(), GET(), POST(), SENSITIVE_FIELDS, assertSafeHttpUrl(), hostnameWithoutBrackets() (+9 more)

### Community 40 - "Animation Audit Playbook"
Cohesion: 0.09
Nodes (21): 1. Purpose & frequency, 2. Easing & duration, 3. Physicality & origin, 4. Interruptibility, 5. Performance, 6. Accessibility, 7. Cohesion & tokens, 8. Missed opportunities (+13 more)

### Community 41 - "trend-chart.tsx"
Cohesion: 0.15
Nodes (26): AdminOverviewPage(), parseRange(), startOfToday(), getAiOverview(), AgentSpark, conversationsDaily(), DailyPoint, errorsDaily() (+18 more)

### Community 42 - "route.ts"
Cohesion: 0.15
Nodes (19): DELETE(), POST(), POST(), NOTE: The bot token is in the URL path because Telegram can only send the, TgMessage, tgSendMessage(), TgUpdate, GET() (+11 more)

### Community 43 - "jobs.ts"
Cohesion: 0.16
Nodes (23): bodySchema, GET(), ownAgent(), Params, PUT(), bodySchema, Params, POST() (+15 more)

### Community 44 - "chat-client.tsx"
Cohesion: 0.11
Nodes (22): AiDailyUsage, AiModelUsage, AiUsageTotals, AiWorkspaceUsage, DailyRow, dayKey(), dayLabel(), fillDaily() (+14 more)

### Community 45 - "material-select.tsx"
Cohesion: 0.13
Nodes (16): adminLogin(), AdminLoginState, initial, Intro(), { handlers, auth, signOut }, EASE, OTPCredentialLike, PhoneOtpForm() (+8 more)

### Community 47 - "vigent-woo.php"
Cohesion: 0.22
Nodes (19): vigent_woo_add_admin_menu(), vigent_woo_content_to_payload(), vigent_woo_full_sync(), vigent_woo_get_settings(), vigent_woo_has_wc(), vigent_woo_on_content_delete(), vigent_woo_on_content_save(), vigent_woo_on_order_status_changed() (+11 more)

### Community 48 - "config.ts"
Cohesion: 0.16
Nodes (14): buildMessengerConfig(), MessengerConfig, MessengerSettings, newWebhookToken(), decrypt(), encrypt(), getKey(), AutomationPolicySnapshot (+6 more)

### Community 49 - "route.ts"
Cohesion: 0.24
Nodes (13): POST(), bodySchema, GET(), Params, POST(), POST(), startChat(), createPublicConversationToken() (+5 more)

### Community 50 - "route.ts"
Cohesion: 0.13
Nodes (14): DELETE(), EXT_TO_MIME, GET(), Params, resolveFilePath(), authorized(), PROTECTED_PREFIXES, grants (+6 more)

### Community 51 - "page.tsx"
Cohesion: 0.05
Nodes (74): GET(), PATCH(), Props, bookingErrorResponse(), GET(), POST(), GET(), POST() (+66 more)

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
Cohesion: 0.38
Nodes (5): getPopularPosts(), getWorkspaceId(), PopularPosts(), PostPreview, ViewsLabel()

### Community 57 - "vertical-bookings-vigento.test.ts"
Cohesion: 0.21
Nodes (17): formatPersianDate(), generateCode(), IppanelMeta, ippanelSend(), isSmsConfigured(), OtpRateLimitError, planLabelFa(), sendActivationCompleteSms() (+9 more)

### Community 58 - "validation.ts"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: حذف دانش و قواعد، حذف نقطه اتصال میانی، اصلاح اتصال کارت‌های مشتری‌ها و گفتگوها و سفیدکردن کارت‌ها, Source Nodes

### Community 59 - "appointments-workspace.tsx"
Cohesion: 0.22
Nodes (9): CHANNEL_LABELS, FailedJobLog, HealthPayload, HealthState, QUEUE_LABELS, Service, ServiceHealthPanel(), STATE_META (+1 more)

### Community 60 - "iphone-preview.tsx"
Cohesion: 0.10
Nodes (21): AppointmentCard(), AppointmentRow, AppointmentStatus, AppointmentsWorkspace(), BookingDialog(), DayMetric(), groupByTimeSlot(), Locale (+13 more)

### Community 61 - "types.ts"
Cohesion: 0.13
Nodes (28): AdminVigentoPage(), CAPABILITIES, bodySchema, Params, POST(), POST(), recordRun(), requestSchema (+20 more)

### Community 62 - "helpers.ts"
Cohesion: 0.08
Nodes (34): AdminBlogPage(), CHANNEL_LABEL, STATUS_META, GATEWAY_BADGE, PLAN_BADGE, STATUS_BADGE, AdminPagination(), BADGE_TONES (+26 more)

### Community 63 - "page.tsx"
Cohesion: 0.10
Nodes (17): ChannelsSection, FaqSection, FeaturesSection, HomePage(), metadata, PricingSection, VigentoSection, COPY (+9 more)

### Community 64 - "agent-wizard.tsx"
Cohesion: 0.27
Nodes (8): GET(), META, StatusPage(), HealthCheck, HealthReport, runHealthChecks(), timed(), withTimeout()

### Community 65 - "route.ts"
Cohesion: 0.10
Nodes (31): bodySchema, Params, POST(), bodySchema, Params, POST(), campaignDeliveryText(), CampaignJobData (+23 more)

### Community 66 - "contacts-view.tsx"
Cohesion: 0.20
Nodes (22): generateMetadata(), getWorkspaceId(), Props, PublicBlogPostPage(), BlogEditor(), isFa(), PublicPost, PublicPostCard() (+14 more)

### Community 67 - "chat-orchestrator.ts"
Cohesion: 0.06
Nodes (48): POST(), appUrl(), GET(), handleCallback(), POST(), readPid(), appUrl(), bodySchema (+40 more)

### Community 68 - "ingest.ts"
Cohesion: 0.20
Nodes (16): AttentionItem(), buildTrend(), daysAgo(), isRecord(), MODULE_META, OverviewPage(), percentDelta(), PLAN_NAMES_FA (+8 more)

### Community 69 - "Glossary"
Cohesion: 0.11
Nodes (17): Animation Vocabulary, Easing — how speed changes over an animation, Entrances & Exits — how elements appear and disappear, Examples, Feedback & Interaction — responding to the user's actions, Glossary, Instructions, Looping & Ambient Motion — animations that run on their own (+9 more)

### Community 70 - "layout.tsx"
Cohesion: 0.13
Nodes (14): AdminPostRow, STATUS_BADGE_CLS, STATUS_LABELS_EN, STATUS_LABELS_FA, BlogCategory, BlogPostData, EMPTY_POST, JsonImportDialog() (+6 more)

### Community 71 - "automation-manager.tsx"
Cohesion: 0.16
Nodes (19): DELETE(), Params, GET(), POST(), GET(), PATCH(), AgentDetailPage(), SetupStep (+11 more)

### Community 73 - "booking-manager.tsx"
Cohesion: 0.18
Nodes (11): NotificationBell(), NotificationItem, KbItem, KbManager(), KbStatus, Mode, DIVISIONS, formatDate() (+3 more)

### Community 74 - "instagram.ts"
Cohesion: 0.16
Nodes (11): MobilePlanView, PLAN_TRANSLATION_KEY, MODEL_ALIASES, grantIncludedPlanCredit(), planCreditGrantKey(), PlanCreditGrantResult, envInt(), envNonNegativeInt() (+3 more)

### Community 75 - "PageHeader"
Cohesion: 0.33
Nodes (13): LocalizedDatePicker(), PickerPosition, WEEKDAYS, CalendarMonth, calendarMonthLength(), calendarMonthOffset(), calendarPartsFromDateKey(), dateKeyFromCalendarParts() (+5 more)

### Community 76 - "page.tsx"
Cohesion: 0.07
Nodes (37): DELETE(), GET(), ownAgent(), Params, PUT(), putSchema, GET(), Params (+29 more)

### Community 77 - "conversation-thread.tsx"
Cohesion: 0.21
Nodes (14): CHANNEL_LABELS_FA, ConversationsPage(), VALID_CHANNELS, VALID_STATUSES, LiveArrivalItem(), LiveArrivalProvider(), LiveArrivalsContext, LiveArrivalsContextValue (+6 more)

### Community 78 - "neural-operation-graph.tsx"
Cohesion: 0.09
Nodes (12): NeuralConnectionNode(), NeuralConnectionNodeProps, NeuralConnectionPath(), NeuralConnectionPathProps, NeuralNetworkDefs(), NeuralSignalParticle(), NeuralSignalParticleProps, NeuralSignalTrace() (+4 more)

### Community 79 - "automation-manager.tsx"
Cohesion: 0.18
Nodes (11): InstagramAutomationContent(), normalizeSettings(), InstagramAutomationManager(), TabDef, TABS, AutomationType, DEFAULT_SETTINGS, InstagramAutomationSettings (+3 more)

### Community 80 - "scheduler.ts"
Cohesion: 0.14
Nodes (18): EmailMessage, escapeHtml(), getClient(), notifyOps(), sendEmail(), NotificationJobData, processNotification(), runInlineNotification() (+10 more)

### Community 81 - "API"
Cohesion: 0.12
Nodes (16): API, Available scripts, Environment, `GET /health`, `GET /status?sessionId=<id>`, How it fits in, Install & run, Limits & caveats (+8 more)

### Community 82 - "getEffectivePlanDefs"
Cohesion: 0.14
Nodes (9): actionSchema, buttonSchema, createSchema, GET(), messageEntrySchema, Params, POST(), triggerSchema (+1 more)

### Community 84 - "فایل‌های تغییر یافته"
Cohesion: 0.12
Nodes (16): `app/api/agents/[agentId]/route.ts` (PATCH), `app/api/agents/route.ts` (POST), `app/api/chat/route.ts` و `app/api/widget/[agentId]/chat/route.ts`, `app/(dashboard)/agents/[agentId]/settings/page.tsx`, `components/agent-builder/agent-wizard.tsx`, `components/agent-builder/flow-templates.ts`, `components/agents/agent-settings-form.tsx` (بازنویسی کامل), `lib/ai/chat-engine.ts` (+8 more)

### Community 85 - "index.ts"
Cohesion: 0.16
Nodes (14): MessageBuilder(), app, AUTH_ROOT, bootstrap(), __dirname, forwardInbound(), log, newState() (+6 more)

### Community 86 - "page.tsx"
Cohesion: 0.11
Nodes (25): ConnectionGeometry, ConnectionNetwork(), ConnectionTiming, DEFAULT_MODULES, DESKTOP_LAYOUTS, distanceBetween(), FALLBACK_NETWORK_SIZE, formatPoint() (+17 more)

### Community 87 - "isAdminAuthed"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 88 - "auth.ts"
Cohesion: 0.29
Nodes (12): ALLOWED, POST(), createSessionToken(), decodeBase32(), isValidToken(), safeEqual(), secret(), sign() (+4 more)

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
Cohesion: 0.22
Nodes (17): databaseHealth(), FailedJobLog, GET(), HealthState, openRouterHealth(), POST(), QueueRow, redisAndQueuesHealth() (+9 more)

### Community 93 - "VIGENT — Complete Claude Code Project Prompt v2"
Cohesion: 0.14
Nodes (13): ⚙️ BACKGROUND JOBS (BullMQ), 🗃 DATABASE SCHEMA (Prisma), 📋 ENVIRONMENT VARIABLES, 🗂 FILE STRUCTURE, 💡 IMPLEMENTATION NOTES, 🌐 INTERNATIONALIZATION, 🧠 MANAGED AI + REPLY CREDIT — CRITICAL ARCHITECTURE, Multi-Tenant AI Agent SaaS Platform | vigent.ir (+5 more)

### Community 94 - "route.ts"
Cohesion: 0.24
Nodes (16): notifyWorkspace(), alertSilentChannels(), cleanupOldRecords(), ONBOARDING_NEXT_STEP_FA, remindExpiringSubscriptions(), remindUpcomingAppointments(), runAppointmentReminders(), runChannelCheck() (+8 more)

### Community 95 - "page-header.tsx"
Cohesion: 0.14
Nodes (13): CampaignComposer(), DraftCampaign, Preview, CampaignLaunchButton(), CHANNEL_LABEL, ListView(), PipelineView(), rowDisplayName() (+5 more)

### Community 97 - "navbar.tsx"
Cohesion: 0.14
Nodes (24): GET(), Params, ConversationThreadPage(), ConversationThread(), ThreadMessage, OperatorReply(), InboundSource, InboundSourceKind (+16 more)

### Community 98 - "Vignet Improvements — CHANGES.md"
Cohesion: 0.15
Nodes (12): `app/api/agents/[agentId]/knowledge/route.ts`, `app/(dashboard)/agents/[agentId]/knowledge/page.tsx`, `components/knowledge/kb-manager.tsx`, `lib/knowledge/ingest.ts`, `lib/knowledge/vector-store.ts`, `messages/fa.json` و `messages/en.json`, Vignet Improvements — CHANGES.md, فاز ۱ — موتور پرامپت ۶ لایه‌ای + تمپلیت‌های نقش‌محور (+4 more)

### Community 99 - "فایل‌های تغییر یافته"
Cohesion: 0.15
Nodes (13): `app/(dashboard)/agents/[agentId]/analytics/page.tsx`, `app/(dashboard)/contacts/page.tsx`, `app/(dashboard)/conversations/page.tsx`, `app/(dashboard)/overview/page.tsx`, `components/dashboard/charts/conversation-chart.tsx`, `components/dashboard/charts/hourly-heatmap.tsx`, `components/dashboard/charts/satisfaction-gauge.tsx`, `components/dashboard/metrics-explainer.tsx` (جدید) (+5 more)

### Community 100 - "catalog.ts"
Cohesion: 0.29
Nodes (10): deleteChunksForProduct(), insertChunk(), InsertChunkInput, toVectorLiteral(), buildProductText(), getOrCreateProductKB(), processProductEmbed(), ProductEmbedJobData (+2 more)

### Community 101 - "agent-settings-form.tsx"
Cohesion: 0.15
Nodes (7): AgentSettingsData, EMPTY_CONFIG, LayerTab, PromptConfig, PromptFormatConfig, PromptQAPair, RoleTemplate

### Community 102 - "logo.tsx"
Cohesion: 0.22
Nodes (10): VigentoComposer(), getRoleTemplate(), LEGACY_ROLE_TEMPLATES, ROLE_TEMPLATES, detectRole(), fallbackVigentoDraft(), recommendedChannels, roleKeys (+2 more)

### Community 103 - "vigento-actions.ts"
Cohesion: 0.07
Nodes (32): logout(), setLocale(), metadata, estedad, geistMono, geistSans, metadata, RootLayout() (+24 more)

### Community 104 - "layout.tsx"
Cohesion: 0.27
Nodes (9): BrandHeader(), NAV_ITEMS, NavItem, NavList(), AdminLayout(), metadata, MobileNavTrigger(), adminLogout() (+1 more)

### Community 105 - "material-select.tsx"
Cohesion: 0.32
Nodes (10): DELETE(), GET(), POST(), isAdminAuthedRequest(), CapturedPayload, categorizePayload(), clearWebhookPayloads(), getWebhookPayloads() (+2 more)

### Community 106 - "service.ts"
Cohesion: 0.28
Nodes (7): DELETE(), Params, PATCH(), updateSchema, resumeAiForConversation(), mocks, props

### Community 107 - "automation-card.tsx"
Cohesion: 0.31
Nodes (8): DELETE(), encryptSensitiveFields(), GET(), ownIntegration(), Params, PATCH(), patchSchema, SENSITIVE_FIELDS

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

### Community 112 - "page.tsx"
Cohesion: 0.20
Nodes (9): STAGE_LABELS_EN, STAGE_LABELS_FA, ContactRow, ContactsView(), COLORS, DashboardDonut(), NamedPoint, ExplainerItem (+1 more)

### Community 113 - "automation-card.tsx"
Cohesion: 0.20
Nodes (9): OperatorChannelInfo, OperatorChannelSetup(), AutomationCard(), MESSAGE_TYPE_ICON, REPLY_MODE_ICON, TYPE_ICON, MessageType, REPLY_MODE_SHORT_LABEL_KEY (+1 more)

### Community 114 - "page.tsx"
Cohesion: 0.20
Nodes (10): generateMetadata(), SITE_URL, SOLUTION_META, SolutionPage(), getBlogEntries, sitemap(), getSolution(), Solution (+2 more)

### Community 115 - "فایل‌های جدید"
Cohesion: 0.20
Nodes (10): `app/api/conversations/[conversationId]/handoff/route.ts`, `app/api/handoff-alerts/[alertId]/route.ts`, `app/api/handoff-alerts/route.ts`, `app/api/operator-channel/route.ts`, `app/api/operator-channel/test/route.ts`, `app/api/telegram-operator/webhook/route.ts`, `components/crm/conversation-panel.tsx`, `components/crm/operator-channel-setup.tsx` (+2 more)

### Community 116 - "route.ts"
Cohesion: 0.24
Nodes (10): bodySchema, GET(), OPTIONS(), Params, GET(), OPTIONS(), Params, corsHeaders (+2 more)

### Community 117 - "Design Engineering"
Cohesion: 0.22
Nodes (8): Accessibility, Design Engineering, Initial Response, prefers-reduced-motion, Review Checklist, Review Format (Required), Stagger Animations, Touch device hover states

### Community 118 - "UI/UX Pro Max - Design Intelligence"
Cohesion: 0.22
Nodes (8): Available Domains, Available Stacks, How to Use, Output Formats, Prerequisites, Rule Categories by Priority, Search Reference, UI/UX Pro Max - Design Intelligence

### Community 119 - "route.ts"
Cohesion: 0.35
Nodes (9): GET(), ownAgent(), Params, POST(), BUCKETS, downloadFile(), getClient(), isStorageConfigured() (+1 more)

### Community 120 - "key"
Cohesion: 0.33
Nodes (6): defaultSettings(), GET(), Params, PATCH(), patchSchema, REPLY_POLICIES

### Community 121 - "vigento-actions.ts"
Cohesion: 0.29
Nodes (9): POST(), schema, AdminActionInput, AdminActionPayload, createAdminActionToken(), executeAdminAction(), secret(), signature() (+1 more)

### Community 122 - "formatDateTime"
Cohesion: 0.24
Nodes (7): AgentAnalyticsPage(), ContactsPage(), ProductsPage(), DashboardBarList(), NamedPoint, Pagination(), dateLocaleTag()

### Community 123 - "page.tsx"
Cohesion: 0.07
Nodes (33): AgentCatalogPage(), NewAutomationPage(), AgentKnowledgePage(), AgentLayout(), AgentSettingsPage(), BUSINESSES, NewAgentPage(), ContactDetailPage() (+25 more)

### Community 125 - "layout.tsx"
Cohesion: 0.18
Nodes (12): DELETE(), GET(), getOwnedAgent(), Params, PATCH(), agentCreateSchema, agentUpdateSchema, promptConfigSchema (+4 more)

### Community 126 - "راهنمای قیمت‌گذاری ویجنت"
Cohesion: 0.22
Nodes (8): تصمیم تجاری نهایی, داشبوردی که باید هر هفته کنترل شود, راهنمای قیمت‌گذاری ویجنت, سه مدل مدیریت‌شده, فرمول سود و نقطهٔ بازبینی, قبل از انتشار production, هزینهٔ واقعی یک پاسخ معمولی, چهار پیشنهاد روی سایت

### Community 127 - "Component Building Principles"
Cohesion: 0.25
Nodes (8): Animate enter states with @starting-style, Buttons must feel responsive, Component Building Principles, Make popovers origin-aware, Never animate from scale(0), Tooltips: skip delay on subsequent hovers, Use blur to mask imperfect transitions, Use CSS transitions over keyframes for interruptible UI

### Community 129 - "فایل‌های تغییر یافته"
Cohesion: 0.25
Nodes (8): `app/(dashboard)/conversations/[conversationId]/page.tsx`, `app/(dashboard)/settings/page.tsx`, `lib/docs/content.ts`, `lib/docs/nav.ts`, `messages/fa.json` و `messages/en.json`, فاز ۳ — انتقال به اپراتور در تلگرام + شناسایی مشتری + پنل گفتگو, فایل‌های تغییر یافته, هدف

### Community 130 - "types.ts"
Cohesion: 0.27
Nodes (10): FormState, IphonePreviewProps, AutomationMessage, GateMode, MATCH_MODE_DESC, MatchMode, MediaType, QuickReplyButton (+2 more)

### Community 131 - "page-header.tsx"
Cohesion: 0.36
Nodes (6): agent_hint_body(), agent_hint_title(), AgentsPage(), PageHeader(), IMPORTANT: by request, there is NO kicker / eyebrow text above the title., conversationsDailyByAgent()

### Community 132 - "embeddings.ts"
Cohesion: 0.42
Nodes (8): callEmbeddings(), embedCacheKey(), EmbedContext, embedText(), embedTexts(), getCachedEmbedding(), getEmbedContext(), setCachedEmbedding()

### Community 133 - "route.ts"
Cohesion: 0.39
Nodes (6): GET(), LiveResource, contactLiveVersion(), ContactVersionRow, conversationLiveVersion(), ConversationVersionRow

### Community 134 - "route.ts"
Cohesion: 0.38
Nodes (6): buttonSchema, DELETE(), owns(), Params, PATCH(), updateSchema

### Community 135 - "campaign-composer.tsx"
Cohesion: 0.27
Nodes (7): DELETE(), dismissSchema, GET(), ownAgent(), Params, mocks, props

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

### Community 146 - "page.tsx"
Cohesion: 0.38
Nodes (5): EditAutomationPage(), EditInstagramAutomationPage(), Automation, AutomationAction, AutomationTrigger

### Community 147 - "route.ts"
Cohesion: 0.53
Nodes (5): deleteContent(), handleWpContentWebhook(), upsertContent(), WpContentPayload, writeLog()

### Community 148 - "page.tsx"
Cohesion: 0.60
Nodes (4): generateMetadata(), getWorkspaceId(), Props, PublicBlogCategoryPage()

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

### Community 153 - "conversation-panel.tsx"
Cohesion: 0.40
Nodes (3): ConversationPanel(), HandoffAlertProp, MESSENGER_META

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

## Knowledge Gaps
- **1031 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `mini-services/**`, `node_modules/**`, `metadata` (+1026 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `intelligence-core.tsx` (3× useful, score=2.978993284)
- `getConnectionGeometry()` (2× useful, score=1.98655573)
- `neural-operation-graph.tsx` (2× useful, score=1.985466693)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `page-header.tsx`, `loader.js`, `page.tsx`, `webhook.ts`, `page.tsx`, `commercial-config.ts`, `rateLimit`, `automation-form.tsx`, `conversation-panel.tsx`, `route.ts`, `registry.ts`, `docs-sidebar.tsx`, `popular-posts.tsx`, `social-links.tsx`, `appointments-workspace.tsx`, `iphone-preview.tsx`, `types.ts`, `helpers.ts`, `ingest.ts`, `layout.tsx`, `automation-manager.tsx`, `booking-manager.tsx`, `instagram.ts`, `PageHeader`, `conversation-thread.tsx`, `product.ts`, `page-header.tsx`, `navbar.tsx`, `vigento-actions.ts`, `layout.tsx`, `automation-card.tsx`, `page.tsx`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `page.tsx`, `route.ts`, `next-auth`, `@prisma/client`, `charts.ts`, `page.tsx`, `getVerticalPack`, `isAdminAuthed`, `index.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `prisma.ts` to `route.ts`, `qr-config.ts`, `route.ts`, `campaign-composer.tsx`, `syncOnboarding`, `activity.ts`, `registry.ts`, `commercial-config.ts`, `handler.ts`, `ippanel.ts`, `woocommerce.ts`, `oauth.ts`, `route.ts`, `route.ts`, `jobs.ts`, `route.ts`, `page.tsx`, `types.ts`, `route.ts`, `chat-orchestrator.ts`, `automation-manager.tsx`, `page.tsx`, `getEffectivePlanDefs`, `navbar.tsx`, `service.ts`, `automation-card.tsx`, `route.ts`, `key`, `page.tsx`, `layout.tsx`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `mini-services/**` to the rest of the system?**
  _1031 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `automation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1109936575052854 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.04631578947368421 - nodes in this community are weakly interconnected._
- **Should `loader.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07578084997439836 - nodes in this community are weakly interconnected._