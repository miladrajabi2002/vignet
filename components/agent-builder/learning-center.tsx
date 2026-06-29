'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Sparkles, Check, X, Loader2, GraduationCap, MessageSquare } from 'lucide-react'

export interface LearningItem {
  id: string
  question: string
  conversationId: string
}

export function LearningCenter({
  agentId,
  initial,
}: {
  agentId: string
  initial: LearningItem[]
}) {
  const t = useTranslations('learning')
  const [items, setItems] = useState(initial)

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
        <GraduationCap className="h-8 w-8 text-[var(--text-muted)]" />
        <p className="mt-4 text-sm text-[var(--text-primary)]">{t('empty')}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('emptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <LearningCard
          key={item.id}
          agentId={agentId}
          item={item}
          onResolved={() => remove(item.id)}
        />
      ))}
    </div>
  )
}

function LearningCard({
  agentId,
  item,
  onResolved,
}: {
  agentId: string
  item: LearningItem
  onResolved: () => void
}) {
  const t = useTranslations('learning')
  const [answer, setAnswer] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function suggest() {
    setSuggesting(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/learning/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: item.question }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error === 'NO_KEY' ? t('noKey') : t('error'))
        return
      }
      setAnswer(data.answer ?? '')
    } catch {
      setError(t('error'))
    } finally {
      setSuggesting(false)
    }
  }

  async function approve() {
    if (!answer.trim() || approving) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/learning/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: item.id, question: item.question, answer: answer.trim() }),
      })
      if (!res.ok) {
        setError(t('error'))
        return
      }
      onResolved()
    } catch {
      setError(t('error'))
    } finally {
      setApproving(false)
    }
  }

  async function dismiss() {
    try {
      await fetch(`/api/agents/${agentId}/learning`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: item.id }),
      })
    } catch {
      /* optimistic — remove regardless */
    }
    onResolved()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs text-[var(--text-secondary)]">{t('question')}</span>
          <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">
            {item.question}
          </p>
        </div>
        <Link
          href={`/conversations/${item.conversationId}`}
          title={t('viewConversation')}
          className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <MessageSquare className="h-4 w-4" />
        </Link>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder={t('answerPlaceholder')}
        className="w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
      />

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={suggest}
          disabled={suggesting}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {suggesting ? t('suggesting') : t('suggest')}
        </button>

        <button
          onClick={approve}
          disabled={approving || !answer.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--white)] px-3 py-1.5 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
        >
          {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {approving ? t('approving') : t('approve')}
        </button>

        <button
          onClick={dismiss}
          className="ms-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-danger"
        >
          <X className="h-4 w-4" />
          {t('dismiss')}
        </button>
      </div>
    </div>
  )
}
