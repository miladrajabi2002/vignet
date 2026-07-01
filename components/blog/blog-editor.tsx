'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
	Loader2,
	Save,
	Check,
	Eye,
	Code,
	Sparkles,
	AlertTriangle,
	CheckCircle2,
	XCircle,
} from 'lucide-react'
import {
	slugify,
	deriveExcerpt,
	deriveSeoTitle,
	deriveSeoDescription,
	extractKeywords,
	analyzeSeo,
	toPersianDigits,
	type SeoAnalysis,
} from '@/lib/blog/helpers'

export interface BlogPostData {
	id?: string
	title: string
	slug: string
	excerpt: string | null
	content: string
	coverImage: string | null
	categoryId: string | null
	status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED'
	seoTitle: string | null
	seoDescription: string | null
	seoKeywords: string[]
	canonicalUrl: string | null
	ogImage: string | null
	featured: boolean
	publishedAt: string | null
}

export interface BlogCategory {
	id: string
	name: string
}

export interface BlogWorkspace {
	id: string
	name: string
}

export function BlogEditor({
	initial,
	categories,
	isEdit,
	adminMode = false,
	workspaces,
	workspaceId: initialWorkspaceId,
	onClose,
}: {
	initial: BlogPostData
	categories: BlogCategory[]
	isEdit: boolean
	/** When true, posts to /api/admin/blog/* (admin auth) instead of /api/blog/* (user auth). */
	adminMode?: boolean
	/** Required in adminMode so the admin can pick which workspace owns the post. */
	workspaces?: BlogWorkspace[]
	/** Pre-selected workspace for new posts (admin mode). */
	workspaceId?: string | null
	/** Optional close handler — when provided, a "بستن" button appears next to Save. */
	onClose?: () => void
}) {
	const t = useTranslations('blog')
	const router = useRouter()
	const [post, setPost] = useState<BlogPostData>(initial)
	const [workspaceId, setWorkspaceId] = useState<string | null>(
		initialWorkspaceId ?? null,
	)
	const [saving, setSaving] = useState(false)
	const [saved, setSaved] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [view, setView] = useState<'write' | 'preview'>('write')
	const [keywordInput, setKeywordInput] = useState('')

	function patch(p: Partial<BlogPostData>) {
		setPost((s) => ({ ...s, ...p }))
		setSaved(false)
	}

	const seo: SeoAnalysis = useMemo(
		() =>
			analyzeSeo({
				title: post.title,
				slug: post.slug,
				excerpt: post.excerpt,
				content: post.content,
				seoTitle: post.seoTitle,
				seoDescription: post.seoDescription,
				seoKeywords: post.seoKeywords,
				coverImage: post.coverImage,
			}),
		[post],
	)

	const suggestedKeywords = useMemo(
		() => extractKeywords(post.content, 10),
		[post.content],
	)

	async function save(status?: BlogPostData['status']) {
		setSaving(true)
		setError(null)
		setSaved(false)

		// In admin mode, a workspaceId is required (admin can post on behalf of any workspace).
		if (adminMode && !workspaceId) {
			setError(t('errWorkspaceRequired'))
			setSaving(false)
			return
		}

		const payload = {
			...post,
			...(adminMode ? { workspaceId } : {}),
			slug: slugify(post.slug || post.title),
			excerpt: post.excerpt || deriveExcerpt(post.content),
			seoTitle: post.seoTitle || null,
			seoDescription: post.seoDescription || null,
			status: status ?? post.status,
			coverImage: post.coverImage || null,
			canonicalUrl: post.canonicalUrl || null,
			ogImage: post.ogImage || null,
		}
		try {
			const base = adminMode ? '/api/admin/blog/posts' : '/api/blog/posts'
			const url = isEdit ? `${base}/${post.id}` : base
			const method = isEdit ? 'PATCH' : 'POST'
			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			const data = await res.json()
			if (!res.ok) {
				if (data.error === 'SLUG_TAKEN') {
					setError(t('errSlugTaken'))
				} else {
					setError(data.message || t('errSave'))
				}
				return
			}
			setSaved(true)
			if (adminMode) {
				// In admin mode we typically render in a modal; refresh + call onClose.
				router.refresh()
				if (onClose) setTimeout(onClose, 600)
			} else if (!isEdit && data.post?.id) {
				router.push(`/blog-admin/${data.post.id}/edit`)
				router.refresh()
			} else {
				router.refresh()
			}
		} catch {
			setError(t('errSave'))
		} finally {
			setSaving(false)
		}
	}

	function addKeyword(kw: string) {
		const k = kw.trim()
		if (!k) return
		if (post.seoKeywords.includes(k)) return
		if (post.seoKeywords.length >= 20) return
		patch({ seoKeywords: [...post.seoKeywords, k] })
		setKeywordInput('')
	}
	function removeKeyword(kw: string) {
		patch({ seoKeywords: post.seoKeywords.filter((k) => k !== kw) })
	}

	return (
		<div className="mx-auto max-w-6xl space-y-5">
			<div className="flex items-center justify-between gap-3">
				<h1 className="text-2xl font-light text-[var(--text-primary)]">
					{isEdit ? t('editPost') : t('newPost')}
				</h1>
				<div className="flex items-center gap-2">
					{saved && (
						<span className="inline-flex items-center gap-1 text-sm text-success">
							<Check className="h-4 w-4" />
							{t('saved')}
						</span>
					)}
					{onClose && (
						<button
							onClick={onClose}
							disabled={saving}
							className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
						>
							{t('close')}
						</button>
					)}
					<button
						onClick={() => save('DRAFT')}
						disabled={saving}
						className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
					>
						{saving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
						{t('saveDraft')}
					</button>
					<button
						onClick={() => save('PUBLISHED')}
						disabled={saving}
						className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
					>
						{saving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Check className="h-4 w-4" />
						)}
						{t('publish')}
					</button>
				</div>
			</div>

			{error && (
				<div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
					{error}
				</div>
			)}

			{/* Workspace selector — admin mode only (admin can post on behalf of any tenant). */}
			{adminMode && workspaces && workspaces.length > 0 && (
				<div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
					<label className="block">
						<span className="mb-1 block text-xs text-[var(--text-secondary)]">
							{t('workspace')}
						</span>
						<select
							value={workspaceId ?? ''}
							onChange={(e) => setWorkspaceId(e.target.value || null)}
							disabled={isEdit}
							className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] disabled:opacity-60"
						>
							<option value="">{t('selectWorkspace')}</option>
							{workspaces.map((w) => (
								<option key={w.id} value={w.id}>
									{w.name}
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			<div className="grid gap-5 lg:grid-cols-3">
				{/* Main editor (2 cols) */}
				<div className="space-y-4 lg:col-span-2">
					<input
						type="text"
						value={post.title}
						onChange={(e) => patch({ title: e.target.value })}
						placeholder={t('titlePh')}
						className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-lg font-medium text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>

					<div className="flex items-center gap-2">
						<span className="text-xs text-[var(--text-muted)]">/blog/</span>
						<input
							type="text"
							value={post.slug}
							onChange={(e) => patch({ slug: e.target.value })}
							onBlur={(e) => patch({ slug: slugify(e.target.value) })}
							placeholder="slug"
							dir="ltr"
							className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
						/>
					</div>

					{/* Editor tabs */}
					<div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
						<div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
							<button
								onClick={() => setView('write')}
								className={`flex items-center gap-1.5 px-4 py-2 text-xs ${
									view === 'write'
										? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
										: 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
								}`}
							>
								<Code className="h-3.5 w-3.5" />
								{t('write')}
							</button>
							<button
								onClick={() => setView('preview')}
								className={`flex items-center gap-1.5 px-4 py-2 text-xs ${
									view === 'preview'
										? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
										: 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
								}`}
							>
								<Eye className="h-3.5 w-3.5" />
								{t('preview')}
							</button>
						</div>
						{view === 'write' ? (
							<textarea
								value={post.content}
								onChange={(e) => patch({ content: e.target.value })}
								placeholder={t('contentPh')}
								dir="auto"
								className="h-[460px] w-full resize-none bg-[var(--bg-surface)] p-4 font-mono text-sm leading-relaxed text-[var(--text-primary)] outline-none"
							/>
						) : (
							<div
								dir="auto"
								className="prose prose-sm max-w-none whitespace-pre-wrap p-4 text-[var(--text-primary)]"
								style={{ minHeight: 460 }}
							>
								{post.content || (
									<span className="text-[var(--text-muted)]">{t('previewEmpty')}</span>
								)}
							</div>
						)}
					</div>

					{/* Excerpt */}
					<div>
						<label className="mb-1.5 block text-sm text-[var(--text-secondary)]">
							{t('excerpt')}{' '}
							<button
								type="button"
								onClick={() => patch({ excerpt: deriveExcerpt(post.content) })}
								className="ms-1 text-[11px] text-[var(--text-muted)] underline hover:text-[var(--text-secondary)]"
							>
								{t('autoFill')}
							</button>
						</label>
						<textarea
							value={post.excerpt ?? ''}
							onChange={(e) => patch({ excerpt: e.target.value })}
							rows={2}
							placeholder={t('excerptPh')}
							dir="auto"
							className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
						/>
					</div>
				</div>

				{/* Sidebar — SEO + meta */}
				<div className="space-y-4">
					{/* SEO score */}
					<div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
						<div className="flex items-center justify-between">
							<h3 className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
								<Sparkles className="h-4 w-4 text-warning" />
								{t('seoScore')}
							</h3>
							<span
								className={`text-2xl font-light ${
									seo.score >= 70
										? 'text-success'
										: seo.score >= 40
											? 'text-warning'
											: 'text-danger'
								}`}
							>
								{toPersianDigits(seo.score)}
							</span>
						</div>
						<ul className="mt-3 space-y-1.5">
							{seo.checks.map((c, i) => (
								<li key={i} className="flex items-start gap-2 text-xs">
									{c.status === 'pass' ? (
										<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
									) : c.status === 'warn' ? (
										<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
									) : (
										<XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
									)}
									<span className="text-[var(--text-secondary)]">
										{c.label}
										{c.hint ? (
											<span className="ms-1 text-[var(--text-muted)]">· {c.hint}</span>
										) : null}
									</span>
								</li>
							))}
						</ul>
					</div>

					{/* SEO fields */}
					<div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
						<h3 className="text-sm font-medium text-[var(--text-primary)]">
							{t('seoFields')}
						</h3>
						<label className="block">
							<div className="mb-1 flex items-center justify-between">
								<span className="text-xs text-[var(--text-secondary)]">
									{t('seoTitle')}
								</span>
								<button
									type="button"
									onClick={() => patch({ seoTitle: deriveSeoTitle(post.title) })}
									className="text-[10px] text-[var(--text-muted)] underline hover:text-[var(--text-secondary)]"
								>
									{t('autoFill')}
								</button>
							</div>
							<input
								type="text"
								value={post.seoTitle ?? ''}
								onChange={(e) => patch({ seoTitle: e.target.value || null })}
								placeholder={deriveSeoTitle(post.title)}
								dir="auto"
								className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
							/>
							<div className="mt-0.5 text-end text-[10px] text-[var(--text-muted)]">
								{(post.seoTitle ?? deriveSeoTitle(post.title)).length} / 60
							</div>
						</label>
						<label className="block">
							<div className="mb-1 flex items-center justify-between">
								<span className="text-xs text-[var(--text-secondary)]">
									{t('seoDescription')}
								</span>
								<button
									type="button"
									onClick={() =>
										patch({
											seoDescription: deriveSeoDescription(post.excerpt, post.content),
										})
									}
									className="text-[10px] text-[var(--text-muted)] underline hover:text-[var(--text-secondary)]"
								>
									{t('autoFill')}
								</button>
							</div>
							<textarea
								value={post.seoDescription ?? ''}
								onChange={(e) => patch({ seoDescription: e.target.value || null })}
								rows={3}
								placeholder={deriveSeoDescription(post.excerpt, post.content)}
								dir="auto"
								className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
							/>
							<div className="mt-0.5 text-end text-[10px] text-[var(--text-muted)]">
								{
									(
										post.seoDescription ??
										deriveSeoDescription(post.excerpt, post.content)
									).length
								}{' '}
								/ 160
							</div>
						</label>
						{/* Keywords */}
						<div>
							<div className="mb-1 flex items-center justify-between">
								<span className="text-xs text-[var(--text-secondary)]">
									{t('keywords')}
								</span>
								{suggestedKeywords.length > 0 && (
									<button
										type="button"
										onClick={() => {
											const merged = [
												...new Set([...post.seoKeywords, ...suggestedKeywords]),
											].slice(0, 20)
											patch({ seoKeywords: merged })
										}}
										className="text-[10px] text-[var(--text-muted)] underline hover:text-[var(--text-secondary)]"
									>
										{t('addSuggested')}
									</button>
								)}
							</div>
							<div className="flex flex-wrap gap-1.5">
								{post.seoKeywords.map((kw) => (
									<span
										key={kw}
										className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
									>
										{kw}
										<button
											type="button"
											onClick={() => removeKeyword(kw)}
											className="text-[var(--text-muted)] hover:text-danger"
										>
											×
										</button>
									</span>
								))}
							</div>
							<input
								type="text"
								value={keywordInput}
								onChange={(e) => setKeywordInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ',') {
										e.preventDefault()
										addKeyword(keywordInput)
									}
								}}
								placeholder={t('keywordsPh')}
								className="mt-2 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
							/>
							{suggestedKeywords.length > 0 && (
								<div className="mt-2">
									<div className="mb-1 text-[10px] text-[var(--text-muted)]">
										{t('suggested')}:
									</div>
									<div className="flex flex-wrap gap-1">
										{suggestedKeywords
											.filter((k) => !post.seoKeywords.includes(k))
											.slice(0, 6)
											.map((k) => (
												<button
													key={k}
													type="button"
													onClick={() => addKeyword(k)}
													className="rounded-full border border-dashed border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
												>
													+ {k}
												</button>
											))}
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Publish settings */}
					<div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
						<h3 className="text-sm font-medium text-[var(--text-primary)]">
							{t('publishSettings')}
						</h3>
						<label className="block">
							<span className="mb-1 block text-xs text-[var(--text-secondary)]">
								{t('category')}
							</span>
							<select
								value={post.categoryId ?? ''}
								onChange={(e) => patch({ categoryId: e.target.value || null })}
								className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
							>
								<option value="">{t('noCategory')}</option>
								{categories.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</select>
						</label>
						<label className="block">
							<span className="mb-1 block text-xs text-[var(--text-secondary)]">
								{t('coverImage')}
							</span>
							<input
								type="url"
								value={post.coverImage ?? ''}
								onChange={(e) => patch({ coverImage: e.target.value || null })}
								placeholder="https://…"
								dir="ltr"
								className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block text-xs text-[var(--text-secondary)]">
								{t('canonicalUrl')}
							</span>
							<input
								type="url"
								value={post.canonicalUrl ?? ''}
								onChange={(e) => patch({ canonicalUrl: e.target.value || null })}
								placeholder="https://…"
								dir="ltr"
								className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
							/>
						</label>
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={post.featured}
								onChange={(e) => patch({ featured: e.target.checked })}
								className="h-4 w-4 accent-[var(--white)]"
							/>
							<span className="text-xs text-[var(--text-secondary)]">
								{t('featured')}
							</span>
						</label>
						<div>
							<span className="mb-1 block text-xs text-[var(--text-secondary)]">
								{t('status')}
							</span>
							<div className="flex flex-wrap gap-1">
								{(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'] as const).map((s) => (
									<button
										key={s}
										type="button"
										onClick={() => patch({ status: s })}
										className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
											post.status === s
												? 'border-[var(--white)] bg-[var(--white)] text-[var(--bg-base)]'
												: 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
										}`}
									>
										{t(`status_${s}`)}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
