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
 * JSON Import Dialog (LIGHT theme — admin panel)
 *
 * A modal that lets the admin paste a JSON object (the kind Grok produces)
 * and auto-fills the blog editor fields from it.
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

  if (post.title && post.title.length >= 30 && post.title.length <= 60) {
    checks.push({ label: 'عنوان ۳۰ تا ۶۰ کاراکتر', status: 'pass' })
  } else if (post.title && post.title.length > 0) {
    checks.push({
      label: 'عنوان ۳۰ تا ۶۰ کاراکتر',
      status: 'warn',
      hint: `${post.title.length} کاراکتر`,
    })
  } else {
    checks.push({ label: 'عنوان ۳۰ تا ۶۰ کاراکتر', status: 'fail' })
  }

  if (wordCount >= 300) {
    checks.push({ label: `محتوا ${wordCount} کلمه`, status: 'pass' })
  } else if (wordCount >= 100) {
    checks.push({ label: `محتوا ${wordCount} کلمه`, status: 'warn', hint: 'حداقل ۳۰۰ توصیه می‌شود' })
  } else {
    checks.push({ label: `محتوا ${wordCount} کلمه`, status: 'fail' })
  }

  if (post.excerpt && post.excerpt.length >= 50) {
    checks.push({ label: 'خلاصه حداقل ۵۰ کاراکتر', status: 'pass' })
  } else {
    checks.push({ label: 'خلاصه حداقل ۵۰ کاراکتر', status: 'fail' })
  }

  if (post.seoDescription && post.seoDescription.length >= 120 && post.seoDescription.length <= 160) {
    checks.push({ label: 'متا توضیحات ۱۲۰-۱۶۰', status: 'pass' })
  } else if (post.seoDescription && post.seoDescription.length > 0) {
    checks.push({ label: 'متا توضیحات ۱۲۰-۱۶۰', status: 'warn', hint: `${post.seoDescription.length}` })
  } else {
    checks.push({ label: 'متا توضیحات ۱۲۰-۱۶۰', status: 'fail' })
  }

  if ((post.seoKeywords?.length ?? 0) >= 3) {
    checks.push({ label: `${post.seoKeywords?.length} کلمه کلیدی`, status: 'pass' })
  } else if ((post.seoKeywords?.length ?? 0) > 0) {
    checks.push({ label: `${post.seoKeywords?.length} کلمه کلیدی`, status: 'warn' })
  } else {
    checks.push({ label: 'کلمات کلیدی', status: 'fail' })
  }

  if (post.slug && /^[a-z0-9-]+$/i.test(post.slug)) {
    checks.push({ label: 'slug انگلیسی امن', status: 'pass' })
  } else {
    checks.push({ label: 'slug انگلیسی امن', status: 'fail' })
  }

  return checks
}

function fixNewlines(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\r/g, '')
}

/** Parse JSON with leniency: strip ```json fences, fix trailing commas, smart quotes. */
function lenientParse(raw: string): unknown {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fence) s = fence[1].trim()
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
  onImport: (data: Partial<BlogPostData>) => void
}

