'use client'

import { useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Briefcase,
  CalendarDays,
  Check,
  GraduationCap,
  Headphones,
  Camera,
  Loader2,
  Settings2,
  ShoppingBag,
  Utensils,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BUSINESS_TYPES,
  getVerticalPack,
  type BusinessTypeValue,
} from '@/lib/verticals/registry'

const ICONS: Record<BusinessTypeValue, typeof ShoppingBag> = {
  COMMERCE: ShoppingBag,
  FOOD: Utensils,
  APPOINTMENTS: CalendarDays,
  SERVICES: Briefcase,
  EDUCATION: GraduationCap,
  SUPPORT: Headphones,
  SOCIAL: Camera,
  CUSTOM: Settings2,
}

interface Props {
  workspaceName: string
  initialType: BusinessTypeValue
  initialProfile: { businessName: string; services: string[] } | null
  mode?: 'onboarding' | 'settings'
}

// 3 sub-steps: 0 = choose type, 1 = name + services, 2 = review + next action
type SubStep = 0 | 1 | 2

export function BusinessProfileStep({
  workspaceName,
  initialType,
  initialProfile,
  mode = 'onboarding',
}: Props) {
  const locale = useLocale()
  const fa = locale === 'fa'
  const router = useRouter()
  const [subStep, setSubStep] = useState<SubStep>(mode === 'settings' ? 0 : initialProfile ? 1 : 0)
  const [selectedType, setSelectedType] = useState<BusinessTypeValue | null>(
    initialProfile ? initialType : null,
  )
  const [businessName, setBusinessName] = useState(
    initialProfile?.businessName ?? workspaceName,
  )
  const [services, setServices] = useState<string[]>(initialProfile?.services ?? [])
  const [saving, setSaving] = useState(false)
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
        step1Title: mode === 'settings' ? 'تغییر نوع کسب‌وکار' : 'نوع کسب‌وکار خود را انتخاب کنید',
        step1Hint: mode === 'settings' ? 'با تغییر نوع، ابزارها و پیشنهادهای پنل متناسب می‌شوند' : 'برای شروع، مدل عملیاتی کسب‌وکار خود را مشخص کنید',
        step2Title: mode === 'settings' ? 'اطلاعات کسب‌وکار جدید' : 'نام و خدمات کسب‌وکار',
        step2Hint: mode === 'settings' ? 'نام و خدمات متناسب با نوع انتخاب‌شده را بازبینی کنید' : 'اطلاعات پایه کسب‌وکار خود را وارد کنید',
        step3Title: mode === 'settings' ? 'نوع کسب‌وکار به‌روز شد' : 'آماده برای ساخت ایجنت',
        step3Hint: mode === 'settings' ? 'منو و ابزارهای پنل با انتخاب جدید هماهنگ شدند' : 'اطلاعات ذخیره شد. حالا ایجنت خود را بسازید',
        name: 'نام کسب‌وکار',
        namePlaceholder: 'مثلاً فروشگاه رزین‌مهر',
        services: 'خدمات یا کارهای اصلی',
        servicesHint: 'حداقل یک مورد را انتخاب کنید. هر زمان بخواهید قابل تغییر است.',
        save: 'ذخیره و ادامه',
        saving: 'در حال ذخیره…',
        saved: 'ذخیره شد',
        next: 'ادامه',
        back: 'بازگشت',
        buildAgent: mode === 'settings' ? 'تغییر دوباره' : 'ساخت ایجنت پیشنهادی',
        errorName: 'نام کسب‌وکار را وارد کنید (حداقل ۲ نویسه).',
        errorServices: 'حداقل یک خدمت را انتخاب کنید.',
        pickType: 'یک گزینه را انتخاب کنید',
        reviewName: 'نام کسب‌وکار',
        reviewType: 'نوع',
        reviewServices: 'خدمات',
        step: 'مرحله',
        of: 'از',
      }
    : {
        step1Title: mode === 'settings' ? 'Change business type' : 'Choose your business type',
        step1Hint: mode === 'settings' ? 'Dashboard tools adapt to the selected business' : 'Select your operational model to get started',
        step2Title: mode === 'settings' ? 'Updated business details' : 'Business name & services',
        step2Hint: mode === 'settings' ? 'Review the name and services for the new type' : 'Enter the basics of your business',
        step3Title: mode === 'settings' ? 'Business type updated' : 'Ready to build your agent',
        step3Hint: mode === 'settings' ? 'Dashboard navigation and tools now match this business' : 'Profile saved. Now build your agent',
        name: 'Business name',
        namePlaceholder: 'e.g. ResinMehr Store',
        services: 'Main services or jobs',
        servicesHint: 'Select at least one. You can change these at any time.',
        save: 'Save and continue',
        saving: 'Saving…',
        saved: 'Saved',
        next: 'Continue',
        back: 'Back',
        buildAgent: mode === 'settings' ? 'Change again' : 'Build suggested agent',
        errorName: 'Enter a business name (at least 2 characters).',
        errorServices: 'Select at least one service.',
        pickType: 'Pick one option',
        reviewName: 'Business name',
        reviewType: 'Type',
        reviewServices: 'Services',
        step: 'Step',
        of: 'of',
      }

  function selectType(type: BusinessTypeValue) {
    const pack = getVerticalPack(type)
    setSelectedType(type)
    setServices([...(fa ? pack.suggestedServicesFa : pack.suggestedServicesEn)].slice(0, 2))
    setError('')
    // Auto-advance to next sub-step after a brief moment
    setTimeout(() => setSubStep(1), 350)
  }

  function toggleService(service: string) {
    setServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service].slice(0, 16),
    )
    setError('')
  }

  function goBack() {
    setError('')
    setSubStep((s) => (s > 0 ? ((s - 1) as SubStep) : s))
  }

  async function saveProfile() {
    if (!selectedType) {
      setError(copy.errorName)
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
      // Auto-advance to review step
      setSubStep(2)
      router.refresh()
    } catch {
      setError(fa ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.' : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const Arrow = fa ? ArrowLeft : ArrowRight
  const BackArrow = fa ? ArrowRight : ArrowLeft

  const subStepLabels = fa
    ? ['انتخاب نوع', 'نام و خدمات', 'بازبینی']
    : ['Type', 'Name & services', 'Review']

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white" style={{ boxShadow: 'var(--shadow-card)' }}>
      {/* Progress bar — 3 sub-steps */}
      <div className="border-b border-[var(--border-subtle)] px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {subStepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-all duration-200',
                    subStep > i
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                      : subStep === i
                        ? 'border-[var(--text-primary)] bg-white text-[var(--text-primary)]'
                        : 'border-[var(--border-default)] bg-white text-[var(--text-hint)]',
                  )}
                >
                  {subStep > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn('hidden text-xs font-medium sm:inline', subStep >= i ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)]')}>
                  {label}
                </span>
                {i < subStepLabels.length - 1 && (
                  <div className={cn('mx-1 h-px w-6 rounded-full transition-colors duration-200 sm:w-10', subStep > i ? 'bg-[var(--text-primary)]' : 'bg-[var(--border-default)]')} />
                )}
              </div>
            ))}
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {copy.step} {subStep + 1} {copy.of} 3
          </span>
        </div>
      </div>

      {/* Body — animated sub-step transitions */}
      <div className="p-6 sm:p-7">
        <AnimatePresence mode="wait">
          {/* Sub-step 0: Choose business type */}
          {subStep === 0 && (
            <motion.div
              key="step-type"
              initial={{ opacity: 0, x: fa ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: fa ? 16 : -16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{copy.step1Title}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.step1Hint}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {BUSINESS_TYPES.map((type, index) => {
                  const pack = getVerticalPack(type)
                  const Icon = ICONS[type]
                  const active = selectedType === type
                  const features = fa ? pack.featuresFa : pack.featuresEn
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectType(type)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className={cn(
                        'group relative min-h-[7.5rem] rounded-xl border p-4 text-start transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)] focus-visible:ring-offset-2',
                        active
                          ? 'border-[var(--text-primary)] bg-[var(--bg-surface)]'
                          : 'border-[var(--border-default)] bg-white hover:border-[var(--border-hover)]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors',
                            active ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-subtle)] bg-white text-[var(--text-secondary)]',
                          )}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{fa ? pack.titleFa : pack.titleEn}</p>
                            <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">{fa ? pack.descriptionFa : pack.descriptionEn}</p>
                          </div>
                        </div>
                        {active && (
                          <motion.span layoutId="type-check" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-white">
                            <Check className="h-3 w-3" />
                          </motion.span>
                        )}
                      </div>
                      {/* Feature highlights */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {features.map((f) => (
                          <span key={f} className="rounded-md border border-[var(--border-subtle)] bg-white px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Sub-step 1: Name + services */}
          {subStep === 1 && (
            <motion.div
              key="step-details"
              initial={{ opacity: 0, x: fa ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: fa ? 16 : -16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{copy.step2Title}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.step2Hint}</p>
              </div>

              {selectedPack && (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  {(() => {
                    const Icon = ICONS[selectedType!]
                    return <Icon className="h-3.5 w-3.5 shrink-0" />
                  })()}
                  {fa ? selectedPack.titleFa : selectedPack.titleEn}
                </div>
              )}

              <div>
                <label htmlFor="business-name" className="mb-1.5 block text-[13px] font-medium text-[var(--text-primary)]">
                  {copy.name}
                </label>
                <input
                  id="business-name"
                  value={businessName}
                  onChange={(event) => {
                    setBusinessName(event.target.value)
                                    setError('')
                  }}
                  placeholder={copy.namePlaceholder}
                  className="input min-h-11 text-sm"
                />
              </div>

              <div>
                <div className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">{copy.services}</div>
                <p className="mb-2.5 text-xs text-[var(--text-muted)]">{copy.servicesHint}</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((service) => {
                    const active = services.includes(service)
                    return (
                      <button
                        key={service}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleService(service)}
                        className={cn(
                          'min-h-9 rounded-lg border px-3 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)]',
                          active
                            ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                            : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-hover)]',
                        )}
                      >
                        {active && <Check className="me-1 inline h-3 w-3" />}
                        {service}
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && (
                <p className="text-[13px] text-[var(--red)]">{error}</p>
              )}

              {/* Action row — back + save (centered primary) */}
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-4 text-[13px] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-surface)]"
                >
                  <BackArrow className="h-3.5 w-3.5 rtl:rotate-0" />
                  {copy.back}
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] px-6 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-black disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? copy.saving : copy.save}
                  {!saving && <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />}
                </button>
              </div>
            </motion.div>
          )}

          {/* Sub-step 2: Review + build agent CTA */}
          {subStep === 2 && selectedPack && (
            <motion.div
              key="step-review"
              initial={{ opacity: 0, x: fa ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: fa ? 16 : -16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--text-primary)] text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{copy.step3Title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.step3Hint}</p>
                </div>
              </div>

              {/* Review summary card */}
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">{copy.reviewName}</dt>
                    <dd className="font-medium text-[var(--text-primary)]">{businessName}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">{copy.reviewType}</dt>
                    <dd className="font-medium text-[var(--text-primary)]">{fa ? selectedPack.titleFa : selectedPack.titleEn}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-[var(--text-muted)]">{copy.reviewServices}</dt>
                    <dd className="flex flex-wrap justify-end gap-1">
                      {services.map((s) => (
                        <span key={s} className="rounded-md border border-[var(--border-default)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                          {s}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Feature highlights for selected business */}
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">{fa ? 'امکانات اختصاصی شما' : 'Your dedicated features'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(fa ? selectedPack.featuresFa : selectedPack.featuresEn).map((f) => (
                    <div key={f} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-white px-2.5 py-2 text-[11px] text-[var(--text-secondary)]">
                      <Check className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action row — back + build agent (centered primary) */}
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  onClick={() => setSubStep(1)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-4 text-[13px] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-surface)]"
                >
                  <BackArrow className="h-3.5 w-3.5 rtl:rotate-0" />
                  {copy.back}
                </button>
                {mode === 'settings' ? (
                  <button
                    type="button"
                    onClick={() => setSubStep(0)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] px-6 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-black"
                  >
                    {copy.buildAgent}
                    <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
                  </button>
                ) : (
                  <a
                    href={`/agents/new?business=${selectedPack.agentTemplate}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] px-6 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-black"
                  >
                    {copy.buildAgent}
                    <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
