'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, ArrowUpLeft, Phone, Sparkles } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { SocialLinks } from '@/components/marketing/social-links'
import { SUPPORT_PHONE_E164, SUPPORT_PHONE_DISPLAY } from '@/lib/marketing/contact'

const COPY = {
        fa: {
                eyebrow: 'Vigento AI | هوش مصنوعی ویجنتو',
                title: 'یک ماه فرصت دارید کسب‌وکارتان را هوشمندتر اداره کنید',
                subtitle: 'اتوماسیون ثابت اینستاگرام رایگان است؛ فقط پاسخ موفق AI از اعتبار کم می‌کند',
                button: 'شروع رایگان — یک ماه',
                desc: 'سیستم‌عامل هوشمند کسب‌وکار برای فروش، پشتیبانی، CRM، رزرو و ارتباط با مشتری در همه کانال‌ها',
                productTitle: 'محصول',
                solutionsTitle: 'راهکارها',
                resourcesTitle: 'یادگیری',
                productLinks: ['اتصال‌ها', 'قابلیت‌ها', 'Vigento AI', 'تعرفه‌ها'],
                // Order must track solutionHrefs below — these labels previously pointed at
                // the wrong pages ("خدمات و رزرو" opened the support page, "پشتیبانی مشتری"
                // opened the chatbot page).
                solutionLinks: ['اینستاگرام', 'فروشگاه آنلاین', 'پشتیبانی مشتری', 'چت‌بات فارسی', 'ووکامرس'],
                resourceLinks: ['مستندات', 'بلاگ', 'وضعیت سرویس'],
                status: 'همه سرویس‌ها فعال',
                made: 'ساخته‌شده برای کسب‌وکارهای ایرانی',
                support: 'پشتیبانی',
                supportAriaLabel: `تماس با پشتیبانی ویجنت به شماره ${SUPPORT_PHONE_DISPLAY}`,
        },
        en: {
                eyebrow: 'Vigento AI | Business intelligence core',
                title: 'Take a month to run your business with an intelligent operating layer',
                subtitle: 'Deterministic Instagram automation is free; only successful AI replies use credit',
                button: 'Start free — one month',
                desc: 'An intelligent operating system for sales, support, CRM, booking and customer conversations across every channel.',
                productTitle: 'Product',
                solutionsTitle: 'Solutions',
                resourcesTitle: 'Learn',
                productLinks: ['Connections', 'Features', 'Vigento AI', 'Pricing'],
                solutionLinks: ['Instagram', 'Online stores', 'Customer support', 'Persian AI chatbot', 'WooCommerce'],
                resourceLinks: ['Documentation', 'Blog', 'Service status'],
                status: 'All services operational',
                made: 'Built for Iranian businesses',
                support: 'Support',
                supportAriaLabel: `Call Vigent support at ${SUPPORT_PHONE_DISPLAY}`,
        },
} as const

