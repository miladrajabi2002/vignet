'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
        MessageCircle,
        MessageSquare,
        Circle,
        Plus,
        Loader2,
        AlertCircle,
        Bot,
        Shield,
        Zap,
        Settings2,
        Save,
        X,
        type LucideIcon,
} from 'lucide-react'
import { AutomationCard } from '@/components/instagram/automation-card'
import { useTranslations, useLocale } from 'next-intl'
import {
        type Automation,
        type AutomationType,
        type InstagramAutomationSettings,
        type ReplyPolicy,
        DEFAULT_SETTINGS,
        REPLY_POLICY_LABEL_KEY,
        REPLY_POLICY_DESC_KEY,
} from '@/components/instagram/types'

interface TabDef {
        key: AutomationType
        labelKey: string
        Icon: LucideIcon
        emptyKey: string
}

const TABS: TabDef[] = [
        {
                key: 'DIRECT_MESSAGE',
                labelKey: 'manager.tabDm',
                Icon: MessageCircle,
                emptyKey: 'manager.emptyDm',
        },
        {
                key: 'COMMENT',
                labelKey: 'manager.tabComment',
                Icon: MessageSquare,
                emptyKey: 'manager.emptyComment',
        },
        {
                key: 'STORY',
                labelKey: 'manager.tabStory',
                Icon: Circle,
                emptyKey: 'manager.emptyStory',
        },
]

