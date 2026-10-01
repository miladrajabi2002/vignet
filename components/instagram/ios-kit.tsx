'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
        Camera,
        ChevronLeft,
        ChevronRight,
        CirclePlus,
        Image as ImageIcon,
        MessageSquareMore,
        Mic,
        Phone,
        Send,
        Tag,
        Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Instagram iOS (light) kit — the ONE phone mockup behind both the marketing
 * «اتوماسیون اینستاگرام» demo and the dashboard scenario-builder preview.
 *
 * Sizing: `IgPhone` makes its screen an inline-size container and sets
 * `--pt` to 1/393 of its width, so everything below is written in iOS points
 * (`pt(44)`) and renders proportional to a real iPhone 15 Pro at any mockup
 * width — 280px in the dashboard, 320px on the site.
 *
 * Direction: Instagram's chrome stays LTR in every locale (back on the left;
 * call / video / label on the right; camera on the left of the composer), the
 * way Iranian users actually see the app. Only message text follows its own
 * language. Messages keep Vigent's rule: customer on the RIGHT, business on
 * the LEFT.
 */

/** iOS points → CSS length; valid anywhere inside `IgPhone`. */
export const pt = (n: number) => `calc(var(--pt) * ${n})`

export const IG_COLORS = {
        incoming: '#efeff3',
        /** Sent bubbles shift from indigo (newest, near the composer) to purple (older, higher up). */
        sentNew: '#5a50f5',
        sentOld: '#8d3cf2',
        accent: '#5a50f5',
        label: '#86868b',
} as const

/** Height of the DM header overlay, in pt. */
export const IG_HEADER_H = 68

// ── Phone ────────────────────────────────────────────────────────────────

export function IgPhone({
        children,
        tone = 'light',
        className,
}: {
        children: ReactNode
        /** Screen tone under the home indicator (dark for the story viewer). */
        tone?: 'light' | 'dark'
        className?: string
}) {
        const sideButton = 'absolute w-[1.1%] bg-gradient-to-b from-[#536079] to-[#1d2536]'
        return (
                <div dir="ltr" className={cn('relative mx-auto w-full', className)}>
                        <span aria-hidden className={cn(sideButton, '-left-[0.9%] top-[15%] h-[4%] rounded-l-full')} />
                        <span aria-hidden className={cn(sideButton, '-left-[0.9%] top-[21.5%] h-[6.8%] rounded-l-full')} />
                        <span aria-hidden className={cn(sideButton, '-left-[0.9%] top-[30%] h-[6.8%] rounded-l-full')} />
                        <span aria-hidden className={cn(sideButton, '-right-[0.9%] top-[23%] h-[9.6%] rounded-r-full')} />
                        <div
                                className="relative bg-[linear-gradient(145deg,#46536c_0%,#151c2b_24%,#070a10_70%,#344057_100%)] p-[2.1%] shadow-[var(--elev-2)] ring-1 ring-white/20"
                                style={{ borderRadius: '15% / 7%' }}
                        >
                                <div
                                        className="relative flex aspect-[393/852] w-full flex-col overflow-hidden bg-white text-black"
                                        style={{
                                                borderRadius: '13.6% / 6.3%',
                                                containerType: 'inline-size',
                                                ['--pt' as string]: 'calc(100cqw / 393)',
                                        } as CSSProperties}
                                >
                                        <span
                                                aria-hidden
                                                className="absolute left-1/2 z-40 -translate-x-1/2 rounded-full bg-black"
                                                style={{ top: pt(11), width: pt(125), height: pt(37) }}
                                        />
                                        {children}
                                        <span
                                                aria-hidden
                                                className={cn(
                                                        'pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 rounded-full',
                                                        tone === 'dark' ? 'bg-white/70' : 'bg-black',
                                                )}
                                                style={{ bottom: pt(8), width: pt(139), height: pt(5) }}
                                        />
                                </div>
                        </div>
                </div>
        )
}

// ── Status bar ───────────────────────────────────────────────────────────

/**
 * The viewer's real clock, re-read every 15s, written the way the iPhone in
 * the reference shows it («01:07», Latin digits in every locale). Empty until
 * mounted so server and client markup match.
 */
export function useIgClock() {
        const [now, setNow] = useState<Date | null>(null)
        useEffect(() => {
                setNow(new Date())
                const timer = window.setInterval(() => setNow(new Date()), 15_000)
                return () => window.clearInterval(timer)
        }, [])
        return now ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now) : ''
}

