import { Handle, Position } from '@xyflow/react'
import type { LucideIcon } from 'lucide-react'

export interface SourceHandle {
  id?: string
  label?: string
  /** vertical offset as a percentage of node height */
  top?: string
}

/**
 * Shared visual shell for every builder node. Monochrome card with an icon
 * header, optional body, and configurable connection handles.
 */
export function BaseNode({
  icon: Icon,
  title,
  body,
  hasTarget = true,
  sources = [{}],
  accent,
}: {
  icon: LucideIcon
  title: string
  body?: string
  hasTarget?: boolean
  sources?: SourceHandle[]
  accent?: boolean
}) {
  return (
    <div
      className={`min-w-[160px] max-w-[220px] rounded-xl border bg-[var(--bg-elevated)] px-3 py-2.5 text-start shadow-lg ${
        accent
          ? 'border-[var(--border-strong)]'
          : 'border-[var(--border-default)]'
      }`}
    >
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 !border-0 !bg-[rgba(var(--ink-rgb),0.6)]"
        />
      )}

      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--text-primary)]" />
        <span className="text-xs font-medium text-[var(--text-primary)]">
          {title}
        </span>
      </div>
      {body && (
        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {body}
        </p>
      )}

      {sources.map((s, i) => (
        <Handle
          key={s.id ?? i}
          id={s.id}
          type="source"
          position={Position.Right}
          style={s.top ? { top: s.top } : undefined}
          className="!h-2 !w-2 !border-0 !bg-[rgba(var(--ink-rgb),0.6)]"
        >
          {s.label && (
            <span className="pointer-events-none absolute -top-2 left-3 whitespace-nowrap text-[9px] text-[var(--text-muted)]">
              {s.label}
            </span>
          )}
        </Handle>
      ))}
    </div>
  )
}
