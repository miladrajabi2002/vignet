/**
 * vigent-whatsapp-bridge
 * ─────────────────────────────────────────────────────────────────────────────
 * Long-running mini-service that holds WhatsApp Web (Baileys) sessions for the
 * vigent platform. The Next.js app talks to this bridge over a small HTTP API
 * on port 3040; the bridge talks back to the Next.js app over HTTP (forwarding
 * inbound WhatsApp messages to /api/webhook/whatsapp-qr).
 *
 *  ┌─────────────────────┐    HTTP (start/status/send/disconnect)
 *  │  Next.js dashboard  │ ─────────────────────────────────────────────┐
 *  │  (port 3003)        │                                              │
 *  └────────▲────────────┘                                              ▼
 *           │ HTTP POST /api/webhook/whatsapp-qr   ┌──────────────────────┴──┐
 *           │  (inbound WA messages)               │  whatsapp-bridge         │
 *           └──────────────────────────────────────┤  (port 3040)             │
 *                                                  │  one Baileys socket per  │
 *                                                  │  sessionId, auth state   │
 *                                                  │  in ./auth/<sessionId>/  │
 *                                                  └──────────────────────────┘
 *
 * Why a separate process? Baileys maintains a persistent WebSocket to
 * WhatsApp's servers and MUST NOT be instantiated per-request (Next.js
 * serverless functions can't keep it alive). This bridge is a plain Node/Bun
 * process that runs 24/7 alongside the Next.js app and the worker.
 *
 * Lifecycle of a session
 *  1. POST /start?sessionId=abc           → create Baileys socket, emit QR
 *  2. (operator scans QR / pairs by phone) → Baileys fires 'creds.update'
 *                                            + 'connection.update' state=open
 *  3. POST /status?sessionId=abc          → { state:'open', phone:'+98...' }
 *  4. (Next.js persists the channel with mode='QR')
 *  5. WA inbound message → bridge POSTs to /api/webhook/whatsapp-qr
 *  6. AI reply → Next.js calls POST /send-text?sessionId=abc&jid=…&text=…
 *  7. POST /disconnect?sessionId=abc      → sock.logout(), delete auth folder
 *
 * Auth state persistence: Baileys' useMultiFileAuthState writes one JSON file
 * per credential key under ./auth/<sessionId>/. As long as that folder exists,
 * restarting the bridge reconnects automatically without re-scanning the QR.
 */
import express from 'express'
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  delay,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import { Logger } from 'pino'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { timingSafeEqual } from 'node:crypto'
import P from 'pino'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ── Configuration ────────────────────────────────────────────────────────────
const PORT = Number(process.env.WHATSAPP_BRIDGE_PORT ?? 3040)
const HOST = process.env.WHATSAPP_BRIDGE_HOST ?? '127.0.0.1'
/**
 * Base URL of the Next.js app the bridge should forward inbound messages to.
 * In production set this to https://your-vigent-domain.tld. Locally it defaults
 * to http://localhost:3003 (the port the vigent dev server runs on).
 */
const NEXT_JS_BASE_URL = (
  process.env.NEXT_JS_BASE_URL ?? 'http://localhost:3003'
).replace(/\/$/, '')

/**
 * Shared secret the bridge sends in the `x-bridge-secret` header when it calls
 * the Next.js inbound webhook, and that the Next.js app sends when it calls the
 * bridge. Must match `WHATSAPP_BRIDGE_SECRET` on the Next.js side. Prevents
 * random internet traffic from triggering inbound message processing.
 */
const BRIDGE_SECRET = process.env.WHATSAPP_BRIDGE_SECRET ?? ''

if (process.env.NODE_ENV === 'production' && BRIDGE_SECRET.length < 32) {
  throw new Error(
    'WHATSAPP_BRIDGE_SECRET must be at least 32 characters in production',
  )
}

const AUTH_ROOT = resolve(__dirname, 'auth')
await mkdir(AUTH_ROOT, { recursive: true })

