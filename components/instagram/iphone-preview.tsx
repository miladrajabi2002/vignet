'use client'

import { memo, useEffect, useState } from 'react'
import {
        Heart,
        Send,
        Image as ImageIcon,
        Mic,
        MoreHorizontal,
        Plus,
        Bookmark,
        MessageCircle,
        KeyRound,
        ShoppingBag,
        Film,
        Check,
        UserPlus,
        Lock,
} from 'lucide-react'
import type {
        AutomationType,
        ReplyMode,
        AutomationMessage,
} from '@/components/instagram/types'
import {
        IG_COLORS,
        IgAvatar,
        IgBubble,
        IgDmScreen,
        IgIncoming,
        IgMeta,
        IgOutgoing,
        IgPhone,
        IgStatusBar,
        IgTimestamp,
        IgTypingDots,
        pt,
        useIgClock,
        type IgDmHeaderProps,
} from '@/components/instagram/ios-kit'
import { cn } from '@/lib/utils'
import { ProductImage } from '@/components/products/product-image'

/**
 * IphonePreview — the scenario builder's live phone preview.
 *
 * Three modes:
 *  - `mode="DIRECT_MESSAGE"` → Instagram DM chat screen
 *  - `mode="STORY"`         → story reply thread
 *  - `mode="COMMENT"`       → Instagram post with comment thread
 *
 * The phone, status bar, DM header, bubbles and composer come from the shared
 * iOS kit (`ios-kit.tsx`) — the same mockup the marketing «اتوماسیون
 * اینستاگرام» demo renders — so the builder shows exactly what the site
 * promises. Memoized and animation-free so it can re-render on every keystroke.
 */

const IG_GRADIENT = 'linear-gradient(45deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)'
const IG_GRADIENT_SOFT = 'linear-gradient(45deg, rgba(245,133,41,0.15) 0%, rgba(221,42,123,0.15) 50%, rgba(129,52,175,0.15) 100%)'

// ── Product preview data (v3.1) ────────────────────────────────────────────
// The scenario builder's product pickers show real thumbnails, but the iPhone
// preview used to render gradient placeholders ("محصول ۱ / قیمت: —"), which
// looked exactly like "the showcase images are broken". These helpers fetch
// the real product rows so the preview mirrors what the DM will actually look
// like — photo, name and price per card. A module-level cache dedupes refetches
// while the form re-renders on every keystroke.

interface PreviewProduct {
        id: string
        name: string
        price: number | null
        images: string[]
}

const productCache = new Map<string, Promise<PreviewProduct | null>>()

function loadProduct(id: string): Promise<PreviewProduct | null> {
        if (!productCache.has(id)) {
                productCache.set(
                        id,
                        fetch(`/api/products/${id}`)
                                .then((r) => (r.ok ? r.json() : null))
                                .then((d) => {
                                        const p = d?.product
                                        if (!p) return null
                                        return {
                                                id: p.id,
                                                name: p.name,
                                                price: p.price ?? null,
                                                images: Array.isArray(p.images) ? p.images.filter((i: unknown) => typeof i === 'string') : [],
                                        }
                                })
                                .catch(() => null),
                )
        }
        return productCache.get(id)!
}

/** undefined = loading, null = not found/failed, object = loaded. */
function usePreviewProduct(id: string | undefined): PreviewProduct | null | undefined {
        const [product, setProduct] = useState<PreviewProduct | null | undefined>(id ? undefined : null)
        useEffect(() => {
                if (!id) {
                        setProduct(null)
                        return
                }
                let cancelled = false
                setProduct(undefined)
                loadProduct(id).then((p) => {
                        if (!cancelled) setProduct(p)
                })
                return () => {
                        cancelled = true
                }
        }, [id])
        return product
}

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
        /** DM funnel: post a short public ack on the comment itself. */
        commentAckEnabled?: boolean
        /** The public ack text rendered as the comment reply bubble. */
        commentAckText?: string
        /** Follow gate enabled? The gate prompt goes out first, then the reply. */
        followGate?: boolean
        /** The operator's custom follow-request text (falls back to the default). */
        gatePrompt?: string
        /** The confirm button's label (falls back to «دنبال کردم»). */
        gateButton?: string
        /** Extra classes for the phone frame (e.g. `max-w-none` to fill a larger stage). */
        frameClassName?: string
}

