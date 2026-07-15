'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  MessageCircleMore,
  Plug,
  Sparkles,
} from 'lucide-react'
import {
  getDashboardModules,
  type BusinessTypeValue,
} from '@/lib/verticals/registry'

type Props = {
  businessType: BusinessTypeValue
  businessName: string
  services: string[]
  initialActive: boolean
  connected: boolean
}

const INSTAGRAM_SERVICE = {
  fa: 'مدیریت و فروش در اینستاگرام',
  en: 'Instagram sales & management',
} as const

export function InstagramServiceSetup({
  businessType,
  businessName,
  services,
  initialActive,
  connected,
}: Props) {
  const fa = useLocale() !== 'en'
  const router = useRouter()
  const [active, setActive] = useState(initialActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canActivate = businessName.trim().length >= 2 && services.length < 16

  async function activate() {
    if (!canActivate || saving) return

    setSaving(true)
    setError('')
    const service = fa ? INSTAGRAM_SERVICE.fa : INSTAGRAM_SERVICE.en
    const nextServices = [...services, service]

    try {
      const response = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType, businessName, services: nextServices }),
      })
      if (!response.ok) throw new Error('activate failed')

      const previousModules = getDashboardModules(businessType, services)
      const modules = getDashboardModules(businessType, nextServices)
      const detail = {
        businessType,
        services: nextServices,
        modules,
        newlyEnabled: modules.filter((module) => !previousModules.includes(module)),
        changedAt: Date.now(),
      }
      try {
        localStorage.setItem('vigent:vertical-change', JSON.stringify(detail))
      } catch {}
      window.dispatchEvent(new CustomEvent('vigent:vertical-changed', { detail }))
      setActive(true)
      router.refresh()
    } catch {
      setError(
        fa
          ? 'فعال‌سازی انجام نشد؛ دوباره تلاش کنید.'
          : 'Activation failed. Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const steps = fa
    ? [
        {
          title: 'خدمت را فعال کنید',
          description: 'بخش اینستاگرام به منوی اصلی داشبورد اضافه می‌شود.',
          icon: Sparkles,
          done: active,
        },
        {
          title: 'اکانت اینستاگرام را وصل کنید',
          description: connected
            ? 'اکانت اینستاگرام به این ایجنت متصل است.'
            : 'بعد از فعال‌سازی، از کارت اتصال پایین همین صفحه اکانت را وصل کنید.',
          icon: Plug,
          done: connected,
        },
        {
          title: 'پاسخ‌گویی را تنظیم کنید',
          description: 'در بخش اینستاگرام، اتوماسیون رایگان یا پاسخ AI را انتخاب کنید.',
          icon: MessageCircleMore,
          done: false,
        },
      ]
    : [
        {
          title: 'Activate the service',
          description: 'Instagram will be added to the main dashboard navigation.',
          icon: Sparkles,
          done: active,
        },
        {
          title: 'Connect your Instagram account',
          description: connected
            ? 'Instagram is connected to this agent.'
            : 'After activation, connect it from the card below on this page.',
          icon: Plug,
          done: connected,
        },
        {
          title: 'Choose reply behavior',
          description: 'Open Instagram to configure free automations or AI replies.',
          icon: MessageCircleMore,
          done: false,
        },
      ]

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-4 border-b border-[var(--border-default)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {fa ? 'راه‌اندازی خدمات اینستاگرام' : 'Set up Instagram services'}
              </h2>
              {active && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {fa ? 'فعال' : 'Active'}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-[var(--text-secondary)]">
              {fa
                ? 'اتوماسیون‌های ثابت رایگان‌اند؛ فقط پاسخ موفق AI از اعتبار پاسخ استفاده می‌کند.'
                : 'Static automations are free; only successful AI replies use reply credit.'}
            </p>
          </div>
        </div>

        {!active ? (
          canActivate ? (
            <button
              type="button"
              onClick={activate}
              disabled={saving}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {fa ? 'فعال‌کردن خدمات اینستاگرام' : 'Activate Instagram services'}
            </button>
          ) : (
            <Link
              href="/settings"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white"
            >
              {fa ? 'تکمیل اطلاعات کسب‌وکار' : 'Complete business profile'}
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )
        ) : (
          <Link
            href={connected ? '/instagram' : '#instagram-connection'}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
          >
            {connected
              ? fa ? 'مدیریت اینستاگرام' : 'Manage Instagram'
              : fa ? 'رفتن به اتصال اکانت' : 'Connect account'}
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        )}
      </div>

      <ol className="grid gap-px bg-[var(--border-default)] sm:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <li key={step.title} className="flex gap-3 bg-[var(--bg-surface)] p-4 sm:p-5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${step.done ? 'bg-emerald-500/10 text-emerald-700' : 'bg-[var(--bg-base)] text-[var(--text-secondary)]'}`}>
                {step.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {fa ? `مرحله ${index + 1}: ` : `Step ${index + 1}: `}{step.title}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                  {step.description}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      {error && (
        <p role="alert" className="border-t border-red-500/15 bg-red-500/5 px-5 py-3 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}
