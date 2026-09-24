'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLocale } from 'next-intl'

const COPY = {
        fa: {
                title: 'جلوتر از بقیه کسب‌وکارها باشید',
                description: 'فروش و پشتیبانی را به ویجنت بسپارید؛ شما روی رشد تمرکز کنید.',
                button: 'شروع رایگان — یک ماه',
                aria: 'ویجنت، مرکز هوشمند ارتباط با مشتری',
        },
        en: {
                title: 'Stay ahead of every other business',
                description: 'Let Vigent handle sales and support while you focus on growth.',
                button: 'Start free — one month',
                aria: 'Vigent intelligent customer operations',
        },
} as const

/**
 * Final CTA — the lamp of light above the heading is writora.xyz's
 * "Step into the Future of AI Content Creation" spotlight, copied verbatim
 * (conic wings + white mask overlays + blur band + glass strip + purple orb
 * + hairline + top cap). Only bg-background → bg-white: Vigent's card is
 * light-themed. Everything else (geometry, colours, z-layers) is untouched.
 *
 * The opening animation is writora's, too: when the card scrolls into view,
 * both wings widen 15rem → open, the orb widens with them and the hairline
 * grows with them, 300 ms later, over 800 ms, ease-in-out — the beam of
 * light "opens" over the title. On PHONES the opening is deliberately
 * slower and softer (1.05 s, 380 ms delay — see globals.css): the narrow
 * card made the old fast open feel abrupt, and the full-strength beam read
 * as a heavy purple flood. Mobile caps the open width at 24rem, trims the
 * orb, drops the backdrop-blur strip and the giant white blur band, and the
 * card itself is much shorter with the old dead space under the button
 * removed (user report).
 *
 * The heading is a single line in a single colour (user request), fluidly
 * sized against its wrapper's own width (cqw) so it never wraps on phones
 * or desktops.
 *
 * The content column is biased UPWARD on desktop (bottom padding on the
 * still justify-center card) so the heading sits right where the lamp's
 * soft purple bleed fades in behind the text.
 */