const log = P({ name: 'wa-bridge', level: process.env.LOG_LEVEL ?? 'info' })

// ── Session registry ─────────────────────────────────────────────────────────
interface SessionState {
  /** Baileys socket (null after logout / fatal disconnect). */
  sock: ReturnType<typeof makeWASocket> | null
  /** Current connection lifecycle phase. */
  state:
    | 'starting' // socket created, waiting for first QR / connection.update
    | 'qr' // QR emitted, waiting for scan
    | 'pairing' // phone-number pairing code requested, waiting for entry on phone
    | 'connecting' // QR scanned / pairing accepted, WA is logging us in
    | 'open' // fully connected; receiving messages
    | 'closed' // logged out or fatally disconnected
  /** Latest QR string (rotates every ~20s; null when not in 'qr' state). */
  qr: string | null
  /** Pairing code (8 chars) when the operator requested phone-number pairing. */
  pairingCode: string | null
  /** Connected phone number in E.164 (filled when state becomes 'open'). */
  phone: string | null
  /** Connected WhatsApp account display name. */
  name: string | null
  /** Last error message (human-readable Farsi/English). */
  error: string | null
  /** ISO timestamp of the last state transition. */
  updatedAt: string
}

const sessions = new Map<string, SessionState>()

function newState(): SessionState {
  return {
    sock: null,
    state: 'starting',
    qr: null,
    pairingCode: null,
    phone: null,
    name: null,
    error: null,
    updatedAt: new Date().toISOString(),
  }
}

function patch(id: string, p: Partial<SessionState>) {
  const cur = sessions.get(id)
  if (!cur) return
  Object.assign(cur, p, { updatedAt: new Date().toISOString() })
}

// ── Forward inbound WhatsApp message to the Next.js app ─────────────────────
/**
 * Baileys gives us a fully-decoded message object; the Next.js side already
 * has a `whatsappAdapter.parseUpdate` that expects the Meta Cloud API webhook
 * shape (`entry[0].changes[0].value.messages[]`). Rather than duplicate the
 * parsing logic on the Next.js side, the bridge reshapes its Baileys event
 * into the Meta-webhook shape so the existing inbound pipeline runs UNCHANGED.
 *
 * The reshaping covers the only fields the existing adapter reads:
 *   messages[].from            ← key.remoteJid (number part)
 *   messages[].text.body       ← conversation / extendedTextMessage.text
 *   messages[].button.text     ← (best-effort)
 *   messages[].interactive.button_reply.title ← (best-effort)
 *   contacts[0].profile.name   ← pushName
 *   metadata.phone_number_id   ← our own connected number (so the demuxer that
 *                                 routes OAuth channels by phone_number_id does
 *                                 not pick this up — we use a sentinel 'qr:<id>')
 */
async function forwardInbound(
  sessionId: string,
  msg: any,
): Promise<void> {
  const jid: string = msg.key?.remoteJid ?? ''
  if (!jid) return
  // Skip own messages and status broadcasts.
  if (msg.key?.fromMe) return
  if (jid === 'status@broadcast') return

  const from = jid.split('@')[0]
  const text =
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    msg.message?.imageMessage?.caption ??
    msg.message?.videoMessage?.caption ??
    ''
  const buttonTitle =
    msg.message?.buttonsResponseMessage?.selectedButtonId ??
    msg.message?.templateButtonReplyMessage?.selectedDisplayText ??
    null
  const interactiveTitle =
    msg.message?.listResponseMessage?.title ??
    msg.message?.buttonsResponseMessage?.selectedDisplayText ??
    null

  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'qr_bridge',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                // Sentinel so the OAuth demuxer (which looks up channels by
                // phone_number_id) never matches a QR channel. QR channels are
                // routed by the webhookToken in the URL path instead.
                phone_number_id: `qr:${sessionId}`,
                display_phone_number: sessions.get(sessionId)?.phone ?? '',
              },
              contacts: msg.pushName
                ? [{ profile: { name: msg.pushName } }]
                : [],
              messages: [
                {
                  from,
                  type: 'text',
                  text: text !== '' ? { body: text } : undefined,
                  button: buttonTitle ? { text: buttonTitle } : undefined,
                  interactive: interactiveTitle
                    ? { button_reply: { title: interactiveTitle } }
                    : undefined,
                },
              ],
            },
          },
        ],
      },
    ],
    // vigent-specific extras — read by the /api/webhook/whatsapp-qr route.
    _vigent: {
      sessionId,
      messageId: msg.key?.id,
      pushName: msg.pushName ?? null,
      timestamp: msg.messageTimestamp ?? Math.floor(Date.now() / 1000),
    },
  }

  const url = `${NEXT_JS_BASE_URL}/api/webhook/whatsapp-qr`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-secret': BRIDGE_SECRET,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      log.warn(
        { url, status: res.status, sessionId },
        'Next.js webhook returned non-OK',
      )
    }
  } catch (e) {
    log.error({ err: e, url, sessionId }, 'failed to forward inbound to Next.js')
  }
}

