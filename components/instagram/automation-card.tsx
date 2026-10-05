'use client'

import { AutomationReportStrip } from '@/components/instagram/automation-report'
import type { AutomationReport } from '@/lib/instagram/automation-report'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Clock, Film, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { Switch } from '@/components/ui/switch'
import { type Automation, REPLY_MODE_SHORT_LABEL_KEY } from '@/components/instagram/types'
import { igProxySrc } from '@/lib/instagram/media-proxy'

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
        // SPECIFIC_STORY stories age out after 24h — surface a live/expired
        // badge so operators immediately see which story scenarios ended.
        const storyExpired =
                automation.type === 'STORY' &&
                tr.storyScope === 'SPECIFIC_STORY' &&
                Boolean(tr.storyExpiresAt && Date.now() >= new Date(tr.storyExpiresAt).getTime())
        // Picked media thumbnails (posts + stories). Expired stories stay
        // visible here so the operator can re-activate the scenario on a
        // fresh story later via the edit form.
        const nowMs = Date.now()
        const pickedStories = (tr.mediaSnapshots ?? []).filter((s) => s.kind === 'STORY')
        const pickedPosts = (tr.mediaSnapshots ?? []).filter((s) => s.kind === 'POST')
        const storyAllExpired =
                pickedStories.length > 0 &&
                pickedStories.every(
                        (s) => !s.expiresAt || new Date(s.expiresAt).getTime() <= nowMs,
                )
        const trigger = tr.keywords.length
                ? `${tr.keywords.slice(0, 4).join(fa ? '، ' : ', ')}${tr.keywords.length > 4 ? ` +${(tr.keywords.length - 4).toLocaleString(numLocale)}` : ''}`
                : automation.type === 'STORY'
                        ? (tr.storyScope === 'ALL'
                                ? t('card.storyScopeAll')
                                : tr.storyScope === 'SPECIFIC_STORY'
                                        ? storyExpired
                                                ? t('card.storyScopeSpecificExpired')
                                                : t('card.storyScopeSpecific')
                                        : t('card.storyScopeKeyword'))
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
                                {(pickedStories.length > 0 || pickedPosts.length > 0) && (
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                {pickedStories.slice(0, 4).map((snap) => {
                                                        const live = snap.expiresAt
                                                                ? new Date(snap.expiresAt).getTime() > nowMs
                                                                : false
                                                        return (
                                                                <span
                                                                        key={snap.id}
                                                                        title={live ? 'استوری فعال' : 'استوری منقضی شده'}
                                                                        className="relative inline-block rounded-[0.55rem] p-[2px]"
                                                                        style={live ? { background: 'linear-gradient(45deg,#f58529,#dd2a7b,#8134af)' } : { background: 'var(--border-default)' }}
                                                                >
                                                                        <span className="block h-[34px] w-[20px] overflow-hidden rounded-[0.45rem] bg-[var(--bg-muted)]">
                                                                                {snap.mediaUrl ? (
                                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                                        <img
                                                                                                src={igProxySrc(snap.mediaUrl)}
                                                                                                alt=""
                                                                                                loading="lazy"
                                                                                                decoding="async"
                                                                                                referrerPolicy="no-referrer"
                                                                                                className={`h-full w-full object-cover ${live ? '' : 'opacity-50 saturate-50'}`}
                                                                                        />
                                                                                ) : (
                                                                                        <span className="grid h-full w-full place-items-center text-[var(--text-hint)]">
                                                                                                <Film aria-hidden="true" className="h-3 w-3" />
                                                                                        </span>
                                                                                )}
                                                                        </span>
                                                                        {!live && (
                                                                                <span className="absolute inset-x-0 bottom-0 rounded-b-[0.45rem] bg-black/65 px-0.5 py-px text-center text-[7px] font-bold leading-3 text-white">
                                                                                        منقضی
                                                                                </span>
                                                                        )}
                                                                </span>
                                                        )
                                                })}
                                                {pickedPosts.slice(0, 4).map((snap) => (
                                                        <span
                                                                key={snap.id}
                                                                title="پست انتخاب‌شده"
                                                                className="relative inline-block h-[34px] w-[34px] overflow-hidden rounded-[0.45rem] border border-[var(--border-subtle)] bg-[var(--bg-muted)]"
                                                        >
                                                                {snap.mediaUrl ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img
                                                                                src={igProxySrc(snap.mediaUrl)}
                                                                                alt=""
                                                                                loading="lazy"
                                                                                decoding="async"
                                                                                referrerPolicy="no-referrer"
                                                                                className="h-full w-full object-cover"
                                                                        />
                                                                ) : (
                                                                        <span className="grid h-full w-full place-items-center text-[var(--text-hint)]">
                                                                                <Film aria-hidden="true" className="h-3 w-3" />
                                                                        </span>
                                                                )}
                                                        </span>
                                                ))}
                                                {(pickedStories.length + pickedPosts.length) > 4 && (
                                                        <span className="text-[10px] font-bold text-[var(--text-muted)]">
                                                                                                +{(pickedStories.length + pickedPosts.length - 4).toLocaleString(numLocale)}
                                                                                        </span>
                                                )}
                                                {automation.type === 'STORY' && storyAllExpired && (
                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                                                                                <Clock aria-hidden="true" className="h-3 w-3" />
                                                                                                استوری منقضی — با ویرایش، استوری تازه انتخاب کنید
                                                                                        </span>
                                                )}
                                        </div>
                                )}
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
