'use client'

/* eslint-disable @next/next/no-img-element -- uploaded logo/cover and product photos. */

import { useTranslations } from 'next-intl'
import { Globe, MapPin, Phone, Sparkles, User } from 'lucide-react'
import { COMPOSER_GEOMETRY, SendButton } from '@/components/chat/chat-composer'
import { InstagramIcon } from '@/components/marketing/social-links'
import { chatLinkOpenState, type ChatLinkSettings } from '@/lib/chat-link/config'
import { contrastOn } from '@/lib/widget/config'
import { LATIN_DIGIT_RE, latinDigitToPersian } from '@/lib/agent/parsers/digits'

/** Which screen of the public page the phone shows. */
export type ChatLinkPreviewState = 'intro' | 'lead' | 'chat' | 'closed'

export interface ChatLinkPreviewProduct {
        name: string
        price: string
        imageUrl: string
}

const STATES: { value: ChatLinkPreviewState; labelKey: string }[] = [
        { value: 'intro', labelKey: 'previewIntro' },
        { value: 'lead', labelKey: 'previewLead' },
        { value: 'chat', labelKey: 'previewChat' },
        { value: 'closed', labelKey: 'previewClosed' },
]

/**
 * Phone mock of /c/[slug]. It follows the real page screen by screen — the
 * lead form sits in the body, the welcome bubble and every quick reply are
 * shown — so what the owner edits is what the customer gets. The copy inside
 * the phone is Persian like the public page; only the switcher is translated.
 */
