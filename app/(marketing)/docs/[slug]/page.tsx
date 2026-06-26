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

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const page = getDoc(params.slug)
  if (!page) return {}
  const locale = (await getLocale()) as Locale
  const title = locale === 'fa' ? page.title.fa : page.title.en
  return { title: `${title} — Vigent Docs` }
}

export default async function DocPageRoute({
  params,
}: {
  params: { slug: string }
}) {
  const page = getDoc(params.slug)
  if (!page || page.slug === 'introduction') notFound()

  const locale = (await getLocale()) as Locale
  return <DocContent page={page} locale={locale} />
}
