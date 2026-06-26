# VIGENT — Complete Claude Code Project Prompt v2
## Multi-Tenant AI Agent SaaS Platform | vigent.ir

---

## ⚡ PROJECT OVERVIEW

Build **Vigent** — a production-ready, multi-tenant SaaS platform where businesses create AI-powered agents that answer from their own data, communicate via text and voice, and work across Telegram, WhatsApp, Instagram, Rubika, Bale, and web widget.

**Core Business Model:** Subscription SaaS. Users bring their **own OpenRouter API key** — Vigent charges for the platform, not AI tokens. All LLM/embedding/voice calls use the workspace's OpenRouter key.

**Key differentiators:**
- Fully bilingual: Persian (RTL) + English (LTR) — switchable per user
- BYOK (Bring Your Own Key): customers control their AI provider and costs
- Knowledge Base from customer's own data (products, docs, DB)
- **Product/Service Catalog** — agents know your products and can sell them
- All channels in one dashboard: Telegram + WhatsApp + Instagram + Rubika + Bale + Web Widget
- Voice messaging (STT+TTS) — not phone calls
- Built-in CRM: contacts, pipeline, unified inbox across all channels
- Phone-number-only auth (OTP via sms.ir) — no email/password anywhere
- Guided Onboarding: 5-step activation checklist for every new workspace
- Cinematic, pure black-and-white marketing website with spotlight + particle animations

---

## 🛠 TECH STACK (EXACT)

```
Framework:        Next.js 14.2+ (App Router, TypeScript strict mode)
Styling:          Tailwind CSS 3.4 + CSS custom properties for theming
Animations:       Framer Motion 11 + GSAP 3 (ScrollTrigger, TextPlugin)
Flow Builder:     React Flow (@xyflow/react) + ELKjs auto-layout
Charts:           Recharts (sparklines, bar, area, radial)
Database:         PostgreSQL via Supabase (pgvector enabled)
ORM:              Prisma 5+ (pooled URL + direct URL for migrations)
Auth:             NextAuth.js v5 (custom credentials — phone OTP, JWT sessions)
Theme:            next-themes (dark/light toggle, system-aware, default: dark)
Icons:            Lucide React
HTTP Client:      Axios
Date handling:    date-fns + jalaali-js (for Solar Hijri / Shamsi dates)
Background Jobs:  BullMQ + Redis (ioredis)
Scheduler:        node-cron (inside Next.js custom server)
Queue:            BullMQ workers (separate process: worker/index.ts)
SMS / OTP:        sms.ir API (phone-based auth + notifications)
Voice - STT:      OpenAI Whisper via OpenRouter (user's key)
Voice - TTS:      OpenAI TTS via OpenRouter OR Kokoro (self-hosted fallback)
Voice - VAD:      @ricky0123/vad-web (Silero VAD, browser-side)
AI Embeddings:    BGE-M3 via OpenRouter (text-embedding-3-small as fallback)
Vector Search:    pgvector extension in Supabase Postgres
i18n:             next-intl (FA + EN, RTL/LTR aware)
Validation:       Zod
State:            Zustand (dashboard state, flow builder state)
Encryption:       Node.js crypto (AES-256-GCM for API key storage)
File Upload:      Supabase Storage (PDFs, CSVs, product images for knowledge base)
Realtime:         SSE (Server-Sent Events) for streaming AI responses
Email:            Resend (transactional emails — optional, secondary)
```

---

## 🗂 FILE STRUCTURE