// ── Poster color variants (3 fixed palettes) ────────────────────────
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
  const [imagePrompt, setImagePrompt] = useState<string | null>(null)
  const [posterVariants, setPosterVariants] = useState<PosterVariant[] | null>(null)
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
      const out: Partial<BlogPostData> = { ...EMPTY_POST }
      if (typeof obj.title === 'string') out.title = obj.title
      if (typeof obj.slug === 'string') {
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

  function buildPromptForColor(color: PosterColor, topic: string, summary: string): string {
    const colorName = color.labelEn.toLowerCase()
    const colorHex = color.hex
    return `You are a professional editorial poster designer for "Vigent" — an Iranian AI agent SaaS platform.

TASK: Design a blog cover poster at exactly 1536×1024 pixels (landscape, 3:2 ratio).

═══════════════════════════════════════════
MANDATORY ELEMENTS (every poster must have)
═══════════════════════════════════════════

1. Bilingual brand wordmark "ویجنت" (Persian, large, RTL) + "VIGENT" (English, smaller, below or beside the Persian) — both clearly visible and legible. Use a modern, clean sans-serif font. The Persian wordmark is the hero element.

2. Website URL "vigent.ir" — small, elegant, placed at the bottom corner (bottom-right or bottom-left). Use a monospace or refined sans-serif. Subtle but readable.

3. Topic visual — a conceptual illustration representing the blog post topic (see TOPIC below). Should be the dominant visual element, not the text.

4. Subtle blog-post hint — a small icon, badge, or tag that signals "this is a blog article" (e.g., a stylized article icon, a "خواندن" reading tag, or an abstract page-corner motif). Keep it minimal.

═══════════════════════════════════════════
TOPIC: ${topic}
═══════════════════════════════════════════

CONTENT SUMMARY (use this to inspire the visual):
${summary}

═══════════════════════════════════════════
VISUAL STYLE
═══════════════════════════════════════════

• Style: cinematic editorial tech illustration meets modern Persian poster design. Think Stripe blog covers × Iranian minimalism × Apple keynote aesthetics.
• Mood: professional, optimistic, premium, trustworthy — NOT corporate-stiff, NOT playful-cartoon.
• Composition: rule of thirds, generous negative space, clear focal point, the wordmark sits confidently but doesn't compete with the topic visual.
• Lighting: soft cinematic lighting, subtle glow on the focal subject, gentle gradient background (not flat, not busy).
• Depth: shallow depth-of-field on the topic subject, background softly blurred.
• Color palette: monochrome base (charcoal #0a0a0a → soft white #f5f5f5) with ONE ${colorName} accent (${colorHex}).
  - Use ${colorName} for glows, lighting and the focal illustration.
  - No other accent colors.
• Texture: subtle film grain, very light noise, NO harsh gradients, NO mesh gradients.
• Typography on poster: only the bilingual wordmark + URL + optionally a 3-5 word Persian headline (optional, only if it fits naturally). Do NOT clutter with long text.

═══════════════════════════════════════════
TECHNICAL SPECS
═══════════════════════════════════════════

• Dimensions: EXACTLY 1536 × 1024 pixels (landscape 3:2)
• Resolution: high detail, print-quality sharpness
• Aspect ratio flag: --ar 3:2 (or 1536:1024 if the tool supports custom)
• Quality flag: --q 2 --v 6 (Midjourney v6) or equivalent high-quality
• NO watermark, NO signature, NO stock-photo watermarks
• NO English text other than "VIGENT" wordmark and "vigent.ir" URL
• NO Persian text other than "ویجنت" wordmark and (optional) short headline

═══════════════════════════════════════════
NEGATIVE PROMPT (things to avoid)
═══════════════════════════════════════════

Avoid: cluttered composition, cheap stock-photo look, cartoon style, anime style, photorealistic humans (use abstract/silhouette instead), busy backgrounds, harsh colors, neon overload, drop shadows on text, comic-sans or decorative fonts, multiple competing focal points, text-heavy posters, low-contrast text on busy backgrounds, 3D render plastic look, any accent color other than ${colorName}.

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════

Produce ONE final image at 1536×1024. Then provide:
1. A short description (2-3 sentences) of what you depicted and why it fits the topic.
2. The exact Midjourney/DALL-E prompt you used (for reproducibility).

═══════════════════════════════════════════
EXAMPLE OUTPUT PROMPT (for reference)
═══════════════════════════════════════════

"A cinematic editorial blog cover for Vigent, 1536x1024 landscape. Centered composition: a stylized glowing Telegram paper-plane icon emerging from a sleek smartphone, surrounded by subtle floating chat bubbles with Persian script fragments. Above, the bilingual wordmark 'ویجنت' in elegant Persian Nastaliq-modern sans-serif, with 'VIGENT' in clean uppercase Latin beneath. Bottom-right corner: 'vigent.ir' in refined monospace. Background: deep charcoal #0a0a0a with a soft ${colorName} ${colorHex} accent glow behind the focal subject, gentle radial gradient, subtle film grain. Shallow depth of field, soft cinematic lighting, premium tech-editorial aesthetic. A small 'مقاله' (article) tag in the top-left corner. Negative: clutter, cartoon, photorealistic humans, busy background, neon. --ar 3:2 --q 2 --v 6"

═══════════════════════════════════════════
NOW: design the poster for the topic above with the ${colorName} (${colorHex}) accent color. Output the image + description + the prompt you used.`
  }

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
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        dir="rtl"
        className="my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-zinc-900">
              {t('jsonImportTitle') || 'افزودن پست از JSON'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5 space-y-4">
          {/* Intro */}
          <p className="text-xs leading-relaxed text-zinc-500">
            JSON خروجی Grok (یا هر ابزار AI) را اینجا بچسبانید. سیستم خودکار
            <strong className="text-zinc-700"> newline‌های واقعی</strong> را از
            <code className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">{'\\n'}</code>
            استخراج می‌کند و <strong className="text-zinc-700">slug</strong> را
            به انگلیسی امن تبدیل می‌کند. سپس با یک کلیک همه فیلدهای ادیتور پر می‌شوند.
          </p>

          {/* Input */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-600">JSON</label>
              <div className="flex gap-1.5">
                <button
                  onClick={handlePaste}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  <ClipboardPaste className="h-3 w-3" />
                  جای‌گذاری
                </button>
                <button
                  onClick={handleLoadExample}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-50"
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
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 font-mono text-xs text-zinc-800 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
              style={{ minHeight: 180 }}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {/* Parse button */}
          <button
            onClick={handleParse}
            disabled={!raw.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" />
            بررسی و تبدیل JSON
          </button>

          {/* Parsed preview + SEO checks */}
          {parsed && (
            <div className="space-y-4 border-t border-zinc-200 pt-4">
              {/* Score */}
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <span className="text-xs text-zinc-600">امتیاز سئو</span>
                <span
                  className={`text-lg font-bold ${
                    score >= 80
                      ? 'text-emerald-600'
                      : score >= 50
                        ? 'text-amber-500'
                        : 'text-red-500'
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
                    className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px]"
                  >
                    {c.status === 'pass' && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    )}
                    {c.status === 'warn' && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    )}
                    {c.status === 'fail' && (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    )}
                    <span className="flex-1 text-zinc-700">{c.label}</span>
                    {c.hint && <span className="text-zinc-400">{c.hint}</span>}
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
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="mb-1 text-[10px] font-medium uppercase text-zinc-500">
                    کلمات کلیدی ({parsed.seoKeywords?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(parsed.seoKeywords || []).map((k, i) => (
                      <span
                        key={i}
                        className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-600"
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
              <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-800">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    ساخت پرامپت پوستر وبلاگ
                  </div>
                  <button
                    onClick={buildPosterPrompts}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100"
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
                  <details className="rounded-md border border-zinc-200 bg-white p-2">
                    <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-700">
                      پرامپت عکس خروجی Grok (اصل) — {imagePrompt.length} کاراکتر
                    </summary>
                    <p dir="ltr" className="mt-2 whitespace-pre-wrap break-words font-mono text-[10px] text-zinc-500 text-left">
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
                          className="space-y-2 rounded-md border border-zinc-200 bg-white p-2.5"
                        >
                          {/* Color header + copy button */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-4 w-4 shrink-0 rounded-full border border-zinc-300"
                                style={{ backgroundColor: v.color.hex }}
                                title={v.color.hex}
                              />
                              <span className="text-[11px] font-medium text-zinc-800">
                                {v.color.labelFa}
                              </span>
                              <span className="text-[10px] text-zinc-400" dir="ltr">
                                {v.color.hex}
                              </span>
                              <span className="text-[10px] text-zinc-300">·</span>
                              <span className="text-[10px] text-zinc-400">
                                {v.color.moodFa}
                              </span>
                            </div>
                            <button
                              onClick={() => copyPosterPrompt(v.color.key, v.prompt)}
                              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                isCopied
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
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
                            <summary className="cursor-pointer text-[10px] text-zinc-400 hover:text-zinc-600">
                              نمایش پرامپت — {v.prompt.length} کاراکتر
                            </summary>
                            <pre
                              dir="ltr"
                              className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] leading-relaxed text-zinc-600 text-left"
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
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3.5">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-800"
          >
            {t('close') || 'بستن'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!parsed}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
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
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase text-zinc-500">
        <span>{label}</span>
        <span>{value.length} کاراکتر</span>
      </div>
      <p
        className={`text-xs text-zinc-700 ${mono ? 'font-mono text-left' : ''}`}
        style={mono ? { direction: 'ltr', textAlign: 'left' } : undefined}
      >
        {display || <span className="text-zinc-400">—</span>}
      </p>
    </div>
  )
}
