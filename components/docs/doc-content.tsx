import type { ComponentType } from 'react'
import type { DocMotion, DocPage, Locale } from '@/lib/docs/content'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { DOCS_NAV } from '@/lib/docs/nav'
import { CopyButton } from '@/components/ui/copy-button'
import { MarketingHeroPill } from '@/components/marketing/animated-pill'
import {
  AutomationMotion,
  CreditFlowMotion,
  HandoffMotion,
  IdentifyMotion,
  KnowledgeFlowMotion,
  ToneMotion,
  WidgetInstallMotion,
} from '@/components/motion/explainers'

const DOC_MOTIONS: Record<DocMotion, ComponentType<{ locale: Locale; className?: string }>> = {
  credit: CreditFlowMotion,
  knowledge: KnowledgeFlowMotion,
  handoff: HandoffMotion,
  automation: AutomationMotion,
  widget: WidgetInstallMotion,
  identify: IdentifyMotion,
  tone: ToneMotion,
}

function pick(t: { fa: string; en: string }, locale: Locale) {
  return locale === 'fa' ? t.fa : t.en
}

export function DocContent({
  page,
  locale,
}: {
  page: DocPage
  locale: Locale
}) {
  const currentIndex = DOCS_NAV.findIndex((item) => item.slug === page.slug)
  const previous = currentIndex > 0 ? DOCS_NAV[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < DOCS_NAV.length - 1 ? DOCS_NAV[currentIndex + 1] : null
  const ForwardArrow = locale === 'fa' ? ArrowLeft : ArrowRight
  const BackArrow = locale === 'fa' ? ArrowRight : ArrowLeft

  return (
    <article className="max-w-4xl rounded-sheet border border-black/[0.08] bg-white p-4 shadow-[var(--elev-2)] sm:p-7 lg:p-9">
      <header className="relative mb-10 border-b border-black/[0.08] pb-8 sm:pb-10">
        <div className="relative">
        <MarketingHeroPill>{locale === 'fa' ? 'راهنما' : 'Guide'}</MarketingHeroPill>
        <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.2] tracking-[-0.04em] rtl:tracking-normal">{pick(page.title, locale)}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-8 text-vg-sub">{pick(page.description, locale)}</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-7">
        {page.blocks.map((block, i) => {
          switch (block.type) {
            case 'h2':
              return (
                <h2 key={i} className="border-t border-black/[0.07] pt-7 text-xl font-bold text-[var(--text-primary)]">
                  {pick(block, locale)}
                </h2>
              )
            case 'p':
              return (
                <p key={i} className="text-[15px] leading-8 text-[var(--text-secondary)]">
                  {pick(block, locale)}
                </p>
              )
            case 'list':
              return (
                <ul key={i} className="space-y-2">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-3 text-[var(--text-secondary)]">
                      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                      <span className="leading-relaxed">{pick(item, locale)}</span>
                    </li>
                  ))}
                </ul>
              )
            case 'steps':
              return (
                <ol key={i} className="space-y-3">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black font-mono text-xs text-white shadow-sm">
                        {j + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed text-[var(--text-secondary)]">
                        {pick(item, locale)}
                      </span>
                    </li>
                  ))}
                </ol>
              )
            case 'code':
              return (
                <figure key={i} className="relative">
                  {block.caption && (
                    <figcaption className="mb-2 text-xs text-[var(--text-muted)]">
                      {pick(block.caption, locale)}
                    </figcaption>
                  )}
                  <CopyButton
                    value={block.code}
                    label={locale === 'fa' ? 'کپی کد' : 'Copy code'}
                    copiedLabel={locale === 'fa' ? 'کپی شد' : 'Copied'}
                    showLabel
                    className="absolute end-2 top-8 z-10 border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  />
                  <pre
                    dir="ltr"
                    className="overflow-x-auto rounded-2xl border border-white/10 bg-black px-5 pb-5 pt-16 text-sm leading-relaxed text-white/70 shadow-[var(--elev-2)]"
                  >
                    <code>{block.code}</code>
                  </pre>
                </figure>
              )
            case 'callout':
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-black/[0.08] bg-[var(--bg-base)] p-5 text-sm leading-7 text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                >
                  {pick(block, locale)}
                </div>
              )
            case 'image':
              return (
                <figure key={i} className="my-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={block.src}
                    alt={pick(block.alt, locale)}
                    loading="lazy"
                    decoding="async"
                    className="my-4 rounded-xl border border-[var(--border-default)] w-full"
                  />
                  {block.caption && (
                    <figcaption className="text-xs text-[var(--text-secondary)] mt-1">
                      {pick(block.caption, locale)}
                    </figcaption>
                  )}
                </figure>
              )
            case 'motion': {
              const Motion = DOC_MOTIONS[block.motion]
              return <Motion key={i} locale={locale} className="mx-auto max-w-2xl" />
            }
            default:
              return null
          }
        })}

        <nav aria-label={locale === 'fa' ? 'راهنماهای مرتبط' : 'Related documentation'} className="grid gap-3 border-t border-[var(--border-default)] pt-7 sm:grid-cols-2">
          {previous ? (
            <Link href={previous.href} className="spatial-press flex min-h-20 items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm font-semibold text-[var(--text-primary)]">
              <BackArrow className="h-4 w-4 text-[var(--text-muted)]" />
              <span><small className="block text-xs font-normal text-[var(--text-muted)]">{locale === 'fa' ? 'راهنمای قبلی' : 'Previous guide'}</small>{pick(previous.title, locale)}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link href={next.href} className="spatial-press flex min-h-20 items-center justify-end gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-end text-sm font-semibold text-[var(--text-primary)]">
              <span><small className="block text-xs font-normal text-[var(--text-muted)]">{locale === 'fa' ? 'راهنمای بعدی' : 'Next guide'}</small>{pick(next.title, locale)}</span>
              <ForwardArrow className="h-4 w-4 text-[var(--text-muted)]" />
            </Link>
          )}
        </nav>
      </div>
    </article>
  )
}
