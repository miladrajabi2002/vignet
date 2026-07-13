# vigent-whatsapp-bridge

A long-running mini-service that holds **WhatsApp Web (Baileys)** sessions for
the vigent platform. Operators scan a QR code (or pair by phone number) in the
dashboard; once connected, every WhatsApp message they receive is forwarded to
the AI agent, and the agent's reply is sent back through WhatsApp.

This is the **unofficial WhatsApp Web protocol** path. It does **not** require:

- a Meta App / WhatsApp Business Account / Business Manager
- the Meta verification + app review process
- a VPN (the official Meta OAuth flow is geo-blocked from Iran without one)
- 24-hour customer-service-window compliance
- pre-approved template messages

It's ideal for personal / small-business WhatsApp numbers that just need an AI
auto-reply.

## How it fits in

```
┌─────────────────────┐    HTTP (start/status/send/disconnect)
│  Next.js dashboard  │ ─────────────────────────────────────────────┐
│  (port 3003)        │                                              │
└────────▲────────────┘                                              ▼
         │ HTTP POST /api/webhook/whatsapp-qr   ┌──────────────────────┴──┐
         │  (inbound WA messages)               │  whatsapp-bridge         │
         └──────────────────────────────────────┤  (port 3040)             │
                                                │  one Baileys socket per  │
                                                │  sessionId, auth state   │
                                                │  in ./auth/<sessionId>/  │
                                                └──────────────────────────┘
```

The Next.js app and this bridge are two separate processes. The Next.js app
talks to the bridge via plain HTTP on `localhost:3040`; the bridge talks back
via HTTP on `localhost:3003` (or your production domain). All requests in both
directions carry a shared secret in the `x-bridge-secret` header so random
internet traffic can't trigger inbound message processing.

## Install & run

The bridge prefers **bun** (faster, no peer-dep conflicts) but also works with
**npm + tsx** as a fallback. The `start` script auto-detects which runtime is
available.

### With bun (recommended)

```bash
cd mini-services/whatsapp-bridge
bun install
cp .env.example .env
# edit .env — set WHATSAPP_BRIDGE_SECRET to a long random string
bun run dev
```

### With npm (when bun is not installed)

```bash
cd mini-services/whatsapp-bridge
# --legacy-peer-deps is REQUIRED: Baileys has strict peer deps that npm
# rejects by default (ERESOLVE error). bun handles this automatically.
npm install --legacy-peer-deps
cp .env.example .env
# edit .env — set WHATSAPP_BRIDGE_SECRET to a long random string
npm run dev    # uses tsx under the hood (added as a devDependency)
```

The bridge listens on port **3040** by default. To change it, set
`WHATSAPP_BRIDGE_PORT` in `.env`.

In production run it under pm2 — see `deploy/ecosystem.config.js` (already
includes a `vignet-whatsapp-bridge` app) and `deploy/setup-whatsapp-bridge.sh`
(one-time setup: generates secret, writes `.env`, installs deps, starts pm2).

## Environment

| Var | Default | Meaning |
| --- | --- | --- |
| `WHATSAPP_BRIDGE_PORT` | `3040` | HTTP port the bridge listens on. |
| `NEXT_JS_BASE_URL` | `http://localhost:3003` | Where the Next.js app lives (so the bridge can forward inbound messages). In production set to your domain. |
| `WHATSAPP_BRIDGE_SECRET` | _(empty — auth disabled)_ | Shared secret sent in `x-bridge-secret`. **Set this in production.** Must match the same var in the Next.js `.env`. |
| `LOG_LEVEL` | `info` | pino log level (`silent`/`error`/`warn`/`info`/`debug`). |

On the **Next.js** side, also set:

```
WHATSAPP_BRIDGE_URL=http://localhost:3040
WHATSAPP_BRIDGE_SECRET=<same string as the bridge>
```

## API

All endpoints require `x-bridge-secret: <WHATSAPP_BRIDGE_SECRET>` (when set).

### `POST /start?sessionId=<id>`
Body (optional): `{ "phone": "+989121234567" }`

Create (or restart) a Baileys session. If `phone` is given, the bridge requests
a **pairing code** instead of a QR — the operator enters it on their phone
(WhatsApp → Settings → Linked devices → Link a device → "Link with phone
number"). Otherwise a QR is emitted.

### `GET /status?sessionId=<id>`
```json
{
  "ok": true,
  "state": "qr" | "pairing" | "connecting" | "open" | "closed",
  "qr": "2@...",         // when state === 'qr'
  "pairingCode": "AB12CD34", // when state === 'pairing'
  "phone": "+989121234567",  // when state === 'open'
  "name": "Milad",           // when state === 'open'
  "error": "..."             // when state === 'closed'
}
```

### `POST /send-text?sessionId=<id>&jid=<number>&text=<msg>`
Send a plain-text message. Called by the Next.js side from
`whatsappAdapter.sendText` when the channel is in QR mode.

### `POST /typing?sessionId=<id>&jid=<number>`
Show a typing indicator while the AI is composing. Best-effort.

### `POST /disconnect?sessionId=<id>`
Log out the WhatsApp account and delete the auth folder. The next `/start`
will emit a fresh QR.

### `GET /health`
List of currently-held sessions and their state.

## Persistence

Each session's credentials are stored in `./auth/<sessionId>/`. As long as that
folder exists, restarting the bridge (or the whole server) automatically
reconnects every session — operators don't need to re-scan.

Add `auth/` to `.gitignore`. Back it up periodically (the credentials are
tied to the WhatsApp account; losing them just means re-scanning the QR).

## Limits & caveats

- **One linked device per session.** WhatsApp's "linked device" model lets you
  have up to 4 linked devices per primary phone. Each vigent channel = one
  linked device.
- **Primary phone must stay online-ish.** If the primary phone is offline for
  more than ~14 days, linked devices are logged out and need re-pairing.
- **No official support.** This uses the WhatsApp Web protocol. Meta doesn't
  endorse it. For high-volume / official business use, prefer the OAuth flow
  (`WHATSAPP_CONNECT_MODE=oauth` on the dashboard).
- **Message types.** This bridge forwards text + caption + button/list replies
  (the only kinds the existing `whatsappAdapter.parseUpdate` reads). Voice,
  images, and documents are dropped silently (matching the existing Meta
  adapter's behavior — see `lib/channels/whatsapp.ts`).
