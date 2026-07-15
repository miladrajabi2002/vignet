'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
        MessageCircle,
        MessageSquare,
        Circle,
        Pencil,
        Trash2,
        Loader2,
        Bot,
        Send,
        Shield,
        Zap,
        Volume2,
        ImageIcon,
        Tag,
        KeyRound,
        ChevronLeft,
        type LucideIcon,
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { Switch } from '@/components/ui/switch'
import {
        type Automation,
        type AutomationType,
        type ReplyMode,
        type MessageType,
        REPLY_MODE_SHORT_LABEL_KEY,
} from '@/components/instagram/types'

const TYPE_ICON: Record<AutomationType, LucideIcon> = {
        DIRECT_MESSAGE: MessageCircle,
        COMMENT: MessageSquare,
        STORY: Circle,
}

const REPLY_MODE_ICON: Record<ReplyMode, LucideIcon> = {
        STATIC: MessageCircle,
        AI: Bot,
        SILENT: Circle,
        STOP_AI: Zap,
        MULTI_MESSAGE: MessageSquare,
}

const MESSAGE_TYPE_ICON: Record<MessageType, LucideIcon> = {
        TEXT: MessageCircle,
        IMAGE: ImageIcon,
        AUDIO: Volume2,
        VIDEO: ImageIcon,
        QUICK_REPLY: KeyRound,
        PRODUCT: Tag,
}

/**
 * AutomationCard — premium card for a single Instagram automation scenario.
 *
 * v3 changes:
 *  - The whole card is now a clickable surface that navigates to the full-page
 *    edit form (`/agents/{agentId}/instagram/{id}/edit`). The edit pencil
 *    button is kept as a visual affordance but also navigates (no modal).
 *  - The active Switch + delete button remain as inline action chips on the
 *    trailing edge (separate from the navigation).
 */
