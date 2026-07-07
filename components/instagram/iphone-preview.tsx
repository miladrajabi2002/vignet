'use client'

import { memo } from 'react'
import {
  Heart,
  Send,
  Camera,
  Image as ImageIcon,
  Mic,
  MoreHorizontal,
  Phone,
  Video,
  ChevronRight,
  Plus,
} from 'lucide-react'
import type {
  AutomationType,
  ReplyMode,
  AutomationMessage,
  MessageType,
} from '@/components/instagram/types'

/**
 * iPhonePreview — a CSS-only, realistic iPhone 15 Pro mockup that mirrors the
 * current automation form state. Three modes:
 *
 *  - `mode="dm"`     → Instagram DM chat screen
 *  - `mode="story"`  → Instagram story viewer with reply bar
 *  - `mode="comment"`→ Instagram post with comment thread
 *
 * The mockup is intentionally lightweight (memoized, no animation libs) so it
 * can re-render on every keystroke without jank. All visuals are CSS — no
 * images, no external assets.
 */

const IG_GRADIENT = 'linear-gradient(45deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)'

export interface IphonePreviewProps {
  mode: AutomationType
  /** The connected IG account's @username (no @). */
  accountUsername: string
  /** Optional avatar URL; falls back to a gradient monogram. */
  accountAvatarUrl?: string
  /** User-side text — typically the first trigger keyword. */
  userText: string
  /** Reply mode the operator is currently configuring. */
  replyMode: ReplyMode
  /** The list of messages the bot will send (STATIC / MULTI_MESSAGE). */
  messages: AutomationMessage[]
  /** DM funnel: also send this content as a DM to the commenter. */
  dmOnComment?: boolean
  /** Follow gate enabled? Shows a gate prompt bubble. */
  followGate?: boolean
  /** Follow-up message enabled? Shows a delayed second bubble. */
  followUpEnabled?: boolean
  followUpDelayMin?: number
  followUpMessage?: string
}

function IphonePreviewBase(props: IphonePreviewProps) {
  return (
    <div className="flex justify-center">
      <PhoneFrame>
        <Screen {...props} />
      </PhoneFrame>
    </div>
  )
}

export const IphonePreview = memo(IphonePreviewBase)

// ── Phone shell ──────────────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto aspect-[9/19.5] w-full max-w-[280px] rounded-[3rem] border-[3px] border-[#1a1a1a] bg-[#0a0a0a] p-[6px] shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.04)_inset]"
      aria-hidden
    >
      {/* Side buttons */}
      <div className="absolute -start-[3px] top-[18%] h-8 w-[2px] rounded-l bg-[#1a1a1a]" />
      <div className="absolute -start-[3px] top-[28%] h-12 w-[2px] rounded-l bg-[#1a1a1a]" />
      <div className="absolute -start-[3px] top-[38%] h-12 w-[2px] rounded-l bg-[#1a1a1a]" />
      <div className="absolute -end-[3px] top-[32%] h-16 w-[2px] rounded-r bg-[#1a1a1a]" />

      {/* Screen */}
      <div className="relative h-full w-full overflow-hidden rounded-[2.5rem] bg-white">
        {/* Dynamic Island */}
        <div className="absolute left-1/2 top-2 z-30 h-7 w-24 -translate-x-1/2 rounded-full bg-[#0a0a0a]" />
        {children}
      </div>
    </div>
  )
}

// ── Status bar (9:41 + signal + battery) ─────────────────────────────────