export function ChatLinkPreview({
        name,
        avatar,
        welcomeMessage,
        settings,
        showcase,
        state,
        onState,
}: {
        name: string
        avatar: string | null
        welcomeMessage: string | null
        settings: ChatLinkSettings
        showcase: ChatLinkPreviewProduct[]
        state: ChatLinkPreviewState
        onState: (state: ChatLinkPreviewState) => void
}) {
        const t = useTranslations('chatLink')
        const tConv = useTranslations('conversations')
        const accent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(settings.primaryColor)
                ? settings.primaryColor
                : '#0F0F10'
        const onAccent = contrastOn(accent)
        const monogram = (name || '؟').trim().charAt(0)

        const available: Record<ChatLinkPreviewState, boolean> = {
                intro: true,
                lead: settings.leadCapture,
                chat: true,
                closed: settings.hoursEnabled,
        }
        const shown = available[state] ? state : 'intro'
        const hours = chatLinkOpenState(settings, new Date())
        const closed = shown === 'closed'
        const quickReplies = settings.quickReplies.filter((q) => q.trim())
        const actions = [
                settings.phone && { label: 'تماس', icon: Phone },
                settings.mapUrl && { label: 'مسیریابی', icon: MapPin },
                settings.instagram && { label: 'اینستاگرام', icon: InstagramIcon },
                settings.website && { label: 'سایت', icon: Globe },
        ].filter((item): item is { label: string; icon: typeof Phone } => Boolean(item))

        const face = (size: number) =>
                avatar ? (
                        <img
                                src={avatar}
                                alt=""
                                className="shrink-0 object-cover ring-1 ring-black/10"
                                style={{ width: size, height: size, borderRadius: Math.round(size / 3) }}
                        />
                ) : (
                        <span
                                className="flex shrink-0 items-center justify-center font-semibold ring-1 ring-black/10"
                                style={{
                                        width: size,
                                        height: size,
                                        borderRadius: Math.round(size / 3),
                                        backgroundColor: accent,
                                        color: onAccent,
                                        fontSize: size * 0.4,
                                }}
                        >
                                {monogram}
                        </span>
                )

        return (
                <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs text-[var(--text-secondary)]">{t('livePreview')}</span>
                                <div role="group" aria-label={t('previewScreen')} className="inline-flex rounded-xl border border-[var(--border-default)] bg-white p-0.5">
                                        {STATES.map((item) => (
                                                <button
                                                        key={item.value}
                                                        type="button"
                                                        onClick={() => onState(item.value)}
                                                        disabled={!available[item.value]}
                                                        aria-pressed={shown === item.value}
                                                        className={`rounded-[10px] px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                                                shown === item.value
                                                                        ? 'bg-[#111] text-white'
                                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                        }`}
                                                >
                                                        {t(item.labelKey)}
                                                </button>
                                        ))}
                                </div>
                        </div>

                        <div className="mx-auto w-full max-w-[300px]">
                                <div className="relative overflow-hidden rounded-sheet border-[6px] border-neutral-800 bg-[#f2f2f0] shadow-xl">
                                        {/* Ambient background — the same four treatments as the public page. */}
                                        {settings.background === 'dots' && (
                                                <span
                                                        className="pointer-events-none absolute inset-0"
                                                        style={{
                                                                backgroundImage: 'radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1px)',
                                                                backgroundSize: '14px 14px',
                                                        }}
                                                />
                                        )}
                                        {(settings.background === 'aurora' || settings.background === 'mesh') && (
                                                <>
                                                        <span
                                                                className="pointer-events-none absolute -start-10 -top-10 h-36 w-36 rounded-full blur-3xl"
                                                                style={{ backgroundColor: settings.background === 'mesh' ? accent : '#94a3b8', opacity: 0.18 }}
                                                        />
                                                        <span
                                                                className="pointer-events-none absolute -end-10 bottom-20 h-32 w-32 rounded-full blur-3xl"
                                                                style={{ backgroundColor: accent, opacity: 0.14 }}
                                                        />
                                                </>
                                        )}

                                        <div className="relative flex h-[520px] flex-col bg-white/55">
                                                <div className="flex items-center gap-2.5 border-b border-black/[0.06] bg-white/85 px-3 py-2.5">
                                                        <span className="relative">
                                                                {face(34)}
                                                                {!closed && (
                                                                        <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                                                )}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                                <div className="truncate text-xs font-bold leading-tight text-neutral-900">{name}</div>
                                                                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                                                                        <span className={`h-1.5 w-1.5 rounded-full ${closed ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                                        {closed
                                                                                ? `بسته · از ${faClock(settings.openAt)} باز می‌شود`
                                                                                : hours
                                                                                        ? `باز تا ${faClock(settings.closeAt)} · پاسخ فوری`
                                                                                        : 'آنلاین — پاسخ فوری'}
                                                                </div>
                                                        </div>
                                                </div>

                                                <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
                                                        {shown === 'chat' ? (
                                                                <div dir="ltr" className="mt-auto flex flex-col gap-2">
                                                                        <span dir="rtl" className="max-w-[82%] self-end rounded-2xl rounded-ee-md px-3 py-1.5 text-[12px]" style={{ backgroundColor: accent, color: onAccent }}>
                                                                                {quickReplies[0] ?? 'سلام، قیمت‌ها چطوره؟'}
                                                                        </span>
                                                                        <span dir="rtl" className="max-w-[82%] self-start rounded-2xl rounded-es-md border border-black/[0.07] bg-white px-3 py-1.5 text-[12px] text-neutral-800">
                                                                                سلام! خوشحال می‌شوم راهنمایی‌تان کنم. دنبال چه چیزی هستید؟
                                                                        </span>
                                                                </div>
                                                        ) : (
                                                                <div className="my-auto flex flex-col items-center text-center">
                                                                        {settings.coverUrl && (
                                                                                <img src={settings.coverUrl} alt="" className="aspect-[16/7] w-full rounded-2xl object-cover ring-1 ring-black/[0.06]" />
                                                                        )}
                                                                        <span className={settings.coverUrl ? '-mt-7 rounded-[24px] bg-[#f7f7f5] p-1' : undefined}>{face(58)}</span>
                                                                        {settings.showAiBadge && (
                                                                                <span className="mt-3 inline-flex min-h-6 items-center gap-1 rounded-full border border-black/[0.08] bg-white/85 px-2.5 text-[11px] text-neutral-600">
                                                                                        <Sparkles className="h-2.5 w-2.5" style={{ color: accent }} />
                                                                                        پاسخ فوری با هوش مصنوعی
                                                                                </span>
                                                                        )}
                                                                        <div className="mt-2 text-lg font-bold tracking-tight text-neutral-900">{name}</div>
                                                                        {settings.tagline && (
                                                                                <div className="mt-0.5 max-w-[220px] text-[12px] leading-relaxed text-neutral-500">{settings.tagline}</div>
                                                                        )}
                                                                        {actions.length > 0 && (
                                                                                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                                                                                        {actions.map((item) => (
                                                                                                <span key={item.label} className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white/85 px-2 py-1 text-[11px] font-semibold text-neutral-800">
                                                                                                        <item.icon className="h-3 w-3" />
                                                                                                        {item.label}
                                                                                                </span>
                                                                                        ))}
                                                                                </div>
                                                                        )}
                                                                        {closed && (
                                                                                <p className="mt-3 w-full rounded-xl bg-amber-50 px-3 py-2 text-start text-[11.5px] leading-5 text-amber-900">
                                                                                        {settings.closedMessage ?? 'الان خارج از ساعت کاری هستیم. پیام بگذارید؛ در اولین فرصت پاسخ می‌دهیم.'}
                                                                                </p>
                                                                        )}

                                                                        {shown === 'lead' ? (
                                                                                <div className="mt-4 w-full space-y-2 rounded-2xl border border-black/[0.08] bg-white p-3 text-start">
                                                                                        <p className="text-[12px] text-neutral-700">
                                                                                                {settings.leadCaptureMessage ?? 'برای شروع گفتگو، یک معرفی کوتاه بنویسید:'}
                                                                                        </p>
                                                                                        <div className="flex items-center gap-2 rounded-xl border border-black/[0.14] px-2.5 py-2">
                                                                                                <User className="h-3 w-3 shrink-0 text-neutral-400" />
                                                                                                <span className="text-[12px] text-neutral-400">نام شما</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2 rounded-xl border border-black/[0.14] px-2.5 py-2">
                                                                                                <Phone className="h-3 w-3 shrink-0 text-neutral-400" />
                                                                                                <span className="text-[12px] text-neutral-400">شماره موبایل</span>
                                                                                        </div>
                                                                                        <div className="rounded-xl py-2 text-center text-[12px] font-semibold" style={{ backgroundColor: accent, color: onAccent }}>
                                                                                                شروع گفتگو
                                                                                        </div>
                                                                                        {!settings.leadCaptureRequired && (
                                                                                                <div className="text-center text-[11px] text-neutral-500">رد کردن و شروع گفتگو</div>
                                                                                        )}
                                                                                </div>
                                                                        ) : (
                                                                                <>
                                                                                        {welcomeMessage && (
                                                                                                <div className="mt-4 w-full rounded-2xl rounded-es-md border border-black/[0.07] bg-white/92 px-3 py-2 text-start text-[12px] leading-6 text-neutral-800">
                                                                                                        {welcomeMessage}
                                                                                                </div>
                                                                                        )}
                                                                                        {settings.showcase && showcase.length > 0 && (
                                                                                                <div className="mt-3 flex w-full gap-1.5 overflow-hidden">
                                                                                                        {showcase.slice(0, 3).map((product) => (
                                                                                                                <div key={product.name} className="min-w-0 flex-1 rounded-xl border border-black/[0.07] bg-white p-1 text-start">
                                                                                                                        <img src={product.imageUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />
                                                                                                                        <div className="mt-1 truncate px-0.5 text-[10.5px] font-semibold text-neutral-800">{product.name}</div>
                                                                                                                        <div className="truncate px-0.5 text-[10px] text-neutral-500">{product.price}</div>
                                                                                                                </div>
                                                                                                        ))}
                                                                                                </div>
                                                                                        )}
                                                                                        {quickReplies.length > 0 && (
                                                                                                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                                                                                                        {quickReplies.map((q, i) => (
                                                                                                                <span key={i} className="rounded-full border border-black/10 bg-white/85 px-2.5 py-1 text-[12px] text-neutral-700">
                                                                                                                        {q}
                                                                                                                </span>
                                                                                                        ))}
                                                                                                </div>
                                                                                        )}
                                                                                </>
                                                                        )}
                                                                </div>
                                                        )}
                                                </div>

                                                {/* The lead form replaces the composer on the real page, too. */}
                                                {shown !== 'lead' && (
                                                        <div className="border-t border-black/[0.06] bg-white/85 px-3 py-2.5">
                                                                {/* Same pill as the shared composer: dir=ltr so the send button is
                                                                    on the visual right, radius/min-height from COMPOSER_GEOMETRY. */}
                                                                <div
                                                                        dir="ltr"
                                                                        className="flex items-end gap-2 border border-black/[0.09] bg-white px-2 py-1.5 shadow-[var(--shadow-xs)]"
                                                                        style={{ borderRadius: COMPOSER_GEOMETRY.pillRadius }}
                                                                >
                                                                        <span
                                                                                dir="rtl"
                                                                                className="flex flex-1 items-center px-2 text-[12px] text-neutral-400"
                                                                                style={{ minHeight: COMPOSER_GEOMETRY.textareaMinHeight }}
                                                                        >
                                                                                پیام خود را بنویسید…
                                                                        </span>
                                                                        {/* Inert by design — a preview has nothing to send. The opacity
                                                                            override keeps the brand color readable while disabled. */}
                                                                        <SendButton
                                                                                disabled
                                                                                label={tConv('send')}
                                                                                className="disabled:cursor-default disabled:opacity-100"
                                                                                style={{ backgroundColor: accent, color: onAccent }}
                                                                        />
                                                                </div>
                                                        </div>
                                                )}
                                        </div>
                                </div>
                        </div>
                </div>
        )
}

/** '09:30' → '۹:۳۰' ('' stays a dash so a half-set schedule is visible). */
function faClock(value: string): string {
        if (!value) return '—'
        const [hour, minute] = value.split(':')
        return `${Number(hour)}:${minute}`.replace(LATIN_DIGIT_RE, latinDigitToPersian)
}
