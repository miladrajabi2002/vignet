# Graph Report - vignet  (2026-07-17)

## Corpus Check
- 548 files · ~411,621 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3298 nodes · 7426 edges · 235 communities (206 shown, 29 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a60f5ac2`
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
- admin-blog-manager.tsx
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
- openrouter.ts
- Design Engineering
- UI/UX Pro Max - Design Intelligence
- actions.ts
- service-catalog-manager.tsx
- route.ts
- route.ts
- route.ts
- system-monitor.tsx
- راهنمای قیمت‌گذاری ویجنت
- Component Building Principles
- فایل‌های تغییر یافته
- page.tsx
- route.ts
- route.ts
- tts.ts
- react
- page.tsx
- فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس
- route.ts
- extends
- Vigent
- The Animation Decision Framework
- clip-path for Animation
- Performance Rules
- Gesture and Drag Interactions
- Pre-Delivery Checklist
- How to Use This Skill
- kb-manager.tsx
- page.tsx
- route.ts
- نکات اجرایی
- page.tsx
- setup-server.sh
- setup-whatsapp-bridge.sh
- AutomationType
- start-demo.sh
- next-auth.d.ts
- 🚀 PHASES OF IMPLEMENTATION
- CSS Transform Mastery
- The Sonner Principles (Building Loved Components)
- Spring Animations
- Common Rules for Professional UI
- Example Workflow
- route.ts
- route.ts
- package.json
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
- @aws-sdk/s3-request-presigner
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
- jalaali-js
- date-fns
- deploy.sh
- setup-db-studio.sh
- lucide-react
- qrcode
- resend
- page.tsx
- openai
- @types/qrcode
- gsap
- next-auth
- route.ts
- zod
- postcss.config.mjs
- 📊 ADMIN DASHBOARD — ANALYTICS
- { GET, POST }
- recharts
- route.ts
- route.ts
- route.ts
- wp-content.ts
- route.ts
- framer-motion

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 169 edges
2. `cn()` - 160 edges
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
- `AgentAnalyticsPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/analytics/page.tsx → lib/session.ts
- `EditAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/instagram/[automationId]/edit/page.tsx → lib/session.ts
- `NewAutomationPage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/instagram/new/page.tsx → lib/session.ts
- `AgentKnowledgePage()` --calls--> `requireUser()`  [EXTRACTED]
  app/(dashboard)/agents/[agentId]/knowledge/page.tsx → lib/session.ts

## Import Cycles
- None detected.

## Communities (235 total, 29 thin omitted)

### Community 0 - "automation.ts"
Cohesion: 0.11
Nodes (41): AutomationAction, AutomationPolicy, AutomationRow, AutomationTrigger, checkUserFollows(), DEFAULT_AUTOMATION_POLICY, executeAction(), isReplyMode() (+33 more)

### Community 1 - "cn"
Cohesion: 0.04
Nodes (58): setLocale(), AgentLayout(), AttentionItem(), fmtBytes(), Metrics, Sample, ServerStatsWidget(), CHANNEL_LABELS (+50 more)

### Community 2 - "ui.tsx"
Cohesion: 0.08
Nodes (38): AdminAgentDetailPage(), CHANNEL_LABEL, AdminAgentsPage(), AdminBlogPage(), AdminConversationDetailPage(), CHANNEL_LABEL, STATUS_LABEL, AdminConversationsPage() (+30 more)

### Community 3 - "loader.js"
Cohesion: 0.12
Nodes (44): actionChip(), applyConfig(), applyViewportHeight(), autoGrow(), bubble(), clearIntro(), contrast(), el() (+36 more)

### Community 4 - "prisma.ts"
Cohesion: 0.07
Nodes (32): DELETE(), dismissSchema, GET(), ownAgent(), Params, DELETE(), ownAgent(), Params (+24 more)

### Community 5 - "chat-engine.ts"
Cohesion: 0.12
Nodes (29): buildSystemPrompt(), bumpProductQueries(), generateReply(), GenerateReplyResult, hydrateSystemPrompt(), persistAssistantTurn(), persistHandoff(), prepareTurn() (+21 more)

### Community 6 - "qr-config.ts"
Cohesion: 0.09
Nodes (15): MessengerConfig, MessengerSettings, decrypt(), encrypt(), getKey(), AutomationPolicySnapshot, InstagramOAuthConfig, readUserToken() (+7 more)

### Community 7 - "charts.ts"
Cohesion: 0.12
Nodes (31): AdminOverviewPage(), parseRange(), startOfToday(), getAiOverview(), AgentSpark, ChannelSpark, conversationsDaily(), conversationsDailyByChannel() (+23 more)

### Community 8 - "page.tsx"
Cohesion: 0.09
Nodes (38): AccountStatus(), AdminAiPage(), formatProviderUSD(), formatRequestUSD(), formatRial(), ManagedModels(), ModelUsageTable(), parseRange() (+30 more)

### Community 9 - "prompt-builder.ts"
Cohesion: 0.09
Nodes (29): AgentSettingsData, AgentSettingsForm(), EMPTY_CONFIG, LayerTab, BaseRoleKey, buildLayeredPrompt(), BUSINESS_ROLE_SPECS, BUSINESS_ROLE_TEMPLATES (+21 more)

### Community 10 - "page.tsx"
Cohesion: 0.23
Nodes (7): POST(), POST(), POST(), POST(), POST(), MessengerType, handleWebhookRequest()

### Community 11 - "models.ts"
Cohesion: 0.15
Nodes (22): appUrl(), GET(), POST(), buildInstagramOAuthConfig(), buildInstagramAuthUrl(), exchangeCodeForUserToken(), exchangeForLongLivedToken(), INSTAGRAM_OAUTH_SCOPES (+14 more)

### Community 12 - "captureError"
Cohesion: 0.08
Nodes (32): ContactDetailPage(), ConversationThreadPage(), CHANNEL_LABELS_FA, ConversationsPage(), VALID_CHANNELS, VALID_STATUSES, ProductDetailPage(), CampaignComposer() (+24 more)

### Community 13 - "webhook.ts"
Cohesion: 0.22
Nodes (16): { handlers, auth, signIn, signOut }, isPlatformOwnerPhone(), normalizePhone(), formatPersianDate(), generateCode(), IppanelMeta, ippanelSend(), isSmsConfigured() (+8 more)

### Community 14 - "page.tsx"
Cohesion: 0.11
Nodes (23): DocsHomePage(), metadata, DocPageRoute(), generateMetadata(), generateMetadata(), SOLUTION_META, SolutionPage(), getBlogEntries (+15 more)

### Community 15 - "syncOnboarding"
Cohesion: 0.18
Nodes (11): GET(), PATCH(), Props, notifyAppointmentCancellation(), AppointmentCreateInput, appointmentUpdateSchema, availabilityRuleSchema, dateExceptionSchema (+3 more)

### Community 17 - "page.tsx"
Cohesion: 0.07
Nodes (30): AgentAnalyticsPage(), AnalyticsPage(), daysAgo(), nfFa(), ContactsPage(), STAGE_LABELS_EN, STAGE_LABELS_FA, ProductsPage() (+22 more)

### Community 18 - "activity.ts"
Cohesion: 0.24
Nodes (13): bodySchema, Params, POST(), campaignDeliveryText(), CampaignJobData, processCampaign(), processRecipient(), SEND_INTERVAL_MS (+5 more)

### Community 19 - "registry.ts"
Cohesion: 0.09
Nodes (37): baseUrl(), bodySchema, Params, POST(), WEBHOOK_PATH, baleAdapter(), getBaleBotInfo(), setBaleWebhook() (+29 more)

### Community 20 - "commercial-config.ts"
Cohesion: 0.12
Nodes (22): GET(), nonNegativeInt, planSchema, positiveInt, PUT(), schema, POST(), booleanEnv() (+14 more)

### Community 21 - "handler.ts"
Cohesion: 0.11
Nodes (25): getContactName(), handleInstagramGlobalInbound(), persistFixedAssistantReply(), persistInboundOnly(), processChannelInbound(), profileFields(), NOTE: do NOT add sender.id here — that's the customer who messaged, reactAfterInstagramReply() (+17 more)

### Community 22 - "rateLimit"
Cohesion: 0.08
Nodes (35): AdminPaymentsPage(), AdminPaymentDetailPage(), GATEWAY_BADGE, PLAN_BADGE, STATUS_BADGE, StatusSummary(), AdminRevenuePage(), PLAN_BADGE (+27 more)

### Community 23 - "ippanel.ts"
Cohesion: 0.19
Nodes (20): notifyWorkspace(), sendActivationCompleteSms(), sendActivationReminderSms(), sendTrialExpiringSms(), alertSilentChannels(), cleanupOldRecords(), ONBOARDING_NEXT_STEP_FA, remindExpiringSubscriptions() (+12 more)

### Community 24 - "automation-form.tsx"
Cohesion: 0.09
Nodes (16): defaultReplyMode(), emptyTextMessage(), FormState, KeywordFilter, MediaUploader, normalizeMessage(), PostFilter, ProductLite (+8 more)

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
Nodes (23): COLOR_PRESETS, WebWidgetChannel(), FONT_FAMILY_BY_KEY, hexToRgba(), shade(), WIDGET_ICON_COMPONENTS, WidgetPreview(), CachedWidgetPayload (+15 more)

### Community 29 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions (+19 more)

### Community 30 - "Animation Standards Reference"
Cohesion: 0.07
Nodes (25): Aggressive Escalation Triggers, Guidelines, Operating Posture, Part 1 — Findings table (REQUIRED), Part 2 — Verdict (REQUIRED), Remedial Preference Hierarchy, Required Output Format, Reviewing Animations (+17 more)

### Community 31 - "route.ts"
Cohesion: 0.32
Nodes (13): storageHealth(), assertS3Configured(), buildKey(), deleteFile(), ensureBucket(), getBucket(), getS3Client(), isS3Configured() (+5 more)

### Community 32 - "layout.tsx"
Cohesion: 0.22
Nodes (11): bodySchema, GET(), OPTIONS(), Params, GET(), OPTIONS(), Params, corsHeaders (+3 more)

### Community 33 - "package.json"
Cohesion: 0.07
Nodes (26): express, dependencies, express, pino, qrcode, @whiskeysockets/baileys, description, devDependencies (+18 more)

### Community 34 - "registry.ts"
Cohesion: 0.17
Nodes (13): bodySchema, Params, POST(), bodySchema, POST(), bodySchema, POST(), rateLimit() (+5 more)

### Community 35 - "auth.ts"
Cohesion: 0.23
Nodes (9): InstagramAutomationContent(), normalizeSettings(), InstagramAutomationManager(), TABS, DEFAULT_SETTINGS, InstagramAutomationSettings, REPLY_POLICY_DESC_KEY, REPLY_POLICY_LABEL_KEY (+1 more)

### Community 36 - "oauth.ts"
Cohesion: 0.17
Nodes (21): Params, PendingNumber, POST(), appUrl(), connectNumber(), GET(), POST(), buildWhatsappOAuthConfig() (+13 more)

### Community 37 - "page.tsx"
Cohesion: 0.15
Nodes (10): InstagramConnectFlow(), FIELD_SETS, FieldDef, formatRelative(), ICONS, isComplete(), MessengerChannel(), MessengerKind (+2 more)

### Community 38 - "popular-posts.tsx"
Cohesion: 0.16
Nodes (12): MobilePlanView, PLAN_TRANSLATION_KEY, getReplyPriceIRR(), grantIncludedPlanCredit(), planCreditGrantKey(), PlanCreditGrantResult, envInt(), envNonNegativeInt() (+4 more)

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
Cohesion: 0.15
Nodes (20): POST(), NOTE: The bot token is in the URL path because Telegram can only send the, TgMessage, tgSendMessage(), TgUpdate, GET(), POST(), POST() (+12 more)

### Community 43 - "jobs.ts"
Cohesion: 0.13
Nodes (24): BodySchema, POST(), bodySchema, GET(), ownAgent(), Params, PUT(), bodySchema (+16 more)

### Community 44 - "chat-client.tsx"
Cohesion: 0.15
Nodes (11): Avatar(), ChatLinkClient(), errorText(), Intro(), Msg, nextId(), parseAssistant(), ProductCard (+3 more)

### Community 45 - "material-select.tsx"
Cohesion: 0.06
Nodes (26): AiModelPolicyForm(), formatUSD(), ModelAlias, ModelOption, Notice, Policy, MODEL_META, NumberPath (+18 more)

### Community 46 - "getVerticalPack"
Cohesion: 0.09
Nodes (24): AgentDetailPage(), Msg, TestPlayground(), VoiceRecorder, ConversationBubble(), ConversationBubbleTone, ConversationText(), TONES (+16 more)

### Community 47 - "vigent-woo.php"
Cohesion: 0.22
Nodes (19): vigent_woo_add_admin_menu(), vigent_woo_content_to_payload(), vigent_woo_full_sync(), vigent_woo_get_settings(), vigent_woo_has_wc(), vigent_woo_on_content_delete(), vigent_woo_on_content_save(), vigent_woo_on_order_status_changed() (+11 more)

### Community 48 - "config.ts"
Cohesion: 0.22
Nodes (9): ChatLinkChannel(), COLOR_PRESETS, LinkState, CHAT_LINK_BACKGROUNDS, ChatLinkBackground, ChatLinkSettings, DEFAULT_CHAT_LINK_SETTINGS, normalizeSlug() (+1 more)

### Community 49 - "route.ts"
Cohesion: 0.21
Nodes (14): POST(), bodySchema, GET(), Params, POST(), POST(), startChat(), createPublicConversationToken() (+6 more)

### Community 50 - "route.ts"
Cohesion: 0.13
Nodes (14): DELETE(), EXT_TO_MIME, GET(), Params, resolveFilePath(), authorized(), PROTECTED_PREFIXES, grants (+6 more)

### Community 51 - "page.tsx"
Cohesion: 0.13
Nodes (21): bodySchema, Params, POST(), appBaseUrl(), createSchema, DELETE(), GET(), maskBotToken() (+13 more)

### Community 52 - "social-links.tsx"
Cohesion: 0.09
Nodes (15): CHANNEL_ICONS, COPY, MobileChannelTab, COPY, Pillar, InstagramIcon(), SOCIAL_LABELS, SOCIAL_URLS (+7 more)

### Community 53 - "agent.ts"
Cohesion: 0.13
Nodes (19): POST(), recordRun(), requestSchema, detectRole(), extractVigentoDraft(), fallbackVigentoDraft(), recommendedChannels, roleKeys (+11 more)

### Community 54 - "Apple Design"
Cohesion: 0.10
Nodes (20): 10. Gesture design details (the "feel" checklist), 11. Frame-level smoothness, 12. Materials & depth — translucency conveys hierarchy, 13. Multimodal feedback — motion + sound + haptics, 14. Reduced motion & accessibility, 15. Typography — optical sizing, tracking, leading, 16. Design foundations — the eight principles, 17. Process (+12 more)

### Community 55 - "route.ts"
Cohesion: 0.12
Nodes (23): agentStateSchema, creditSchema, executeTool(), fileSchema, findAgents(), findUsers(), findWorkspaces(), inputSchema (+15 more)

### Community 56 - "low-credit-alert.ts"
Cohesion: 0.12
Nodes (22): confirmSchema, Params, POST(), POST(), createSchema, GET(), POST(), appBaseUrl() (+14 more)

### Community 57 - "vertical-bookings-vigento.test.ts"
Cohesion: 0.20
Nodes (18): vigentoDraftSchema, AvailabilityRuleLike, AvailabilityWindow, AvailableSlot, buildAvailableSlots(), BusyAppointmentLike, DateExceptionLike, effectiveAvailabilityWindows() (+10 more)

### Community 58 - "validation.ts"
Cohesion: 0.40
Nodes (5): computeTrend(), TrendBadge(), TrendDirection, TrendsStrip(), TrendTile

### Community 59 - "appointments-workspace.tsx"
Cohesion: 0.09
Nodes (26): GET(), AppointmentsPage(), AppointmentCard(), AppointmentRow, AppointmentStatus, AppointmentsWorkspace(), BookingDialog(), DialogShell() (+18 more)

### Community 60 - "iphone-preview.tsx"
Cohesion: 0.12
Nodes (5): IphonePreview, IphonePreviewProps, ScreenProps, AutomationMessage, ReplyMode

### Community 61 - "types.ts"
Cohesion: 0.11
Nodes (18): CreateAutomationPayload, GATE_MODE_LABEL, GATE_MODE_LABEL_KEY, MATCH_MODE_DESC_KEY, MATCH_MODE_LABEL, MATCH_MODE_LABEL_KEY, MediaType, MESSAGE_TYPE_LABEL (+10 more)

### Community 62 - "helpers.ts"
Cohesion: 0.27
Nodes (16): generateMetadata(), getWorkspaceId(), Props, PublicBlogPostPage(), BlogEditor(), isFa(), analyzeSeo(), deriveExcerpt() (+8 more)

### Community 63 - "page.tsx"
Cohesion: 0.10
Nodes (17): ChannelsSection, FaqSection, FeaturesSection, HomePage(), metadata, PricingSection, VigentoSection, COPY (+9 more)

### Community 64 - "agent-wizard.tsx"
Cohesion: 0.13
Nodes (14): AdminPostRow, STATUS_BADGE_CLS, STATUS_LABELS_EN, STATUS_LABELS_FA, BlogCategory, BlogPostData, EMPTY_POST, JsonImportDialog() (+6 more)

### Community 65 - "admin-blog-manager.tsx"
Cohesion: 0.12
Nodes (19): GET(), bodySchema, Params, POST(), readBotToken(), FacebookPagesResult, getInstagramTokenDiagnostics(), IgHost (+11 more)

### Community 66 - "contacts-view.tsx"
Cohesion: 0.20
Nodes (15): DELETE(), GET(), guard(), Params, PATCH(), GET(), guard(), POST() (+7 more)

### Community 67 - "chat-orchestrator.ts"
Cohesion: 0.15
Nodes (19): ChatTool, ChatUsage, appendReceipt(), BookingChatResult, combinedUsage(), hasBookingContext(), maybeRunBookingAgentTurn(), safeCompletionAfterTools() (+11 more)

### Community 68 - "ingest.ts"
Cohesion: 0.24
Nodes (14): crawlUrlToKnowledge(), fetchUrlText(), refreshStaleUrlKnowledge(), ChunkOptions, chunkText(), splitBySentence(), contextualChunk(), processIngestion() (+6 more)

### Community 69 - "Glossary"
Cohesion: 0.11
Nodes (17): Animation Vocabulary, Easing — how speed changes over an animation, Entrances & Exits — how elements appear and disappear, Examples, Feedback & Interaction — responding to the user's actions, Glossary, Instructions, Looping & Ambient Motion — animations that run on their own (+9 more)

### Community 70 - "layout.tsx"
Cohesion: 0.26
Nodes (11): activateSubscription(), activateSubscriptionPayment(), BlockReason, ChatGate, checkChatAllowed(), getMonthlyMessageCount(), monthKey(), persistSubscription() (+3 more)

### Community 71 - "automation-manager.tsx"
Cohesion: 0.07
Nodes (36): PATCH(), payloadSchema, AgentCatalogPage(), InstagramAutomationPage(), AgentLearningPage(), AgentSettingsPage(), BUSINESSES, NewAgentPage() (+28 more)

### Community 72 - "charts.ts"
Cohesion: 0.27
Nodes (11): deleteChunksForProduct(), insertChunk(), InsertChunkInput, retrieveChunks(), toVectorLiteral(), buildProductText(), getOrCreateProductKB(), processProductEmbed() (+3 more)

### Community 73 - "booking-manager.tsx"
Cohesion: 0.14
Nodes (16): addDays(), AppointmentItem, AppointmentStatus, BookingManager(), BookingService, DateException, minuteToTime(), normalizeService() (+8 more)

### Community 74 - "instagram.ts"
Cohesion: 0.11
Nodes (26): logout(), AgentBuilderEntry(), BuildMode, Props, INSTAGRAM_SERVICE, InstagramServiceSetup(), Props, MobileNav() (+18 more)

### Community 75 - "PageHeader"
Cohesion: 0.26
Nodes (11): ChatMessage, buildCatalogBlock(), buildMessages(), buildServiceBlock(), CatalogProduct, CatalogService, formatPrice(), RagContext (+3 more)

### Community 76 - "page.tsx"
Cohesion: 0.39
Nodes (7): GET(), Params, POST(), PUT(), readIgUserId(), getIgUserWebhookSubscription(), getInstagramProfile()

### Community 77 - "conversation-thread.tsx"
Cohesion: 0.26
Nodes (9): GET(), ACTIVE_APPOINTMENT_STATUSES, BookingError, bookInTransaction(), BookResult, findAppointmentWithRelations(), listAvailableSlots(), dateKeyToDatabaseDate() (+1 more)

### Community 78 - "neural-operation-graph.tsx"
Cohesion: 0.13
Nodes (8): BUSINESS_ICONS, COPY, Hero(), LABELS, NeuralOperationGraph(), NeuralOperationGraphProps, Scenario, Spotlight()

### Community 79 - "getEffectivePlanDefs"
Cohesion: 0.19
Nodes (18): Params, POST(), Params, POST(), PUT(), GET(), Params, DELETE() (+10 more)

### Community 80 - "scheduler.ts"
Cohesion: 0.14
Nodes (17): generateMetadata(), getWorkspaceId(), Props, PublicBlogCategoryPage(), getWorkspaceId(), PublicBlogIndexPage(), AdminBlogManager(), PublicPost (+9 more)

### Community 81 - "API"
Cohesion: 0.12
Nodes (16): API, Available scripts, Environment, `GET /health`, `GET /status?sessionId=<id>`, How it fits in, Install & run, Limits & caveats (+8 more)

### Community 82 - "getEffectivePlanDefs"
Cohesion: 0.15
Nodes (16): GET(), PUT(), schema, GET(), DELETE(), GET(), isAdminAuthed(), getServerMetrics() (+8 more)

### Community 83 - "checkWorkspaceActive"
Cohesion: 0.25
Nodes (12): POST(), appUrl(), bodySchema, POST(), createNowPaymentsInvoice(), getApiKey(), NOWPAYMENTS_PAID_STATUSES, NowPaymentsInvoiceResult (+4 more)

### Community 84 - "فایل‌های تغییر یافته"
Cohesion: 0.12
Nodes (16): `app/api/agents/[agentId]/route.ts` (PATCH), `app/api/agents/route.ts` (POST), `app/api/chat/route.ts` و `app/api/widget/[agentId]/chat/route.ts`, `app/(dashboard)/agents/[agentId]/settings/page.tsx`, `components/agent-builder/agent-wizard.tsx`, `components/agent-builder/flow-templates.ts`, `components/agents/agent-settings-form.tsx` (بازنویسی کامل), `lib/ai/chat-engine.ts` (+8 more)

### Community 85 - "index.ts"
Cohesion: 0.16
Nodes (14): MessageBuilder(), app, AUTH_ROOT, bootstrap(), __dirname, forwardInbound(), log, newState() (+6 more)

### Community 86 - "page.tsx"
Cohesion: 0.14
Nodes (23): buildTrend(), daysAgo(), isRecord(), MODULE_META, OverviewPage(), percentDelta(), PLAN_NAMES_FA, buildSeries() (+15 more)

### Community 87 - "isAdminAuthed"
Cohesion: 0.16
Nodes (12): CHANNELS, IntegrationsPage(), AddStoreForm(), DIRECTION_LABEL, ENTITY_LABEL, formatDate(), IntegrationCard(), StoreIntegrationItem (+4 more)

### Community 88 - "route.ts"
Cohesion: 0.14
Nodes (26): Meter(), ModelSelect(), TIER_ICON, ReplyCreditEstimator(), PricingSection(), OpenRouterManagedModel, AGENT_MODELS, BY_ALIAS (+18 more)

### Community 89 - "product.ts"
Cohesion: 0.11
Nodes (19): DELETE(), Params, PATCH(), GET(), POST(), DELETE(), GET(), ownProduct() (+11 more)

### Community 90 - "فایل‌های جدید"
Cohesion: 0.14
Nodes (14): `app/api/integrations/[integrationId]/route.ts`, `app/api/integrations/route.ts`, `app/api/sync/woocommerce/route.ts`, `app/(dashboard)/integrations/page.tsx`, `components/integrations/store-integrations-section.tsx`, `lib/integrations/crawler.ts`, `lib/integrations/woocommerce.ts`, `wordpress-plugin/vigent-woo/readme.txt` (جدید) (+6 more)

### Community 91 - "entitlements.ts"
Cohesion: 0.17
Nodes (14): EASE, OTPCredentialLike, PhoneOtpForm(), Step, channelHasTrustedIdentity(), ExtractedIdentity, extractEnglishName(), extractIdentity() (+6 more)

### Community 92 - "index.ts"
Cohesion: 0.14
Nodes (10): AgentWizard(), BUSINESS_PRESETS, channelLabel(), ConfigDraft, CreatedAgent, draftFromRole(), FormState, VigentoComposer() (+2 more)

### Community 93 - "VIGENT — Complete Claude Code Project Prompt v2"
Cohesion: 0.14
Nodes (13): ⚙️ BACKGROUND JOBS (BullMQ), 🗃 DATABASE SCHEMA (Prisma), 📋 ENVIRONMENT VARIABLES, 🗂 FILE STRUCTURE, 💡 IMPLEMENTATION NOTES, 🌐 INTERNATIONALIZATION, 🧠 MANAGED AI + REPLY CREDIT — CRITICAL ARCHITECTURE, Multi-Tenant AI Agent SaaS Platform | vigent.ir (+5 more)

### Community 94 - "route.ts"
Cohesion: 0.19
Nodes (10): AdminUsersPage(), BadgeTone, displayPhone(), PLAN_LABEL, PLAN_OPTIONS, PlanFilter, startOfToday(), VALID_PLANS (+2 more)

### Community 95 - "page-header.tsx"
Cohesion: 0.18
Nodes (22): AdminVigentoPage(), CAPABILITIES, inputSchema, POST(), DraftAgent, draftAnswer(), DraftResult, resolveModelId() (+14 more)

### Community 96 - "page.tsx"
Cohesion: 0.39
Nodes (8): ALLOWED_PREFIXES, execFileAsync, hasFfmpeg(), MIME_TO_EXT, POST(), publicBaseUrl(), transcodeToInstagramAudio(), UploadedFile

### Community 97 - "navbar.tsx"
Cohesion: 0.32
Nodes (4): metadata, OnboardingShell(), STEPS, Logo()

### Community 98 - "Vignet Improvements — CHANGES.md"
Cohesion: 0.15
Nodes (12): `app/api/agents/[agentId]/knowledge/route.ts`, `app/(dashboard)/agents/[agentId]/knowledge/page.tsx`, `components/knowledge/kb-manager.tsx`, `lib/knowledge/ingest.ts`, `lib/knowledge/vector-store.ts`, `messages/fa.json` و `messages/en.json`, Vignet Improvements — CHANGES.md, فاز ۱ — موتور پرامپت ۶ لایه‌ای + تمپلیت‌های نقش‌محور (+4 more)

### Community 99 - "فایل‌های تغییر یافته"
Cohesion: 0.15
Nodes (13): `app/(dashboard)/agents/[agentId]/analytics/page.tsx`, `app/(dashboard)/contacts/page.tsx`, `app/(dashboard)/conversations/page.tsx`, `app/(dashboard)/overview/page.tsx`, `components/dashboard/charts/conversation-chart.tsx`, `components/dashboard/charts/hourly-heatmap.tsx`, `components/dashboard/charts/satisfaction-gauge.tsx`, `components/dashboard/metrics-explainer.tsx` (جدید) (+5 more)

### Community 100 - "catalog.ts"
Cohesion: 0.20
Nodes (10): worker, campaignWorker, connection, inboundWorker, ingestionWorker, notificationWorker, productWorker, shutdown() (+2 more)

### Community 101 - "scripts"
Cohesion: 0.31
Nodes (11): ALLOWED, POST(), decodeBase32(), isValidToken(), safeEqual(), secret(), sign(), totpAt() (+3 more)

### Community 102 - "logo.tsx"
Cohesion: 0.29
Nodes (6): IntelligenceCore(), IntelligenceCoreProps, IntelligenceCoreLazy(), LazyIntelligenceCore, NODE_META, POSITIONS

### Community 103 - "vigento-actions.ts"
Cohesion: 0.14
Nodes (16): skipOnboarding(), DELETE(), Params, PATCH(), settingsSchema, bodySchema, GET(), ownAgent() (+8 more)

### Community 104 - "route.ts"
Cohesion: 0.27
Nodes (11): appUrl(), GET(), handleCallback(), POST(), readPid(), createZarinPayPayment(), getStoreId(), getToken() (+3 more)

### Community 105 - "health.ts"
Cohesion: 0.15
Nodes (18): GET(), META, StatusPage(), callEmbeddings(), embedCacheKey(), EmbedContext, embedText(), embedTexts() (+10 more)

### Community 106 - "route.ts"
Cohesion: 0.13
Nodes (18): BusinessProfileStep(), ICONS, Props, SubStep, DetailsStep(), EASE, ICONS, OnboardingFlow() (+10 more)

### Community 107 - "automation-card.tsx"
Cohesion: 0.22
Nodes (13): GET(), PATCH(), DashboardLayout(), metadata, OnboardingPage(), SettingsPage(), Header(), computeOnboarding() (+5 more)

### Community 108 - "automation-card.tsx"
Cohesion: 0.29
Nodes (6): AutomationCard(), MESSAGE_TYPE_ICON, REPLY_MODE_ICON, TYPE_ICON, MessageType, REPLY_MODE_SHORT_LABEL_KEY

### Community 109 - "build-plugin-zip.mjs"
Cohesion: 0.17
Nodes (9): centralParts, centralSize, CRC_TABLE, eocd, files, localParts, outFile, root (+1 more)

### Community 110 - "Quick Reference"
Cohesion: 0.18
Nodes (11): 10. Charts & Data (LOW), 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Style Selection (HIGH), 5. Layout & Responsive (HIGH), 6. Typography & Color (MEDIUM), 7. Animation (MEDIUM) (+3 more)

### Community 111 - "media-uploader.tsx"
Cohesion: 0.15
Nodes (13): scripts, build, db:deploy, db:generate, db:migrate, db:push, db:studio, dev (+5 more)

### Community 112 - "demo-section.tsx"
Cohesion: 0.27
Nodes (9): BrandHeader(), NAV_ITEMS, NavItem, NavList(), AdminLayout(), metadata, MobileNavTrigger(), adminLogout() (+1 more)

### Community 113 - "openrouter.ts"
Cohesion: 0.20
Nodes (10): estedad, geistMono, geistSans, metadata, RootLayout(), Providers(), dirForLocale(), isLocale() (+2 more)

### Community 114 - "route.ts"
Cohesion: 0.29
Nodes (9): POST(), schema, AdminActionInput, AdminActionPayload, createAdminActionToken(), executeAdminAction(), secret(), signature() (+1 more)

### Community 115 - "فایل‌های جدید"
Cohesion: 0.20
Nodes (10): `app/api/conversations/[conversationId]/handoff/route.ts`, `app/api/handoff-alerts/[alertId]/route.ts`, `app/api/handoff-alerts/route.ts`, `app/api/operator-channel/route.ts`, `app/api/operator-channel/test/route.ts`, `app/api/telegram-operator/webhook/route.ts`, `components/crm/conversation-panel.tsx`, `components/crm/operator-channel-setup.tsx` (+2 more)

### Community 116 - "openrouter.ts"
Cohesion: 0.39
Nodes (10): appHeaders(), asRecord(), chatCompletion(), ChatOptions, ChatToolCall, firstChoice(), parseUsage(), requestBody() (+2 more)

### Community 117 - "Design Engineering"
Cohesion: 0.22
Nodes (8): Accessibility, Design Engineering, Initial Response, prefers-reduced-motion, Review Checklist, Review Format (Required), Stagger Animations, Touch device hover states

### Community 118 - "UI/UX Pro Max - Design Intelligence"
Cohesion: 0.22
Nodes (8): Available Domains, Available Stacks, How to Use, Output Formats, Prerequisites, Rule Categories by Priority, Search Reference, UI/UX Pro Max - Design Intelligence

### Community 119 - "actions.ts"
Cohesion: 0.24
Nodes (8): adminLogin(), AdminLoginState, AdminLoginForm(), initial, AdminLoginPage(), metadata, ADMIN_COOKIE, createSessionToken()

### Community 120 - "service-catalog-manager.tsx"
Cohesion: 0.20
Nodes (8): CategoriesPage(), NewProductPage(), BackButton(), CategoryNode, CategoryTree(), CategoryOption, ProductForm(), ProductFormData

### Community 121 - "route.ts"
Cohesion: 0.22
Nodes (11): bookingErrorResponse(), POST(), BOOKING_AGENT_TOOLS, BOOKING_TOOL_SYSTEM_INSTRUCTION, cancelSchema, executeBookingAgentTool(), slotsSchema, createAppointment() (+3 more)

### Community 122 - "route.ts"
Cohesion: 0.27
Nodes (8): DELETE(), Params, PATCH(), updateSchema, resumeAiForConversation(), dispatchSummary(), mocks, props

### Community 123 - "route.ts"
Cohesion: 0.31
Nodes (8): DELETE(), encryptSensitiveFields(), GET(), ownIntegration(), Params, PATCH(), patchSchema, SENSITIVE_FIELDS

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

### Community 130 - "page.tsx"
Cohesion: 0.12
Nodes (10): GET(), guard(), POST(), feedbackSchema, Params, POST(), Props, VigentoAdminReport (+2 more)

### Community 131 - "route.ts"
Cohesion: 0.19
Nodes (8): AgentChannelsPage(), WEBHOOK_PATH, PendingWhatsappNumber, QrState, StatusResponse, WhatsAppNumberPicker(), normalizeMessengerSettings(), resolveChannel()

### Community 132 - "route.ts"
Cohesion: 0.36
Nodes (7): GET(), Params, ChatLinkPage(), generateMetadata(), loadLink(), Props, normalizeChatLinkSettings()

### Community 133 - "tts.ts"
Cohesion: 0.23
Nodes (14): databaseHealth(), FailedJobLog, GET(), HealthState, openRouterHealth(), POST(), QueueRow, redisAndQueuesHealth() (+6 more)

### Community 134 - "react"
Cohesion: 0.39
Nodes (4): OperatorChannelInfo, OperatorChannelSetup(), WeeklyReportCard(), Switch()

### Community 135 - "page.tsx"
Cohesion: 0.38
Nodes (8): DELETE(), GET(), EditProductPage(), isAdminAuthedRequest(), CapturedPayload, clearWebhookPayloads(), getWebhookPayloads(), key()

### Community 136 - "فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس"
Cohesion: 0.29
Nodes (7): `lib/docs/content.ts`, `lib/docs/nav.ts`, اعتبارسنجی نهایی, فاز ۶ — رفع ۴۰۴ صفحهٔ مستندات ووکامرس, فایل‌های تغییر یافته, نتیجه, هدف

### Community 137 - "route.ts"
Cohesion: 0.43
Nodes (7): DELETE(), GET(), ownAgent(), Params, PUT(), putSchema, chatLinkUrl()

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

### Community 146 - "kb-manager.tsx"
Cohesion: 0.29
Nodes (5): AgentKnowledgePage(), KbItem, KbManager(), KbStatus, Mode

### Community 147 - "page.tsx"
Cohesion: 0.43
Nodes (6): AdminDatabasePage(), EmptyState(), DATABASE_MODELS, DatabaseModelKey, readDatabaseModel(), serializeValue()

### Community 148 - "route.ts"
Cohesion: 0.38
Nodes (6): buttonSchema, DELETE(), owns(), Params, PATCH(), updateSchema

### Community 149 - "نکات اجرایی"
Cohesion: 0.33
Nodes (6): Migration, اعتبارسنجی, سازگاری با گذشته, متغیرهای محیطی جدید (اختیاری), نکات اجرایی, وابستگی‌های جدید

### Community 150 - "page.tsx"
Cohesion: 0.38
Nodes (5): EditAutomationPage(), EditInstagramAutomationPage(), Automation, AutomationAction, AutomationTrigger

### Community 151 - "setup-server.sh"
Cohesion: 0.60
Nodes (4): apt_update(), ensure_secret(), set_env(), setup-server.sh script

### Community 152 - "setup-whatsapp-bridge.sh"
Cohesion: 0.40
Nodes (5): append_env(), NEXT_JS_BASE_URL, setup-whatsapp-bridge.sh script, WHATSAPP_BRIDGE_PORT, WHATSAPP_BRIDGE_SECRET

### Community 153 - "AutomationType"
Cohesion: 0.33
Nodes (5): NewAutomationPage(), NewInstagramAutomationPage(), AutomationForm(), TabDef, AutomationType

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
Cohesion: 0.38
Nodes (8): EmailMessage, escapeHtml(), getClient(), notifyOps(), sendEmail(), NotificationJobData, processNotification(), runInlineNotification()

### Community 163 - "route.ts"
Cohesion: 0.22
Nodes (8): actionSchema, buttonSchema, createSchema, GET(), messageEntrySchema, Params, POST(), triggerSchema

### Community 164 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

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
Cohesion: 0.32
Nodes (3): BackToTop(), COPY, Footer()

### Community 213 - "page.tsx"
Cohesion: 0.47
Nodes (5): GET(), ownAgent(), Params, POST(), saveSchema

### Community 218 - "route.ts"
Cohesion: 0.33
Nodes (6): defaultSettings(), GET(), Params, PATCH(), patchSchema, REPLY_POLICIES

### Community 229 - "route.ts"
Cohesion: 0.38
Nodes (6): DELETE(), GET(), getOwnedAgent(), Params, PATCH(), agentUpdateSchema

### Community 230 - "route.ts"
Cohesion: 0.33
Nodes (6): DELETE(), GET(), ownedService(), PATCH(), Props, serviceUpdateSchema

### Community 231 - "route.ts"
Cohesion: 0.47
Nodes (5): GET(), POST(), listBookingServices(), serviceSlug(), serviceCreateSchema

### Community 232 - "wp-content.ts"
Cohesion: 0.53
Nodes (5): deleteContent(), handleWpContentWebhook(), upsertContent(), WpContentPayload, writeLog()

### Community 233 - "route.ts"
Cohesion: 0.50
Nodes (4): GET(), POST(), checkAgentCreateAllowed(), agentCreateSchema

## Knowledge Gaps
- **1057 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `mini-services/**`, `node_modules/**`, `metadata` (+1052 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `ui.tsx`, `react`, `page.tsx`, `captureError`, `page.tsx`, `kb-manager.tsx`, `page.tsx`, `rateLimit`, `popular-posts.tsx`, `trend-chart.tsx`, `material-select.tsx`, `getVerticalPack`, `social-links.tsx`, `validation.ts`, `appointments-workspace.tsx`, `agent-wizard.tsx`, `automation-manager.tsx`, `booking-manager.tsx`, `instagram.ts`, `scheduler.ts`, `page.tsx`, `isAdminAuthed`, `route.ts`, `navbar.tsx`, `vigento-actions.ts`, `route.ts`, `demo-section.tsx`, `service-catalog-manager.tsx`, `system-monitor.tsx`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `jalaali-js`, `package.json`, `tts.ts`, `@prisma/client`, `recharts`, `framer-motion`, `date-fns`, `@aws-sdk/s3-request-presigner`, `qrcode`, `resend`, `openai`, `@types/qrcode`, `gsap`, `next-auth`, `zod`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `prisma.ts` to `page.tsx`, `route.ts`, `models.ts`, `syncOnboarding`, `activity.ts`, `registry.ts`, `route.ts`, `commercial-config.ts`, `woocommerce.ts`, `registry.ts`, `route.ts`, `oauth.ts`, `route.ts`, `jobs.ts`, `route.ts`, `page.tsx`, `agent.ts`, `low-credit-alert.ts`, `appointments-workspace.tsx`, `admin-blog-manager.tsx`, `automation-manager.tsx`, `page.tsx`, `conversation-thread.tsx`, `getEffectivePlanDefs`, `checkWorkspaceActive`, `page.tsx`, `product.ts`, `route.ts`, `page-header.tsx`, `page.tsx`, `route.ts`, `route.ts`, `vigento-actions.ts`, `route.ts`, `route.ts`, `automation-card.tsx`, `route.ts`, `route.ts`, `route.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `mini-services/**` to the rest of the system?**
  _1057 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `automation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11184939091915837 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.03709508881922675 - nodes in this community are weakly interconnected._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08376623376623377 - nodes in this community are weakly interconnected._