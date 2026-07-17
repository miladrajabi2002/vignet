'use client'

import {
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  GraduationCap,
  Headphones,
  Package,
  QrCode,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BusinessServiceOption, BusinessTypeValue } from '@/lib/verticals/registry'

type Locale = 'fa' | 'en'

const OPTION_META: Record<string, {
  icon: LucideIcon
  fa: readonly string[]
  en: readonly string[]
}> = {
  products: { icon: Package, fa: ['کاتالوگ', 'قیمت و موجودی'], en: ['Catalog', 'Price & stock'] },
  bookings: { icon: CalendarDays, fa: ['تقویم و ظرفیت', 'بدون تداخل'], en: ['Calendar & capacity', 'Conflict-free'] },
  services: { icon: BriefcaseBusiness, fa: ['معرفی به مشتری', 'ثبت درخواست'], en: ['Customer-ready catalog', 'Request capture'] },
  instagram: { icon: Camera, fa: ['دایرکت و کامنت', 'فروش خودکار'], en: ['DMs & comments', 'Automated sales'] },
  'digital-menu': { icon: QrCode, fa: ['QR و لینک عمومی', 'سفارش‌گیری'], en: ['QR & public link', 'Ordering'] },
  courses: { icon: GraduationCap, fa: ['معرفی دوره', 'ثبت‌نام و جلسه'], en: ['Course catalog', 'Enrollment & sessions'] },
  support: { icon: Headphones, fa: ['پاسخ دانش‌محور', 'تحویل به اپراتور'], en: ['Knowledge answers', 'Operator handoff'] },
}

function optionLabel(option: BusinessServiceOption, locale: Locale) {
  return locale === 'fa' ? option.fa : option.en
}

export function CapabilityOptions({
  options,
  selected,
  businessType,
  locale,
  title,
  hint,
  onToggle,
}: {
  options: readonly BusinessServiceOption[]
  selected: readonly string[]
  businessType: BusinessTypeValue
  locale: Locale
  title: string
  hint: string
  onToggle: (service: string) => void
}) {
  const fa = locale === 'fa'
  const recommended = options.filter((option, index) =>
    option.recommendedFor.includes(businessType) || (businessType === 'CUSTOM' && index < 2),
  )
  const recommendedKeys = new Set(recommended.map((option) => option.key))
  const more = options.filter((option) => !recommendedKeys.has(option.key))
  const bookingSelected = options.some(
    (option) => option.key === 'bookings' && selected.includes(optionLabel(option, locale)),
  )

  function renderOption(option: BusinessServiceOption, isRecommended: boolean) {
    const service = optionLabel(option, locale)
    const active = selected.includes(service)
    const meta = OPTION_META[option.key] ?? { icon: Sparkles, fa: [], en: [] }
    const Icon = meta.icon
    const benefits = fa ? meta.fa : meta.en

    return (
      <button
        key={option.key}
        type="button"
        aria-pressed={active}
        onClick={() => onToggle(service)}
        className={cn(
          'spatial-press group relative min-h-[7.5rem] rounded-2xl border p-4 text-start transition-[border-color,background-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-2',
          active
            ? 'border-[var(--text-primary)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]'
            : 'border-[var(--border-default)] bg-white hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]',
        )}
      >
        <span className="flex items-start gap-3">
          <span className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-150',
            active
              ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
          )}>
            <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="text-[13px] font-bold leading-6 text-[var(--text-primary)]">{service}</span>
              <span className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition-colors duration-150',
                active
                  ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                  : 'border-[var(--border-default)] bg-white text-transparent',
              )}>
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-[var(--text-muted)]">
              {fa ? option.descriptionFa : option.descriptionEn}
            </span>
          </span>
        </span>

        <span className="mt-3 flex flex-wrap items-center gap-1.5">
          {isRecommended && (
            <span className="rounded-full bg-[var(--text-primary)] px-2 py-1 text-[9px] font-bold text-white">
              {fa ? 'پیشنهادی' : 'Recommended'}
            </span>
          )}
          {benefits.map((benefit) => (
            <span key={benefit} className="rounded-full border border-[var(--border-subtle)] bg-white px-2 py-1 text-[9px] font-medium text-[var(--text-muted)]">
              {benefit}
            </span>
          ))}
        </span>
      </button>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-[var(--text-primary)]">{title}</div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{hint}</p>
        </div>
        <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[10px] font-bold tabular-nums text-[var(--text-secondary)]">
          {selected.length.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'انتخاب' : 'selected'}
        </span>
      </div>

      {recommended.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
            <Sparkles className="h-3.5 w-3.5" />
            {fa ? 'پیشنهاد مناسب برای این کسب‌وکار' : 'Recommended for this business'}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {recommended.map((option) => renderOption(option, true))}
          </div>
        </div>
      )}

      {more.length > 0 && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <p className="mb-2 text-[11px] font-bold text-[var(--text-secondary)]">
            {fa ? 'امکانات بیشتر' : 'More capabilities'}
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {more.map((option) => renderOption(option, false))}
          </div>
        </div>
      )}

      {bookingSelected && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-3 text-[11px] leading-5 text-emerald-800">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {fa
              ? 'رزرو شامل تعریف خدمت، ظرفیت و ساعت‌های کاری هم هست؛ همه این موارد داخل «رزروها و خدمات» مدیریت می‌شوند.'
              : 'Bookings also include service setup, capacity and working hours; they are managed together under Bookings & services.'}
          </p>
        </div>
      )}
    </div>
  )
}
