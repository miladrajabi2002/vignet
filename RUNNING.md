# Running Vigent locally

This guide gets the Vigent platform running on your machine — from a fresh
clone to a working login. Phase 1 (auth, dashboard, onboarding, OpenRouter
key management, marketing site) is implemented.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 (tested on 24) | `node -v` |
| npm | ≥ 10 | comes with Node |
| PostgreSQL **with pgvector** | 15+ | Supabase recommended (pgvector built-in) |
| Redis | 6+ | OTP storage + (later) BullMQ jobs |

You need **three external services**: a Postgres database (Supabase), a Redis
instance, and — optionally — an sms.ir account. Without sms.ir, OTP codes are
printed to the server console so you can still log in (see §6).

---

## 2. Install

```bash
npm install
```

This also generates the Prisma client via the `postinstall`/`db:generate`
flow. If the client is ever missing, run:

```bash
npm run db:generate
```

---

## 3. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env
```

Generate the two secrets you control:

```bash
# 32-byte hex key for AES-256-GCM (OpenRouter key encryption)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # → ENCRYPTION_KEY

# NextAuth session secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" # → NEXTAUTH_SECRET & AUTH_SECRET
```

Key variables:

| Variable | Required | What it is |
|----------|----------|-----------|
| `DATABASE_URL` | ✅ | Pooled Postgres URL (Supabase: port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | ✅ | Direct Postgres URL (Supabase: port 5432) — used by migrations |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | ✅ | Same value in both |
| `ENCRYPTION_KEY` | ✅ | 64 hex chars (32 bytes) |
| `REDIS_URL` | ✅ | e.g. `redis://localhost:6379` |
| `SMS_IR_API_KEY` / `SMS_IR_TEMPLATE_ID` | ⬜ | sms.ir OTP; omit for dev console fallback |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | ⬜ | Storage (Phase 2 uploads) |
| `RESEND_API_KEY` | ⬜ | Transactional email (ops alerts) |
| `RESEND_FROM` | ⬜ | Verified Resend sender, e.g. `Vigent <alerts@vigent.ir>` |
| `ALERT_EMAIL` | ⬜ | Ops inbox for critical alerts; empty = email disabled |

> ⚠️ `.env` is git-ignored. Never commit real secrets.

---

## 4. Database (Supabase + pgvector)

### 4a. Create the project
1. Create a Supabase project.
2. Project → **Database → Connection string**:
   - **Transaction pooler** (port 6543) → `DATABASE_URL` (append `?pgbouncer=true`)
   - **Direct connection** (port 5432) → `DIRECT_URL`
3. pgvector ships with Supabase; the migration enables it with
   `CREATE EXTENSION IF NOT EXISTS "vector"`.

### 4b. Apply the migration
A ready-to-apply initial migration lives in
`prisma/migrations/20260626000000_init/`. Apply it with:

```bash
npm run db:deploy      # prisma migrate deploy — applies committed migrations
```

For an iterative dev workflow (creates + applies + regenerates client):

```bash
npm run db:migrate     # prisma migrate dev
```

Verify with Prisma Studio:

```bash
npm run db:studio
```

The migration creates all 15 tables, enums, the `vector(1536)` embedding
column, and an HNSW cosine index on `KnowledgeChunk.embedding` for RAG.

---

## 5. Redis

- **Local (Docker):** `docker run -p 6379:6379 redis:7`
- **Local (Windows):** use WSL or a managed Redis (Upstash works with a
  `rediss://` URL).

Set `REDIS_URL` accordingly. Redis is required for OTP storage and rate
limiting even in dev.

---

## 6. sms.ir (OTP) — optional in dev

**With sms.ir:** register a verify template on app.sms.ir (text e.g.
`کد تأیید ویجنت: {Code}`), then set `SMS_IR_API_KEY` and `SMS_IR_TEMPLATE_ID`.

**Without sms.ir (dev):** leave both blank. When you request a code, it is
printed to the **server console**:

