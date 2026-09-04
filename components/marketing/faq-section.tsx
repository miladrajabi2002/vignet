import type { CSSProperties } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowRight, MessagesSquare, Plus } from 'lucide-react'

type FaqItem = { q: string; a: string }

export async function FaqSection() {
        const [requestLocale, t] = await Promise.all([
                getLocale(),
                getTranslations('marketing.faq'),
        ])
        const locale = requestLocale === 'en' ? 'en' : 'fa'
        const items = t.raw('items') as FaqItem[]
        const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
        const mid = Math.ceil(items.length / 2)
        const columns = [items.slice(0, mid), items.slice(mid)]

        return (
                <section className="marketing-story-section marketing-section-faq bg-white py-9 sm:py-20 lg:py-24">
                        <div className="mx-auto max-w-6xl px-5 sm:px-8">
                                <header data-scroll-reveal="up" className="mx-auto max-w-2xl text-center">
                                        <span className="marketing-eyebrow">{t('eyebrow')}</span>
                                        <h2 className="marketing-heading mx-auto mt-3 sm:mt-4">{t('title')}</h2>
                                        <p className="marketing-subtitle mx-auto mt-3 sm:mt-4">{t('subtitle')}</p>
                                </header>

                                <div className="mt-6 grid grid-cols-1 items-start gap-2.5 sm:mt-10 lg:grid-cols-2 lg:gap-4">
                                        {columns.map((column, columnIndex) => (
                                                <div key={columnIndex} className="space-y-2.5 lg:space-y-4">
                                                        {column.map((item, itemIndex) => {
                                                                const index = columnIndex * mid + itemIndex
                                                                return (
                                                                        <details
                                                                                key={item.q}
                                                                                name="marketing-faq"
                                                                                data-scroll-reveal="up"
                                                                                style={{ '--reveal-order': itemIndex } as CSSProperties}
                                                                                className="marketing-faq-details group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white transition-colors open:border-[var(--border-hover)] open:bg-[var(--white-05)]"
                                                                        >
                                                                                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-start marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--blue-accent)] [&::-webkit-details-marker]:hidden sm:min-h-14 sm:px-5 sm:py-3.5">
                                                                                        <span className="text-sm leading-6 text-[var(--text-primary)] sm:text-[15px] sm:leading-7">{item.q}</span>
                                                                                        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] transition-[transform,background-color,color] duration-200 group-open:rotate-45 group-open:border-transparent group-open:bg-black group-open:text-white">
                                                                                                <Plus className="size-3.5" />
                                                                                        </span>
                                                                                </summary>
                                                                                <div className="marketing-faq-answer px-4 pb-4 sm:px-5 sm:pb-5">
                                                                                        <p className="border-s-2 border-emerald-500/45 ps-4 text-sm leading-7 text-[var(--text-secondary)]">{item.a}</p>
                                                                                </div>
                                                                        </details>
                                                                )
                                                        })}
                                                </div>
                                        ))}
                                </div>

                                <div data-scroll-reveal="up" className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] px-6 py-4 text-center sm:mt-12 sm:flex-row sm:py-5 sm:text-start">
                                        <span className="inline-flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                                                <MessagesSquare aria-hidden className="size-4 shrink-0 text-[var(--text-muted)]" />
                                                {t('moreQuestion')}
                                        </span>
                                        <Link href="/docs" className="marketing-pressable group inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--border-hover)] bg-white px-5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] sm:w-auto">
                                                {t('contact')}<Arrow aria-hidden className="size-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
                                        </Link>
                                </div>
                        </div>
                </section>
        )
}
