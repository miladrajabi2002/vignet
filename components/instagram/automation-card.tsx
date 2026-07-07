'use client'

import { useState } from 'react'
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
  type LucideIcon,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  type Automation,
  type AutomationType,
  REPLY_MODE_LABEL,
} from '@/components/instagram/types'

const TYPE_ICON: Record<AutomationType, LucideIcon> = {
  DIRECT_MESSAGE: MessageCircle,
  COMMENT: MessageSquare,
  STORY: Circle,
}

export function AutomationCard({
  automation,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  automation: Automation
  onToggleActive: (next: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [toggling, setToggling] = useState(false)
  const Icon = TYPE_ICON[automation.type]
  const ac = automation.action
  const tr = automation.trigger

  async function toggle(next: boolean) {
    setToggling(true)
    try {
      await onToggleActive(next)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-hover)] sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)]">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-[var(--text-primary)]">
              {automation.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                automation.active
                  ? 'bg-success/10 text-success'
                  : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  automation.active ? 'bg-success' : 'bg-[var(--text-muted)]'
                }`}
              />
              {automation.active ? 'فعال' : 'غیرفعال'}
            </span>
          </div>

          {/* Keywords */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tr.keywords.length === 0 ? (
              <span className="text-[11px] text-[var(--text-muted)]">
                بدون کلمه‌کلیدی — روی همه پیام‌ها اعمال می‌شود
              </span>
            ) : (
              tr.keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                >
                  {k}
                </span>
              ))
            )}
          </div>

          {/* Meta row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {REPLY_MODE_LABEL[ac.replyMode]}
            </span>
            {ac.dmOnComment && (
              <span className="inline-flex items-center gap-1">
                <Send className="h-3 w-3" />
                دایرکت به کامنت‌گذار
              </span>
            )}
            {ac.followGate && (
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3 w-3" />
                دروازه فالو
              </span>
            )}
            {automation.type === 'STORY' && (
              <span>
                {tr.storyScope === 'ALL' ? 'همه استوری‌ها' : 'بر اساس کلمه‌کلیدی'}
              </span>
            )}
            {automation.type === 'COMMENT' && tr.postIds.length > 0 && (
              <span>{tr.postIds.length} پست</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={automation.active}
            onChange={toggle}
            disabled={toggling}
            aria-label="فعال/غیرفعال"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="ویرایش"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger)]"
              aria-label="حذف"
            >
              {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
