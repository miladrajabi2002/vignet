'use client'

import { useState } from 'react'
import { MessageCircle,
        Bot,
        Headset,
        Sparkles,
        ShoppingBag,
        HelpCircle,
        X,
        Package,
        ArrowLeft,
        ArrowRight,
        type LucideIcon } from 'lucide-react'
import {
        contrastOn,
        resolveCornerRadii,
        WIDGET_FONTS,
        type WidgetSettings,
        type WidgetIcon,
} from '@/lib/widget/config'

export const WIDGET_ICON_COMPONENTS: Record<WidgetIcon, LucideIcon> = {
        chat: MessageCircle,
        bot: Bot,
        headset: Headset,
        sparkles: Sparkles,
        bag: ShoppingBag,
        help: HelpCircle,
}

const FONT_FAMILY_BY_KEY: Record<string, string> = WIDGET_FONTS.reduce(
        (acc, f) => ({ ...acc, [f.value]: f.family }),
        {} as Record<string, string>,
)

/** Shift a hex color toward black (pct<0) or white (pct>0). */
function shade(hex: string, pct: number): string {
        const h = hex.replace('#', '')
        const full =
                h.length === 3
                        ? h
                                        .split('')
                                        .map((x) => x + x)
                                        .join('')
                        : h
        const target = pct < 0 ? 0 : 255
        const p = Math.abs(pct)
        const mix = (v: number) => Math.round(v + (target - v) * p)
        const r = parseInt(full.slice(0, 2), 16) || 0
        const g = parseInt(full.slice(2, 4), 16) || 0
        const b = parseInt(full.slice(4, 6), 16) || 0
        return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

function hexToRgba(hex: string, a: number): string {
        const h = hex.replace('#', '')
        const full =
                h.length === 3
                        ? h
                                        .split('')
                                        .map((x) => x + x)
                                        .join('')
                        : h
        const r = parseInt(full.slice(0, 2), 16) || 0
        const g = parseInt(full.slice(2, 4), 16) || 0
        const b = parseInt(full.slice(4, 6), 16) || 0
        return `rgba(${r},${g},${b},${a})`
}

/**
 * Live, interactive mock of the web widget that mirrors loader.js styling so
 * the owner can preview every appearance setting before saving — including the
 * rich product-card reply the widget renders for catalog recommendations.
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
        const [panelOpen, setPanelOpen] = useState(true)
        const [view, setView] = useState<'chat' | 'intro'>('chat')
        const dark = settings.theme !== 'light'
        const accent = settings.primaryColor
        const accentDeep = shade(accent, -0.22)
        const onAccent = contrastOn(accent)
        const title = settings.headerTitle || agentName
        const Icon = WIDGET_ICON_COMPONENTS[settings.icon] ?? MessageCircle
        const radii = resolveCornerRadii(settings)
        const accentSoft = hexToRgba(accent, 0.13)
        const gradientHead = settings.headerStyle !== 'flat'
        const welcome =
                welcomeMessage ||
                (isRtl ? 'سلام! چطور می‌تونم کمکتون کنم؟' : 'Hi! How can I help you?')
        const fontFamily = FONT_FAMILY_BY_KEY[settings.font] ?? FONT_FAMILY_BY_KEY.vazirmatn

        const c = {
                bg: dark ? '#0e0e11' : '#ffffff',
                head: dark ? '#161619' : '#fbfbfc',
                surface: dark ? '#1c1c21' : '#f3f4f6',
                text: dark ? '#f3f4f6' : '#1a1a1e',
                muted: dark ? '#8b8b94' : '#9298a3',
                border: dark ? 'rgba(255,255,255,.09)' : 'rgba(17,17,20,.08)',
        }
        // Accent as ink on the panel surface — fall back when illegible.
        const accentIsLight = onAccent === '#000000'
        const accentInk = dark ? (accentIsLight ? accent : c.text) : accentIsLight ? c.text : accent

        const gradient = `linear-gradient(135deg, ${accent} 0%, ${accentDeep} 100%)`
        const onLeft = settings.position === 'left'
        const side = onLeft ? { left: 16 } : { right: 16 }
        const ArrowIcon = isRtl ? ArrowLeft : ArrowRight

        const demo = isRtl
                ? {
                                user: 'لپ‌تاپ مناسب برنامه‌نویسی می‌خوام',
                                bot: 'بر اساس نیازتون این مدل رو پیشنهاد می‌دم:',
                                source: 'از کاتالوگ محصول',
                                productName: 'مک‌بوک پرو ۱۴″',
                                productDesc: 'پردازنده M3 Pro، ۱۸GB RAM',
                                productPrice: '۶۵,۰۰۰,۰۰۰ تومان',
                                badge: 'پیشنهاد',
                                actions: ['دیدن مشخصات', 'مقایسه'],
                        }
                : {
                                user: 'I need a laptop for programming',
                                bot: 'Based on your needs, I recommend this model:',
                                source: 'From the product catalog',
                                productName: 'MacBook Pro 14″',
                                productDesc: 'M3 Pro chip, 18GB RAM',
                                productPrice: '$2,499',
                                badge: 'Recommended',
                                actions: ['View specs', 'Compare'],
                        }

        const quickReplies = settings.quickReplies.filter(Boolean)

        return (
                <div
                        dir={isRtl ? 'rtl' : 'ltr'}
                        className="relative h-[500px] overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-base)]"
                        style={{
                                backgroundImage: 'radial-gradient(var(--border-default) 1px, transparent 1px)',
                                backgroundSize: '16px 16px',
                                fontFamily,
                        }}
                >
                        {/* view switch — pill style */}
                        <div className="absolute start-3 top-3 z-10 inline-flex rounded-lg bg-[var(--bg-muted)] p-1 text-[11px]">
                                {(
                                        [
                                                { id: 'chat', label: isRtl ? 'گفتگو و محصول' : 'Chat & product' },
                                                { id: 'intro', label: isRtl ? 'شروع' : 'Welcome' },
                                        ] as const
                                ).map((v) => (
                                        <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => {
                                                        setView(v.id)
                                                        setPanelOpen(true)
                                                }}
                                                className={`rounded-md px-2.5 py-1 font-medium transition-[background-color,color,box-shadow] duration-200 ${
                                                        view === v.id
                                                                ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                }`}
                                        >
                                                {v.label}
                                        </button>
                                ))}
                        </div>

                        {/* Panel */}
                        {panelOpen && (
                                <div
                                        className="absolute bottom-16 flex w-[310px] flex-col overflow-hidden shadow-2xl"
                                        style={{
                                                ...side,
                                                height: 400,
                                                background: c.bg,
                                                color: c.text,
                                                border: `1px solid ${c.border}`,
                                                borderRadius: radii.panel,
                                                animation: 'vgt-preview-pop 0.32s cubic-bezier(.34,1.28,.64,1) both',
                                        }}
                                >
                                        {/* header */}
                                        <div
                                                className="relative flex items-center gap-2.5 p-3"
                                                style={
                                                        gradientHead
                                                                ? { background: gradient }
                                                                : { background: c.head, borderBottom: `1px solid ${c.border}` }
                                                }
                                        >
                                                {gradientHead && (
                                                        <span
                                                                aria-hidden
                                                                className="pointer-events-none absolute inset-0"
                                                                style={{
                                                                        background:
                                                                                'radial-gradient(120% 140% at 85% -20%, rgba(255,255,255,.22), transparent 55%)',
                                                                }}
                                                        />
                                                )}
                                                <div
                                                        className="relative flex h-9 w-9 items-center justify-center rounded-xl"
                                                        style={
                                                                gradientHead
                                                                        ? {
                                                                                        background: 'rgba(255,255,255,.16)',
                                                                                        color: onAccent,
                                                                                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.22)',
                                                                                }
                                                                        : { background: accentSoft, color: accentInk }
                                                        }
                                                >
                                                        <Icon className="h-[18px] w-[18px]" />
                                                        <span
                                                                className="absolute bottom-[-2px] h-2.5 w-2.5 rounded-full bg-green-500"
                                                                style={{
                                                                        insetInlineEnd: -2,
                                                                        border: `2px solid ${gradientHead ? accent : c.head}`,
                                                                        boxShadow: '0 0 0 2px rgba(34,197,94,0.35)',
                                                                        animation: 'vgt-preview-pulse 2s ease-in-out infinite',
                                                                }}
                                                        />
                                                </div>
                                                <div className="relative min-w-0 flex-1">
                                                        <div
                                                                className="truncate text-[13px] font-bold leading-tight"
                                                                style={{ color: gradientHead ? onAccent : c.text }}
                                                        >
                                                                {title}
                                                        </div>
                                                        <div
                                                                className="mt-0.5 truncate text-[11px]"
                                                                style={
                                                                        gradientHead
                                                                                ? { color: onAccent, opacity: 0.72 }
                                                                                : { color: c.muted }
                                                                }
                                                        >
                                                                {settings.subtitle ||
                                                                        (isRtl ? 'آنلاین — پاسخ فوری' : 'Online — instant replies')}
                                                        </div>
                                                </div>
                                                <button
                                                        type="button"
                                                        onClick={() => setPanelOpen(false)}
                                                        aria-label="close"
                                                        className="relative rounded-lg p-1 transition-colors hover:bg-black/10"
                                                        style={{ color: gradientHead ? onAccent : c.muted, opacity: gradientHead ? 0.8 : 1 }}
                                                >
                                                        <X className="h-4 w-4" />
                                                </button>
                                        </div>

                                        {/* body */}
                                        {view === 'intro' ? (
                                                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
                                                        <div
                                                                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                                                                style={{
                                                                        background: `linear-gradient(135deg, ${accentSoft} 0%, transparent 140%)`,
                                                                        color: accentInk,
                                                                        boxShadow: `inset 0 0 0 1px ${hexToRgba(accent, 0.3)}`,
                                                                }}
                                                        >
                                                                <Icon className="h-7 w-7" />
                                                        </div>
                                                        <div
                                                                className="text-[13px] font-medium leading-relaxed"
                                                                style={{ color: c.text, maxWidth: 230 }}
                                                        >
                                                                {welcome}
                                                        </div>
                                                        {quickReplies.length > 0 && (
                                                                <div className="flex max-w-[240px] flex-wrap justify-center gap-1.5">
                                                                        {quickReplies.map((q) => (
                                                                                <span
                                                                                        key={q}
                                                                                        className="cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
                                                                                        style={{
                                                                                                border: `1px solid ${c.border}`,
                                                                                                background: c.bg,
                                                                                                color: c.text,
                                                                                        }}
                                                                                >
                                                                                        {q}
                                                                                </span>
                                                                        ))}
                                                                </div>
                                                        )}
                                                </div>
                                        ) : (
                                                <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
                                                        {/* user bubble */}
                                                        <div
                                                                className="max-w-[84%] self-end px-3 py-2 text-[12px] leading-relaxed"
                                                                style={{
                                                                        background: gradient,
                                                                        color: onAccent,
                                                                        borderRadius: radii.bubble,
                                                                                        borderBottomRightRadius: 5,
                                                                                        boxShadow: `0 4px 12px -4px ${hexToRgba(accent, 0.4)}`,
                                                                }}
                                                        >
                                                                {demo.user}
                                                        </div>

                                                        {/* source chip */}
                                                        <span
                                                                className="inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                                                style={{ border: `1px solid ${c.border}`, background: c.bg, color: c.muted }}
                                                        >
                                                                <Package className="h-3 w-3" />
                                                                {demo.source}
                                                        </span>

                                                        {/* bot bubble */}
                                                        <div
                                                                className="max-w-[84%] self-start px-3 py-2 text-[12px] leading-relaxed"
                                                                style={{
                                                                        background: c.surface,
                                                                        color: c.text,
                                                                        borderRadius: radii.bubble,
                                                                                        borderBottomLeftRadius: 5,
                                                                                }}
                                                        >
                                                                {demo.bot}
                                                        </div>

                                                        {/* product card */}
                                                        <div
                                                                className="w-[92%] self-start overflow-hidden"
                                                                style={{
                                                                        background: c.bg,
                                                                        border: `1px solid ${c.border}`,
                                                                        borderRadius: radii.bubble,
                                                                        boxShadow: '0 10px 30px -14px rgba(0,0,0,.22)',
                                                                }}
                                                        >
                                                                <div className="flex items-center gap-2.5 p-2.5">
                                                                        <div
                                                                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                                                                                style={{
                                                                                        background: gradient,
                                                                                        color: onAccent,
                                                                                        boxShadow: `0 6px 16px -6px ${hexToRgba(accent, 0.4)}`,
                                                                                }}
                                                                        >
                                                                                {demo.productName.trim().charAt(0)}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                                <div className="flex items-center gap-1.5">
                                                                                        <span
                                                                                                className="truncate text-[12px] font-bold"
                                                                                                style={{ color: c.text }}
                                                                                        >
                                                                                                {demo.productName}
                                                                                        </span>
                                                                                        <span
                                                                                                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                                                                                style={{
                                                                                                        color: accentInk,
                                                                                                        background: accentSoft,
                                                                                                        border: `1px solid ${hexToRgba(accent, 0.3)}`,
                                                                                                }}
                                                                                        >
                                                                                                {demo.badge}
                                                                                        </span>
                                                                                </div>
                                                                                <div className="mt-0.5 truncate text-[10.5px]" style={{ color: c.muted }}>
                                                                                        {demo.productDesc}
                                                                                </div>
                                                                                <div className="mt-1 text-[12.5px] font-extrabold" style={{ color: c.text }}>
                                                                                        {demo.productPrice}
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                        </div>

                                                        {/* action chips */}
                                                        <div className="flex flex-wrap gap-1.5">
                                                                {demo.actions.map((a) => (
                                                                        <span
                                                                                key={a}
                                                                                className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-[10.5px] font-semibold"
                                                                                style={{ border: `1px solid ${c.border}`, background: c.bg, color: c.text }}
                                                                        >
                                                                                {a}
                                                                                <ArrowIcon className="h-3 w-3" />
                                                                        </span>
                                                                ))}
                                                        </div>
                                                </div>
                                        )}

                                        {/* input */}
                                        <div className="p-2.5" style={{ borderTop: `1px solid ${c.border}` }}>
                                                <div
                                                        className="flex items-center gap-2 px-3 py-1.5"
                                                        style={{
                                                                background: c.surface,
                                                                border: `1px solid ${c.border}`,
                                                                borderRadius: radii.input,
                                                        }}
                                                >
                                                        <span className="flex-1 text-[12px]" style={{ color: c.muted }}>
                                                                {isRtl ? 'پیام خود را بنویسید…' : 'Type a message…'}
                                                        </span>
                                                        <button
                                                                type="button"
                                                                aria-label="send"
                                                                className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-90"
                                                                style={{
                                                                        background: gradient,
                                                                        color: onAccent,
                                                                        boxShadow: `0 4px 12px -3px ${hexToRgba(accent, 0.5)}`,
                                                                }}
                                                        >
                                                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M22 3 2.6 11.2c-.7.3-.6 1.3.1 1.5l4.5 1.4 1.7 5.2c.2.6 1 .8 1.5.3l2.3-2.1 4.4 3.2c.5.4 1.3.1 1.4-.6L23 4c.2-.8-.5-1.4-1-1z" /></svg>
                                                        </button>
                                                </div>
                                        </div>
                                </div>
                        )}

                        {/* Launcher */}
                        <div
                                className="absolute bottom-4 flex h-12 items-center gap-2 rounded-full px-1 shadow-xl transition-transform hover:scale-[1.04] active:scale-95"
                                style={{ ...side, background: gradient, color: onAccent, borderRadius: 30 }}
                                role="button"
                                onClick={() => setPanelOpen((v) => !v)}
                        >
                                <div className="flex h-10 w-10 items-center justify-center">
                                        {panelOpen ? (
                                                <X className="h-5 w-5" style={{ transition: 'transform .2s' }} />
                                        ) : (
                                                <Icon className="h-5 w-5" style={{ transition: 'transform .2s' }} />
                                        )}
                                </div>
                                {settings.launcherLabel && (
                                        <span className="pe-3 text-[13px] font-semibold">{settings.launcherLabel}</span>
                                )}
                        </div>

                        <style jsx>{`
                                @keyframes vgt-preview-pop {
                                        from {
                                                opacity: 0;
                                                transform: translateY(14px) scale(0.97);
                                        }
                                        to {
                                                opacity: 1;
                                                transform: translateY(0) scale(1);
                                        }
                                }
                                @keyframes vgt-preview-pulse {
                                        0%,
                                        100% {
                                                box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.35);
                                        }
                                        50% {
                                                box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.15);
                                        }
                                }
                        `}</style>
                </div>
        )
}
