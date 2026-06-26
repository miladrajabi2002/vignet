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
    <article className="max-w-3xl">
      <header className="mb-10 border-b border-white/[0.08] pb-8">
        <h1 className="text-4xl font-light text-white">{pick(page.title, locale)}</h1>
        <p className="mt-3 text-white/50">{pick(page.description, locale)}</p>
      </header>

      <div className="space-y-6">
        {page.blocks.map((block, i) => {
          switch (block.type) {
            case 'h2':
              return (
                <h2 key={i} className="pt-4 text-xl font-medium text-white">
                  {pick(block, locale)}
                </h2>
              )
            case 'p':
              return (
                <p key={i} className="leading-relaxed text-white/65">
                  {pick(block, locale)}
                </p>
              )
            case 'list':
              return (
                <ul key={i} className="space-y-2">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-3 text-white/65">
                      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-white/40" />
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-sm text-white">
                        {j + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed text-white/65">
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
                    <figcaption className="mb-2 text-xs text-white/40">
                      {pick(block.caption, locale)}
                    </figcaption>
                  )}
                  <pre
                    dir="ltr"
                    className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-4 text-sm leading-relaxed text-white/80"
                  >
                    <code>{block.code}</code>
                  </pre>
                </figure>
              )
            case 'callout':
              return (
                <div
                  key={i}
                  className="rounded-xl border border-white/15 bg-white/[0.03] p-4 text-sm leading-relaxed text-white/70"
                >
                  {pick(block, locale)}
                </div>
              )
            default:
              return null
          }
        })}
      </div>
    </article>
  )
}
