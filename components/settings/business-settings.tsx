'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CircleDashed,
  CalendarDays,
  Camera,
  Check,
  EyeOff,
  GraduationCap,
  Headphones,
  Loader2,
  Package,
  QrCode,
  Settings2,
  ShoppingBag,
  Sparkles,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDashboardNavForProfile } from '@/components/dashboard/nav-items'
import {
  BUSINESS_TYPES,
  CORE_DASHBOARD_MODULES,
  capabilitiesBringingModule,
  capabilityLabel,
  collapseDashboardNavigationModules,
  getBusinessServiceOptions,
  getDashboardModuleLabel,
  getDashboardModules,
  getDefaultCapabilities,
  getVerticalPack,
  legacyCapabilities,
  type BusinessTypeValue,
  type CapabilityKey,
  type DashboardModuleKey,
} from '@/lib/verticals/registry'
import type { BusinessProfile } from '@/lib/verticals/profile'
import type { CapabilityReadinessMap } from '@/lib/verticals/readiness'

const TYPE_ICONS: Record<BusinessTypeValue, LucideIcon> = {
  COMMERCE: ShoppingBag,
  FOOD: Utensils,
  APPOINTMENTS: CalendarDays,
  SERVICES: BriefcaseBusiness,
  EDUCATION: GraduationCap,
  SUPPORT: Headphones,
  SOCIAL: Camera,
  CUSTOM: Settings2,
}

const OPTION_ICONS: Record<CapabilityKey, LucideIcon> = {
  products: Package,
  bookings: CalendarDays,
  services: BriefcaseBusiness,
  instagram: Camera,
  'digital-menu': QrCode,
  courses: GraduationCap,
  support: Headphones,
}

const CORE = new Set<DashboardModuleKey>(CORE_DASHBOARD_MODULES)

type Saved = { type: BusinessTypeValue; name: string; capabilities: CapabilityKey[]; extras: string[] }

function sameSet(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((item) => b.includes(item))
}

/**
 * Settings → business. One screen instead of a wizard: what the panel shows
 * right now, the business type, and the capabilities — with a live preview
 * of the menu so every change says exactly which sections appear or hide
 * before anything is saved.
 */
