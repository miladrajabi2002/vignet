'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wand2,
  ClipboardPaste,
  Sparkles,
} from 'lucide-react'
import type { BlogPostData } from '@/components/blog/blog-editor'
import { slugify } from '@/lib/blog/helpers'

/**
 * JSON Import Dialog (اختیاری)
 * ==============================
 *
 * A modal that lets the admin paste a JSON object (the kind Grok produces)
 * and auto-fills the blog editor fields from it. Solves two pain points:
 *   1. `\n` literals in JSON content render as text — we convert them to
 *      real newlines so Markdown renders correctly in the editor preview.
 *   2. Copy-pasting field-by-field is tedious — one click fills everything.
 *
 * Also shows a live SEO check (mirrors lib/blog/helpers.ts analyzeSeo) so
 * the admin sees at-a-glance whether the imported post passes the blog
 * editor's quality bar.
 *
 * The dialog is optional — opened via the "افزودن از JSON" button next to
 * the "افزودن پست" button in the admin blog manager. It returns a partial
 * BlogPostData that the parent merges into its `creatingInitial`.
 */

// ── SEO validation (mirrors lib/blog/helpers.ts analyzeSeo) ──────────
interface SeoCheck {
  label: string
  status: 'pass' | 'warn' | 'fail'
  hint?: string
}

