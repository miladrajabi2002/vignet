# Graph Report - vignet  (2026-07-17)

## Corpus Check
- 555 files · ~416,365 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3341 nodes · 7604 edges · 221 communities (192 shown, 29 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3a29637d`
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
- route.ts
- health.ts
- route.ts
- automation-card.tsx
- automation-card.tsx
- build-plugin-zip.mjs
- Quick Reference
- media-uploader.tsx
- demo-section.tsx
- openrouter.ts
- route.ts
- فایل‌های جدید
- recharts
- Design Engineering
- UI/UX Pro Max - Design Intelligence
- actions.ts
- service-catalog-manager.tsx
- test-playground.tsx
- json-import-dialog.tsx
- page.tsx
- system-monitor.tsx
- راهنمای قیمت‌گذاری ویجنت
- Component Building Principles
- فایل‌های تغییر یافته
- s3.ts
- layout.tsx
- rateLimit
- route.ts
- react
- page.tsx
- فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس
- intelligence-core.tsx
- extends
- Vigent
- The Animation Decision Framework
- clip-path for Animation
- Performance Rules
- Gesture and Drag Interactions
- Pre-Delivery Checklist
- How to Use This Skill
- route.ts
- popular-posts.tsx
- route.ts
- نکات اجرایی
- route.ts
- setup-server.sh
- setup-whatsapp-bridge.sh
- page.tsx
- start-demo.sh
- next-auth.d.ts
- 🚀 PHASES OF IMPLEMENTATION
- CSS Transform Mastery
- The Sonner Principles (Building Loved Components)
- Spring Animations
- Common Rules for Professional UI
- Example Workflow
- use-cases-section.tsx
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
- agent-versions.tsx
- cta-section.tsx
- particle-grid.tsx
- backup.sh
- next.config.mjs
- seed-demo.ts
- tailwind.config.ts
- 🔗 CHANNEL IMPLEMENTATIONS
- 📡 NEW CHANNELS: RUBIKA + BALE
- 🖥 MARKETING WEBSITE — B&W CINEMATIC
- AGENTS.md
- date-fns
- deploy.sh
- setup-db-studio.sh
- lucide-react
- resend
- openai
- next-auth
- route.ts
- zod
- postcss.config.mjs
- 📊 ADMIN DASHBOARD — ANALYTICS
- { GET, POST }
- route.ts
- framer-motion

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 169 edges
2. `cn()` - 163 edges
3. `requireUser()` - 76 edges
4. `captureError()` - 44 edges
5. `checkWorkspaceActive()` - 36 edges
6. `syncOnboarding()` - 34 edges
7. `rateLimit()` - 34 edges
8. `fa()` - 33 edges
9. `isAdminAuthed()` - 33 edges
10. `buffer` - 31 edges

## Surprising Connections (you probably didn't know these)
- `IntelligenceCore()` --indirect_call--> `key()`  [INFERRED]
  components/dashboard/intelligence-core.tsx → lib/channels/webhook-debug.ts
- `AgentCatalogPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/catalog/page.tsx → lib/session.ts
- `EditAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/instagram/[automationId]/edit/page.tsx → lib/session.ts
- `AgentKnowledgePage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/knowledge/page.tsx → lib/session.ts
- `AgentLearningPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/learning/page.tsx → lib/session.ts

## Import Cycles
- None detected.

## Communities (221 total, 29 thin omitted)

### Community 0 - "automation.ts"
Cohesion: 0.11
Nodes (42): AutomationAction, AutomationPolicy, AutomationRow, AutomationTrigger, checkUserFollows(), DEFAULT_AUTOMATION_POLICY, executeAction(), isReplyMode() (+34 more)

### Community 1 - "cn"
Cohesion: 0.05
Nodes (39): StatusDot(), Message, Proposal, QUICK_PROMPTS, VigentoAdminConsole(), WELCOME, ChannelOption, ConversationFilters() (+31 more)

### Community 2 - "ui.tsx"
Cohesion: 0.08
Nodes (25): AdminConversationsPage(), CHANNEL_LABEL, STATUS_META, GATEWAY_BADGE, PLAN_BADGE, STATUS_BADGE, AdminPagination(), FilterPills() (+17 more)

### Community 3 - "loader.js"
Cohesion: 0.12
Nodes (44): actionChip(), applyConfig(), applyViewportHeight(), autoGrow(), bubble(), clearIntro(), contrast(), el() (+36 more)

### Community 4 - "prisma.ts"
Cohesion: 0.06
Nodes (40): DELETE(), dismissSchema, GET(), ownAgent(), Params, GET(), ownAgent(), Params (+32 more)

### Community 5 - "chat-engine.ts"
Cohesion: 0.09
Nodes (40): buildSystemPrompt(), bumpProductQueries(), generateReply(), GenerateReplyResult, hydrateSystemPrompt(), persistAssistantTurn(), persistHandoff(), prepareTurn() (+32 more)

### Community 6 - "qr-config.ts"
Cohesion: 0.10
Nodes (24): Params, POST(), Params, POST(), PUT(), GET(), Params, MessengerConfig (+16 more)

### Community 7 - "charts.ts"
Cohesion: 0.12
Nodes (30): AdminOverviewPage(), parseRange(), startOfToday(), getAiOverview(), AgentSpark, ChannelSpark, conversationsDaily(), conversationsDailyByChannel() (+22 more)

### Community 8 - "page.tsx"
Cohesion: 0.08
Nodes (40): AccountStatus(), AdminAiPage(), formatProviderUSD(), formatRequestUSD(), formatRial(), ManagedModels(), ModelUsageTable(), parseRange() (+32 more)

### Community 9 - "prompt-builder.ts"
Cohesion: 0.06
Nodes (39): AgentWizard(), BUSINESS_PRESETS, channelLabel(), ConfigDraft, CreatedAgent, draftFromRole(), FormState, VigentoComposer() (+31 more)

### Community 10 - "page.tsx"
Cohesion: 0.13
Nodes (19): GET(), DELETE(), GET(), POST(), POST(), POST(), POST(), POST() (+11 more)

### Community 11 - "models.ts"
Cohesion: 0.12
Nodes (28): GET(), Params, POST(), PUT(), appUrl(), GET(), POST(), buildInstagramOAuthConfig() (+20 more)

### Community 12 - "captureError"
Cohesion: 0.06
Nodes (48): GET(), PATCH(), AgentLayout(), AgentDetailPage(), DashboardLayout(), OnboardingPage(), TestPlayground(), AgentTabItem (+40 more)

### Community 13 - "webhook.ts"
Cohesion: 0.09
Nodes (42): POST(), { handlers, auth, signIn, signOut }, isPlatformOwnerPhone(), normalizePhone(), otpCodeSchema, phoneSchema, getRedis(), globalForRedis (+34 more)

### Community 14 - "page.tsx"
Cohesion: 0.11
Nodes (23): DocsHomePage(), metadata, DocPageRoute(), generateMetadata(), generateMetadata(), SOLUTION_META, SolutionPage(), getBlogEntries (+15 more)

### Community 15 - "syncOnboarding"
Cohesion: 0.14
Nodes (24): AgentKnowledgePage(), KbItem, KbManager(), KbStatus, Mode, LocalizedDatePicker(), PickerPosition, WEEKDAYS (+16 more)

### Community 16 - "session.ts"
Cohesion: 0.17
Nodes (19): GET(), guard(), POST(), DELETE(), GET(), guard(), Params, PATCH() (+11 more)

### Community 17 - "page.tsx"
Cohesion: 0.08
Nodes (30): AgentAnalyticsPage(), AnalyticsPage(), daysAgo(), nfFa(), ContactsPage(), STAGE_LABELS_EN, STAGE_LABELS_FA, ProductsPage() (+22 more)

### Community 18 - "activity.ts"
Cohesion: 0.12
Nodes (7): TabDef, IphonePreview, IphonePreviewProps, ScreenProps, AutomationMessage, AutomationType, ReplyMode

### Community 19 - "registry.ts"
Cohesion: 0.08
Nodes (43): baseUrl(), bodySchema, Params, POST(), WEBHOOK_PATH, appBaseUrl(), createSchema, GET() (+35 more)

### Community 20 - "commercial-config.ts"
Cohesion: 0.15
Nodes (17): AdminPlatformSettingsPage(), booleanEnv(), fallbackConfig(), getPlatformCommercialConfig(), ManagedPlanConfig, MODEL_ALIASES, nonNegativeEnv(), objectValue() (+9 more)

### Community 21 - "handler.ts"
Cohesion: 0.09
Nodes (31): POST(), getContactName(), handleInstagramGlobalInbound(), persistFixedAssistantReply(), persistInboundOnly(), processChannelInbound(), profileFields(), NOTE: do NOT add sender.id here — that's the customer who messaged (+23 more)

### Community 22 - "rateLimit"
Cohesion: 0.11
Nodes (24): AdminPaymentsPage(), AdminPaymentDetailPage(), GATEWAY_BADGE, PLAN_BADGE, STATUS_BADGE, StatusSummary(), BADGE_TONES, BadgeTone (+16 more)

### Community 23 - "ippanel.ts"
Cohesion: 0.17
Nodes (14): GET(), PATCH(), Props, BOOKING_AGENT_TOOLS, BOOKING_TOOL_SYSTEM_INSTRUCTION, cancelSchema, executeBookingAgentTool(), slotsSchema (+6 more)

### Community 24 - "automation-form.tsx"
Cohesion: 0.09
Nodes (15): defaultReplyMode(), emptyTextMessage(), FormState, KeywordFilter, MediaUploader, normalizeMessage(), PostFilter, ProductLite (+7 more)

### Community 25 - "dependencies"
Cohesion: 0.07
Nodes (29): @aws-sdk/client-s3, axios, bullmq, clsx, @gsap/react, lucide-react, next, next-intl (+21 more)

### Community 26 - "devDependencies"
Cohesion: 0.07
Nodes (29): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, postcss (+21 more)

### Community 27 - "woocommerce.ts"
Cohesion: 0.16
Nodes (25): GET(), loadIntegration(), POST(), authHeader(), deleteProductFromWoo(), fetchWooJson(), findContactByEmail(), findContactByPhone() (+17 more)

### Community 28 - "config.ts"
Cohesion: 0.12
Nodes (24): COLOR_PRESETS, WebWidgetChannel(), FONT_FAMILY_BY_KEY, hexToRgba(), shade(), WIDGET_ICON_COMPONENTS, WidgetPreview(), CachedWidgetPayload (+16 more)

### Community 29 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions (+19 more)

### Community 30 - "Animation Standards Reference"
Cohesion: 0.07
Nodes (25): Aggressive Escalation Triggers, Guidelines, Operating Posture, Part 1 — Findings table (REQUIRED), Part 2 — Verdict (REQUIRED), Remedial Preference Hierarchy, Required Output Format, Reviewing Animations (+17 more)

### Community 31 - "route.ts"
Cohesion: 0.13
Nodes (18): bodySchema, Params, POST(), FacebookPagesResult, getInstagramInfo(), getInstagramTokenDiagnostics(), IgHost, IgWebhook (+10 more)

### Community 32 - "layout.tsx"
Cohesion: 0.24
Nodes (10): bodySchema, GET(), OPTIONS(), Params, GET(), OPTIONS(), Params, corsHeaders (+2 more)

### Community 33 - "package.json"
Cohesion: 0.07
Nodes (26): express, dependencies, express, pino, qrcode, @whiskeysockets/baileys, description, devDependencies (+18 more)

### Community 34 - "registry.ts"
Cohesion: 0.18
Nodes (12): InstagramAutomationContent(), InstagramAutomationPage(), normalizeSettings(), InstagramWorkspacePage(), InstagramAutomationManager(), TABS, Automation, DEFAULT_SETTINGS (+4 more)

### Community 35 - "auth.ts"
Cohesion: 0.18
Nodes (21): appHeaders(), asRecord(), chatCompletion(), ChatOptions, ChatTool, ChatToolCall, ChatUsage, firstChoice() (+13 more)

### Community 36 - "oauth.ts"
Cohesion: 0.14
Nodes (24): Params, PendingNumber, POST(), DELETE(), Params, appUrl(), connectNumber(), GET() (+16 more)

### Community 37 - "page.tsx"
Cohesion: 0.10
Nodes (15): WEBHOOK_PATH, InstagramConnectFlow(), FIELD_SETS, FieldDef, formatRelative(), ICONS, isComplete(), MessengerChannel() (+7 more)

### Community 38 - "popular-posts.tsx"
Cohesion: 0.09
Nodes (39): Meter(), ModelSelect(), TIER_ICON, ReplyCreditEstimator(), MobilePlanView, PLAN_TRANSLATION_KEY, PricingSection(), AGENT_MODELS (+31 more)

### Community 39 - "route.ts"
Cohesion: 0.15
Nodes (21): GET(), ownAgent(), Params, POST(), assertSafeHttpUrl(), hostnameWithoutBrackets(), isBlockedIp(), isBlockedIpv4() (+13 more)

### Community 40 - "Animation Audit Playbook"
Cohesion: 0.09
Nodes (21): 1. Purpose & frequency, 2. Easing & duration, 3. Physicality & origin, 4. Interruptibility, 5. Performance, 6. Accessibility, 7. Cohesion & tokens, 8. Missed opportunities (+13 more)

### Community 41 - "trend-chart.tsx"
Cohesion: 0.10
Nodes (21): Progress(), AdminUsagePage(), parseRange(), TYPE_LABEL, OPTIONS, RangeKind, RangeSwitch(), ActivationFunnel() (+13 more)

### Community 42 - "route.ts"
Cohesion: 0.14
Nodes (21): DELETE(), POST(), POST(), NOTE: The bot token is in the URL path because Telegram can only send the, TgMessage, tgSendMessage(), TgUpdate, GET() (+13 more)

### Community 43 - "jobs.ts"
Cohesion: 0.16
Nodes (23): bodySchema, GET(), ownAgent(), Params, PUT(), bodySchema, Params, POST() (+15 more)

### Community 44 - "chat-client.tsx"
Cohesion: 0.11
Nodes (17): Avatar(), ChatLinkClient(), errorText(), Intro(), Msg, nextId(), parseAssistant(), ProductCard (+9 more)

### Community 45 - "material-select.tsx"
Cohesion: 0.17
Nodes (19): ConversationThreadPage(), CHANNEL_LABELS_FA, ConversationsPage(), VALID_CHANNELS, VALID_STATUSES, ConversationPanel(), HandoffAlertProp, MESSENGER_META (+11 more)

### Community 46 - "getVerticalPack"
Cohesion: 0.19
Nodes (16): AdminRevenuePage(), PLAN_BADGE, paymentsDailyByWorkspace(), revenueIRRMonthly(), calculateFinanceSummary(), FinanceInputs, FinanceSummary, parseUsdToIrrRate() (+8 more)

### Community 47 - "vigent-woo.php"
Cohesion: 0.22
Nodes (19): vigent_woo_add_admin_menu(), vigent_woo_content_to_payload(), vigent_woo_full_sync(), vigent_woo_get_settings(), vigent_woo_has_wc(), vigent_woo_on_content_delete(), vigent_woo_on_content_save(), vigent_woo_on_order_status_changed() (+11 more)

### Community 48 - "config.ts"
Cohesion: 0.12
Nodes (24): DELETE(), GET(), ownAgent(), Params, PUT(), putSchema, GET(), Params (+16 more)

### Community 49 - "route.ts"
Cohesion: 0.28
Nodes (12): bodySchema, GET(), Params, POST(), POST(), startChat(), createPublicConversationToken(), PublicConversationScope (+4 more)

### Community 50 - "route.ts"
Cohesion: 0.13
Nodes (14): DELETE(), EXT_TO_MIME, GET(), Params, resolveFilePath(), authorized(), PROTECTED_PREFIXES, grants (+6 more)

### Community 51 - "page.tsx"
Cohesion: 0.20
Nodes (12): bodySchema, Params, POST(), createHandoffAlert(), escapeTelegramHtml(), formatOperatorAlertMessage(), getConnectedMessengerChannels(), HandoffContext (+4 more)

### Community 52 - "social-links.tsx"
Cohesion: 0.09
Nodes (15): CHANNEL_ICONS, COPY, MobileChannelTab, COPY, Pillar, InstagramIcon(), SOCIAL_LABELS, SOCIAL_URLS (+7 more)

### Community 53 - "agent.ts"
Cohesion: 0.20
Nodes (9): AgentCreateInput, AgentUpdateInput, PromptConfig, PromptFormatConfig, promptFormatSchema, PromptQAPair, promptQAPairSchema, RoleTemplateKey (+1 more)

### Community 54 - "Apple Design"
Cohesion: 0.10
Nodes (20): 10. Gesture design details (the "feel" checklist), 11. Frame-level smoothness, 12. Materials & depth — translucency conveys hierarchy, 13. Multimodal feedback — motion + sound + haptics, 14. Reduced motion & accessibility, 15. Typography — optical sizing, tracking, leading, 16. Design foundations — the eight principles, 17. Process (+12 more)

### Community 55 - "route.ts"
Cohesion: 0.12
Nodes (23): agentStateSchema, creditSchema, executeTool(), fileSchema, findAgents(), findUsers(), findWorkspaces(), inputSchema (+15 more)

### Community 56 - "low-credit-alert.ts"
Cohesion: 0.10
Nodes (18): CampaignComposer(), DraftCampaign, Preview, CampaignLaunchButton(), CHANNEL_LABELS, ChannelBadge(), ICONS, CHANNEL_LABEL (+10 more)

### Community 57 - "vertical-bookings-vigento.test.ts"
Cohesion: 0.17
Nodes (23): vigentoDraftSchema, AvailabilityRuleLike, AvailabilityWindow, AvailableSlot, buildAvailableSlots(), BusyAppointmentLike, DateExceptionLike, effectiveAvailabilityWindows() (+15 more)

### Community 58 - "validation.ts"
Cohesion: 0.20
Nodes (9): fmtBytes(), Metrics, Sample, ServerStatsWidget(), computeTrend(), TrendBadge(), TrendDirection, TrendsStrip() (+1 more)

### Community 59 - "appointments-workspace.tsx"
Cohesion: 0.10
Nodes (21): AppointmentCard(), AppointmentRow, AppointmentStatus, AppointmentsWorkspace(), BookingDialog(), DayMetric(), groupByTimeSlot(), Locale (+13 more)

### Community 60 - "iphone-preview.tsx"
Cohesion: 0.38
Nodes (6): appBaseUrl(), createSchema, encryptSensitiveFields(), GET(), POST(), SENSITIVE_FIELDS

### Community 61 - "types.ts"
Cohesion: 0.09
Nodes (22): EditAutomationPage(), AutomationAction, AutomationTrigger, CreateAutomationPayload, GATE_MODE_LABEL, GATE_MODE_LABEL_KEY, MATCH_MODE_DESC, MATCH_MODE_DESC_KEY (+14 more)

### Community 62 - "helpers.ts"
Cohesion: 0.14
Nodes (16): addDays(), AppointmentItem, AppointmentStatus, BookingManager(), BookingService, DateException, minuteToTime(), normalizeService() (+8 more)

### Community 63 - "page.tsx"
Cohesion: 0.10
Nodes (17): ChannelsSection, FaqSection, FeaturesSection, HomePage(), metadata, PricingSection, VigentoSection, COPY (+9 more)

### Community 64 - "agent-wizard.tsx"
Cohesion: 0.15
Nodes (15): ALLOWED, POST(), GET(), GET(), nonNegativeInt, planSchema, positiveInt, PUT() (+7 more)

### Community 65 - "route.ts"
Cohesion: 0.20
Nodes (12): BodySchema, POST(), POST(), schema, ADMIN_OWNER_PHONE, AdminActionInput, AdminActionPayload, createAdminActionToken() (+4 more)

### Community 66 - "contacts-view.tsx"
Cohesion: 0.18
Nodes (14): GET(), POST(), activateSubscription(), activateSubscriptionPayment(), BlockReason, ChatGate, checkAgentCreateAllowed(), getMonthlyMessageCount() (+6 more)

### Community 67 - "chat-orchestrator.ts"
Cohesion: 0.14
Nodes (22): POST(), appUrl(), GET(), handleCallback(), POST(), readPid(), appUrl(), bodySchema (+14 more)

### Community 68 - "ingest.ts"
Cohesion: 0.21
Nodes (16): crawlUrlToKnowledge(), fetchUrlText(), refreshStaleUrlKnowledge(), ChunkOptions, chunkText(), splitBySentence(), contextualChunk(), IngestionJobData (+8 more)

### Community 69 - "Glossary"
Cohesion: 0.11
Nodes (17): Animation Vocabulary, Easing — how speed changes over an animation, Entrances & Exits — how elements appear and disappear, Examples, Feedback & Interaction — responding to the user's actions, Glossary, Instructions, Looping & Ambient Motion — animations that run on their own (+9 more)

### Community 70 - "layout.tsx"
Cohesion: 0.24
Nodes (13): bodySchema, Params, POST(), campaignDeliveryText(), CampaignJobData, processCampaign(), processRecipient(), SEND_INTERVAL_MS (+5 more)

### Community 71 - "automation-manager.tsx"
Cohesion: 0.10
Nodes (24): PATCH(), payloadSchema, NewAutomationPage(), ContactDetailPage(), EditInstagramAutomationPage(), NewInstagramAutomationPage(), CategoriesPage(), NewProductPage() (+16 more)

### Community 72 - "charts.ts"
Cohesion: 0.16
Nodes (17): callEmbeddings(), embedCacheKey(), EmbedContext, embedText(), embedTexts(), getCachedEmbedding(), getEmbedContext(), setCachedEmbedding() (+9 more)

### Community 73 - "booking-manager.tsx"
Cohesion: 0.17
Nodes (14): channelHasTrustedIdentity(), ExtractedIdentity, extractEnglishName(), extractIdentity(), extractPersianName(), initialState(), buildTurnReceipts(), CONVERSATION_ACTIVITY_VERSION (+6 more)

### Community 74 - "instagram.ts"
Cohesion: 0.13
Nodes (22): logout(), metadata, AgentBuilderEntry(), BuildMode, Props, Header(), MobileNav(), getDashboardNav() (+14 more)

### Community 75 - "PageHeader"
Cohesion: 0.15
Nodes (13): scripts, build, db:deploy, db:generate, db:migrate, db:push, db:studio, dev (+5 more)

### Community 76 - "page.tsx"
Cohesion: 0.23
Nodes (5): AutomationPolicySnapshot, InstagramOAuthConfig, readIgUserId(), readUserToken(), fetchInstagramSenderProfile()

### Community 77 - "conversation-thread.tsx"
Cohesion: 0.22
Nodes (8): actionSchema, buttonSchema, createSchema, GET(), messageEntrySchema, Params, POST(), triggerSchema

### Community 78 - "neural-operation-graph.tsx"
Cohesion: 0.13
Nodes (8): BUSINESS_ICONS, COPY, Hero(), LABELS, NeuralOperationGraph(), NeuralOperationGraphProps, Scenario, Spotlight()

### Community 79 - "getEffectivePlanDefs"
Cohesion: 0.31
Nodes (8): DELETE(), encryptSensitiveFields(), GET(), ownIntegration(), Params, PATCH(), patchSchema, SENSITIVE_FIELDS

### Community 80 - "scheduler.ts"
Cohesion: 0.18
Nodes (23): generateMetadata(), getWorkspaceId(), Props, PublicBlogPostPage(), AdminBlogManager(), AdminPostRow, STATUS_BADGE_CLS, STATUS_LABELS_EN (+15 more)

### Community 81 - "API"
Cohesion: 0.12
Nodes (16): API, Available scripts, Environment, `GET /health`, `GET /status?sessionId=<id>`, How it fits in, Install & run, Limits & caveats (+8 more)

### Community 82 - "getEffectivePlanDefs"
Cohesion: 0.22
Nodes (12): POST(), createSchema, GET(), POST(), audienceWhere(), CampaignAudienceResult, campaignAudienceSchema, campaignChannels (+4 more)

### Community 83 - "checkWorkspaceActive"
Cohesion: 0.22
Nodes (8): CHANNEL_LABELS, FailedJobLog, HealthPayload, HealthState, QUEUE_LABELS, Service, ServiceHealthPanel(), STATE_META

### Community 84 - "فایل‌های تغییر یافته"
Cohesion: 0.12
Nodes (16): `app/api/agents/[agentId]/route.ts` (PATCH), `app/api/agents/route.ts` (POST), `app/api/chat/route.ts` و `app/api/widget/[agentId]/chat/route.ts`, `app/(dashboard)/agents/[agentId]/settings/page.tsx`, `components/agent-builder/agent-wizard.tsx`, `components/agent-builder/flow-templates.ts`, `components/agents/agent-settings-form.tsx` (بازنویسی کامل), `lib/ai/chat-engine.ts` (+8 more)

### Community 85 - "index.ts"
Cohesion: 0.16
Nodes (14): MessageBuilder(), app, AUTH_ROOT, bootstrap(), __dirname, forwardInbound(), log, newState() (+6 more)

### Community 86 - "page.tsx"
Cohesion: 0.11
Nodes (27): agent_hint_body(), agent_hint_title(), AgentsPage(), AttentionItem(), buildTrend(), daysAgo(), isRecord(), MODULE_META (+19 more)

### Community 87 - "isAdminAuthed"
Cohesion: 0.12
Nodes (13): AgentCatalogPage(), AgentLearningPage(), DigitalMenuDashboardPage(), ServicesPage(), LearningCenter(), LearningItem, PageHeader(), IMPORTANT: by request, there is NO kicker / eyebrow text above the title. (+5 more)

### Community 88 - "route.ts"
Cohesion: 0.16
Nodes (12): CHANNELS, IntegrationsPage(), AddStoreForm(), DIRECTION_LABEL, ENTITY_LABEL, formatDate(), IntegrationCard(), StoreIntegrationItem (+4 more)

### Community 89 - "product.ts"
Cohesion: 0.39
Nodes (7): bookingErrorResponse(), GET(), POST(), AppointmentsPage(), listAppointmentsForDate(), dateKeyInTimeZone(), appointmentListQuerySchema

### Community 90 - "فایل‌های جدید"
Cohesion: 0.14
Nodes (14): `app/api/integrations/[integrationId]/route.ts`, `app/api/integrations/route.ts`, `app/api/sync/woocommerce/route.ts`, `app/(dashboard)/integrations/page.tsx`, `components/integrations/store-integrations-section.tsx`, `lib/integrations/crawler.ts`, `lib/integrations/woocommerce.ts`, `wordpress-plugin/vigent-woo/readme.txt` (جدید) (+6 more)

### Community 91 - "entitlements.ts"
Cohesion: 0.29
Nodes (13): buildFallbackSummary(), compact(), ConversationSummaryResult, ensureConversationSummary(), isEmojiOnly(), isGreetingOnly(), isTrivialConversation(), persistSummary() (+5 more)

### Community 92 - "index.ts"
Cohesion: 0.26
Nodes (13): databaseHealth(), FailedJobLog, GET(), HealthState, openRouterHealth(), POST(), QueueRow, redisAndQueuesHealth() (+5 more)

### Community 93 - "VIGENT — Complete Claude Code Project Prompt v2"
Cohesion: 0.14
Nodes (13): ⚙️ BACKGROUND JOBS (BullMQ), 🗃 DATABASE SCHEMA (Prisma), 📋 ENVIRONMENT VARIABLES, 🗂 FILE STRUCTURE, 💡 IMPLEMENTATION NOTES, 🌐 INTERNATIONALIZATION, 🧠 MANAGED AI + REPLY CREDIT — CRITICAL ARCHITECTURE, Multi-Tenant AI Agent SaaS Platform | vigent.ir (+5 more)

### Community 94 - "route.ts"
Cohesion: 0.40
Nodes (4): GET(), BookingError, listAvailableSlots(), slotQuerySchema

### Community 95 - "page-header.tsx"
Cohesion: 0.12
Nodes (31): AdminVigentoPage(), CAPABILITIES, GET(), PUT(), schema, POST(), recordRun(), requestSchema (+23 more)

### Community 96 - "page.tsx"
Cohesion: 0.39
Nodes (8): ALLOWED_PREFIXES, execFileAsync, hasFfmpeg(), MIME_TO_EXT, POST(), publicBaseUrl(), transcodeToInstagramAudio(), UploadedFile

### Community 97 - "navbar.tsx"
Cohesion: 0.24
Nodes (7): SettingsPage(), ConversationActions(), Status, OperatorChannelInfo, OperatorChannelSetup(), WeeklyReportCard(), Switch()

### Community 98 - "Vignet Improvements — CHANGES.md"
Cohesion: 0.15
Nodes (12): `app/api/agents/[agentId]/knowledge/route.ts`, `app/(dashboard)/agents/[agentId]/knowledge/page.tsx`, `components/knowledge/kb-manager.tsx`, `lib/knowledge/ingest.ts`, `lib/knowledge/vector-store.ts`, `messages/fa.json` و `messages/en.json`, Vignet Improvements — CHANGES.md, فاز ۱ — موتور پرامپت ۶ لایه‌ای + تمپلیت‌های نقش‌محور (+4 more)

### Community 99 - "فایل‌های تغییر یافته"
Cohesion: 0.15
Nodes (13): `app/(dashboard)/agents/[agentId]/analytics/page.tsx`, `app/(dashboard)/contacts/page.tsx`, `app/(dashboard)/conversations/page.tsx`, `app/(dashboard)/overview/page.tsx`, `components/dashboard/charts/conversation-chart.tsx`, `components/dashboard/charts/hourly-heatmap.tsx`, `components/dashboard/charts/satisfaction-gauge.tsx`, `components/dashboard/metrics-explainer.tsx` (جدید) (+5 more)

### Community 100 - "catalog.ts"
Cohesion: 0.14
Nodes (18): EmailMessage, escapeHtml(), getClient(), notifyOps(), sendEmail(), NotificationJobData, processNotification(), runInlineNotification() (+10 more)

### Community 101 - "scripts"
Cohesion: 0.18
Nodes (17): adminLogin(), AdminLoginState, AdminLoginForm(), initial, AdminLoginPage(), metadata, ADMIN_COOKIE, createSessionToken() (+9 more)

### Community 102 - "logo.tsx"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 103 - "vigento-actions.ts"
Cohesion: 0.36
Nodes (6): skipOnboarding(), OnboardingChecklist(), OnboardingState, ONBOARDING_STEPS, OnboardingCheckKey, OnboardingStepMeta

### Community 104 - "route.ts"
Cohesion: 0.23
Nodes (9): generateMetadata(), getWorkspaceId(), Props, PublicBlogCategoryPage(), getWorkspaceId(), PublicBlogIndexPage(), PublicPost, PublicPostCard() (+1 more)

### Community 105 - "health.ts"
Cohesion: 0.27
Nodes (8): GET(), META, StatusPage(), HealthCheck, HealthReport, runHealthChecks(), timed(), withTimeout()

### Community 106 - "route.ts"
Cohesion: 0.22
Nodes (11): DELETE(), Params, PATCH(), settingsSchema, bodySchema, GET(), ownAgent(), Params (+3 more)

### Community 107 - "automation-card.tsx"
Cohesion: 0.13
Nodes (13): LoginPage(), PAID_PLANS, AgentSettingsPage(), BUSINESSES, NewAgentPage(), BillingPage(), PLAN_KEY, AMOUNTS_IRR (+5 more)

### Community 109 - "build-plugin-zip.mjs"
Cohesion: 0.17
Nodes (9): centralParts, centralSize, CRC_TABLE, eocd, files, localParts, outFile, root (+1 more)

### Community 110 - "Quick Reference"
Cohesion: 0.18
Nodes (11): 10. Charts & Data (LOW), 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Style Selection (HIGH), 5. Layout & Responsive (HIGH), 6. Typography & Color (MEDIUM), 7. Animation (MEDIUM) (+3 more)

### Community 113 - "openrouter.ts"
Cohesion: 0.10
Nodes (21): estedad, geistMono, geistSans, metadata, RootLayout(), asReceipt(), ConversationTimelineActivity(), getTimelineActivity() (+13 more)

### Community 115 - "فایل‌های جدید"
Cohesion: 0.20
Nodes (10): `app/api/conversations/[conversationId]/handoff/route.ts`, `app/api/handoff-alerts/[alertId]/route.ts`, `app/api/handoff-alerts/route.ts`, `app/api/operator-channel/route.ts`, `app/api/operator-channel/test/route.ts`, `app/api/telegram-operator/webhook/route.ts`, `components/crm/conversation-panel.tsx`, `components/crm/operator-channel-setup.tsx` (+2 more)

### Community 117 - "Design Engineering"
Cohesion: 0.22
Nodes (8): Accessibility, Design Engineering, Initial Response, prefers-reduced-motion, Review Checklist, Review Format (Required), Stagger Animations, Touch device hover states

### Community 118 - "UI/UX Pro Max - Design Intelligence"
Cohesion: 0.22
Nodes (8): Available Domains, Available Stacks, How to Use, Output Formats, Prerequisites, Rule Categories by Priority, Search Reference, UI/UX Pro Max - Design Intelligence

### Community 119 - "actions.ts"
Cohesion: 0.08
Nodes (18): AiModelPolicyForm(), formatUSD(), ModelAlias, ModelOption, Notice, Policy, MODEL_META, NumberPath (+10 more)

### Community 121 - "test-playground.tsx"
Cohesion: 0.22
Nodes (9): Msg, VoiceRecorder, ConversationBubble(), ConversationBubbleTone, ConversationText(), TONES, SpeakButton(), Markdown() (+1 more)

### Community 122 - "json-import-dialog.tsx"
Cohesion: 0.18
Nodes (9): BlogPostData, EMPTY_POST, JsonImportDialog(), JsonImportDialogProps, POSTER_COLORS, PosterColor, PosterVariant, SeoCheck (+1 more)

### Community 123 - "page.tsx"
Cohesion: 0.10
Nodes (25): AdminAgentDetailPage(), CHANNEL_LABEL, AdminAgentsPage(), AdminBlogPage(), AdminConversationDetailPage(), CHANNEL_LABEL, STATUS_LABEL, AdminDatabasePage() (+17 more)

### Community 125 - "system-monitor.tsx"
Cohesion: 0.28
Nodes (7): Card(), fmtBytes(), fmtUptime(), Metrics, Sample, SystemMonitor(), TONES

### Community 126 - "راهنمای قیمت‌گذاری ویجنت"
Cohesion: 0.22
Nodes (8): تصمیم تجاری نهایی, داشبوردی که باید هر هفته کنترل شود, راهنمای قیمت‌گذاری ویجنت, سه مدل مدیریت‌شده, فرمول سود و نقطهٔ بازبینی, قبل از انتشار production, هزینهٔ واقعی یک پاسخ معمولی, چهار پیشنهاد روی سایت

### Community 127 - "Component Building Principles"
Cohesion: 0.25
Nodes (8): Animate enter states with @starting-style, Buttons must feel responsive, Component Building Principles, Make popovers origin-aware, Never animate from scale(0), Tooltips: skip delay on subsequent hovers, Use blur to mask imperfect transitions, Use CSS transitions over keyframes for interruptible UI

### Community 129 - "فایل‌های تغییر یافته"
Cohesion: 0.25
Nodes (8): `app/(dashboard)/conversations/[conversationId]/page.tsx`, `app/(dashboard)/settings/page.tsx`, `lib/docs/content.ts`, `lib/docs/nav.ts`, `messages/fa.json` و `messages/en.json`, فاز ۳ — انتقال به اپراتور در تلگرام + شناسایی مشتری + پنل گفتگو, فایل‌های تغییر یافته, هدف

### Community 130 - "s3.ts"
Cohesion: 0.33
Nodes (12): assertS3Configured(), buildKey(), deleteFile(), ensureBucket(), getBucket(), getS3Client(), isS3Configured(), MIME_TO_EXT (+4 more)

### Community 131 - "layout.tsx"
Cohesion: 0.27
Nodes (9): BrandHeader(), NAV_ITEMS, NavItem, NavList(), AdminLayout(), metadata, MobileNavTrigger(), adminLogout() (+1 more)

### Community 132 - "rateLimit"
Cohesion: 0.26
Nodes (8): bodySchema, Params, POST(), bodySchema, POST(), bodySchema, POST(), rateLimit()

### Community 133 - "route.ts"
Cohesion: 0.13
Nodes (16): GET(), POST(), DELETE(), GET(), ownedService(), PATCH(), Props, serviceSlug() (+8 more)

### Community 134 - "react"
Cohesion: 0.29
Nodes (6): AutomationCard(), MESSAGE_TYPE_ICON, REPLY_MODE_ICON, TYPE_ICON, MessageType, REPLY_MODE_SHORT_LABEL_KEY

### Community 135 - "page.tsx"
Cohesion: 0.53
Nodes (5): deleteContent(), handleWpContentWebhook(), upsertContent(), WpContentPayload, writeLog()

### Community 136 - "فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس"
Cohesion: 0.29
Nodes (7): `lib/docs/content.ts`, `lib/docs/nav.ts`, اعتبارسنجی نهایی, فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس, فایل‌های تغییر یافته, نتیجه, هدف

### Community 137 - "intelligence-core.tsx"
Cohesion: 0.22
Nodes (7): FlowParticleProps, IntelligenceCore(), IntelligenceCoreProps, IntelligenceCoreLazy(), LazyIntelligenceCore, NODE_META, POSITIONS

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

### Community 147 - "popular-posts.tsx"
Cohesion: 0.32
Nodes (6): getPopularPosts(), getWorkspaceId(), PopularCard(), PopularPosts(), PostPreview, ViewsLabel()

### Community 148 - "route.ts"
Cohesion: 0.38
Nodes (6): buttonSchema, DELETE(), owns(), Params, PATCH(), updateSchema

### Community 149 - "نکات اجرایی"
Cohesion: 0.33
Nodes (6): Migration, اعتبارسنجی, سازگاری با گذشته, متغیرهای محیطی جدید (اختیاری), نکات اجرایی, وابستگی‌های جدید

### Community 150 - "route.ts"
Cohesion: 0.38
Nodes (6): DELETE(), GET(), getOwnedAgent(), Params, PATCH(), agentUpdateSchema

### Community 151 - "setup-server.sh"
Cohesion: 0.60
Nodes (4): apt_update(), ensure_secret(), set_env(), setup-server.sh script

### Community 152 - "setup-whatsapp-bridge.sh"
Cohesion: 0.40
Nodes (5): append_env(), NEXT_JS_BASE_URL, setup-whatsapp-bridge.sh script, WHATSAPP_BRIDGE_PORT, WHATSAPP_BRIDGE_SECRET

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

### Community 165 - "use-cases-section.tsx"
Cohesion: 0.40
Nodes (3): COPY, SectionCopy, UseCase

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

### Community 186 - "🔗 CHANNEL IMPLEMENTATIONS"
Cohesion: 0.67
Nodes (3): Bale, 🔗 CHANNEL IMPLEMENTATIONS, Rubika

### Community 187 - "📡 NEW CHANNELS: RUBIKA + BALE"
Cohesion: 0.67
Nodes (3): Bale (بله), 📡 NEW CHANNELS: RUBIKA + BALE, Rubika (روبیکا)

### Community 188 - "🖥 MARKETING WEBSITE — B&W CINEMATIC"
Cohesion: 0.67
Nodes (3): Homepage Sections, Key Animation Components, 🖥 MARKETING WEBSITE — B&W CINEMATIC

### Community 210 - "lucide-react"
Cohesion: 0.12
Nodes (13): setLocale(), metadata, BackToTop(), COPY, Footer(), COPY, Navbar(), NavbarContent() (+5 more)

### Community 218 - "route.ts"
Cohesion: 0.33
Nodes (6): defaultSettings(), GET(), Params, PATCH(), patchSchema, REPLY_POLICIES

### Community 230 - "route.ts"
Cohesion: 0.11
Nodes (23): confirmSchema, Params, POST(), DELETE(), Params, PATCH(), GET(), POST() (+15 more)

## Knowledge Gaps
- **1064 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `mini-services/**`, `node_modules/**`, `metadata` (+1059 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `ui.tsx`, `layout.tsx`, `page.tsx`, `captureError`, `syncOnboarding`, `page.tsx`, `rateLimit`, `popular-posts.tsx`, `trend-chart.tsx`, `material-select.tsx`, `social-links.tsx`, `low-credit-alert.ts`, `validation.ts`, `appointments-workspace.tsx`, `helpers.ts`, `automation-manager.tsx`, `instagram.ts`, `scheduler.ts`, `lucide-react`, `checkWorkspaceActive`, `page.tsx`, `isAdminAuthed`, `route.ts`, `navbar.tsx`, `vigento-actions.ts`, `automation-card.tsx`, `openrouter.ts`, `actions.ts`, `test-playground.tsx`, `page.tsx`, `system-monitor.tsx`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `prisma.ts` to `rateLimit`, `route.ts`, `qr-config.ts`, `models.ts`, `captureError`, `route.ts`, `registry.ts`, `route.ts`, `handler.ts`, `route.ts`, `ippanel.ts`, `woocommerce.ts`, `route.ts`, `oauth.ts`, `route.ts`, `route.ts`, `jobs.ts`, `config.ts`, `route.ts`, `page.tsx`, `iphone-preview.tsx`, `contacts-view.tsx`, `chat-orchestrator.ts`, `layout.tsx`, `automation-manager.tsx`, `conversation-thread.tsx`, `getEffectivePlanDefs`, `getEffectivePlanDefs`, `product.ts`, `route.ts`, `route.ts`, `page-header.tsx`, `page.tsx`, `route.ts`, `route.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `logo.tsx`, `@prisma/client`, `framer-motion`, `automation-card.tsx`, `date-fns`, `media-uploader.tsx`, `demo-section.tsx`, `route.ts`, `recharts`, `resend`, `openai`, `service-catalog-manager.tsx`, `next-auth`, `zod`, `index.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `mini-services/**` to the rest of the system?**
  _1064 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `automation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1109936575052854 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.051587301587301584 - nodes in this community are weakly interconnected._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07899159663865546 - nodes in this community are weakly interconnected._