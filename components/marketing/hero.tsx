'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { MarketingHeroPill } from './animated-pill'

type Locale = 'fa' | 'en'

type HeroCopy = {
        kicker: string
        headlineTop: string
        headlineBottomLead: string
        headlineAccent: string
        startShort: string
}

const COPY: Record<Locale, HeroCopy> = {
        fa: {
                kicker: 'فروش و پشتیبانی با هوش مصنوعی',
                headlineTop: 'هر پیام، یک پاسخ دقیق',
                headlineBottomLead: 'همه کانال‌ها،',
                headlineAccent: 'یک پنل',
                startShort: 'شروع رایگان',
        },
        en: {
                kicker: 'Persian AI for sales and support',
                headlineTop: 'Every message gets a clear answer',
                headlineBottomLead: 'Every channel,',
                headlineAccent: 'one inbox',
                startShort: 'Start free',
        },
}

export function Hero({ dashboard }: { dashboard?: ReactNode }) {
        const t = useTranslations('marketing.hero')
        const locale: Locale = useLocale() === 'en' ? 'en' : 'fa'
        const copy = COPY[locale]
        const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

        // Vertical rhythm is compressed on ≥lg so the top edge of the
        // dashboard shot clears the fold on short desktop viewports
        // (1080p with the Chrome bookmarks bar ≈ 910px, 125% DPI
        // laptops ≈ 730px): the image must peek into the first view
        // without any scroll.
        return (
                <section className="marketing-hero-spatial relative overflow-hidden pb-10 pt-[92px] sm:pb-20 sm:pt-32 lg:pt-28">
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_50%_-15%,rgba(124,58,237,0.15),rgba(251,113,133,0.055)_38%,transparent_70%)]" />

                        <div className="marketing-hero-content relative mx-auto w-full max-w-[1540px] px-3 sm:px-6 lg:px-8">
                                <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
                                        <MarketingHeroPill className="marketing-hero-pill--intro">{copy.kicker}</MarketingHeroPill>

                                        {/* Single weight (Medium cut) and a single fixed ink colour — the
                                            previous Bold 600 render read as a different, heavier font,
                                            and the gradient accent split the line into two colours. */}
                                        <h1 className="mt-7 w-full text-balance text-[clamp(2.15rem,10vw,4.1rem)] font-medium leading-[1.22] tracking-[-0.045em] text-[var(--text-primary)] rtl:tracking-normal sm:mt-6 sm:text-[clamp(3rem,7vw,6.05rem)] sm:leading-[1.15]">
                                                <span className="block">{copy.headlineTop}</span>
                                                <span className="mt-1 block sm:mt-2">
                                                        {copy.headlineBottomLead}{' '}
                                                        <span className="inline-block">{copy.headlineAccent}</span>
                                                </span>
                                        </h1>

                                        <p className="mx-auto mt-5 max-w-2xl text-pretty text-[14px] leading-7 text-[var(--text-secondary)] sm:mt-6 sm:text-lg sm:leading-9">
                                                {t('subtitle')}
                                        </p>

                                        <Link href="/login?next=/onboarding" className="marketing-pressable group mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_16px_38px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:mt-8 sm:min-h-[3.25rem] sm:px-7">
                                                <span className="sm:hidden">{copy.startShort}</span>
                                                <span className="hidden sm:inline">{t('ctaPrimary')}</span>
                                                <Arrow className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden />
                                        </Link>
                                </div>

                                {dashboard}
                        </div>
                </section>
        )
}
