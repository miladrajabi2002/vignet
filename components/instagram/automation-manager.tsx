'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    MessageCircle,
    MessageSquare,
    Circle,
    Plus,
    Loader2,
    Settings2,
    ChevronDown,
    Camera,
    type LucideIcon,
} from 'lucide-react'
import { AutomationCard } from '@/components/instagram/automation-card'
import { AutomationsReportSummary } from '@/components/instagram/automation-report'
import type { AutomationReportMap } from '@/lib/instagram/automation-report'
import { InstagramScenarioDemo } from '@/components/instagram/scenario-demo'
import type { InstagramDemoMode } from '@/components/marketing/home-variants/shared/mocks'
import { PageHeader } from '@/components/dashboard/page-header'
import { Switch } from '@/components/ui/switch'
import { TagInput } from '@/components/ui/tag-input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTranslations, useLocale } from 'next-intl'
import {
        type Automation,
        type AutomationType,
        type InstagramAutomationSettings,
        type ReplyPolicy,
        DEFAULT_SETTINGS,
        REPLY_POLICY_LABEL_KEY,
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
        accountUsername,
        initialAutomations,
        initialSettings,
        reports = {},
}: {
        agentId: string
        accountUsername: string
        initialAutomations: Automation[]
        initialSettings?: InstagramAutomationSettings
        /** 30-day results per automation (people reached, chats, orders…). */
        reports?: AutomationReportMap
}) {
        const t = useTranslations('instagram')
        const locale = useLocale()
        const numLocale = locale === 'fa' ? 'fa-IR' : 'en-US'
        const subscriptionRequired = locale === 'fa'
                ? 'برای استفاده از اتوماسیون اینستاگرام، دورهٔ آزمایشی یا اشتراک فعال لازم است.'
                : 'An active trial or subscription is required for Instagram automation.'
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
                if (!res.ok || !data.automation) {
                        throw new Error(data.error === 'PLAN_BLOCKED' ? 'PLAN_BLOCKED' : 'PATCH_FAILED')
                }
                return data.automation as Automation
        }

        async function handleToggleActive(a: Automation, next: boolean) {
                setAutomations((arr) =>
                        arr.map((x) => (x.id === a.id ? { ...x, active: next } : x)),
                )
                try {
                        await patchAutomation(a.id, { active: next })
                } catch (error) {
                        setAutomations((arr) =>
                                arr.map((x) => (x.id === a.id ? { ...x, active: a.active } : x)),
                        )
                        flash('err', error instanceof Error && error.message === 'PLAN_BLOCKED'
                                ? subscriptionRequired
                                : t('manager.toggleFailToast'))
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
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(data.error === 'PLAN_BLOCKED' ? 'PLAN_BLOCKED' : 'SETTINGS_FAILED')
                        setSettings(next)
                        flash('ok', t('manager.settingsOkToast'))
                } catch (error) {
                        flash('err', error instanceof Error && error.message === 'PLAN_BLOCKED'
                                ? subscriptionRequired
                                : t('manager.settingsFailToast'))
                        throw new Error('SETTINGS_FAILED')
                }
        }

        const fa = locale === 'fa'
        const newHref = `/instagram/new?agentId=${agentId}&type=${activeTab}`
        const activeTotal = automations.filter((item) => item.active).length
        const settingsPanel = (
                <ChannelSettingsRail
                        settings={settings}
                        onSave={saveSettings}
                        entry={activeTab}
                />
        )

        return (
                <div className="space-y-4">
                        <PageHeader
                                icon={Camera}
                                title={fa ? 'اینستاگرام' : 'Instagram'}
                                subtitle={(
                                        // The handle is Latin and the count Persian: each gets its own
                                        // direction so the bidi algorithm cannot shuffle the "@" and dot.
                                        <span className="inline-flex flex-wrap items-center gap-x-1.5">
                                                <bdi dir="ltr">@{accountUsername || 'vigent.bot'}</bdi>
                                                <span aria-hidden="true">·</span>
                                                <span>
                                                        {fa
                                                                ? `${activeTotal.toLocaleString(numLocale)} از ${automations.length.toLocaleString(numLocale)} سناریو فعال`
                                                                : `${activeTotal} of ${automations.length} scenarios active`}
                                                </span>
                                        </span>
                                )}
                                actions={(
                                        <button
                                                type="button"
                                                onClick={() => router.push(newHref)}
                                                className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white shadow-[var(--shadow-control)]"
                                        >
                                                <Plus className="h-4 w-4" />
                                                {fa ? 'سناریوی جدید' : 'New scenario'}
                                        </button>
                                )}
                        />

                        {/* One tab bar drives both the scenario list and that entry's settings. */}
                        <div className="ui-seg grid-cols-3" role="tablist" aria-label={t('manager.tabAria')}>
                                {TABS.map(({ key, labelKey, Icon }) => {
                                        const activeCount = byType[key].filter((a) => a.active).length
                                        const active = key === activeTab
                                        return (
                                                <button
                                                        key={key}
                                                        id={`scenario-tab-${key}`}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={active}
                                                        aria-controls={`scenario-panel-${key}`}
                                                        onClick={() => setActiveTab(key)}
                                                        className="ui-seg-tab min-h-12 gap-2 px-2 text-[13px]"
                                                >
                                                        <Icon className="hidden h-4 w-4 shrink-0 sm:block" />
                                                        <span className="truncate">
                                                                {key === 'STORY'
                                                                        ? <>{fa ? 'استوری' : 'Story'}<span className="hidden sm:inline">{fa ? ' و واکنش' : ' & reactions'}</span></>
                                                                        : t(labelKey)}
                                                        </span>
                                                        <span className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[12px] font-bold tabular-nums ${active ? 'bg-[var(--text-primary)] text-white' : 'bg-black/[0.08] text-[var(--text-secondary)]'}`}>
                                                                {activeCount.toLocaleString(numLocale)}
                                                        </span>
                                                </button>
                                        )
                                })}
                        </div>

                        <AutomationsReportSummary
                                fa={fa}
                                reports={reports}
                                names={Object.fromEntries(automations.map((item) => [item.id, item.name]))}
                        />

                        {/* Phones and tablets: the entry's settings fold above its scenarios. */}
                        <details className="group overflow-hidden rounded-card border border-[var(--border-subtle)] bg-white shadow-[var(--elev-1)] lg:hidden">
                                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-[13px] [&::-webkit-details-marker]:hidden">
                                        <Settings2 className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                                        <span className="font-bold text-[var(--text-primary)]">{fa ? 'تنظیمات این ورودی' : 'Settings for this entry'}</span>
                                        <span className="truncate text-[var(--text-muted)]">· {t(REPLY_POLICY_LABEL_KEY[settings[POLICY_KEY[activeTab]]])}</span>
                                        <ChevronDown className="ms-auto h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="border-t border-[var(--border-subtle)] p-4">{settingsPanel}</div>
                        </details>

                        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
                                <div
                                        id={`scenario-panel-${activeTab}`}
                                        role="tabpanel"
                                        aria-labelledby={`scenario-tab-${activeTab}`}
                                        className="min-w-0"
                                >
                                        {current.length === 0 ? (
                                                <EmptyState
                                                        type={activeTab}
                                                        text={t(currentTab.emptyKey)}
                                                        onCreate={() => router.push(newHref)}
                                                />
                                        ) : (
                                                <div className="spatial-surface divide-y divide-[var(--border-subtle)] rounded-card">
                                                        {current.map((a) => (
                                                                <AutomationCard
                                                                        key={a.id}
                                                                        automation={a}
                                                                        agentId={agentId}
                                                                        report={reports[a.id]}
                                                                        onToggleActive={(next) => handleToggleActive(a, next)}
                                                                        onDelete={() => setDeleteTarget(a)}
                                                                />
                                                        ))}
                                                </div>
                                        )}
                                </div>
                                <aside className="spatial-surface hidden rounded-card p-4 lg:sticky lg:top-24 lg:block" aria-label={fa ? 'تنظیمات این ورودی' : 'Settings for this entry'}>
                                        {settingsPanel}
                                </aside>
                        </div>

                        {/* Delete confirmation — shared ConfirmDialog primitive gives us
                            focus trap, Esc-to-close, scroll lock and focus restore for free. */}
                        <ConfirmDialog
                                open={deleteTarget !== null}
                                title={t('manager.deleteTitle')}
                                description={deleteTarget ? t('manager.deleteConfirmBody', { name: deleteTarget.name }) : undefined}
                                confirmLabel={t('manager.delete')}
                                cancelLabel={t('manager.cancel')}
                                tone="danger"
                                busy={deleting}
                                onConfirm={confirmDelete}
                                onClose={() => { if (!deleting) setDeleteTarget(null) }}
                        />

                        {/* Toast */}
                        {toast && (
                                <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 [bottom:calc(6rem+env(safe-area-inset-bottom))] md:bottom-6">
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

const POLICY_KEY: Record<AutomationType, 'dmReplyPolicy' | 'commentReplyPolicy' | 'storyReplyPolicy'> = {
        DIRECT_MESSAGE: 'dmReplyPolicy',
        COMMENT: 'commentReplyPolicy',
        STORY: 'storyReplyPolicy',
}

// ── Settings of one entry (direct, comment, story) ───────────────────────
//   Every control saves on change; the two fixed-reply texts save when the
//   field loses focus. Story reactions live with the story entry.
function ChannelSettingsRail({
        settings,
        onSave,
        entry,
}: {
        settings: InstagramAutomationSettings
        onSave: (next: InstagramAutomationSettings) => Promise<void>
        entry: AutomationType
}) {
        const t = useTranslations('instagram')
        const fa = useLocale() === 'fa'
        const [draft, setDraft] = useState<InstagramAutomationSettings>(settings)
        const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
        const policyKey = POLICY_KEY[entry]
        // Two copies of this panel exist (folded on phones, rail on desktop); keep both on the saved value.
        useEffect(() => { setDraft(settings) }, [settings])

        async function commit(next: InstagramAutomationSettings) {
                setDraft(next)
                // A fixed reply that is switched on needs its text before it can be saved.
                if ((next.storyReactionReplyEnabled && !next.storyReactionReplyText?.trim()) ||
                        (next.commentEmojiReplyEnabled && !next.commentEmojiReplyText?.trim())) return
                setState('saving')
                try {
                        await onSave(next)
                        setState('saved')
                        window.setTimeout(() => setState((value) => (value === 'saved' ? 'idle' : value)), 1800)
                } catch {
                        // The parent shows the localized error; fall back to what is stored.
                        setDraft(settings)
                        setState('idle')
                }
        }

        const POLICIES: { value: ReplyPolicy; title: string; hint: string }[] = [
                { value: 'ALL_AGENT', title: fa ? 'همه را ایجنت جواب بدهد' : 'The agent answers everything', hint: fa ? 'سناریوها نادیده گرفته می‌شوند' : 'Scenarios are ignored' },
                { value: 'AGENT_EXCEPT_SCENARIOS', title: fa ? 'ایجنت، به‌جز سناریوها' : 'The agent, except scenarios', hint: fa ? 'اگر سناریویی بخورد، همان جواب می‌دهد' : 'A matching scenario answers instead' },
                { value: 'AUTOMATION_ONLY', title: fa ? 'فقط سناریوها' : 'Scenarios only', hint: fa ? 'ایجنت خاموش است' : 'The agent stays off' },
        ]

        function toggleRow(
                key: 'storyReactionReplyEnabled' | 'commentEmojiReplyEnabled' | 'likeDmAfterReply' |
                        'likeStoryReplyAfterReply' | 'likeStoryReactionAfterReply' | 'likeCommentAfterReply',
                label: string,
                hint?: string,
                disabled = false,
        ) {
                return (
                        <div className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-55' : ''}`}>
                                <div className="min-w-0">
                                        <p className="text-[13px] text-[var(--text-primary)]">{label}</p>
                                        {hint && <p className="text-[12px] leading-5 text-[var(--text-muted)]">{hint}</p>}
                                </div>
                                <Switch
                                        checked={Boolean(draft[key])}
                                        disabled={disabled}
                                        onChange={(next) => void commit({ ...draft, [key]: next })}
                                        aria-label={label}
                                />
                        </div>
                )
        }

        function replyText(key: 'commentEmojiReplyText' | 'storyReactionReplyText', enabled: boolean, placeholder: string) {
                if (!enabled) return null
                return (
                        <div>
                                <textarea
                                        value={draft[key] ?? ''}
                                        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value || null }))}
                                        onBlur={() => { if ((draft[key] ?? '') !== (settings[key] ?? '')) void commit(draft) }}
                                        placeholder={placeholder}
                                        aria-label={t('manager.fixedReplyText')}
                                        rows={2}
                                        className="input min-h-[4.5rem] resize-none py-2 text-[13px] leading-6"
                                />
                                {!draft[key]?.trim() && <p className="mt-1 text-[12px] text-amber-700">{fa ? 'متن پاسخ را بنویسید تا ذخیره شود.' : 'Write the reply text to save.'}</p>}
                        </div>
                )
        }

        const heading = entry === 'DIRECT_MESSAGE'
                ? (fa ? 'چه کسی جواب دایرکت را بدهد؟' : 'Who answers direct messages?')
                : entry === 'COMMENT'
                        ? (fa ? 'چه کسی جواب کامنت را بدهد؟' : 'Who answers comments?')
                        : (fa ? 'چه کسی جواب ریپلای استوری را بدهد؟' : 'Who answers story replies?')

        return (
                <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                                <h2 id={`ig-policy-${entry}`} className="text-[13px] font-bold text-[var(--text-primary)]">{heading}</h2>
                                <span className="shrink-0 text-[12px] text-emerald-700" role="status" aria-live="polite">
                                        {state === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-muted)]" /> : state === 'saved' ? (fa ? 'ذخیره شد ✓' : 'Saved ✓') : null}
                                </span>
                        </div>
                        <div role="radiogroup" aria-labelledby={`ig-policy-${entry}`} className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-default)]">
                                {POLICIES.map(({ value, title, hint }) => {
                                        const active = draft[policyKey] === value
                                        return (
                                                <button
                                                        key={value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={active}
                                                        onClick={() => { if (!active) void commit({ ...draft, [policyKey]: value }) }}
                                                        className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                                                >
                                                        <span className={`h-5 w-5 shrink-0 rounded-full border bg-white ${active ? 'border-[6px] border-[var(--text-primary)]' : 'border-black/30'}`} />
                                                        <span className="min-w-0">
                                                                <span className={`block text-[13px] text-[var(--text-primary)] ${active ? 'font-bold' : ''}`}>{title}</span>
                                                                <span className="block text-[12px] leading-5 text-[var(--text-muted)]">{hint}</span>
                                                        </span>
                                                </button>
                                        )
                                })}
                        </div>

                        {entry === 'DIRECT_MESSAGE' && toggleRow('likeDmAfterReply', fa ? 'لایک پیام پس از پاسخ' : 'Like the message after replying')}
                        {entry === 'COMMENT' && (
                                <>
                                        {toggleRow('commentEmojiReplyEnabled', t('manager.commentEmojiEnabled'), t('manager.commentEmojiEnabledHint'))}
                                        {replyText('commentEmojiReplyText', draft.commentEmojiReplyEnabled, t('manager.commentEmojiPlaceholder'))}
                                        {toggleRow('likeCommentAfterReply', t('manager.likeComment'), t('manager.likeCommentUnsupportedHint'), true)}
                                </>
                        )}
                        {entry === 'STORY' && (
                                <>
                                        {toggleRow('likeStoryReplyAfterReply', t('manager.likeStoryReply'))}
                                        <p className="border-t border-[var(--border-subtle)] pt-3 text-[12px] font-bold text-[var(--text-secondary)]">{fa ? 'واکنش به استوری' : 'Story reactions'}</p>
                                        {toggleRow('storyReactionReplyEnabled', t('manager.storyReactionEnabled'), t('manager.storyReactionEnabledHint'))}
                                        {replyText('storyReactionReplyText', draft.storyReactionReplyEnabled, t('manager.storyReactionPlaceholder'))}
                                        {toggleRow('likeStoryReactionAfterReply', t('manager.likeStoryReaction'))}
                                </>
                        )}

                        <div className="border-t border-[var(--border-subtle)] pt-3">
                                <label htmlFor={`ig-stop-${entry}`} className="ui-field-label">{fa ? 'کلمات توقف' : 'Stop words'}</label>
                                <TagInput
                                        id={`ig-stop-${entry}`}
                                        value={draft.stopWords}
                                        onChange={(words) => void commit({ ...draft, stopWords: words })}
                                        locale={fa ? 'fa' : 'en'}
                                        max={50}
                                        placeholder={t('manager.stopWordsPlaceholder')}
                                />
                                <p className="ui-field-hint">{fa ? 'با دیدنشان ایجنت در آن گفتگو ساکت می‌شود؛ برای همهٔ ورودی‌ها مشترک است.' : 'On seeing one, the agent goes quiet in that conversation. Shared by all entries.'}</p>
                        </div>
                </div>
        )
}