export function FutureCta() {
        const locale = useLocale() === 'en' ? 'en' : 'fa'
        const copy = COPY[locale]
        const fa = locale === 'fa'
        const Arrow = fa ? ArrowLeft : ArrowRight
        const textRef = useRef<HTMLSpanElement>(null)
        const [lampOpen, setLampOpen] = useState<number | null>(null)

        useEffect(() => {
                const el = textRef.current
                if (!el) return
                // Writora-style TV glow: the band of light opens beyond the title
                // (text width + 8rem), at least writora's 30rem, capped at 46rem.
                const measure = () => {
                        const w = el.getBoundingClientRect().width
                        setLampOpen(Math.ceil(Math.min(Math.max(w + 128, 480), 736)))
                }
                measure()
                // The first pass can run against the fallback font (before the
                // webfont swaps in) and under-measure the title, leaving the band
                // narrower than the text on /en. Re-measure once fonts settle.
                let fontsCancelled = false
                if (document.fonts?.ready) {
                        document.fonts.ready.then(() => {
                                if (!fontsCancelled) measure()
                        })
                }
                let frame = 0
                const onResize = () => {
                        cancelAnimationFrame(frame)
                        frame = requestAnimationFrame(measure)
                }
                window.addEventListener('resize', onResize)
                return () => {
                        window.removeEventListener('resize', onResize)
                        cancelAnimationFrame(frame)
                        fontsCancelled = true
                }
        }, [])

        return (
                <section className="bg-[var(--bg-base)] px-3 pb-8 pt-10 sm:px-5 sm:pb-14 sm:pt-20" aria-label={copy.aria}>
                        <div
                                className="marketing-future-cta marketing-grid relative mx-auto flex min-h-[24.5rem] w-full max-w-[1460px] flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-black/[0.07] bg-white px-5 pb-12 text-center shadow-[0_16px_50px_rgba(56,35,100,0.07)] sm:min-h-[42rem] sm:rounded-[2.75rem] sm:px-8 sm:pb-40 sm:shadow-[0_28px_90px_rgba(56,35,100,0.09)]"
                                data-scroll-reveal="scale"
                                style={lampOpen ? ({ '--lamp-open': `${lampOpen}px`, '--motion-reveal': '620ms' } as CSSProperties) : ({ '--motion-reveal': '620ms' } as CSSProperties)}
                        >
                                {/* ── Lamp of light (writora.xyz, copied verbatim) ─────────────────── */}
                                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 flex h-[17rem] items-center justify-center sm:h-[26rem]">
                                        <div className="relative isolate flex h-full w-full scale-y-110 items-center justify-center sm:scale-y-125">
                                                <div
                                                        className="marketing-lamp-wing absolute inset-auto right-1/2 h-56 overflow-visible from-purple-500 via-transparent to-transparent [--conic-position:from_70deg_at_center_top]"
                                                        style={{ backgroundImage: 'conic-gradient(var(--conic-position), var(--tw-gradient-stops))' }}
                                                >
                                                        <div className="absolute bottom-0 left-0 z-20 h-40 w-full bg-white [mask-image:linear-gradient(to_top,white,transparent)]" />
                                                        <div className="absolute bottom-0 left-0 z-20 h-full w-40 bg-white [mask-image:linear-gradient(to_right,white,transparent)]" />
                                                </div>
                                                <div
                                                        className="marketing-lamp-wing absolute inset-auto left-1/2 h-56 from-transparent via-transparent to-purple-500 [--conic-position:from_290deg_at_center_top]"
                                                        style={{ backgroundImage: 'conic-gradient(var(--conic-position), var(--tw-gradient-stops))' }}
                                                >
                                                        <div className="absolute bottom-0 right-0 z-20 h-full w-40 bg-white [mask-image:linear-gradient(to_left,white,transparent)]" />
                                                        <div className="absolute bottom-0 right-0 z-20 h-40 w-full bg-white [mask-image:linear-gradient(to_top,white,transparent)]" />
                                                </div>
                                                <div className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 bg-white blur-[4.5rem] sm:blur-[8rem]" />
                                                {/* The live backdrop-blur strip is compositor work phones pay
                                                    for on every paint — it is invisible over the white band
                                                    anyway, so phones skip it entirely. */}
                                                <div className="absolute top-1/2 z-50 hidden h-48 w-full bg-transparent opacity-10 backdrop-blur-md sm:block" />
                                                <div className="marketing-lamp-orb -translate-y-[6rem] absolute inset-auto z-30 h-24 rounded-full bg-purple-400 blur-2xl sm:h-36" />
                                                <div className="marketing-lamp-line -translate-y-[7rem] absolute inset-auto z-50 h-0.5 bg-purple-400" />
                                                <div className="-translate-y-[12.5rem] absolute inset-auto z-40 h-44 w-full bg-white sm:-translate-y-[12.5rem]" />
                                        </div>
                                </div>

                                {/* w-full gives the cq container a definite inline size — a
                                    shrink-to-fit flex item would collapse to 0 with cqw children. */}
                                <div className="relative z-50 mx-auto flex w-full max-w-5xl flex-col items-center [container-type:inline-size]">
                                        <h2 className="marketing-title-oneline mt-6 font-medium leading-[1.25] tracking-[-0.03em] text-[#111318] rtl:tracking-normal sm:mt-7 sm:font-semibold" style={{ '--title-fit': fa ? '8cqw' : '5.75cqw', '--title-max': '2.6rem', '--title-fallback': fa ? 'clamp(1.2rem, 7.8vw, 2.6rem)' : 'clamp(0.9rem, 5.6vw, 2.6rem)' } as CSSProperties}>
                                                <span ref={textRef}>{copy.title}</span>
                                        </h2>
                                        <p className="mx-auto mt-4 max-w-xl text-pretty text-[13px] font-light leading-7 text-black/45 sm:mt-6 sm:max-w-2xl sm:text-[15px] sm:leading-8 sm:text-black/55 sm:font-normal">{copy.description}</p>
                                        <Link href="/login?next=/onboarding" className="marketing-pressable group mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_16px_36px_rgba(0,0,0,0.17)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:mt-9">
                                                {copy.button}<Arrow className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden />
                                        </Link>
                                </div>
                        </div>
                </section>
            )
}
