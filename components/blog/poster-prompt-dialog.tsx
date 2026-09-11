'use client'

import { useMemo, useState } from 'react'
import { X, Sparkles, CheckCircle2, ImagePlus } from 'lucide-react'
import { POSTER_COLORS, buildPosterPrompt, posterSummaryFrom } from '@/lib/blog/poster-prompt'

/**
 * Poster-prompt helper for blog posts without a cover image.
 *
 * Mirrors the JSON import dialog's "3 color prompt" section: for each of the
 * three fixed accent palettes it auto-builds the full Vigent poster prompt
 * from the post's own title/summary and offers a one-click copy button. The
 * prompt text itself stays collapsed (it is long) so the dialog stays
 * minimal.
 */
export function PosterPromptDialog({
  open,
  onClose,
  post,
}: {
  open: boolean
  onClose: () => void
  post: { title: string; slug: string; excerpt: string | null; content: string } | null
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const variants = useMemo(() => {
    if (!post) return []
    const topic = post.title || 'موضوع پست وبلاگ ویجنت'
    const summary = posterSummaryFrom(post.excerpt, post.content)
    return POSTER_COLORS.map((color) => ({
      color,
      prompt: buildPosterPrompt(color, topic, summary),
    }))
  }, [post])

  if (!open || !post) return null

  function copyPrompt(key: string, prompt: string) {
    const done = () => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(prompt).then(done).catch(() => fallbackCopy(prompt, done))
    } else {
      fallbackCopy(prompt, done)
    }
  }

  function fallbackCopy(text: string, done: () => void) {
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
      done()
    } catch {
      // clipboard unavailable — keep the button in its default state
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        dir="rtl"
        className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <ImagePlus className="h-4 w-4 shrink-0 text-emerald-600" />
            <h2 className="truncate text-sm font-semibold text-zinc-900">
              پرامپت پوستر برای «{post.title || post.slug}»
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-10rem)] space-y-3 overflow-y-auto p-5">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            این پست بدون عکس جلد ذخیره شده است. ۳ پرامپت آماده برای Grok
            Image / Midjourney / DALL-E از عنوان و خلاصه همین پست ساخته شده
            — هر کدام با یک رنگ accent ثابت، شامل ابعاد ۱۵۳۶×۱۰۲۴، اسم
            دوزبانه «ویجنت / VIGENT» و آدرس vigent.ir. رنگ دلخواه را انتخاب
            و دکمه کپی آن را بزن؛ بعد از تولید عکس، در ویرایشگر پست قرارش بده.
          </p>

          <div className="space-y-3">
            {variants.map((v) => {
              const isCopied = copiedKey === v.color.key
              return (
                <div
                  key={v.color.key}
                  className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5"
                >
                  {/* Color header + copy button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border border-zinc-300"
                        style={{ backgroundColor: v.color.hex }}
                        title={v.color.hex}
                      />
                      <span className="shrink-0 text-[11px] font-medium text-zinc-800">
                        {v.color.labelFa}
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-400" dir="ltr">
                        {v.color.hex}
                      </span>
                      <span className="hidden text-[10px] text-zinc-300 sm:inline">·</span>
                      <span className="hidden truncate text-[10px] text-zinc-400 sm:inline">
                        {v.color.moodFa}
                      </span>
                    </div>
                    <button
                      onClick={() => copyPrompt(v.color.key, v.prompt)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
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
                  {/* Prompt text (collapsible — it is long) */}
                  <details>
                    <summary className="cursor-pointer text-[10px] text-zinc-400 hover:text-zinc-600">
                      نمایش پرامپت — {v.prompt.length} کاراکتر
                    </summary>
                    <pre
                      dir="ltr"
                      className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-white p-2 font-mono text-[10px] leading-relaxed text-zinc-600 text-left"
                    >
                      {v.prompt}
                    </pre>
                  </details>
                </div>
              )
            })}
          </div>

          <p className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <Sparkles className="h-3 w-3 shrink-0" />
            پرامپت‌ها به‌صورت خودکار از محتوای همین پست ساخته می‌شوند.
          </p>
        </div>
      </div>
    </div>
  )
}
