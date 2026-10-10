'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Check,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Settings2,
  ArrowLeft,
} from 'lucide-react'
import { InstagramConnectFlow } from '@/components/channels/instagram-connect-wizard'
import { ChannelMark } from '@/components/ui/channel-mark'
import { AutoSaveStatus } from '@/components/ui/auto-save-status'
import { useAutoSave } from '@/lib/hooks/use-auto-save'

export type MessengerKind =
  | 'TELEGRAM'
  | 'BALE'
  | 'RUBIKA'
  | 'INSTAGRAM'

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
  INSTAGRAM: [
    { key: 'pageToken', labelKey: 'fieldPageToken', placeholderKey: 'fieldPageTokenPh' },
  ],
}

/** Compose the single bot-token string the API/adapter expects from the fields. */
function composeToken(type: MessengerKind, values: Record<string, string>): string {
  if (type === 'INSTAGRAM') return (values.pageToken ?? '').trim()
  return (values.botToken ?? '').trim()
}

/** True when every required field for this platform has a value. */
function isComplete(type: MessengerKind, values: Record<string, string>): boolean {
  return FIELD_SETS[type].every((f) => (values[f.key] ?? '').trim().length > 0)
}

/** Platforms that render quick-reply buttons.
 *
 * NOTE (FRONTEND-AUTO-V3): Instagram is excluded — the dedicated Instagram
 * automation tab (`/agents/{agentId}/instagram`) is the canonical place to
 * manage quick replies / message builders for IG. Showing the legacy
 * quick-replies card on the channels page for IG was redundant and confusing.
 * Telegram/Bale keep it; Rubika's bot API has no keyboard support.
 */
const SUPPORTS_QUICK_REPLIES: Record<MessengerKind, boolean> = {
  TELEGRAM: true,
  BALE: true,
  RUBIKA: false,
  INSTAGRAM: false,
}

/**
 * Behavior settings editor for a connected messenger channel. Currently:
 * quick-reply suggestion buttons shown under every agent reply.
 */
