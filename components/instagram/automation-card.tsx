'use client'

import { AutomationReportStrip } from '@/components/instagram/automation-report'
import type { AutomationReport } from '@/lib/instagram/automation-report'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { Switch } from '@/components/ui/switch'
import { type Automation, REPLY_MODE_SHORT_LABEL_KEY } from '@/components/instagram/types'

/**
 * One scenario as a list row: name, then "keywords ← how it answers", then
 * its 30-day figures. The whole text block opens the edit form; the switch is
 * the only on/off signal. Edit and delete are two plain icons on desktop and
 * fold into a ⋮ menu on phones, where the row has no room for both.
 */
export function AutomationCard({
        automation,
        agentId,
        report,
        onToggleActive,
        onDelete,
}: {
        automation: Automation
        agentId: string
        report?: AutomationReport
        onToggleActive: (next: boolean) => void
        onDelete: () => void
}) {
        const t = useTranslations('instagram')
        const locale = useLocale()
        const fa = locale === 'fa'
        const numLocale = fa ? 'fa-IR' : 'en-US'
        const [toggling, setToggling] = useState(false)
        const [menuOpen, setMenuOpen] = useState(false)
        const menuRef = useRef<HTMLDivElement>(null)
        const ac = automation.action
        const tr = automation.trigger

        useEffect(() => {
                if (!menuOpen) return
                const close = (event: MouseEvent | KeyboardEvent) => {
                        if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
                }
                document.addEventListener('mousedown', close)
                document.addEventListener('keydown', close)
                return () => {
                        document.removeEventListener('mousedown', close)
                        document.removeEventListener('keydown', close)
                }
        }, [menuOpen])

        async function toggle(next: boolean) {
                setToggling(true)
                try {
                        await onToggleActive(next)
                } finally {
                        setToggling(false)
                }
        }

        const messages = ac.messages ?? []
        const editHref = `/instagram/${automation.id}/edit?agentId=${agentId}`
        const trigger = tr.keywords.length
                ? `${tr.keywords.slice(0, 4).join(fa ? '، ' : ', ')}${tr.keywords.length > 4 ? ` +${(tr.keywords.length - 4).toLocaleString(numLocale)}` : ''}`
                : automation.type === 'STORY'
                        ? (tr.storyScope === 'ALL' ? t('card.storyScopeAll') : t('card.storyScopeKeyword'))
                        : t('card.noKeyword')
        const answer = [
                t(REPLY_MODE_SHORT_LABEL_KEY[ac.replyMode]),
                messages.length > 1 ? t('card.messagesCount', { count: messages.length }) : '',
                ac.dmOnComment ? t('card.dmToCommenter') : '',
                ac.followGate ? t('card.followGate') : '',
                automation.type === 'COMMENT' && tr.postIds.length > 0 ? t('card.postsCount', { count: tr.postIds.length }) : '',
        ].filter(Boolean).join(' · ')

        return (
                <article className="flex items-center gap-2 px-4 py-3.5 transition-colors hover:bg-black/[0.015]">
                        <Link
                                href={editHref}
                                className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                                aria-label={t('card.editScenarioAria', { name: automation.name })}
                        >
                                <h3 className={`flex min-w-0 items-center gap-2 text-[15px] font-bold leading-7 ${automation.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                                        {/* A live scenario breathes: a green dot with a soft pulse beside its name. */}
                                        {automation.active && (
                                                <span role="img" aria-label={fa ? 'فعال' : 'Live'} title={fa ? 'فعال' : 'Live'} className="relative inline-flex h-2 w-2 shrink-0">
                                                        <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
                                                        <span aria-hidden="true" className="relative h-2 w-2 rounded-full bg-emerald-500" />
                                                </span>
                                        )}
                                        <span className="min-w-0 truncate">{automation.name}</span>
                                </h3>
                                <p className="truncate text-[12px] leading-5 text-[var(--text-muted)]">
                                        <span className={automation.active ? 'text-[var(--text-primary)]' : undefined}>{trigger}</span>
                                        <span aria-hidden="true"> ← </span>
                                        {answer}
                                </p>
                                <div className="mt-0.5">
                                        <AutomationReportStrip fa={fa} report={report} />
                                </div>
                        </Link>

                        <Switch
                                checked={automation.active}
                                onChange={toggle}
                                disabled={toggling}
                                pending={toggling}
                                aria-label={t('card.toggleAria')}
                                className="m-0"
                        />
                        <div className="hidden items-center md:flex">
                                <Link
                                        href={editHref}
                                        aria-label={t('card.editScenario')}
                                        title={t('card.editScenario')}
                                        className="grid h-10 w-10 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                >
                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                </Link>
                                <button
                                        type="button"
                                        onClick={onDelete}
                                        aria-label={t('card.deleteAria')}
                                        title={t('card.deleteAria')}
                                        className="grid h-10 w-10 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                        </div>
                        <div ref={menuRef} className="relative md:hidden">
                                <button
                                        type="button"
                                        onClick={() => setMenuOpen((value) => !value)}
                                        aria-haspopup="menu"
                                        aria-expanded={menuOpen}
                                        aria-label={fa ? `گزینه‌های ${automation.name}` : `Options for ${automation.name}`}
                                        className="grid h-11 w-9 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                >
                                        <MoreVertical className="h-4 w-4" />
                                </button>
                                {menuOpen && (
                                        <div role="menu" className="absolute end-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white py-1 shadow-[var(--elev-2)]">
                                                <Link href={editHref} role="menuitem" className="flex min-h-11 items-center gap-2 px-3 text-[13px] text-[var(--text-primary)] hover:bg-black/[0.04]">
                                                        <Pencil className="h-4 w-4" />
                                                        {t('card.editScenario')}
                                                </Link>
                                                <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => { setMenuOpen(false); onDelete() }}
                                                        className="flex min-h-11 w-full items-center gap-2 border-t border-[var(--border-subtle)] px-3 text-start text-[13px] text-red-700 hover:bg-red-50"
                                                >
                                                        <Trash2 className="h-4 w-4" />
                                                        {t('card.deleteAria')}
                                                </button>
                                        </div>
                                )}
                        </div>
                </article>
        )
}
