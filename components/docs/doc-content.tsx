import type { DocPage, Locale } from '@/lib/docs/content'

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
  return (
    <article className="max-w-4xl rounded-[1.75rem] border border-black/10 bg-white p-5 sm:p-8 lg:p-10">
      <header className="marketing-grid-dark relative mb-10 overflow-hidden rounded-[1.35rem] bg-black px-5 py-8 text-white sm:px-8 sm:py-10">
        <div className="relative">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">Vigent Documentation</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">{pick(page.title, locale)}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/50">{pick(page.description, locale)}</p>
        </div>
      </header>

      <div className="space-y-6">
        {page.blocks.map((block, i) => {
          switch (block.type) {
            case 'h2':
              return (
                <h2 key={i} className="pt-4 text-xl font-medium text-[var(--text-primary)]">
                  {pick(block, locale)}
                </h2>
              )
            case 'p':
              return (
                <p key={i} className="leading-relaxed text-[var(--text-secondary)]">
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-hover)] font-mono text-sm text-[var(--text-primary)]">
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
                <figure key={i}>
                  {block.caption && (
                    <figcaption className="mb-2 text-xs text-[var(--text-muted)]">
                      {pick(block.caption, locale)}
                    </figcaption>
                  )}
                  <pre
                    dir="ltr"
                    className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]"
                  >
                    <code>{block.code}</code>
                  </pre>
                </figure>
              )
            case 'callout':
              return (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--border-hover)] bg-[var(--white-05)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]"
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
            default:
              return null
          }
        })}
      </div>
    </article>
  )
}
