'use client'

import { useState } from 'react'
import {
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  GraduationCap,
  Headphones,
  Package,
  QrCode,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CORE_DASHBOARD_MODULES,
  collapseDashboardNavigationModules,
  getDashboardModuleLabel,
  getDefaultCapabilities,
  type BusinessServiceOption,
  type BusinessTypeValue,
  type CapabilityKey,
  type DashboardModuleKey,
} from '@/lib/verticals/registry'

const CORE = new Set<DashboardModuleKey>(CORE_DASHBOARD_MODULES)

// Onboarding renders outside the dashboard message scope; fallbacks for the
// sections getDashboardModuleLabel does not name itself.
const SECTION_FALLBACK: Partial<Record<DashboardModuleKey, { fa: string; en: string }>> = {
  products: { fa: 'محصولات', en: 'Products' },
  instagram: { fa: 'اینستاگرام', en: 'Instagram' },
}

function sectionLabel(module: DashboardModuleKey, businessType: BusinessTypeValue, locale: Locale) {
  const fallback = SECTION_FALLBACK[module]
  return getDashboardModuleLabel(module, businessType, locale, fallback ? fallback[locale] : module)
}

type Locale = 'fa' | 'en'

const OPTION_META: Record<CapabilityKey, {
  icon: LucideIcon
  fa: readonly string[]
  en: readonly string[]
}> = {
  products: { icon: Package, fa: ['کاتالوگ', 'قیمت و موجودی'], en: ['Catalog', 'Price & stock'] },
  bookings: { icon: CalendarDays, fa: ['تقویم و ظرفیت', 'بدون تداخل'], en: ['Calendar & capacity', 'Conflict-free'] },
  services: { icon: BriefcaseBusiness, fa: ['معرفی به مشتری', 'ثبت درخواست'], en: ['Customer-ready catalog', 'Request capture'] },
  instagram: { icon: Camera, fa: ['دایرکت و کامنت', 'پاسخ خودکار'], en: ['DMs & comments', 'Automated replies'] },
  'digital-menu': { icon: QrCode, fa: ['QR و لینک عمومی', 'سفارش‌گیری'], en: ['QR & public link', 'Ordering'] },
  courses: { icon: GraduationCap, fa: ['ظرفیت و جلسات', 'ثبت‌نام در گفتگو'], en: ['Capacity & sessions', 'In-chat enrollment'] },
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
  selected: readonly CapabilityKey[]
  businessType: BusinessTypeValue
  locale: Locale
  title: string
  hint: string
  onToggle: (key: CapabilityKey) => void
}) {
  const fa = locale === 'fa'
  const recommended = options.filter((option, index) =>
    option.recommendedFor.includes(businessType) || (businessType === 'CUSTOM' && index < 2),
  )
  const recommendedKeys = new Set(recommended.map((option) => option.key))
  const more = options.filter((option) => !recommendedKeys.has(option.key))
  const bookingSelected = selected.includes('bookings')
  const typeDefaults = new Set(getDefaultCapabilities(businessType))

  // Capabilities outside the recommended set stay folded away until asked
  // for, unless one of them is already switched on.
  const [showMore, setShowMore] = useState(() => more.some((option) => selected.includes(option.key)))

  function renderOption(option: BusinessServiceOption, isRecommended: boolean) {
    const service = optionLabel(option, locale)
    const active = selected.includes(option.key)
    const meta = OPTION_META[option.key] ?? { icon: Sparkles, fa: [], en: [] }
    const Icon = meta.icon
    const sections = collapseDashboardNavigationModules(option.modules, [option.key])
      .filter((module) => !CORE.has(module))
      .map((module) => sectionLabel(module, businessType, locale))
    const isDefault = typeDefaults.has(option.key)

    return (
      <button
        key={option.key}
        type="button"
        aria-pressed={active}
        onClick={() => onToggle(option.key)}
        className="spatial-press group flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-150 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
      >
        <span className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-150',
          active
            ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
            : 'border-black/30 bg-white text-transparent',
        )}>
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
          <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold leading-6 text-[var(--text-primary)]">{service}</span>
          <span className="block text-[12px] leading-5 text-[var(--text-muted)]">
            {fa ? option.descriptionFa : option.descriptionEn}
            {sections.length > 0 && <span className="hidden sm:inline"> · {fa ? 'در منو: ' : 'In menu: '}{sections.join(fa ? '، ' : ', ')}</span>}
          </span>
        </span>
        {(isDefault || isRecommended) && (
          <span className={cn(
            'hidden shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium sm:inline-flex',
            isDefault ? 'bg-black/[0.06] text-[var(--text-secondary)]' : 'bg-[var(--signal-soft)] text-[var(--signal-strong)]',
          )}>
            {isDefault ? (fa ? 'پیش‌فرض' : 'Default') : (fa ? 'پیشنهادی' : 'Recommended')}
          </span>
        )}
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[13px] font-medium text-[var(--text-primary)]">{title}</div>
        <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">
          {fa
            ? `${selected.length.toLocaleString('fa-IR')} از ${options.length.toLocaleString('fa-IR')}`
            : `${selected.length} of ${options.length}`}
        </span>
      </div>

      <div className="mt-2 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white shadow-[var(--shadow-sm)]">
        {recommended.map((option) => renderOption(option, true))}
        {showMore && more.map((option) => renderOption(option, false))}
        {more.length > 0 && !showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            aria-expanded={false}
            className="flex min-h-11 w-full items-center justify-between gap-3 bg-[var(--bg-base)] px-3.5 py-2.5 text-start text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
          >
            <span>
              {fa
                ? `${more.length.toLocaleString('fa-IR')} قابلیت دیگر: ${more.map((option) => option.fa.split(' و ')[0]).join('، ')}`
                : `${more.length} more: ${more.map((option) => option.en).join(', ')}`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{hint}</p>

      {bookingSelected && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-3 text-[12px] leading-5 text-emerald-800">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {fa
              ? `رزرو شامل تعریف خدمت، ظرفیت و ساعت‌های کاری هم هست؛ همه این موارد داخل «${sectionLabel('appointments', businessType, locale)}» مدیریت می‌شوند.`
              : `Bookings also include service setup, capacity and working hours, managed together under ${sectionLabel('appointments', businessType, locale)}.`}
          </p>
        </div>
      )}
    </div>
  )
}