export function IgStatusBar({
        tone = 'light',
        overlay = false,
}: {
        tone?: 'light' | 'dark'
        /** Float over the screen (transparent) so full-bleed screens run under it. */
        overlay?: boolean
}) {
        const time = useIgClock()
        const dark = tone === 'dark'
        return (
                <div
                        dir="ltr"
                        aria-hidden
                        className={cn(
                                'z-30 flex shrink-0 items-center justify-between font-semibold transition-colors duration-300',
                                overlay ? 'absolute inset-x-0 top-0' : 'relative',
                                dark ? 'text-white' : 'text-black',
                                overlay ? 'bg-transparent' : dark ? 'bg-black' : 'bg-white',
                        )}
                        style={{ height: pt(54), paddingTop: pt(5) }}
                >
                        <span className="text-center tabular-nums leading-none" style={{ width: pt(134), fontSize: pt(17), paddingLeft: pt(8) }}>
                                {time}
                        </span>
                        <span className="flex items-center justify-center" style={{ width: pt(134), gap: pt(5), paddingRight: pt(6) }}>
                                <svg viewBox="0 0 18 12" fill="currentColor" style={{ width: pt(17), height: pt(11) }}>
                                        <rect x="0" y="8" width="3" height="4" rx="0.8" />
                                        <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
                                        <rect x="10" y="3" width="3" height="9" rx="0.8" />
                                        <rect x="15" y="0" width="3" height="12" rx="0.8" opacity="0.35" />
                                </svg>
                                {/* «LTE» drawn as glyphs: the Persian site font forces its own
                                    Latin, which sat off the icons' baseline. */}
                                <svg viewBox="0 0 20 11" fill="currentColor" style={{ width: pt(18.5), height: pt(10) }}>
                                        <path d="M0 0h2.3v8.9H6.4V11H0Z" />
                                        <path d="M6.9 0h6.6v2.1h-2.15V11H9.05V2.1H6.9Z" />
                                        <path d="M14.2 0H20v2.05h-3.5v2.4h3.2v2h-3.2v2.5H20V11h-5.8Z" />
                                </svg>
                                <svg viewBox="0 0 27 13" fill="none" style={{ width: pt(25), height: pt(12) }}>
                                        <rect x="0.75" y="0.75" width="22.5" height="11.5" rx="3.6" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
                                        <rect x="2.5" y="2.5" width="11" height="8" rx="2" fill="currentColor" />
                                        <path d="M25 4.3v4.4c1-.3 1.6-1.1 1.6-2.2S26 4.6 25 4.3Z" fill="currentColor" fillOpacity="0.45" />
                                </svg>
                        </span>
                </div>
        )
}

// ── Avatar ───────────────────────────────────────────────────────────────

export function IgAvatar({
        size,
        src,
        label,
        ring = 'none',
        background = 'linear-gradient(45deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)',
        className,
}: {
        /** Diameter in pt. */
        size: number
        src?: string
        label: string
        ring?: 'none' | 'hairline'
        background?: string
        className?: string
}) {
        const [failedSrc, setFailedSrc] = useState<string | null>(null)
        const initial = (label || 'V').charAt(0).toUpperCase()
        const face =
                src && failedSrc !== src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                                src={src}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={() => setFailedSrc(src)}
                                className="block h-full w-full rounded-full object-cover"
                        />
                ) : (
                        <span
                                className="grid h-full w-full place-items-center rounded-full font-semibold text-white"
                                style={{ background, fontSize: pt(size * 0.42) }}
                        >
                                {initial}
                        </span>
                )
        if (ring === 'hairline') {
                return (
                        <span
                                aria-hidden
                                className={cn('block shrink-0 rounded-full bg-white ring-1 ring-black/10', className)}
                                style={{ width: pt(size + 4), height: pt(size + 4), padding: pt(2) }}
                        >
                                {face}
                        </span>
                )
        }
        return (
                <span aria-hidden className={cn('block shrink-0', className)} style={{ width: pt(size), height: pt(size) }}>
                        {face}
                </span>
        )
}

// ── DM header ────────────────────────────────────────────────────────────

function GlassButton({ children }: { children: ReactNode }) {
        return (
                <span
                        aria-hidden
                        className="grid shrink-0 place-items-center rounded-full bg-white/90 text-black shadow-[var(--elev-1)] ring-1 ring-black/[0.07]"
                        style={{ width: pt(42), height: pt(42) }}
                >
                        {children}
                </span>
        )
}

const icon = (n: number): CSSProperties => ({ width: pt(n), height: pt(n) })

export interface IgDmHeaderProps {
        name: ReactNode
        subtitle?: ReactNode
        /** Usually an `IgAvatar` with `size={36} ring="hairline"`. */
        avatar: ReactNode
}

/**
 * iOS 26 Instagram DM header — round glass buttons floating over a soft
 * white fade, so the thread scrolls underneath like the real app.
 */