```
vigent/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Homepage (pure B&W cinematic)
│   │   ├── pricing/page.tsx
│   │   ├── features/page.tsx
│   │   ├── docs/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── getting-started/page.tsx
│   │   │   ├── admin-guide/page.tsx
│   │   │   └── user-guide/page.tsx
│   │   └── blog/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx              # Single page: phone → OTP → done
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # → redirect /overview
│   │   ├── onboarding/page.tsx         # NEW: 5-step activation checklist
│   │   ├── overview/page.tsx
│   │   ├── agents/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [agentId]/
│   │   │       ├── page.tsx
│   │   │       ├── builder/page.tsx
│   │   │       ├── knowledge/page.tsx
│   │   │       ├── settings/page.tsx
│   │   │       └── channels/page.tsx
│   │   ├── products/                   # NEW: Product/Service Catalog
│   │   │   ├── page.tsx               # Grid/list of all products
│   │   │   ├── new/page.tsx           # Add product form
│   │   │   ├── categories/page.tsx    # Manage categories
│   │   │   └── [productId]/
│   │   │       ├── page.tsx           # Product detail + AI query analytics
│   │   │       └── edit/page.tsx
│   │   ├── conversations/
│   │   │   ├── page.tsx
│   │   │   └── [conversationId]/page.tsx
│   │   ├── contacts/
│   │   │   ├── page.tsx
│   │   │   └── [contactId]/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── integrations/page.tsx
│   │   ├── billing/page.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── ai-keys/page.tsx
│   │       └── team/page.tsx
│   └── api/
│       ├── auth/
│       │   ├── [...nextauth]/route.ts
│       │   ├── otp/send/route.ts      # POST: send OTP via sms.ir
│       │   └── otp/verify/route.ts    # POST: verify OTP → login or register
│       ├── agents/
│       │   ├── route.ts
│       │   └── [agentId]/
│       │       ├── route.ts
│       │       ├── knowledge/route.ts
│       │       ├── catalog/route.ts   # NEW: assign products to agent
│       │       └── test/route.ts
│       ├── products/                  # NEW
│       │   ├── route.ts               # GET list, POST create
│       │   └── [productId]/route.ts   # GET, PATCH, DELETE
│       ├── chat/route.ts
│       ├── voice/
│       │   ├── stt/route.ts
│       │   └── tts/route.ts
│       ├── webhook/
│       │   ├── telegram/[token]/route.ts
│       │   ├── whatsapp/route.ts
│       │   ├── rubika/[token]/route.ts  # NEW
│       │   └── bale/[token]/route.ts    # NEW
│       ├── widget/[agentId]/route.ts
│       ├── openrouter/validate/route.ts
│       ├── onboarding/route.ts        # NEW: GET/PATCH onboarding state
│       └── contacts/route.ts
│
├── components/
│   ├── marketing/
│   │   ├── hero.tsx                   # B&W cinematic hero
│   │   ├── spotlight.tsx              # Mouse-following radial spotlight
│   │   ├── particle-grid.tsx          # Dot grid canvas animation
│   │   ├── beam-lines.tsx             # Animated beam/laser lines SVG
│   │   ├── features-section.tsx
│   │   ├── how-it-works.tsx
│   │   ├── channels-section.tsx
│   │   ├── demo-section.tsx
│   │   ├── stats-counter.tsx
│   │   ├── pricing-section.tsx
│   │   ├── testimonials.tsx
│   │   ├── cta-section.tsx            # Magnetic CTA
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   ├── dashboard/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── onboarding-checklist.tsx   # NEW: sticky 5-step progress widget
│   │   ├── stats-card.tsx
│   │   ├── activity-feed.tsx
│   │   ├── charts/
│   │   │   ├── conversation-chart.tsx
│   │   │   ├── channel-donut.tsx
│   │   │   ├── satisfaction-gauge.tsx
│   │   │   ├── hourly-heatmap.tsx
│   │   │   └── agent-sparkline.tsx
│   │   └── recent-conversations.tsx
│   ├── agent-builder/
│   │   ├── flow-editor.tsx
│   │   ├── node-types/
│   │   │   ├── start-node.tsx
│   │   │   ├── message-node.tsx
│   │   │   ├── condition-node.tsx
│   │   │   ├── ai-response-node.tsx
│   │   │   ├── human-handoff-node.tsx
│   │   │   ├── collect-info-node.tsx
│   │   │   └── product-lookup-node.tsx  # NEW: query product catalog
│   │   └── agent-wizard.tsx
│   ├── products/                      # NEW
│   │   ├── product-grid.tsx           # Masonry/grid product cards
│   │   ├── product-form.tsx           # Create/edit form
│   │   ├── product-image-upload.tsx   # Multi-image drag & drop
│   │   ├── category-tree.tsx          # Hierarchical category manager
│   │   └── catalog-assign.tsx         # Assign products to agents
│   ├── knowledge/
│   │   ├── kb-manager.tsx
│   │   ├── upload-zone.tsx
│   │   └── sync-status.tsx
│   ├── crm/
│   │   ├── unified-inbox.tsx
│   │   ├── conversation-thread.tsx
│   │   ├── contact-card.tsx
│   │   └── pipeline-board.tsx
│   ├── auth/
│   │   └── phone-otp-form.tsx         # NEW: single-page phone + OTP UI
│   ├── voice/
│   │   ├── voice-recorder.tsx
│   │   └── audio-player.tsx
│   └── ui/
│       ├── animated-counter.tsx
│       ├── page-transition.tsx
│       ├── gradient-text.tsx
│       ├── shimmer-card.tsx           # Card with white shimmer on hover
│       ├── magnetic-button.tsx        # Cursor-following magnetic effect
│       ├── text-reveal.tsx            # Mask-reveal text animation
│       ├── spotlight-card.tsx         # Card with spotlight that follows cursor
│       ├── language-switcher.tsx
│       └── theme-toggle.tsx
│
├── lib/
│   ├── ai/
│   │   ├── openrouter.ts
│   │   ├── rag.ts
│   │   ├── embeddings.ts
│   │   └── stream.ts
│   ├── sms/
│   │   └── smsir.ts                   # NEW: sms.ir OTP client
│   ├── voice/
│   │   ├── stt.ts
│   │   └── tts.ts
│   ├── channels/
│   │   ├── telegram.ts
│   │   ├── whatsapp.ts
│   │   ├── rubika.ts                  # NEW
│   │   └── bale.ts                    # NEW
│   ├── knowledge/
│   │   ├── ingest.ts
│   │   ├── chunker.ts
│   │   ├── vector-store.ts
│   │   └── product-embedder.ts        # NEW: embed product catalog into vector store
│   ├── products/
│   │   └── catalog.ts                 # NEW: catalog RAG helpers
│   ├── onboarding.ts                  # NEW: onboarding state helpers
│   ├── crypto.ts
│   ├── prisma.ts
│   └── queue/
│       ├── client.ts
│       └── jobs.ts
│
├── prisma/schema.prisma
├── worker/index.ts
├── public/widget/loader.js
├── messages/
│   ├── fa.json
│   └── en.json
├── middleware.ts
├── next.config.ts
├── tailwind.config.ts
└── server.ts
```

---

## 🗃 DATABASE SCHEMA (Prisma)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [pgvector(map: "vector")]
}

// ─── WORKSPACE (TENANT) ───────────────────────────────────────────
model Workspace {
  id                  String   @id @default(cuid())
  name                String
  slug                String   @unique
  plan                Plan     @default(TRIAL)
  trialEndsAt         DateTime?
  openrouterKeyEnc    String?
  openrouterKeyHint   String?
  defaultModel        String   @default("deepseek/deepseek-chat")
  defaultEmbedModel   String   @default("text-embedding-3-small")
  defaultTtsVoice     String   @default("alloy")
  language            String   @default("fa")
  onboardingStep      Int      @default(0)  // 0-5, tracks activation checklist
  onboardingCompleted Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  users               User[]
  agents              Agent[]
  contacts            Contact[]
  conversations       Conversation[]
  subscriptions       Subscription[]
  usageLogs           UsageLog[]
  products            Product[]         // NEW
  productCategories   ProductCategory[] // NEW

  @@index([slug])
}

enum Plan {
  TRIAL
  STARTER
  PRO
  BUSINESS
}

// ─── USER (phone-based, no email/password) ────────────────────────
model User {
  id            String    @id @default(cuid())
  workspaceId   String
  phone         String    @unique  // e.g. +989121234567
  name          String?
  role          UserRole  @default(OWNER)
  language      String    @default("fa")
  createdAt     DateTime  @default(now())

  workspace     Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId])
  @@index([phone])
}

enum UserRole {
  OWNER
  ADMIN
  MEMBER
}

// ─── OTP STORE (backed by Redis, but also DB fallback) ────────────
// Actual OTPs live in Redis: key=otp:{phone}, value=code, TTL=300s
// This model is optional — use only if you need an audit trail
model OTPLog {
  id        String   @id @default(cuid())
  phone     String
  sentAt    DateTime @default(now())
  verified  Boolean  @default(false)
  ip        String?

  @@index([phone])
}