export function InstagramAutomationManager({
        agentId,
        channelId: _channelId,
        accountUsername,
        accountAvatarUrl: _accountAvatarUrl,
        initialAutomations,
        initialSettings,
        connected: _connected,
}: {
        agentId: string
        channelId: string
        accountUsername: string
        accountAvatarUrl?: string
        initialAutomations: Automation[]
        initialSettings?: InstagramAutomationSettings
        connected: boolean
}) {
        // `_connected`, `_channelId` and `_accountAvatarUrl` are part of the public
        // prop contract (the parent page mounts this manager with all of them and
        // they may be re-introduced in a future revision), but they aren't read
        // inside the component since v3 (the form is on separate routes now, which
        // receive these via the new/edit server pages). Void them to satisfy the
        // unused-vars rule.
        void _connected
        void _channelId
        void _accountAvatarUrl

        const t = useTranslations('instagram')
        const locale = useLocale()
        const numLocale = locale === 'fa' ? 'fa-IR' : 'en-US'
        const router = useRouter()
        const [automations, setAutomations] = useState<Automation[]>(initialAutomations)
        const [settings, setSettings] = useState<InstagramAutomationSettings>(
                initialSettings ?? DEFAULT_SETTINGS,
        )
        const [activeTab, setActiveTab] = useState<AutomationType>('DIRECT_MESSAGE')
        const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null)
        const [deleting, setDeleting] = useState(false)
        const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

        const byType = useMemo(() => {
                const map: Record<AutomationType, Automation[]> = {
                        DIRECT_MESSAGE: [],
                        COMMENT: [],
                        STORY: [],
                }
                for (const a of automations) map[a.type].push(a)
                return map
        }, [automations])

        const current = byType[activeTab]
        const currentTab = TABS.find((tab) => tab.key === activeTab)!

        function flash(kind: 'ok' | 'err', text: string) {
                setToast({ kind, text })
                window.setTimeout(() => setToast(null), 2600)
        }

        async function patchAutomation(id: string, patch: Partial<Automation>) {
                const res = await fetch(`/api/agents/${agentId}/instagram/automations/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(patch),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok || !data.automation) throw new Error('PATCH_FAILED')
                return data.automation as Automation
        }

        async function handleToggleActive(a: Automation, next: boolean) {
                setAutomations((arr) =>
                        arr.map((x) => (x.id === a.id ? { ...x, active: next } : x)),
                )
                try {
                        await patchAutomation(a.id, { active: next })
                } catch {
                        setAutomations((arr) =>
                                arr.map((x) => (x.id === a.id ? { ...x, active: a.active } : x)),
                        )
                        flash('err', t('manager.toggleFailToast'))
                }
        }

        async function confirmDelete() {
                if (!deleteTarget) return
                setDeleting(true)
                try {
                        const res = await fetch(
                                `/api/agents/${agentId}/instagram/automations/${deleteTarget.id}`,
                                { method: 'DELETE' },
                        )
                        if (!res.ok) throw new Error('DELETE_FAILED')
                        setAutomations((arr) => arr.filter((x) => x.id !== deleteTarget.id))
                        setDeleteTarget(null)
                        flash('ok', t('manager.deleteOkToast'))
                } catch {
                        flash('err', t('manager.deleteFailToast'))
                } finally {
                        setDeleting(false)
                }
        }

        async function saveSettings(next: InstagramAutomationSettings) {
                try {
                        // Per the v3 backend contract, the settings object is JUST:
                        //   { replyPolicy, stopWords, aiEnabled }
                        // We deliberately omit welcomeMessage / followUp* — the backend's
                        // PATCH route treats omitted fields as "skip" (preserves existing
                        // values), so this is safe.
                        const res = await fetch(`/api/agents/${agentId}/instagram/settings`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(next),
                        })
                        if (!res.ok) throw new Error('SETTINGS_FAILED')
                        setSettings(next)
                        flash('ok', t('manager.settingsOkToast'))
                } catch {
                        flash('err', t('manager.settingsFailToast'))
                        throw new Error('SETTINGS_FAILED')
                }
        }

        return (
                <div className="space-y-6">
                        {/* Page header */}
                        <header className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                        <h1 className="text-2xl font-light text-[var(--text-primary)]">
                                                {t('manager.title')}
                                        </h1>
                                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                                {t('manager.subtitle')}
                                        </p>
                                </div>
                                <div className="flex items-center gap-2">
                                        <button
                                                type="button"
                                                onClick={() =>
                                                        router.push(
                                                                `/agents/${agentId}/instagram/new?type=${activeTab}`,
                                                        )
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-all hover:opacity-90 hover:shadow-sm"
                                        >
                                                <Plus className="h-4 w-4" />
                                                {t('manager.addScenario')}
                                        </button>
                                </div>
                        </header>

                        <section className="spatial-surface flex flex-col gap-3 rounded-[1.4rem] p-4 sm:flex-row sm:items-center">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
                                        <Zap className="h-4 w-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-[var(--text-primary)]">
                                                {locale === 'fa' ? 'سناریوهای اتوماسیون بدون AI رایگان‌اند' : 'Non-AI automation scenarios are free'}
                                        </p>
                                        <p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">
                                                {locale === 'fa'
                                                        ? 'پیام ثابت، کلیدواژه، پاسخ کامنت و چندپیامی از اعتبار کم نمی‌کنند؛ فقط حالت «پاسخ هوشمند» هزینه دارد.'
                                                        : 'Static, keyword, comment and multi-message replies use no credit; only AI reply mode is charged.'}
                                        </p>
                                </div>
                                <span className="shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-[9px] font-bold text-[var(--text-primary)]">
                                        {locale === 'fa' ? 'رایگان و نامحدود' : 'Free & unlimited'}
                                </span>
                        </section>

                        {/* Channel settings (slimmed down — replyPolicy + stopWords only) */}
                        <ChannelSettingsCard
                                settings={settings}
                                onSave={saveSettings}
                                accountUsername={accountUsername}
                        />

                        {/* Sub-tabs */}
                        <nav
                                className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] px-1"
                                aria-label={t('manager.tabAria')}
                        >
                                {TABS.map(({ key, labelKey, Icon }) => {
                                        const count = byType[key].length
                                        const activeCount = byType[key].filter((a) => a.active).length
                                        const active = key === activeTab
                                        return (
                                                <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => setActiveTab(key)}
                                                        className={`relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-sm transition-colors ${
                                                                active
                                                                        ? 'text-[var(--text-primary)]'
                                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                        }`}
                                                >
                                                        <Icon className="h-4 w-4" />
                                                        {t(labelKey)}
                                                        {count > 0 && (
                                                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--bg-muted)] px-1.5 text-[11px] text-[var(--text-secondary)]">
                                                                        {activeCount.toLocaleString(numLocale)}
                                                                </span>
                                                        )}
                                                        {active && (
                                                                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--text-primary)]" />
                                                        )}
                                                </button>
                                        )
                                })}
                        </nav>

                        {/* Active tab content */}
                        <div className="space-y-3">
                                {current.length === 0 ? (
                                        <EmptyState
                                                Icon={currentTab.Icon}
                                                text={t(currentTab.emptyKey)}
                                                onCreate={() =>
                                                        router.push(`/agents/${agentId}/instagram/new?type=${activeTab}`)
                                                }
                                        />
                                ) : (
                                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                                {current.map((a) => (
                                                        <AutomationCard
                                                                key={a.id}
                                                                automation={a}
                                                                agentId={agentId}
                                                                onToggleActive={(next) => handleToggleActive(a, next)}
                                                                onDelete={() => setDeleteTarget(a)}
                                                        />
                                                ))}
                                        </div>
                                )}
                        </div>

                        {/* Delete confirm dialog */}
                        {deleteTarget && (
                                <div
                                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                                        role="dialog"
                                        aria-modal="true"
                                        aria-label={t('manager.deleteConfirmAria')}
                                >
                                        <div
                                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                                                onClick={() => !deleting && setDeleteTarget(null)}
                                                aria-hidden
                                        />
                                        <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-5 shadow-2xl">
                                                <div className="flex items-start gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--danger)]/10 text-[var(--danger)]">
                                                                <AlertCircle className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                                                                        {t('manager.deleteTitle')}
                                                                </h3>
                                                                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                                                                        {t('manager.deleteConfirmBody', { name: deleteTarget.name })}
                                                                </p>
                                                        </div>
                                                </div>
                                                <div className="mt-5 flex justify-end gap-2">
                                                        <button
                                                                type="button"
                                                                onClick={() => setDeleteTarget(null)}
                                                                disabled={deleting}
                                                                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
                                                        >
                                                                {t('manager.cancel')}
                                                        </button>
                                                        <button
                                                                type="button"
                                                                onClick={confirmDelete}
                                                                disabled={deleting}
                                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                                        >
                                                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                                                {t('manager.delete')}
                                                        </button>
                                                </div>
                                        </div>
                                </div>
                        )}

                        {/* Toast */}
                        {toast && (
                                <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
                                        <div
                                                className={`pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg ${
                                                        toast.kind === 'ok'
                                                                ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                                                                : 'bg-[var(--danger)] text-white'
                                                }`}
                                                role="status"
                                        >
                                                {toast.text}
                                        </div>
                                </div>
                        )}
                </div>
        )
}

// ── Channel settings card (v3 — slimmed down) ────────────────────────────
//   v3: only replyPolicy + stopWords. welcomeMessage + followUp* were
//   removed from the UI per the task spec (they're still stored in the
//   backend if previously set, but no longer editable here).
function ChannelSettingsCard({
        settings,
        onSave,
        accountUsername,
}: {
        settings: InstagramAutomationSettings
        onSave: (next: InstagramAutomationSettings) => Promise<void>
        accountUsername: string
}) {
        const t = useTranslations('instagram')
        const [draft, setDraft] = useState<InstagramAutomationSettings>(settings)
        const [stopWordInput, setStopWordInput] = useState('')
        const [saving, setSaving] = useState(false)
        const [open, setOpen] = useState(true)
        const [settingsTab, setSettingsTab] = useState<'dm' | 'story' | 'comment' | 'reaction'>('dm')

        const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

        function set<K extends keyof InstagramAutomationSettings>(
                k: K,
                v: InstagramAutomationSettings[K],
        ) {
                setDraft((d) => ({ ...d, [k]: v }))
        }

        function addStopWord(raw: string) {
                const pieces = raw
                        .split(/[,\n]/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                if (pieces.length === 0) return
                set('stopWords', Array.from(new Set([...draft.stopWords, ...pieces])))
                setStopWordInput('')
        }

        async function handleSave() {
                setSaving(true)
                try {
                        await onSave(draft)
                } catch {
                        // Parent reports the localized error; keep the unsaved draft intact.
                } finally {
                        setSaving(false)
                }
        }

        const policyKey: 'dmReplyPolicy' | 'storyReplyPolicy' | 'commentReplyPolicy' =
                settingsTab === 'dm'
                        ? 'dmReplyPolicy'
                        : settingsTab === 'comment'
                                ? 'commentReplyPolicy'
                                : 'storyReplyPolicy'

        function renderToggle(
                key: 'storyReactionReplyEnabled' | 'commentEmojiReplyEnabled' | 'likeDmAfterReply' |
                        'likeStoryReplyAfterReply' | 'likeStoryReactionAfterReply' | 'likeCommentAfterReply',
                label: string,
                description: string,
                disabled = false,
        ) {
                return (
                        <label className={`flex items-center justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                <span>
                                        <span className="block text-xs font-medium text-[var(--text-primary)]">{label}</span>
                                        <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">{description}</span>
                                </span>
                                <input type="checkbox" checked={Boolean(draft[key])} disabled={disabled} onChange={(event) => set(key, event.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--text-primary)]" />
                        </label>
                )
        }

        const POLICIES: { value: ReplyPolicy; labelKey: string; descKey: string; Icon: LucideIcon }[] = [
                {
                        value: 'ALL_AGENT',
                        labelKey: REPLY_POLICY_LABEL_KEY.ALL_AGENT,
                        descKey: REPLY_POLICY_DESC_KEY.ALL_AGENT,
                        Icon: Bot,
                },
                {
                        value: 'AGENT_EXCEPT_SCENARIOS',
                        labelKey: REPLY_POLICY_LABEL_KEY.AGENT_EXCEPT_SCENARIOS,
                        descKey: REPLY_POLICY_DESC_KEY.AGENT_EXCEPT_SCENARIOS,
                        Icon: Shield,
                },
                {
                        value: 'AUTOMATION_ONLY',
                        labelKey: REPLY_POLICY_LABEL_KEY.AUTOMATION_ONLY,
                        descKey: REPLY_POLICY_DESC_KEY.AUTOMATION_ONLY,
                        Icon: Zap,
                },
        ]

        return (
                <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
                        <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition-colors hover:bg-[var(--bg-hover)]"
                                aria-expanded={open}
                        >
                                <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)]">
                                                <Settings2 className="h-4 w-4" />
                                        </div>
                                        <div>
                                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                                        {t('manager.settingsTitle')}
                                                        <span className="ms-2 text-[11px] font-normal text-[var(--text-muted)]">
                                                                @{accountUsername || 'vigent.bot'}
                                                        </span>
                                                </p>
                                                <p className="text-[11px] text-[var(--text-secondary)]">
                                                        {t('manager.settingsSubtitle')}
                                                </p>
                                        </div>
                                </div>
                                <span className="text-[var(--text-muted)]">{open ? '−' : '+'}</span>
                        </button>

                        {open && (
                                <div className="space-y-5 border-t border-[var(--border-subtle)] px-5 py-5">
                                        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]" role="group" aria-label={t('manager.settingsTabsAria')}>
                                                {(['dm', 'story', 'comment', 'reaction'] as const).map((tab) => {
                                                        const labelKey = `manager.settingsTab${tab[0].toUpperCase()}${tab.slice(1)}`
                                                        return (
                                                                <button key={tab} type="button" aria-pressed={settingsTab === tab} onClick={() => setSettingsTab(tab)} className={`shrink-0 border-b-2 px-3 py-2 text-xs ${settingsTab === tab ? 'border-[var(--text-primary)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'}`}>
                                                                        {t(labelKey)}
                                                                </button>
                                                        )
                                                })}
                                        </div>
                                        {/* Reply policy — segmented control */}
                                        <div className={settingsTab === 'reaction' ? 'hidden' : 'space-y-2'}>
                                                <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                        {t('manager.replyPolicyLabel')}
                                                </label>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                        {POLICIES.map(({ value, labelKey, descKey, Icon }) => {
                                                                const active = draft[policyKey] === value
                                                                return (
                                                                        <button
                                                                                key={value}
                                                                                type="button"
                                                                                onClick={() => set(policyKey, value)}
                                                                                className={`group flex flex-col items-start gap-2 rounded-xl border p-3 text-start transition-all ${
                                                                                        active
                                                                                                ? 'border-[var(--text-primary)] bg-[var(--bg-base)] shadow-sm'
                                                                                                : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-hover)]'
                                                                                }`}
                                                                        >
                                                                                <div
                                                                                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                                                                                active
                                                                                                        ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                                                                                                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                                                                                        }`}
                                                                                >
                                                                                        <Icon className="h-4 w-4" />
                                                                                </div>
                                                                                <div>
                                                                                        <p className="text-xs font-medium text-[var(--text-primary)]">{t(labelKey)}</p>
                                                                                        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                                                                                {t(descKey)}
                                                                                        </p>
                                                                                </div>
                                                                                {active && (
                                                                                        <span className="text-[10px] font-medium text-[var(--text-primary)]">
                                                                                                {t('manager.activeBadge')}
                                                                                        </span>
                                                                                )}
                                                                        </button>
                                                                )
                                                        })}
                                                </div>
                                        </div>

                                        {settingsTab === 'comment' && (
                                                <div className="space-y-3">
                                                        {renderToggle('commentEmojiReplyEnabled', t('manager.commentEmojiEnabled'), t('manager.commentEmojiEnabledHint'))}
                                                        <label className="block text-xs font-medium text-[var(--text-secondary)]" htmlFor="comment-emoji-reply">{t('manager.fixedReplyText')}</label>
                                                        <textarea id="comment-emoji-reply" value={draft.commentEmojiReplyText ?? ''} disabled={!draft.commentEmojiReplyEnabled} required={draft.commentEmojiReplyEnabled} onChange={(event) => set('commentEmojiReplyText', event.target.value || null)} placeholder={t('manager.commentEmojiPlaceholder')} className="min-h-24 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-primary)] outline-none disabled:opacity-50" />
                                                        {renderToggle('likeCommentAfterReply', t('manager.likeComment'), t('manager.likeCommentUnsupportedHint'), true)}
                                                </div>
                                        )}
                                        {settingsTab === 'reaction' && (
                                                <div className="space-y-3">
                                                        {renderToggle('storyReactionReplyEnabled', t('manager.storyReactionEnabled'), t('manager.storyReactionEnabledHint'))}
                                                        <label className="block text-xs font-medium text-[var(--text-secondary)]" htmlFor="story-reaction-reply">{t('manager.fixedReplyText')}</label>
                                                        <textarea id="story-reaction-reply" value={draft.storyReactionReplyText ?? ''} disabled={!draft.storyReactionReplyEnabled} required={draft.storyReactionReplyEnabled} onChange={(event) => set('storyReactionReplyText', event.target.value || null)} placeholder={t('manager.storyReactionPlaceholder')} className="min-h-24 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-primary)] outline-none disabled:opacity-50" />
                                                        {renderToggle('likeStoryReactionAfterReply', t('manager.likeStoryReaction'), t('manager.likeAfterReplyHint'))}
                                                </div>
                                        )}
                                        {settingsTab === 'dm' && renderToggle('likeDmAfterReply', t('manager.likeDm'), t('manager.likeAfterReplyHint'))}
                                        {settingsTab === 'story' && renderToggle('likeStoryReplyAfterReply', t('manager.likeStoryReply'), t('manager.likeAfterReplyHint'))}

                                        {/* Stop words */}
                                        <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                        {t('manager.stopWordsLabel')}
                                                </label>
                                                <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-2 focus-within:border-[var(--border-strong)]">
                                                        {draft.stopWords.map((k) => (
                                                                <span
                                                                        key={k}
                                                                        className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-primary)]"
                                                                >
                                                                        {k}
                                                                        <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                        set(
                                                                                                'stopWords',
                                                                                                draft.stopWords.filter((x) => x !== k),
                                                                                        )
                                                                                }
                                                                                className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                                                                                aria-label={t('manager.stopWordsDeleteAria', { word: k })}
                                                                        >
                                                                                <X className="h-3 w-3" />
                                                                        </button>
                                                                </span>
                                                        ))}
                                                        <input
                                                                value={stopWordInput}
                                                                onChange={(e) => setStopWordInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' || e.key === ',') {
                                                                                e.preventDefault()
                                                                                addStopWord(stopWordInput)
                                                                        } else if (
                                                                                e.key === 'Backspace' &&
                                                                                stopWordInput === '' &&
                                                                                draft.stopWords.length > 0
                                                                        ) {
                                                                                set('stopWords', draft.stopWords.slice(0, -1))
                                                                        }
                                                                }}
                                                                onBlur={() => addStopWord(stopWordInput)}
                                                                placeholder={draft.stopWords.length ? '' : t('manager.stopWordsPlaceholder')}
                                                                className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)]"
                                                        />
                                                </div>
                                                <p className="text-[11px] text-[var(--text-muted)]">
                                                        {t('manager.stopWordsHint')}
                                                </p>
                                        </div>

                                        {/* Save bar */}
                                        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
                                                <p className="text-[11px] text-[var(--text-muted)]">
                                                        {dirty
                                                                ? t('manager.dirtyHint')
                                                                : settingsTab === 'reaction'
                                                                        ? t('manager.settingsSavedHint')
                                                                        : t('manager.currentPolicyHint', {
                                                                                policy: t(REPLY_POLICY_LABEL_KEY[draft[policyKey]]),
                                                                        })}
                                                </p>
                                                <button
                                                        type="button"
                                                        onClick={handleSave}
                                                        disabled={!dirty || saving || (draft.storyReactionReplyEnabled && !draft.storyReactionReplyText?.trim()) || (draft.commentEmojiReplyEnabled && !draft.commentEmojiReplyText?.trim())}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-40"
                                                >
                                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                        {t('manager.saveSettings')}
                                                </button>
                                        </div>
                                </div>
                        )}
                </section>
        )
}

// ── Empty state ─────────────────────────────────────────────────────────
function EmptyState({
        Icon,
        text,
        onCreate,
}: {
        Icon: LucideIcon
        text: string
        onCreate: () => void
}) {
        const t = useTranslations('instagram')
        return (
                <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center sm:p-12">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-muted)]">
                                <Icon className="h-5 w-5" />
                        </div>
                        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                                {text}
                        </p>
                        <button
                                type="button"
                                onClick={onCreate}
                                className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                        >
                                <Plus className="h-4 w-4" />
                                {t('manager.addScenario')}
                        </button>
                </div>
        )
}