const DEFAULT_GATE_PROMPT = 'لطفاً ابتدا صفحه ما را دنبال کنید.\nبعد از دنبال کردن، روی دکمه زیر بزنید.'
const DEFAULT_GATE_BUTTON = 'دنبال کردم'

function gateCopy(gatePrompt?: string, gateButton?: string) {
        return {
                prompt: gatePrompt?.trim() || DEFAULT_GATE_PROMPT,
                button: gateButton?.trim() || DEFAULT_GATE_BUTTON,
        }
}

function IphonePreviewBase(props: IphonePreviewProps) {
        return (
                <div aria-hidden>
                        <IgPhone className={cn('max-w-[280px]', props.frameClassName)}>
                                <IgStatusBar />
                                <div className="relative flex min-h-0 flex-1 flex-col">
                                        <Screen {...props} />
                                </div>
                        </IgPhone>
                </div>
        )
}

export const IphonePreview = memo(IphonePreviewBase)

// ── Mode switcher ────────────────────────────────────────────────────────

type ScreenProps = Omit<IphonePreviewProps, 'mode'>

function Screen(props: IphonePreviewProps) {
        if (props.mode === 'STORY') return <StoryScreen {...props} />
        if (props.mode === 'COMMENT') return <CommentScreen {...props} />
        return <DMScreen {...props} />
}

const COMPOSER = { placeholder: 'Message...' }

function dmHeader(accountUsername: string, accountAvatarUrl?: string): IgDmHeaderProps {
        return {
                name: accountUsername,
                subtitle: 'Active now',
                avatar: <IgAvatar size={36} ring="hairline" src={accountAvatarUrl} label={accountUsername} />,
        }
}

function visibleReplies(messages: AutomationMessage[] | undefined) {
        return (messages ?? []).filter(
                (m) =>
                        (m.type !== 'PRODUCT' || m.productId) &&
                        (m.type !== 'PRODUCT_LIST' || (m.productIds && m.productIds.length > 0)),
        )
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
                gatePrompt,
                gateButton,
        } = props
        const time = useIgClock()

        return (
                <IgDmScreen header={dmHeader(accountUsername, accountAvatarUrl)} composer={COMPOSER}>
                        {/* Profile card — how Instagram opens a new conversation */}
                        <div className="flex shrink-0 flex-col items-center" style={{ padding: `${pt(4)} 0 ${pt(10)}` }}>
                                <IgAvatar size={84} src={accountAvatarUrl} label={accountUsername} />
                                <p className="max-w-full truncate font-semibold" style={{ fontSize: pt(17), marginTop: pt(8) }}>
                                        {accountUsername}
                                </p>
                                <p style={{ fontSize: pt(13), color: IG_COLORS.label }}>Instagram</p>
                                <span
                                        className="rounded-lg bg-[#efeff3] font-semibold"
                                        style={{ marginTop: pt(10), padding: `${pt(6)} ${pt(14)}`, fontSize: pt(13) }}
                                >
                                        View profile
                                </span>
                        </div>

                        <IgTimestamp>Today {time}</IgTimestamp>

                        {/* The customer's message (the trigger keyword) */}
                        <IgOutgoing>
                                <IgBubble side="out" muted={!userText.trim()}>
                                        {userText.trim() ? userText : 'کلمه‌کلیدی نمونه…'}
                                </IgBubble>
                        </IgOutgoing>

                        <BotReplyBlock
                                replyMode={replyMode}
                                messages={visibleReplies(messages)}
                                accountUsername={accountUsername}
                                accountAvatarUrl={accountAvatarUrl}
                                followGate={followGate}
                                gatePrompt={gatePrompt}
                                gateButton={gateButton}
                        />
                </IgDmScreen>
        )
}

function StatusPill({ tone = 'neutral', children }: { tone?: 'neutral' | 'danger'; children: React.ReactNode }) {
        return (
                <div className="flex shrink-0 items-center justify-center" style={{ padding: `${pt(8)} 0` }}>
                        <span
                                className={tone === 'danger' ? 'rounded-full bg-red-50 text-red-600' : 'rounded-full bg-black/[0.05] text-[var(--text-muted)]'}
                                style={{ fontSize: pt(13), padding: `${pt(5)} ${pt(12)}` }}
                        >
                                {children}
                        </span>
                </div>
        )
}

