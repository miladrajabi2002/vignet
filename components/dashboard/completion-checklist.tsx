'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Circle,
  Database,
  Headphones,
  LoaderCircle,
  MessageCircleMore,
  Share2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DashboardChecklistFacts {
  agentId: string | null
  hasConfiguredAgent: boolean
  hasKnowledge: boolean
  hasActiveChannel: boolean
  hasConversation: boolean
  hasOperator: boolean
  knowledgePostponed: boolean
  channelPostponed: boolean
}

interface ChecklistItem {
  key: string
  title: string
  description: string
  cta: string
  href: string
  done: boolean
  optional?: boolean
  icon: LucideIcon
}

export function DashboardCompletionChecklist({
  locale,
  facts,
}: {
  locale: 'fa' | 'en'
  facts: DashboardChecklistFacts
}) {
  const router = useRouter()
  const [visible, setVisible] = useState(true)
  const [dismissing, setDismissing] = useState(false)
  const [error, setError] = useState(false)
  const fa = locale === 'fa'
  const Arrow = fa ? ArrowLeft : ArrowRight
  const agentBase = facts.agentId ? `/agents/${facts.agentId}` : '/agents/new'
  const items: ChecklistItem[] = [
    {
      key: 'agent',
      title: fa ? 'هویت و رفتار ایجنت' : 'Agent identity and behavior',
      description: fa ? 'نام، لحن و قواعد پاسخ‌گویی را بازبینی کنید.' : 'Review the name, tone and response rules.',
      cta: fa ? 'تنظیم ایجنت' : 'Configure agent',
      href: facts.agentId ? `${agentBase}/settings` : agentBase,
      done: facts.hasConfiguredAgent,
      icon: Bot,
    },
    {
      key: 'knowledge',
      title: fa ? 'دانش و جزئیات کسب‌وکار' : 'Business knowledge and details',
      description: fa
        ? (facts.knowledgePostponed ? 'این مرحله را در آنبوردینگ رد کردید؛ حالا اطلاعات، خدمات یا محصولات واقعی را اضافه کنید.' : 'اطلاعات، خدمات یا محصولات واقعی را در اختیار ایجنت بگذارید.')
        : (facts.knowledgePostponed ? 'You postponed this during onboarding; add real information, services or products now.' : 'Add real business information, services or products.'),
      cta: fa ? 'تکمیل دانش' : 'Complete knowledge',
      href: facts.agentId ? `${agentBase}/knowledge` : agentBase,
      done: facts.hasKnowledge,
      icon: Database,
    },
    {
      key: 'channel',
      title: fa ? 'اتصال یک برنامه ارتباطی' : 'Connect a customer app',
      description: fa
        ? (facts.channelPostponed ? 'این مرحله را در آنبوردینگ رد کردید؛ هر زمان آماده بودید یک برنامه را متصل کنید.' : 'یک برنامه را فعال کنید تا پیام واقعی مشتری دریافت شود.')
        : (facts.channelPostponed ? 'You postponed this during onboarding; connect an app whenever you are ready.' : 'Activate an app to receive real customer messages.'),
      cta: fa ? 'مدیریت اتصال‌ها' : 'Manage connections',
      href: facts.agentId ? `${agentBase}/channels` : agentBase,
      done: facts.hasActiveChannel,
      icon: Share2,
    },
    {
      key: 'test',
      title: fa ? 'آزمایش تجربه واقعی' : 'Test the real experience',
      description: fa ? 'یک گفتگوی کامل را بررسی کنید و کیفیت پاسخ را بسنجید.' : 'Review a full conversation and verify response quality.',
      cta: fa ? 'آزمایش پاسخ' : 'Test responses',
      href: facts.agentId ? agentBase : '/agents',
      done: facts.hasConversation,
      icon: MessageCircleMore,
    },
    {
      key: 'operator',
      title: fa ? 'تحویل امن به اپراتور' : 'Safe operator handoff',
      description: fa ? 'تلگرام اپراتور را برای موارد حساس و فوری متصل کنید.' : 'Connect operator Telegram for sensitive and urgent cases.',
      cta: fa ? 'اتصال اپراتور' : 'Connect operator',
      href: '/settings#telegram-operator',
      done: facts.hasOperator,
      optional: true,
      icon: Headphones,
    },
  ]
  const requiredItems = items.filter((item) => !item.optional)
  const completedCount = requiredItems.filter((item) => item.done).length
  const progress = Math.round((completedCount / requiredItems.length) * 100)
  const requiredComplete = completedCount === requiredItems.length
  const remainingCount = requiredItems.length - completedCount
  const orderedItems = [
    ...items.filter((item) => !item.done),
    ...items.filter((item) => item.done),
  ]

  async function dismiss() {
    if (dismissing) return
    setDismissing(true)
    setError(false)

    try {
      const response = await fetch('/api/dashboard/checklist', { method: 'DELETE' })
      if (!response.ok) throw new Error('dismiss failed')
      setVisible(false)
      router.refresh()
    } catch {
      setError(true)
      setDismissing(false)
    }
  }

  if (!visible) return null

  return (
    <section
      aria-labelledby="dashboard-checklist-title"
      className="dashboard-arrival spatial-surface relative isolate overflow-hidden rounded-[1.75rem]"
    >
      <div aria-hidden className="pointer-events-none absolute -start-24 -top-28 h-64 w-64 rounded-full bg-[var(--accent-soft)] opacity-70 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -end-20 top-0 h-48 w-48 rounded-full bg-emerald-100/60 blur-3xl" />

      <div className="relative border-b border-[var(--border-subtle)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 text-[10px] font-bold text-[var(--accent-strong)]">
                {fa ? 'مسیر پیشنهادی شروع' : 'Recommended launch path'}
              </span>
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                {fa
                  ? `${remainingCount.toLocaleString('fa-IR')} کار اصلی باقی مانده`
                  : `${remainingCount} essential ${remainingCount === 1 ? 'task' : 'tasks'} remaining`}
              </span>
            </div>
            <h2 id="dashboard-checklist-title" className="mt-3 text-xl font-bold tracking-[-0.02em] text-[var(--text-primary)] rtl:tracking-normal sm:text-2xl">
              {requiredComplete
                ? (fa ? 'پایه‌های ایجنت آماده‌اند؛ حالا کیفیت را بهتر کنید' : 'Your agent is ready; now refine the quality')
                : (fa ? 'ایجنت را برای کار واقعی آماده کنید' : 'Get your agent ready for real work')}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              {fa
                ? 'کارهایی که در آنبوردینگ انجام دادید تکمیل شده‌اند؛ موارد باقی‌مانده در ابتدای این مسیر قرار گرفته‌اند.'
                : 'Tasks completed during onboarding are marked done; the remaining work appears first.'}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="min-w-40 flex-1 rounded-2xl border border-[var(--border-default)] bg-white/80 p-3 shadow-[var(--shadow-sm)] sm:flex-none"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={fa ? 'پیشرفت آماده‌سازی' : 'Setup progress'}
            >
              <div className="flex items-center justify-between gap-4 text-[11px]">
                <span className="font-medium text-[var(--text-secondary)]">
                  {fa ? `${completedCount.toLocaleString('fa-IR')} از ${requiredItems.length.toLocaleString('fa-IR')} انجام شد` : `${completedCount} of ${requiredItems.length} complete`}
                </span>
                <span className="font-bold tabular-nums text-[var(--text-primary)]">{progress.toLocaleString(fa ? 'fa-IR' : 'en-US')}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--text-primary)] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={dismiss}
              disabled={dismissing}
              className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white/80 px-3 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-60"
              aria-label={fa ? 'حذف چک‌لیست و دیگر نشان ندادن آن' : 'Remove checklist and do not show it again'}
            >
              {dismissing ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <X className="h-4 w-4" />}
              <span className="hidden sm:inline">{fa ? 'دیگر نشان نده' : 'Do not show again'}</span>
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs font-medium text-red-600 lg:absolute lg:bottom-2 lg:end-6">
              {fa ? 'حذف انجام نشد؛ دوباره تلاش کنید.' : 'Could not remove it. Please try again.'}
            </p>
          )}
        </div>
      </div>

      <ol className="relative grid gap-px bg-[var(--border-subtle)] md:grid-cols-2 xl:grid-cols-5">
        {orderedItems.map((item, index) => {
          const Icon = item.icon
          return (
            <li key={item.key} className="bg-[var(--bg-surface)]">
              <Link
                href={item.href}
                className="group flex min-h-full items-start gap-3 p-4 transition-colors hover:bg-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--text-primary)] sm:p-5"
              >
                <span className={cn(
                  'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors',
                  item.done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-[var(--border-default)] bg-white text-[var(--text-muted)] group-hover:border-[var(--border-strong)] group-hover:text-[var(--text-primary)]',
                )}>
                  {item.done ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{item.title}</span>
                    {item.optional && (
                      <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-muted)]">
                        {fa ? 'پیشنهادی' : 'Optional'}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{item.description}</span>
                  <span className={cn(
                    'mt-3 inline-flex min-h-6 items-center gap-1 text-[11px] font-bold',
                    item.done ? 'text-emerald-700' : 'text-[var(--text-primary)]',
                  )}>
                    {item.done ? (fa ? 'انجام شده' : 'Completed') : item.cta}
                    {!item.done && <Arrow className="h-3 w-3 transition-transform group-hover:rtl:-translate-x-0.5 group-hover:ltr:translate-x-0.5" />}
                  </span>
                </span>
                <span className="sr-only">{fa ? `مرحله ${index + 1}` : `Step ${index + 1}`}</span>
                {!item.done && <Circle aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 text-[var(--border-strong)]" />}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