function StatusBar({ dark = false }: { dark?: boolean }) {
  const fg = dark ? 'text-white' : 'text-black'
  return (
    <div
      className={`relative z-20 flex h-10 items-center justify-between px-6 pt-2 text-[11px] font-semibold ${fg}`}
    >
      <span>9:41</span>
      <div className="flex items-center gap-1">
        {/* Signal */}
        <svg width="14" height="10" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="0.5" />
          <rect x="5" y="6" width="3" height="6" rx="0.5" />
          <rect x="10" y="3" width="3" height="9" rx="0.5" />
          <rect x="15" y="0" width="3" height="12" rx="0.5" />
        </svg>
        {/* Wifi */}
        <svg width="13" height="9" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
          <path d="M8 11.5l1.8-2.2a2.3 2.3 0 00-3.6 0L8 11.5z" />
          <path
            d="M3.2 6.2a8 8 0 019.6 0"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M5.6 8.4a4.4 4.4 0 014.8 0"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        {/* Battery */}
        <div className="flex items-center">
          <div
            className={`relative h-[10px] w-[22px] rounded-[3px] border ${dark ? 'border-white/60' : 'border-black/50'}`}
          >
            <div className="absolute inset-[1.5px] rounded-[1.5px] bg-current" style={{ width: '70%' }} />
          </div>
          <div className={`ms-[1px] h-[4px] w-[1.5px] rounded-e ${dark ? 'bg-white/60' : 'bg-black/50'}`} />
        </div>
      </div>
    </div>
  )
}

// ── Mode switcher ────────────────────────────────────────────────────────

/** Props for the per-mode screens — same as IphonePreviewProps minus `mode`. */
type ScreenProps = Omit<IphonePreviewProps, 'mode'>

function Screen(props: IphonePreviewProps) {
  if (props.mode === 'STORY') return <StoryScreen {...props} />
  if (props.mode === 'COMMENT') return <CommentScreen {...props} />
  return <DMScreen {...props} />
}

// ── DM screen ────────────────────────────────────────────────────────────

function DMScreen(props: ScreenProps) {
  const {
    accountUsername,
    accountAvatarUrl,
    userText,
    replyMode,
    messages,
    followGate,
    followUpEnabled,
    followUpDelayMin,
    followUpMessage,
  } = props

  const visibleMessages = (messages ?? []).filter(
    (m) => m.type !== 'PRODUCT' || m.productId,
  )

  return (
    <div className="flex h-full flex-col bg-white">
      <StatusBar />
      {/* Chat header */}
      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <ChevronRight className="h-4 w-4 rotate-180 text-black/80 rtl:rotate-0" />
        <Avatar url={accountAvatarUrl} name={accountUsername} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-black">{accountUsername}</p>
          <p className="text-[10px] text-black/50">Active now</p>
        </div>
        <Phone className="h-4 w-4 text-black/70" />
        <Video className="h-4 w-4 text-black/70" />
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 no-scrollbar">
        {/* Profile intro pill */}
        <div className="flex flex-col items-center pt-1 pb-2">
          <Avatar url={accountAvatarUrl} name={accountUsername} size={56} />
          <p className="mt-1.5 text-[12px] font-semibold text-black">{accountUsername}</p>
          <p className="text-[10px] text-black/50">Instagram</p>
        </div>

        {/* User's incoming message (the trigger keyword) */}
        {userText.trim() ? (
          <Bubble side="user">{userText}</Bubble>
        ) : (
          <Bubble side="user" muted>
            کلمه‌کلیدی نمونه…
          </Bubble>
        )}

        {/* Bot reply (or mode-specific state) */}
        <BotReplyBlock
          replyMode={replyMode}
          messages={visibleMessages}
          accountUsername={accountUsername}
        />

        {/* Follow gate prompt */}
        {followGate && (
          <Bubble side="bot">
            <span className="text-[10px] text-black/40">دروازه فالو</span>
            <span className="mt-0.5 block">برای دریافت محتوا، پیج را فالو کنید و «فالو کردم» را بفرستید.</span>
            <button className="mt-1.5 rounded-lg bg-black/5 px-2 py-1 text-[10px] text-black/70">
              فالو کردم
            </button>
          </Bubble>
        )}

        {/* Follow-up message */}
        {followUpEnabled && followUpMessage?.trim() && (
          <>
            <div className="my-1 text-center text-[9px] text-black/30">
              بعد از {followUpDelayMin ?? 60} دقیقه
            </div>
            <Bubble side="bot">{followUpMessage}</Bubble>
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 border-t border-black/5 px-3 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black/15 text-black/70">
          <Camera className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-1 items-center rounded-full border border-black/15 px-3 py-1.5">
          <span className="text-[11px] text-black/40">پیام…</span>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black/15 text-black/70">
          <Mic className="h-3.5 w-3.5" />
        </div>
        <Send className="h-4 w-4" style={{ color: '#dd2a7b' }} />
      </div>
    </div>
  )
}

function BotReplyBlock({
  replyMode,
  messages,
  accountUsername,
}: {
  replyMode: ReplyMode
  messages: AutomationMessage[]
  accountUsername: string
}) {
  if (replyMode === 'SILENT') {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="rounded-full bg-black/5 px-3 py-1 text-[10px] text-black/40">
          بی‌صدا — پاسخی ارسال نمی‌شود
        </span>
      </div>
    )
  }
  if (replyMode === 'STOP_AI') {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] text-red-600">
          پاسخ‌گویی هوش مصنوعی متوقف شد
        </span>
      </div>
    )
  }
  if (replyMode === 'AI' || replyMode === 'FLOW') {
    return (
      <Bubble side="bot">
        <TypingDots />
        <span className="ms-2 text-[10px] text-black/40">در حال پاسخ هوشمند…</span>
      </Bubble>
    )
  }
  // STATIC or MULTI_MESSAGE → render the messages
  if (messages.length === 0) {
    return (
      <Bubble side="bot" muted>
        پاسخ خود را بنویسید…
      </Bubble>
    )
  }
  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} accountUsername={accountUsername} />
      ))}
    </div>
  )
}

