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
  Zap,
  Volume2,
  ImageIcon,
  Tag,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  type Automation,
  type AutomationType,
  type ReplyMode,
  type MessageType,
  REPLY_MODE_SHORT_LABEL,
} from '@/components/instagram/types'

const TYPE_ICON: Record<AutomationType, LucideIcon> = {
  DIRECT_MESSAGE: MessageCircle,
  COMMENT: MessageSquare,
  STORY: Circle,
}

const REPLY_MODE_ICON: Record<ReplyMode, LucideIcon> = {
  STATIC: MessageCircle,
  AI: Bot,
  FLOW: Bot,
  SILENT: Circle,
  STOP_AI: Zap,
  MULTI_MESSAGE: MessageSquare,
}

const MESSAGE_TYPE_ICON: Record<MessageType, LucideIcon> = {
  TEXT: MessageCircle,
  IMAGE: ImageIcon,
  AUDIO: Volume2,
  VIDEO: ImageIcon,
  PRODUCT: Tag,
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
    (m) => m.type === 'IMAGE' || m.type === 'AUDIO' || m.type === 'VIDEO' || m.type === 'PRODUCT',
  )
  const messageTypes = new Set(messages.map((m) => m.type))

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-sm sm:p-5">
      {/* Subtle hover gradient strip on the start edge */}
      <div
        className="pointer-events-none absolute inset-y-0 start-0 w-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: 'linear-gradient(180deg, #f58529, #dd2a7b, #8134af)' }}
        aria-hidden
      />

      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)' }}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-[var(--text-primary)]">
              {automation.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
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
              tr.keywords.slice(0, 6).map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                >
                  {k}
                </span>
              ))
            )}
            {tr.keywords.length > 6 && (
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                +{(tr.keywords.length - 6).toLocaleString('fa-IR')}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              <ReplyIcon className="h-3 w-3" />
              {REPLY_MODE_SHORT_LABEL[ac.replyMode]}
            </span>
            {hasMedia && (
              <span className="inline-flex items-center gap-1">
                {(Array.from(messageTypes) as MessageType[]).slice(0, 3).map((t) => {
                  const MIcon = MESSAGE_TYPE_ICON[t]
                  return <MIcon key={t} className="h-3 w-3" />
                })}
              </span>
            )}
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
            {ac.followUpEnabled && (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                پیگیری
              </span>
            )}
            {automation.type === 'STORY' && (
              <span>{tr.storyScope === 'ALL' ? 'همه استوری‌ها' : 'کلمات خاص'}</span>
            )}
            {automation.type === 'COMMENT' && tr.postIds.length > 0 && (
              <span>{tr.postIds.length.toLocaleString('fa-IR')} پست</span>
            )}
            {automation.type === 'COMMENT' && tr.postIds.length === 0 && (
              <span>همه پست‌ها</span>
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
              {toggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