// ── Start / restart a Baileys session ────────────────────────────────────────
async function startSession(sessionId: string, opts?: { phone?: string }) {
  // If a socket is already alive, tear it down first so we can re-issue a QR.
  const prev = sessions.get(sessionId)
  if (prev?.sock) {
    try {
      await prev.sock.end(undefined)
    } catch {
      /* ignore */
    }
  }
  sessions.set(sessionId, newState())

  const authDir = join(AUTH_ROOT, sessionId)
  await mkdir(authDir, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  // Quiet logger — Baileys is extremely chatty at 'info' which floods the
  // terminal. We surface the important events ourselves via patch()/log.
  const waLogger = P({ level: 'silent' }) as unknown as Logger

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, waLogger),
    },
    logger: waLogger,
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })
  const cur = sessions.get(sessionId)!
  cur.sock = sock

  // ── credentials persisted → keep the auth folder in sync ─────────────────
  sock.ev.on('creds.update', saveCreds)

  // ── connection lifecycle ─────────────────────────────────────────────────
  sock.ev.on('connection.update', async (c) => {
    const { connection, qr, lastDisconnect, receivedPendingNotifications } = c
    if (qr) {
      patch(sessionId, { state: 'qr', qr, pairingCode: null })
      log.info({ sessionId }, 'QR emitted — waiting for scan')
    }
    if (connection === 'connecting') {
      patch(sessionId, { state: 'connecting', qr: null })
    }
    if (connection === 'open') {
      const me = sock.user?.id ?? ''
      const phone = me.split(':')[0].split('@')[0]
      const name = (sock.user?.name as string | undefined) ?? null
      patch(sessionId, {
        state: 'open',
        qr: null,
        pairingCode: null,
        phone,
        name,
        error: null,
      })
      log.info({ sessionId, phone }, 'WhatsApp connected')
    }
    if (connection === 'close') {
      const code = (lastDisconnect?.error as any)?.output?.statusCode
      // Baileys disconnect codes:
      //   401 / DisconnectReason.loggedOut (403) → phone unlinked the device.
      //       Must wipe auth + re-scan QR.
      //   515 → "restart required". The WebSocket stream died (common right
      //       after QR scan — Baileys' internal state machine hiccups). The
      //       old socket is DEAD; Baileys does NOT reconnect itself. We must
      //       build a NEW socket. Because creds.update already saved the
      //       scanned credentials, the new socket reconnects WITHOUT a new QR.
      //   408 / 428 / 440 / 500 / 5xx → transient. Same treatment: rebuild.
      const loggedOut =
        code === DisconnectReason.loggedOut || code === 401
      patch(sessionId, {
        state: 'closed',
        qr: null,
        pairingCode: null,
        error: lastDisconnect?.error?.message ?? `closed (code ${code})`,
      })
      log.warn({ sessionId, code, loggedOut }, 'connection closed')

      if (loggedOut) {
        // Phone unlinked the device → wipe auth so next /start emits fresh QR.
        try {
          await rm(authDir, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
        patch(sessionId, { sock: null })
      } else {
        // 515 (restart required) + all transient errors → build a new socket.
        // Wait briefly so we don't hammer WhatsApp's servers on a flapping
        // connection. The new socket picks up the saved auth state and
        // reconnects without re-scanning the QR (unless the auth was wiped,
        // in which case a fresh QR is emitted).
        //
        // Set state to 'connecting' immediately so the dashboard wizard (which
        // polls /status every 2s) shows "در حال اتصال…" instead of the scary
        // "اتصال بسته شد" message during the restart window.
        patch(sessionId, { state: 'connecting', error: null })
        await delay(2000)
        // Guard: only restart if we haven't been stopped/disconnected in the
        // meantime (operator clicked "disconnect" or "new QR").
        const cur2 = sessions.get(sessionId)
        if (cur2 && cur2.state !== 'closed') {
          // startSession will reset state to 'starting' then progress through
          // 'connecting' → 'open' (or 'qr' if auth was wiped).
          log.info({ sessionId, code }, 'auto-restarting session')
          void startSession(sessionId)
        }
      }
    }
    if (receivedPendingNotifications) {
      log.debug({ sessionId }, 'received pending notifications')
    }
  })

  // ── inbound messages → forward to Next.js ────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      await forwardInbound(sessionId, m)
    }
  })

  // ── phone-number pairing (operator can't scan QR, e.g. on mobile) ────────
  if (opts?.phone) {
    // requestPairingCode needs the socket to be fully ready. We retry briefly
    // until sock.authState is populated (Baileys builds it lazily on first
    // ev emission). 8 attempts × 500ms = 4s should be plenty.
    const cleaned = opts.phone.replace(/[^\d]/g, '')
    for (let i = 0; i < 20; i++) {
      try {
        const code: string = await sock.requestPairingCode(cleaned)
        if (code) {
          patch(sessionId, {
            state: 'pairing',
            pairingCode: code,
            qr: null,
          })
          log.info({ sessionId, phone: cleaned }, 'pairing code emitted')
          return
        }
      } catch {
        /* not ready yet — retry */
      }
      await delay(500)
    }
    log.warn(
      { sessionId, phone: cleaned },
      'could not request pairing code — falling back to QR',
    )
  }
}

