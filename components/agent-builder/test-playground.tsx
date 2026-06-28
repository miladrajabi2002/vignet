'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VoiceRecorder } from '@/components/voice/voice-recorder'
import { SpeakButton } from '@/components/voice/audio-player'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  id?: string
  rating?: 1 | -1 | null
}

export function TestPlayground({
  agentId,
  welcomeMessage,
}: {
  agentId: string
  welcomeMessage?: string | null
}) {
  const t = useTranslations('agents.playground')

  const [messages, setMessages] = useState<Msg[]>(
    welcomeMessage ? [{ role: 'assistant', content: welcomeMessage }] : [],
  )
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conversationId = useRef<string | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setError(null)
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message: text, conversationId: conversationId.current }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        setError(data.error === 'NO_KEY' ? t('noKey') : t('error'))
        setMessages((m) => m.slice(0, -1))
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          try {
            const evt = JSON.parse(line.slice(5).trim())
            if (evt.type === 'meta') {
              conversationId.current = evt.conversationId
            } else if (evt.type === 'delta') {
              setMessages((m) => {
                const next = [...m]
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  content: next[next.length - 1].content + evt.text,
                }
                return next
              })
            } else if (evt.type === 'done' && evt.messageId) {
              setMessages((m) => {
                const next = [...m]
                next[next.length - 1] = { ...next[next.length - 1], id: evt.messageId, rating: null }
                return next
              })
            } else if (evt.type === 'error') {
              setError(t('error'))
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      setError(t('error'))
    } finally {
      setStreaming(false)
    }
  }

  async function rate(msgId: string, value: 1 | -1, idx: number) {
    setMessages((m) => {
      const next = [...m]
      next[idx] = { ...next[idx], rating: value }
      return next
    })
    await fetch(`/api/messages/${msgId}/rate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: value }),
    }).catch(() => {})
  }

  return (
    <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-[var(--text-muted)]">
            {t('empty')}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'flex items-end gap-1.5',
                m.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div className="flex flex-col gap-1">
                <div
                  className={cn(
                    'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm',
                    m.role === 'user'
                      ? 'bg-[var(--white)] text-[var(--bg-base)]'
                      : 'border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)]',
                  )}
                >
                  {m.content || (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
                  )}
                </div>
                {m.role === 'assistant' && m.id && m.content && (
                  <div className="flex items-center gap-1 ps-1">
                    <button
                      onClick={() => rate(m.id!, 1, i)}
                      className={cn(
                        'rounded p-1 transition-colors',
                        m.rating === 1
                          ? 'text-success'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                      )}
                      title={t('rateGood')}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => rate(m.id!, -1, i)}
                      className={cn(
                        'rounded p-1 transition-colors',
                        m.rating === -1
                          ? 'text-danger'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                      )}
                      title={t('rateBad')}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {m.role === 'assistant' && m.content && (
                <SpeakButton text={m.content} label={t('speak')} />
              )}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--border-default)] p-3">
        <VoiceRecorder
          vad
          disabled={streaming}
          label={t('record')}
          onTranscript={(text) =>
            setInput((prev) => (prev ? `${prev} ${text}` : text))
          }
          onError={(code) => setError(code === 'NO_KEY' ? t('noKey') : t('error'))}
        />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={t('placeholder')}
          className="input"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--white)] text-[var(--bg-base)] transition-transform hover:scale-[1.03] disabled:opacity-50"
          aria-label={t('send')}
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:rotate-180" />}
        </button>
      </div>
    </div>
  )
}