export function IgDmHeader({ name, subtitle, avatar, topInset = 0 }: IgDmHeaderProps & { topInset?: number }) {
        return (
                <div dir="ltr" className="absolute inset-x-0 top-0 z-20" style={{ height: pt(topInset + IG_HEADER_H + 16) }}>
                        <div
                                aria-hidden
                                className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.9)_68%,rgba(255,255,255,0)_100%)] backdrop-blur-md [mask-image:linear-gradient(to_bottom,#000_62%,transparent)]"
                        />
                        <div className="relative flex items-center" style={{ height: pt(IG_HEADER_H), marginTop: pt(topInset), paddingLeft: pt(12), paddingRight: pt(11) }}>
                                <GlassButton>
                                        <ChevronLeft style={{ ...icon(25), marginLeft: pt(-2) }} strokeWidth={2.1} />
                                </GlassButton>
                                <span className="shrink-0" style={{ marginLeft: pt(6) }}>{avatar}</span>
                                <div className="min-w-0 flex-1" style={{ marginLeft: pt(8), marginRight: pt(6) }}>
                                        <p className="flex min-w-0 items-center font-semibold leading-tight" style={{ fontSize: pt(17), gap: pt(3) }}>
                                                <span className="truncate">{name}</span>
                                                <ChevronRight className="shrink-0" style={icon(15)} strokeWidth={2.6} aria-hidden />
                                        </p>
                                        {subtitle ? (
                                                <p className="truncate text-black/70" style={{ fontSize: pt(13), lineHeight: 1.35, marginTop: pt(1) }}>
                                                        <bdi>{subtitle}</bdi>
                                                </p>
                                        ) : null}
                                </div>
                                <span className="flex shrink-0 items-center" style={{ gap: pt(9) }}>
                                        <GlassButton><Phone style={icon(20)} strokeWidth={1.9} /></GlassButton>
                                        <GlassButton><Video style={icon(21)} strokeWidth={1.9} /></GlassButton>
                                        <GlassButton><Tag style={icon(20)} strokeWidth={1.9} /></GlassButton>
                                </span>
                        </div>
                </div>
        )
}

// ── DM screen: header overlay + thread + composer ────────────────────────

export function IgDmScreen({
        header,
        composer,
        anchor = 'top',
        live = false,
        topInset = 0,
        children,
}: {
        header: IgDmHeaderProps
        composer: IgComposerProps
        /** pt reserved at the top for an overlay status bar. */
        topInset?: number
        /** `bottom` keeps the newest message above the composer (animated demos). */
        anchor?: 'top' | 'bottom'
        live?: boolean
        children: ReactNode
}) {
        return (
                <div className="relative flex h-full min-h-0 flex-col bg-white text-black">
                        <IgDmHeader {...header} topInset={topInset} />
                        <div
                                dir="ltr"
                                aria-live={live ? 'polite' : undefined}
                                className={cn(
                                        'no-scrollbar flex min-h-0 flex-1 flex-col',
                                        anchor === 'bottom' ? 'justify-end overflow-hidden' : 'overflow-y-auto',
                                )}
                                style={{
                                        gap: pt(6),
                                        paddingTop: pt(topInset + IG_HEADER_H + 8),
                                        paddingBottom: pt(8),
                                        paddingLeft: pt(15),
                                        paddingRight: pt(9),
                                }}
                        >
                                {children}
                        </div>
                        <IgComposer {...composer} />
                </div>
        )
}

// ── Thread atoms ─────────────────────────────────────────────────────────

/** Centered day/time divider — «YESTERDAY 12:41». */
export function IgTimestamp({ children }: { children: ReactNode }) {
        return (
                <p
                        className="shrink-0 text-center font-medium uppercase"
                        style={{ color: IG_COLORS.label, fontSize: pt(12), letterSpacing: '0.02em', margin: `${pt(6)} 0 ${pt(4)}` }}
                >
                        <bdi>{children}</bdi>
                </p>
        )
}

