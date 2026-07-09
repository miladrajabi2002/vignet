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
        Plus,
        Bookmark,
        MessageCircle,
} from 'lucide-react'
import type {
        AutomationType,
        ReplyMode,
        AutomationMessage,
} from '@/components/instagram/types'

/**
 * IphonePreview — a CSS-only, hyper-realistic iPhone 15 Pro mockup that
 * mirrors the current automation form state.
 *
 * Three modes:
 *  - `mode="DIRECT_MESSAGE"` → Instagram DM chat screen
 *  - `mode="STORY"`         → Instagram story viewer with reply bar
 *  - `mode="COMMENT"`       → Instagram post with comment thread
 *
 * The mockup is intentionally lightweight (memoized, no animation libs) so
 * it can re-render on every keystroke without jank. All visuals are CSS —
 * no images, no external assets. The IG brand gradient
 * (`#f58529 → #dd2a7b → #8134af`) is used for bot bubbles, accents and the
 * story background.
 */

// Instagram 2024 colors — DM bubbles are solid (not gradient).
// User (incoming) bubbles: light gray #efefef.
// Bot (outgoing) bubbles: Instagram blue #5e5ce6 (iOS system indigo, matches the
// screenshot from iPhone 16 Pro). The gradient is reserved for avatars + story bg.
const IG_BLUE = '#5e5ce6'
const IG_GRADIENT = 'linear-gradient(45deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)'
const IG_GRADIENT_SOFT = 'linear-gradient(45deg, rgba(245,133,41,0.15) 0%, rgba(221,42,123,0.15) 50%, rgba(129,52,175,0.15) 100%)'

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

// ── Phone shell — iPhone 16 Pro (titanium frame, Dynamic Island). Compact
// width so the preview doesn't dominate the form column.

function PhoneFrame({ children }: { children: React.ReactNode }) {
        return (
                <div
                        className="relative mx-auto aspect-[9/19.5] w-full max-w-[240px] rounded-[2.4rem] p-[4px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.06)_inset,0_0_0_2px_rgba(0,0,0,0.4)] after:absolute after:inset-0 after:rounded-[2.4rem] after:bg-gradient-to-br after:from-white/5 after:to-transparent after:pointer-events-none"
                        style={{
                                background:
                                        'linear-gradient(180deg, #4a4a4c 0%, #2a2a2c 50%, #1c1c1e 100%)',
                        }}
                        aria-hidden
                >
                        {/* Titanium inner rim */}
                        <div
                                className="pointer-events-none absolute inset-[2px] rounded-[2.4rem] ring-1 ring-white/5"
                                aria-hidden
                        />

                        {/* Side buttons — Action button + volume up/down + power */}
                        <div className="absolute -start-[2px] top-[15%] h-1.5 w-[3px] rounded-l bg-[#1c1c1e]" />
                        <div className="absolute -start-[2px] top-[20%] h-6 w-[3px] rounded-l bg-[#1c1c1e]" />
                        <div className="absolute -start-[2px] top-[27%] h-6 w-[3px] rounded-l bg-[#1c1c1e]" />
                        <div className="absolute -start-[2px] top-[34%] h-6 w-[3px] rounded-l bg-[#1c1c1e]" />
                        <div className="absolute -end-[2px] top-[28%] h-12 w-[3px] rounded-r bg-[#1c1c1e]" />

                        {/* Screen */}
                        <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-white">
                                {/* Dynamic Island — black pill (compact) */}
                                <div className="absolute left-1/2 top-[6px] z-30 h-[18px] w-[58px] -translate-x-1/2 rounded-full bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                                        {/* Tiny camera dot */}
                                        <div className="absolute end-[6px] top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-[#1c1c1e] ring-1 ring-[#222]" />
                                </div>
                                {children}
                        </div>
                </div>
        )
}

// ── Status bar (9:41 + signal + wifi + battery) ───────────────────────────