function validateSeo(post: Partial<BlogPostData>): SeoCheck[] {
  const checks: SeoCheck[] = []
  const wordCount = (post.content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*>\-|`\[\]()!]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length

  // Title 30-60
  const tl = (post.title || '').length
  if (tl >= 30 && tl <= 60) checks.push({ label: 'عنوان: ۳۰–۶۰ کاراکتر', status: 'pass' })
  else if (tl > 0) checks.push({ label: 'عنوان: ۳۰–۶۰ کاراکتر', status: 'warn', hint: `${tl} کاراکتر` })
  else checks.push({ label: 'عنوان: ۳۰–۶۰ کاراکتر', status: 'fail' })

  // SEO title
  const st = (post.seoTitle || post.title || '').length
  if (st >= 30 && st <= 60) checks.push({ label: 'متا عنوان سئو', status: 'pass' })
  else checks.push({ label: 'متا عنوان سئو', status: 'warn', hint: `${st} کاراکتر` })

  // Meta description
  const sd = (post.seoDescription || '').length
  if (sd >= 70 && sd <= 160) checks.push({ label: 'متا توضیحات (۷۰–۱۶۰)', status: 'pass' })
  else if (sd > 0) checks.push({ label: 'متا توضیحات (۷۰–۱۶۰)', status: 'warn', hint: `${sd} کاراکتر` })
  else checks.push({ label: 'متا توضیحات (۷۰–۱۶۰)', status: 'fail' })

  // Slug — must be English (a-z 0-9 -)
  const slug = post.slug || ''
  const slugOk = slug && /^[a-z0-9-]+$/.test(slug) && slug.length >= 3
  if (slugOk) checks.push({ label: 'نامک انگلیبی', status: 'pass' })
  else checks.push({ label: 'نامک انگلیبی', status: 'fail', hint: slug ? 'فقط a-z 0-9 -' : 'خالی' })

  // Word count
  if (wordCount >= 800) checks.push({ label: `طول محتوا (${wordCount} کلمه)`, status: 'pass' })
  else if (wordCount >= 300) checks.push({ label: `طول محتوا (${wordCount} کلمه)`, status: 'warn', hint: 'حداقل ۸۰۰ توصیه می‌شود' })
  else checks.push({ label: `طول محتوا (${wordCount} کلمه)`, status: 'fail' })

  // H2 count
  const h2 = ((post.content || '').match(/^##\s/gm) || []).length
  if (h2 >= 4) checks.push({ label: `زیرعنوان‌ها (${h2} H2)`, status: 'pass' })
  else if (h2 >= 2) checks.push({ label: `زیرعنوان‌ها (${h2} H2)`, status: 'warn' })
  else checks.push({ label: 'زیرعنوان‌ها', status: 'fail' })

  // Keywords
  const kw = (post.seoKeywords || []).length
  if (kw >= 5) checks.push({ label: `کلمات کلیدی (${kw})`, status: 'pass' })
  else if (kw >= 3) checks.push({ label: `کلمات کلیدی (${kw})`, status: 'warn' })
  else checks.push({ label: 'کلمات کلیدی', status: 'fail' })

  return checks
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Convert literal `\n` (backslash-n) to real newlines. Also `\t`. */
function fixNewlines(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

/** Parse JSON with leniency: strip ```json fences, fix trailing commas, smart quotes. */
function lenientParse(raw: string): unknown {
  let s = raw.trim()
  // Strip markdown code fence if present
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fence) s = fence[1].trim()
  // Common fixes
  s = s
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
  return JSON.parse(s)
}

const EMPTY_POST: Partial<BlogPostData> = {
  title: '',
  slug: '',
  excerpt: null,
  content: '',
  seoTitle: null,
  seoDescription: null,
  seoKeywords: [],
  featured: false,
}

export interface JsonImportDialogProps {
  open: boolean
  onClose: () => void
  /** Called with the parsed post data when the user confirms. */
  onImport: (data: Partial<BlogPostData>) => void
}

// ── Poster color variants (3 fixed palettes, no auto-pick) ────────────
//   The admin gets 3 ready-to-copy prompts — one per accent color — and
//   picks whichever fits the post's mood. Each prompt pins exactly ONE
//   accent color so the model never mixes them.
interface PosterColor {
  key: string
  labelFa: string
  labelEn: string
  hex: string
  moodFa: string
  moodEn: string
}
const POSTER_COLORS: PosterColor[] = [
  {
    key: 'blue',
    labelFa: 'آبی سلطنتی',
    labelEn: 'Royal Blue',
    hex: '#2563EB',
    moodFa: 'فناوری، هوش مصنوعی، اتوماسیون',
    moodEn: 'tech, AI, automation',
  },
  {
    key: 'green',
    labelFa: 'سبز زمردی',
    labelEn: 'Emerald',
    hex: '#10B981',
    moodFa: 'پشتیبانی، موفقیت، بهره‌وری',
    moodEn: 'support, success, productivity',
  },
  {
    key: 'amber',
    labelFa: 'کهربایی گرم',
    labelEn: 'Warm Amber',
    hex: '#F59E0B',
    moodFa: 'فروش، رشد، تجاری',
    moodEn: 'sales, growth, business',
  },
]

interface PosterVariant {
  color: PosterColor
  prompt: string
}

export function JsonImportDialog({ open, onClose, onImport }: JsonImportDialogProps) {
  const t = useTranslations('blog')
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState<Partial<BlogPostData> | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The imagePrompt field from Grok's JSON (not a BlogPostData field, kept separate).
  const [imagePrompt, setImagePrompt] = useState<string | null>(null)
  // The 3 generated Vigent-branded poster prompts (one per accent color).
  const [posterVariants, setPosterVariants] = useState<PosterVariant[] | null>(null)
  // Track which variant was just copied (by color key) for the ✓ feedback.
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const checks = useMemo(() => (parsed ? validateSeo(parsed) : []), [parsed])
  const score = useMemo(() => {
    if (!checks.length) return 0
    const w = { pass: 1, warn: 0.5, fail: 0 }
    const total = checks.reduce((a, c) => a + w[c.status], 0)
    return Math.round((total / checks.length) * 100)
  }, [checks])

  function handleParse() {
    setError(null)
    if (!raw.trim()) {
      setError('ابتدا JSON را در کادر بالا بچسبانید.')
      return
    }
    try {
      const obj = lenientParse(raw) as Record<string, unknown>
      // Build a partial BlogPostData, fixing newlines + ensuring slug is English.
      const out: Partial<BlogPostData> = { ...EMPTY_POST }
      if (typeof obj.title === 'string') out.title = obj.title
      if (typeof obj.slug === 'string') {
        // Force slug to english-safe (in case Grok sent Persian)
        out.slug = /^[a-z0-9-]+$/i.test(obj.slug)
          ? obj.slug.toLowerCase()
          : slugify(obj.slug) || obj.slug
      }
      if (typeof obj.excerpt === 'string') out.excerpt = fixNewlines(obj.excerpt)
      if (typeof obj.content === 'string') out.content = fixNewlines(obj.content)
      if (typeof obj.seoTitle === 'string') out.seoTitle = obj.seoTitle
      if (typeof obj.seoDescription === 'string')
        out.seoDescription = fixNewlines(obj.seoDescription)
      if (Array.isArray(obj.seoKeywords))
        out.seoKeywords = obj.seoKeywords.filter((k): k is string => typeof k === 'string')
      if (typeof obj.featured === 'boolean') out.featured = obj.featured
      if (typeof obj.coverImage === 'string') out.coverImage = obj.coverImage
      if (typeof obj.canonicalUrl === 'string') out.canonicalUrl = obj.canonicalUrl
      if (typeof obj.ogImage === 'string') out.ogImage = obj.ogImage
      // imagePrompt from Grok — stored separately so we can render it + build
      // a Vigent-branded poster prompt from it.
      setParsed(out)
      setImagePrompt(typeof obj.imagePrompt === 'string' ? obj.imagePrompt : null)
    } catch (e) {
      setError('JSON معتبر نیست: ' + (e instanceof Error ? e.message : String(e)))
      setParsed(null)
    }
  }

  function handleConfirm() {
    if (!parsed) return
    onImport(parsed)
    // reset
    setRaw('')
    setParsed(null)
    setError(null)
    setImagePrompt(null)
    setPosterVariants(null)
    setCopiedKey(null)
    onClose()
  }

  function handleClose() {
    setRaw('')
    setParsed(null)
    setError(null)
    setImagePrompt(null)
    setPosterVariants(null)
    setCopiedKey(null)
    onClose()
  }

  /**
   * Build a single Vigent-branded poster prompt for a given accent color.
   * The prompt structure mirrors the golden `vignet-poster-prompt.md` spec:
   * 1536×1024, bilingual "ویجنت / VIGENT" wordmark, "vigent.ir" URL,
   * cinematic editorial style, monochrome base + exactly ONE accent color.
   */
  function buildPromptForColor(color: PosterColor, topic: string, summary: string): string {
    const colorName = color.labelEn.toLowerCase()
    const colorHex = color.hex
    return `A cinematic editorial blog cover poster for Vigent, exactly 1536x1024 pixels landscape (3:2 ratio).

TOPIC: ${topic}

CONTENT SUMMARY (inspire the visual): ${summary}

MANDATORY ELEMENTS:
1. Bilingual brand wordmark — "ویجنت" in elegant Persian modern sans-serif (large, hero element) + "VIGENT" in clean uppercase Latin beneath or beside it. Both clearly legible.
2. Website URL "vigent.ir" in refined monospace, placed in the bottom-right corner, small but readable.
3. A conceptual topic visual representing the blog subject above — the dominant visual element, not the text.
4. A subtle "مقاله" (article) tag in the top-left corner, minimal.

VISUAL STYLE:
- Cinematic editorial tech illustration meets modern Persian poster design.
- Premium, optimistic, trustworthy mood (NOT corporate-stiff, NOT cartoon).
- Rule-of-thirds composition, generous negative space, clear focal point.
- Soft cinematic lighting, subtle glow on the focal subject, gentle radial gradient background.
- Shallow depth-of-field on the topic subject, background softly blurred.
- Color palette: monochrome base (charcoal #0a0a0a → soft white #f5f5f5) with ONE ${colorName} accent (${colorHex}).
- Use ${colorName} for glows, lighting and the focal illustration.
- No other accent colors.
- Subtle film grain, light noise. NO harsh gradients, NO mesh gradients.
- Only text on poster: "ویجنت", "VIGENT", "vigent.ir", and the small "مقاله" tag. NO other text. NO long headlines.

TECHNICAL:
- Dimensions: EXACTLY 1536x1024 pixels, landscape 3:2.
- High detail, print-quality sharpness.
- --ar 3:2 --q 2 --v 6

NEGATIVE: clutter, cartoon, anime, photorealistic humans, busy background, neon overload, drop shadows on text, comic-sans, multiple focal points, text-heavy, low-contrast text, 3D plastic render, watermarks, signatures, any accent color other than ${colorName}.

The accent color is ${colorName} (${colorHex}). Build the poster now.`
  }

  /**
   * Build 3 poster prompts — one per accent color in POSTER_COLORS. The admin
   * picks whichever fits the post's mood and copies only that one.
   */
  function buildPosterPrompts() {
    if (!parsed) return
    const topic = parsed.title || 'موضوع پست وبلاگ ویجنت'
    const summary =
      (parsed.excerpt || '').slice(0, 180) ||
      (parsed.content || '').replace(/[#*>\-|`\[\]()!]/g, ' ').slice(0, 180)

    const variants: PosterVariant[] = POSTER_COLORS.map((color) => ({
      color,
      prompt: buildPromptForColor(color, topic, summary),
    }))
    setPosterVariants(variants)
    setCopiedKey(null)
  }

  function copyPosterPrompt(key: string, prompt: string) {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      setRaw(text)
    } catch {
      // clipboard read may be blocked; ignore silently
    }
  }

  function handleLoadExample() {
    const example = {
      title: 'راه‌اندازی چت‌بات تلگرام برای کسب‌وکار در ۱۰ دقیقه',
      slug: 'telegram-chatbot-business-10-minutes',
      excerpt:
        'آیا هنوز پاسخگویی به مشتریان در تلگرام زمان زیادی می‌گیرد؟ با چت‌بات هوشمند تلگرام پشتیبانی ۲۴ ساعته داشته باشید، فروش را افزایش دهید و هزینه‌ها را تا ۷۰ درصد کاهش دهید.',
      content:
        '# راه‌اندازی چت‌بات تلگرام برای کسب‌وکار در ۱۰ دقیقه\n\nتصور کنید مشتری در نیمه‌شب سؤالی بپرسد و بلافاصله پاسخ حرفه‌ای دریافت کند.\n\n## چت‌بات تلگرام چیست؟\n\nچت‌بات تلگرام یک برنامه هوشمند است.\n\n- پشتیبانی ۲۴ ساعته\n- کاهش هزینه‌ها\n\n## نحوه راه‌اندازی\n\n۱. ثبت‌نام در ویجنت\n۲. ایجاد ایجنت\n\n## جمع‌بندی\n\nهمین حالا شروع کنید.',
      seoTitle: 'ساخت چت‌بات تلگرام برای کسب‌وکار در ۱۰ دقیقه',
      seoDescription:
        'آموزش قدم‌به‌قدم ساخت چت‌بات تلگرام هوشمند با ویجنت. پشتیبانی ۲۴ ساعته، افزایش فروش، کاهش هزینه بدون کدنویسی.',
      seoKeywords: [
        'چت‌بات تلگرام',
        'ربات تلگرام فروش',
        'ساخت ربات تلگرام',
        'اتوماسیون تلگرام',
        'پشتیبانی مشتری تلگرام',
      ],
      featured: false,
      imagePrompt:
        'A modern Iranian business owner using holographic AI chatbot interface on phone, cinematic lighting, editorial tech illustration, centered composition, monochrome with teal accents, professional optimistic mood, ultra detailed, --ar 16:9 --q 2 --v 6',
    }
    setRaw(JSON.stringify(example, null, 2))
    setParsed(null)
    setError(null)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        dir="rtl"
        className="my-8 w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950"
        style={{ boxShadow: '0 28px 80px -18px rgba(0,0,0,.65)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-medium text-zinc-200">
              {t('jsonImportTitle') || 'افزودن پست از JSON'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5 space-y-4">
          {/* Intro */}
          <p className="text-xs leading-relaxed text-zinc-500">
            JSON خروجی Grok (یا هر ابزار AI) را اینجا بچسبانید. سیستم خودکار
            <strong className="text-zinc-300"> newline‌های واقعی</strong> را از
            <code className="mx-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-400">{'\\n'}</code>
            استخراج می‌کند و <strong className="text-zinc-300">slug</strong> را
            به انگلیسی امن تبدیل می‌کند. سپس با یک کلیک همه فیلدهای ادیتور پر می‌شوند.
          </p>

          {/* Input */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">JSON</label>
              <div className="flex gap-1.5">
                <button
                  onClick={handlePaste}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                >
                  <ClipboardPaste className="h-3 w-3" />
                  جای‌گذاری
                </button>
                <button
                  onClick={handleLoadExample}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                >
                  <Sparkles className="h-3 w-3" />
                  نمونه
                </button>
              </div>
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              dir="ltr"
              rows={8}
              placeholder={'{\n  "title": "...",\n  "slug": "english-slug",\n  "content": "# عنوان\\n\\nمتن...",\n  ...\n}'}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 font-mono text-xs text-zinc-300 outline-none focus:border-zinc-700"
              style={{ minHeight: 180 }}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {/* Parse button */}
          <button
            onClick={handleParse}
            disabled={!raw.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" />
            بررسی و تبدیل JSON
          </button>

          {/* Parsed preview + SEO checks */}
          {parsed && (
            <div className="space-y-4 border-t border-zinc-800 pt-4">
              {/* Score */}
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <span className="text-xs text-zinc-400">امتیاز سئو</span>
                <span
                  className={`text-lg font-bold ${
                    score >= 80
                      ? 'text-emerald-400'
                      : score >= 50
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {score}٪
                </span>
              </div>

              {/* Checks */}
              <div className="grid grid-cols-2 gap-1.5">
                {checks.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5 text-[11px]"
                  >
                    {c.status === 'pass' && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    )}
                    {c.status === 'warn' && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    )}
                    {c.status === 'fail' && (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    )}
                    <span className="flex-1 text-zinc-300">{c.label}</span>
                    {c.hint && <span className="text-zinc-500">{c.hint}</span>}
                  </div>
                ))}
              </div>

              {/* Field preview */}
              <div className="space-y-2">
                <FieldPreview label="عنوان" value={parsed.title || ''} />
                <FieldPreview label="نامک (slug)" value={parsed.slug || ''} mono />
                <FieldPreview
                  label="خلاصه"
                  value={parsed.excerpt || ''}
                  maxLength={160}
                />
                <FieldPreview
                  label="متا توضیحات"
                  value={parsed.seoDescription || ''}
                  maxLength={160}
                />
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
                  <div className="mb-1 text-[10px] font-medium uppercase text-zinc-500">
                    کلمات کلیدی ({parsed.seoKeywords?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(parsed.seoKeywords || []).map((k, i) => (
                      <span
                        key={i}
                        className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
                <FieldPreview
                  label="محتوا (پیش‌نمایش — ۲۰۰ کاراکتر اول)"
                  value={(parsed.content || '').slice(0, 200) + ((parsed.content || '').length > 200 ? '…' : '')}
                  mono
                />
              </div>

              {/* ── Poster prompt builder (3 color variants) ──────────── */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    ساخت پرامپت پوستر وبلاگ
                  </div>
                  <button
                    onClick={buildPosterPrompts}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-700"
                  >
                    <Wand2 className="h-3 w-3" />
                    ساخت ۳ پرامپت رنگی
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  ۳ پرامپت آماده برای Grok Image / Midjourney / DALL-E — هر کدام با یک رنگ accent ثابت.
                  شامل ابعاد ۱۵۳۶×۱۰۲۴، اسم دوزبانه «ویجنت / VIGENT»، آدرس vigent.ir.
                  رنگی که می‌خواهی را انتخاب کن و دکمه کپی آن را بزن.
                </p>

                {imagePrompt && (
                  <details className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                    <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
                      پرامپت عکس خروجی Grok (اصل) — {imagePrompt.length} کاراکتر
                    </summary>
                    <p dir="ltr" className="mt-2 whitespace-pre-wrap break-words font-mono text-[10px] text-zinc-500 ltr text-left">
                      {imagePrompt}
                    </p>
                  </details>
                )}

                {posterVariants && posterVariants.length > 0 && (
                  <div className="space-y-3">
                    {posterVariants.map((v) => {
                      const isCopied = copiedKey === v.color.key
                      return (
                        <div
                          key={v.color.key}
                          className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2.5 space-y-2"
                        >
                          {/* Color header + copy button */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {/* Color swatch */}
                              <span
                                className="inline-block h-4 w-4 shrink-0 rounded-full border border-zinc-700"
                                style={{ backgroundColor: v.color.hex }}
                                title={v.color.hex}
                              />
                              <span className="text-[11px] font-medium text-zinc-200">
                                {v.color.labelFa}
                              </span>
                              <span className="text-[10px] text-zinc-500" dir="ltr">
                                {v.color.hex}
                              </span>
                              <span className="text-[10px] text-zinc-600">·</span>
                              <span className="text-[10px] text-zinc-500">
                                {v.color.moodFa}
                              </span>
                            </div>
                            <button
                              onClick={() => copyPosterPrompt(v.color.key, v.prompt)}
                              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                isCopied
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-zinc-100 text-zinc-950 hover:bg-white'
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  کپی شد
                                </>
                              ) : (
                                '📋 کپی پرامپت'
                              )}
                            </button>
                          </div>
                          {/* Prompt text (collapsible) */}
                          <details>
                            <summary className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-300">
                              نمایش پرامپت — {v.prompt.length} کاراکتر
                            </summary>
                            <pre
                              dir="ltr"
                              className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed text-zinc-400 ltr text-left"
                            >
                              {v.prompt}
                            </pre>
                          </details>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 p-4">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            {t('close') || 'بستن'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!parsed}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            پر کردن فیلدها
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldPreview({
  label,
  value,
  mono,
  maxLength,
}: {
  label: string
  value: string
  mono?: boolean
  maxLength?: number
}) {
  const display = maxLength ? value.slice(0, maxLength) : value
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase text-zinc-500">
        <span>{label}</span>
        <span>{value.length} کاراکتر</span>
      </div>
      <p
        className={`text-xs text-zinc-300 ${mono ? 'font-mono ltr text-left' : ''}`}
        style={mono ? { direction: 'ltr', textAlign: 'left' } : undefined}
      >
        {display || <span className="text-zinc-600">—</span>}
      </p>
    </div>
  )
}