/** Small grey caption — «Seen», «You replied to their story». */
export function IgMeta({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' }) {
        return (
                <p
                        className={cn('shrink-0', align === 'end' ? 'text-right' : 'text-left')}
                        style={{ color: IG_COLORS.label, fontSize: pt(13), paddingInline: pt(8) }}
                >
                        <bdi>{children}</bdi>
                </p>
        )
}

/**
 * Sent bubbles read `--ig-tone` (0 = newest/indigo … 1 = older/purple). Rows
 * set it from their distance to the bottom of the thread, so the colour
 * drifts upward as new messages arrive — Instagram's scroll gradient in CSS.
 */
export const IG_SENT_ROW =
        '[--ig-tone:0] [&:nth-last-child(2)]:[--ig-tone:0.22] [&:nth-last-child(3)]:[--ig-tone:0.44] [&:nth-last-child(4)]:[--ig-tone:0.66] [&:nth-last-child(5)]:[--ig-tone:0.85] [&:nth-last-child(n+6)]:[--ig-tone:1]'

const SENT_BG = `color-mix(in oklab, ${IG_COLORS.sentOld} calc(var(--ig-tone, 0) * 100%), ${IG_COLORS.sentNew})`

export function IgBubble({
        side,
        children,
        flush = false,
        muted = false,
        dir = 'auto',
        className,
        style,
}: {
        side: 'in' | 'out'
        children: ReactNode
        /** No padding (media, cards); content is clipped to the bubble. */
        flush?: boolean
        muted?: boolean
        dir?: 'auto' | 'rtl' | 'ltr'
        className?: string
        style?: CSSProperties
}) {
        const out = side === 'out'
        return (
                <div
                        dir={dir}
                        className={cn('min-w-0 max-w-full break-words', out ? 'text-white' : 'text-black', flush && 'overflow-hidden', muted && 'opacity-60', className)}
                        style={{
                                fontSize: pt(16.5),
                                lineHeight: 1.5,
                                borderRadius: pt(20),
                                padding: flush ? undefined : `${pt(8)} ${pt(12)}`,
                                background: out ? SENT_BG : IG_COLORS.incoming,
                                transition: out ? 'background-color 600ms ease' : undefined,
                                ...style,
                        }}
                >
                        {children}
                </div>
        )
}

/** Customer (phone owner) row — right side, IG purple→indigo. */
export function IgOutgoing({ children, className }: { children: ReactNode; className?: string }) {
        return (
                <div className={cn('ml-auto flex max-w-[76%] shrink-0 flex-col items-end', IG_SENT_ROW, className)} style={{ gap: pt(2) }}>
                        {children}
                </div>
        )
}

/** Business row — left side; the avatar sits beside the group's last bubble. */
export function IgIncoming({ avatar, children, className }: { avatar: ReactNode; children: ReactNode; className?: string }) {
        return (
                <div className={cn('flex max-w-[86%] shrink-0 items-end', className)} style={{ gap: pt(10) }}>
                        {avatar}
                        <div className="flex min-w-0 flex-col items-start" style={{ gap: pt(2) }}>
                                {children}
                        </div>
                </div>
        )
}

export function IgTypingDots() {
        return (
                <span
                        className="inline-flex items-center align-middle"
                        style={{ gap: pt(4), height: pt(24), ['--chat-typing-accent' as string]: '#1c1c1e' } as CSSProperties}
                >
                        {[0, 1, 2].map((dot) => (
                                <span key={dot} className="chat-typing-dot" style={{ width: pt(7.5), height: pt(7.5) }} />
                        ))}
                </span>
        )
}

// ── Composer ─────────────────────────────────────────────────────────────

export interface IgComposerProps {
        placeholder: string
        /** Text being typed (with a caret); swaps the tool icons for a send button. */
        draft?: ReactNode
}

export function IgComposer({ placeholder, draft }: IgComposerProps) {
        const typing = draft !== undefined && draft !== null && draft !== false
        return (
                <div dir="ltr" className="relative z-10 shrink-0 bg-white" style={{ padding: `${pt(4)} ${pt(8)} ${pt(36)}` }}>
                        <div
                                className="flex items-center rounded-full bg-[#f1f1f4]"
                                style={{ height: pt(44), paddingLeft: pt(5), paddingRight: pt(typing ? 5 : 13), gap: pt(9) }}
                        >
                                <span
                                        aria-hidden
                                        className="grid shrink-0 place-items-center rounded-full text-white"
                                        style={{ width: pt(34), height: pt(34), background: IG_COLORS.accent }}
                                >
                                        <Camera style={icon(18)} strokeWidth={2.2} />
                                </span>
                                <span className="flex min-w-0 flex-1 items-center overflow-hidden" style={{ fontSize: pt(16.5) }}>
                                        {typing ? (
                                                <span className="flex min-w-0 items-center text-black">{draft}</span>
                                        ) : (
                                                <bdi className="truncate" style={{ color: '#8e8e93' }}>{placeholder}</bdi>
                                        )}
                                </span>
                                {typing ? (
                                        <span
                                                aria-hidden
                                                className="grid shrink-0 place-items-center rounded-full text-white"
                                                style={{ width: pt(34), height: pt(34), background: IG_COLORS.accent }}
                                        >
                                                <Send style={{ ...icon(16), marginLeft: pt(-1) }} strokeWidth={2.2} />
                                        </span>
                                ) : (
                                        <span aria-hidden className="flex shrink-0 items-center text-[#1c1c1e]" style={{ gap: pt(16) }}>
                                                <Mic style={icon(21)} strokeWidth={1.9} />
                                                <ImageIcon style={icon(21)} strokeWidth={1.9} />
                                                <MessageSquareMore style={icon(21)} strokeWidth={1.9} />
                                                <CirclePlus style={icon(22)} strokeWidth={1.9} />
                                        </span>
                                )}
                        </div>
                </div>
        )
}
