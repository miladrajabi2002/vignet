'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2, type LucideIcon } from 'lucide-react'

export type MessengerKind = 'TELEGRAM' | 'BALE' | 'RUBIKA' | 'WHATSAPP'

export function MessengerChannel({
  agentId,
  type,
  label,
  hint,
  icon: Icon,
  enabled,
  channelId,
  botUsername,
}: {
  agentId: string
  type: MessengerKind
  label: string
  hint: string
  icon: LucideIcon
  enabled: boolean
  channelId: string | null
  botUsername: string | null
}) {
  const t = useTranslations('channels')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    if (!token.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/channels/messenger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, botToken: token.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error === 'INVALID_TOKEN' ? t('invalidToken') : t('connectError'))
        return
      }
      if (data.webhookSet === false) setError(t('webhookWarning'))
      setToken('')
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

      {!enabled && open && (
        <div className="mt-4 space-y-2">
          <label className="text-xs text-[var(--text-secondary)]">
            {t('botTokenLabel')}
          </label>
          <input
            dir="ltr"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('botTokenPlaceholder')}
            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={connect}
              disabled={busy || !token.trim()}
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
