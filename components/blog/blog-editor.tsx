'use client'

import { useState, useMemo, useRef } from 'react'
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
	ImagePlus,
	Upload,
	Link2,
	X,
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
import { MaterialSelect } from '@/components/ui/material-select'

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

/**
 * Blog editor — LIGHT theme (admin panel).
 * Replaces the previous CSS-variable-based theme so the editor matches the
 * admin panel's white/zinc palette regardless of the user dashboard's dark
 * theme. The editor is only used inside the admin blog manager.
 */
export function BlogEditor({
	initial,
	categories,
	isEdit,
	onClose,
}: {
	initial: BlogPostData
	categories: BlogCategory[]
	isEdit: boolean
	onClose?: () => void
}) {
	const t = useTranslations('blog')
	const router = useRouter()
	const [post, setPost] = useState<BlogPostData>(initial)
	const [saving, setSaving] = useState(false)
	const [saved, setSaved] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [view, setView] = useState<'write' | 'preview'>('write')
	const [keywordInput, setKeywordInput] = useState('')
	const [uploading, setUploading] = useState(false)

	// Image dialog state (insert inline image)
	const [imgDialog, setImgDialog] = useState(false)
	const [imgUrl, setImgUrl] = useState('')
	const [imgAlt, setImgAlt] = useState('')

	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const coverInputRef = useRef<HTMLInputElement>(null)
	const inlineUploadRef = useRef<HTMLInputElement>(null)

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

	// ─── Upload helper ───
	async function uploadImage(file: File): Promise<string | null> {
		setUploading(true)
		try {
			const fd = new FormData()
			fd.append('file', file)
			const res = await fetch('/api/admin/blog/upload', { method: 'POST', body: fd })
			const data = await res.json()
			if (!res.ok) return null
			return data.url as string
		} catch {
			return null
		} finally {
			setUploading(false)
		}
	}

	async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (!file) return
		const url = await uploadImage(file)
		if (url) patch({ coverImage: url })
		e.target.value = ''
	}

	function insertImageAtCursor(url: string, alt: string) {
		const ta = textareaRef.current
		const md = `![${alt}](${url})`
		if (!ta) {
			patch({ content: post.content + '\n' + md + '\n' })
			return
		}
		const start = ta.selectionStart ?? post.content.length
		const end = ta.selectionEnd ?? post.content.length
		const next = post.content.slice(0, start) + md + post.content.slice(end)
		patch({ content: next })
		requestAnimationFrame(() => {
			ta.focus()
			const pos = start + md.length
			ta.setSelectionRange(pos, pos)
		})
	}

	async function handleInlineUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (!file) return
		const url = await uploadImage(file)
		if (url) insertImageAtCursor(url, file.name.replace(/\.[^.]+$/, ''))
		e.target.value = ''
	}

	function confirmInsertImageLink() {
		if (!imgUrl.trim()) return
		insertImageAtCursor(imgUrl.trim(), imgAlt.trim())
		setImgUrl('')
		setImgAlt('')
		setImgDialog(false)
	}

	async function save(status?: BlogPostData['status']) {
		setSaving(true)
		setError(null)
		setSaved(false)

		const payload = {
			...post,
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
			const base = '/api/admin/blog/posts'
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
			router.refresh()
			if (onClose) setTimeout(onClose, 600)
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

	// Shared input class — light theme.
	const inputCls =
		'w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100'

	return (
		<div className="mx-auto max-w-6xl space-y-5 p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-xl font-bold text-zinc-900">
					{isEdit ? t('editPost') : t('newPost')}
				</h1>
				<div className="flex flex-wrap items-center gap-2">
					{saved && (
						<span className="inline-flex items-center gap-1 text-sm text-emerald-600">
							<Check className="h-4 w-4" />
							{t('saved')}
						</span>
					)}
					{onClose && (
						<button
							onClick={onClose}
							disabled={saving}
							className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"
						>
							{t('close')}
						</button>
					)}
					<button
						onClick={() => save('DRAFT')}
						disabled={saving}
						className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
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
						className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
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
				<div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
					{error}
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
						className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg font-medium text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
					/>

					<div className="flex items-center gap-2">
						<span className="text-xs text-zinc-400">/blog/</span>
						<input
							type="text"
							value={post.slug}
							onChange={(e) => patch({ slug: e.target.value })}
							onBlur={(e) => patch({ slug: slugify(e.target.value) })}
							placeholder="slug"
							dir="ltr"
							className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
						/>
					</div>

					{/* Editor tabs + image toolbar */}
					<div className="overflow-hidden rounded-xl border border-zinc-200">
						<div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/60">
							<div className="flex">
								<button
									onClick={() => setView('write')}
									className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
										view === 'write'
											? 'bg-white text-zinc-900'
											: 'text-zinc-500 hover:text-zinc-800'
									}`}
								>
									<Code className="h-3.5 w-3.5" />
									{t('write')}
								</button>
								<button
									onClick={() => setView('preview')}
									className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
										view === 'preview'
											? 'bg-white text-zinc-900'
											: 'text-zinc-500 hover:text-zinc-800'
									}`}
								>
									<Eye className="h-3.5 w-3.5" />
									{t('preview')}
								</button>
							</div>
							{/* Insert-image toolbar */}
							{view === 'write' && (
								<div className="flex items-center gap-1 pe-2">
									<input
										ref={inlineUploadRef}
										type="file"
										accept="image/*"
										className="hidden"
										onChange={handleInlineUpload}
									/>
									<button
										type="button"
										onClick={() => inlineUploadRef.current?.click()}
										disabled={uploading}
										title={isFa(t) ? 'آپلود عکس در متن' : 'Upload image inline'}
										className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
									>
										{uploading ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<Upload className="h-3.5 w-3.5" />
										)}
										{isFa(t) ? 'آپلود عکس' : 'Upload'}
									</button>
									<button
										type="button"
										onClick={() => setImgDialog(true)}
										title={isFa(t) ? 'درج عکس با لینک' : 'Insert image by URL'}
										className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
									>
										<Link2 className="h-3.5 w-3.5" />
										{isFa(t) ? 'لینک عکس' : 'URL'}
									</button>
									<button
										type="button"
										onClick={() => inlineUploadRef.current?.click()}
										disabled={uploading}
										title={isFa(t) ? 'درج عکس' : 'Insert image'}
										className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
									>
										<ImagePlus className="h-3.5 w-3.5" />
										{isFa(t) ? 'درج عکس' : 'Image'}
									</button>
								</div>
							)}
						</div>
						{view === 'write' ? (
							<textarea
								ref={textareaRef}
								value={post.content}
								onChange={(e) => patch({ content: e.target.value })}
								placeholder={t('contentPh')}
								dir="auto"
								className="h-[460px] w-full resize-none bg-white p-4 font-mono text-sm leading-relaxed text-zinc-900 outline-none"
							/>
						) : (
							<div
								dir="auto"
								className="prose prose-sm max-w-none whitespace-pre-wrap p-4 text-zinc-900"
								style={{ minHeight: 460 }}
							>
								{post.content || (
									<span className="text-zinc-400">{t('previewEmpty')}</span>
								)}
							</div>
						)}
					</div>

					{/* Excerpt */}
					<div>
						<label className="mb-1.5 block text-sm text-zinc-700">
							{t('excerpt')}{' '}
							<button
								type="button"
								onClick={() => patch({ excerpt: deriveExcerpt(post.content) })}
								className="ms-1 text-[11px] text-zinc-400 underline hover:text-zinc-600"
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
							className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
						/>
					</div>
				</div>

				{/* Sidebar — SEO + meta */}
				<div className="space-y-4">
					{/* SEO score */}
					<div className="rounded-2xl border border-zinc-200 bg-white p-4">
						<div className="flex items-center justify-between">
							<h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
								<Sparkles className="h-4 w-4 text-amber-500" />
								{t('seoScore')}
							</h3>
							<span
								className={`text-2xl font-bold ${
									seo.score >= 70
										? 'text-emerald-600'
										: seo.score >= 40
											? 'text-amber-500'
											: 'text-red-500'
								}`}
							>
								{toPersianDigits(seo.score)}
							</span>
						</div>
						<ul className="mt-3 space-y-1.5">
							{seo.checks.map((c, i) => (
								<li key={i} className="flex items-start gap-2 text-xs">
									{c.status === 'pass' ? (
										<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
									) : c.status === 'warn' ? (
										<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
									) : (
										<XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
									)}
									<span className="text-zinc-600">
										{c.label}
										{c.hint ? (
											<span className="ms-1 text-zinc-400">· {c.hint}</span>
										) : null}
									</span>
								</li>
							))}
						</ul>
					</div>

					{/* SEO fields */}
					<div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
						<h3 className="text-sm font-semibold text-zinc-900">{t('seoFields')}</h3>
						<label className="block">
							<div className="mb-1 flex items-center justify-between">
								<span className="text-xs text-zinc-600">{t('seoTitle')}</span>
								<button
									type="button"
									onClick={() => patch({ seoTitle: deriveSeoTitle(post.title) })}
									className="text-[10px] text-zinc-400 underline hover:text-zinc-600"
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
								className={inputCls}
							/>
							<div className="mt-0.5 text-end text-[10px] text-zinc-400">
								{(post.seoTitle ?? deriveSeoTitle(post.title)).length} / 60
							</div>
						</label>
						<label className="block">
							<div className="mb-1 flex items-center justify-between">
								<span className="text-xs text-zinc-600">{t('seoDescription')}</span>
								<button
									type="button"
									onClick={() =>
										patch({
											seoDescription: deriveSeoDescription(post.excerpt, post.content),
										})
									}
									className="text-[10px] text-zinc-400 underline hover:text-zinc-600"
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
								className={`w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100`}
							/>
							<div className="mt-0.5 text-end text-[10px] text-zinc-400">
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
								<span className="text-xs text-zinc-600">{t('keywords')}</span>
								{suggestedKeywords.length > 0 && (
									<button
										type="button"
										onClick={() => {
											const merged = [
												...new Set([...post.seoKeywords, ...suggestedKeywords]),
											].slice(0, 20)
											patch({ seoKeywords: merged })
										}}
										className="text-[10px] text-zinc-400 underline hover:text-zinc-600"
									>
										{t('addSuggested')}
									</button>
								)}
							</div>
							<div className="flex flex-wrap gap-1.5">
								{post.seoKeywords.map((kw) => (
									<span
										key={kw}
										className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700"
									>
										{kw}
										<button
											type="button"
											onClick={() => removeKeyword(kw)}
											className="text-zinc-400 hover:text-red-500"
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
								className={`mt-2 ${inputCls}`}
							/>
							{suggestedKeywords.length > 0 && (
								<div className="mt-2">
									<div className="mb-1 text-[10px] text-zinc-400">{t('suggested')}:</div>
									<div className="flex flex-wrap gap-1">
										{suggestedKeywords
											.filter((k) => !post.seoKeywords.includes(k))
											.slice(0, 6)
											.map((k) => (
												<button
													key={k}
													type="button"
													onClick={() => addKeyword(k)}
													className="rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-500 transition-colors hover:text-zinc-800"
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
					<div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
						<h3 className="text-sm font-semibold text-zinc-900">{t('publishSettings')}</h3>
						<label className="block">
							<span className="mb-1 block text-xs text-zinc-600">{t('category')}</span>
							<MaterialSelect
								value={post.categoryId ?? ''}
								onValueChange={(value) => patch({ categoryId: value || null })}
								ariaLabel={t('category')}
								options={[
									{ value: '', label: t('noCategory') },
									...categories.map((category) => ({ value: category.id, label: category.name })),
								]}
							/>
						</label>

						{/* Cover image: URL + Upload + preview */}
						<div>
							<span className="mb-1 block text-xs text-zinc-600">{t('coverImage')}</span>
							<div className="flex gap-2">
								<input
									type="url"
									value={post.coverImage ?? ''}
									onChange={(e) => patch({ coverImage: e.target.value || null })}
									placeholder="https://…"
									dir="ltr"
									className={inputCls}
								/>
								<input
									ref={coverInputRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={handleCoverUpload}
								/>
								<button
									type="button"
									onClick={() => coverInputRef.current?.click()}
									disabled={uploading}
									className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"
								>
									{uploading ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
									) : (
										<Upload className="h-3.5 w-3.5" />
									)}
									{isFa(t) ? 'آپلود' : 'Upload'}
								</button>
							</div>
							{post.coverImage && (
								<div className="relative mt-2 overflow-hidden rounded-lg border border-zinc-200">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={post.coverImage}
										alt=""
										loading="lazy"
										decoding="async"
										className="h-28 w-full object-cover"
									/>
									<button
										type="button"
										onClick={() => patch({ coverImage: null })}
										className="absolute top-1.5 end-1.5 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								</div>
							)}
						</div>

						<label className="block">
							<span className="mb-1 block text-xs text-zinc-600">{t('canonicalUrl')}</span>
							<input
								type="url"
								value={post.canonicalUrl ?? ''}
								onChange={(e) => patch({ canonicalUrl: e.target.value || null })}
								placeholder="https://…"
								dir="ltr"
								className={inputCls}
							/>
						</label>
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={post.featured}
								onChange={(e) => patch({ featured: e.target.checked })}
								className="h-4 w-4 accent-zinc-900"
							/>
							<span className="text-xs text-zinc-600">{t('featured')}</span>
						</label>
						<div>
							<span className="mb-1 block text-xs text-zinc-600">{t('status')}</span>
							<div className="flex flex-wrap gap-1">
								{(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'] as const).map((s) => (
									<button
										key={s}
										type="button"
										onClick={() => patch({ status: s })}
										className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
											post.status === s
												? 'border-zinc-900 bg-zinc-900 text-white'
												: 'border-zinc-200 text-zinc-600 hover:text-zinc-900'
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

			{/* ─── Insert-image-by-URL dialog ─── */}
			{imgDialog && (
				<div
					className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"
					onClick={(e) => {
						if (e.target === e.currentTarget) setImgDialog(false)
					}}
				>
					<div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
						<div className="mb-3 flex items-center justify-between">
							<h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
								<Link2 className="h-4 w-4" />
								{isFa(t) ? 'درج عکس با لینک' : 'Insert image by URL'}
							</h3>
							<button
								onClick={() => setImgDialog(false)}
								className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<div className="space-y-3">
							<label className="block">
								<span className="mb-1 block text-xs text-zinc-600">
									{isFa(t) ? 'آدرس عکس' : 'Image URL'}
								</span>
								<input
									type="url"
									value={imgUrl}
									onChange={(e) => setImgUrl(e.target.value)}
									placeholder="https://example.com/image.jpg"
									dir="ltr"
									autoFocus
									className={inputCls}
								/>
							</label>
							<label className="block">
								<span className="mb-1 block text-xs text-zinc-600">
									{isFa(t) ? 'متن جایگزین (اختیاری)' : 'Alt text (optional)'}
								</span>
								<input
									type="text"
									value={imgAlt}
									onChange={(e) => setImgAlt(e.target.value)}
									dir="auto"
									className={inputCls}
								/>
							</label>
							{imgUrl && (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={imgUrl}
									alt=""
									loading="lazy"
									decoding="async"
									className="max-h-40 w-full rounded-lg border border-zinc-200 object-contain"
								/>
							)}
							<div className="flex justify-end gap-2">
								<button
									onClick={() => setImgDialog(false)}
									className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
								>
									{isFa(t) ? 'انصراف' : 'Cancel'}
								</button>
								<button
									onClick={confirmInsertImageLink}
									disabled={!imgUrl.trim()}
									className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
								>
									<ImagePlus className="h-3.5 w-3.5" />
									{isFa(t) ? 'درج' : 'Insert'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

// Tiny locale helper so we don't depend on a hook outside the component body.
function isFa(t: (k: string) => string): boolean {
	const label = t('newPost')
	return /[\u0600-\u06FF]/.test(label)
}
