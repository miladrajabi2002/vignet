'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Briefcase,
  CalendarDays,
  Check,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  Settings2,
  ShoppingBag,
  Utensils,
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

export function BusinessProfileStep({
  workspaceName,
  initialType,
  initialProfile,
}: Props) {
  const locale = useLocale()
  const fa = locale === 'fa'
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<BusinessTypeValue | null>(
    initialProfile ? initialType : null,
  )
  const [businessName, setBusinessName] = useState(
    initialProfile?.businessName ?? workspaceName,
  )
  const [services, setServices] = useState<string[]>(initialProfile?.services ?? [])
  const [customService, setCustomService] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(Boolean(initialProfile))
  const [message, setMessage] = useState('')

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
        title: 'اول بگویید کسب‌وکارتان چطور کار می‌کند',
        subtitle: 'ویجنت بر اساس نوع عملیات، ماژول‌ها و شروع مناسب ایجنت را آماده می‌کند؛ کانال‌ها را بعداً آزادانه وصل می‌کنید.',
        name: 'نام کسب‌وکار',
        services: 'خدمات یا کارهای اصلی',
        servicesHint: 'حداقل یک مورد را انتخاب کنید؛ هر زمان بخواهید قابل تغییر است.',
        addPlaceholder: 'مثلاً مشاوره آنلاین',
        add: 'افزودن خدمت',
        save: 'ذخیره و شخصی‌سازی ویجنت',
        saving: 'در حال ذخیره…',
        saved: 'پروفایل کسب‌وکار ذخیره شد.',
        error: 'ذخیره انجام نشد؛ دوباره تلاش کنید.',
        continue: 'ساخت ایجنت پیشنهادی',
      }
    : {
        eyebrow: 'Operating profile',
        title: 'First, tell us how your business works',
        subtitle: 'Vigent prepares the right modules and agent starting point from your operation type. Connect any channel later.',
        name: 'Business name',
        services: 'Main services or jobs',
        servicesHint: 'Select at least one. You can change these at any time.',
        addPlaceholder: 'e.g. Online consultation',
        add: 'Add service',
        save: 'Save and personalize Vigent',
        saving: 'Saving…',
        saved: 'Business profile saved.',
        error: 'Could not save. Please try again.',
        continue: 'Build suggested agent',
      }

  function selectType(type: BusinessTypeValue) {
    const pack = getVerticalPack(type)
    setSelectedType(type)
    setServices([...(fa ? pack.suggestedServicesFa : pack.suggestedServicesEn)].slice(0, 2))
    setSaved(false)
    setMessage('')
  }

  function toggleService(service: string) {
    setServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service].slice(0, 16),
    )
    setSaved(false)
  }

  function addService() {
    const value = customService.trim()
    if (!value || services.includes(value)) return
    setServices((current) => [...current, value].slice(0, 16))
    setCustomService('')
    setSaved(false)
  }

  async function saveProfile() {
    if (!selectedType || businessName.trim().length < 2 || services.length === 0) {
      setMessage(fa ? 'نوع کسب‌وکار، نام و حداقل یک خدمت را کامل کنید.' : 'Choose a type, name and at least one service.')
      return
    }
    setSaving(true)
    setMessage('')
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
      setMessage(copy.saved)
      router.refresh()
    } catch {
      setMessage(copy.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-white shadow-[var(--shadow-soft)]">
      <div className="border-b border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--accent-soft),white_52%)] px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
          {copy.eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          {copy.subtitle}
        </p>
      </div>

      <div className="space-y-7 p-5 sm:p-7">
        <fieldset>
          <legend className="sr-only">{copy.title}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BUSINESS_TYPES.map((type) => {
              const pack = getVerticalPack(type)
              const Icon = ICONS[type]
              const active = selectedType === type
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectType(type)}
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
                    <span className="absolute end-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="mt-4 block text-sm font-semibold text-[var(--text-primary)]">
                    {fa ? pack.titleFa : pack.titleEn}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                    {fa ? pack.descriptionFa : pack.descriptionEn}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {selectedPack && (
          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
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
                }}
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
                {services.filter((service) => !suggestions.includes(service)).map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className="min-h-10 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 text-sm text-[var(--accent-foreground)]"
                  >
                    <Check className="me-1.5 inline h-3.5 w-3.5" />
                    {service}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={customService}
                  onChange={(event) => setCustomService(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addService()
                    }
                  }}
                  aria-label={copy.addPlaceholder}
                  placeholder={copy.addPlaceholder}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-white px-3 text-base outline-none focus:border-[var(--accent-border)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
                <button
                  type="button"
                  onClick={addService}
                  aria-label={copy.add}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className={cn('text-sm', saved ? 'text-success' : 'text-[var(--text-secondary)]')}>
            {message}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {saved && selectedPack && (
              <Link
                href={`/agents/new?business=${selectedPack.agentTemplate}`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
              >
                {copy.continue}
              </Link>
            )}
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving || !selectedType}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-[opacity,transform] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save className="h-4 w-4" />}
              {saving ? copy.saving : copy.save}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
