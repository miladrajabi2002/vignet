'use client'

import {
  MessageCircle,
  Bot,
  Headset,
  Sparkles,
  ShoppingBag,
  HelpCircle,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react'
import { contrastOn, type WidgetSettings, type WidgetIcon } from '@/lib/widget/config'

export const WIDGET_ICON_COMPONENTS: Record<WidgetIcon, LucideIcon> = {
  chat: MessageCircle,
  bot: Bot,
  headset: Headset,
  sparkles: Sparkles,
  bag: ShoppingBag,
  help: HelpCircle,
}

const CORNER_RADII: Record<WidgetSettings['corners'], { panel: number; bubble: number; input: number }> = {
  soft: { panel: 22, bubble: 17, input: 18 },
  round: { panel: 28, bubble: 20, input: 24 },
  sharp: { panel: 12, bubble: 9, input: 11 },
}

/**
 * Live, non-interactive mock of the web widget that mirrors loader.js styling so
 * the owner can preview color/theme/position/icon/corners before saving.
 */
export function WidgetPreview({
  settings,
  agentName,
  welcomeMessage,
  isRtl,
}: {
  settings: WidgetSettings
  agentName: string
  welcomeMessage?: string | null
  isRtl: boolean
}) {
  const dark = settings.theme !== 'light'
  const accent = settings.primaryColor
  const onAccent = contrastOn(accent)
  const title = settings.headerTitle || agentName
  const Icon = WIDGET_ICON_COMPONENTS[settings.icon] ?? MessageCircle
  const radii = CORNER_RADII[settings.corners]
  const accentSoft = hexToRgba(accent, 0.13)
  const welcome = welcomeMessage || (isRtl ? 'سلام! چطور می‌تونم کمکتون کنم؟' : 'Hi! How can I help you?')

  const c = {
    bg: dark ? '#0e0e11' : '#ffffff',
    head: dark ? '#161619' : '#fbfbfc',
    surface: dark ? '#1c1c21' : '#f3f4f6',
    text: dark ? '#f3f4f6' : '#1a1a1e',
    muted: dark ? '#8b8b94' : '#9298a3',
    border: dark ? 'rgba(255,255,255,.09)' : 'rgba(17,17,20,.08)',
  }

  const onLeft = settings.position === 'left'
  const side = onLeft ? { left: 16 } : { right: 16 }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative h-[440px] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)]"
      style={{
        backgroundImage: 'radial-gradient(var(--border-default) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      {/* Panel */}
      <div
        className="absolute bottom-16 flex w-[300px] flex-col overflow-hidden shadow-2xl"
        style={{
          ...side,
          height: 340,
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
          borderRadius: radii.panel,
        }}
      >
        {/* header (neutral / material) */}
        <div
          className="flex items-center gap-2.5 p-3"
          style={{ background: c.head, borderBottom: `1px solid ${c.border}` }}
        >
          <div
            className="relative flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: accentSoft, color: accent }}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span
              className="absolute bottom-0 h-2.5 w-2.5 rounded-full bg-green-500"
              style={{ insetInlineEnd: 0, border: `2px solid ${c.head}` }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold leading-tight" style={{ color: c.text }}>
              {title}
            </div>
            <div className="mt-0.5 truncate text-[11px]" style={{ color: c.muted }}>
              {settings.subtitle || (isRtl ? 'آنلاین' : 'Online')}
            </div>
          </div>
          <X className="h-4 w-4" style={{ color: c.muted }} />
        </div>

        {/* intro / empty state */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: accentSoft, color: accent }}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div className="text-[13px] font-medium leading-relaxed" style={{ color: c.text, maxWidth: 220 }}>
            {welcome}
          </div>
          {settings.quickReplies.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {settings.quickReplies.slice(0, 4).map((q, i) => (
                <span
                  key={i}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ color: accent, border: `1px solid ${c.border}` }}
                >
                  {q}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* input */}
        <div className="p-2.5" style={{ borderTop: `1px solid ${c.border}` }}>
          <div
            className="flex items-center gap-2 px-3 py-1.5"
            style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: radii.input }}
          >
            <span className="flex-1 text-[12px]" style={{ color: c.muted }}>
              {isRtl ? 'پیام خود را بنویسید…' : 'Type a message…'}
            </span>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: accent, color: onAccent }}
            >
              <Send className="h-3.5 w-3.5" style={isRtl ? { transform: 'scaleX(-1)' } : undefined} />
            </div>
          </div>
        </div>
      </div>

      {/* Launcher */}
      <div
        className="absolute bottom-4 flex h-12 items-center gap-2 rounded-full px-1 shadow-xl"
        style={{ ...side, background: accent, color: onAccent }}
      >
        <div className="flex h-10 w-10 items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        {settings.launcherLabel && (
          <span className="pe-3 text-[13px] font-semibold">{settings.launcherLabel}</span>
        )}
      </div>
    </div>
  )
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${a})`
}
