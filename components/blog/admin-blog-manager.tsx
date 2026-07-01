'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Edit3, Trash2, Loader2, X, FileText, AlertTriangle } from 'lucide-react'
import {
	BlogEditor,
	type BlogPostData,
	type BlogCategory,
} from '@/components/blog/blog-editor'
import { toPersianDigits } from '@/lib/blog/helpers'

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
const STATUS_COLORS: Record<string, string> = {
	DRAFT: 'bg-zinc-700/40 text-zinc-300',
	PUBLISHED: 'bg-emerald-500/15 text-emerald-300',
	SCHEDULED: 'bg-amber-500/15 text-amber-300',
	ARCHIVED: 'bg-zinc-700/40 text-zinc-400',
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
		// Refresh list to reflect any save.
		void refresh()
	}

	// ─── Editing payload (convert AdminPostRow → BlogPostData) ───
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

	const creatingInitial: BlogPostData = {
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

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-light text-zinc-100">{isFa ? 'بلاگ' : 'Blog'}</h1>
					<p className="mt-1 text-xs text-zinc-500">
						{isFa
							? 'مدیریت همه پست‌های بلاگ در همه کسب‌وکارها'
							: 'Manage all blog posts across all workspaces'}
					</p>
				</div>
				<button
					onClick={() => setCreating(true)}
					className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
				>
					<Plus className="h-4 w-4" />
					{t('newPost')}
				</button>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-2">
				<input
					type="text"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={isFa ? 'جستجو در عنوان یا slug…' : 'Search title or slug…'}
					className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-zinc-700"
				/>
			</div>

			{/* List */}
			{filtered.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-zinc-800 p-16 text-center">
					<FileText className="mx-auto h-8 w-8 text-zinc-600" />
					<p className="mt-4 text-sm text-zinc-500">
						{isFa ? 'هیچ پستی یافت نشد' : 'No posts found'}
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
					<table className="w-full text-start text-sm">
						<thead className="bg-zinc-900/60 text-xs text-zinc-500">
							<tr>
								<th className="px-4 py-3 text-start font-medium">
									{isFa ? 'عنوان' : 'Title'}
								</th>
								<th className="px-4 py-3 text-start font-medium">
									{isFa ? 'کسب‌وکار' : 'Workspace'}
								</th>
								<th className="px-4 py-3 text-start font-medium">
									{isFa ? 'وضعیت' : 'Status'}
								</th>
								<th className="px-4 py-3 text-start font-medium">
									{isFa ? 'بازدید' : 'Views'}
								</th>
								<th className="px-4 py-3"></th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-800">
							{filtered.map((p) => (
								<tr key={p.id} className="hover:bg-zinc-900/50">
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											<span className="truncate font-medium text-zinc-200">
												{p.title}
											</span>
											{p.featured && (
												<span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
													{isFa ? 'ویژه' : 'Featured'}
												</span>
											)}
										</div>
										<div className="mt-0.5 truncate text-xs text-zinc-500">
											/blog/{p.slug}
										</div>
									</td>
									<td className="px-4 py-3 text-zinc-400">{p.workspace?.name ?? '—'}</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[p.status]}`}
										>
											{statusLabels[p.status]}
										</span>
									</td>
									<td className="px-4 py-3 text-zinc-400">
										{isFa ? toPersianDigits(p.views) : p.views.toLocaleString('en-US')}
									</td>
									<td className="px-4 py-3 text-end">
										<div className="flex items-center justify-end gap-1">
											<button
												onClick={() => setEditing(p)}
												title={t('edit')}
												className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
											>
												<Edit3 className="h-3.5 w-3.5" />
											</button>
											<button
												onClick={() => handleDelete(p.id)}
												disabled={deleting === p.id}
												title={isFa ? 'حذف' : 'Delete'}
												className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
											>
												{deleting === p.id ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<Trash2 className="h-3.5 w-3.5" />
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
					className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
					onClick={(e) => {
						if (e.target === e.currentTarget) handleClose()
					}}
				>
					<div
						dir={isFa ? 'rtl' : 'ltr'}
						className="my-8 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950"
						style={{
							boxShadow: '0 28px 80px -18px rgba(0,0,0,.65)',
							// Re-theme the inner editor (which uses [var(--...)] tokens) so it
							// matches the admin panel's dark palette.
						}}
					>
						<div className="flex items-center justify-between border-b border-zinc-800 p-4">
							<h2 className="text-sm font-medium text-zinc-200">
								{editing ? t('editPost') : t('newPost')}
							</h2>
							<button
								onClick={handleClose}
								className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
								aria-label={t('close')}
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5">
							{/* Override CSS vars so the editor (designed for the dashboard theme)
                  matches the admin dark palette. */}
							<div
								style={{
									// Inline CSS-var overrides — keeps the editor reusable.
									['--bg-base' as string]: '#09090b',
									['--bg-surface' as string]: '#18181b',
									['--bg-elevated' as string]: '#1f1f23',
									['--bg-hover' as string]: '#27272a',
									['--bg-muted' as string]: '#1f1f23',
									['--text-primary' as string]: '#f4f4f5',
									['--text-secondary' as string]: '#a1a1aa',
									['--text-muted' as string]: '#71717a',
									['--text-hint' as string]: '#52525b',
									['--border-default' as string]: 'rgba(255,255,255,.08)',
									['--border-subtle' as string]: 'rgba(255,255,255,.05)',
									['--border-hover' as string]: 'rgba(255,255,255,.18)',
									['--border-strong' as string]: 'rgba(255,255,255,.28)',
									['--white' as string]: '#fafafa',
									['--success' as string]: '#34d399',
									['--warning' as string]: '#fbbf24',
									['--danger' as string]: '#f87171',
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
				<div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-500">
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
					<div>
						<p className="font-medium text-zinc-300">{isFa ? 'نکته' : 'Note'}</p>
						<p className="mt-1">
							{isFa
								? 'پست‌ها با احراز هویت ادمین ذخیره می‌شوند. برای دیدن نسخه عمومی، به /blog بروید. sitemap.xml به‌صورت خودکار همه پست‌های Published را شامل می‌شود.'
								: 'Posts are saved with admin authentication. To see the public version, visit /blog. sitemap.xml automatically includes all published posts.'}
						</p>
					</div>
				</div>
			)}
		</div>
	)
}
