import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PublicPostCard } from '@/components/blog/public-post-card'
import { getMainWorkspaceId } from '@/lib/blog/workspace'

// ISR: category pages re-render at most every 5 minutes; admin publishes
// revalidate them immediately.
export const revalidate = 300

interface Props {
        params: Promise<{ slug: string }>
}

const getWorkspaceId = getMainWorkspaceId

export async function generateMetadata(props: Props) {
    const params = await props.params;
    const wsId = await getWorkspaceId()
    if (!wsId) return {}
    const cat = await prisma.blogCategory.findFirst({
                where: { workspaceId: wsId, slug: params.slug },
        })
    if (!cat) return {}
    const description = cat.description ?? cat.name
    return {
                title: cat.name,
                description,
                // The sitemap lists category pages, so they need a canonical and OG tags
                // like every other indexable route.
                alternates: { canonical: `/blog/category/${cat.slug}` },
                openGraph: {
                        title: cat.name,
                        description,
                        type: 'website',
                        url: `/blog/category/${cat.slug}`,
                },
        }
}

export default async function PublicBlogCategoryPage(props: Props) {
    const params = await props.params;
    // Static fa page — see the blog index for why locale is fixed here.
    const locale = 'fa' as const
    const wsId = await getWorkspaceId()
    if (!wsId) notFound()

    const category = await prisma.blogCategory.findFirst({
                where: { workspaceId: wsId, slug: params.slug },
        })
    if (!category) notFound()

    const posts = await prisma.blogPost.findMany({
                where: { workspaceId: wsId, status: 'PUBLISHED', categoryId: category.id },
                orderBy: { publishedAt: 'desc' },
                include: { category: { select: { name: true, slug: true } } },
                take: 50,
        })

    return (
        <div className="marketing-page-shell min-h-screen px-3 pb-24 pt-24 sm:px-5 sm:pt-28">
                        <div className="mx-auto max-w-7xl">
                        <header className="marketing-page-hero marketing-grid-dark mb-10 px-6 py-12 text-center text-white sm:px-10 sm:py-14">
                                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">Vigent Journal</p>
                                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                                        {category.name}
                                </h1>
                                {category.description && (
                                        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/50">{category.description}</p>
                                )}
                        </header>

                        <div className="mb-8">
                                <Link
                                        href={`/blog`}
                                        className="inline-flex min-h-11 items-center rounded-full border border-black/10 px-4 text-xs text-black/55 hover:text-black"
                                >
                                        {locale === 'fa' ? '← همه پست‌ها' : '← All posts'}
                                </Link>
                        </div>

                        {posts.length === 0 ? (
                                <div className="rounded-[1.5rem] border border-dashed border-black/15 bg-[#f7f7f5] p-16 text-center text-black/40">
                                        {locale === 'fa' ? 'هیچ پستی در این دسته نیست.' : 'No posts in this category.'}
                                </div>
                        ) : (
                                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.map((post) => <PublicPostCard key={post.id} post={post} locale={locale} />)}</div>
                        )}
                        </div>
                </div>
        )
}
