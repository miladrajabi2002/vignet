import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Sparkles, UtensilsCrossed } from 'lucide-react'
import { prisma } from '@/lib/prisma'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const workspace = await prisma.workspace.findUnique({ where: { slug }, select: { name: true } })
  return workspace ? { title: `منوی ${workspace.name}`, description: `منوی دیجیتال و محصولات فعال ${workspace.name}` } : {}
}

export default async function PublicMenuPage({ params }: Props) {
  const { slug } = await params
  const workspace = await prisma.workspace.findUnique({ where: { slug }, select: { name: true, products: { where: { active: true }, orderBy: [{ category: { sortOrder: 'asc' } }, { createdAt: 'desc' }], include: { category: { select: { name: true } } } } } })
  if (!workspace) notFound()
  const groups = workspace.products.reduce((result, product) => {
    const category = product.category?.name || 'پیشنهادهای منو'
    const current = result.get(category) ?? []
    current.push(product)
    result.set(category, current)
    return result
  }, new Map<string, typeof workspace.products>())
  return <main dir="rtl" className="min-h-dvh bg-[#f4f4f2] px-3 py-5 text-black sm:px-6 sm:py-10"><div className="mx-auto max-w-5xl"><header className="overflow-hidden rounded-[2rem] bg-black p-6 text-white shadow-[0_30px_80px_-48px_rgba(0,0,0,.75)] sm:p-9"><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-black"><UtensilsCrossed className="h-5 w-5"/></span><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] text-white/60"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>منوی به‌روز</span></div><p className="mt-12 text-[10px] text-white/35">منوی دیجیتال</p><h1 className="mt-2 text-3xl font-bold sm:text-5xl">{workspace.name}</h1><p className="mt-4 max-w-lg text-xs leading-7 text-white/45">آیتم‌ها، قیمت‌ها و موجودی‌ها مستقیماً از کاتالوگ همین کسب‌وکار نمایش داده می‌شوند.</p></header>{workspace.products.length ? <div className="mt-6 space-y-8">{Array.from(groups.entries()).map(([category, products]) => <section key={category}><div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white"><Sparkles className="h-3.5 w-3.5"/></span><h2 className="text-lg font-bold">{category}</h2><span className="text-[10px] text-black/35">{products.length.toLocaleString('fa-IR')} مورد</span></div><div className="grid gap-3 sm:grid-cols-2">{products.map((product) => <article key={product.id} className="rounded-[1.5rem] border border-black/[0.07] bg-white p-3 shadow-[0_18px_50px_-42px_rgba(0,0,0,.55)]"><div className="flex gap-3">{product.images[0] ? <div className="h-24 w-24 shrink-0 rounded-[1.1rem] bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(product.images[0]).slice(1,-1)})` }} /> : <span className="grid h-24 w-24 shrink-0 place-items-center rounded-[1.1rem] bg-black/[0.035]"><UtensilsCrossed className="h-5 w-5 text-black/25"/></span>}<div className="min-w-0 flex-1 py-1"><h3 className="font-bold">{product.name}</h3><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-black/40">{product.description || 'توضیحی برای این آیتم ثبت نشده است.'}</p><div className="mt-3 flex items-end justify-between"><strong className="text-sm">{product.price == null ? 'برای قیمت پیام دهید' : `${Math.round(product.price).toLocaleString('fa-IR')} تومان`}</strong>{product.stock === 0 && <span className="rounded-full bg-rose-50 px-2 py-1 text-[8px] font-bold text-rose-600">ناموجود</span>}</div></div></div></article>)}</div></section>)}</div> : <div className="mt-6 rounded-[2rem] border border-dashed border-black/15 bg-white p-12 text-center"><MapPin className="mx-auto h-6 w-6 text-black/30"/><p className="mt-3 font-bold">منو در حال آماده‌سازی است</p><p className="mt-1 text-xs text-black/40">به‌زودی آیتم‌ها اینجا نمایش داده می‌شوند.</p></div>}<footer className="py-10 text-center text-[9px] text-black/30">ساخته‌شده با Vigento AI | هوش مصنوعی ویجنتو</footer></div></main>
}
