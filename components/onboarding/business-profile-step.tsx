'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Briefcase,
  CalendarDays,
  Check,
  GraduationCap,
  Loader2,
  Save,
  Settings2,
  ShoppingBag,
  Utensils,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BUSINESS_TYPES,
  getVerticalPack,
  type BusinessTypeValue,
} from '@/lib/verticals/registry'

const ICONS = {
  COMMERCE: ShoppingBag,
  FOOD: Utensils,
  APPOINTMENTS: CalendarDays,
  SERVICES: Briefcase,
  EDUCATION: GraduationCap,
  CUSTOM: Settings2,
} as const

interface Props {
  workspaceName: string
  initialType: BusinessTypeValue
  initialProfile: { businessName: string; services: string[] } | null
}

type SubStep = 0 | 1 // 0 = choose type, 1 = name + services

export function BusinessProfileStep({
  workspaceName,
  initialType,
  initialProfile,
}: Props) {
  const locale = useLocale()
  const fa = locale === 'fa'
  const router = useRouter()
  const [subStep, setSubStep] = useState<SubStep>(
    initialProfile ? 1 : 0,
  )
  const [selectedType, setSelectedType] = useState<BusinessTypeValue | null>(
    initialProfile ? initialType : null,
  )
  const [businessName, setBusinessName] = useState(
    initialProfile?.businessName ?? workspaceName,
  )
  const [services, setServices] = useState<string[]>(initialProfile?.services ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(Boolean(initialProfile))
  const [error, setError] = useState('')

  const selectedPack = useMemo(
    () => (selectedType ? getVerticalPack(selectedType) : null),
    [selectedType],
  )
  const suggestions = selectedPack
    ? fa
      ? selectedPack.suggestedServicesFa
      : selectedPack.suggestedServicesEn
    : []

  const copy = fa
    ? {
        eyebrow: 'پروفایل عملیاتی',
        title: 'کسب‌وکارتان چطور کار می‌کند؟',
        subtitle: 'ویجنت بر اساس نوع عملیات، ماژول‌ها و شروع مناسب ایجنت را آماده می‌کند.',
        step1Label: '۱. نوع کسب‌وکار',
        step2Label: '۲. نام و خدمات',
        name: 'نام کسب‌وکار',
        namePlaceholder: 'مثلاً فروشگاه رزین‌مهر',
        services: 'خدمات یا کارهای اصلی',
        servicesHint: 'حداقل یک مورد را انتخاب کنید. هر زمان بخواهید قابل تغییر است.',
        save: 'ذخیره و ادامه',
        saving: 'در حال ذخیره…',
        saved: 'پروفایل کسب‌وکار ذخیره شد.',
        errorName: 'نام کسب‌وکار را وارد کنید (حداقل ۲ نویسه).',
        errorServices: 'حداقل یک خدمت را انتخاب کنید.',
        errorType: 'ابتدا نوع کسب‌وکار را انتخاب کنید.',
        continue: 'ساخت ایجنت پیشنهادی',
        back: 'بازگشت',
        next: 'ادامه',
        pickType: 'یک گزینه را انتخاب کنید',
        niceChoice: 'عالی! حالا نام و خدمات را وارد کنید',
      }
    : {
        eyebrow: 'Operating profile',
        title: 'How does your business work?',
        subtitle: 'Vigent prepares the right modules and agent starting point from your operation type.',
        step1Label: '1. Business type',
        step2Label: '2. Name & services',
        name: 'Business name',
        namePlaceholder: 'e.g. ResinMehr Store',
        services: 'Main services or jobs',
        servicesHint: 'Select at least one. You can change these at any time.',
        save: 'Save and continue',
        saving: 'Saving…',
        saved: 'Business profile saved.',
        errorName: 'Enter a business name (at least 2 characters).',
        errorServices: 'Select at least one service.',
        errorType: 'Choose a business type first.',
        continue: 'Build suggested agent',
        back: 'Back',
        next: 'Continue',
        pickType: 'Pick one option',
        niceChoice: 'Nice! Now enter your name and services',
      }

  function selectType(type: BusinessTypeValue) {
    const pack = getVerticalPack(type)
    setSelectedType(type)
    // Pre-select the first 2 suggested services for convenience.
    setServices([...(fa ? pack.suggestedServicesFa : pack.suggestedServicesEn)].slice(0, 2))
    setSaved(false)
    setError('')
  }

  function toggleService(service: string) {
    setServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service].slice(0, 16),
    )
    setSaved(false)
    setError('')
  }

  function goNext() {
    if (!selectedType) {
      setError(copy.errorType)
      return
    }
    setError('')
    setSubStep(1)
  }

  function goBack() {
    setError('')
    setSubStep(0)
  }

  async function saveProfile() {
    // Specific validation — tell the user exactly what's missing.
    if (!selectedType) {
      setError(copy.errorType)
      return
    }
    if (businessName.trim().length < 2) {
      setError(copy.errorName)
      return
    }
    if (services.length === 0) {
      setError(copy.errorServices)
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType: selectedType,
          businessName: businessName.trim(),
          services,
        }),
      })
      if (!response.ok) throw new Error('save failed')
      setSaved(true)
      router.refresh()
    } catch {
      setError(fa ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.' : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const Arrow = fa ? ArrowLeft : ArrowRight
  const BackArrow = fa ? ArrowRight : ArrowLeft

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-white shadow-[var(--shadow-soft)]">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--accent-soft),white_52%)] px-5 py-5 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
          {copy.eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
          {copy.title}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          {copy.subtitle}
        </p>

        {/* Sub-step progress */}
        <div className="mt-4 flex items-center gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                  subStep >= i
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border-default)] bg-white text-[var(--text-muted)]',
                )}
              >
                {subStep > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn('hidden text-xs font-medium sm:inline', subStep >= i ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>
                {i === 0 ? copy.step1Label : copy.step2Label}
              </span>
              {i === 0 && (
                <div className={cn('h-0.5 flex-1 rounded-full transition-colors', subStep >= 1 ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Body — animated sub-step transitions */}
      <div className="p-5 sm:p-7">
        <AnimatePresence mode="wait">
          {subStep === 0 ? (
            <motion.div
              key="step-type"
              initial={{ opacity: 0, x: fa ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: fa ? 24 : -24 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">{copy.pickType}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {BUSINESS_TYPES.map((type, index) => {
                  const pack = getVerticalPack(type)
                  const Icon = ICONS[type]
                  const active = selectedType === type
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectType(type)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.04 }}
                      className={cn(
                        'relative min-h-36 rounded-2xl border p-4 text-start transition-[border-color,background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 motion-reduce:transform-none',
                        active
                          ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] shadow-[var(--shadow-soft)]'
                          : 'border-[var(--border-default)] bg-white hover:-translate-y-0.5 hover:border-[var(--border-strong)]',
                      )}
                    >
                      <span className={cn(
                        'grid h-10 w-10 place-items-center rounded-xl border',
                        active
                          ? 'border-[var(--accent-border)] bg-white text-[var(--accent-strong)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-secondary)]',
                      )}>
                        <Icon className="h-5 w-5" />
                      </span>
                      {active && (
                        <motion.span
                          layoutId="type-check"
                          className="absolute end-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </motion.span>
                      )}
                      <span className="mt-4 block text-sm font-semibold text-[var(--text-primary)]">
                        {fa ? pack.titleFa : pack.titleEn}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                        {fa ? pack.descriptionFa : pack.descriptionEn}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step-details"
              initial={{ opacity: 0, x: fa ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: fa ? 24 : -24 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent-foreground)]">
                <Sparkles className="h-3.5 w-3.5" />
                {copy.niceChoice}
              </div>

              <div>
                <label htmlFor="business-name" className="text-sm font-medium text-[var(--text-primary)]">
                  {copy.name}
                </label>
                <input
                  id="business-name"
                  value={businessName}
                  onChange={(event) => {
                    setBusinessName(event.target.value)
                    setSaved(false)
                    setError('')
                  }}
                  placeholder={copy.namePlaceholder}
                  className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border-default)] bg-white px-4 text-base text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-border)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              </div>

              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{copy.services}</div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.servicesHint}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((service) => {
                    const active = services.includes(service)
                    return (
                      <button
                        key={service}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleService(service)}
                        className={cn(
                          'min-h-10 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                          active
                            ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-foreground)]'
                            : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                        )}
                      >
                        {active && <Check className="me-1.5 inline h-3.5 w-3.5" />}
                        {service}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer actions */}
        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className={cn('min-h-5 text-sm', error ? 'text-red-500' : saved ? 'text-success' : 'text-[var(--text-secondary)]')}>
            {error || (saved ? copy.saved : '')}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {subStep === 1 && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <BackArrow className="h-3.5 w-3.5 rtl:rotate-0" />
                {copy.back}
              </button>
            )}
            {saved && selectedPack && (
              <Link
                href={`/agents/new?business=${selectedPack.agentTemplate}`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-[opacity,transform] hover:-translate-y-0.5"
              >
                {copy.continue}
                <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            )}
            {subStep === 0 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!selectedType}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-[opacity,transform] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
              >
                {copy.next}
                <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
              </button>
            ) : (
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-[opacity,transform] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save className="h-4 w-4" />}
                {saving ? copy.saving : copy.save}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
