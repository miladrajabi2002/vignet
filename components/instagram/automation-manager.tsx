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
        ChevronDown,
        Camera,
        Check,
        Heart,
        type LucideIcon,
} from 'lucide-react'
import { AutomationCard } from '@/components/instagram/automation-card'
import { PageHeader } from '@/components/dashboard/page-header'
import { Switch } from '@/components/ui/switch'
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
                        <PageHeader
                                icon={Camera}
                                title={t('manager.title')}
                                subtitle={t('manager.subtitle')}
                                actions={
                                        <button
                                                type="button"
                                                onClick={() =>
                                                        router.push(
                                                                `/instagram/new?agentId=${agentId}&type=${activeTab}`,
                                                        )
                                                }
                                                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-semibold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-2"
                                        >
                                                <Plus className="h-4 w-4" />
                                                {t('manager.addScenario')}
                                        </button>
                                }
                        />

                        <section className="overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(247,247,249,0.78))] p-5 shadow-[0_18px_45px_-34px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex sm:items-center sm:gap-4">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.7)]">
                                        <Zap className="h-4 w-4" />
                                </span>
                                <div className="mt-3 min-w-0 flex-1 sm:mt-0">
                                        <p className="text-sm font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                                                {locale === 'fa' ? 'سناریوهای اتوماسیون بدون AI رایگان‌اند' : 'Non-AI automation scenarios are free'}
                                        </p>
                                        <p className="mt-1 max-w-3xl text-xs leading-6 text-[var(--text-secondary)]">
                                                {locale === 'fa'
                                                        ? 'پیام ثابت، کلیدواژه، پاسخ کامنت و چندپیامی از اعتبار کم نمی‌کنند؛ فقط حالت «پاسخ هوشمند» هزینه دارد.'
                                                        : 'Static, keyword, comment and multi-message replies use no credit; only AI reply mode is charged.'}
                                        </p>
                                </div>
                                <span className="mt-3 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.08] px-3 py-1.5 text-[10px] font-semibold text-emerald-700 sm:mt-0">
                                        <Check className="h-3.5 w-3.5" />
                                        {locale === 'fa' ? 'رایگان و نامحدود' : 'Free & unlimited'}
                                </span>
                        </section>

                        {/* Channel settings (slimmed down — replyPolicy + stopWords only) */}
                        <ChannelSettingsCard
                                settings={settings}
                                onSave={saveSettings}
                                accountUsername={accountUsername}
                        />

                        <section className="space-y-4" aria-labelledby="instagram-scenarios-title">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                                <h2 id="instagram-scenarios-title" className="text-lg font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                                                        {locale === 'fa' ? 'سناریوهای پاسخ‌گویی' : 'Reply scenarios'}
                                                </h2>
                                                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                                                        {locale === 'fa' ? 'برای هر ورودی، قوانین و پاسخ‌های مستقل بسازید.' : 'Create independent rules and replies for each entry point.'}
                                                </p>
                                        </div>
                                        <p className="text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
                                                {locale === 'fa'
                                                        ? `${automations.filter((item) => item.active).length.toLocaleString(numLocale)} سناریوی فعال از ${automations.length.toLocaleString(numLocale)}`
                                                        : `${automations.filter((item) => item.active).length.toLocaleString(numLocale)} active of ${automations.length.toLocaleString(numLocale)}`}
                                        </p>
                                </div>

                                <div className="grid grid-cols-1 gap-1.5 rounded-[1.35rem] border border-black/[0.06] bg-black/[0.035] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:grid-cols-3" role="tablist" aria-label={t('manager.tabAria')}>
                                        {TABS.map(({ key, labelKey, Icon }) => {
                                                const count = byType[key].length
                                                const activeCount = byType[key].filter((a) => a.active).length
                                                const active = key === activeTab
                                                const description = key === 'DIRECT_MESSAGE'
                                                        ? locale === 'fa' ? 'پیام‌ها و کلیدواژه‌ها' : 'Messages and keywords'
                                                        : key === 'COMMENT'
                                                                ? locale === 'fa' ? 'پاسخ و هدایت به دایرکت' : 'Replies and DM routing'
                                                                : locale === 'fa' ? 'ریپلای و واکنش استوری' : 'Story replies and reactions'
                                                return (
                                                        <button
                                                                key={key}
                                                                id={`scenario-tab-${key}`}
                                                                type="button"
                                                                role="tab"
                                                                aria-selected={active}
                                                                aria-controls={`scenario-panel-${key}`}
                                                                onClick={() => setActiveTab(key)}
                                                                className={`group flex min-h-[4.5rem] items-center gap-3 rounded-[1.05rem] px-3.5 py-3 text-start transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 ${
                                                                        active
                                                                                ? 'bg-black text-white shadow-[0_12px_28px_-18px_rgba(0,0,0,0.9)]'
                                                                                : 'text-[var(--text-secondary)] hover:bg-white/70 hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${active ? 'border-white/15 bg-white/10 text-white' : 'border-black/[0.06] bg-white/75 text-[var(--text-secondary)]'}`}>
                                                                        <Icon className="h-4 w-4" />
                                                                </span>
                                                                <span className="min-w-0 flex-1">
                                                                        <span className="flex items-center justify-between gap-2">
                                                                                <span className="text-sm font-semibold">{t(labelKey)}</span>
                                                                                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${active ? 'bg-white text-black' : 'bg-black/[0.06] text-[var(--text-secondary)]'}`}>
                                                                                        {activeCount.toLocaleString(numLocale)}
                                                                                </span>
                                                                        </span>
                                                                        <span className={`mt-0.5 block truncate text-[11px] ${active ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
                                                                                {description}{count > activeCount ? ` · ${count.toLocaleString(numLocale)}` : ''}
                                                                        </span>
                                                                </span>
                                                        </button>
                                                )
                                        })}
                                </div>

                                <div
                                        id={`scenario-panel-${activeTab}`}
                                        role="tabpanel"
                                        aria-labelledby={`scenario-tab-${activeTab}`}
                                        className="space-y-3"
                                >
                                {current.length === 0 ? (
                                        <EmptyState
                                                Icon={currentTab.Icon}
                                                text={t(currentTab.emptyKey)}
                                                onCreate={() =>
                                                        router.push(`/instagram/new?agentId=${agentId}&type=${activeTab}`)
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
                        </section>

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
        const locale = useLocale()
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
                        <div className={`flex min-h-[4.5rem] items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-white/70 p-4 shadow-[0_10px_26px_-24px_rgba(0,0,0,0.75)] ${disabled ? 'opacity-55' : ''}`}>
                                <div className="min-w-0">
                                        <p className="text-sm font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{label}</p>
                                        <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{description}</p>
                                </div>
                                <Switch
                                        checked={Boolean(draft[key])}
                                        disabled={disabled}
                                        onChange={(next) => set(key, next)}
                                        aria-label={label}
                                />
                        </div>
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

        const SETTINGS_TABS = [
                {
                        key: 'dm' as const,
                        Icon: MessageCircle,
                        label: t('manager.settingsTabDm'),
                        description: locale === 'fa' ? 'پیام‌های خصوصی' : 'Private messages',
                },
                {
                        key: 'story' as const,
                        Icon: Circle,
                        label: t('manager.settingsTabStory'),
                        description: locale === 'fa' ? 'ریپلای استوری' : 'Story replies',
                },
                {
                        key: 'comment' as const,
                        Icon: MessageSquare,
                        label: t('manager.settingsTabComment'),
                        description: locale === 'fa' ? 'کامنت و ایموجی' : 'Comments and emoji',
                },
                {
                        key: 'reaction' as const,
                        Icon: Heart,
                        label: t('manager.settingsTabReaction'),
                        description: locale === 'fa' ? 'واکنش‌های استوری' : 'Story reactions',
                },
        ]

        return (
                <section className="overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white/75 shadow-[0_22px_60px_-44px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                        <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                className="flex min-h-[4.75rem] w-full items-center justify-between gap-3 px-5 py-4 text-start transition-[background-color,transform] duration-150 hover:bg-black/[0.025] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60 sm:px-6"
                                aria-expanded={open}
                        >
                                <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.8)]">
                                                <Settings2 className="h-4 w-4" />
                                        </div>
                                        <div>
                                                <p className="text-sm font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                                                        {t('manager.settingsTitle')}
                                                        <span className="ms-2 text-[11px] font-normal text-[var(--text-muted)]">
                                                                @{accountUsername || 'vigent.bot'}
                                                        </span>
                                                </p>
                                                <p className="mt-0.5 text-[11px] leading-5 text-[var(--text-secondary)]">
                                                        {t('manager.settingsSubtitle')}
                                                </p>
                                        </div>
                                </div>
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/[0.04]">
                                        <ChevronDown className={`h-4 w-4 text-[var(--text-secondary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                                </span>
                        </button>

                        {open && (
                                <div className="space-y-5 border-t border-black/[0.05] bg-[linear-gradient(180deg,rgba(250,250,251,0.7),rgba(255,255,255,0.92))] px-5 py-5 sm:px-6 sm:py-6">
                                        <div className="grid grid-cols-2 gap-1.5 rounded-[1.2rem] border border-black/[0.05] bg-black/[0.035] p-1.5 sm:grid-cols-4" role="tablist" aria-label={t('manager.settingsTabsAria')}>
                                                {SETTINGS_TABS.map(({ key: tab, Icon, label, description }) => {
                                                        const active = settingsTab === tab
                                                        return (
                                                                <button
                                                                        key={tab}
                                                                        id={`settings-tab-${tab}`}
                                                                        type="button"
                                                                        role="tab"
                                                                        aria-selected={active}
                                                                        aria-controls={`settings-panel-${tab}`}
                                                                        onClick={() => setSettingsTab(tab)}
                                                                        className={`flex min-h-[3.75rem] items-center gap-2.5 rounded-[0.95rem] px-3 py-2.5 text-start transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 ${active ? 'bg-black text-white shadow-[0_10px_22px_-16px_rgba(0,0,0,0.9)]' : 'text-[var(--text-secondary)] hover:bg-white/75 hover:text-[var(--text-primary)]'}`}
                                                                >
                                                                        <Icon className="h-4 w-4 shrink-0" />
                                                                        <span className="min-w-0">
                                                                                <span className="block text-xs font-semibold">{label}</span>
                                                                                <span className={`mt-0.5 block truncate text-[10px] ${active ? 'text-white/55' : 'text-[var(--text-muted)]'}`}>{description}</span>
                                                                        </span>
                                                                </button>
                                                        )
                                                })}
                                        </div>
                                        <div id={`settings-panel-${settingsTab}`} role="tabpanel" aria-labelledby={`settings-tab-${settingsTab}`} className="space-y-5">
                                        {/* Reply policy — segmented control */}
                                        <div className={settingsTab === 'reaction' ? 'hidden' : 'space-y-2'}>
                                                <p className="text-xs font-semibold text-[var(--text-primary)]">
                                                        {t('manager.replyPolicyLabel')}
                                                </p>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                        {POLICIES.map(({ value, labelKey, descKey, Icon }) => {
                                                                const active = draft[policyKey] === value
                                                                return (
                                                                        <button
                                                                                key={value}
                                                                                type="button"
                                                                                onClick={() => set(policyKey, value)}
                                                                                className={`group relative flex min-h-[8.5rem] flex-col items-start gap-2 rounded-2xl border p-4 text-start transition-[border-color,background-color,box-shadow,transform] duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
                                                                                        active
                                                                                                ? 'border-black bg-white shadow-[0_16px_34px_-26px_rgba(0,0,0,0.8)]'
                                                                                                : 'border-black/[0.07] bg-white/70 hover:border-black/20 hover:bg-white'
                                                                                }`}
                                                                        >
                                                                                <div
                                                                                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                                                                                active
                                                                                                        ? 'bg-black text-white'
                                                                                                        : 'bg-black/[0.045] text-[var(--text-secondary)]'
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
                                                                                        <span className="absolute end-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-black text-white" aria-label={t('manager.activeBadge')}>
                                                                                                <Check className="h-3 w-3" />
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
                                                        <textarea id="comment-emoji-reply" value={draft.commentEmojiReplyText ?? ''} disabled={!draft.commentEmojiReplyEnabled} required={draft.commentEmojiReplyEnabled} onChange={(event) => set('commentEmojiReplyText', event.target.value || null)} placeholder={t('manager.commentEmojiPlaceholder')} className="min-h-24 w-full rounded-2xl border border-black/[0.08] bg-white p-3.5 text-sm leading-6 text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] focus:border-black/30 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] disabled:cursor-not-allowed disabled:bg-black/[0.025] disabled:opacity-50" />
                                                        {renderToggle('likeCommentAfterReply', t('manager.likeComment'), t('manager.likeCommentUnsupportedHint'), true)}
                                                </div>
                                        )}
                                        {settingsTab === 'reaction' && (
                                                <div className="space-y-3">
                                                        {renderToggle('storyReactionReplyEnabled', t('manager.storyReactionEnabled'), t('manager.storyReactionEnabledHint'))}
                                                        <label className="block text-xs font-medium text-[var(--text-secondary)]" htmlFor="story-reaction-reply">{t('manager.fixedReplyText')}</label>
                                                        <textarea id="story-reaction-reply" value={draft.storyReactionReplyText ?? ''} disabled={!draft.storyReactionReplyEnabled} required={draft.storyReactionReplyEnabled} onChange={(event) => set('storyReactionReplyText', event.target.value || null)} placeholder={t('manager.storyReactionPlaceholder')} className="min-h-24 w-full rounded-2xl border border-black/[0.08] bg-white p-3.5 text-sm leading-6 text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] focus:border-black/30 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] disabled:cursor-not-allowed disabled:bg-black/[0.025] disabled:opacity-50" />
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
                                                <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white px-3 py-2.5 shadow-[inset_0_1px_1px_rgba(0,0,0,0.025)] transition-[border-color,box-shadow] focus-within:border-black/30 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]">
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
                                        <div className="flex flex-col gap-3 border-t border-black/[0.05] pt-4 sm:flex-row sm:items-center sm:justify-between">
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
                                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-[var(--shadow-control)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                        {t('manager.saveSettings')}
                                                </button>
                                        </div>
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
        const locale = useLocale()
        return (
                <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(247,247,249,0.78))] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-12">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white shadow-[0_12px_28px_-16px_rgba(0,0,0,0.8)]">
                                <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-base font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                                {locale === 'fa' ? 'اولین سناریو را بسازید' : 'Create your first scenario'}
                        </h3>
                        <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--text-secondary)]">
                                {text}
                        </p>
                        <button
                                type="button"
                                onClick={onCreate}
                                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-[var(--shadow-control)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
                        >
                                <Plus className="h-4 w-4" />
                                {t('manager.addScenario')}
                        </button>
                </div>
        )
}