// ── Empty state ─────────────────────────────────────────────────────────
// The first-scenario moment is when "what does this do?" matters most, so
// the empty tab plays that scenario type end to end on the Instagram phone
// mockup: the customer writes, the store answers in the DM.
const EMPTY_DEMO: Record<AutomationType, { mode: InstagramDemoMode; fa: string; en: string }> = {
        DIRECT_MESSAGE: {
                mode: 'direct',
                fa: 'نمونهٔ دایرکت: مشتری در دایرکت سؤال می‌پرسد و فروشگاه فوراً جواب و کارت محصول می‌فرستد.',
                en: 'DM sample: a customer asks in a DM and the store instantly replies with product cards.',
        },
        COMMENT: {
                mode: 'comment',
                fa: 'نمونهٔ کامنت: مشتری زیر پست کامنت می‌گذارد، فروشگاه زیر کامنت جواب می‌دهد و ادامه را در دایرکت می‌فرستد.',
                en: 'Comment sample: a customer comments on a post, the store replies under it and continues in a DM.',
        },
        STORY: {
                mode: 'story',
                fa: 'نمونهٔ استوری: مشتری استوری را ریپلای می‌کند و فروشگاه در دایرکت جواب می‌دهد.',
                en: 'Story sample: a customer replies to a story and the store answers in the DM.',
        },
}

function EmptyState({
        type,
        text,
        onCreate,
}: {
        type: AutomationType
        text: string
        onCreate: () => void
}) {
        const t = useTranslations('instagram')
        const fa = useLocale() !== 'en'
        const demo = EMPTY_DEMO[type]
        return (
                <div className="grid grid-cols-1 items-center gap-6 rounded-card border border-dashed border-black/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(247,247,249,0.78))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8 sm:p-8">
                        <div className="min-w-0 text-center sm:text-start">
                                <h3 className="text-base font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                                        {fa ? 'اولین سناریو را بسازید' : 'Create your first scenario'}
                                </h3>
                                <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--text-secondary)] sm:mx-0">
                                        {text}
                                </p>
                                <button
                                        type="button"
                                        onClick={onCreate}
                                        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-[var(--shadow-control)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                                >
                                        <Plus className="h-4 w-4" />
                                        {t('manager.addScenario')}
                                </button>
                        </div>
                        <InstagramScenarioDemo
                                key={type}
                                locale={fa ? 'fa' : 'en'}
                                mode={demo.mode}
                                label={fa ? demo.fa : demo.en}
                                className="mx-auto w-[260px] max-w-full"
                        />
                </div>
        )
}
