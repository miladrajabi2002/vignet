'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import type { ChatLinkStats } from '@/lib/chat-link/stats'

const STEPS = [
        { key: 'views', labelKey: 'funnelViews' },
        { key: 'conversations', labelKey: 'funnelConversations' },
        { key: 'leads', labelKey: 'funnelLeads' },
        { key: 'orders', labelKey: 'funnelOrders' },
] as const

/** «آمار» tab: the link's funnel, then the same numbers per tracking link. */
export function ChatLinkStatsPanel({ agentId }: { agentId: string }) {
        const t = useTranslations('chatLink')
        const locale = useLocale()
        const nf = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR')
        const [stats, setStats] = useState<ChatLinkStats | null>(null)
        const [failed, setFailed] = useState(false)

        useEffect(() => {
                let alive = true
                fetch(`/api/agents/${agentId}/chat-link/stats`)
                        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('stats'))))
                        .then((data) => {
                                if (alive) setStats(data.stats)
                        })
                        .catch(() => {
                                if (alive) setFailed(true)
                        })
                return () => {
                        alive = false
                }
        }, [agentId])

        if (failed) return <p role="alert" className="text-sm text-danger">{t('statsError')}</p>
        if (!stats) {
                return (
                        <div className="flex min-h-40 items-center justify-center text-[var(--text-muted)]">
                                <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                        </div>
                )
        }

        const top = Math.max(1, stats.views)
        return (
                <div className="space-y-6">
                        <section className="space-y-3">
                                <h4 className="text-xs font-semibold text-[var(--text-secondary)]">{t('funnelTitle')}</h4>
                                <ol className="space-y-2.5">
                                        {STEPS.map((step, index) => {
                                                const value = stats[step.key]
                                                const previous = index > 0 ? stats[STEPS[index - 1].key] : 0
                                                return (
                                                        <li key={step.key}>
                                                                <div className="flex items-baseline justify-between gap-3 text-sm">
                                                                        <span className="text-[var(--text-primary)]">{t(step.labelKey)}</span>
                                                                        <span className="tabular-nums">
                                                                                <b className="font-bold text-[var(--text-primary)]">{nf.format(value)}</b>
                                                                                {index > 0 && previous > 0 && (
                                                                                        <span className="ms-2 text-xs text-[var(--text-muted)]">
                                                                                                {t('funnelRate', { percent: nf.format(Math.round((value / previous) * 100)) })}
                                                                                        </span>
                                                                                )}
                                                                        </span>
                                                                </div>
                                                                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                                                                        <div
                                                                                className="h-full rounded-full bg-[var(--text-primary)]"
                                                                                style={{ width: `${Math.min(100, (value / top) * 100)}%`, opacity: 1 - index * 0.18 }}
                                                                        />
                                                                </div>
                                                        </li>
                                                )
                                        })}
                                </ol>
                                <p className="text-xs leading-6 text-[var(--text-muted)]">{t('funnelHint')}</p>
                        </section>

                        <section className="space-y-3">
                                <h4 className="text-xs font-semibold text-[var(--text-secondary)]">{t('sourcesTitle')}</h4>
                                <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
                                        <table className="w-full min-w-[22rem] text-sm">
                                                <thead>
                                                        <tr className="bg-[var(--bg-base)] text-xs text-[var(--text-secondary)]">
                                                                <th scope="col" className="px-3 py-2 text-start font-semibold">{t('sourceColumn')}</th>
                                                                <th scope="col" className="px-3 py-2 text-end font-semibold">{t('funnelViews')}</th>
                                                                <th scope="col" className="px-3 py-2 text-end font-semibold">{t('funnelConversations')}</th>
                                                                <th scope="col" className="px-3 py-2 text-end font-semibold">{t('funnelLeads')}</th>
                                                        </tr>
                                                </thead>
                                                <tbody>
                                                        {stats.sources.map((source) => (
                                                                <tr key={source.key || 'direct'} className="border-t border-[var(--border-subtle)]">
                                                                        <th scope="row" className="px-3 py-2 text-start font-medium text-[var(--text-primary)]">
                                                                                {source.key ? source.label : t('sourceDirect')}
                                                                        </th>
                                                                        <td className="px-3 py-2 text-end tabular-nums text-[var(--text-primary)]">{nf.format(source.views)}</td>
                                                                        <td className="px-3 py-2 text-end tabular-nums text-[var(--text-primary)]">{nf.format(source.conversations)}</td>
                                                                        <td className="px-3 py-2 text-end tabular-nums text-[var(--text-primary)]">{nf.format(source.leads)}</td>
                                                                </tr>
                                                        ))}
                                                </tbody>
                                        </table>
                                </div>
                                {stats.sources.length === 1 && (
                                        <p className="text-xs leading-6 text-[var(--text-muted)]">{t('sourcesEmpty')}</p>
                                )}
                        </section>
                </div>
        )
}