// ─── AGENT ────────────────────────────────────────────────────────
model Agent {
  id              String      @id @default(cuid())
  workspaceId     String
  name            String
  description     String?
  systemPrompt    String      @db.Text
  model           String?
  temperature     Float       @default(0.7)
  maxTokens       Int         @default(1000)
  language        String      @default("fa")
  voiceEnabled    Boolean     @default(false)
  ttsVoice        String      @default("alloy")
  avatar          String?
  welcomeMessage  String?
  fallbackMessage String?
  handoffEnabled  Boolean     @default(false)
  handoffMessage  String?
  active          Boolean     @default(true)
  flowConfig      Json?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  workspace       Workspace   @relation(fields: [workspaceId], references: [id])
  channels        AgentChannel[]
  knowledgeBases  KnowledgeBase[]
  conversations   Conversation[]
  knowledgeChunks KnowledgeChunk[]
  catalogItems    AgentCatalog[]  // NEW: products assigned to this agent

  @@index([workspaceId])
}

// ─── CHANNEL CONNECTIONS ──────────────────────────────────────────
model AgentChannel {
  id              String      @id @default(cuid())
  agentId         String
  type            ChannelType
  config          Json        // encrypted token/config
  active          Boolean     @default(true)
  webhookUrl      String?
  createdAt       DateTime    @default(now())

  agent           Agent       @relation(fields: [agentId], references: [id])

  @@unique([agentId, type])
  @@index([agentId])
}

enum ChannelType {
  TELEGRAM
  WHATSAPP
  INSTAGRAM
  RUBIKA       // NEW
  BALE         // NEW
  WEB_WIDGET
  API
}

// ─── PRODUCT CATALOG ──────────────────────────────────────────────
model ProductCategory {
  id          String    @id @default(cuid())
  workspaceId String
  name        String
  slug        String
  parentId    String?
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())

  workspace   Workspace         @relation(fields: [workspaceId], references: [id])
  parent      ProductCategory?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    ProductCategory[] @relation("CategoryTree")
  products    Product[]

  @@unique([workspaceId, slug])
  @@index([workspaceId])
}

model Product {
  id               String    @id @default(cuid())
  workspaceId      String
  categoryId       String?
  name             String
  description      String?   @db.Text
  price            Float?
  comparePrice     Float?    // original price (for showing discount)
  sku              String?
  stock            Int?      // null = unlimited
  images           String[]  // Supabase Storage URLs
  attributes       Json?     // {"color": "blue", "size": "XL"}
  tags             String[]
  active           Boolean   @default(true)
  embeddingUpdatedAt DateTime? // track when last embedded into vector store
  queryCount       Int       @default(0) // how many times AI retrieved this product
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  workspace        Workspace        @relation(fields: [workspaceId], references: [id])
  category         ProductCategory? @relation(fields: [categoryId], references: [id])
  catalogItems     AgentCatalog[]

  @@index([workspaceId])
  @@index([categoryId])
}

// Agent ↔ Product many-to-many (which products does each agent know about)
model AgentCatalog {
  id        String  @id @default(cuid())
  agentId   String
  productId String

  agent     Agent   @relation(fields: [agentId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([agentId, productId])
  @@index([agentId])
}

// ─── KNOWLEDGE BASE ───────────────────────────────────────────────
model KnowledgeBase {
  id          String    @id @default(cuid())
  agentId     String
  workspaceId String
  name        String
  type        KBType
  sourceUrl   String?
  fileKey     String?
  fileName    String?
  fileSize    Int?
  status      KBStatus  @default(PENDING)
  chunkCount  Int       @default(0)
  errorMsg    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  agent       Agent     @relation(fields: [agentId], references: [id])
  chunks      KnowledgeChunk[]

  @@index([agentId])
  @@index([workspaceId])
}

enum KBType {
  PDF
  CSV
  URL
  TEXT
  FAQ
  PRODUCT_CATALOG  // NEW: auto-generated from product table
}

enum KBStatus {
  PENDING
  PROCESSING
  READY
  ERROR
}

// ─── KNOWLEDGE CHUNKS (with vector embeddings) ────────────────────
model KnowledgeChunk {
  id              String                      @id @default(cuid())
  kbId            String
  agentId         String
  workspaceId     String
  content         String                      @db.Text
  metadata        Json?                       // {source, page, productId, sku, price}
  embedding       Unsupported("vector(1536)")?
  createdAt       DateTime                    @default(now())

  kb              KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)
  agent           Agent         @relation(fields: [agentId], references: [id])

  @@index([agentId])
  @@index([workspaceId])
}

// ─── CONTACT (CRM) ────────────────────────────────────────────────
model Contact {
  id              String    @id @default(cuid())
  workspaceId     String
  name            String?
  phone           String?
  telegramId      String?
  whatsappId      String?
  instagramId     String?
  rubikaId        String?   // NEW
  baleId          String?   // NEW
  tags            String[]
  stage           String    @default("lead")
  notes           String?   @db.Text
  metadata        Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  workspace       Workspace      @relation(fields: [workspaceId], references: [id])
  conversations   Conversation[]

  @@index([workspaceId])
  @@index([telegramId])
  @@index([phone])
}

// ─── CONVERSATION ─────────────────────────────────────────────────
model Conversation {
  id              String      @id @default(cuid())
  workspaceId     String
  agentId         String
  contactId       String?
  channel         ChannelType
  externalId      String?
  status          ConvStatus  @default(OPEN)
  handedOff       Boolean     @default(false)
  rating          Int?
  summary         String?     @db.Text
  messageCount    Int         @default(0)
  lastMessageAt   DateTime?
  createdAt       DateTime    @default(now())

  workspace       Workspace   @relation(fields: [workspaceId], references: [id])
  agent           Agent       @relation(fields: [agentId], references: [id])
  contact         Contact?    @relation(fields: [contactId], references: [id])
  messages        Message[]

  @@index([workspaceId])
  @@index([agentId])
  @@index([contactId])
  @@index([externalId])
}

enum ConvStatus {
  OPEN
  RESOLVED
  HANDED_OFF
}

// ─── MESSAGE ──────────────────────────────────────────────────────
model Message {
  id              String      @id @default(cuid())
  conversationId  String
  role            MessageRole
  content         String      @db.Text
  contentType     ContentType @default(TEXT)
  audioUrl        String?
  metadata        Json?
  createdAt       DateTime    @default(now())

  conversation    Conversation @relation(fields: [conversationId], references: [id])

  @@index([conversationId])
}

enum MessageRole { USER  ASSISTANT  SYSTEM }
enum ContentType { TEXT  AUDIO  IMAGE }

// ─── USAGE LOG ────────────────────────────────────────────────────
model UsageLog {
  id               String    @id @default(cuid())
  workspaceId      String
  agentId          String?
  date             DateTime  @default(now())
  conversationId   String?
  promptTokens     Int       @default(0)
  completionTokens Int       @default(0)
  model            String?
  cost             Float?
  type             LogType

  workspace        Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, date])
}

