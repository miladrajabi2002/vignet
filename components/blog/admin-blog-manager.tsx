'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Edit3, Trash2, Loader2, X, FileText, Wand2, Search, SlidersHorizontal, ImagePlus } from 'lucide-react'
import {
        BlogEditor,
        type BlogPostData,
        type BlogCategory,
} from '@/components/blog/blog-editor'
import { JsonImportDialog } from '@/components/blog/json-import-dialog'
import { PosterPromptDialog } from '@/components/blog/poster-prompt-dialog'
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
        DRAFT: 'bg-[var(--bg-muted)] text-[var(--text-secondary)] ring-1 ring-black/10',
        PUBLISHED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        SCHEDULED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        ARCHIVED: 'bg-[var(--bg-muted)] text-[var(--text-muted)] ring-1 ring-black/10',
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
        const [posterPromptFor, setPosterPromptFor] = useState<AdminPostRow | null>(null)

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
                <div className="space-y-4 p-4 sm:p-5">
                        {/* Action bar: search + buttons */}
                        <div className="sticky top-[calc(max(0.75rem,env(safe-area-inset-top))+5rem)] z-20 -mx-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-default)] bg-white/95 p-2 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
                                <div className="relative min-w-0 flex-1 basis-48">
                                        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                        <input
                                                type="search"
                                                inputMode="search"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder={isFa ? 'جستجو در عنوان یا slug…' : 'Search title or slug…'}
                                                className="input min-h-11 pr-10 text-base sm:text-sm"
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
                                                        : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]',
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
                                        className="hidden min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--border-strong)] md:block"
                                >
                                        <option value="">{isFa ? 'همه وضعیت‌ها' : 'All statuses'}</option>
                                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                                <div className="flex flex-wrap items-center gap-2">
                                        <button
                                                onClick={() => setJsonImportOpen(true)}
                                                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface)]"
                                                title={isFa ? 'JSON خروجی Grok را بچسبانید تا فیلدها خودکار پر شوند' : 'Paste Grok JSON to auto-fill fields'}
                                        >
                                                <Wand2 className="h-4 w-4 text-emerald-600" />
                                                {isFa ? 'افزودن از JSON' : 'Import JSON'}
                                        </button>
                                        <button
                                                onClick={() => setCreating(true)}
                                                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#111] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2a2a2e]"
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
                                                        className="min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-40"
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
                                        <legend className="mb-2 text-sm font-bold text-[var(--text-primary)]">
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
                                                                                : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]',
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
                                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-hover)] py-16 text-center">
                                        <FileText className="h-8 w-8 text-[var(--text-hint)]" />
                                        <p className="text-sm text-[var(--text-muted)]">
                                                {isFa ? 'هیچ پستی یافت نشد' : 'No posts found'}
                                        </p>
                                </div>
                        ) : (
                                <>
                                <div className="grid gap-3 md:hidden">
                                        {filtered.map((post) => (
                                                <article key={post.id} className="rounded-2xl border border-[var(--border-default)] bg-white p-4 shadow-sm">
                                                        <div className="flex items-start gap-3">
                                                                {post.coverImage ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src={post.coverImage} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-xl border border-[var(--border-default)] object-cover" />
                                                                ) : (
                                                                        <button
                                                                                type="button"
                                                                                onClick={() => setPosterPromptFor(post)}
                                                                                title={isFa ? 'بدون پوستر — ساخت پرامپت عکس با ۳ رنگ' : 'No cover — build 3-color poster prompts'}
                                                                                aria-label={isFa ? 'ساخت پرامپت پوستر' : 'Build poster prompts'}
                                                                                className="group grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-[var(--border-hover)] bg-[var(--bg-surface)] transition-colors hover:border-emerald-400 hover:bg-emerald-50/50"
                                                                        >
                                                                                <ImagePlus className="h-5 w-5 text-[var(--text-hint)] transition-colors group-hover:text-[var(--ok)]" />
                                                                                <span className="text-[12px] font-medium text-[var(--text-muted)] transition-colors group-hover:text-emerald-600">{isFa ? 'پوستر' : 'Poster'}</span>
                                                                        </button>
                                                                )}
                                                                <div className="min-w-0 flex-1">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                                <h3 className="line-clamp-2 text-sm font-bold text-[var(--text-primary)]">{post.title || (isFa ? 'بدون عنوان' : 'Untitled')}</h3>
                                                                                <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[12px] font-medium', STATUS_BADGE_CLS[post.status])}>{statusLabels[post.status]}</span>
                                                                        </div>
                                                                        <p dir="ltr" className="mt-1 truncate text-start text-[12px] text-[var(--text-muted)]">/blog/{post.slug}</p>
                                                                        <p className="mt-2 truncate text-xs text-[var(--text-muted)]">{post.workspace?.name ?? '—'} · {isFa ? toPersianDigits(post.views) : post.views.toLocaleString('en-US')} {isFa ? 'بازدید' : 'views'}</p>
                                                                </div>
                                                        </div>
                                                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-3">
                                                                <button type="button" onClick={() => setEditing(post)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] text-xs font-bold text-[var(--text-secondary)]"><Edit3 className="h-4 w-4" />{t('edit')}</button>
                                                                <button type="button" onClick={() => handleDelete(post.id)} disabled={deleting === post.id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-100 text-xs font-bold text-red-600 disabled:opacity-50">{deleting === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{isFa ? 'حذف' : 'Delete'}</button>
                                                        </div>
                                                </article>
                                        ))}
                                </div>
                                <div className="hidden overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white shadow-sm md:block">
                                        <table className="w-full text-start text-sm">
                                                <thead className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] text-xs text-[var(--text-muted)]">
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
                                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                                        {filtered.map((p) => (
                                                                <tr key={p.id} className="transition-colors hover:bg-[var(--bg-surface)]">
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
                                                                                                className="h-12 w-16 shrink-0 rounded-lg border border-[var(--border-default)] object-cover"
                                                                                        />
                                                                                ) : (
                                                                                        <button
                                                                                                type="button"
                                                                                                onClick={() => setPosterPromptFor(p)}
                                                                                                title={isFa ? 'بدون پوستر — ساخت پرامپت عکس با ۳ رنگ' : 'No cover — build 3-color poster prompts'}
                                                                                                aria-label={isFa ? 'ساخت پرامپت پوستر' : 'Build poster prompts'}
                                                                                                className="group flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[var(--border-hover)] bg-[var(--bg-surface)] transition-colors hover:border-emerald-400 hover:bg-emerald-50/50"
                                                                                        >
                                                                                                <ImagePlus className="h-4 w-4 text-[var(--text-hint)] transition-colors group-hover:text-[var(--ok)]" />
                                                                                                <span className="text-[12px] font-medium leading-none text-[var(--text-muted)] transition-colors group-hover:text-emerald-600">{isFa ? 'پوستر' : 'Poster'}</span>
                                                                                        </button>
                                                                                )}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                                <div className="flex items-center gap-2">
                                                                                        <span className="max-w-[280px] truncate font-medium text-[var(--text-primary)]">
                                                                                                {p.title || (isFa ? 'بدون عنوان' : 'Untitled')}
                                                                                        </span>
                                                                                        {p.featured && (
                                                                                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[12px] font-medium text-amber-700 ring-1 ring-amber-200">
                                                                                                        {isFa ? 'ویژه' : 'Featured'}
                                                                                                </span>
                                                                                        )}
                                                                                </div>
                                                                                <div className="mt-0.5 max-w-[280px] truncate text-xs text-[var(--text-muted)]" dir="ltr">
                                                                                        /blog/{p.slug}
                                                                                </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-[var(--text-muted)]">
                                                                                {p.workspace?.name ?? '—'}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                                <span
                                                                                        className={cn(
                                                                                                'inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium',
                                                                                                STATUS_BADGE_CLS[p.status],
                                                                                        )}
                                                                                >
                                                                                        {statusLabels[p.status]}
                                                                                </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-[var(--text-muted)] tabular-nums">
                                                                                {isFa ? toPersianDigits(p.views) : p.views.toLocaleString('en-US')}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-end">
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                        <button
                                                                                                onClick={() => setEditing(p)}
                                                                                                title={t('edit')}
                                                                                                className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
                                                                                        >
                                                                                                <Edit3 className="h-4 w-4" />
                                                                                        </button>
                                                                                        <button
                                                                                                onClick={() => handleDelete(p.id)}
                                                                                                disabled={deleting === p.id}
                                                                                                title={isFa ? 'حذف' : 'Delete'}
                                                                                                className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
                                        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-0 backdrop-blur-sm sm:p-4"
                                        onClick={(e) => {
                                                if (e.target === e.currentTarget) handleClose()
                                        }}
                                >
                                        <div
                                                dir={isFa ? 'rtl' : 'ltr'}
                                                className="min-h-dvh w-full max-w-5xl overflow-hidden rounded-none border border-[var(--border-default)] bg-white shadow-2xl sm:my-8 sm:min-h-0 sm:rounded-2xl"
                                        >
                                                <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-3.5">
                                                        <h2 className="text-sm font-bold text-[var(--text-primary)]">
                                                                {editing ? t('editPost') : t('newPost')}
                                                        </h2>
                                                        <button
                                                                onClick={handleClose}
                                                                className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
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

                        {/* ─── Poster prompts for a post without a cover image ─── */}
                        <PosterPromptDialog
                                open={posterPromptFor !== null}
                                onClose={() => setPosterPromptFor(null)}
                                post={posterPromptFor
                                        ? {
                                                        title: posterPromptFor.title,
                                                        slug: posterPromptFor.slug,
                                                        excerpt: posterPromptFor.excerpt,
                                                        content: posterPromptFor.content,
                                                }
                                        : null}
                        />
                </div>
        )
}