// ── HTTP API ─────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '1mb' }))

/** Reject requests that don't carry the shared bridge secret. */
function authed(req: express.Request, res: express.Response): boolean {
  if (!BRIDGE_SECRET) return true // dev convenience when no secret set
  const got = req.header('x-bridge-secret') ?? ''
  const expectedBytes = Buffer.from(BRIDGE_SECRET)
  const receivedBytes = Buffer.from(got)
  if (
    expectedBytes.length !== receivedBytes.length ||
    !timingSafeEqual(expectedBytes, receivedBytes)
  ) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return false
  }
  return true
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

/** Start (or restart) a session. Optionally request a phone-number pairing
 *  code instead of a QR — pass { phone: '+989121234567' } in the body. */
app.post('/start', async (req, res) => {
  if (!authed(req, res)) return
  const sessionId = String(req.query.sessionId ?? req.body?.sessionId ?? '')
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(sessionId)) {
    res.status(400).json({ error: 'BAD_SESSION_ID' })
    return
  }
  const phone = req.body?.phone
    ? String(req.body.phone).replace(/[^\d+]/g, '')
    : undefined
  // Don't restart if already open — just return current state.
  const existing = sessions.get(sessionId)
  if (existing?.state === 'open') {
    res.json({
      ok: true,
      state: existing.state,
      phone: existing.phone,
      name: existing.name,
    })
    return
  }
  void startSession(sessionId, phone ? { phone } : undefined)
  res.json({ ok: true, state: 'starting' })
})

/** Poll a session's status. Returns the current QR string, pairing code,
 *  connected phone, or error — depending on lifecycle phase. */
