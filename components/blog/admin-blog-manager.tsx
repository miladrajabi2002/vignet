'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Edit3, Trash2, Loader2, X, FileText, AlertTriangle, Wand2, Search } from 'lucide-react'
import {
        BlogEditor,
        type BlogPostData,
        type BlogCategory,
} from '@/components/blog/blog-editor'
import { JsonImportDialog } from '@/components/blog/json-import-dialog'
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
                <div className="space-y-5">
                        {/* Action bar: search + buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="relative min-w-[240px] flex-1">
                                        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                        <input
                                                type="text"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder={isFa ? 'جستجو در عنوان یا slug…' : 'Search title or slug…'}
                                                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pr-10 text-sm text-zinc-800 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                                        />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                        <button
                                                onClick={() => setJsonImportOpen(true)}
                                                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                                                title={isFa ? 'JSON خروجی Grok را بچسبانید تا فیلدها خودکار پر شوند' : 'Paste Grok JSON to auto-fill fields'}
                                        >
                                                <Wand2 className="h-4 w-4 text-emerald-600" />
                                                {isFa ? 'افزودن از JSON' : 'Import JSON'}
                                        </button>
                                        <button
                                                onClick={() => setCreating(true)}
                                                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                                        >
                                                <Plus className="h-4 w-4" />
                                                {t('newPost')}
                                        </button>
                                </div>
                        </div>

                        {/* List */}
                        {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 py-16 text-center">
                                        <FileText className="h-8 w-8 text-zinc-300" />
                                        <p className="text-sm text-zinc-500">
                                                {isFa ? 'هیچ پستی یافت نشد' : 'No posts found'}
                                        </p>
                                </div>
                        ) : (
                                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                                        <table className="w-full text-start text-sm">
                                                <thead className="border-b border-zinc-200 bg-zinc-50/60 text-xs text-zinc-500">
                                                        <tr>
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
                        )}

                        {/* ─── Modal: create or edit ─── */}
                        {(creating || editing) && (
                                <div
                                        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 backdrop-blur-sm"
                                        onClick={(e) => {
                                                if (e.target === e.currentTarget) handleClose()
                                        }}
                                >
                                        <div
                                                dir={isFa ? 'rtl' : 'ltr'}
                                                className="my-8 w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
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
                                                        {/* Override CSS vars so the editor (designed for the dark dashboard theme)
                                                            matches the admin panel's light palette. */}
                                                        <div
                                                                style={{
                                                                        ['--bg-base' as string]: '#ffffff',
                                                                        ['--bg-surface' as string]: '#ffffff',
                                                                        ['--bg-elevated' as string]: '#f9fafb',
                                                                        ['--bg-hover' as string]: '#f4f4f5',
                                                                        ['--bg-muted' as string]: '#f4f4f5',
                                                                        ['--text-primary' as string]: '#18181b',
                                                                        ['--text-secondary' as string]: '#52525b',
                                                                        ['--text-muted' as string]: '#71717a',
                                                                        ['--text-hint' as string]: '#a1a1aa',
                                                                        ['--border-default' as string]: '#e4e4e7',
                                                                        ['--border-subtle' as string]: '#f4f4f5',
                                                                        ['--border-hover' as string]: '#d4d4d8',
                                                                        ['--border-strong' as string]: '#a1a1aa',
                                                                        ['--white' as string]: '#18181b',
                                                                        ['--success' as string]: '#22c55e',
                                                                        ['--warning' as string]: '#f59e0b',
                                                                        ['--danger' as string]: '#ef4444',
                                                                }}
                                                        >
                                                                <BlogEditor
                                                                        initial={editing ? editingInitial! : creatingInitial}
                                                                        categories={categories}
                                                                        isEdit={!!editing}
                                                                        onClose={handleClose}
                                                                />
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                        )}

                        {filtered.length > 0 && (
                                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                        <div>
                                                <p className="font-medium text-amber-900">{isFa ? 'نکته' : 'Note'}</p>
                                                <p className="mt-1 text-amber-700">
                                                        {isFa
                                                                ? 'پست‌ها با احراز هویت ادمین ذخیره می‌شوند. برای دیدن نسخه عمومی، به /blog بروید. sitemap.xml به‌صورت خودکار همه پست‌های Published را شامل می‌شود.'
                                                                : 'Posts are saved with admin authentication. To see the public version, visit /blog. sitemap.xml automatically includes all published posts.'}
                                                </p>
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