```
[sms.ir] DEV MODE — no SMS_IR_API_KEY. OTP for +98912... is: 123456
```

Use that code to complete login.

---

## 6b. Background worker (knowledge ingestion & product embedding)

Heavy work (chunking + embedding documents, re-embedding products) runs through
BullMQ. Two ways to run it:

- **Dev (simplest):** set `DISABLE_QUEUE=1` in `.env`. Jobs run inline in the web
  process — no separate worker needed.
- **Production:** set `DISABLE_QUEUE=0` and run the worker alongside the app:

  ```bash
  npm run worker
  ```

Both require Redis and a configured OpenRouter key (embeddings use the
workspace's key). File ingestion (PDF/CSV) also needs Supabase Storage.

## 7. Run

```bash
npm run dev      # http://localhost:3000
# optionally, in a second terminal (only if DISABLE_QUEUE=0):
npm run worker
```

- `/`            → marketing homepage (always pure black, FA/EN toggle)
- `/login`       → phone + OTP login (single page)
- after login    → `/onboarding` (new workspaces) then `/overview`
- `/settings/ai-keys` → add your OpenRouter key (validated + encrypted)

Production:

```bash
npm run build
npm run start
```

---

## 8. First login walkthrough

1. Open `/login`, enter an Iranian mobile (`09xxxxxxxxx`).
2. Grab the OTP from the SMS or the server console.
3. First-time numbers are asked for a name → a workspace + OWNER user are
   created automatically (14-day trial).
4. You land on `/onboarding`. Step 1 links to `/settings/ai-keys` — paste a
   real OpenRouter key (`sk-or-…`) to validate and store it.

---

## 9. Useful scripts

| Script | Action |
|--------|--------|
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | `prisma migrate dev` (create + apply) |
| `npm run db:deploy` | `prisma migrate deploy` (apply committed) |
| `npm run db:push` | Push schema without a migration (prototyping) |
| `npm run db:studio` | Prisma Studio |

---

## 10b. Deploying & updating on a server

The platform is a standard Next.js app plus an optional BullMQ worker. Any host
that runs Node ≥ 20 works (VPS with PM2, Docker, Vercel, etc.).

### First deploy
```bash
git clone <repo> && cd vigent
npm ci                       # clean, lockfile-exact install
cp .env.example .env         # then fill in production values
npm run db:deploy            # apply committed migrations
npm run build
npm run start                # serves on PORT (default 3000)
# in a second process, only if DISABLE_QUEUE=0:
npm run worker
```

### Updating to a new version (pull latest changes)
Run these from the project directory on the server, in order:
```bash
git pull                     # fetch the new code
npm ci                       # sync deps (safe even if unchanged)
npm run db:deploy            # apply any new migrations (no-op if none)
npm run build                # rebuild the production bundle
# restart the app process, e.g. with PM2:
pm2 restart vigent && pm2 restart vigent-worker
# (or: stop `npm run start` / `npm run worker` and start them again)
```

> If you run behind PM2, a typical setup is:
> ```bash
> pm2 start "npm run start"  --name vigent
> pm2 start "npm run worker" --name vigent-worker   # only if DISABLE_QUEUE=0
> pm2 save
> ```

### Health & status after deploy
- `GET /api/health` → JSON, `200` when healthy / `503` when fully down. Good for
  uptime monitors and load-balancer checks.
- `/status` → human-readable status page (database + Redis), bilingual.

---

## 10. Troubleshooting

- **`ENCRYPTION_KEY must be 64 hex characters`** — regenerate with the command
  in §3.
- **`Can't reach database server`** — check `DIRECT_URL` (migrations use the
  direct, non-pooled URL) and that your IP is allowed in Supabase.
- **OTP never arrives** — in dev, check the server console (§6); with sms.ir,
  confirm the template is approved and the API key is active.
- **Redis connection errors** — the app warns and falls back to
  `redis://localhost:6379`; make sure Redis is actually running.
- **pgvector errors on migrate** — ensure you're on Supabase or a Postgres
  build that ships pgvector; the extension line is in the migration.