export function Footer() {
        const locale = useLocale() === 'en' ? 'en' : 'fa'
        const copy = COPY[locale]
        const t = useTranslations('marketing.footer')
        const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
        const productHrefs = ['/#product', '/#solutions', '/#vigento', '/pricing']
        const solutionHrefs = ['/solutions/instagram', '/solutions/ecommerce-ai', '/solutions/customer-support-ai', '/solutions/persian-ai-chatbot', '/solutions/woocommerce']
        const resourceHrefs = ['/docs', '/blog', '/status']

        return (
                <footer className="bg-[var(--bg-base)] px-3 pb-3 pt-6 sm:px-5 sm:pb-5 sm:pt-14">
                        <div className="marketing-grid-dark relative mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] bg-black text-white shadow-[0_30px_90px_rgba(0,0,0,0.18)]">
                                <div className="relative mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-14">
                                        <div className="relative hidden gap-8 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-6 text-center sm:grid sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end lg:text-start">
                                                <div aria-hidden className="pointer-events-none absolute -start-20 -top-24 h-56 w-56 rounded-full bg-white/[0.07] blur-3xl" />
                                                <div>
                                                        <span className="inline-flex items-center gap-2 text-[10px] font-medium text-white/40"><Sparkles className="h-3.5 w-3.5" />{copy.eyebrow}</span>
                                                        <h2 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-semibold leading-[1.25] tracking-[-0.035em] sm:text-4xl lg:mx-0 rtl:tracking-normal">{copy.title}</h2>
                                                        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/45 lg:mx-0">{copy.subtitle}</p>
                                                </div>
                                                <Link href="/login?next=/onboarding" className="marketing-pressable relative inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black shadow-[0_12px_35px_rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:w-auto">
                                                        {copy.button}<Arrow className="h-4 w-4" />
                                                </Link>
                                        </div>

                                        <div className="grid gap-6 py-6 sm:gap-8 sm:py-8 lg:grid-cols-[1.05fr_1.95fr] lg:gap-12 lg:py-10">
                                                <div className="text-center lg:text-start">
                                                        <Logo variant="white" className="mx-auto h-8 w-32 lg:mx-0" />
                                                        <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-white/42 sm:mt-5 lg:mx-0">{copy.desc}</p>
                                                        <a
                                                                href={`tel:${SUPPORT_PHONE_E164}`}
                                                                aria-label={copy.supportAriaLabel}
                                                                className="mx-auto mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:mt-3 lg:mx-0"
                                                        >
                                                                <Phone className="h-4 w-4" aria-hidden="true" />
                                                                <span>{copy.support}:</span>
                                                                <bdi dir="ltr" className="font-medium tabular-nums">{SUPPORT_PHONE_DISPLAY}</bdi>
                                                        </a>
                                                        <SocialLinks variant="default" className="mt-3 justify-center sm:mt-5 lg:justify-start [&_a]:border-white/15 [&_a]:text-white/60 [&_a:hover]:text-white" />
                                                </div>
                                                <div className="hidden grid-cols-2 gap-6 sm:grid sm:gap-8 sm:grid-cols-3">
                                                        <FooterColumn title={copy.productTitle} labels={copy.productLinks} hrefs={productHrefs} />
                                                        <FooterColumn title={copy.solutionsTitle} labels={copy.solutionLinks} hrefs={solutionHrefs} />
                                                        <FooterColumn title={copy.resourcesTitle} labels={copy.resourceLinks} hrefs={resourceHrefs} className="col-span-2 sm:col-span-1" />
                                                </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-4 border-t border-white/10 pt-4 text-center text-[10px] text-white/35 sm:flex-row sm:justify-between sm:pt-6 sm:text-start">
                                                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
                                                        <span>{t('rights')}</span><span>{copy.made}</span>
                                                        <Link href="/privacy" className="inline-flex min-h-11 items-center transition-colors hover:text-white">{locale === 'fa' ? 'حریم خصوصی' : 'Privacy'}</Link>
                                                        <Link href="/terms" className="inline-flex min-h-11 items-center transition-colors hover:text-white">{locale === 'fa' ? 'شرایط استفاده' : 'Terms'}</Link>
                                                </div>
                                        <Link href="/status" className="inline-flex min-h-11 items-center gap-2 self-center rounded-full border border-white/10 px-3 transition-colors hover:border-white/25 hover:text-white sm:self-auto"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{copy.status}</Link>
                                        </div>
                                </div>
                        </div>
                </footer>
        )
}

function FooterColumn({ title, labels, hrefs, className = '' }: { title: string; labels: readonly string[]; hrefs: string[]; className?: string }) {
        return (
                <nav className={className} aria-label={title}>
                        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30 rtl:tracking-normal">{title}</p>
                        <ul>
                                {labels.map((label, index) => (
                                        <li key={label}>
                                                <Link href={hrefs[index]} className="group inline-flex min-h-9 items-center gap-1.5 text-xs text-white/48 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:min-h-11">
                                                        {label}<ArrowUpLeft className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-90 ltr:-rotate-90" />
                                                </Link>
                                        </li>
                                ))}
                        </ul>
                </nav>
        )
}
