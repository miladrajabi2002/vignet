'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
        Send,
        Loader2,
        Check,
        Trash2,
        AlertCircle,
        CheckCircle2,
        ExternalLink,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'

/**
 * OperatorChannelSetup (F3) — settings card that lets the workspace owner
 * connect their operator Telegram bot. The owner creates a Telegram bot via
 * @BotFather, drops the token + their own chat id (from @userinfobot) here,
 * and we register the webhook + send a test message so they can confirm.
 *
 * Server passes the current OperatorChannel (already masked) — this component
 * owns the interactive bits (save / test / delete / toggle active).
 */

export interface OperatorChannelInfo {
        id: string
        botUsername: string | null
        operatorChatId: string | null
        active: boolean
        lastError: string | null
        botTokenMasked: string | null
}

export function OperatorChannelSetup({
        current,
}: {
        current: OperatorChannelInfo | null
}) {
        const t = useTranslations('operatorChannel')
        const fa = useLocale() !== 'en'
        const router = useRouter()

        const [botToken, setBotToken] = useState('')
        const [operatorChatId, setOperatorChatId] = useState(
                current?.operatorChatId ?? '',
        )
        const [active, setActive] = useState(current?.active ?? true)
        const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>(
                'idle',
        )
        const [errorMsg, setErrorMsg] = useState<string | null>(null)
        const [info, setInfo] = useState<OperatorChannelInfo | null>(current)
        const [testing, setTesting] = useState(false)
        const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)

        async function save() {
                if (!botToken.trim() || status === 'saving') return
                setStatus('saving')
                setErrorMsg(null)
                try {
                        const res = await fetch('/api/operator-channel', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        botToken: botToken.trim(),
                                        operatorChatId: operatorChatId.trim() || undefined,
                                        active,
                                }),
                        })
                        const data = (await res.json()) as {
                                operatorChannel?: OperatorChannelInfo
                                error?: string
                        }
                        if (!res.ok || !data.operatorChannel) {
                                setStatus('error')
                                setErrorMsg(
                                        data.error === 'INVALID_TOKEN'
                                                ? t('invalidToken')
                                                : data.error ?? t('saveFailed'),
                                )
                                return
                        }
                        setInfo(data.operatorChannel)
                        setBotToken('')
                        setStatus('ok')
                        router.refresh()
                } catch {
                        setStatus('error')
                        setErrorMsg(t('saveFailed'))
                }
        }

        async function toggleActive() {
                if (!info) return
                const next = !active
                setActive(next)
                try {
                        await fetch('/api/operator-channel', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ active: next }),
                        })
                        router.refresh()
                } catch {
                        // Roll back on failure.
                        setActive(!next)
                }
        }

        async function test() {
                if (testing || !info) return
                setTesting(true)
                setTestResult(null)
                try {
                        const res = await fetch('/api/operator-channel/test', {
                                method: 'POST',
                        })
                        setTestResult(res.ok ? 'ok' : 'error')
                        if (res.ok) router.refresh()
                } catch {
                        setTestResult('error')
                } finally {
                        setTesting(false)
                }
        }

        async function remove() {
                if (!info) return
                setStatus('saving')
                try {
                        const res = await fetch('/api/operator-channel', { method: 'DELETE' })
                        if (res.ok) {
                                setInfo(null)
                                setStatus('idle')
                                setBotToken('')
                                setOperatorChatId('')
                                setActive(true)
                                router.refresh()
                        } else {
                                setStatus('error')
                        }
                } catch {
                        setStatus('error')
                }
        }

        return (
                <section id="telegram-operator" className="spatial-surface scroll-mt-28 overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
                        <div className="mb-3 flex items-center gap-3">
                                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]"><Send className="h-5 w-5" /></span>
                                <div>
                                <h2 className="text-lg font-medium text-[var(--text-primary)]">
                                        {t('title')}
                                </h2>
                                <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{fa ? 'هشدارها و تحویل اپراتور در تلگرام' : 'Alerts and operator handoff in Telegram'}</p>
                                </div>
                        </div>
                        <p className="mb-5 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                                {t('desc')}
                        </p>

                        {info ? (
                                <div className="mb-5 space-y-3">
                                        <div className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
                                                <div className="flex items-center gap-2 text-sm">
                                                        <CheckCircle2 className="h-4 w-4 text-[var(--green)]" />
                                                        <span className="text-[var(--text-secondary)]">@</span>
                                                        <span className="font-mono text-[var(--text-primary)]">
                                                                {info.botUsername ?? '—'}
                                                        </span>
                                                </div>
                                                <span className="text-xs text-[var(--green)]">{t('connected')}</span>
                                        </div>
                                        {info.operatorChatId && (
                                                <div className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-sm">
                                                        <span className="text-[var(--text-secondary)]">
                                                                {t('operatorChatId')}
                                                        </span>
                                                        <span dir="ltr" className="font-mono text-[var(--text-primary)]">
                                                                {info.operatorChatId}
                                                        </span>
                                                </div>
                                        )}
                                        <div className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-sm">
                                                <span
                                                        className={active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}
                                                >
                                                        {t('active')}
                                                </span>
                                                <Switch
                                                        checked={active}
                                                        onChange={toggleActive}
                                                        aria-label={t('active')}
                                                />
                                        </div>
                                        {info.lastError && (
                                                <div className="flex items-start gap-2 rounded-xl border border-[var(--amber)] bg-[var(--white-05)] px-4 py-3 text-xs text-[var(--text-secondary)]">
                                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--amber)]" />
                                                        <div>
                                                                <div className="font-medium text-[var(--text-primary)]">
                                                                        {t('lastError')}
                                                                </div>
                                                                <div className="mt-0.5 break-words" dir="auto">
                                                                        {info.lastError}
                                                                </div>
                                                        </div>
                                                </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                        onClick={test}
                                                        disabled={testing}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] disabled:opacity-50"
                                                >
                                                        {testing ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                                <Send className="h-3.5 w-3.5" />
                                                        )}
                                                        {t('test')}
                                                </button>
                                                <button
                                                        onClick={remove}
                                                        disabled={status === 'saving'}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                                                >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        {t('remove')}
                                                </button>
                                                {testResult === 'ok' && (
                                                        <span className="inline-flex items-center gap-1 text-xs text-[var(--green)]">
                                                                <Check className="h-3.5 w-3.5" /> {t('connected')}
                                                        </span>
                                                )}
                                                {testResult === 'error' && (
                                                        <span className="inline-flex items-center gap-1 text-xs text-danger">
                                                                <AlertCircle className="h-3.5 w-3.5" /> {t('notConnected')}
                                                        </span>
                                                )}
                                        </div>
                                </div>
                        ) : (
                                <div className="mb-5 space-y-3">
                                        <div>
                                                <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                                                        {t('botToken')}
                                                </label>
                                                <input
                                                        dir="ltr"
                                                        type="password"
                                                        value={botToken}
                                                        onChange={(e) => {
                                                                setBotToken(e.target.value)
                                                                setStatus('idle')
                                                                setErrorMsg(null)
                                                        }}
                                                        placeholder="1234567890:AA…"
                                                className="input w-full font-mono text-sm"
                                                />
                                                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                                        {t('helpToken')}{' '}
                                                        <a
                                                                href="https://t.me/BotFather"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-0.5 text-[var(--text-secondary)] underline"
                                                        >
                                                                @BotFather <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                </p>
                                        </div>
                                        <div>
                                                <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                                                        {t('operatorChatId')}
                                                </label>
                                                <input
                                                        dir="ltr"
                                                        type="text"
                                                        value={operatorChatId}
                                                        onChange={(e) => setOperatorChatId(e.target.value)}
                                                        placeholder="123456789"
                                                className="input w-full font-mono text-sm"
                                                />
                                                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                                        {t('helpChatId')}{' '}
                                                        <a
                                                                href="https://t.me/userinfobot"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-0.5 text-[var(--text-secondary)] underline"
                                                        >
                                                                @userinfobot <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                </p>
                                        </div>
                                </div>
                        )}

                        {!info && (
                                <button
                                        onClick={save}
                                        disabled={status === 'saving' || !botToken.trim()}
                                        className="spatial-press inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-black px-5 text-sm font-medium text-white shadow-[var(--shadow-control)] disabled:opacity-50"
                                >
                                        {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {status === 'saving' ? t('connecting') : t('connect')}
                                </button>
                        )}

                        {status === 'ok' && (
                                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--green)]">
                                        <Check className="h-4 w-4" />
                                        {t('connected')}
                                </p>
                        )}
                        {status === 'error' && (
                                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-danger">
                                        <AlertCircle className="h-4 w-4" />
                                        {errorMsg ?? t('notConnected')}
                                </p>
                        )}
                </section>
        )
}
