import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Sparkles, UtensilsCrossed } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { jsonLdScript } from '@/lib/seo/json-ld'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const workspace = await prisma.workspace.findUnique({ where: { slug }, select: { name: true } })
  return workspace
    ? {
        title: `منوی ${workspace.name}`,
        description: `منوی دیجیتال و محصولات فعال ${workspace.name}`,
        alternates: { canonical: `/menu/${slug}` },
      }
    : {}
}

export default async function PublicMenuPage({ params }: Props) {
  const { slug } = await params
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: {
      name: true,
      products: {
        where: { active: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { createdAt: 'desc' }],
        include: { category: { select: { name: true } } },
      },
    },
  })
  if (!workspace) notFound()

  const groups = workspace.products.reduce((result, product) => {
    const category = product.category?.name || 'پیشنهادهای منو'
    const current = result.get(category) ?? []
    current.push(product)
    result.set(category, current)
    return result
  }, new Map<string, typeof workspace.products>())

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `منوی ${workspace.name}`,
    url: `${base}/menu/${slug}`,
    numberOfItems: workspace.products.length,
    itemListElement: workspace.products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        description: product.description || undefined,
        image: product.images[0] || undefined,
        offers: product.price == null ? undefined : {
          '@type': 'Offer',
          priceCurrency: 'IRR',
          price: Math.round(product.price * 10),
          availability: product.stock === 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        },
      },
    })),
  }

  return (
    <main dir="rtl" className="min-h-dvh bg-[var(--bg-base)] px-3 py-5 text-[var(--text-primary)] sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-5xl">
        <header className="dashboard-intro relative overflow-hidden rounded-[1.75rem] border border-[var(--border-default)] p-6 shadow-[var(--shadow-card)] sm:p-9">
          <div className="relative flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]"><UtensilsCrossed className="h-5 w-5" /></span>
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--border-default)] bg-white px-3 text-xs text-[var(--text-secondary)]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />منوی به‌روز</span>
          </div>
          <div className="relative mt-12">
            <p className="text-xs font-medium text-[var(--text-muted)]">منوی دیجیتال</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{workspace.name}</h1>
            <p className="mt-4 max-w-lg text-sm leading-8 text-[var(--text-secondary)]">آیتم‌ها، قیمت‌ها و موجودی‌ها مستقیماً از کاتالوگ همین کسب‌وکار نمایش داده می‌شوند.</p>
          </div>
        </header>

        {workspace.products.length ? (
          <div className="mt-6 space-y-8">
            {Array.from(groups.entries()).map(([category, products]) => (
              <section key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white"><Sparkles className="h-3.5 w-3.5" /></span>
                  <h2 className="text-lg font-bold">{category}</h2>
                  <span className="text-xs text-[var(--text-muted)]">{products.length.toLocaleString('fa-IR')} مورد</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {products.map((product) => (
                    <article key={product.id} className="dashboard-card rounded-[1.4rem] border border-[var(--border-default)] bg-white p-3 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--border-hover)] motion-reduce:transform-none">
                      <div className="flex gap-3">
                        {product.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.images[0]} alt={product.name} loading="lazy" decoding="async" width={96} height={96} className="h-24 w-24 shrink-0 rounded-[1.1rem] object-cover" />
                        ) : (
                          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-[1.1rem] bg-[var(--bg-surface)]"><UtensilsCrossed className="h-5 w-5 text-[var(--text-hint)]" /></span>
                        )}
                        <div className="min-w-0 flex-1 py-1">
                          <h3 className="font-bold">{product.name}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-6 text-[var(--text-muted)]">{product.description || 'توضیحی برای این آیتم ثبت نشده است.'}</p>
                          <div className="mt-3 flex items-end justify-between gap-2">
                            <strong className="text-sm">{product.price == null ? 'برای قیمت پیام دهید' : `${Math.round(product.price).toLocaleString('fa-IR')} تومان`}</strong>
                            {product.stock === 0 && <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">ناموجود</span>}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-[var(--border-strong)] bg-white p-12 text-center shadow-[var(--shadow-soft)]">
            <MapPin className="mx-auto h-6 w-6 text-[var(--text-hint)]" />
            <p className="mt-3 font-bold">منو در حال آماده‌سازی است</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">به‌زودی آیتم‌ها اینجا نمایش داده می‌شوند.</p>
          </div>
        )}
        <footer className="py-10 text-center text-xs text-[var(--text-muted)]">ساخته‌شده با Vigent</footer>
      </div>
    </main>
  )
}
