import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { DocContent } from '@/components/docs/doc-content'
import { DOCS, getDoc, type Locale } from '@/lib/docs/content'

export function generateStaticParams() {
  return DOCS.filter((d) => d.slug !== 'introduction').map((d) => ({
    slug: d.slug,
  }))
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const page = getDoc(params.slug)
  if (!page) return {}
  const locale = (await getLocale()) as Locale
  const title = locale === 'fa' ? page.title.fa : page.title.en
  const description = locale === 'fa' ? page.description.fa : page.description.en
  return {
    title: `${title} — Vigent Docs`,
    description,
    alternates: { canonical: `/docs/${page.slug}` },
    openGraph: { title, description, type: 'article', url: `/docs/${page.slug}` },
  }
}

export default async function DocPageRoute(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const page = getDoc(params.slug)
  if (!page || page.slug === 'introduction') notFound()

  const locale = (await getLocale()) as Locale
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
  const title = locale === 'fa' ? page.title.fa : page.title.en
  const description = locale === 'fa' ? page.description.fa : page.description.en
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: title,
        description,
        inLanguage: locale === 'fa' ? 'fa-IR' : 'en',
        url: `${base}/docs/${page.slug}`,
        publisher: { '@type': 'Organization', name: 'Vigent', url: base },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: locale === 'fa' ? 'ویجنت' : 'Vigent', item: base },
          { '@type': 'ListItem', position: 2, name: locale === 'fa' ? 'راهنما' : 'Docs', item: `${base}/docs` },
          { '@type': 'ListItem', position: 3, name: title, item: `${base}/docs/${page.slug}` },
        ],
      },
    ],
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DocContent page={page} locale={locale} />
    </>
  )
}