function BotReplyBlock({
        replyMode,
        messages,
        accountUsername,
        accountAvatarUrl,
        followGate = false,
        gatePrompt,
        gateButton,
}: {
        replyMode: ReplyMode
        messages: AutomationMessage[]
        accountUsername: string
        accountAvatarUrl?: string
        followGate?: boolean
        gatePrompt?: string
        gateButton?: string
}) {
        if (replyMode === 'SILENT') return <StatusPill>بی‌صدا — پاسخی ارسال نمی‌شود</StatusPill>
        if (replyMode === 'STOP_AI') return <StatusPill tone="danger">پاسخ‌گویی هوش مصنوعی متوقف شد</StatusPill>

        const avatar = <IgAvatar size={28} src={accountAvatarUrl} label={accountUsername} />
        const reply = (
                <IgIncoming avatar={avatar}>
                        {replyMode === 'AI' ? (
                                <IgBubble side="in">
                                        <IgTypingDots />
                                </IgBubble>
                        ) : messages.length === 0 ? (
                                // STATIC or MULTI_MESSAGE with nothing written yet
                                <IgBubble side="in" muted>
                                        پاسخ خود را بنویسید…
                                </IgBubble>
                        ) : (
                                messages.map((m) => <MessageBubble key={m.id} message={m} />)
                        )}
                </IgIncoming>
        )
        if (!followGate) return reply

        // Follow gate — the real order of the conversation: the follow request
        // goes out first, the customer taps the confirm button, and only then
        // does the actual reply arrive.
        const gate = gateCopy(gatePrompt, gateButton)
        return (
                <>
                        <IgIncoming avatar={avatar}>
                                <FollowGateBubble prompt={gate.prompt} button={gate.button} />
                        </IgIncoming>
                        <IgOutgoing>
                                <IgBubble side="out">{gate.button}</IgBubble>
                        </IgOutgoing>
                        <GateStepLabel />
                        {reply}
                </>
        )
}

/** The follow-request message — Button Template style, like the real DM. */
function FollowGateBubble({ prompt, button }: { prompt: string; button: string }) {
        return (
                <IgBubble side="in" flush style={{ width: pt(240) }}>
                        <span
                                className="flex items-center font-semibold"
                                style={{ gap: pt(5), padding: `${pt(9)} ${pt(12)} 0`, fontSize: pt(12), color: IG_COLORS.label }}
                        >
                                <UserPlus aria-hidden style={{ width: pt(13), height: pt(13) }} />
                                فقط برای کسی که هنوز فالو نکرده
                        </span>
                        <p dir="auto" className="whitespace-pre-line" style={{ padding: `${pt(4)} ${pt(12)} ${pt(9)}` }}>
                                {prompt}
                        </p>
                        <span
                                dir="auto"
                                className="block border-t border-black/[0.08] text-center font-semibold"
                                style={{ padding: `${pt(9)} ${pt(12)}`, fontSize: pt(15) }}
                        >
                                {button}
                        </span>
                </IgBubble>
        )
}

function GateStepLabel() {
        return (
                <div className="flex shrink-0 items-center justify-center" style={{ padding: `${pt(2)} 0` }}>
                        <span className="inline-flex items-center rounded-full bg-black/[0.05] font-medium text-[var(--text-muted)]" style={{ gap: pt(5), fontSize: pt(12), padding: `${pt(4)} ${pt(11)}` }}>
                                <Check aria-hidden style={{ width: pt(12), height: pt(12) }} strokeWidth={3} />
                                فالو تأیید شد — پاسخ اصلی ارسال می‌شود
                        </span>
                </div>
        )
}

function ButtonChips({ buttons }: { buttons: NonNullable<AutomationMessage['buttons']> | string[] }) {
        if (buttons.length === 0) return null
        return (
                <div className="flex flex-wrap" style={{ gap: pt(6), marginTop: pt(4) }}>
                        {buttons.map((b, i) => {
                                const btn = typeof b === 'string' ? { title: b } : b
                                return (
                                        <span
                                                key={i}
                                                dir="auto"
                                                className="rounded-full border border-black/15 bg-white font-semibold text-black"
                                                style={{ fontSize: pt(14), padding: `${pt(6)} ${pt(13)}` }}
                                        >
                                                {btn.title}
                                        </span>
                                )
                        })}
                </div>
        )
}