enum LogType { CHAT  EMBEDDING  TTS  STT }

// ─── SUBSCRIPTION ─────────────────────────────────────────────────
model Subscription {
  id               String    @id @default(cuid())
  workspaceId      String    @unique
  plan             Plan
  status           SubStatus @default(ACTIVE)
  monthlyPrice     Float
  currency         String    @default("IRR")  // Iranian Rial
  currentPeriodEnd DateTime
  createdAt        DateTime  @default(now())

  workspace        Workspace @relation(fields: [workspaceId], references: [id])
}

enum SubStatus { ACTIVE  CANCELLED  PAST_DUE }
```

---

## 📱 AUTH — PHONE + OTP ONLY (sms.ir)

### Concept
No email or password anywhere. Every user authenticates with their Iranian phone number via a 6-digit OTP sent through sms.ir. Login and registration are a single unified flow on one page.

### sms.ir Client

```typescript
// lib/sms/smsir.ts
const SMS_IR_BASE   = 'https://api.sms.ir/v1'
const SMS_IR_APIKEY = process.env.SMS_IR_API_KEY!
const TEMPLATE_ID   = Number(process.env.SMS_IR_TEMPLATE_ID!) // pre-approved OTP template

export async function sendOTP(mobile: string): Promise<void> {
  // Normalize: strip leading 0, add +98
  const normalized = mobile.startsWith('0')
    ? `+98${mobile.slice(1)}`
    : mobile

  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Store in Redis: key=otp:{normalized}, value=code, TTL=300s
  const redis = await getRedis()
  const rateLimitKey = `otp_rate:${normalized}`
  const attempts     = await redis.incr(rateLimitKey)
  if (attempts === 1) await redis.expire(rateLimitKey, 3600) // 1-hour window
  if (attempts > 3) throw new Error('OTP_RATE_LIMIT') // max 3 OTPs per hour

  await redis.set(`otp:${normalized}`, code, 'EX', 300)

  await fetch(`${SMS_IR_BASE}/send/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SMS_IR_APIKEY,
    },
    body: JSON.stringify({
      mobile: normalized,
      templateId: TEMPLATE_ID,
      parameters: [{ name: 'Code', value: code }],
    }),
  })
}

export async function verifyOTP(mobile: string, code: string): Promise<boolean> {
  const normalized = mobile.startsWith('0') ? `+98${mobile.slice(1)}` : mobile
  const redis      = await getRedis()
  const stored     = await redis.get(`otp:${normalized}`)
  if (!stored || stored !== code) return false
  await redis.del(`otp:${normalized}`)
  return true
}
```

### API Routes

```typescript
// app/api/auth/otp/send/route.ts
export async function POST(req: Request) {
  const { phone } = await req.json()
  const parsed    = phoneSchema.safeParse(phone)
  if (!parsed.success) return Response.json({ error: 'INVALID_PHONE' }, { status: 400 })
  try {
    await sendOTP(parsed.data)
    return Response.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'OTP_RATE_LIMIT') return Response.json({ error: 'RATE_LIMIT' }, { status: 429 })
    return Response.json({ error: 'SMS_FAILED' }, { status: 500 })
  }
}

// app/api/auth/otp/verify/route.ts
export async function POST(req: Request) {
  const { phone, code, name } = await req.json()
  const valid = await verifyOTP(phone, code)
  if (!valid) return Response.json({ error: 'INVALID_CODE' }, { status: 401 })

  // Upsert user
  let user = await prisma.user.findUnique({ where: { phone: normalize(phone) } })
  if (!user) {
    // New user → create workspace + user
    const workspace = await prisma.workspace.create({
      data: { name: name || 'کسب‌وکار من', slug: generateSlug() }
    })
    user = await prisma.user.create({
      data: { phone: normalize(phone), name: name || null, workspaceId: workspace.id, role: 'OWNER' }
    })
  }

  // Issue NextAuth session (signIn with credentials)
  return Response.json({ ok: true, userId: user.id })
}
```

### Login Page (single page, two steps)

```tsx
// app/(auth)/login/page.tsx
// Step 1: Phone input
//   - Label: "شماره موبایل"
//   - Input: RTL, persian numerals ok, validates 09XXXXXXXXX
//   - Button: "ارسال کد تأیید"
//   - On submit → POST /api/auth/otp/send → show step 2

// Step 2: OTP input
//   - 6 individual digit boxes (auto-focus next on input)
//   - Countdown 4:59 → "ارسال مجدد کد"
//   - Button: "ورود / ثبت‌نام"
//   - On submit → POST /api/auth/otp/verify → signIn() → /dashboard
//   - First-time user: also show "نام شما؟" field before confirm

// Design: centered card, pure black bg, white text, minimal
// Animation: Framer Motion step transition (slide left)
// No email, no password, no social login
```

---

## 🛍 PRODUCT / SERVICE CATALOG

### Concept
Every workspace can define its product or service catalog. These products are automatically embedded into the agent's vector store, so the agent can answer questions about pricing, availability, features, and comparisons. The agent becomes a knowledgeable salesperson for the business.

### Product Embedding Pipeline

```typescript
// lib/knowledge/product-embedder.ts
export async function embedProduct(product: Product, agentId: string) {
  // Build a rich text chunk from product data
  const text = `
محصول: ${product.name}
${product.category ? `دسته‌بندی: ${product.category.name}` : ''}
${product.price ? `قیمت: ${product.price.toLocaleString('fa-IR')} تومان` : ''}
${product.comparePrice ? `قیمت اصلی: ${product.comparePrice.toLocaleString('fa-IR')} تومان` : ''}
${product.stock !== null ? `موجودی: ${product.stock > 0 ? product.stock + ' عدد' : 'ناموجود'}` : 'موجودی: نامحدود'}
${product.sku ? `کد محصول (SKU): ${product.sku}` : ''}
توضیحات: ${product.description || 'ندارد'}
${product.tags.length ? `تگ‌ها: ${product.tags.join('، ')}` : ''}
${product.attributes ? `مشخصات: ${JSON.stringify(product.attributes)}` : ''}
  `.trim()

  // Get or create PRODUCT_CATALOG knowledge base for this agent
  const kb = await getOrCreateProductKB(agentId, product.workspaceId)

  // Delete old chunk for this product if exists
  await prisma.knowledgeChunk.deleteMany({
    where: { agentId, metadata: { path: ['productId'], equals: product.id } }
  })

  // Embed and store
  const embedding = await embedText(text, product.workspaceId)
  await prisma.knowledgeChunk.create({
    data: {
      kbId: kb.id,
      agentId,
      workspaceId: product.workspaceId,
      content: text,
      metadata: { productId: product.id, sku: product.sku, price: product.price },
      embedding,
    }
  })

  await prisma.product.update({
    where: { id: product.id },
    data: { embeddingUpdatedAt: new Date() }
  })
}
```

### BullMQ Job (auto re-embed on product change)

```typescript
// In worker/index.ts:
// Queue: "product-embed"
// Trigger: whenever a product is created/updated/deleted
// Job payload: { productId, agentIds: string[] }
// Process: embedProduct() for each agent that has this product in catalog
```

### Product Lookup Node (React Flow)

```tsx
// components/agent-builder/node-types/product-lookup-node.tsx
// Special node in the visual builder
// Config: search field (name / SKU / price range / category)
// Output handles: "found" → show product details, "not found" → fallback
// At runtime: does a vector similarity search filtered by metadata.productId
//             also supports exact SKU lookup via prisma
```

### Product Pages

**`/products` — Product Grid**
- Masonry card grid with product image, name, price, stock badge
- Search bar + category filter sidebar
- "موجود" / "ناموجود" / "نامحدود" stock badges
- Sort: newest, price asc/desc, most queried by AI
- Quick actions: edit, toggle active, delete
- "افزودن محصول" CTA button top-right

**`/products/new` and `/products/[id]/edit` — Product Form**
- Fields: name*, description, category, price, comparePrice, SKU, stock
- Multi-image upload (drag & drop, Supabase Storage, preview + reorder)
- Dynamic attributes: key-value pairs (e.g. رنگ: آبی / سایز: XL)
- Tags input
- "فعال / غیرفعال" toggle
- Preview: shows how the agent will describe this product

**`/products/[id]` — Product Analytics**
- AI Query Count: چند بار این محصول توسط ایجنت‌ها جستجو شد
- Conversations that mentioned this product
- Agent coverage: کدام ایجنت‌ها این محصول را می‌شناسند

**`/products/categories` — Category Manager**
- Tree view with drag-to-reorder
- Add/rename/delete categories
- Hierarchical: parent → child → grandchild

---

## 🚀 ONBOARDING — 5-STEP ACTIVATION CHECKLIST

### Concept
After registration, every new workspace enters an onboarding flow. A sticky sidebar widget shows progress. The dashboard redirects to `/onboarding` until at least step 3 is complete.

### Steps

```
Step 1 ✦  کلید OpenRouter را اضافه کن
          → /settings/ai-keys
          → Complete when: workspace.openrouterKeyEnc IS NOT NULL

Step 2 ✦  اولین ایجنت را بساز
          → /agents/new
          → Complete when: Agent count >= 1

Step 3 ✦  دانش به ایجنت اضافه کن (یا محصولات)
          → /agents/[id]/knowledge یا /products
          → Complete when: KnowledgeBase count >= 1 OR Product count >= 1

Step 4 ✦  یک کانال وصل کن
          → /agents/[id]/channels
          → Complete when: AgentChannel count >= 1

Step 5 ✦  ایجنت را تست کن
          → /agents/[id] → Test button
          → Complete when: Conversation count >= 1
```

### DB State
Stored in `Workspace.onboardingStep` (0–5) and `Workspace.onboardingCompleted`.  
Updated via `/api/onboarding` PATCH endpoint — called automatically when conditions are met.

### UI Components

```tsx
// components/dashboard/onboarding-checklist.tsx
// Collapsible card in top of dashboard (disappears when completed)
// Progress bar: 0/5 → 5/5 with animated fill
// Each step: icon + title + description + CTA button
// Completed steps: green checkmark, strikethrough
// Current step: highlighted, pulsing dot
// "رد کردن" (skip) option — hides widget but keeps DB state
// Framer Motion: steps animate in/out with height spring

// Also shown as full page at /onboarding for first-time users
// 5 cards in vertical list, same progress logic
// Celebration animation when all 5 complete (confetti or particle burst)
```

---

## 📡 NEW CHANNELS: RUBIKA + BALE

### Rubika (روبیکا)

```typescript
// lib/channels/rubika.ts
// Rubika Bot API (unofficial/reverse-engineered — document clearly)
// Webhook mode: POST /api/webhook/rubika/[token]
// Handle: text messages, sticker, voice
// Auth token stored in AgentChannel.config (encrypted)
// Message format differs from Telegram — adapter pattern

// Key endpoints:
// POST https://rubika.ir/getBotUpdates → polling (if no webhook)
// POST https://rubika.ir/sendMessage
// POST https://rubika.ir/sendVoice
```

### Bale (بله)

```typescript
// lib/channels/bale.ts
// Bale Messenger Bot API — closer to Telegram API structure
// Base URL: https://tapi.bale.ai/
// Webhook: POST /api/webhook/bale/[token]
// Handle: /sendMessage, /sendVoice, getUpdates
// Bot token stored in AgentChannel.config (encrypted)

// Bale supports inline keyboards similar to Telegram
// Can send quick-reply buttons for common questions
```

---

## 🎨 DESIGN SYSTEM — PURE BLACK & WHITE MONOCHROME

### Philosophy
No color accent. No purple. No gradients with color. Pure black, white, and gray only — like a high-end editorial magazine or a premium SaaS like Linear/Vercel. Every animation is in white/gray tones. Visual hierarchy through scale, weight, and space — not color.

### Color Tokens

```css
/* ── BACKGROUNDS ──────────────────────────────────── */
--bg-base:          #000000;   /* pure black — page bg */
--bg-surface:       #0A0A0A;   /* cards, elevated surfaces */
--bg-elevated:      #111111;   /* modals, dropdowns */
--bg-hover:         #161616;   /* hover states */
--bg-muted:         #1A1A1A;   /* muted inputs, secondary cards */

/* ── BORDERS ──────────────────────────────────────── */
--border-subtle:    rgba(255,255,255,0.04);  /* barely visible dividers */
--border-default:   rgba(255,255,255,0.08);  /* card borders */
--border-hover:     rgba(255,255,255,0.16);  /* on hover */
--border-strong:    rgba(255,255,255,0.25);  /* focus rings, featured cards */

/* ── TEXT ─────────────────────────────────────────── */
--text-primary:     #FFFFFF;
--text-secondary:   rgba(255,255,255,0.55);
--text-muted:       rgba(255,255,255,0.25);
--text-hint:        rgba(255,255,255,0.12);

/* ── WHITE SPECTRUM ───────────────────────────────── */
--white:            #FFFFFF;
--white-90:         rgba(255,255,255,0.90);
--white-60:         rgba(255,255,255,0.60);
--white-30:         rgba(255,255,255,0.30);
--white-10:         rgba(255,255,255,0.10);
--white-05:         rgba(255,255,255,0.05);

/* ── GRADIENTS ────────────────────────────────────── */
--gradient-text:    linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.6) 100%);
--gradient-fade:    linear-gradient(180deg, transparent 0%, #000000 100%);
--gradient-vignette: radial-gradient(ellipse at center, transparent 40%, #000000 100%);
--gradient-spotlight: radial-gradient(600px at var(--mx) var(--my), rgba(255,255,255,0.06) 0%, transparent 70%);

/* ── SEMANTIC (keep for dashboard states only) ─────── */
--green:            #22C55E;   /* success, active, online */
--red:              #EF4444;   /* error, offline */
--amber:            #F59E0B;   /* warning, pending */
--blue:             #3B82F6;   /* info only */
```

### Typography

```css
/* Import: Geist (Vercel's font) or Inter — self-hosted */
--font-display:   'Geist', 'Inter', sans-serif;
--font-mono:      'Geist Mono', 'JetBrains Mono', monospace;
--font-fa:        'Vazirmatn', 'IRANSans', sans-serif; /* Persian text */

/* Scale */
--text-xs:    11px / 1.5;
--text-sm:    13px / 1.6;
--text-base:  15px / 1.7;
--text-lg:    18px / 1.5;
--text-xl:    22px / 1.3;
--text-2xl:   28px / 1.2;
--text-3xl:   36px / 1.15;
--text-4xl:   48px / 1.1;
--text-5xl:   64px / 1.05;
--text-6xl:   80px / 1.0;

/* Weights: 300 (light), 400 (regular), 500 (medium), 600 (semibold) only */
```

### Animation Library (add GSAP)

```bash
npm install gsap @gsap/react
```

```typescript
// Standard Framer Motion variants (keep from v1)
const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
}

// Stagger children
const stagger = {
  whileInView: { transition: { staggerChildren: 0.08 } }
}

// GSAP: used for text reveal, spotlight, and beam animations
// NOT Framer Motion for these — GSAP is better for canvas & SVG
```

---

## 🖥 MARKETING WEBSITE — B&W CINEMATIC

### Homepage Sections

**1. NAVBAR**
```
Background: transparent → rgba(0,0,0,0.8) backdrop-blur on scroll
Logo: white wordmark "VIGENT" — monospace or geometric sans
Links: Home | Features | Pricing | Docs
Right: Language toggle (FA/EN) + "ورود" (ghost) + "شروع رایگان" (white filled)
Mobile: hamburger → full-screen menu with slide-in animation
```

**2. HERO — Full viewport**

```
Background layers (back to front):
  1. #000000 base
  2. Dot grid: 40px spacing, 1px dots, rgba(255,255,255,0.04)
  3. Particle canvas: ~50 white dots floating + connection lines (white, 2% opacity)
  4. Spotlight: radial gradient following mouse cursor (rgba(255,255,255,0.05))
  5. Two beam lines: diagonal white lines across screen (CSS, animated opacity pulse)
  6. Bottom vignette: linear-gradient(transparent → black)

Content (centered, max-width 700px):
  Badge: border rgba(255,255,255,0.12) → text "VIGENT AI PLATFORM ✦"
  H1 (80px, weight 300, gradient-text):
    Line 1: "ایجنت هوشمند"
    Line 2: Typewriter cycling: ["برای فروش", "برای پشتیبانی", "برای کسب‌وکار شما"]
             — GSAP TextPlugin, cursor blink
  Subtitle (16px, rgba(255,255,255,0.45), max-width 480px)
  
CTA row:
  Primary: white bg, black text, "شروع رایگان — ۱۴ روز"
           — on hover: slight scale(1.02) + white glow
  Secondary: border rgba(255,255,255,0.2), "مشاهده دمو" — ghost style

Scroll indicator: animated chevron-down, white 30% opacity

Floating elements:
  - 3 blurred white orbs (very subtle, 3% opacity) at corners
```

**3. STATS BAR**
```
3 counters (white large numbers, gray labels):
  +۵۰۰۰ مکالمه   |   +۳۰۰ ایجنت   |   +۱۰۰ کسب‌وکار
Count-up animation triggered on scroll via GSAP ScrollTrigger
Separator: 1px vertical line, rgba(255,255,255,0.1)
```

**4. FEATURES — Alternating layout**
```
Each feature: large mono number (01, 02...) + title + desc + mockup screenshot
Screenshot: dark card, white border 8% — subtle inner glow on edges
Animation: slide in from left/right on scroll (Framer Motion)
Features:
  01  ساخت ایجنت — React Flow builder preview
  02  پایگاه دانش — upload → embedded diagram
  03  مدیریت محصولات — catalog screenshot
  04  چند کانال — channel logos (Telegram, Rubika, Bale, WhatsApp...)
  05  صدا — waveform SVG animation
  06  CRM یکپارچه — unified inbox screenshot
```

**5. HOW IT WORKS — 3 steps with animated connector**
```
Step 1: کلید OpenRouter اضافه کن (30 ثانیه)
Step 2: داده‌ها و محصولات خود را آپلود کن
Step 3: کانال وصل کن — ایجنت زنده شد

Connector: SVG dashed path between circles — animates stroke-dashoffset on scroll
Each step: white number circle + title (white) + desc (gray)
```

**6. CHANNEL SHOWCASE**
```
Horizontal scroll (snap) or 2×3 grid
Channels: Telegram, WhatsApp, Instagram, Rubika, Bale, Web Widget
Each: dark card, channel icon (white/gray), channel name
Hover: card lifts 4px, border brightens
```

**7. PRICING — 4 cards**
```
All cards: bg-surface, border-default
Featured "Pro": border-strong (white 25%) — no color accent
Annual toggle: pill switch, 20% discount badge
Each card: plan name + price + feature list
CTA: white filled (Pro) or ghost (others)
```

**8. FAQ — Accordion**
```
Question rows with animated chevron
Smooth height transition (Framer Motion layout animation)
Border separators: rgba(255,255,255,0.06)
```

**9. FINAL CTA**
```
Full width section, black bg
Large gradient text headline (white → rgba(255,255,255,0.5))
Magnetic button: white filled, follows cursor ±12px via CSS transform on mousemove
Subtext: "بدون نیاز به کارت اعتباری — فقط شماره موبایل"
```

**10. FOOTER**
```
4-column grid: Logo + links + channels + contact
All text: rgba(255,255,255,0.4)
Border top: rgba(255,255,255,0.06)
Bottom: "© ۱۴۰۴ ویجنت" + "ساخته‌شده در ایران"
```

---

### Key Animation Components

**`components/marketing/spotlight.tsx`**
```typescript
// Tracks mouse position via onMouseMove
// Updates CSS custom properties: --mx, --my
// Applies: background: radial-gradient(600px at var(--mx) var(--my), rgba(255,255,255,0.05), transparent)
// Smooth: uses CSS transition on background or GSAP quickSetter for 60fps
// Applied to: hero section, feature cards on hover
```

**`components/marketing/particle-grid.tsx`**
```typescript
// Canvas element, fullscreen, pointer-events: none
// ~50 nodes: {x, y, vx, vy, opacity}
// Nodes drift slowly (vx/vy ±0.2px per frame)
// Lines between nodes within 120px: white, opacity proportional to distance
// Mouse repel: nodes push away from cursor within 80px radius
// requestAnimationFrame loop
// Resize observer to match canvas to window size
// Performance: skip frames if document hidden
```

**`components/marketing/beam-lines.tsx`**
```typescript
// 2–3 thin diagonal lines across full viewport (SVG or CSS)
// Animate opacity: 0 → 0.05 → 0 over 4s, staggered
// Or: animate a gradient "sweep" along the line (moving highlight)
// Pure white, very subtle
```

**`components/ui/magnetic-button.tsx`**
```typescript
// onMouseMove: calculate delta from button center
// Apply transform: translate(deltaX * 0.3, deltaY * 0.3)
// onMouseLeave: spring back to 0,0
// Framer Motion useMotionValue + spring animation
```

**`components/ui/shimmer-card.tsx`**
```typescript
// On hover: animate a white gradient sweep across card
// background-position transition from left to right (200% → -200%)
// Subtle — shimmer is rgba(255,255,255,0.03) to rgba(255,255,255,0.08)
```

**`components/ui/text-reveal.tsx`**
```typescript
// Text rendered as individual words or characters
// Each wrapped in overflow:hidden container
// On scroll enter: translate Y from 100% to 0% (mask reveal effect)
// Staggered with Framer Motion or GSAP
```

**`components/ui/spotlight-card.tsx`**
```typescript
// Card variant where the spotlight follows cursor INSIDE the card
// onMouseMove on card → update CSS vars for radial gradient position
// border glows slightly where cursor is (border gradient mask technique)
```

---

## 📊 ADMIN DASHBOARD — ANALYTICS

*(Same as v1 — add product analytics section)*

### New: Product Analytics Section
```
On /analytics:
  - Top products queried by AI (bar chart — name vs query count)
  - Products mentioned in conversations (link to conversations)
  - "ناموجود" product query alerts (users asked for out-of-stock items)
  - Catalog coverage: what % of conversations touched the product catalog

On /products/[id]:
  - Weekly query count sparkline
  - Conversation list where product was retrieved
  - "بازدیدکنندگان" who asked about this product → contacts list
```

---

## 🔗 CHANNEL IMPLEMENTATIONS

*(Same as v1 — add Rubika and Bale)*

### Rubika

```typescript
// lib/channels/rubika.ts
// Rubika uses a different API structure than Telegram
// Endpoint base: https://rubino.ai/ (bot API)
// Message handler: extract sender phone (Rubika uses phone as ID)
// Map to Contact.rubikaId
// Send text: POST /sendMessage
// Voice messages: download from Rubika CDN → Whisper → respond

// IMPORTANT: Rubika's bot API may change — wrap in adapter
// interface MessengerAdapter { sendText(chatId, text), sendVoice(chatId, audio) }
// Implement adapters for Telegram, Bale, Rubika, WhatsApp
// Use same interface throughout the RAG pipeline
```

### Bale

```typescript
// lib/channels/bale.ts
// Bale API is very similar to Telegram Bot API
// Base URL: https://tapi.bale.ai/bot{TOKEN}/
// Same endpoint names: sendMessage, sendVoice, getUpdates
// Webhook: POST /setWebhook
// Handle updates: same structure as Telegram — nearly copy-paste adapter
// Map sender user_id → Contact.baleId
```

---

## ⚙️ BACKGROUND JOBS (BullMQ)

```typescript
// Queues:
// 1. "knowledge-ingestion"  — PDF/CSV/URL processing
// 2. "product-embed"        — NEW: re-embed products when catalog changes
// 3. "notifications"        — SMS + email notifications via sms.ir / Resend
// 4. "conversation-summary" — AI-generated summary after conversation ends

// product-embed job:
// Trigger: Product created/updated/deleted + AgentCatalog assigned
// Process: embedProduct(product, agentId) for each affected agent
// On delete: remove chunks where metadata->productId = deletedId
```

---

## 🔑 OPENROUTER BYOK — CRITICAL ARCHITECTURE

*(Same as v1 — no changes)*

---

## 🌐 INTERNATIONALIZATION

*(Same as v1 — no changes)*

---

## 🔒 SECURITY

- All workspace data: always filter by `workspaceId` from JWT session
- OTP: stored in Redis with TTL, rate-limited (3/hour per phone)
- OpenRouter keys: AES-256-GCM encrypted at rest
- Webhook validation: Telegram/Bale (secret token), WhatsApp (HMAC-SHA256), Rubika (token in path)
- Rate limiting: /api/chat + /api/voice/stt — 30 req/min per workspace
- File upload: type + size validation before Supabase Storage
- pgvector queries: always include `WHERE workspace_id = $1`
- Phone numbers: stored normalized (+98XXXXXXXXXX), never logged in plaintext
- Product images: always routed through Supabase signed URLs — no direct public paths

---

## 🚀 PHASES OF IMPLEMENTATION

### Phase 1: Foundation (Week 1–2)
- [ ] Project setup: Next.js 14 + Prisma + Supabase + NextAuth
- [ ] Database schema + migrations (including Product + OTPLog)
- [ ] sms.ir OTP client (sendOTP + verifyOTP)
- [ ] Auth: phone+OTP login/register — single page
- [ ] Workspace auto-creation on first login
- [ ] Basic dashboard shell (sidebar, header, theme toggle)
- [ ] OpenRouter key management + encryption
- [ ] **Onboarding checklist component + /onboarding page**
- [ ] Marketing homepage — B&W cinematic design (hero + particle canvas + spotlight)

### Phase 2: Core Agent Features (Week 3–4)
- [ ] Agent CRUD + wizard (5 steps)
- [ ] System prompt editor with variable hints
- [ ] Knowledge base: PDF/CSV/URL ingestion via BullMQ
- [ ] RAG pipeline: embed → pgvector → retrieve
- [ ] /api/chat SSE streaming endpoint
- [ ] Web widget (loader.js + vanilla JS chat UI)
- [ ] Test playground in dashboard
- [ ] **Product catalog CRUD + ProductCategory tree**
- [ ] **Product embedding pipeline (product-embed BullMQ queue)**
- [ ] **AgentCatalog assignment UI**

### Phase 3: Channels & Voice (Week 5–6)
- [ ] Telegram webhook + bot handler
- [ ] **Bale webhook + bot handler**
- [ ] **Rubika webhook + bot handler**
- [ ] Voice: STT (Whisper) + VAD (Silero) in widget
- [ ] Voice: TTS response in widget
- [ ] Unified inbox / conversations view
- [ ] Contact auto-creation (telegramId, baleId, rubikaId)

### Phase 4: CRM & Analytics (Week 7–8)
- [ ] Full CRM: contacts, pipeline kanban, custom fields
- [ ] Analytics dashboard (all charts)
- [ ] **Product analytics: query count, conversation mentions**
- [ ] Per-agent analytics page
- [ ] CSAT collection
- [ ] Usage logging + billing page
- [ ] React Flow visual builder (including ProductLookupNode)

### Phase 5: Polish & Launch (Week 9–10)
- [ ] WhatsApp integration
- [ ] Documentation pages (admin + user)
- [ ] Pricing page
- [ ] Email notifications (Resend — secondary, for critical alerts)
- [ ] Full i18n FA + EN (including product catalog UI)
- [ ] Performance optimization
- [ ] vigent.ir deployment (Vercel + Supabase)
- [ ] **Status page (status.vigent.ir)**

---

## 📋 ENVIRONMENT VARIABLES

```env
# Database (Supabase)
DATABASE_URL="postgresql://..."         # pooled with ?pgbouncer=true
DIRECT_URL="postgresql://..."           # direct for migrations

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://vigent.ir"

# SMS (sms.ir)
SMS_IR_API_KEY="..."                    # from app.sms.ir
SMS_IR_TEMPLATE_ID="..."               # pre-approved OTP template ID

# Encryption (for OpenRouter keys)
ENCRYPTION_KEY="..."                    # 64 hex chars = 32 bytes

# Redis (for BullMQ + OTP storage)
REDIS_URL="redis://..."

# Supabase Storage
SUPABASE_URL="..."
SUPABASE_SERVICE_KEY="..."

# Email (optional — secondary alerts)
RESEND_API_KEY="..."

# App
NEXT_PUBLIC_APP_URL="https://vigent.ir"
NEXT_PUBLIC_WIDGET_URL="https://vigent.ir"
```

---

## 💡 IMPLEMENTATION NOTES

1. **OTP normalization**: Always normalize phone to `+98XXXXXXXXXX` before storing and checking OTP in Redis. Accept `09XXXXXXXXX`, `9XXXXXXXXX`, `+989XXXXXXXXX` as input.

2. **Product catalog + RAG**: When a product is assigned to an agent, immediately queue a `product-embed` job. When unassigned or deleted, delete those chunks from `knowledge_chunks` filtered by `metadata->>'productId'`.

3. **Onboarding auto-detection**: On every API call, check onboarding conditions server-side and update `Workspace.onboardingStep` silently. Do not rely on frontend to report completion.

4. **Rubika adapter**: Rubika's API structure is not as stable as Telegram. Use the Adapter pattern so the core pipeline never imports Rubika directly — only the adapter does. This protects against API changes.

5. **B&W design strict rule**: No purple, blue, green, or any color accent in the marketing site or dashboard. Dashboard has three semantic colors only: green (success/online), amber (warning), red (error). Everything else is white/gray/black.

6. **GSAP + Framer Motion coexistence**: Use Framer Motion for React component animations (page transitions, list items, counters, layout). Use GSAP for canvas, SVG paths, scroll-triggered sequences, and the typewriter effect. Do not mix them on the same element.

7. **Particle canvas performance**: Use `document.hidden` check to pause the RAF loop. Throttle node count on mobile to 25. Use `devicePixelRatio` for crisp rendering on retina.

8. **Bale vs Telegram**: Bale's API is extremely similar to Telegram's. You can reuse ~80% of the Telegram adapter by making the base URL configurable. Test with a real Bale bot before going live.

9. **pgvector RAG query** (unchanged from v1):
```sql
SELECT content, metadata, 
       1 - (embedding <=> $1::vector) as similarity
FROM knowledge_chunks
WHERE workspace_id = $2 AND agent_id = $3
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

10. **Product price in RAG**: When a user asks "قیمت X چنده؟" — the vector search retrieves the product chunk which already contains the price in text form. No need for a separate structured query in most cases. For exact SKU lookup, add a fallback: `prisma.product.findFirst({ where: { sku: extractedSku } })`.

---

## START HERE — FIRST COMMAND

```bash
npx create-next-app@latest vigent --typescript --tailwind --app --src-dir=false --import-alias="@/*"
cd vigent
npm install framer-motion gsap @gsap/react @xyflow/react recharts next-themes next-intl \
  @prisma/client prisma next-auth@beta zod axios date-fns jalaali-js \
  @supabase/supabase-js bullmq ioredis openai lucide-react \
  @ricky0123/vad-web zustand resend
npx prisma init
```

Then:
1. Create Supabase project → enable pgvector extension
2. Set all environment variables (especially SMS_IR_API_KEY + SMS_IR_TEMPLATE_ID)
3. Register OTP template on app.sms.ir (template text: "کد تأیید ویجنت: {Code}")
4. Run `npx prisma migrate dev --name init`
5. Start with Phase 1 — auth first, then dashboard shell, then onboarding