export function AutomationCard({
        automation,
        agentId,
        onToggleActive,
        onDelete,
}: {
        automation: Automation
        agentId: string
        onToggleActive: (next: boolean) => void
        onDelete: () => void
}) {
        const t = useTranslations('instagram')
        const locale = useLocale()
        const numLocale = locale === 'fa' ? 'fa-IR' : 'en-US'
        const [toggling, setToggling] = useState(false)
        const Icon = TYPE_ICON[automation.type]
        const ac = automation.action
        const tr = automation.trigger
        const ReplyIcon = REPLY_MODE_ICON[ac.replyMode] ?? Bot

        async function toggle(next: boolean) {
                setToggling(true)
                try {
                        await onToggleActive(next)
                } finally {
                        setToggling(false)
                }
        }

        const messages = ac.messages ?? []
        const hasMedia = messages.some(
                (m) =>
                        m.type === 'IMAGE' ||
                        m.type === 'AUDIO' ||
                        m.type === 'VIDEO' ||
                        m.type === 'PRODUCT' ||
                        m.type === 'QUICK_REPLY',
        )
        const messageTypes = new Set(messages.map((m) => m.type))
        const editHref = `/instagram/${automation.id}/edit?agentId=${agentId}`

        return (
                <article className="group relative overflow-hidden rounded-[1.35rem] border border-black/[0.07] bg-white/80 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_24px_54px_-38px_rgba(0,0,0,0.72)] motion-reduce:transform-none">
                        {/* A restrained Instagram accent keeps brand context without competing with content. */}
                        <div
                                className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-55 transition-opacity duration-200 group-hover:opacity-100"
                                style={{ background: 'linear-gradient(90deg, #f58529, #dd2a7b, #8134af)' }}
                                aria-hidden
                        />

                        <Link
                                href={editHref}
                                className="flex min-h-[9.5rem] items-start gap-3.5 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/65 sm:p-5"
                                aria-label={t('card.editScenarioAria', { name: automation.name })}
                        >
                                <div
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.85)]"
                                >
                                        <Icon className="h-4 w-4" />
                                </div>

                                <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                                                        {automation.name}
                                                </h3>
                                                <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                                                automation.active
                                                                        ? 'border border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-700'
                                                                        : 'border border-black/[0.05] bg-black/[0.035] text-[var(--text-muted)]'
                                                        }`}
                                                >
                                                        <span
                                                                className={`h-1.5 w-1.5 rounded-full ${
                                                                        automation.active ? 'bg-success' : 'bg-[var(--text-muted)]'
                                                                }`}
                                                        />
                                                        {automation.active ? t('card.active') : t('card.inactive')}
                                                </span>
                                        </div>

                                        {/* Keywords */}
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                {tr.keywords.length === 0 ? (
                                                        <span className="text-[11px] text-[var(--text-muted)]">
                                                                {t('card.noKeyword')}
                                                        </span>
                                                ) : (
                                                        tr.keywords.slice(0, 6).map((k) => (
                                                                <span
                                                                        key={k}
                                                                        className="inline-flex items-center rounded-lg border border-black/[0.06] bg-black/[0.025] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]"
                                                                >
                                                                        {k}
                                                                </span>
                                                        ))
                                                )}
                                                {tr.keywords.length > 6 && (
                                                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                                                                +{(tr.keywords.length - 6).toLocaleString(numLocale)}
                                                        </span>
                                                )}
                                        </div>

                                        {/* Meta row */}
                                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                                                <span className="inline-flex items-center gap-1">
                                                        <ReplyIcon className="h-3 w-3" />
                                                        {t(REPLY_MODE_SHORT_LABEL_KEY[ac.replyMode])}
                                                </span>
                                                {hasMedia && (
                                                        <span className="inline-flex items-center gap-1">
                                                                {(Array.from(messageTypes) as MessageType[]).slice(0, 3).map((mt) => {
                                                                        const MIcon = MESSAGE_TYPE_ICON[mt]
                                                                        return <MIcon key={mt} className="h-3 w-3" />
                                                                })}
                                                                {messages.length > 1 &&
                                                                        t('card.messagesCount', { count: messages.length })}
                                                        </span>
                                                )}
                                                {ac.dmOnComment && (
                                                        <span className="inline-flex items-center gap-1">
                                                                <Send className="h-3 w-3" />
                                                                {t('card.dmToCommenter')}
                                                        </span>
                                                )}
                                                {ac.followGate && (
                                                        <span className="inline-flex items-center gap-1">
                                                                <Shield className="h-3 w-3" />
                                                                {t('card.followGate')}
                                                        </span>
                                                )}
                                                {automation.type === 'STORY' && (
                                                        <span>
                                                                {tr.storyScope === 'ALL'
                                                                        ? t('card.storyScopeAll')
                                                                        : t('card.storyScopeKeyword')}
                                                        </span>
                                                )}
                                                {automation.type === 'COMMENT' && tr.postIds.length > 0 && (
                                                        <span>{t('card.postsCount', { count: tr.postIds.length })}</span>
                                                )}
                                                {automation.type === 'COMMENT' && tr.postIds.length === 0 && (
                                                        <span>{t('card.allPosts')}</span>
                                                )}
                                        </div>

                                        {/* Edit affordance */}
                                        <div className="mt-4 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-black/[0.035] px-2.5 text-[11px] font-semibold text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 group-hover:bg-black group-hover:text-white group-active:scale-[0.98]">
                                                <Pencil className="h-3 w-3" />
                                                {t('card.editScenario')}
                                                <ChevronLeft className="h-3 w-3 rtl:rotate-180" />
                                        </div>
                                </div>
                        </Link>

                        {/* Actions — kept OUTSIDE the Link so they don't trigger navigation */}
                        <div className="flex min-h-14 items-center justify-between gap-3 border-t border-black/[0.05] bg-black/[0.012] px-4 py-2.5 sm:px-5">
                                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
                                        {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${automation.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />}
                                        {automation.active ? t('card.active') : t('card.inactive')}
                                </span>
                                <div className="flex items-center gap-2">
                                        <Switch
                                                checked={automation.active}
                                                onChange={toggle}
                                                disabled={toggling}
                                                aria-label={t('card.toggleAria')}
                                        />
                                        <button
                                                type="button"
                                                onClick={onDelete}
                                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 hover:bg-red-500/[0.08] hover:text-red-600 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                                                aria-label={t('card.deleteAria')}
                                        >
                                                <Trash2 className="h-4 w-4" />
                                        </button>
                                </div>
                        </div>
                </article>
        )
}