function StatusBar({ dark = false }: { dark?: boolean }) {
        const fg = dark ? 'text-white' : 'text-black'
        return (
                <div
                        className={`relative z-20 flex h-[26px] items-center justify-between px-3 pt-0.5 text-[10px] font-semibold ${fg}`}
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
                >
                        <span className="tracking-tight">9:41</span>
                        <div className="flex items-center gap-[3px]">
                                {/* Signal — 4 ascending bars (compact) */}
                                <svg width="11" height="7" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
                                        <rect x="0" y="9" width="3" height="3" rx="0.5" />
                                        <rect x="5" y="6" width="3" height="6" rx="0.5" />
                                        <rect x="10" y="3" width="3" height="9" rx="0.5" />
                                        <rect x="15" y="0" width="3" height="12" rx="0.5" />
                                </svg>
                                {/* LTE text (compact) */}
                                <span className="text-[7px] font-medium">LTE</span>
                                {/* Battery — rounded rect with fill (compact) */}
                                <div dir="ltr" className="flex items-center gap-[1px]">
                                        <div
                                                className={`relative h-[9px] w-[19px] rounded-[2.5px] border ${dark ? 'border-white/50' : 'border-black/40'}`}
                                                style={{ padding: '1.5px' }}
                                        >
                                                <div
                                                        className="h-full rounded-[1px] bg-current"
                                                        style={{ width: '100%' }}
                                                />
                                        </div>
                                        <div
                                                className={`h-[3px] w-[1px] rounded-r ${dark ? 'bg-white/50' : 'bg-black/40'}`}
                                        />
                                </div>
                        </div>
                </div>
        )
}

// ── Mode switcher ────────────────────────────────────────────────────────

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
        } = props

        const visibleMessages = (messages ?? []).filter(
                (m) => m.type !== 'PRODUCT' || m.productId,
        )

        return (
                <div
                        className="flex h-full flex-col bg-white"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
                >
                        <StatusBar />

                        {/* ── Chat header — IG DM style (LTR so back button is on the LEFT) ──
                            Back arrow + avatar + username + "Business chat"
                            subtitle + call/video/tag icons on the right. Matches the
                            iPhone 16 Pro screenshot layout. */}
                        <div dir="ltr" className="flex items-center gap-2 border-b border-black/[0.06] px-2.5 py-2">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-black" aria-hidden>
                                        <polyline points="15 18 9 12 15 6" />
                                </svg>
                                <Avatar url={accountAvatarUrl} name={accountUsername} size={32} />
                                <div className="min-w-0 flex-1">
                                        <p className="truncate text-[12px] font-bold leading-tight text-black">
                                                {accountUsername}
                                        </p>
                                        <p className="text-[9px] leading-tight text-black/50">Business chat</p>
                                </div>
                                <Phone className="h-[16px] w-[16px] text-black" strokeWidth={2} />
                                <Video className="h-[17px] w-[17px] text-black" strokeWidth={2} />
                        </div>

                        {/* ── Messages ──
                            dir="ltr" so justify-start (user) = visual LEFT and
                            justify-end (bot) = visual RIGHT — matching Instagram
                            regardless of the page's RTL direction. */}
                        <div dir="ltr" className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2.5 no-scrollbar">
                                {/* Profile preview card (large avatar + username + View Profile) */}
                                <div className="flex flex-col items-center pb-2.5 pt-1">
                                        <Avatar url={accountAvatarUrl} name={accountUsername} size={56} ring />
                                        <p className="mt-1.5 text-[12px] font-bold text-black">{accountUsername}</p>
                                        <p className="text-[9px] text-black/50">Instagram</p>
                                        <button className="mt-1.5 rounded-md bg-[#efefef] px-3 py-1 text-[10px] font-medium text-black transition-transform active:scale-95">
                                                View Profile
                                        </button>
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
                                                <span className="text-[9px] text-white/70">دروازه فالو</span>
                                                <span className="mt-0.5 block">لطفاً ابتدا صفحه ما را دنبال کنید. بعد از دنبال کردن روی دکمه زیر کلیک کنید.</span>
                                                <button className="mt-1.5 inline-flex items-center justify-center rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-white/20">
                                                        دنبال کردم
                                                </button>
                                        </Bubble>
                                )}

                        </div>

                        {/* ── Input bar — IG DM 2024 style ──
                            Blue camera icon + gray pill input (with mic inside) +
                            blue heart outside. Matches the screenshot. */}
                        <div dir="ltr" className="flex items-center gap-2 px-2.5 py-2 pb-3">
                                <Camera className="h-[20px] w-[20px] shrink-0 text-[#5e5ce6]" strokeWidth={1.8} />
                                <div className="flex flex-1 items-center gap-2 rounded-full bg-black/[0.05] px-3 py-1.5">
                                        <span className="flex-1 text-[11px] text-black/40">Message...</span>
                                        <Mic className="h-[14px] w-[14px] shrink-0 text-black/50" />
                                </div>
                                <Heart className="h-[20px] w-[20px] shrink-0 text-[#5e5ce6]" strokeWidth={1.8} />
                        </div>

                        {/* Home indicator */}
                        <div className="absolute bottom-[5px] left-1/2 z-30 h-[4px] w-[90px] -translate-x-1/2 rounded-full bg-black/30" />
                </div>
        )
}