function MessageBubble({
  message,
}: {
  message: AutomationMessage
  accountUsername: string
}) {
  if (message.type === 'IMAGE' && message.mediaUrl) {
    return (
      <Bubble side="bot" flush>
        <div className="overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.mediaUrl}
            alt={message.text || 'preview'}
            className="block max-h-44 w-full object-cover"
          />
        </div>
        {message.text?.trim() && (
          <p className="px-2 py-1.5 text-[12px] text-black">{message.text}</p>
        )}
      </Bubble>
    )
  }
  if (message.type === 'AUDIO' && message.mediaUrl) {
    return (
      <Bubble side="bot">
        <div className="flex items-center gap-2 py-0.5">
          <button className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-white">
            <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor" aria-hidden>
              <path d="M0 0 L8 4.5 L0 9 Z" />
            </svg>
          </button>
          <div className="flex h-4 items-center gap-[2px]">
            {[8, 14, 6, 12, 9, 16, 5, 11, 7, 13, 6, 10].map((h, i) => (
              <span
                key={i}
                className="w-[2px] rounded-full bg-white/80"
                style={{ height: h }}
              />
            ))}
          </div>
          <span className="text-[10px] text-white/80">0:08</span>
        </div>
      </Bubble>
    )
  }
  if (message.type === 'VIDEO' && message.mediaUrl) {
    return (
      <Bubble side="bot" flush>
        <div className="relative overflow-hidden rounded-2xl bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.mediaUrl}
            alt={message.text || 'video'}
            className="block max-h-44 w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black">
              <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" aria-hidden>
                <path d="M0 0 L10 5.5 L0 11 Z" />
              </svg>
            </div>
          </div>
        </div>
        {message.text?.trim() && (
          <p className="px-2 py-1.5 text-[12px] text-black">{message.text}</p>
        )}
      </Bubble>
    )
  }
  if (message.type === 'PRODUCT' && message.productId) {
    return (
      <Bubble side="bot" flush>
        <div className="rounded-2xl border border-black/10 bg-white p-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[10px] text-white"
              style={{ background: IG_GRADIENT }}
            >
              <ImageIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-black">محصول انتخاب‌شده</p>
              <p className="text-[10px] text-black/50">قیمت: —</p>
            </div>
          </div>
          {message.text?.trim() && (
            <p className="mt-1.5 text-[11px] text-black/70">{message.text}</p>
          )}
        </div>
      </Bubble>
    )
  }
  // TEXT (or fallback)
  return (
    <Bubble side="bot">
      {message.text?.trim() ? message.text : 'متن پاسخ…'}
      {message.quickReplies && message.quickReplies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {message.quickReplies.slice(0, 3).map((q) => (
            <span
              key={q}
              className="rounded-full border border-white/30 px-2.5 py-1 text-[10px] text-white"
            >
              {q}
            </span>
          ))}
        </div>
      )}
    </Bubble>
  )
}

// ── Story screen ─────────────────────────────────────────────────────────

