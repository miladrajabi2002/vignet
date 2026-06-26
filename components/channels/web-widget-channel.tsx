'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Globe, Check, Copy, Loader2 } from 'lucide-react'

export function WebWidgetChannel({
  agentId,
  baseUrl,
  enabled,
  channelId,
}: {
  agentId: string
  baseUrl: string
  enabled: boolean
  channelId: string | null
}) {
  const t = useTranslations('channels')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const snippet = `<script src="${baseUrl}/widget/loader.js" data-agent-id="${agentId}"></script>`

  async function enable() {
    setBusy(true)
    await fetch(`/api/agents/${agentId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'WEB_WIDGET' }),
    })
    setBusy(false)
    router.refresh()
  }

  async function disable() {
    if (!channelId) return
    setBusy(true)
    await fetch(`/api/agents/${agentId}/channels/${channelId}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

  function copy() {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
          <Globe className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-[var(--text-primary)]">{t('webWidget')}</div>
          <div className="text-sm text-[var(--text-secondary)]">{t('widgetDesc')}</div>
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
            onClick={enable}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('enable')}
          </button>
        )}
      </div>

      {enabled && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">{t('embedCode')}</span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
          <pre
            dir="ltr"
            className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-primary)]"
          >
            <code>{snippet}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