function MessageBubble({ message }: { message: AutomationMessage }) {
        // IMAGE
        if (message.type === 'IMAGE' && message.mediaUrl) {
                return (
                        <IgBubble side="in" flush style={{ width: pt(230) }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                        src={message.mediaUrl}
                                        alt={message.text || 'preview'}
                                        loading="lazy"
                                        decoding="async"
                                        className="block w-full object-cover"
                                        style={{ maxHeight: pt(280) }}
                                />
                                {message.text?.trim() && (
                                        <p dir="auto" style={{ padding: `${pt(8)} ${pt(12)}` }}>{message.text}</p>
                                )}
                        </IgBubble>
                )
        }
        // AUDIO — voice player UI
        if (message.type === 'AUDIO' && message.mediaUrl) {
                return (
                        <IgBubble side="in">
                                <div dir="ltr" className="flex items-center" style={{ gap: pt(10) }}>
                                        <span className="grid shrink-0 place-items-center rounded-full bg-black/10 text-black" style={{ width: pt(30), height: pt(30) }}>
                                                <svg viewBox="0 0 8 9" fill="currentColor" aria-hidden style={{ width: pt(10), height: pt(11) }}>
                                                        <path d="M0 0 L8 4.5 L0 9 Z" />
                                                </svg>
                                        </span>
                                        <span className="flex items-center" style={{ gap: pt(2.5), height: pt(24) }}>
                                                {[7, 12, 5, 11, 8, 14, 6, 10, 9, 13, 5, 11, 7, 9].map((h, i) => (
                                                        <span key={i} className="rounded-full bg-black/55" style={{ width: pt(2.5), height: pt(h * 1.4) }} />
                                                ))}
                                        </span>
                                        <span className="text-black/55" style={{ fontSize: pt(12) }}>0:08</span>
                                </div>
                        </IgBubble>
                )
        }
        // VIDEO — playable video player (like real Instagram DM)
        if (message.type === 'VIDEO' && message.mediaUrl) {
                return (
                        <IgBubble side="in" flush style={{ width: pt(230) }}>
                                <video
                                        src={message.mediaUrl}
                                        controls
                                        playsInline
                                        className="block w-full bg-black object-cover"
                                        style={{ maxHeight: pt(280) }}
                                />
                                {message.text?.trim() && (
                                        <p dir="auto" style={{ padding: `${pt(8)} ${pt(12)}` }}>{message.text}</p>
                                )}
                        </IgBubble>
                )
        }
        // PRODUCT — card view (v3.1: real photo/name/price from /api/products)
        if (message.type === 'PRODUCT' && message.productId) {
                return <ProductCardBubble productId={message.productId} />
        }
        // PRODUCT_LIST — horizontal carousel of product cards (v3.1: real data).
        // Renders up to 3 cards (3 = what visually fits in the phone preview
        // width without overcrowding; the real Instagram carousel supports up
        // to 10 — the preview is just an indicator, not an exact rendering).
        if (message.type === 'PRODUCT_LIST') {
                const ids = (message.productIds ?? []).filter(Boolean)
                if (ids.length === 0) {
                        return (
                                <div className="overflow-hidden border border-black/10 bg-white" style={{ width: pt(230), borderRadius: pt(18) }}>
                                        <div className="flex items-center justify-center text-white" style={{ height: pt(96), background: IG_GRADIENT }}>
                                                <ImageIcon className="opacity-80" style={{ width: pt(30), height: pt(30) }} />
                                        </div>
                                        <div style={{ padding: pt(11) }}>
                                                <p className="font-semibold text-black" style={{ fontSize: pt(14) }}>ویترین محصولات</p>
                                                <p className="text-[var(--text-muted)]" style={{ fontSize: pt(12.5) }}>محصولی اضافه نشده</p>
                                        </div>
                                </div>
                        )
                }
                return (
                        <div className="no-scrollbar flex overflow-x-auto" style={{ width: pt(260), gap: pt(6) }}>
                                {ids.slice(0, 3).map((id) => (
                                        <ProductCardBubble key={id} productId={id} small />
                                ))}
                        </div>
                )
        }
        // QUICK_REPLY — render differently based on buttonType:
        //   'button' (default) → buttons INSIDE the bubble (Button Template style)
        //   'quick_reply'      → chips BELOW the bubble (Quick Reply style)
        if (message.type === 'QUICK_REPLY') {
                const buttons = message.buttons ?? message.quickReplies ?? []
                if (message.buttonType === 'quick_reply') {
                        return (
                                <div className="flex flex-col items-start">
                                        <IgBubble side="in">{message.text?.trim() ? message.text : 'متن پیام…'}</IgBubble>
                                        <ButtonChips buttons={buttons} />
                                </div>
                        )
                }
                // Button Template style: title rows under the text, like real IG
                return (
                        <IgBubble side="in" flush style={{ width: pt(240) }}>
                                <p dir="auto" style={{ padding: `${pt(9)} ${pt(12)}` }}>
                                        {message.text?.trim() ? message.text : 'متن پیام…'}
                                </p>
                                {buttons.map((b, i) => {
                                        const btn = typeof b === 'string' ? { title: b } : b
                                        return (
                                                <span
                                                        key={i}
                                                        dir="auto"
                                                        className="block border-t border-black/[0.08] text-center font-semibold"
                                                        style={{ padding: `${pt(9)} ${pt(12)}`, fontSize: pt(15) }}
                                                >
                                                        {btn.title}
                                                </span>
                                        )
                                })}
                        </IgBubble>
                )
        }
        // TEXT (or fallback)
        const buttons = message.buttons ?? message.quickReplies ?? []
        return (
                <div className="flex flex-col items-start">
                        <IgBubble side="in">{message.text?.trim() ? message.text : 'متن پاسخ…'}</IgBubble>
                        <ButtonChips buttons={buttons} />
                </div>
        )
}

// ── Product card bubble (v3.1) ─────────────────────────────────────────────
// A generic-template product card rendered with the REAL product photo, name
// and price — matching what Instagram shows in the DM. `small` is the carousel
// variant (narrower card inside the PRODUCT_LIST rail).

function ProductCardBubble({ productId, small }: { productId: string; small?: boolean }) {
        const product = usePreviewProduct(productId)
        const img = product?.images?.[0]
        return (
                <div
                        className="shrink-0 overflow-hidden border border-black/10 bg-white"
                        style={{ width: pt(small ? 170 : 230), borderRadius: pt(18) }}
                >
                        <div className="flex items-center justify-center bg-black/[0.04]" style={{ height: pt(small ? 120 : 150) }}>
                                {img ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <ProductImage
                                                src={img}
                                                alt={product?.name ?? 'محصول'}
                                                loading="lazy"
                                                decoding="async"
                                                className="h-full w-full object-cover"
                                        />
                                ) : product === null ? (
                                        <ImageIcon opacity={0.35} style={{ width: pt(30), height: pt(30) }} />
                                ) : (
                                        <div className="animate-pulse rounded bg-black/10" style={{ width: pt(26), height: pt(26) }} />
                                )}
                        </div>
                        <div style={{ padding: pt(small ? 9 : 11) }}>
                                <p className="truncate font-semibold text-black" style={{ fontSize: pt(small ? 13.5 : 14.5) }}>
                                        {product ? product.name : '…'}
                                </p>
                                <p className="text-[var(--text-secondary)]" style={{ fontSize: pt(small ? 12 : 13) }}>
                                        {product === undefined
                                                ? '…'
                                                : product?.price != null
                                                        ? `قیمت: ${product.price.toLocaleString('fa-IR')} تومان`
                                                        : 'بدون قیمت'}
                                </p>
                                <span
                                        className="block rounded-lg bg-[#efeff3] text-center font-semibold text-black"
                                        style={{ marginTop: pt(8), padding: `${pt(small ? 5 : 7)} 0`, fontSize: pt(small ? 12.5 : 13.5) }}
                                >
                                        {small ? 'مشاهده' : 'مشاهده محصول'}
                                </span>
                        </div>
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
                followGate,
                gatePrompt,
                gateButton,
        } = props
        const time = useIgClock()

        return (
                <IgDmScreen header={dmHeader(accountUsername, accountAvatarUrl)} composer={COMPOSER}>
                        {/* Pushes a short thread down to the composer, like the app; long ones still scroll. */}
                        <div aria-hidden className="mt-auto" />
                        <IgTimestamp>Today {time}</IgTimestamp>

                        {/* The customer's story reply — story thumbnail + text, on the RIGHT. */}
                        <IgOutgoing>
                                <IgMeta>You replied to their story</IgMeta>
                                <div
                                        className="relative grid place-items-center overflow-hidden shadow-sm"
                                        style={{ width: pt(72), height: pt(124), borderRadius: pt(12), background: IG_GRADIENT }}
                                >
                                        <span className="font-medium text-white/90" style={{ fontSize: pt(11) }}>Story</span>
                                </div>
                                <IgBubble side="out" muted={!userText.trim()}>
                                        {userText.trim() ? userText : 'پاسخ استوری نمونه…'}
                                </IgBubble>
                        </IgOutgoing>

                        {/* Business replies — on the LEFT, same as DM. */}
                        <BotReplyBlock
                                replyMode={replyMode}
                                messages={visibleReplies(messages)}
                                accountUsername={accountUsername}
                                accountAvatarUrl={accountAvatarUrl}
                                followGate={followGate}
                                gatePrompt={gatePrompt}
                                gateButton={gateButton}
                        />
                </IgDmScreen>
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
                commentAckEnabled,
                commentAckText,
                followGate,
                gatePrompt,
                gateButton,
        } = props
        const gate = followGate && replyMode !== 'SILENT' && replyMode !== 'STOP_AI' ? gateCopy(gatePrompt, gateButton) : null

        // v3.1: comment→DM funnels no longer post a public reply — the DM
        // sequence IS the reply. The public bubble only renders for public
        // random replies (MULTI_MESSAGE without dmOnComment).
        const publicReply = dmOnComment ? '' : (messages[0]?.text ?? '').trim()
        // v3.2: an optional short ack (e.g. «تو دایرکت فرستادم 🌟») is posted
        // as a public reply on the comment after the DM goes out.
        const ackReply =
                dmOnComment && commentAckEnabled ? (commentAckText ?? '').trim() : ''
        const dmMessages = dmOnComment
                ? messages.filter(
                          (m) =>
                                  m.text.trim() ||
                                  m.mediaUrl ||
                                  m.productId ||
                                  (m.productIds && m.productIds.length > 0) ||
                                  (m.buttons && m.buttons.length > 0),
                  )
                : []

        return (
                <div className="flex h-full flex-col bg-white">

                        {/* Mini post header (LTR) */}
                        <div dir="ltr" className="flex items-center gap-2 border-b border-black/[0.06] px-2.5 py-1.5">
                                <IgAvatar size={36} src={accountAvatarUrl} label={accountUsername} />
                                <p className="text-[11px] font-semibold text-black">{accountUsername}</p>
                                <span className="text-[10px] font-semibold text-[#3897f0]">• Follow</span>
                                <MoreHorizontal className="ms-auto h-3.5 w-3.5 text-[var(--text-secondary)]" />
                        </div>

                        {/* Square post image area */}
                        <div
                                className="relative flex aspect-square items-center justify-center text-white"
                                style={{ background: IG_GRADIENT }}
                        >
                                <ImageIcon className="h-8 w-8 opacity-80" />
                                <div className="absolute top-1.5 end-1.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[8px] text-white backdrop-blur">
                                        1/1
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
                                1,247 likes
                        </p>
                        <p className="px-2.5 pb-1.5 text-[10px] text-black leading-snug">
                                <span className="font-semibold">{accountUsername}</span>{' '}
                                پست نمونه برای پیش‌نمایش کامنت‌ها
                        </p>

                        {/* Comments section — dir="ltr" for consistent alignment */}
                        <div dir="ltr" className="flex-1 space-y-2 overflow-y-auto border-t border-black/[0.06] px-2.5 py-2 no-scrollbar">
                                <p className="text-[9px] font-semibold text-[var(--text-muted)]">Comments</p>

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
                                                <div className="mt-0.5 flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
                                                        <span>now</span>
                                                        <span>Reply</span>
                                                </div>
                                        </div>
                                        <Heart className="mt-0.5 h-2.5 w-2.5 text-[var(--text-muted)]" />
                                </div>

                                {/* Follow gate — the commenter first gets a follow request in
                                    DM; the reply below only goes out after they confirm. */}
                                {gate && (
                                        <div dir="rtl" className="rounded-xl border border-black/[0.08] bg-[#f6f6f8] p-2.5">
                                                <p className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-primary)]">
                                                        <Lock className="h-3 w-3" />
                                                        ۱. درخواست فالو در دایرکت
                                                        <span className="font-normal text-[var(--text-muted)]">(فقط غیرفالوورها)</span>
                                                </p>
                                                <div className="mt-1.5 overflow-hidden rounded-lg border border-black/[0.06] bg-white">
                                                        <p dir="auto" className="whitespace-pre-line px-2 py-1.5 text-[11px] leading-snug text-black">{gate.prompt}</p>
                                                        <p dir="auto" className="border-t border-black/[0.06] px-2 py-1 text-center text-[11px] font-semibold text-black">{gate.button}</p>
                                                </div>
                                                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                                                        <Check className="h-3 w-3" strokeWidth={3} />
                                                        {`بعد از زدن «${gate.button}»، پاسخ زیر ارسال می‌شود`}
                                                </p>
                                        </div>
                                )}

                                {/* Bot's reply (if STATIC/MULTI_MESSAGE) */}
                                {(replyMode === 'STATIC' || replyMode === 'MULTI_MESSAGE') && publicReply && (
                                        <div className="flex gap-2 ps-7">
                                                <IgAvatar size={39} src={accountAvatarUrl} label={accountUsername} />
                                                <div className="min-w-0 flex-1">
                                                        <p className="text-[11px] text-black leading-snug">
                                                                <span className="font-semibold">{accountUsername}</span>{' '}
                                                                {publicReply}
                                                        </p>
                                                        <div className="mt-0.5 flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
                                                                <span>now</span>
                                                                <span>Reply</span>
                                                        </div>
                                                </div>
                                                <Heart className="mt-0.5 h-2.5 w-2.5 text-[var(--text-muted)]" />
                                        </div>
                                )}

                                {/* Bot's public comment-ack (v3.2) — a short sent-you-a-DM
                                    line posted under the comment so it is not left
                                    unanswered when the reply goes to DM. */}
                                {ackReply && (
                                        <div className="flex gap-2 ps-7">
                                                <IgAvatar size={39} src={accountAvatarUrl} label={accountUsername} />
                                                <div className="min-w-0 flex-1">
                                                        <p className="text-[11px] text-black leading-snug">
                                                                <span className="font-semibold">{accountUsername}</span>{' '}
                                                                {ackReply}
                                                        </p>
                                                        <div className="mt-0.5 flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
                                                                <span>now</span>
                                                                <span>Reply</span>
                                                        </div>
                                                </div>
                                                <Heart className="mt-0.5 h-2.5 w-2.5 text-[var(--text-muted)]" />
                                        </div>
                                )}

                                {replyMode === 'SILENT' && (
                                        <div className="rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-center text-[10px] text-[var(--text-muted)]">
                                                کامنت بدون ریپلای رها می‌شود
                                        </div>
                                )}

                                {replyMode === 'MULTI_MESSAGE' && messages.length > 1 && (
                                        <div dir="rtl" className="rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-[10px] text-[var(--text-secondary)]">
                                                یکی از {messages.length.toLocaleString('fa-IR')} گزینه به‌صورت تصادفی ریپلای می‌شود
                                        </div>
                                )}

                                {/* DM funnel — renders the builder sequence that will be
                                    delivered to the commenter's DM (v3.1: full rich preview). */}
                                {dmOnComment && (
                                        <div dir="rtl" className="rounded-xl border border-[#dd2a7b]/30 p-2.5" style={{ background: IG_GRADIENT_SOFT }}>
                                                <p className="flex items-center gap-1 text-[10px] font-semibold text-[#dd2a7b]">
                                                        <Send className="h-3 w-3 -rotate-12" />
                                                        {gate ? '۲. ارسال دایرکت' : 'ارسال دایرکت'}
                                                        {dmMessages.length > 0 && (
                                                                <span className="font-normal text-[var(--text-muted)]">
                                                                        ({dmMessages.length.toLocaleString('fa-IR')} پیام)
                                                                </span>
                                                        )}
                                                </p>
                                                {dmMessages.length === 0 ? (
                                                        <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-snug">
                                                                متن دایرکت نمونه…
                                                        </p>
                                                ) : (
                                                        <div className="mt-1.5 space-y-1">
                                                                {dmMessages.map((m) => (
                                                                        <DmEntryRow key={m.id} message={m} />
                                                                ))}
                                                        </div>
                                                )}
                                        </div>
                                )}
                        </div>

                        {/* Comment input bar */}
                        <div className="flex items-center gap-2 border-t border-black/[0.06] px-3 py-2.5 pb-4">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-[10px] font-semibold text-black/70">
                                        U
                                </div>
                                <div className="flex flex-1 items-center rounded-full border border-black/15 px-3 py-1.5">
                                        <span className="text-[11px] text-[var(--text-muted)]">Add a comment…</span>
                                </div>
                                <Plus className="h-4 w-4 text-[#3897f0]" />
                        </div>

                </div>
        )
}