function ChannelSettings({
  agentId,
  channelId,
  type,
  initialQuickReplies,
}: {
  agentId: string
  channelId: string
  type: MessengerKind
  initialQuickReplies: string[]
}) {
  const t = useTranslations('channels')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<string[]>(
    initialQuickReplies.length ? initialQuickReplies : [''],
  )
  // Blank rows are only placeholders; what is stored is the filled-in buttons.
  const auto = useAutoSave({
    value: items.map((s) => s.trim()).filter(Boolean).slice(0, 4),
    save: async (quickReplies) => {
      const res = await fetch(`/api/agents/${agentId}/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickReplies }),
      })
      if (!res.ok) throw new Error('SAVE_FAILED')
    },
  })

  return (
    <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`channel-quick-replies-${type.toLowerCase()}`}
        className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-xs font-medium text-[var(--text-secondary)]"
      >
        <span className="inline-flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          {t('channelSettings')}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={`channel-quick-replies-${type.toLowerCase()}`} className="space-y-3 px-3 pb-3">
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">
              {t('msgrQuickRepliesLabel')}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {t('msgrQuickRepliesHint')}
            </p>
          </div>
          <div className="space-y-2" onBlur={auto.flush}>
            {items.map((val, i) => (
              <input
                key={i}
                value={val}
                maxLength={type === 'TELEGRAM' || type === 'BALE' ? 40 : 20}
                placeholder={t('msgrQuickRepliesPh')}
                onChange={(e) =>
                  setItems((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))
                }
                className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)] focus:border-[var(--border-strong)]"
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={items.length >= 4}
              onClick={() => setItems((arr) => [...arr, ''])}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              + {t('msgrQuickRepliesAdd')}
            </button>
            <AutoSaveStatus status={auto.status} onRetry={auto.flush} errorLabel={t('saveError')} className="-me-2.5" />
          </div>
        </div>
      )}
    </div>
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

/**
 * Map the stored health error (a reason code from lib/channels/health.ts, or
 * the older free-text form) to the message key that explains it to the owner.
 */
function lostReasonKey(type: MessengerKind, error?: string | null): string | null {
  if (!error) return null
  if (/^UNREACHABLE/.test(error)) return 'healthReasonUnreachable'
  if (/TOKEN_REJECTED|NO_TOKEN|rejected the stored token/.test(error)) {
    return type === 'INSTAGRAM' ? 'connectionLostInstagram' : 'connectionLostTokenRejected'
  }
  return null
}

/** Active health-check badge (A20): green = ok, orange = recent error,
 * red = down. Shows the last check time so operators trust the state. */
function ChannelHealthBadge({
  type,
  status,
  checkedAt,
  error,
}: {
  type: MessengerKind
  status?: string | null
  checkedAt?: string | null
  error?: string | null
}) {
  const t = useTranslations('channels')
  const [expanded, setExpanded] = useState(false)

  if (!status || status === 'unknown') return null

  const down = status === 'down'
  const degraded = status === 'degraded'
  const rel = checkedAt ? formatRelative(Date.now() - new Date(checkedAt).getTime(), t) : null
  const reasonKey = lostReasonKey(type, error)

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex items-center gap-1.5 text-xs ${
          down ? 'text-danger' : degraded ? 'text-warning' : 'text-success'
        }`}
      >
        {down || degraded ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
        )}
        {down
          ? t('healthDown')
          : degraded
            ? t('healthDegraded')
            : t('healthOk')}
        {rel ? <span className="text-[var(--text-tertiary)]">— {t('healthChecked', { time: rel })}</span> : null}
      </button>
      {expanded && error ? (
        <div className="mt-1 break-words text-[12px] leading-4 text-[var(--text-tertiary)]">
          {reasonKey ? t(reasonKey) : error}
        </div>
      ) : null}
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
  lastInboundAt,
  healthStatus,
  healthCheckedAt,
  healthError,
  quickReplies = [],
  botAvatar,
}: {
  agentId: string
  type: MessengerKind
  label: string
  hint: string
  enabled: boolean
  channelId: string | null
  botUsername: string | null
  /** ISO timestamp of the last inbound webhook message, or null if none yet. */
  lastInboundAt?: string | null
  /** A20 — active health check state: 'ok' | 'degraded' | 'down' | 'unknown'. */
  healthStatus?: string | null
  /** ISO timestamp of the last completed health check. */
  healthCheckedAt?: string | null
  /** Short provider error from the last check. */
  healthError?: string | null
  /** Saved quick-reply suggestion buttons (config.settings.quickReplies). */
  quickReplies?: string[]
  /** For Instagram OAuth channels: the IG profile picture URL (display). */
  botAvatar?: string | null
}) {
  const t = useTranslations('channels')
  const router = useRouter()
  const fields = FIELD_SETS[type]
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [reconnectOpen, setReconnectOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)

  const isInstagram = type === 'INSTAGRAM'
  // Connected on paper, but the periodic check says the provider no longer
  // accepts the stored credentials — the owner has to reconnect.
  const connectionLost = enabled && healthStatus === 'down'
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
        setError(
          data.error === 'INVALID_TOKEN'
            ? t('invalidToken')
            : data.error === 'CHANNEL_LIMIT'
              ? t('channelLimitError')
              : t('connectError'),
        )
        return
      }
      if (data.webhookSet === false) setError(t('webhookWarning'))
      setValues({})
      setOpen(false)
      setReconnectOpen(false)
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

  // The same form connects a new channel and reconnects a lost one: every
  // connect route upserts the existing row back to active.
  const connectForm = (
    <>
      {type === 'INSTAGRAM' ? (
        // Instagram uses the platform-managed OAuth flow (one click →
        // Facebook Login dialog → callback → channel persisted). No token
        // pasting, no webhook configuration, no Meta dashboard visit.
        <InstagramConnectFlow
          agentId={agentId}
          onClose={() => {
            setOpen(false)
            setReconnectOpen(false)
          }}
        />
      ) : (
        <>
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
                className="w-full rounded-xl border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)] focus:border-[var(--border-strong)]"
              />
            </div>
          ))}

          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={connect}
              disabled={busy || !isComplete(type, values)}
              aria-busy={busy || undefined}
              title={!isComplete(type, values) ? t('incompleteFormHint') : undefined}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--white)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? t('connecting') : t('connectConfirm')}
            </button>
          </div>
        </>
      )}
    </>
  )

  return (
    <div className="spatial-surface rounded-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        {enabled && isInstagram && botAvatar && failedAvatarUrl !== botAvatar ? (
          // Connected Instagram OAuth channel — show the IG profile avatar
          // instead of the generic camera icon. Makes it obvious at a glance
          // which account is wired up.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={botAvatar}
            alt={botUsername ?? ''}
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            onError={() => setFailedAvatarUrl(botAvatar)}
            className="h-10 w-10 shrink-0 rounded-xl border border-[var(--border-default)] object-cover"
          />
        ) : (
          <ChannelMark channel={type} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
            {label}
            {connectionLost ? (
              <AlertTriangle className="h-4 w-4 text-danger" aria-label={t('healthDown')} />
            ) : (
              enabled && <Check className="h-4 w-4 text-success" />
            )}
          </div>
          <div className="truncate text-sm text-[var(--text-secondary)]">
            {enabled && botUsername ? `@${botUsername}` : hint}
          </div>
        </div>
        {enabled ? (
          <div className="ms-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {/* Connected Instagram: link into the automation management page.
                This is the entry point to DM/comment triggers, follow-gate, etc. */}
            {isInstagram && (
              <Link
                href="/instagram"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-base)]"
              >
                مدیریت اتوماسیون
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            )}
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)] hover:text-danger disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('disable')}
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={`channel-details-${type.toLowerCase()}`}
              aria-label={t(open ? 'collapseConnection' : 'expandConnection')}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={busy}
            aria-expanded={open}
            aria-controls={`channel-details-${type.toLowerCase()}`}
            className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-50"
          >
            {t('connect')}
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {enabled && open && (
        <div id={`channel-details-${type.toLowerCase()}`}>
          <ChannelHealthBadge type={type} status={healthStatus} checkedAt={healthCheckedAt} error={healthError} />
          <WebhookHealth lastInboundAt={lastInboundAt} />

      {/* Instagram no longer needs the Development Mode / App Review reminder:
          the platform app is Live + reviewed, and new connections are OAuth
          (mode='OAUTH'). Legacy token-paste channels are also covered because
          the new connections are the dominant path. */}

      {/* Behavior settings for connected channels that support them. */}
      {enabled && channelId && SUPPORTS_QUICK_REPLIES[type] && (
        <ChannelSettings
          agentId={agentId}
          channelId={channelId}
          type={type}
          initialQuickReplies={quickReplies}
        />
      )}

        </div>
      )}

      {connectionLost && (
        <div role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/5 p-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-danger">{t('connectionLostTitle')}</p>
              <p className="mt-1 text-[var(--text-secondary)]">
                {t(lostReasonKey(type, healthError) ?? 'connectionLostGeneric')} {t('connectionLostImpact')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReconnectOpen((value) => !value)}
              aria-expanded={reconnectOpen}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
            >
              {t('reconnect')}
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${reconnectOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
          {reconnectOpen && <div className="mt-3 space-y-3">{connectForm}</div>}
        </div>
      )}

      {!enabled && open && (
        <div id={`channel-details-${type.toLowerCase()}`} className="mt-4 space-y-3">
          {connectForm}
        </div>
      )}
    </div>
  )
}
