'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Edit3, Trash2, Loader2, X, FileText, Wand2, Search, SlidersHorizontal } from 'lucide-react'
import {
        BlogEditor,
        type BlogPostData,
        type BlogCategory,
} from '@/components/blog/blog-editor'
import { JsonImportDialog } from '@/components/blog/json-import-dialog'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { toPersianDigits } from '@/lib/blog/helpers'
import { cn } from '@/lib/utils'

interface AdminPostRow {
        id: string
        title: string
        slug: string
        status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED'
        views: number
        featured: boolean
        workspace: { id: string; name: string } | null
        category: { name: string; slug: string } | null
        updatedAt: string
        publishedAt: string | null
        excerpt: string | null
        content: string
        coverImage: string | null
        categoryId: string | null
        seoTitle: string | null
        seoDescription: string | null
        seoKeywords: string[]
        canonicalUrl: string | null
        ogImage: string | null
}

const STATUS_LABELS_FA: Record<string, string> = {
        DRAFT: 'پیش‌نویس',
        PUBLISHED: 'منتشر شده',
        SCHEDULED: 'زمان‌بندی شده',
        ARCHIVED: 'بایگانی',
}
const STATUS_LABELS_EN: Record<string, string> = {
        DRAFT: 'Draft',
        PUBLISHED: 'Published',
        SCHEDULED: 'Scheduled',
        ARCHIVED: 'Archived',
}

const STATUS_BADGE_CLS: Record<string, string> = {
        DRAFT: 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200',
        PUBLISHED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        SCHEDULED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        ARCHIVED: 'bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200',
}

