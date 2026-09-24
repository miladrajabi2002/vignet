import type { CSSProperties } from 'react'

type Locale = 'fa' | 'en'

/**
 * Hero dashboard preview — the exact screenshot of the real Vigent dashboard,
 * framed the way writora.xyz frames its product shot:
 *
 *   • a violet conic halo that glows from BEHIND the shot (z-0): its band
 *     starts ~24-32px above the frame's top edge, so a soft arc of light
 *     peeks above the screenshot while the dashboard itself stays clean —
 *     the halo must fall under the image, not wash over it,
 *   • an amber→violet border beam orbiting the frame forever (z-30, above
 *     the image, exactly like writora's stacking),
 *   • a ~320 B inline blurred stand-in (LQIP) that paints with the first byte
 *     of HTML, under the screenshot while it decodes,
 *   • a bottom edge that dissolves into the hero background.
 *
 * First-paint guarantee (user report: the shot only appeared after scrolling
 * on some machines). The frame previously joined the scroll-reveal system
 * (opacity: 0 until an IntersectionObserver fired) and the <img> itself was
 * opacity: 0 until a hydrated onLoad added `is-loaded` — so on a slow JS
 * path the hero image stayed invisible even though the bytes had arrived.
 * Now:
 *   • the frame NEVER joins the scroll reveal — it sits inside the first
 *     viewport, so its entrance is a plain CSS animation that runs at first
 *     paint, with zero JS dependency,
 *   • the <img> is always rendered visible (opacity 1); the inline LQIP
 *     sits under it for the few frames before the 72 KB WebP decodes.
 * next/image adds nothing here (fixed 1280×720), so a plain <img> with
 * explicit dimensions + fetchpriority keeps LCP handling explicit.
 */

/** 20-px JPEG preview of the screenshot, inlined — no extra request. */
const LQIP =
        'data:image/jpeg;base64,/9j/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAALABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAIEB//EACEQAAICAQIHAAAAAAAAAAAAAAECAAMRBBIhIjEyUWGx/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ANCdtilicARmzg/ItnYfUcgZgQpo70awnX3tucsAQvKPA4dIS6ED/9k='

/** Border-beam variables, copied verbatim from writora.xyz — except the
 * delay: -9s put the beam on the left edge at load; -2.4s starts it at the
 * top-center of the frame (path runs clockwise from the top-left corner). */
const BEAM_VARS = {
        '--size': '250',
        '--duration': '12',
        '--anchor': '90',
        '--border-width': '1.5',
        '--color-from': '#ffaa40',
        '--color-to': '#9c40ff',
        '--delay': '-2.4s',
} as CSSProperties

export function DashboardShowcase({ locale }: { locale: Locale }) {
        const fa = locale === 'fa'

        return (
                <div className="marketing-showcase-enter relative mx-auto mt-14 w-full max-w-[1200px] sm:mt-8">
                        <div className="relative rounded-xl bg-white/60 p-2 ring-1 ring-black/[0.08] ring-inset lg:rounded-2xl">
                                {/* Violet halo BEHIND the shot: the band starts ~24-32px above
                                    the frame's top edge, so a soft arc of light peeks above the
                                    screenshot while the dashboard itself stays clean. z-0 puts it
                                    under the screenshot (wrapper z-10); the beam stays on z-30. */}
                                <div
                                        aria-hidden
                                        className="marketing-showcase-gradient absolute -top-6 left-1/2 z-0 h-[5.5rem] w-3/4 -translate-x-1/2 animate-image-glow blur-[5rem] sm:-top-4 sm:h-[11rem] md:h-[19rem]"
                                />

                                {/* Orbiting border beam — writora.xyz markup, copied verbatim. */}
                                <div
                                        aria-hidden
                                        style={BEAM_VARS}
                                        className="marketing-showcase-beam absolute inset-[0] z-30 rounded-[inherit] [border:calc(var(--border-width)*2px)_solid_transparent] ![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)] after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--anchor)*1%)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]"
                                />

                                <div className="relative z-10 overflow-hidden rounded-md bg-[#f5f6f8] ring-1 ring-black/[0.06] lg:rounded-xl">
                                        {/* Instant blurred hint of the dashboard (inline LQIP) while
                                            the 72 KB WebP decodes; the real shot paints above it. */}
                                        <div
                                                aria-hidden
                                                className="absolute inset-0 z-0 scale-110 bg-cover bg-center blur-2xl"
                                                style={{ backgroundImage: `url("${LQIP}")` }}
                                        />
                                        <picture>
                                                <source srcSet="/assets/dashboard-preview.webp" type="image/webp" />
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                        src="/assets/dashboard-preview.png"
                                                        alt={
                                                                fa
                                                                        ? 'داشبورد ویجنت — آمار، نمودار گفتگوها و آخرین فعالیت‌ها'
                                                                        : 'Vigent dashboard — metrics, conversation trends and recent activity'
                                                        }
                                                        width={1280}
                                                        height={720}
                                                        fetchPriority="high"
                                                        decoding="async"
                                                        className="marketing-showcase-img block h-auto w-full"
                                                />
                                        </picture>
                                </div>

                                {/* Bottom dissolve into the hero background (writora.xyz). */}
                                <div aria-hidden className="absolute inset-x-0 -bottom-4 z-40 h-1/2 w-full bg-gradient-to-t from-white" />
                                <div aria-hidden className="absolute inset-x-0 bottom-0 z-50 h-1/4 w-full bg-gradient-to-t from-white md:-bottom-8" />
                        </div>
                </div>
        )
}