// ── Comment→DM funnel entry row (v3.1) ─────────────────────────────────────
// Compact row inside the "ارسال دایرکت" box: an icon per message type + the
// text (or a type label for media entries) so the operator sees exactly what
// the commenter will receive in DM — same as the DM chat preview, but fitted
// to the comment screen's small canvas.

function DmEntryRow({ message }: { message: AutomationMessage }) {
        const Icon =
                message.type === 'IMAGE'
                        ? ImageIcon
                        : message.type === 'AUDIO'
                                ? Mic
                                : message.type === 'VIDEO'
                                        ? Film
                                        : message.type === 'QUICK_REPLY'
                                                ? KeyRound
                                                : message.type === 'PRODUCT' || message.type === 'PRODUCT_LIST'
                                                        ? ShoppingBag
                                                        : MessageCircle
        const label =
                message.type === 'IMAGE'
                        ? 'عکس'
                        : message.type === 'AUDIO'
                                ? 'پیام صوتی'
                                : message.type === 'VIDEO'
                                        ? 'ویدیو'
                                        : message.type === 'PRODUCT' || message.type === 'PRODUCT_LIST'
                                                ? 'ویترین محصولات'
                                                : ''
        const body = (message.text ?? '').trim()
        // v3.1: product rows show the real product image + name + count.
        if (message.type === 'PRODUCT' || message.type === 'PRODUCT_LIST') {
                const firstId = message.productId ?? message.productIds?.[0]
                const count = message.type === 'PRODUCT_LIST' ? (message.productIds?.length ?? 1) : 1
                if (firstId) return <DmProductRow productId={firstId} count={count} />
        }
        return (
                <div className="flex items-start gap-1.5 rounded-lg bg-white/70 px-2 py-1.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#dd2a7b]">
                                <Icon className="h-3 w-3" />
                        </span>
                        <p className="min-w-0 flex-1 text-[11px] leading-snug text-black">
                                {body ? (
                                        message.type === 'QUICK_REPLY' && message.buttons?.length ? (
                                                <>
                                                        {body}
                                                        <span className="ms-1 text-[var(--text-muted)]">
                                                                + {message.buttons.length.toLocaleString('fa-IR')} کلید
                                                        </span>
                                                </>
                                        ) : (
                                                body
                                        )
                                ) : (
                                        <span className="text-[var(--text-secondary)]">{label}</span>
                                )}
                        </p>
                </div>
        )
}