export function BusinessSettings({
  workspaceName,
  initialType,
  initialProfile,
  readiness,
}: {
  workspaceName: string
  initialType: BusinessTypeValue
  initialProfile: BusinessProfile | null
  /** Setup state per capability, computed on the server from real data. */
  readiness?: CapabilityReadinessMap
}) {
  const locale = useLocale()
  const fa = locale !== 'en'
  const t = useTranslations('dashboard')
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  const [saved, setSaved] = useState<Saved>(() => ({
    type: initialType,
    name: initialProfile?.businessName ?? workspaceName,
    // No saved profile yet: start from what the type has been showing.
    capabilities: initialProfile?.capabilities ?? legacyCapabilities(initialType, []),
    extras: initialProfile?.extras ?? [],
  }))
  const [type, setType] = useState<BusinessTypeValue>(saved.type)
  const [name, setName] = useState(saved.name)
  const [keys, setKeys] = useState<CapabilityKey[]>(saved.capabilities)
  const [extras, setExtras] = useState<string[]>(saved.extras)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState<{ added: DashboardModuleKey[]; hidden: DashboardModuleKey[]; previousType: BusinessTypeValue } | null>(null)

  const savedNav = useMemo(() => getDashboardNavForProfile(saved.capabilities), [saved])
  const nextNav = useMemo(() => getDashboardNavForProfile(keys), [keys])
  const savedKeys = useMemo(() => new Set(savedNav.map((item) => item.key)), [savedNav])
  const nextKeys = useMemo(() => new Set(nextNav.map((item) => item.key)), [nextNav])
  const added = nextNav.filter((item) => !savedKeys.has(item.key)).map((item) => item.key)
  const hidden = savedNav.filter((item) => !nextKeys.has(item.key)).map((item) => item.key)

  const dirty = type !== saved.type
    || name.trim() !== saved.name
    || !sameSet(keys, saved.capabilities)
    || !sameSet(extras, saved.extras)

  const label = (module: DashboardModuleKey, businessType: BusinessTypeValue = type) =>
    getDashboardModuleLabel(module, businessType, locale, t(module))

  const options = useMemo(() => getBusinessServiceOptions(type), [type])
  const pack = getVerticalPack(type)
  const typeDefaults = getDefaultCapabilities(type)
  const missingDefaults = typeDefaults.filter((key) => !keys.includes(key))

  function toggle(key: CapabilityKey) {
    setKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
    setError('')
    setJustSaved(null)
  }

  function reset() {
    setType(saved.type)
    setName(saved.name)
    setKeys(saved.capabilities)
    setExtras(saved.extras)
    setError('')
  }

  async function save() {
    if (name.trim().length < 2) { setError(fa ? 'نام کسب‌وکار را وارد کنید (حداقل ۲ نویسه).' : 'Enter a business name (2+ characters).'); return }
    if (!keys.length) { setError(fa ? 'حداقل یک قابلیت را روشن کنید.' : 'Turn on at least one capability.'); return }
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: type, businessName: name.trim(), capabilities: keys, extras, locale: fa ? 'fa' : 'en' }),
      })
      if (!response.ok) throw new Error()
      const result = await response.json().catch(() => ({})) as { vertical?: { titleFa?: string; titleEn?: string } }
      const modules = getDashboardModules(keys)
      const newlyEnabled = modules.filter((module) => !getDashboardModules(saved.capabilities).includes(module))
      const detail = {
        businessType: type,
        capabilities: keys,
        modules,
        newlyEnabled,
        verticalTitle: fa ? result.vertical?.titleFa : result.vertical?.titleEn,
        changedAt: Date.now(),
      }
      try { localStorage.setItem('vigent:vertical-change', JSON.stringify(detail)) } catch {}
      window.dispatchEvent(new CustomEvent('vigent:vertical-changed', { detail }))
      setJustSaved({ added, hidden, previousType: saved.type })
      setSaved({ type, name: name.trim(), capabilities: keys, extras })
      router.refresh()
    } catch {
      setError(fa ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.' : 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // Bring the confirmation into view: Save lives in the sticky bottom bar, so
  // the user is usually far below the summary card when the save lands.
  const savedPanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!justSaved) return
    const frame = window.requestAnimationFrame(() => {
      savedPanelRef.current?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [justSaved, reduceMotion])

  const Arrow = fa ? ArrowLeft : ArrowRight
  const SavedIcon = TYPE_ICONS[saved.type]
  const savedPack = getVerticalPack(saved.type)
  const operational = (nav: typeof nextNav) => nav.filter((item) => !CORE.has(item.key))

  return (
    <section id="settings-business-profile" className="scroll-mt-28 space-y-4">
      {/* Now — what the panel shows today */}
      <div className="spatial-surface rounded-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]">
            <SavedIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="ui-caption">{fa ? 'الان فعال است' : 'Active now'}</p>
            <h2 className="ui-h2 mt-0.5">{saved.name} <span className="font-normal text-[var(--text-muted)]">· {fa ? savedPack.titleFa : savedPack.titleEn}</span></h2>
          </div>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-bold text-[var(--text-secondary)]">{fa ? 'بخش‌های اختصاصی منوی شما' : 'Your dedicated menu sections'}</p>
          <div className="flex flex-wrap gap-1.5">
            {operational(savedNav).length ? operational(savedNav).map((item) => {
              const fresh = Boolean(justSaved?.added.includes(item.key))
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-xl border bg-white px-2.5 text-[12.5px] font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]',
                    fresh ? 'border-emerald-500/40 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]' : 'border-[var(--border-default)]',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />{label(item.key, saved.type)}
                  {fresh && <span className="rounded-full bg-emerald-600 px-1.5 py-px text-[12px] font-bold text-white">{fa ? 'جدید' : 'New'}</span>}
                </Link>
              )
            }) : (
              <span className="text-[12.5px] text-[var(--text-muted)]">{fa ? 'فقط بخش‌های پایه (بدون بخش اختصاصی).' : 'Core sections only.'}</span>
            )}
          </div>
          <p className="mt-2 text-[12.5px] leading-5 text-[var(--text-muted)]">
            {fa
              ? 'به‌علاوه بخش‌های پایه که همیشه هست: پیشخوان، ایجنت‌ها، گفتگوها، مشتریان، تحلیل، اتصال‌ها، اشتراک و تنظیمات.'
              : 'Plus the core sections every workspace has: overview, agents, conversations, contacts, analytics, integrations, billing and settings.'}
          </p>
        </div>
        <AnimatePresence>
          {justSaved && !dirty && (
            <motion.div
              ref={savedPanelRef}
              initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              role="status"
              className="mt-4 scroll-mt-28 overflow-hidden rounded-card border border-emerald-600/15 bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,0.96))] shadow-[0_18px_40px_-30px_rgba(5,150,105,0.55)]"
            >
              <div className="flex items-start gap-3 p-3.5 sm:p-4">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-[0_10px_22px_-10px_rgba(5,150,105,0.9)]">
                  {!reduceMotion && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-emerald-500/35 [animation-iteration-count:2]" />}
                  <Check className="relative h-5 w-5" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[14px] font-bold text-[var(--text-primary)]">{fa ? 'تغییرات ذخیره شد' : 'Changes saved'}</p>
                  <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-secondary)]">
                    {justSaved.added.length
                      ? (fa ? `${num(justSaved.added.length, fa)} بخش تازه به منوی پنل اضافه شد.` : `${justSaved.added.length} new section${justSaved.added.length > 1 ? 's' : ''} added to your menu.`)
                      : justSaved.hidden.length
                        ? (fa ? 'منوی پنل به‌روز شد.' : 'Your menu is updated.')
                        : (fa ? 'اطلاعات کسب‌وکار به‌روز شد؛ منوی پنل همان است.' : 'Business details updated; your menu is unchanged.')}
                  </p>
                </div>
                <button type="button" onClick={() => setJustSaved(null)} aria-label={fa ? 'بستن' : 'Dismiss'} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
              </div>

              {justSaved.added.length > 0 && (
                <div className="border-t border-emerald-600/10 p-2.5 sm:p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {justSaved.added.map((key, index) => {
                      const item = nextNav.find((navItem) => navItem.key === key)
                      if (!item) return null
                      return (
                        <motion.div
                          key={key}
                          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.12 + index * 0.06, duration: 0.24, ease: 'easeOut' }}
                        >
                          <Link
                            href={item.href}
                            className="spatial-press group flex min-h-[3.75rem] items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] hover:border-emerald-600/30 hover:shadow-[0_10px_24px_-18px_rgba(5,150,105,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]">
                              <item.icon className="h-[1.1rem] w-[1.1rem]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-bold text-[var(--text-primary)]">{label(key)}</span>
                              <span className="mt-0.5 flex items-center gap-1 text-[12.5px] font-medium text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {fa ? 'به منو اضافه شد' : 'Added to the menu'}
                              </span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">
                              {fa ? 'باز کردن' : 'Open'}
                              <Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
                            </span>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}

              {justSaved.hidden.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-emerald-600/10 px-3.5 py-2.5 text-[12.5px] text-[var(--text-muted)] sm:px-4">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-bold text-[var(--text-secondary)]">{fa ? 'پنهان شد:' : 'Hidden:'}</span>
                  {justSaved.hidden.map((key) => (
                    <span key={key} className="rounded-lg bg-black/[0.045] px-2 py-0.5 font-semibold text-[var(--text-secondary)]">{label(key, justSaved.previousType)}</span>
                  ))}
                  <span>{fa ? '· اطلاعاتش پاک نمی‌شود و با روشن‌کردن دوباره برمی‌گردد.' : '· Its data is kept and returns when you turn it back on.'}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-w-0 space-y-4">
          {/* Name */}
          <div className="spatial-surface rounded-card p-4 sm:p-5">
            <label htmlFor="business-name" className="ui-h3 block">{fa ? 'نام کسب‌وکار' : 'Business name'}</label>
            <p className="ui-caption mt-0.5">{fa ? 'ایجنت با همین نام خودش را معرفی می‌کند.' : 'The agent introduces itself with this name.'}</p>
            <input
              id="business-name"
              value={name}
              onChange={(event) => { setName(event.target.value); setError(''); setJustSaved(null) }}
              placeholder={fa ? 'مثلاً کلینیک زیبایی رز' : 'e.g. Rose Beauty Clinic'}
              className="input mt-3 min-h-12 w-full rounded-2xl text-sm"
            />
          </div>

          {/* Business type */}
          <div className="spatial-surface rounded-card p-4 sm:p-5">
            <h3 className="ui-h3">{fa ? 'نوع کسب‌وکار' : 'Business type'}</h3>
            <p className="ui-caption mt-0.5">{fa ? 'نوع کسب‌وکار لحن ایجنت و پیشنهادها را تعیین می‌کند. بخش‌های منو فقط با قابلیت‌های پایین روشن و خاموش می‌شوند.' : 'The type shapes the agent’s tone and suggestions. Menu sections follow only the capabilities below.'}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {BUSINESS_TYPES.map((value) => {
                const item = getVerticalPack(value)
                const Icon = TYPE_ICONS[value]
                const selected = type === value
                const current = saved.type === value
                const defaults = item.defaultCapabilities
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setType(value)
                      // Nothing picked yet: start from this type's defaults.
                      if (!keys.length) setKeys(getDefaultCapabilities(value))
                      setError('')
                      setJustSaved(null)
                    }}
                    className={cn(
                      'relative flex min-h-[4.75rem] items-start gap-3 rounded-2xl border p-3 text-start transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                      selected ? 'border-[var(--text-primary)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]' : 'border-[var(--border-default)] bg-white hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors', selected ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]')}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-bold text-[var(--text-primary)]">{fa ? item.titleFa : item.titleEn}</span>
                        {current && <span className="rounded-full bg-[var(--text-primary)] px-2 py-0.5 text-[12px] font-bold text-white">{fa ? 'فعلی' : 'Current'}</span>}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-5 text-[var(--text-muted)]">
                        {defaults.length
                          ? (fa ? `پیش‌فرض: ${defaults.map((key) => capabilityLabel(key, 'fa')).join('، ')}` : `Default: ${defaults.map((key) => capabilityLabel(key, 'en')).join(', ')}`)
                          : (fa ? 'بدون پیش‌فرض؛ قابلیت‌ها را خودتان انتخاب کنید' : 'No defaults; pick your capabilities')}
                      </span>
                    </span>
                    {selected && <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--text-primary)]" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
            {type !== saved.type && missingDefaults.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-[var(--text-secondary)]">
                  {fa
                    ? `قابلیت پیش‌فرض «${fa ? pack.titleFa : pack.titleEn}» هنوز خاموش است: ${missingDefaults.map((key) => `«${capabilityLabel(key, 'fa')}»`).join('، ')}.`
                    : `This type’s default is still off: ${missingDefaults.map((key) => capabilityLabel(key, 'en')).join(', ')}.`}
                </p>
                <button
                  type="button"
                  onClick={() => { setKeys((current) => [...current, ...missingDefaults.filter((key) => !current.includes(key))]); setJustSaved(null) }}
                  className="spatial-press inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3.5 text-xs font-bold text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  {fa ? 'روشن کن' : 'Turn on'}
                </button>
              </div>
            )}
          </div>

          {/* Capabilities */}
          <div className="spatial-surface rounded-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="ui-h3">{fa ? 'قابلیت‌ها' : 'Capabilities'}</h3>
                <p className="ui-caption mt-0.5">{fa ? 'هر کدام را روشن کنید، بخشش به منو اضافه می‌شود و ایجنت هم از آن استفاده می‌کند. خاموش که باشد، ایجنت هم سراغش نمی‌رود.' : 'Each one adds its section and lets the agent use it. Off means the agent leaves it alone too.'}</p>
              </div>
              <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[12.5px] font-bold tabular-nums text-[var(--text-secondary)]">
                {fa ? `${num(keys.length, fa)} روشن` : `${keys.length} on`}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
              {options.map((option) => {
                const on = keys.includes(option.key)
                const Icon = OPTION_ICONS[option.key] ?? Sparkles
                // Same folding as the real menu: services live inside bookings.
                const sections = collapseDashboardNavigationModules(option.modules).filter((module) => !CORE.has(module))
                const recommended = option.recommendedFor.includes(type)
                const isDefault = typeDefaults.includes(option.key)
                // Off here, but another capability still brings the section.
                const keptBy = on ? [] : sections.flatMap((module) => capabilitiesBringingModule(module, keys, option.key))
                // Setup state is about saved data, so only show it for a
                // capability that is on both here and in the saved profile.
                const status = on && saved.capabilities.includes(option.key) ? readiness?.[option.key] : undefined
                return (
                  <li key={option.key}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggle(option.key)}
                      className={cn('flex w-full items-start gap-3 p-3 text-start transition-colors sm:p-3.5', on ? 'bg-[var(--bg-surface)]' : 'hover:bg-[var(--bg-hover)]')}
                    >
                      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors', on ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]')}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-bold text-[var(--text-primary)]">{fa ? option.fa : option.en}</span>
                          {isDefault
                            ? <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[12px] font-bold text-[var(--text-secondary)]">{fa ? 'پیش‌فرض این نوع' : 'Type default'}</span>
                            : recommended && <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[12px] font-bold text-[var(--text-secondary)]">{fa ? 'پیشنهادی' : 'Suggested'}</span>}
                          {status && <ReadinessBadge state={status.state} fa={fa} />}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-5 text-[var(--text-muted)]">{fa ? option.descriptionFa : option.descriptionEn}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] text-[var(--text-muted)]">
                          {sections.length ? (
                            <>
                              <span>{fa ? 'در منو:' : 'Menu:'}</span>
                              {sections.map((module) => (
                                <span key={module} className="rounded-md bg-black/[0.04] px-1.5 py-0.5 font-medium text-[var(--text-secondary)]">{label(module)}</span>
                              ))}
                              {keptBy.length > 0 && (
                                <span className="text-[var(--text-hint)]">
                                  {fa
                                    ? `· همراه «${[...new Set(keptBy)].map((key) => capabilityLabel(key, 'fa')).join('» و «')}» در منو می‌ماند`
                                    : `· stays in the menu with ${[...new Set(keptBy)].map((key) => capabilityLabel(key, 'en')).join(' and ')}`}
                                </span>
                              )}
                            </>
                          ) : (
                            <span>{fa ? 'بدون بخش جدا؛ در رفتار ایجنت اثر دارد' : 'No separate section; shapes the agent'}</span>
                          )}
                        </span>
                      </span>
                      <span aria-hidden className={cn('relative mt-1.5 h-6 w-11 shrink-0 rounded-full border transition-colors', on ? 'border-[var(--text-primary)] bg-[var(--text-primary)]' : 'border-[var(--border-hover)] bg-[var(--bg-muted)]')}>
                        <span className={cn('absolute top-0.5 h-[1.125rem] w-[1.125rem] rounded-full bg-white shadow transition-[inset-inline-start] duration-150', on ? 'start-[1.375rem]' : 'start-0.5')} />
                      </span>
                    </button>
                    {status?.state === 'setup' && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 pb-3 pt-2 ps-[3.75rem] sm:px-3.5 sm:ps-[4rem]">
                        <ul className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
                          {status.steps.map((step) => (
                            <li key={step.key} className={cn('inline-flex items-center gap-1 text-[12px]', step.done ? 'text-[var(--text-muted)]' : 'font-semibold text-[var(--text-primary)]')}>
                              {step.done ? <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} /> : <CircleDashed className="h-3.5 w-3.5 text-amber-600" />}
                              {fa ? step.fa : step.en}
                            </li>
                          ))}
                        </ul>
                        {status.next && (
                          <Link href={status.next.href} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--border-default)] bg-white px-3 text-[12px] font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]">
                            {fa ? 'ادامه راه‌اندازی' : 'Continue setup'}
                            <Arrow className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {extras.length > 0 && (
              <div className="mt-3">
                <p className="text-[12.5px] font-bold text-[var(--text-secondary)]">{fa ? 'موارد ثبت‌شده قبلی' : 'Earlier entries'}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {extras.map((extra) => (
                    <span key={extra} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--border-default)] bg-white ps-2.5 pe-1 text-[12px] text-[var(--text-secondary)]">
                      {extra}
                      <button type="button" onClick={() => { setExtras((items) => items.filter((item) => item !== extra)); setJustSaved(null) }} aria-label={fa ? `حذف ${extra}` : `Remove ${extra}`} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[var(--bg-hover)]"><X className="h-3.5 w-3.5" /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p>}

      {/* Save bar — only while something changed */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            // Marks a sticky action dock — the global back-to-top button hides.
            data-sticky-actions=""
            className="sticky z-30 [bottom:calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-4"
          >
            <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--border-default)] bg-white/95 p-3 shadow-[var(--elev-2)] backdrop-blur sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 text-[12px] leading-5">
                <p className="font-bold text-[var(--text-primary)]">{fa ? 'تغییرات ذخیره نشده' : 'Unsaved changes'}</p>
                <p className="truncate text-[var(--text-muted)]">
                  {added.length || hidden.length
                    ? [
                        added.length ? `${fa ? 'اضافه:' : 'Adds:'} ${added.map((key) => label(key)).join(fa ? '، ' : ', ')}` : '',
                        hidden.length ? `${fa ? 'پنهان:' : 'Hides:'} ${hidden.map((key) => label(key, saved.type)).join(fa ? '، ' : ', ')}` : '',
                      ].filter(Boolean).join(' · ')
                    : (fa ? 'منوی پنل تغییری نمی‌کند.' : 'The menu stays the same.')}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={reset} disabled={saving} className="min-h-11 flex-1 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] sm:flex-none">
                  {fa ? 'برگرداندن' : 'Discard'}
                </button>
                <button type="button" onClick={() => void save()} disabled={saving} className="spatial-press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] disabled:opacity-60 sm:flex-none">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {fa ? 'ذخیره' : 'Save'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function num(value: number, fa: boolean) {
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

export function ReadinessBadge({ state, fa }: { state: 'off' | 'setup' | 'ready'; fa: boolean }) {
  if (state === 'off') return null
  return state === 'ready' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[12px] font-bold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {fa ? 'آماده' : 'Ready'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[12px] font-bold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {fa ? 'در حال راه‌اندازی' : 'Setting up'}
    </span>
  )
}
