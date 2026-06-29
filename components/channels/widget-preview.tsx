'use client'

import { MessageCircle, Send, X } from 'lucide-react'
import { contrastOn, type WidgetSettings } from '@/lib/widget/config'

/**
 * Live, non-interactive mock of the web widget that mirrors loader.js styling so
 * the owner can see color/theme/position changes before saving.
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

  const c = {
    bg: dark ? '#0c0c0e' : '#ffffff',
    surface: dark ? '#1a1a1f' : '#f4f4f5',
    text: dark ? '#f4f4f5' : '#18181b',
    muted: dark ? '#8a8a93' : '#9ca3af',
    border: dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)',
  }

  const onLeft = settings.position === 'left'
  const side = onLeft ? { left: 16 } : { right: 16 }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative h-[420px] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)]"
      style={{
        backgroundImage:
          'radial-gradient(var(--border-default) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      {/* Panel */}
      <div
        className="absolute bottom-16 flex w-[300px] flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          ...side,
          height: 320,
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
        }}
      >
        {/* header */}
        <div
          className="flex items-center gap-2.5 p-3"
          style={{ background: accent, color: onAccent }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: onAccent, color: accent }}
          >
            {title.trim().charAt(0).toUpperCase() || 'V'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold leading-tight">{title}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] opacity-80">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {isRtl ? 'آنلاین' : 'Online'}
            </div>
          </div>
          <X className="h-4 w-4 opacity-80" />
        </div>
        {/* body */}
        <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
          <div
            className="max-w-[80%] self-start rounded-2xl rounded-bl-sm px-3 py-2 text-[12px] leading-relaxed"
            style={{ background: c.surface, color: c.text, border: `1px solid ${c.border}` }}
          >
            {welcomeMessage || (isRtl ? 'سلام! چطور می‌تونم کمکتون کنم؟' : 'Hi! How can I help you?')}
          </div>
          <div
            className="max-w-[80%] self-end rounded-2xl rounded-br-sm px-3 py-2 text-[12px] leading-relaxed"
            style={{ background: accent, color: onAccent }}
          >
            {isRtl ? 'سلام، یه سوال داشتم' : 'Hi, I have a question'}
          </div>
        </div>
        {/* input */}
        <div className="p-2.5" style={{ borderTop: `1px solid ${c.border}` }}>
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{ background: c.surface, border: `1px solid ${c.border}` }}
          >
            <span className="flex-1 text-[12px]" style={{ color: c.muted }}>
              {isRtl ? 'پیام خود را بنویسید…' : 'Type a message…'}
            </span>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: accent, color: onAccent }}
            >
              <Send className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Launcher */}
      <div
        className="absolute bottom-4 flex h-12 items-center gap-2 rounded-full px-1 shadow-xl"
        style={{
          ...side,
          background: accent,
          color: onAccent,
        }}
      >
        <div className="flex h-10 w-10 items-center justify-center">
          <MessageCircle className="h-5 w-5" />
        </div>
        {settings.launcherLabel && (
          <span className="pe-3 text-[13px] font-semibold">{settings.launcherLabel}</span>
        )}
      </div>
    </div>
  )
}