export function AdminBlogManager({
        initialPosts,
        initialCategories,
        locale,
}: {
        initialPosts: AdminPostRow[]
        initialCategories: BlogCategory[]
        locale: 'fa' | 'en'
}) {
        const t = useTranslations('blog')
        const [posts, setPosts] = useState<AdminPostRow[]>(initialPosts)
        const [categories] = useState<BlogCategory[]>(initialCategories)
        const [editing, setEditing] = useState<AdminPostRow | null>(null)
        const [creating, setCreating] = useState(false)
        const [deleting, setDeleting] = useState<string | null>(null)
        const [search, setSearch] = useState('')
        const [statusFilter, setStatusFilter] = useState('')
        const [filterSheetOpen, setFilterSheetOpen] = useState(false)
        const filterTriggerRef = useRef<HTMLButtonElement>(null)
        const [jsonImportOpen, setJsonImportOpen] = useState(false)
        const [importedInitial, setImportedInitial] = useState<BlogPostData | null>(null)

        const isFa = locale === 'fa'
        const statusLabels = isFa ? STATUS_LABELS_FA : STATUS_LABELS_EN

        const filtered = posts.filter((p) => {
                if (search) {
                        const q = search.toLowerCase()
                        if (!p.title.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q))
                                return false
                }
                if (statusFilter && p.status !== statusFilter) return false
                return true
        })

        const refresh = useCallback(async () => {
                try {
                        const res = await fetch('/api/admin/blog/posts', { cache: 'no-store' })
                        if (res.ok) {
                                const data = await res.json()
                                if (data.posts) setPosts(data.posts)
                        }
                } catch {
                        // ignore — keep current list
                }
        }, [])

        // Close modal on Escape.
        useEffect(() => {
                if (!editing && !creating) return
                const onKey = (e: KeyboardEvent) => {
                        if (e.key === 'Escape') {
                                setEditing(null)
                                setCreating(false)
                        }
                }
                window.addEventListener('keydown', onKey)
                return () => window.removeEventListener('keydown', onKey)
        }, [editing, creating])

        async function handleDelete(id: string) {
                if (!confirm(isFa ? 'این پست حذف شود؟' : 'Delete this post?')) return
                setDeleting(id)
                try {
                        const res = await fetch(`/api/admin/blog/posts/${id}`, { method: 'DELETE' })
                        if (res.ok) {
                                setPosts((p) => p.filter((x) => x.id !== id))
                        }
                } finally {
                        setDeleting(null)
                }
        }

        function handleClose() {
                setEditing(null)
                setCreating(false)
                setImportedInitial(null)
                void refresh()
        }

        const editingInitial: BlogPostData | null = editing
                ? {
                                id: editing.id,
                                title: editing.title,
                                slug: editing.slug,
                                excerpt: editing.excerpt,
                                content: editing.content,
                                coverImage: editing.coverImage,
                                categoryId: editing.categoryId,
                                status: editing.status,
                                seoTitle: editing.seoTitle,
                                seoDescription: editing.seoDescription,
                                seoKeywords: editing.seoKeywords,
                                canonicalUrl: editing.canonicalUrl,
                                ogImage: editing.ogImage,
                                featured: editing.featured,
                                publishedAt: editing.publishedAt,
                        }
                : null

        const creatingInitial: BlogPostData = importedInitial ?? {
                title: '',
                slug: '',
                excerpt: null,
                content: '',
                coverImage: null,
                categoryId: null,
                status: 'DRAFT',
                seoTitle: null,
                seoDescription: null,
                seoKeywords: [],
                canonicalUrl: null,
                ogImage: null,
                featured: false,
                publishedAt: null,
        }

        function handleJsonImport(data: Partial<BlogPostData>) {
                setImportedInitial({
                        title: '',
                        slug: '',
                        excerpt: null,
                        content: '',
                        coverImage: null,
                        categoryId: null,
                        status: 'DRAFT',
                        seoTitle: null,
                        seoDescription: null,
                        seoKeywords: [],
                        canonicalUrl: null,
                        ogImage: null,
                        featured: false,
                        publishedAt: null,
                        ...data,
                } as BlogPostData)
                setJsonImportOpen(false)
                setCreating(true)
        }

        return (
                <div className="space-y-4 p-5">
                        {/* Action bar: search + buttons */}
                        <div className="sticky top-20 z-20 -mx-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white/95 p-2 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
                                <div className="relative min-w-0 flex-1 basis-48">
                                        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                        <input
                                                type="search"
                                                inputMode="search"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder={isFa ? 'جستجو در عنوان یا slug…' : 'Search title or slug…'}
                                                className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pr-10 text-base text-zinc-800 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 sm:text-sm"
                                        />
                                </div>
                                <button
                                        ref={filterTriggerRef}
                                        type="button"
                                        onClick={() => setFilterSheetOpen(true)}
                                        aria-haspopup="dialog"
                                        aria-expanded={filterSheetOpen}
                                        className={cn(
                                                'relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold md:hidden',
                                                statusFilter
                                                        ? 'border-black bg-black text-white'
                                                        : 'border-zinc-200 bg-white text-zinc-700',
                                        )}
                                >
                                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                                        {isFa ? 'فیلتر' : 'Filter'}
                                        {statusFilter && <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />}
                                </button>
                                <select
                                        value={statusFilter}
                                        onChange={(event) => setStatusFilter(event.target.value)}
                                        aria-label={isFa ? 'فیلتر وضعیت نوشته' : 'Filter post status'}
                                        className="hidden min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 outline-none focus:border-zinc-400 md:block"
                                >
                                        <option value="">{isFa ? 'همه وضعیت‌ها' : 'All statuses'}</option>
                                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                                <div className="flex flex-wrap items-center gap-2">
                                        <button
                                                onClick={() => setJsonImportOpen(true)}
                                                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                                                title={isFa ? 'JSON خروجی Grok را بچسبانید تا فیلدها خودکار پر شوند' : 'Paste Grok JSON to auto-fill fields'}
                                        >
                                                <Wand2 className="h-4 w-4 text-emerald-600" />
                                                {isFa ? 'افزودن از JSON' : 'Import JSON'}
                                        </button>
                                        <button
                                                onClick={() => setCreating(true)}
                                                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                                        >
                                                <Plus className="h-4 w-4" />
                                                {t('newPost')}
                                        </button>
                                </div>
                        </div>

                        <MobileBottomSheet
                                open={filterSheetOpen}
                                title={isFa ? 'فیلتر نوشته‌ها' : 'Filter posts'}
                                description={isFa ? 'وضعیت انتشار را انتخاب کنید' : 'Choose a publishing status'}
                                closeLabel={isFa ? 'بستن فیلترها' : 'Close filters'}
                                triggerRef={filterTriggerRef}
                                onClose={() => setFilterSheetOpen(false)}
                                footer={(
                                        <div className="grid grid-cols-2 gap-2">
                                                <button
                                                        type="button"
                                                        onClick={() => setStatusFilter('')}
                                                        disabled={!statusFilter}
                                                        className="min-h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 disabled:opacity-40"
                                                >
                                                        {isFa ? 'پاک‌کردن' : 'Clear'}
                                                </button>
                                                <button
                                                        type="button"
                                                        onClick={() => setFilterSheetOpen(false)}
                                                        className="min-h-11 rounded-xl bg-black px-4 text-sm font-bold text-white"
                                                >
                                                        {isFa ? `نمایش ${toPersianDigits(filtered.length)} نتیجه` : `Show ${filtered.length} results`}
                                                </button>
                                        </div>
                                )}
                        >
                                <fieldset>
                                        <legend className="mb-2 text-sm font-bold text-zinc-900">
                                                {isFa ? 'وضعیت انتشار' : 'Publishing status'}
                                        </legend>
                                        <div className="grid grid-cols-2 gap-2">
                                                {[
                                                        ['', isFa ? 'همه وضعیت‌ها' : 'All statuses'],
                                                        ...Object.entries(statusLabels),
                                                ].map(([value, label]) => (
                                                        <button
                                                                key={value || 'all'}
                                                                type="button"
                                                                onClick={() => setStatusFilter(value)}
                                                                aria-pressed={statusFilter === value}
                                                                className={cn(
                                                                        'inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-center text-xs font-semibold',
                                                                        statusFilter === value
                                                                                ? 'border-black bg-black text-white'
                                                                                : 'border-zinc-200 bg-white text-zinc-700',
                                                                )}
                                                        >
                                                                {label}
                                                        </button>
                                                ))}
                                        </div>
                                </fieldset>
                        </MobileBottomSheet>

                        {/* List */}
                        {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 py-16 text-center">
                                        <FileText className="h-8 w-8 text-zinc-300" />
                                        <p className="text-sm text-zinc-500">
                                                {isFa ? 'هیچ پستی یافت نشد' : 'No posts found'}
                                        </p>
                                </div>
                        ) : (
                                <>
                                <div className="grid gap-3 md:hidden">
                                        {filtered.map((post) => (
                                                <article key={post.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                                                        <div className="flex items-start gap-3">
                                                                {post.coverImage ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src={post.coverImage} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-xl border border-zinc-200 object-cover" />
                                                                ) : (
                                                                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50"><FileText className="h-5 w-5 text-zinc-300" /></span>
                                                                )}
                                                                <div className="min-w-0 flex-1">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                                <h3 className="line-clamp-2 text-sm font-bold text-zinc-900">{post.title || (isFa ? 'بدون عنوان' : 'Untitled')}</h3>
                                                                                <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium', STATUS_BADGE_CLS[post.status])}>{statusLabels[post.status]}</span>
                                                                        </div>
                                                                        <p dir="ltr" className="mt-1 truncate text-start text-[11px] text-zinc-400">/blog/{post.slug}</p>
                                                                        <p className="mt-2 truncate text-xs text-zinc-500">{post.workspace?.name ?? '—'} · {isFa ? toPersianDigits(post.views) : post.views.toLocaleString('en-US')} {isFa ? 'بازدید' : 'views'}</p>
                                                                </div>
                                                        </div>
                                                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
                                                                <button type="button" onClick={() => setEditing(post)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700"><Edit3 className="h-4 w-4" />{t('edit')}</button>
                                                                <button type="button" onClick={() => handleDelete(post.id)} disabled={deleting === post.id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-100 text-xs font-bold text-red-600 disabled:opacity-50">{deleting === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{isFa ? 'حذف' : 'Delete'}</button>
                                                        </div>
                                                </article>
                                        ))}
                                </div>
                                <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:block">
                                        <table className="w-full text-start text-sm">
                                                <thead className="border-b border-zinc-200 bg-zinc-50/60 text-xs text-zinc-500">
                                                        <tr>
                                                                <th className="px-4 py-3 text-start font-semibold">
                                                                        {isFa ? 'پوستر' : 'Cover'}
                                                                </th>
                                                                <th className="px-4 py-3 text-start font-semibold">
                                                                        {isFa ? 'عنوان' : 'Title'}
                                                                </th>
                                                                <th className="px-4 py-3 text-start font-semibold">
                                                                        {isFa ? 'کسب‌وکار' : 'Workspace'}
                                                                </th>
                                                                <th className="px-4 py-3 text-start font-semibold">
                                                                        {isFa ? 'وضعیت' : 'Status'}
                                                                </th>
                                                                <th className="px-4 py-3 text-start font-semibold">
                                                                        {isFa ? 'بازدید' : 'Views'}
                                                                </th>
                                                                <th className="px-4 py-3"></th>
                                                        </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100">
                                                        {filtered.map((p) => (
                                                                <tr key={p.id} className="transition-colors hover:bg-zinc-50">
                                                                        <td className="px-4 py-3">
                                                                                {p.coverImage ? (
                                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                                        <img
                                                                                                src={p.coverImage}
                                                                                                alt=""
                                                                                                width={64}
                                                                                                height={48}
                                                                                                loading="lazy"
                                                                                                decoding="async"
                                                                                                className="h-12 w-16 shrink-0 rounded-lg border border-zinc-200 object-cover"
                                                                                        />
                                                                                ) : (
                                                                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50">
                                                                                                <FileText className="h-4 w-4 text-zinc-300" />
                                                                                        </div>
                                                                                )}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                                <div className="flex items-center gap-2">
                                                                                        <span className="max-w-[280px] truncate font-medium text-zinc-900">
                                                                                                {p.title || (isFa ? 'بدون عنوان' : 'Untitled')}
                                                                                        </span>
                                                                                        {p.featured && (
                                                                                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                                                                                                        {isFa ? 'ویژه' : 'Featured'}
                                                                                                </span>
                                                                                        )}
                                                                                </div>
                                                                                <div className="mt-0.5 max-w-[280px] truncate text-xs text-zinc-400" dir="ltr">
                                                                                        /blog/{p.slug}
                                                                                </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-zinc-500">
                                                                                {p.workspace?.name ?? '—'}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                                <span
                                                                                        className={cn(
                                                                                                'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
                                                                                                STATUS_BADGE_CLS[p.status],
                                                                                        )}
                                                                                >
                                                                                        {statusLabels[p.status]}
                                                                                </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-zinc-500 tabular-nums">
                                                                                {isFa ? toPersianDigits(p.views) : p.views.toLocaleString('en-US')}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-end">
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                        <button
                                                                                                onClick={() => setEditing(p)}
                                                                                                title={t('edit')}
                                                                                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                                                                                        >
                                                                                                <Edit3 className="h-4 w-4" />
                                                                                        </button>
                                                                                        <button
                                                                                                onClick={() => handleDelete(p.id)}
                                                                                                disabled={deleting === p.id}
                                                                                                title={isFa ? 'حذف' : 'Delete'}
                                                                                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                                                                        >
                                                                                                {deleting === p.id ? (
                                                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                                                ) : (
                                                                                                        <Trash2 className="h-4 w-4" />
                                                                                                )}
                                                                                        </button>
                                                                                </div>
                                                                        </td>
                                                                </tr>
                                                        ))}
                                                </tbody>
                                        </table>
                                </div>
                                </>
                        )}

                        {/* ─── Modal: create or edit ─── */}
                        {(creating || editing) && (
                                <div
                                        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-0 backdrop-blur-sm sm:p-4"
                                        onClick={(e) => {
                                                if (e.target === e.currentTarget) handleClose()
                                        }}
                                >
                                        <div
                                                dir={isFa ? 'rtl' : 'ltr'}
                                                className="min-h-dvh w-full max-w-5xl overflow-hidden rounded-none border border-zinc-200 bg-white shadow-2xl sm:my-8 sm:min-h-0 sm:rounded-2xl"
                                        >
                                                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5">
                                                        <h2 className="text-sm font-semibold text-zinc-900">
                                                                {editing ? t('editPost') : t('newPost')}
                                                        </h2>
                                                        <button
                                                                onClick={handleClose}
                                                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                                                                aria-label={t('close')}
                                                        >
                                                                <X className="h-4 w-4" />
                                                        </button>
                                                </div>

                                                <div className="max-h-[calc(100vh-10rem)] overflow-y-auto">
                                                        <BlogEditor
                                                                initial={editing ? editingInitial! : creatingInitial}
                                                                categories={categories}
                                                                isEdit={!!editing}
                                                                onClose={handleClose}
                                                        />
                                                </div>
                                        </div>
                                </div>
                        )}

                        {/* ─── Optional JSON import dialog ─── */}
                        <JsonImportDialog
                                open={jsonImportOpen}
                                onClose={() => setJsonImportOpen(false)}
                                onImport={handleJsonImport}
                        />
                </div>
        )
}
