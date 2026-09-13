import { getLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import { DocContent } from '@/components/docs/doc-content'
import { getDoc, type Locale } from '@/lib/docs/content'
import { DOCS_NAV } from '@/lib/docs/nav'
import { jsonLdScript } from '@/lib/seo/json-ld'

// Locale-aware metadata so /en/docs carries an English <title>/description
// (the page body was already bilingual; the static metadata baked Persian
// into the English URL).
export async function generateMetadata(): Promise<Metadata> {
  const locale = ((await getLocale()) === 'en' ? 'en' : 'fa') as Locale
  const isEn = locale === 'en'
  return {
    title: isEn ? 'Documentation — Build Agents, Connect Channels, Manage Costs' : 'راهنمای ویجنت — ساخت ایجنت، اتصال کانال و مدیریت هزینه',
    description: isEn
      ? 'Practical guides for building Persian AI agents, knowledge bases, connecting Instagram and messengers, bookings, CRM and cost management in Vigent.'
      : 'راهنمای عملی ساخت ایجنت فارسی، پایگاه دانش، اتصال اینستاگرام و پیام‌رسان‌ها، رزرو، CRM و مدیریت هزینه در ویجنت.',
    alternates: {
      canonical: isEn ? '/en/docs' : '/docs',
      languages: {
        fa: '/docs',
        en: '/en/docs',
        'x-default': '/docs',
      },
    },
  }
}

export default async function DocsHomePage() {
  const locale = (await getLocale()) as Locale
  const page = getDoc('introduction')!
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: locale === 'fa' ? 'مرکز راهنمای ویجنت' : 'Vigent Documentation',
    url: `${base}/docs`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: DOCS_NAV.map((doc, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: locale === 'fa' ? doc.title.fa : doc.title.en,
        url: `${base}${doc.href}`,
      })),
    },
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <DocContent page={page} locale={locale} />
    </>
  )
}
