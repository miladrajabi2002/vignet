'use client'

import { useRef, useState } from 'react'
import { Play } from 'lucide-react'

export function OnboardingIntroVideo({ fa, onContinue }: { fa: boolean; onContinue: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [failed, setFailed] = useState(false)
  const title = fa ? 'با ویجنت آشنا شوید' : 'Meet Vigent'

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:px-8">
        <h1 data-step-focus tabIndex={-1} className="mb-4 text-center text-2xl font-bold tracking-tight text-[var(--text-primary)] outline-none sm:text-3xl">
          {title}
        </h1>
        <div className="relative mx-auto aspect-video w-full max-w-[46rem] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[#f5eee3]">
          <video
            ref={video}
            src="/media/onboarding/vigent-intro-fa.mp4"
            poster="/media/onboarding/vigent-intro-fa.jpg"
            className="h-full w-full object-contain"
            controls
            playsInline
            preload="metadata"
            lang="fa"
            aria-label={fa ? 'ویدیوی معرفی ویجنت' : 'Vigent introduction video in Persian'}
            onPlay={() => setStarted(true)}
            onEnded={() => setFinished(true)}
            onError={() => setFailed(true)}
          />
          {!started && !failed && (
            <button
              type="button"
              className="absolute start-1/2 top-1/2 grid size-14 -translate-y-1/2 place-items-center rounded-full bg-[#271f17] text-white shadow-md hover:bg-[#46372a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)] ltr:-translate-x-1/2 rtl:translate-x-1/2"
              aria-label={fa ? 'پخش ویدیو' : 'Play video'}
              onClick={() => void video.current?.play().catch(() => setStarted(true))}
            >
              <Play aria-hidden className="size-5 fill-current" />
            </button>
          )}
          {failed && (
            <p role="status" className="absolute inset-0 grid place-content-center bg-[#f5eee3] px-5 text-center text-sm text-[var(--text-secondary)]">
              {fa ? 'ویدیو بارگیری نشد. می‌توانید راه‌اندازی را ادامه دهید.' : 'The video could not load. You can continue setup.'}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 justify-center border-t border-[var(--border-default)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:py-4">
        <button
          type="button"
          onClick={() => {
            video.current?.pause()
            onContinue()
          }}
          className={finished || failed
            ? 'min-h-11 w-full max-w-64 rounded-full bg-[#271f17] px-5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'
            : 'min-h-11 w-full max-w-64 rounded-full bg-[var(--bg-muted)] px-5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'}
        >
          {finished || failed ? (fa ? 'ادامه' : 'Continue') : (fa ? 'رد کردن ویدیو' : 'Skip video')}
        </button>
      </div>
    </section>
  )
}