function StoryScreen(props: ScreenProps) {
  const {
    accountUsername,
    accountAvatarUrl,
    userText,
    replyMode,
    messages,
    followUpEnabled,
    followUpDelayMin,
    followUpMessage,
  } = props

  const reply = (messages[0]?.text ?? '').trim()

  return (
    <div className="relative h-full w-full">
      <StatusBar dark />
      {/* Story gradient background */}
      <div
        className="absolute inset-0"
        style={{ background: IG_GRADIENT }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/20" aria-hidden />

      {/* Story progress bars */}
      <div className="relative z-10 flex gap-1 px-3 pt-1">
        {[1, 1, 0.4].map((p, i) => (
          <div key={i} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white" style={{ width: `${p * 100}%` }} />
          </div>
        ))}
      </div>

      {/* Story header */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-2.5">
        <Avatar url={accountAvatarUrl} name={accountUsername} size={28} ring />
        <p className="text-[11px] font-semibold text-white">{accountUsername}</p>
        <span className="text-[10px] text-white/70">۲ ساعت پیش</span>
        <MoreHorizontal className="ms-auto h-3.5 w-3.5 text-white" />
      </div>

      {/* Story body — a subtle vignette so the gradient stays readable */}
      <div className="relative z-10 flex h-[calc(100%-180px)] items-center justify-center px-6">
        <p className="text-center text-[13px] font-medium leading-relaxed text-white/90">
          {userText.trim() ? `"${userText}"` : 'پاسخ استوری نمونه…'}
        </p>
      </div>

      {/* Reply bar (where the user's reply shows + bot's auto-response) */}
      <div className="absolute inset-x-0 bottom-0 z-20 space-y-2 bg-gradient-to-t from-black/60 to-transparent p-3 pt-6">
        {/* User's reply (visible at bottom) */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center rounded-full border border-white/40 bg-black/20 px-3 py-2 backdrop-blur">
            <span className="text-[11px] text-white/80">
              {userText.trim() || 'پیام…'}
            </span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
            <Heart className="h-3.5 w-3.5" />
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
            <Send className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Bot's automatic reply */}
        {(replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && reply && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-white px-2.5 py-1.5 text-[11px] text-black shadow">
              <span className="mb-0.5 block text-[9px] text-black/40">پاسخ خودکار</span>
              {reply}
            </div>
          </div>
        )}
        {replyMode === 'AI' && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white px-2.5 py-1.5 text-[11px] text-black shadow">
              <TypingDots />
              <span className="ms-1 text-[10px] text-black/40">پاسخ هوشمند…</span>
            </div>
          </div>
        )}
        {replyMode === 'SILENT' && (
          <div className="text-center text-[10px] text-white/60">بدون پاسخ خودکار</div>
        )}
        {replyMode === 'STOP_AI' && (
          <div className="text-center text-[10px] text-red-200">هوش مصنوعی متوقف شد</div>
        )}

        {followUpEnabled && followUpMessage?.trim() && (
          <div className="text-center text-[9px] text-white/60">
            پیگیری بعد از {followUpDelayMin ?? 60} دقیقه
          </div>
        )}
      </div>
    </div>
  )
}

// ── Comment screen ───────────────────────────────────────────────────────

function CommentScreen(props: ScreenProps) {
  const {
    accountUsername,
    accountAvatarUrl,
    userText,
    replyMode,
    messages,
    dmOnComment,
  } = props

  const publicReply = (messages[0]?.text ?? '').trim()
  const dmContent = (messages[1]?.text ?? '').trim()

  return (
    <div className="flex h-full flex-col bg-white">
      <StatusBar />
      {/* Mini post */}
      <div className="border-b border-black/5">
        <div className="flex items-center gap-2 px-3 py-2">
          <Avatar url={accountAvatarUrl} name={accountUsername} size={28} />
          <p className="text-[11px] font-semibold text-black">{accountUsername}</p>
          <MoreHorizontal className="ms-auto h-3.5 w-3.5 text-black/60" />
        </div>
        <div
          className="flex h-36 items-center justify-center text-white"
          style={{ background: IG_GRADIENT }}
        >
          <ImageIcon className="h-8 w-8 opacity-80" />
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-black">
          <Heart className="h-4 w-4" />
          <Send className="h-4 w-4 -rotate-12" />
        </div>
        <p className="px-3 pb-2 text-[11px] text-black">
          <span className="font-semibold">{accountUsername}</span>{' '}
          پست نمونه برای پیش‌نمایش کامنت‌ها
        </p>
      </div>

      {/* Comments */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 no-scrollbar">
        <p className="text-[10px] font-semibold text-black/50">کامنت‌ها</p>

        {/* User's comment (the trigger keyword) */}
        <div className="flex gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/10 text-[10px] text-black/60">
            U
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-black">
              <span className="font-semibold">user_123</span>{' '}
              {userText.trim() || 'کامنت نمونه…'}
            </p>
            <div className="mt-0.5 flex items-center gap-3 text-[9px] text-black/40">
              <span>اکنون</span>
              <span>پاسخ</span>
            </div>
          </div>
          <Heart className="h-3 w-3 text-black/30" />
        </div>

        {/* Bot's reply (if STATIC/MULTI_MESSAGE) */}
        {(replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && publicReply && (
          <div className="flex gap-2 ps-6">
            <Avatar url={accountAvatarUrl} name={accountUsername} size={20} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-black">
                <span className="font-semibold">{accountUsername}</span>{' '}
                {publicReply}
              </p>
              <div className="mt-0.5 flex items-center gap-3 text-[9px] text-black/40">
                <span>اکنون</span>
                <span>پاسخ</span>
              </div>
            </div>
            <Heart className="h-3 w-3 text-black/30" />
          </div>
        )}

        {replyMode === 'SILENT' && (
          <div className="rounded-lg bg-black/5 px-2.5 py-1.5 text-center text-[10px] text-black/50">
            کامنت بدون ریپلای رها می‌شود
          </div>
        )}

        {replyMode === 'MULTI_MESSAGE' && messages.length > 1 && (
          <div className="rounded-lg bg-black/5 px-2.5 py-1.5 text-[10px] text-black/60">
            یکی از {messages.length} گزینه به‌صورت تصادفی ریپلای می‌شود
          </div>
        )}

        {/* DM funnel */}
        {dmOnComment && (
          <div className="rounded-xl border border-[#dd2a7b]/30 bg-[#dd2a7b]/5 p-2.5">
            <p className="flex items-center gap-1 text-[10px] font-semibold text-[#dd2a7b]">
              <Send className="h-3 w-3 -rotate-12" />
              ارسال دایرکت
            </p>
            <p className="mt-1 text-[11px] text-black">
              {dmContent || 'متن دایرکت نمونه…'}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-black/5 px-3 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-[10px] text-black/60">
          U
        </div>
        <div className="flex flex-1 items-center rounded-full border border-black/15 px-3 py-1.5">
          <span className="text-[10px] text-black/40">افزودن کامنت…</span>
        </div>
        <Plus className="h-3.5 w-3.5 text-black/30" />
      </div>
    </div>
  )
}

// ── Shared atoms ─────────────────────────────────────────────────────────

function Avatar({
  url,
  name,
  size = 28,
  ring = false,
}: {
  url?: string
  name: string
  size?: number
  ring?: boolean
}) {
  const initial = (name || 'V').charAt(0).toUpperCase()
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-white' : ''}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-white ${ring ? 'ring-2 ring-white' : ''}`}
      style={{
        width: size,
        height: size,
        background: IG_GRADIENT,
        fontSize: Math.max(9, size * 0.4),
        fontWeight: 600,
      }}
    >
      {initial}
    </div>
  )
}

function Bubble({
  side,
  children,
  flush = false,
  muted = false,
}: {
  side: 'user' | 'bot'
  children: React.ReactNode
  flush?: boolean
  muted?: boolean
}) {
  const isUser = side === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] text-[12px] leading-snug ${
          flush ? '' : 'px-3 py-2'
        } ${
          isUser
            ? `rounded-2xl rounded-br-md bg-black/5 text-black ${muted ? 'opacity-60' : ''}`
            : 'rounded-2xl rounded-bl-md text-white'
        }`}
        style={!isUser ? { background: IG_GRADIENT } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-white/80"
          style={{
            animation: 'blink 1s step-end infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  )
}

export type { MessageType }
