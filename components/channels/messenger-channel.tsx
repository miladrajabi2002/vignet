'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  ChevronDown,
  AlertTriangle,
  ArrowLeft,
  ClipboardPaste,
  ExternalLink,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react'
import { InstagramConnectFlow } from '@/components/channels/instagram-connect-wizard'
import {
  ChannelLayout,
  ChannelLead,
  ChannelSection,
  ChannelStat,
  ChatMock,
  StepList,
} from '@/components/channels/channel-stage'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
    { key: 'botToken', labelKey: 'fieldBotToken', placeholderKey: 'tokenPastePh' },
  ],
  BALE: [
    { key: 'botToken', labelKey: 'fieldBotToken', placeholderKey: 'tokenPastePh' },
  ],
  RUBIKA: [
    { key: 'botToken', labelKey: 'fieldBotToken', placeholderKey: 'tokenPastePh' },
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

/** Where the platform's bot-maker lives, so step one is a tap, not a search. */
const BOT_MAKER_URL: Partial<Record<MessengerKind, string>> = {
  TELEGRAM: 'https://t.me/BotFather',
  BALE: 'https://ble.ir/botfather',
  RUBIKA: 'https://rubika.ir/BotFather',
}

/** The connected account's public address. */
function accountUrl(type: MessengerKind, username: string): string {
  const handle = encodeURIComponent(username.replace(/^@/, ''))
  if (type === 'TELEGRAM') return `https://t.me/${handle}`
  if (type === 'BALE') return `https://ble.ir/${handle}`
  if (type === 'RUBIKA') return `https://rubika.ir/${handle}`
  return `https://instagram.com/${handle}`
}

const INPUT =
  'w-full rounded-xl border border-[var(--border-default)] bg-white px-3 text-sm text-[var(--text-primary)] outline-none transition-shadow focus:border-[var(--border-strong)] focus:shadow-[0_0_0_3px_rgba(91,61,232,0.22)]'

/**
 * Behavior settings for a connected messenger channel. Currently: the
 * quick-reply buttons shown under every agent reply. The rows live in the
 * parent so the preview beside the form changes as they are typed.
 */
function QuickRepliesEditor({
  agentId,
  channelId,
  type,
  items,
  onChange,
}: {
  agentId: string
  channelId: string
  type: MessengerKind
  items: string[]
  onChange: (next: string[]) => void
}) {
  const t = useTranslations('channels')
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
    <ChannelSection
      title={t('msgrQuickRepliesLabel')}
      hint={t('msgrQuickRepliesHint')}
      action={<AutoSaveStatus status={auto.status} onRetry={auto.flush} idleLabel={null} errorLabel={t('saveError')} className="-me-2.5" />}
    >
      <div id={`channel-quick-replies-${type.toLowerCase()}`} className="space-y-2" onBlur={auto.flush}>
        {items.map((val, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={val}
              maxLength={type === 'TELEGRAM' || type === 'BALE' ? 40 : 20}
              placeholder={t('msgrQuickRepliesPh')}
              aria-label={`${t('msgrQuickRepliesLabel')} ${i + 1}`}
              onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
              className={`${INPUT} min-h-11`}
            />
            {items.length > 1 && (
              <button
                type="button"
                aria-label={t('remove')}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {items.length < 4 && (
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('msgrQuickRepliesAdd')}
          </button>
        )}
      </div>
    </ChannelSection>
  )
}

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000 // 3 days with no inbound = likely broken

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
  const locale = useLocale()
  const [expanded, setExpanded] = useState(false)

  if (!status || status === 'unknown') return null

  const down = status === 'down'
  const degraded = status === 'degraded'
  const rel = checkedAt ? formatRelative(Date.now() - new Date(checkedAt).getTime(), t, locale) : null
  const reasonKey = lostReasonKey(type, error)

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-start text-xs ${
          down ? 'text-danger' : degraded ? 'text-warning' : 'text-success'
        }`}
      >
        {down || degraded ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
        )}
        <span className="whitespace-nowrap">
          {down
            ? t('healthDown')
            : degraded
              ? t('healthDegraded')
              : t('healthOk')}
        </span>
        {rel ? <span className="whitespace-nowrap text-[var(--text-tertiary)]">— {t('healthChecked', { time: rel })}</span> : null}
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
function formatRelative(ageMs: number, t: ReturnType<typeof useTranslations>, locale: string): string {
  // The count is written in the reader's own digits, like every other number here.
  const nf = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR')
  const min = Math.floor(ageMs / 60000)
  if (min < 1) return t('timeJustNow')
  if (min < 60) return t('timeMinutes', { n: nf.format(min) })
  const hours = Math.floor(min / 60)
  if (hours < 24) return t('timeHours', { n: nf.format(hours) })
  const days = Math.floor(hours / 24)
  return t('timeDays', { n: nf.format(days) })
}

export function MessengerChannel({
  agentId,
  agentName,
  agentWelcome,
  type,
  label,
  enabled,
  channelId,
  botUsername,
  lastInboundAt,
  healthStatus,
  healthCheckedAt,
  healthError,
  quickReplies = [],
  botAvatar,
  weekConversations = 0,
}: {
  agentId: string
  agentName: string
  /** The agent's own welcome message — what the preview answers with. */
  agentWelcome?: string | null
  type: MessengerKind
  label: string
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
  /** Conversations on this channel that had a message in the last 7 days. */
  weekConversations?: number
}) {
  const t = useTranslations('channels')
  const locale = useLocale()
  const router = useRouter()
  const fields = FIELD_SETS[type]
  const [busy, setBusy] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [reconnectOpen, setReconnectOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)
  const [replies, setReplies] = useState<string[]>(quickReplies.length ? quickReplies : [''])

  const isInstagram = type === 'INSTAGRAM'
  // Connected on paper, but the periodic check says the provider no longer
  // accepts the stored credentials — the owner has to reconnect.
  const connectionLost = enabled && healthStatus === 'down'
  const guideSteps = t.raw(`guide.${type}`) as unknown
  const steps = Array.isArray(guideSteps) ? (guideSteps as string[]) : []
  const complete = isComplete(type, values)
  const nf = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR')

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
      setReconnectOpen(false)
      router.refresh()
    } catch {
      setError(t('connectError'))
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!channelId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/channels/${channelId}`, { method: 'DELETE' })
      if (!res.ok) {
        setError(t('saveError'))
        return
      }
      setDisableOpen(false)
      router.refresh()
    } catch {
      setError(t('saveError'))
    } finally {
      setBusy(false)
    }
  }

  // Reading the clipboard needs a permission some browsers never grant; the
  // field still takes a normal paste, so a refusal is not worth a message.
  async function pasteInto(key: string) {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) setValues((v) => ({ ...v, [key]: text }))
    } catch {}
  }

  // The token field and its button: the last step of connecting, and the whole
  // of reconnecting — every connect route upserts the existing row back to active.
  const tokenForm = (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void connect()
      }}
    >
      {fields.map((f) => (
        <div key={f.key}>
          <label htmlFor={`${type}-${f.key}`} className="ui-field-label">{t(f.labelKey)}</label>
          <div className="flex items-stretch gap-1.5">
            <input
              id={`${type}-${f.key}`}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={values[f.key] ?? ''}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
                setError(null)
              }}
              placeholder={t(f.placeholderKey)}
              className={`${INPUT} min-h-11 min-w-0 flex-1 font-mono text-[13px] placeholder:font-sans`}
            />
            <button
              type="button"
              onClick={() => void pasteInto(f.key)}
              aria-label={t('paste')}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <ClipboardPaste className="h-4 w-4" />
              <span className="hidden sm:inline">{t('paste')}</span>
            </button>
          </div>
        </div>
      ))}

      {error && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}

      <Button
        type="submit"
        loading={busy}
        disabled={!complete}
        title={!complete ? t('incompleteFormHint') : undefined}
        className="w-full sm:w-auto"
      >
        {busy ? t('connecting') : t('connectConfirm')}
      </Button>
      <p className="flex items-start gap-1.5 text-xs leading-6 text-[var(--text-muted)]">
        <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0" />
        {t('tokenPrivacy')}
      </p>
    </form>
  )

  const botMaker = BOT_MAKER_URL[type]
  const connectForm = isInstagram ? (
    // Instagram uses the platform-managed OAuth flow (one click → Instagram's
    // own login → callback → channel persisted). No token pasting, no webhook
    // configuration, no Meta dashboard visit.
    // Reconnecting keeps the flow's own «back», which folds the panel away.
    <InstagramConnectFlow
      agentId={agentId}
      embedded={!enabled}
      onClose={enabled ? () => setReconnectOpen(false) : undefined}
    />
  ) : (
    <StepList
      label={t('setupGuide')}
      steps={steps.map((text, index) => ({
        text,
        extra:
          index === 0 && botMaker ? (
            <a
              href={botMaker}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('openBotFather')}
            </a>
          ) : index === steps.length - 1 ? (
            tokenForm
          ) : undefined,
      }))}
    />
  )

  const liveReplies = replies.map((item) => item.trim()).filter(Boolean)
  const stage = (
    <ChatMock
      channel={type}
      name={agentName}
      handle={enabled ? botUsername : null}
      avatar={enabled && isInstagram ? botAvatar : null}
      greeting={t('mockGreeting')}
      welcome={agentWelcome?.trim() || t('mockWelcomeFallback')}
      buttons={
        !SUPPORTS_QUICK_REPLIES[type]
          ? []
          : enabled
            ? liveReplies
            : [t('mockSampleReply1'), t('mockSampleReply2')]
      }
      botLabel={isInstagram ? t('instagram') : t('mockBot')}
      composerLabel={t('mockComposer')}
      caption={enabled ? t('mockCaptionLive', { channel: label }) : t('mockCaptionDemo', { channel: label })}
    />
  )

  const lastInboundAge = lastInboundAt ? Date.now() - new Date(lastInboundAt).getTime() : null
  const conversationsHref = `/conversations?channel=${type}&agent=${encodeURIComponent(agentId)}`

  return (
    <>
      {enabled ? (
        <ChannelLayout stage={stage} stageOnMobile={SUPPORTS_QUICK_REPLIES[type] ? 'last' : 'hidden'}>
          <div id={`channel-details-${type.toLowerCase()}`} className="space-y-6">
            {/* Which account is wired up, and whether it is still alive. */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3.5">
              {isInstagram && botAvatar && failedAvatarUrl !== botAvatar ? (
                // The connected Instagram account's own photo makes it obvious
                // which page is wired up.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={botAvatar}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailedAvatarUrl(botAvatar)}
                  className="h-12 w-12 shrink-0 rounded-2xl border border-[var(--border-default)] object-cover"
                />
              ) : (
                <ChannelMark channel={type} size="lg" />
              )}
              <div className="min-w-0 flex-1 basis-44">
                <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                  <bdi>{botUsername ? `@${botUsername}` : label}</bdi>
                </p>
                <ChannelHealthBadge type={type} status={healthStatus} checkedAt={healthCheckedAt} error={healthError} />
              </div>
              {/* Connected Instagram: the entry point to DM/comment triggers, follow-gate, etc. */}
              {isInstagram ? (
                <Link
                  href="/instagram"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] sm:flex-none"
                >
                  {t('manageAutomation')}
                  <ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" />
                </Link>
              ) : botUsername ? (
                <a
                  href={accountUrl(type, botUsername)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] sm:flex-none"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('openBot')}
                </a>
              ) : null}
            </div>

            {connectionLost && (
              <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-3.5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-danger">{t('connectionLostTitle')}</p>
                    <p className="mt-1 leading-7 text-[var(--text-secondary)]">
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
                {reconnectOpen && <div className={isInstagram ? undefined : 'mt-4'}>{isInstagram ? connectForm : tokenForm}</div>}
              </div>
            )}

            {/* Is anyone actually writing here? */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <ChannelStat label={t('statWeek')} value={nf.format(weekConversations)} />
                <ChannelStat
                  label={t('statLastInbound')}
                  value={lastInboundAge === null ? t('statNone') : formatRelative(lastInboundAge, t, locale)}
                  tone={lastInboundAge !== null && lastInboundAge > STALE_AFTER_MS ? 'danger' : undefined}
                />
              </div>
              {lastInboundAge === null ? (
                <p className="text-xs leading-6 text-[var(--text-muted)]">{t('webhookNoInbound')}</p>
              ) : (
                <Link
                  href={conversationsHref}
                  className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  {t('viewConversations')}
                  <ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" />
                </Link>
              )}
            </div>

            {/* Behavior settings for connected channels that support them. */}
            {channelId && SUPPORTS_QUICK_REPLIES[type] && (
              <QuickRepliesEditor
                agentId={agentId}
                channelId={channelId}
                type={type}
                items={replies}
                onChange={setReplies}
              />
            )}

            {error && !reconnectOpen && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
              <p className="min-w-0 flex-1 basis-56 text-xs leading-6 text-[var(--text-muted)]">{t('disableChannelBody')}</p>
              <button
                type="button"
                onClick={() => setDisableOpen(true)}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
              >
                {t('disconnect')}
              </button>
            </div>
          </div>
        </ChannelLayout>
      ) : (
        <ChannelLayout stage={stage} stageOnMobile="first">
          <div id={`channel-details-${type.toLowerCase()}`} className="space-y-5">
            {!isInstagram && <ChannelLead title={t('connectLeadTitle', { channel: label })} body={t('connectLeadBody')} />}
            {connectForm}
          </div>
        </ChannelLayout>
      )}

      <ConfirmDialog
        open={disableOpen}
        title={t('disableChannelTitle', { channel: label })}
        description={t('disableChannelBody')}
        confirmLabel={t('disconnect')}
        busy={busy}
        onConfirm={() => void disable()}
        onClose={() => {
          if (!busy) setDisableOpen(false)
        }}
      />
    </>
  )
}
