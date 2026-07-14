import { getLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import { DocContent } from '@/components/docs/doc-content'
import { getDoc, type Locale } from '@/lib/docs/content'
import { DOCS_NAV } from '@/lib/docs/nav'

export const metadata: Metadata = {
  title: 'راهنمای ویجنت — ساخت ایجنت، اتصال کانال و مدیریت هزینه',
  description: 'راهنمای عملی ساخت ایجنت فارسی، پایگاه دانش، اتصال اینستاگرام و پیام‌رسان‌ها، رزرو، CRM و مدیریت هزینه در ویجنت.',
  alternates: { canonical: '/docs' },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DocContent page={page} locale={locale} />
    </>
  )
}
