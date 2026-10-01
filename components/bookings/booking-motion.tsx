'use client'

import { useEffect, useRef, useState } from 'react'
import { BellRing, Bot, CalendarCheck2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type SlotKind = 'free' | 'busy' | 'target'

const SLOTS: Array<{ time: string; kind: SlotKind }> = [
  { time: '09:00', kind: 'busy' },
  { time: '09:30', kind: 'free' },
  { time: '10:00', kind: 'target' },
  { time: '10:30', kind: 'busy' },
  { time: '11:00', kind: 'free' },
  { time: '11:30', kind: 'free' },
  { time: '12:00', kind: 'busy' },
  { time: '12:30', kind: 'free' },
]

/**
 * Motion graphic of the real booking loop: a customer asks for a time, the
 * agent reads live capacity, books the free slot and the manager is alerted.
 * Pure CSS (see `.bk-*` in globals.css); pauses off screen and renders the
 * final, complete frame for reduced-motion users.
 */
export function BookingMotion({ fa, compact = false, className }: { fa: boolean; compact?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [play, setPlay] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) {
      setPlay(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setPlay(entry.isIntersecting), { rootMargin: '80px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  let freeIndex = 0
  return (
    <div
      ref={ref}
      data-play={play ? 'true' : 'false'}
      aria-hidden
      className={cn(
        'bk-scene relative grid gap-3 overflow-hidden rounded-card border border-[var(--border-subtle)] bg-[linear-gradient(180deg,#fafaf9,#f3f3f1)] p-3 sm:p-4',
        compact ? 'grid-cols-1' : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]',
        className,
      )}
    >
      {/* Conversation */}
      <div className="min-w-0 rounded-2xl bg-white/70 p-3 ring-1 ring-black/[0.04]">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--text-primary)] text-white">
            <Bot className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12px] font-bold text-[var(--text-primary)]">{fa ? 'ایجنت رزرو' : 'Booking agent'}</span>
          <span className="ui-chip ui-chip-ok ms-auto !min-h-5 !text-[12px]"><span className="ui-chip-dot" />{fa ? 'آنلاین' : 'Online'}</span>
        </div>
        <div className="grid gap-2">
          <p className="bk-bubble bk-in bk-b1">{fa ? 'سلام، فردا ساعت ۱۰ وقت خالی دارید؟' : 'Hi, any time free tomorrow at 10?'}</p>
          <div className="grid [&>*]:[grid-area:1/1]">
            <span className="bk-think">
              <i /><i /><i />
              {fa ? 'بررسی ظرفیت واقعی…' : 'Checking live capacity…'}
            </span>
            <p className="bk-bubble bk-out bk-b3">{fa ? 'بله، ۱۰:۰۰ آزاد است. به نام شما ثبت کنم؟' : 'Yes, 10:00 is free. Book it for you?'}</p>
          </div>
          <p className="bk-bubble bk-in bk-b4">{fa ? 'بله، لطفاً 🙏' : 'Yes please 🙏'}</p>
          <p className="bk-bubble bk-out bk-b5 inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0" />
            {fa ? 'ثبت شد: چهارشنبه ۸ مهر، ساعت ۱۰:۰۰' : 'Booked: Wed 30 Sep, 10:00'}
          </p>
        </div>
      </div>

      {/* Calendar being read */}
      <div className={cn('min-w-0 rounded-2xl bg-white/70 p-3 ring-1 ring-black/[0.04]', compact && 'hidden')}>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
            <CalendarCheck2 className="h-3.5 w-3.5" />
            {fa ? 'چهارشنبه ۸ مهر' : 'Wed 30 Sep'}
          </span>
          <span className="text-[12px] text-[var(--text-muted)]">{fa ? 'مشاوره · ۳۰ دقیقه' : 'Consult · 30 min'}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5" dir="ltr">
          {SLOTS.map((slot) => {
            const delay = slot.kind === 'free' ? `${1.2 + (freeIndex++) * 0.42}s` : undefined
            return (
              <span
                key={slot.time}
                style={delay ? { animationDelay: delay } : undefined}
                className={cn(
                  'bk-slot relative',
                  slot.kind === 'busy' && 'bk-slot-busy',
                  slot.kind === 'free' && 'bk-slot-free',
                  slot.kind === 'target' && 'bk-slot-target',
                )}
              >
                {slot.time}
                {slot.kind === 'target' ? (
                  <span className="bk-check absolute -end-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--ok)] text-white ring-2 ring-white">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-[var(--border-strong)] bg-white" />{fa ? 'آزاد' : 'Free'}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-black/15" />{fa ? 'پر' : 'Full'}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--text-primary)]" />{fa ? 'رزرو ایجنت' : 'Agent booking'}</span>
        </div>

        {/* Manager alert */}
        <div className="bk-toast mt-3 flex items-center gap-2.5 rounded-xl bg-[var(--text-primary)] px-3 py-2 text-white">
          <BellRing className="h-4 w-4 shrink-0" />
          <div className="min-w-0 leading-5">
            <p className="truncate text-[12px] font-bold">{fa ? 'رزرو جدید برای مشاوره' : 'New booking: Consult'}</p>
            <p className="truncate text-[12px] text-white/70">{fa ? 'مریم رضایی · ۱۰:۰۰ · از اینستاگرام' : 'Maryam R. · 10:00 · via Instagram'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
