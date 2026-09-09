'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type Activity = {
  id: string
  agentId: string
  agentName: string
  status: string
  error: string | null
  total: number
  processed: number
  percent: number
  requestCount: number
  chargedIRR: number
  finishedAt: string | null
}

export const IMPROVEMENT_ACTIVITY_EVENT = 'vigent:improvement-activity'

export function ImprovementActivityIndicator() {
  const fa = useLocale() !== 'en'
  const reduced = useReducedMotion()
  const [activity, setActivity] = useState<Activity | null>(null)
  const activityRef = useRef<Activity | null>(null)
  activityRef.current = activity
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')

  const load = useCallback(async () => {
    const response = await fetch('/api/improvement/activity', { cache: 'no-store' })
    if (!response.ok) return
    const body = await response.json() as { activity?: Activity | null }
    setActivity(body.activity ?? null)
  }, [])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      await load().catch(() => {})
      if (!stopped) timer = setTimeout(poll, activityRef.current && !activityRef.current.finishedAt ? 2500 : 10_000)
    }
    void poll()
    const refresh = () => void load().catch(() => {})
    window.addEventListener(IMPROVEMENT_ACTIVITY_EVENT, refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      window.removeEventListener(IMPROVEMENT_ACTIVITY_EVENT, refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  const done = Boolean(activity?.finishedAt)
  const title = done
    ? fa ? 'تحلیل گفتگوها تکمیل شد' : 'Conversation analysis completed'
    : activity?.status === 'QUEUED'
      ? fa ? 'تحلیل در صف شروع است' : 'Analysis is queued'
      : fa ? 'هوش مصنوعی در حال تحلیل گفتگوهاست' : 'AI is analyzing conversations'
  const progressLabel = done
    ? fa
      ? `${nf.format(activity?.total ?? 0)} گفتگو بررسی شد`
      : `${nf.format(activity?.total ?? 0)} conversations analyzed`
    : fa
      ? `${nf.format(activity?.processed ?? 0)} از ${nf.format(activity?.total ?? 0)} گفتگو بررسی شده`
      : `${nf.format(activity?.processed ?? 0)} of ${nf.format(activity?.total ?? 0)} conversations analyzed`
  const href = activity ? `/agents/${activity.agentId}/improve?tab=learning` : '#'

  return (
    <AnimatePresence initial={false}>
      {activity && (
        <motion.div
          key={activity.id}
          initial={reduced ? false : { opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
          transition={{ duration: reduced ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-2 max-w-[112rem] overflow-hidden"
        >
          <Link
            href={href}
            aria-label={`${title}، ${nf.format(activity.percent)}%`}
            className="group block rounded-[1.2rem] border border-black/[0.08] bg-black text-white shadow-[0_12px_34px_rgba(0,0,0,0.13)] outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            <div className="flex min-h-12 items-center gap-3 px-3 lg:hidden">
              <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/12">
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {!done && <span className="absolute inset-0 rounded-full ring-1 ring-white/20" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold">{title}</span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/15">
                  <motion.span className="block h-full rounded-full bg-white" animate={{ width: `${activity.percent}%` }} transition={{ duration: reduced ? 0.01 : 0.45 }} />
                </span>
              </span>
              <span className="shrink-0 text-sm font-black tabular-nums">{nf.format(activity.percent)}{fa ? '٪' : '%'}</span>
            </div>

            <div className="hidden min-h-14 grid-cols-[minmax(12rem,1fr)_minmax(18rem,1.2fr)_auto] items-center gap-5 px-4 lg:grid xl:px-5">
              <span className="flex min-w-0 items-center gap-3">
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', done ? 'bg-emerald-400 text-black' : 'bg-white/12')}>
                  {done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="min-w-0 truncate text-xs font-bold">{title}</span>
              </span>

              <span className="min-w-0">
                <span className="mb-1.5 block truncate text-[10px] font-semibold text-white/60">{progressLabel}</span>
                <span
                  role="progressbar"
                  aria-label={fa ? 'پیشرفت تحلیل گفتگوها' : 'Conversation analysis progress'}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={activity.percent}
                  className="relative block h-1.5 overflow-hidden rounded-full bg-white/15"
                >
                  <motion.span className={cn('absolute inset-y-0 start-0 rounded-full', done ? 'bg-emerald-300' : 'bg-white')} animate={{ width: `${activity.percent}%` }} transition={{ duration: reduced ? 0.01 : 0.45 }} />
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-4">
                <span className="hidden text-end lg:block"><span className="block text-[10px] text-white/50">{fa ? 'مصرف ثبت‌شده' : 'Recorded usage'}</span><span className="mt-0.5 block text-[11px] font-bold">{nf.format(activity.chargedIRR / 10)} {fa ? 'تومان' : 'toman'}</span></span>
                <span className="text-xl font-black tabular-nums">{nf.format(activity.percent)}{fa ? '٪' : '%'}</span>
              </span>
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