function BotReplyBlock({
        replyMode,
        messages,
}: {
        replyMode: ReplyMode
        messages: AutomationMessage[]
        accountUsername: string
}) {
        if (replyMode === 'SILENT') {
                return (
                        <div className="flex items-center justify-center py-2">
                                <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[10px] text-black/40">
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
                        </Bubble>
                )
        }
        // STATIC or MULTI_MESSAGE → render the messages in order
        if (messages.length === 0) {
                return (
                        <Bubble side="bot" muted>
                                پاسخ خود را بنویسید…
                        </Bubble>
                )
        }
        return (
                <div className="space-y-1.5">
                        {messages.map((m) => (
                                <MessageBubble key={m.id} message={m} />
                        ))}
                </div>
        )
}

function MessageBubble({ message }: { message: AutomationMessage }) {
        // IMAGE
        if (message.type === 'IMAGE' && message.mediaUrl) {
                return (
                        <Bubble side="bot" flush>
                                <div className="overflow-hidden rounded-2xl rounded-br-md">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                                src={message.mediaUrl}
                                                alt={message.text || 'preview'}
                                                loading="lazy"
                                                decoding="async"
                                                className="block max-h-48 w-full object-cover"
                                        />
                                </div>
                                {message.text?.trim() && (
                                        <p className="px-3 py-2 text-[12px] text-white">{message.text}</p>
                                )}
                        </Bubble>
                )
        }
        // AUDIO — voice player UI
        if (message.type === 'AUDIO' && message.mediaUrl) {
                return (
                        <Bubble side="bot">
                                <div className="flex items-center gap-2.5 py-0.5">
                                        <button className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-white">
                                                <svg width="9" height="10" viewBox="0 0 8 9" fill="currentColor" aria-hidden>
                                                        <path d="M0 0 L8 4.5 L0 9 Z" />
                                                </svg>
                                        </button>
                                        <div className="flex h-5 items-center gap-[2px]">
                                                {[7, 12, 5, 11, 8, 14, 6, 10, 9, 13, 5, 11, 7, 9].map((h, i) => (
                                                        <span
                                                                key={i}
                                                                className="w-[2px] rounded-full bg-white/85"
                                                                style={{ height: h }}
                                                        />
                                                ))}
                                        </div>
                                        <span className="text-[10px] text-white/80" dir="ltr">0:08</span>
                                </div>
                        </Bubble>
                )
        }
        // VIDEO — playable video player (like real Instagram DM)
        if (message.type === 'VIDEO' && message.mediaUrl) {
                return (
                        <Bubble side="bot" flush>
                                <div className="relative overflow-hidden rounded-2xl rounded-br-md bg-black">
                                        <video
                                                src={message.mediaUrl}
                                                controls
                                                playsInline
                                                className="block max-h-48 w-full object-cover"
                                        />
                                </div>
                                {message.text?.trim() && (
                                        <p className="px-3 py-2 text-[12px] text-white">{message.text}</p>
                                )}
                        </Bubble>
                )
        }
        // PRODUCT — card view
        if (message.type === 'PRODUCT' && message.productId) {
                return (
                        <Bubble side="bot" flush>
                                <div className="w-[210px] overflow-hidden rounded-2xl rounded-br-md border border-black/10 bg-white">
                                        <div
                                                className="flex h-24 items-center justify-center text-white"
                                                style={{ background: IG_GRADIENT }}
                                        >
                                                <ImageIcon className="h-8 w-8 opacity-80" />
                                        </div>
                                        <div className="p-2.5">
                                                <p className="truncate text-[11px] font-semibold text-black">محصول انتخاب‌شده</p>
                                                <p className="text-[10px] text-black/60">قیمت: —</p>
                                                <button
                                                        className="mt-1.5 w-full rounded-lg py-1 text-[10px] font-medium text-white"
                                                        style={{ background: IG_GRADIENT }}
                                                >
                                                        مشاهده محصول
                                                </button>
                                        </div>
                                </div>
                        </Bubble>
                )
        }
        // QUICK_REPLY — render differently based on buttonType:
        //   'button' (default) → buttons INSIDE the bubble (Button Template style)
        //   'quick_reply'      → chips BELOW the bubble (Quick Reply style)
        if (message.type === 'QUICK_REPLY') {
                const buttons = message.buttons ?? message.quickReplies ?? []
                const isQuickReplyStyle = message.buttonType === 'quick_reply'

                if (isQuickReplyStyle) {
                        // Quick Reply style: chips below the bubble (like the old rendering)
                        return (
                                <div>
                                        <Bubble side="bot">
                                                {message.text?.trim() ? message.text : 'متن پیام…'}
                                        </Bubble>
                                        {buttons.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {buttons.map((b, i) => {
                                                                const btn = typeof b === 'string' ? { title: b } : b
                                                                return (
                                                                        <button
                                                                                key={i}
                                                                                className="rounded-full border border-[#5e5ce6]/30 bg-white px-3 py-1.5 text-[10px] font-medium text-[#5e5ce6] transition-colors hover:bg-[#5e5ce6]/5"
                                                                        >
                                                                                {btn.title}
                                                                        </button>
                                                                )
                                                        })}
                                                </div>
                                        )}
                                </div>
                        )
                }

                // Button Template style: buttons INSIDE the bubble (like real IG)
                return (
                        <Bubble side="bot" flush>
                                <div className="px-3 py-2.5">
                                        <p className="text-[11.5px] leading-relaxed text-white">
                                                {message.text?.trim() ? message.text : 'متن پیام…'}
                                        </p>
                                        <div className="mt-2 space-y-1.5">
                                                {buttons.map((b, i) => {
                                                        const btn = typeof b === 'string' ? { title: b } : b
                                                        return (
                                                                <button
                                                                        key={i}
                                                                        className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-white/20"
                                                                >
                                                                        {btn.title}
                                                                </button>
                                                        )
                                                })}
                                        </div>
                                </div>
                        </Bubble>
                )
        }
        // TEXT (or fallback)
        const buttons = message.buttons ?? message.quickReplies ?? []
        return (
                <div>
                        <Bubble side="bot">
                                {message.text?.trim() ? message.text : 'متن پاسخ…'}
                        </Bubble>
                        {buttons.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {buttons.map((b, i) => {
                                                const btn = typeof b === 'string' ? { title: b } : b
                                                return (
                                                        <button
                                                                key={i}
                                                                className="rounded-full border border-[#3897f0]/30 bg-white px-3.5 py-2 text-[12px] font-medium text-[#3897f0] transition-colors hover:bg-[#3897f0]/5"
                                                        >
                                                                {btn.title}
                                                        </button>
                                                )
                                        })}
                                </div>
                        )}
                </div>
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
        } = props

        const visibleMessages = (messages ?? []).filter(
                (m) => m.type !== 'PRODUCT' || m.productId,
        )

        return (
                <div
                        className="flex h-full flex-col bg-white"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
                >
                        <StatusBar />

                        {/* ── Chat header — same as DM (LTR so back button is on the LEFT) ── */}
                        <div dir="ltr" className="flex items-center gap-2 border-b border-black/[0.06] px-2.5 py-2">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-black" aria-hidden>
                                        <polyline points="15 18 9 12 15 6" />
                                </svg>
                                <Avatar url={accountAvatarUrl} name={accountUsername} size={32} />
                                <div className="min-w-0 flex-1">
                                        <p className="truncate text-[12px] font-bold leading-tight text-black">
                                                {accountUsername}
                                        </p>
                                        <p className="text-[9px] leading-tight text-black/50">Business chat</p>
                                </div>
                                <Phone className="h-[16px] w-[16px] text-black" strokeWidth={2} />
                                <Video className="h-[17px] w-[17px] text-black" strokeWidth={2} />
                        </div>

                        {/* ── Messages — same layout as DM, but with story thumbnail ── */}
                        <div dir="ltr" className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2.5 no-scrollbar">
                                {/* Timestamp */}
                                <div className="text-center text-[8px] text-black/40">19:06</div>

                                {/* "Replied to your story" label + story thumbnail */}
                                <div className="flex flex-col items-center gap-1 py-1">
                                        <p className="text-[9px] text-black/50">Replied to your story</p>
                                        {/* Story thumbnail — vertical, gradient background (sample story) */}
                                        <div
                                                className="relative h-[80px] w-[48px] overflow-hidden rounded-lg shadow-sm"
                                                style={{ background: IG_GRADIENT }}
                                        >
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-[7px] font-medium text-white/90">Story</span>
                                                </div>
                                        </div>
                                </div>

                                {/* User's reply — LEFT-aligned gray bubble (#efefef), same as DM.
                                    In Instagram, incoming messages (from the customer) are on the LEFT. */}
                                <div className="flex justify-start">
                                        <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-[#efefef] px-2.5 py-1.5 text-[11.5px] leading-relaxed text-black">
                                                {userText.trim() ? userText : 'پاسخ استوری نمونه…'}
                                        </div>
                                </div>

                                {/* Bot responses — RIGHT-aligned blue bubbles (#5e5ce6), same as DM.
                                    Outgoing replies (from the business/bot) are on the RIGHT. */}
                                {(replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && visibleMessages.length > 0 && (
                                        visibleMessages.map((m) => (
                                                <div key={m.id} className="space-y-1">
                                                        <MessageBubble message={m} />
                                                </div>
                                        ))
                                )}
                                {(replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && visibleMessages.length === 0 && (
                                        <div className="flex justify-end">
                                                <div
                                                        className="max-w-[78%] rounded-2xl rounded-br-md px-2.5 py-1.5 text-[11.5px] leading-relaxed text-white/70 shadow-sm"
                                                        style={{ background: IG_BLUE }}
                                                >
                                                        پاسخ خود را بنویسید…
                                                </div>
                                        </div>
                                )}
                                {replyMode === 'AI' && (
                                        <div className="flex justify-end">
                                                <div
                                                        className="rounded-2xl rounded-br-md px-2.5 py-2 text-[11px] text-white shadow-sm"
                                                        style={{ background: IG_BLUE }}
                                                >
                                                        <TypingDots />
                                                </div>
                                        </div>
                                )}
                                {replyMode === 'SILENT' && (
                                        <div className="text-center text-[10px] text-black/40">بدون پاسخ خودکار</div>
                                )}
                                {replyMode === 'STOP_AI' && (
                                        <div className="text-center text-[10px] text-red-500">هوش مصنوعی متوقف شد</div>
                                )}

                                {/* "Seen" indicator (like real IG — under the last outgoing message, left-aligned) */}
                                {((replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && visibleMessages.length > 0) && (
                                        <div className="ps-1 text-start text-[8px] text-black/40">Seen just now</div>
                                )}
                        </div>

                        {/* ── Input bar — same as DM ── */}
                        <div dir="ltr" className="flex items-center gap-2 px-2.5 py-2 pb-3">
                                <Camera className="h-[20px] w-[20px] shrink-0 text-[#5e5ce6]" strokeWidth={1.8} />
                                <div className="flex flex-1 items-center gap-2 rounded-full bg-black/[0.05] px-3 py-1.5">
                                        <span className="flex-1 text-[11px] text-black/40">Message...</span>
                                        <Mic className="h-[14px] w-[14px] shrink-0 text-black/50" />
                                </div>
                                <Heart className="h-[20px] w-[20px] shrink-0 text-[#5e5ce6]" strokeWidth={1.8} />
                        </div>

                        {/* Home indicator */}
                        <div className="absolute bottom-[5px] left-1/2 z-30 h-[4px] w-[90px] -translate-x-1/2 rounded-full bg-black/30" />
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
                <div
                        className="flex h-full flex-col bg-white"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
                >
                        <StatusBar />

                        {/* Mini post header (LTR) */}
                        <div dir="ltr" className="flex items-center gap-2 border-b border-black/[0.06] px-2.5 py-1.5">
                                <Avatar url={accountAvatarUrl} name={accountUsername} size={26} />
                                <p className="text-[11px] font-semibold text-black">{accountUsername}</p>
                                <span className="text-[10px] font-semibold text-[#3897f0]">• Follow</span>
                                <MoreHorizontal className="ms-auto h-3.5 w-3.5 text-black/60" />
                        </div>

                        {/* Square post image area */}
                        <div
                                className="relative flex aspect-square items-center justify-center text-white"
                                style={{ background: IG_GRADIENT }}
                        >
                                <ImageIcon className="h-8 w-8 opacity-80" />
                                <div className="absolute top-1.5 end-1.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[8px] text-white backdrop-blur">
                                        ۱/۱
                                </div>
                        </div>

                        {/* Action row — like, comment, share, save */}
                        <div className="flex items-center gap-3 px-2.5 py-1.5 text-black">
                                <Heart className="h-5 w-5" strokeWidth={1.8} />
                                <MessageCircle className="h-5 w-5 -scale-x-100" strokeWidth={1.8} />
                                <Send className="h-5 w-5 -rotate-12" strokeWidth={1.8} />
                                <Bookmark className="ms-auto h-5 w-5" strokeWidth={1.8} />
                        </div>

                        {/* Likes count + caption */}
                        <p className="px-2.5 text-[10px] font-semibold text-black">
                                {(1247).toLocaleString('fa-IR')} پسند
                        </p>
                        <p className="px-2.5 pb-1.5 text-[10px] text-black leading-snug">
                                <span className="font-semibold">{accountUsername}</span>{' '}
                                پست نمونه برای پیش‌نمایش کامنت‌ها
                        </p>

                        {/* Comments section — dir="ltr" for consistent alignment */}
                        <div dir="ltr" className="flex-1 space-y-2 overflow-y-auto border-t border-black/[0.06] px-2.5 py-2 no-scrollbar">
                                <p className="text-[9px] font-semibold text-black/50">کامنت‌ها</p>

                                {/* User's comment (the trigger keyword) */}
                                <div className="flex gap-2">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/10 text-[10px] font-semibold text-black/70">
                                                U
                                        </div>
                                        <div className="min-w-0 flex-1">
                                                <p className="text-[11px] text-black leading-snug">
                                                        <span className="font-semibold">user_123</span>{' '}
                                                        {userText.trim() || 'کامنت نمونه…'}
                                                </p>
                                                <div className="mt-0.5 flex items-center gap-3 text-[9px] text-black/40">
                                                        <span>اکنون</span>
                                                        <span>پاسخ</span>
                                                </div>
                                        </div>
                                        <Heart className="mt-0.5 h-2.5 w-2.5 text-black/30" />
                                </div>

                                {/* Bot's reply (if STATIC/MULTI_MESSAGE) */}
                                {(replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && publicReply && (
                                        <div className="flex gap-2 ps-7">
                                                <Avatar url={accountAvatarUrl} name={accountUsername} size={28} />
                                                <div className="min-w-0 flex-1">
                                                        <p className="text-[11px] text-black leading-snug">
                                                                <span className="font-semibold">{accountUsername}</span>{' '}
                                                                {publicReply}
                                                        </p>
                                                        <div className="mt-0.5 flex items-center gap-3 text-[9px] text-black/40">
                                                                <span>اکنون</span>
                                                                <span>پاسخ</span>
                                                        </div>
                                                </div>
                                                <Heart className="mt-0.5 h-2.5 w-2.5 text-black/30" />
                                        </div>
                                )}

                                {replyMode === 'SILENT' && (
                                        <div className="rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-center text-[10px] text-black/50">
                                                کامنت بدون ریپلای رها می‌شود
                                        </div>
                                )}

                                {replyMode === 'MULTI_MESSAGE' && messages.length > 1 && (
                                        <div className="rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-[10px] text-black/60">
                                                یکی از {messages.length.toLocaleString('fa-IR')} گزینه به‌صورت تصادفی ریپلای می‌شود
                                        </div>
                                )}

                                {/* DM funnel */}
                                {dmOnComment && (
                                        <div className="rounded-xl border border-[#dd2a7b]/30 p-2.5" style={{ background: IG_GRADIENT_SOFT }}>
                                                <p className="flex items-center gap-1 text-[10px] font-semibold text-[#dd2a7b]">
                                                        <Send className="h-3 w-3 -rotate-12" />
                                                        ارسال دایرکت
                                                </p>
                                                <p className="mt-1 text-[11px] text-black leading-snug">
                                                        {dmContent || 'متن دایرکت نمونه…'}
                                                </p>
                                        </div>
                                )}
                        </div>

                        {/* Comment input bar */}
                        <div className="flex items-center gap-2 border-t border-black/[0.06] px-3 py-2.5 pb-4">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-[10px] font-semibold text-black/70">
                                        U
                                </div>
                                <div className="flex flex-1 items-center rounded-full border border-black/15 px-3 py-1.5">
                                        <span className="text-[11px] text-black/40">افزودن کامنت…</span>
                                </div>
                                <Plus className="h-4 w-4 text-[#3897f0]" />
                        </div>

                        {/* Home indicator */}
                        <div className="absolute bottom-[6px] left-1/2 z-30 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-black/30" />
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
                                loading="lazy"
                                decoding="async"
                                className={`shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-white p-[1.5px]' : ''}`}
                                style={{ width: size, height: size }}
                        />
                )
        }
        return (
                <div
                        className={`flex shrink-0 items-center justify-center rounded-full text-white ${ring ? 'ring-2 ring-white p-[1.5px]' : ''}`}
                        style={{
                                width: size,
                                height: size,
                                background: IG_GRADIENT,
                                fontSize: Math.max(10, size * 0.42),
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
        // In Instagram DMs, INCOMING messages (from the customer = "user" side)
        // appear on the LEFT, and OUTGOING replies (from the business/bot) appear
        // on the RIGHT. This matches the iPhone 16 Pro screenshot.
        const isUser = side === 'user'
        return (
                <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                        <div
                                className={`max-w-[78%] text-[11.5px] leading-relaxed ${
                                        flush ? '' : 'px-2.5 py-1.5'
                                } ${
                                        isUser
                                                ? `rounded-2xl rounded-bl-md bg-[#efefef] text-black ${muted ? 'opacity-60' : ''}`
                                                : 'rounded-2xl rounded-br-md text-white shadow-sm'
                                }`}
                                style={!isUser ? { background: IG_BLUE } : undefined}
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
                                        className="inline-block h-1.5 w-1.5 rounded-full bg-white/85"
                                        style={{
                                                animation: 'blink 1.2s ease-in-out infinite',
                                                animationDelay: `${i * 0.18}s`,
                                        }}
                                />
                        ))}
                </span>
        )
}
