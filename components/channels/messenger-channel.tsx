'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Check,
  Loader2,
  Send,
  MessagesSquare,
  Radio,
  MessageCircle,
  Camera,
  ChevronDown,
  Copy,
  CheckCheck,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

export type MessengerKind =
  | 'TELEGRAM'
  | 'BALE'
  | 'RUBIKA'
  | 'WHATSAPP'
  | 'INSTAGRAM'

/** Icon lookup so the server component never passes a component across the boundary. */
const ICONS: Record<MessengerKind, LucideIcon> = {
  TELEGRAM: Send,
  BALE: MessagesSquare,
  RUBIKA: Radio,
  WHATSAPP: MessageCircle,
  INSTAGRAM: Camera,
}

/** Credential fields the user fills in per platform. */
type FieldDef = { key: string; labelKey: string; placeholderKey: string }

const FIELD_SETS: Record<MessengerKind, FieldDef[]> = {
  TELEGRAM: [
    { key: 'botToken', labelKey: 'fieldBotToken', placeholderKey: 'fieldBotTokenPh' },
  ],
  BALE: [
    { key: 'botToken', labelKey: 'fieldBotToken', placeholderKey: 'fieldBotTokenPh' },
  ],
  RUBIKA: [
    { key: 'botToken', labelKey: 'fieldBotToken', placeholderKey: 'fieldBotTokenPh' },
  ],
  WHATSAPP: [
    { key: 'accessToken', labelKey: 'fieldAccessToken', placeholderKey: 'fieldAccessTokenPh' },
    { key: 'phoneNumberId', labelKey: 'fieldPhoneNumberId', placeholderKey: 'fieldPhoneNumberIdPh' },
  ],
  INSTAGRAM: [
    { key: 'pageToken', labelKey: 'fieldPageToken', placeholderKey: 'fieldPageTokenPh' },
  ],
}

/** Compose the single bot-token string the API/adapter expects from the fields. */
function composeToken(type: MessengerKind, values: Record<string, string>): string {
  if (type === 'WHATSAPP') {
    return `${(values.accessToken ?? '').trim()}|${(values.phoneNumberId ?? '').trim()}`
  }
  if (type === 'INSTAGRAM') return (values.pageToken ?? '').trim()
  return (values.botToken ?? '').trim()
}

/** True when every required field for this platform has a value. */
function isComplete(type: MessengerKind, values: Record<string, string>): boolean {
  return FIELD_SETS[type].every((f) => (values[f.key] ?? '').trim().length > 0)
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard blocked — ignore */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      aria-label={label}
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? label : null}
    </button>
  )
}

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000 // 3 days with no inbound = likely broken

/**
 * Webhook health badge for a connected channel: how long since the last inbound
 * message arrived. A long silence usually means the webhook or token is broken.
 */
function WebhookHealth({ lastInboundAt }: { lastInboundAt?: string | null }) {
  const t = useTranslations('channels')

  if (!lastInboundAt) {
    return (
      <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]" />
        {t('webhookNoInbound')}
      </div>
    )
  }

  const ts = new Date(lastInboundAt).getTime()
  const ageMs = Date.now() - ts
  const stale = ageMs > STALE_AFTER_MS
  const rel = formatRelative(ageMs, t)

  return (
    <div
      className={`mt-3 flex items-center gap-1.5 text-xs ${
        stale ? 'text-danger' : 'text-[var(--text-secondary)]'
      }`}
    >
      {stale ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
      )}
      {t('webhookLastInbound', { time: rel })}
    </div>
  )
}

/** Coarse Persian/intl relative time ("۲ دقیقه پیش") from an age in ms. */
function formatRelative(ageMs: number, t: ReturnType<typeof useTranslations>): string {
  const min = Math.floor(ageMs / 60000)
  if (min < 1) return t('timeJustNow')
  if (min < 60) return t('timeMinutes', { n: min })
  const hours = Math.floor(min / 60)
  if (hours < 24) return t('timeHours', { n: hours })
  const days = Math.floor(hours / 24)
  return t('timeDays', { n: days })
}

export function MessengerChannel({
  agentId,
  type,
  label,
  hint,
  enabled,
  channelId,
  botUsername,
  callbackUrl,
  verifyToken,
  lastInboundAt,
}: {
  agentId: string
  type: MessengerKind
  label: string
  hint: string
  enabled: boolean
  channelId: string | null
  botUsername: string | null
  /** For Meta channels (WhatsApp/Instagram): webhook callback URL to paste in the Meta dashboard. */
  callbackUrl?: string | null
  /** For Meta channels: verify token to paste in the Meta dashboard. */
  verifyToken?: string | null
  /** ISO timestamp of the last inbound webhook message, or null if none yet. */
  lastInboundAt?: string | null
}) {
  const t = useTranslations('channels')
  const router = useRouter()
  const Icon = ICONS[type]
  const fields = FIELD_SETS[type]
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const isMeta = type === 'WHATSAPP' || type === 'INSTAGRAM'
  const guideSteps = t.raw(`guide.${type}`) as unknown
  const steps = Array.isArray(guideSteps) ? (guideSteps as string[]) : []

  async function connect() {
    if (!isComplete(type, values)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/channels/messenger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, botToken: composeToken(type, values) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error === 'INVALID_TOKEN' ? t('invalidToken') : t('connectError'))
        return
      }
      if (data.webhookSet === false) setError(t('webhookWarning'))
      setValues({})
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!channelId) return
    setBusy(true)
    await fetch(`/api/agents/${agentId}/channels/${channelId}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
            {label}
            {enabled && <Check className="h-4 w-4 text-success" />}
          </div>
          <div className="truncate text-sm text-[var(--text-secondary)]">
            {enabled && botUsername ? `@${botUsername}` : hint}
          </div>
        </div>
        {enabled ? (
          <button
            onClick={disable}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-danger disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('disable')}
          </button>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {t('connect')}
          </button>
        )}
      </div>

      {enabled && <WebhookHealth lastInboundAt={lastInboundAt} />}

      {/* Connected Meta channels: show the webhook callback URL + verify token to finish dashboard setup. */}
      {enabled && isMeta && callbackUrl && verifyToken && (
        <div className="mt-4 space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
          <p className="text-xs text-[var(--text-secondary)]">{t('webhookSetupNote')}</p>
          <div className="space-y-1">
            <label className="text-xs text-[var(--text-secondary)]">{t('callbackUrl')}</label>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="min-w-0 flex-1 truncate rounded-md bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]">
                {callbackUrl}
              </code>
              <CopyButton value={callbackUrl} label={t('copied')} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--text-secondary)]">{t('verifyToken')}</label>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="min-w-0 flex-1 truncate rounded-md bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]">
                {verifyToken}
              </code>
              <CopyButton value={verifyToken} label={t('copied')} />
            </div>
          </div>
        </div>
      )}

      {!enabled && open && (
        <div className="mt-4 space-y-3">
          {steps.length > 0 && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
              <button
                type="button"
                onClick={() => setShowGuide((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-[var(--text-secondary)]"
              >
                {t('setupGuide')}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showGuide ? 'rotate-180' : ''}`}
                />
              </button>
              {showGuide && (
                <ol className="list-decimal space-y-1.5 px-6 pb-3 text-xs text-[var(--text-secondary)] marker:text-[var(--text-tertiary)]">
                  {steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs text-[var(--text-secondary)]">{t(f.labelKey)}</label>
              <input
                dir="ltr"
                value={values[f.key] ?? ''}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
                placeholder={t(f.placeholderKey)}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              />
            </div>
          ))}

          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={connect}
              disabled={busy || !isComplete(type, values)}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('connectConfirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