// ── Comment→DM product row (v3.1) ──────────────────────────────────────────
// A compact row inside the «ارسال دایرکت» box for PRODUCT / PRODUCT_LIST
// entries: real product thumbnail + name + price, with a count badge when the
// showcase carries more than one product.

function DmProductRow({ productId, count }: { productId: string; count: number }) {
        const product = usePreviewProduct(productId)
        const img = product?.images?.[0]
        return (
                <div className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5">
                        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/[0.04]">
                                {img ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <ProductImage src={img} alt={product?.name ?? ''} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                ) : (
                                        <ShoppingBag className="h-4 w-4 text-[var(--text-muted)]" />
                                )}
                        </span>
                        <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-medium leading-snug text-black">
                                        {product ? product.name : '…'}
                                </p>
                                <p className="text-[10px] leading-snug text-[var(--text-muted)]">
                                        {product?.price != null
                                                ? `${product.price.toLocaleString('fa-IR')} تومان`
                                                : product === undefined
                                                        ? '…'
                                                        : 'بدون قیمت'}
                                </p>
                        </div>
                        {count > 1 && (
                                <span className="shrink-0 rounded-full bg-[#dd2a7b]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#dd2a7b]">
                                        {count.toLocaleString('fa-IR')} محصول
                                </span>
                        )}
                </div>
        )
}
