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

// ── Phone shell — iPhone 15 Pro (titanium frame, Dynamic Island) ──────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
        return (
                <div
                        className="relative mx-auto aspect-[9/19.5] w-full max-w-[340px] rounded-[3.2rem] p-[6px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.06)_inset,0_0_0_2px_rgba(0,0,0,0.4)] after:absolute after:inset-0 after:rounded-[3.2rem] after:bg-gradient-to-br after:from-white/5 after:to-transparent after:pointer-events-none"
                        style={{
                                background:
                                        'linear-gradient(180deg, #4a4a4c 0%, #2a2a2c 50%, #1c1c1e 100%)',
                        }}
                        aria-hidden
                >
                        {/* Titanium inner rim */}
                        <div
                                className="pointer-events-none absolute inset-[3px] rounded-[3rem] ring-1 ring-white/5"
                                aria-hidden
                        />

                        {/* Side buttons — Action button + volume up/down + power */}
                        <div className="absolute -start-[3px] top-[15%] h-2 w-[4px] rounded-l bg-[#1c1c1e]" />
                        <div className="absolute -start-[3px] top-[20%] h-8 w-[4px] rounded-l bg-[#1c1c1e]" />
                        <div className="absolute -start-[3px] top-[27%] h-8 w-[4px] rounded-l bg-[#1c1c1e]" />
                        <div className="absolute -start-[3px] top-[34%] h-8 w-[4px] rounded-l bg-[#1c1c1e]" />
                        <div className="absolute -end-[3px] top-[28%] h-16 w-[4px] rounded-r bg-[#1c1c1e]" />

                        {/* Screen */}
                        <div className="relative h-full w-full overflow-hidden rounded-[2.6rem] bg-white">
                                {/* Dynamic Island — black pill, slightly inset */}
                                <div className="absolute left-1/2 top-[10px] z-30 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                                        {/* Tiny camera dot */}
                                        <div className="absolute end-[10px] top-1/2 h-[8px] w-[8px] -translate-y-1/2 rounded-full bg-[#1c1c1e] ring-2 ring-[#222]" />
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
                        className={`relative z-20 flex h-[36px] items-center justify-between px-5 pt-1.5 text-[12px] font-semibold ${fg}`}
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
                >
                        <span className="tracking-tight">9:41</span>
                        <div className="flex items-center gap-[5px]">
                                {/* Signal — 4 ascending bars */}
                                <svg width="16" height="11" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
                                        <rect x="0" y="9" width="3" height="3" rx="0.5" />
                                        <rect x="5" y="6" width="3" height="6" rx="0.5" />
                                        <rect x="10" y="3" width="3" height="9" rx="0.5" />
                                        <rect x="15" y="0" width="3" height="12" rx="0.5" />
                                </svg>
                                {/* Wifi — arcs fan downward (iOS style) */}
                                <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
                                        <path
                                                d="M8 11.2l1.7-2.1a2.2 2.2 0 00-3.4 0L8 11.2z"
                                        />
                                        <path
                                                d="M3.2 5.5a8.2 8.2 0 009.6 0"
                                                stroke="currentColor"
                                                strokeWidth="1.6"
                                                fill="none"
                                                strokeLinecap="round"
                                        />
                                        <path
                                                d="M5.4 7.7a4.6 4.6 0 005.2 0"
                                                stroke="currentColor"
                                                strokeWidth="1.6"
                                                fill="none"
                                                strokeLinecap="round"
                                        />
                                </svg>
                                {/* Battery — rounded rect with fill */}
                                <div dir="ltr" className="flex items-center gap-[1px]">
                                        <div
                                                className={`relative h-[12px] w-[27px] rounded-[3.5px] border ${dark ? 'border-white/50' : 'border-black/40'}`}
                                                style={{ padding: '1.5px' }}
                                        >
                                                <div
                                                        className="h-full rounded-[1.5px] bg-current"
                                                        style={{ width: '100%' }}
                                                />
                                        </div>
                                        <div
                                                className={`h-[4px] w-[1.5px] rounded-r ${dark ? 'bg-white/50' : 'bg-black/40'}`}
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
                followUpEnabled,
                followUpDelayMin,
                followUpMessage,
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

                        {/* Chat header — IG-style */}
                        <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-3 py-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-black rtl:rotate-180" aria-hidden>
                                        <polyline points="15 18 9 12 15 6" />
                                </svg>
                                <Avatar url={accountAvatarUrl} name={accountUsername} size={36} ring />
                                <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-bold text-black leading-tight">
                                                {accountUsername}
                                        </p>
                                        <p className="text-[10px] text-black/60 leading-tight">Active now</p>
                                </div>
                                <Phone className="h-[18px] w-[18px] text-black" strokeWidth={2} />
                                <Video className="h-[20px] w-[20px] text-black" strokeWidth={2} />
                        </div>

                        {/* Messages */}
                        <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3 no-scrollbar">
                                {/* Profile intro pill */}
                                <div className="flex flex-col items-center pt-1 pb-3">
                                        <Avatar url={accountAvatarUrl} name={accountUsername} size={64} ring />
                                        <p className="mt-2 text-[13px] font-bold text-black">{accountUsername}</p>
                                        <p className="text-[10px] text-black/50">Instagram</p>
                                        <button className="mt-2 rounded-lg bg-[#3897f0] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-transform active:scale-95">
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
                                                <span className="text-[10px] text-white/70">دروازه فالو</span>
                                                <span className="mt-0.5 block">برای دریافت محتوا، پیج را فالو کنید و «فالو کردم» را بفرستید.</span>
                                                <button className="mt-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-[10px] text-white">
                                                        فالو کردم
                                                </button>
                                        </Bubble>
                                )}

                                {/* Follow-up message */}
                                {followUpEnabled && followUpMessage?.trim() && (
                                        <>
                                                <div className="my-1 text-center text-[9px] text-black/30">
                                                        بعد از {(followUpDelayMin ?? 60).toLocaleString('fa-IR')} دقیقه
                                                </div>
                                                <Bubble side="bot">{followUpMessage}</Bubble>
                                        </>
                                )}
                        </div>

                        {/* Input bar — IG-style (new 2024 layout) */}
                        <div dir="ltr" className="flex items-center gap-2 border-t border-black/[0.06] px-3 py-2.5 pb-4">
                                <Camera className="h-[22px] w-[22px] shrink-0 text-[#0095f6]" strokeWidth={1.8} />
                                <div className="flex flex-1 items-center gap-2 rounded-[22px] bg-black/[0.05] px-3.5 py-2">
                                        <span className="flex-1 text-[12px] text-black/40">Message...</span>
                                        <Mic className="h-[16px] w-[16px] shrink-0 text-black/50" />
                                </div>
                                <Heart className="h-[22px] w-[22px] shrink-0 text-[#0095f6]" strokeWidth={1.8} />
                        </div>

                        {/* Home indicator */}
                        <div className="absolute bottom-[6px] left-1/2 z-30 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-black/30" />
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
                                <div className="overflow-hidden rounded-2xl rounded-bl-md">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                                src={message.mediaUrl}
                                                alt={message.text || 'preview'}
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
        // VIDEO — thumbnail with play overlay
        if (message.type === 'VIDEO' && message.mediaUrl) {
                return (
                        <Bubble side="bot" flush>
                                <div className="relative overflow-hidden rounded-2xl rounded-bl-md bg-black">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                                src={message.mediaUrl}
                                                alt={message.text || 'video'}
                                                className="block max-h-48 w-full object-cover opacity-90"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-black shadow-lg">
                                                        <svg width="11" height="12" viewBox="0 0 10 11" fill="currentColor" aria-hidden>
                                                                <path d="M0 0 L10 5.5 L0 11 Z" />
                                                        </svg>
                                                </div>
                                        </div>
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
                                <div className="w-[210px] overflow-hidden rounded-2xl rounded-bl-md border border-black/10 bg-white">
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
        // QUICK_REPLY — text bubble + tappable chips as siblings below (IG style)
        if (message.type === 'QUICK_REPLY') {
                const buttons = message.buttons ?? message.quickReplies ?? []
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
                followUpEnabled,
                followUpDelayMin,
                followUpMessage,
        } = props

        const visibleMessages = (messages ?? []).filter(
                (m) => m.type !== 'PRODUCT' || m.productId,
        )

        return (
                <div
                        className="relative flex h-full w-full flex-col"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
                >
                        {/* ── Top 55%: Story viewer ── */}
                        <div className="relative flex h-[55%] flex-col overflow-hidden">
                                {/* Story gradient background */}
                                <div
                                        className="absolute inset-0"
                                        style={{ background: IG_GRADIENT }}
                                        aria-hidden
                                />
                                <div className="absolute inset-0 bg-black/25" aria-hidden />

                                <StatusBar dark />

                                {/* Story progress bar — single segment (this story) */}
                                <div className="relative z-10 flex gap-1 px-3 pt-1">
                                        <div className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30">
                                                <div className="h-full rounded-full bg-white" style={{ width: '65%' }} />
                                        </div>
                                </div>

                                {/* Story header — avatar + @username + 3h + more */}
                                <div className="relative z-10 flex items-center gap-2 px-3 py-2.5">
                                        <Avatar url={accountAvatarUrl} name={accountUsername} size={28} ring />
                                        <p className="text-[12px] font-semibold text-white">{accountUsername}</p>
                                        <span className="text-[11px] text-white/70">۳ ساعت پیش</span>
                                        <MoreHorizontal className="ms-auto h-4 w-4 text-white" />
                                </div>

                                {/* Story body — SAMPLE content (NOT userText, which is the user's reply) */}
                                <div className="relative z-10 flex flex-1 items-center justify-center px-8">
                                        <p className="text-center text-[14px] font-medium leading-relaxed text-white/95">
                                                ✨ استوری نمونه — برای پیش‌نمایش
                                        </p>
                                </div>

                                {/* Reply bar at the bottom of the story zone */}
                                <div className="relative z-20 flex items-center gap-2 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pb-4">
                                        <div className="flex flex-1 items-center rounded-full border border-white/40 bg-black/25 px-4 py-2 backdrop-blur-md">
                                                <span className="text-[12px] text-white/70">Send Message</span>
                                        </div>
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md">
                                                <Heart className="h-4 w-4" />
                                        </div>
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md">
                                                <Send className="h-4 w-4" />
                                        </div>
                                </div>
                        </div>

                        {/* ── Bottom 45%: DM conversation thread (story reply + bot responses) ── */}
                        <div className="flex h-[45%] flex-col bg-white">
                                {/* Separator header */}
                                <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 py-2">
                                        <span className="text-[11px] font-semibold text-black/60">پاسخ به استوری</span>
                                </div>

                                {/* Conversation thread */}
                                <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2.5 no-scrollbar">
                                        {/* User's reply — right-aligned gray bubble */}
                                        <div className="flex justify-end">
                                                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-black/[0.06] px-3 py-1.5 text-[11px] text-black">
                                                        {userText.trim() ? userText : 'پاسخ استوری نمونه…'}
                                                </div>
                                        </div>

                                        {/* Bot responses — left-aligned gradient bubbles */}
                                        {(replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && visibleMessages.length > 0 && (
                                                visibleMessages.map((m) => (
                                                        <div key={m.id} className="flex justify-start">
                                                                <div
                                                                        className="max-w-[80%] rounded-2xl rounded-bl-md px-3 py-1.5 text-[11px] text-white shadow-sm"
                                                                        style={{ background: IG_GRADIENT }}
                                                                >
                                                                        {m.text?.trim() ? m.text : 'متن پاسخ…'}
                                                                </div>
                                                        </div>
                                                ))
                                        )}
                                        {(replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && visibleMessages.length === 0 && (
                                                <div className="flex justify-start">
                                                        <div
                                                                className="max-w-[80%] rounded-2xl rounded-bl-md px-3 py-1.5 text-[11px] text-white/70 shadow-sm"
                                                                style={{ background: IG_GRADIENT }}
                                                        >
                                                                پاسخ خود را بنویسید…
                                                        </div>
                                                </div>
                                        )}
                                        {replyMode === 'AI' && (
                                                <div className="flex justify-start">
                                                        <div
                                                                className="rounded-2xl rounded-bl-md px-3 py-2 text-[11px] text-white shadow-sm"
                                                                style={{ background: IG_GRADIENT }}
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

                                        {/* Follow-up message */}
                                        {followUpEnabled && followUpMessage?.trim() && (
                                                <>
                                                        <div className="my-1 text-center text-[9px] text-black/30">
                                                                بعد از {(followUpDelayMin ?? 60).toLocaleString('fa-IR')} دقیقه
                                                        </div>
                                                        <div className="flex justify-start">
                                                                <div
                                                                        className="max-w-[80%] rounded-2xl rounded-bl-md px-3 py-1.5 text-[11px] text-white shadow-sm"
                                                                        style={{ background: IG_GRADIENT }}
                                                                >
                                                                        {followUpMessage}
                                                                </div>
                                                        </div>
                                                </>
                                        )}
                                </div>
                        </div>

                        {/* Home indicator */}
                        <div className="absolute bottom-[6px] left-1/2 z-30 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-black/30" />
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

                        {/* Mini post header */}
                        <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-3 py-2">
                                <Avatar url={accountAvatarUrl} name={accountUsername} size={32} />
                                <p className="text-[12px] font-semibold text-black">{accountUsername}</p>
                                <span className="text-[11px] text-[#3897f0] font-semibold">• Follow</span>
                                <MoreHorizontal className="ms-auto h-4 w-4 text-black/60" />
                        </div>

                        {/* Square post image area */}
                        <div
                                className="relative flex aspect-square items-center justify-center text-white"
                                style={{ background: IG_GRADIENT }}
                        >
                                <ImageIcon className="h-10 w-10 opacity-80" />
                                <div className="absolute top-2 end-2 rounded-full bg-black/30 px-2 py-0.5 text-[9px] text-white backdrop-blur">
                                        ۱/۱
                                </div>
                        </div>

                        {/* Action row — like, comment, share, save */}
                        <div className="flex items-center gap-3.5 px-3 py-2.5 text-black">
                                <Heart className="h-6 w-6" strokeWidth={1.8} />
                                <MessageCircle className="h-6 w-6 -scale-x-100" strokeWidth={1.8} />
                                <Send className="h-6 w-6 -rotate-12" strokeWidth={1.8} />
                                <Bookmark className="ms-auto h-6 w-6" strokeWidth={1.8} />
                        </div>

                        {/* Likes count + caption */}
                        <p className="px-3 text-[11px] font-semibold text-black">
                                {(1247).toLocaleString('fa-IR')} پسند
                        </p>
                        <p className="px-3 pb-2 text-[11px] text-black leading-snug">
                                <span className="font-semibold">{accountUsername}</span>{' '}
                                پست نمونه برای پیش‌نمایش کامنت‌ها
                        </p>

                        {/* Comments section */}
                        <div className="flex-1 space-y-2.5 overflow-y-auto border-t border-black/[0.06] px-3 py-3 no-scrollbar">
                                <p className="text-[10px] font-semibold text-black/50">کامنت‌ها</p>

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
        const isUser = side === 'user'
        return (
                <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div
                                className={`max-w-[78%] text-[12.5px] leading-relaxed ${
                                        flush ? '' : 'px-3 py-2'
                                } ${
                                        isUser
                                                ? `rounded-2xl rounded-br-md bg-black/[0.06] text-black ${muted ? 'opacity-60' : ''}`
                                                : 'rounded-2xl rounded-bl-md text-white shadow-sm'
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
