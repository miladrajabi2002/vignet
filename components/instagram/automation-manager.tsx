'use client'

import { useMemo, useState } from 'react'
import {
  MessageCircle,
  MessageSquare,
  Circle,
  Plus,
  Loader2,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { AutomationCard } from '@/components/instagram/automation-card'
import { AutomationForm } from '@/components/instagram/automation-form'
import {
  type Automation,
  type AutomationType,
} from '@/components/instagram/types'

interface TabDef {
  key: AutomationType
  label: string
  Icon: LucideIcon
  empty: string
}

const TABS: TabDef[] = [
  {
    key: 'DIRECT_MESSAGE',
    label: 'دایرکت',
    Icon: MessageCircle,
    empty:
      'هنوز سناریویی برای دایرکت‌ها ندارید. می‌توانید برای پیام‌های پرتکرار یا کلیدواژه‌های مشخص پاسخ خودکار تنظیم کنید.',
  },
  {
    key: 'COMMENT',
    label: 'کامنت',
    Icon: MessageSquare,
    empty:
      'هنوز سناریویی برای کامنت‌ها ندارید. برای پست‌های خود پاسخ خودکار و کال‌تو‌اکشن تنظیم کنید — هم به کامنت پاسخ دهید و هم کاربر را به دایرکت هدایت کنید.',
  },
  {
    key: 'STORY',
    label: 'استوری',
    Icon: Circle,
    empty:
      'هنوز سناریویی برای استوری‌ها ندارید. برای هر استوری پاسخ خودکار تعریف کنید، یا اجازه دهید ایجنت هوشمند بر اساس محتوای استوری پاسخ دهد.',
  },
]

type DialogState =
  | { mode: 'create'; type: AutomationType }
  | { mode: 'edit'; type: AutomationType; automation: Automation }
  | null

export function InstagramAutomationManager({
  agentId,
  initialAutomations,
}: {
  agentId: string
  /** Instagram channel id (the page only mounts this component when connected). */
  channelId: string
  initialAutomations: Automation[]
  /** Always true when this component is mounted — the page handles the
   *  not-connected empty state. Kept in the prop signature for clarity. */
  connected: boolean
}) {
  const [automations, setAutomations] = useState<Automation[]>(initialAutomations)
  const [activeTab, setActiveTab] = useState<AutomationType>('DIRECT_MESSAGE')
  const [dialog, setDialog] = useState<DialogState>(null)
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
  const currentTab = TABS.find((t) => t.key === activeTab)!

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
    // Optimistic update for snappy UX; revert on failure.
    setAutomations((arr) =>
      arr.map((x) => (x.id === a.id ? { ...x, active: next } : x)),
    )
    try {
      await patchAutomation(a.id, { active: next })
    } catch {
      setAutomations((arr) =>
        arr.map((x) => (x.id === a.id ? { ...x, active: a.active } : x)),
      )
      flash('err', 'تغییر وضعیت ناموفق بود.')
    }
  }

  function handleSaved(saved: Automation) {
    setAutomations((arr) => {
      const idx = arr.findIndex((x) => x.id === saved.id)
      if (idx === -1) return [...arr, saved]
      const copy = arr.slice()
      copy[idx] = saved
      return copy
    })
    setDialog(null)
    flash('ok', 'ذخیره شد.')
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
      flash('ok', 'سناریو حذف شد.')
    } catch {
      flash('err', 'حذف ناموفق بود.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-[var(--text-primary)]">
            اتوماسیون اینستاگرام
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            سناریوهای خودکار برای دایرکت، کامنت و استوری بسازید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ mode: 'create', type: activeTab })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          افزودن سناریو
        </button>
      </header>

      {/* Sub-tabs */}
      <nav
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] px-1"
        aria-label="نوع اتوماسیون"
      >
        {TABS.map(({ key, label, Icon }) => {
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
              {label}
              {count > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--bg-muted)] px-1.5 text-[11px] text-[var(--text-secondary)]">
                  {activeCount.toLocaleString('fa-IR')}
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
            text={currentTab.empty}
            onCreate={() => setDialog({ mode: 'create', type: activeTab })}
          />
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto pe-1">
            {current.map((a) => (
              <AutomationCard
                key={a.id}
                automation={a}
                onToggleActive={(next) => handleToggleActive(a, next)}
                onEdit={() =>
                  setDialog({ mode: 'edit', type: a.type, automation: a })
                }
                onDelete={() => setDeleteTarget(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      {dialog && (
        <AutomationForm
          agentId={agentId}
          type={dialog.type}
          mode={dialog.mode}
          initial={dialog.mode === 'edit' ? dialog.automation : undefined}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأیید حذف"
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
                  حذف سناریو
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  سناریو «{deleteTarget.name}» حذف می‌شود. این عمل قابل بازگشت نیست.
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
                انصراف
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                حذف
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

function EmptyState({
  Icon,
  text,
  onCreate,
}: {
  Icon: LucideIcon
  text: string
  onCreate: () => void
}) {
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
        افزودن سناریو
      </button>
    </div>
  )
}