app.get('/status', (req, res) => {
  if (!authed(req, res)) return
  const sessionId = String(req.query.sessionId ?? '')
  const s = sessions.get(sessionId)
  if (!s) {
    res.status(404).json({ error: 'NO_SESSION' })
    return
  }
  res.json({
    ok: true,
    state: s.state,
    qr: s.qr,
    pairingCode: s.pairingCode,
    phone: s.phone,
    name: s.name,
    error: s.error,
    updatedAt: s.updatedAt,
  })
})

/** Send a plain-text message on behalf of the AI agent. Called by the Next.js
 *  side from `whatsappAdapter.sendText` when the channel is in QR mode. */
app.post('/send-text', async (req, res) => {
  if (!authed(req, res)) return
  const sessionId = String(req.query.sessionId ?? req.body?.sessionId ?? '')
  const jid = String(req.query.jid ?? req.body?.jid ?? '')
  const text = String(req.query.text ?? req.body?.text ?? '')
  if (!sessionId || !jid || !text) {
    res.status(400).json({ error: 'MISSING_PARAMS' })
    return
  }
  const s = sessions.get(sessionId)
  if (!s?.sock || s.state !== 'open') {
    res.status(409).json({ error: 'SESSION_NOT_OPEN', state: s?.state ?? null })
    return
  }
  try {
    // WhatsApp jids need the @s.whatsapp.net suffix for 1:1 chats. The
    // inbound side strips it (we store `from` as the bare number); re-add
    // it here when missing so Baileys accepts the recipient.
    const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
    await s.sock.sendMessage(fullJid, { text })
    res.json({ ok: true })
  } catch (e) {
    log.error({ err: e, sessionId, jid }, 'send-text failed')
    res.status(500).json({ error: 'SEND_FAILED', detail: String(e) })
  }
})

/** Show a typing indicator while the AI is composing a reply. Best-effort. */
app.post('/typing', async (req, res) => {
  if (!authed(req, res)) return
  const sessionId = String(req.query.sessionId ?? req.body?.sessionId ?? '')
  const jid = String(req.query.jid ?? req.body?.jid ?? '')
  const s = sessions.get(sessionId)
  if (!s?.sock || s.state !== 'open') {
    res.json({ ok: false })
    return
  }
  try {
    const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
    await s.sock.sendPresenceUpdate('composing', fullJid)
    res.json({ ok: true })
  } catch {
    res.json({ ok: false })
  }
})

/** Disconnect + wipe the auth folder. Used when the operator removes the
 *  channel from the dashboard. */
app.post('/disconnect', async (req, res) => {
  if (!authed(req, res)) return
  const sessionId = String(req.query.sessionId ?? req.body?.sessionId ?? '')
  const s = sessions.get(sessionId)
  if (!s) {
    res.json({ ok: true, note: 'NO_SESSION' })
    return
  }
  try {
    if (s.sock) await s.sock.logout()
  } catch {
    /* ignore */
  }
  try {
    await rm(join(AUTH_ROOT, sessionId), { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  patch(sessionId, {
    sock: null,
    state: 'closed',
    qr: null,
    pairingCode: null,
    phone: null,
    name: null,
  })
  res.json({ ok: true })
})

app.listen(PORT, HOST, () => {
  log.info(
    {
      host: HOST,
      port: PORT,
      nextJsBaseUrl: NEXT_JS_BASE_URL,
      auth: !!BRIDGE_SECRET,
    },
    'vigent-whatsapp-bridge listening',
  )
})

// ── On startup, auto-reconnect any persisted sessions ────────────────────────
// The auth folder survives a bridge restart, so we eagerly re-create sockets
// for every previously-connected session. Operators don't have to re-scan.
async function bootstrap() {
  if (!existsSync(AUTH_ROOT)) return
  const { readdir } = await import('node:fs/promises')
  let dirs: import('node:fs').Dirent[] = []
  try {
    dirs = await readdir(AUTH_ROOT, { withFileTypes: true })
  } catch {
    return
  }
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const id = d.name
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) continue
    log.info({ sessionId: id }, 'resuming persisted session')
    void startSession(id)
  }
}

void bootstrap()
