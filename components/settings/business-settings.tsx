'use client'

import { SwitchTrack } from '@/components/ui/switch'
import { SaveButton, useSaveState } from '@/components/ui/save-button'
import { useEffect, useMemo, useState } from 'react'
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
  GraduationCap,
  Headphones,
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
import { type VerticalChangeDetail } from '@/components/dashboard/vertical-change-notice'
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
  const saveState = useSaveState()
  const saving = saveState.saving
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState<{ added: DashboardModuleKey[]; hidden: DashboardModuleKey[]; previousType: BusinessTypeValue; renamedTo?: string } | null>(null)

  const savedNav = useMemo(() => getDashboardNavForProfile(saved.capabilities), [saved])

  // Capabilities save the moment they are switched; only the name, the type
  // and earlier free-text entries wait for the save bar.
  const dirty = type !== saved.type
    || name.trim() !== saved.name
    || !sameSet(extras, saved.extras)
  const [pendingKey, setPendingKey] = useState<CapabilityKey | null>(null)
  const [typeOpen, setTypeOpen] = useState(false)

  const label = (module: DashboardModuleKey, businessType: BusinessTypeValue = type) =>
    getDashboardModuleLabel(module, businessType, locale, t(module))

  const options = useMemo(() => getBusinessServiceOptions(type), [type])
  const pack = getVerticalPack(type)
  const typeDefaults = getDefaultCapabilities(type)
  const missingDefaults = typeDefaults.filter((key) => !keys.includes(key))

  async function persist(next: Saved, undoOf?: CapabilityKey[]): Promise<boolean> {
    const response = await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessType: next.type, businessName: next.name, capabilities: next.capabilities, extras: next.extras, locale: fa ? 'fa' : 'en' }),
    })
    if (!response.ok) return false
    const result = await response.json().catch(() => ({})) as { vertical?: { titleFa?: string; titleEn?: string } }
    const before = getDashboardNavForProfile(saved.capabilities)
    const after = getDashboardNavForProfile(next.capabilities)
    const beforeKeys = new Set(before.map((item) => item.key))
    const afterKeys = new Set(after.map((item) => item.key))
    const addedNow = after.filter((item) => !beforeKeys.has(item.key))
    const hiddenNow = before.filter((item) => !afterKeys.has(item.key))
    const modules = getDashboardModules(next.capabilities)
    const detail = {
      businessType: next.type,
      capabilities: next.capabilities,
      modules,
      newlyEnabled: modules.filter((module) => !getDashboardModules(saved.capabilities).includes(module)),
      added: addedNow.map((item) => ({ key: item.key, label: label(item.key, next.type), href: item.href })),
      hidden: hiddenNow.map((item) => label(item.key, saved.type)),
      typeChanged: next.type !== saved.type,
      renamedTo: next.name !== saved.name ? next.name : undefined,
      verticalTitle: fa ? result.vertical?.titleFa : result.vertical?.titleEn,
      // A capability switch can be taken back from the toast.
      undoCapabilities: undoOf,
      changedAt: Date.now(),
    } satisfies VerticalChangeDetail
    try { localStorage.setItem('vigent:vertical-change', JSON.stringify(detail)) } catch {}
    window.dispatchEvent(new CustomEvent('vigent:vertical-changed', { detail }))
    setJustSaved({ added: addedNow.map((item) => item.key), hidden: hiddenNow.map((item) => item.key), previousType: saved.type, renamedTo: detail.renamedTo })
    setSaved(next)
    router.refresh()
    return true
  }

  // Switching a capability saves at once; the toast offers to take it back.
  async function toggle(key: CapabilityKey) {
    if (pendingKey) return
    const previous = saved.capabilities
    const nextKeys = keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]
    if (!nextKeys.length) { setError(fa ? 'حداقل یک قابلیت باید روشن بماند.' : 'At least one capability must stay on.'); return }
    setError('')
    setKeys(nextKeys)
    setPendingKey(key)
    try {
      const ok = await persist({ ...saved, capabilities: nextKeys }, previous)
      if (!ok) throw new Error()
    } catch {
      setKeys(previous)
      setError(fa ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.' : 'Could not save. Try again.')
    } finally {
      setPendingKey(null)
    }
  }

  // "برگرداندن" in the toast hands the earlier capability set back here.
  useEffect(() => {
    function onUndo(event: Event) {
      const previous = (event as CustomEvent<CapabilityKey[]>).detail
      if (!Array.isArray(previous) || !previous.length) return
      setKeys(previous)
      void persist({ ...saved, capabilities: previous })
    }
    window.addEventListener('vigent:vertical-undo', onUndo)
    return () => window.removeEventListener('vigent:vertical-undo', onUndo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved])

  function reset() {
    setType(saved.type)
    setName(saved.name)
    setExtras(saved.extras)
    setError('')
  }

  async function save() {
    if (name.trim().length < 2) { setError(fa ? 'نام کسب‌وکار را وارد کنید (حداقل ۲ نویسه).' : 'Enter a business name (2+ characters).'); return }
    saveState.start()
    setError('')
    try {
      const ok = await persist({ type, name: name.trim(), capabilities: keys, extras })
      if (!ok) throw new Error()
      saveState.done()
      setTypeOpen(false)
    } catch {
      saveState.fail()
      setError(fa ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.' : 'Could not save. Try again.')
    }
  }

  const Arrow = fa ? ArrowLeft : ArrowRight
  const SavedIcon = TYPE_ICONS[saved.type]
  const savedPack = getVerticalPack(saved.type)
  const operational = (nav: typeof savedNav) => nav.filter((item) => !CORE.has(item.key))

  return (
    <section id="settings-business-profile" className="scroll-mt-28 space-y-4">
      {/* Now — what the panel shows today */}
      <div className="settings-identity spatial-surface rounded-card p-4 sm:p-5">
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
                    'inline-flex min-h-9 items-center gap-1.5 rounded-xl border bg-white px-2.5 text-[13px] font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]',
                    fresh ? 'border-emerald-500/40 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]' : 'border-[var(--border-default)]',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />{label(item.key, saved.type)}
                  {fresh && <span className="rounded-full bg-emerald-600 px-1.5 py-px text-[12px] font-bold text-white">{fa ? 'جدید' : 'New'}</span>}
                </Link>
              )
            }) : (
              <span className="text-[13px] text-[var(--text-muted)]">{fa ? 'فقط بخش‌های پایه (بدون بخش اختصاصی).' : 'Core sections only.'}</span>
            )}
          </div>
          <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
            {fa
              ? 'به‌علاوه بخش‌های پایه که همیشه هست: پیشخوان، ایجنت‌ها، گفتگوها، مشتریان، تحلیل، اتصال‌ها، اشتراک و تنظیمات.'
              : 'Plus the core sections every workspace has: overview, agents, conversations, contacts, analytics, integrations, billing and settings.'}
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
          {/* Name and type: two rows; the eight types open only when asked for. */}
          <div className="settings-identity spatial-surface divide-y divide-[var(--border-subtle)] rounded-card px-4 sm:px-5">
            <div className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4">
              <div>
                <label htmlFor="business-name" className="ui-h3 block">{fa ? 'نام کسب‌وکار' : 'Business name'}</label>
                <p className="ui-caption mt-0.5">{fa ? 'ایجنت با همین نام خودش را معرفی می‌کند.' : 'The agent introduces itself with this name.'}</p>
              </div>
              <input
                id="business-name"
                value={name}
                onChange={(event) => { setName(event.target.value); setError(''); setJustSaved(null) }}
                placeholder={fa ? 'مثلاً کلینیک زیبایی رز' : 'e.g. Rose Beauty Clinic'}
                className="input min-h-12 w-full text-sm"
              />
            </div>
            <div className="py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[10rem] flex-1">
                  <h3 className="ui-h3">{fa ? 'نوع کسب‌وکار' : 'Business type'}</h3>
                  <p className="ui-caption mt-0.5">{fa ? 'لحن ایجنت و پیشنهادها را تعیین می‌کند.' : 'Shapes the agent’s tone and suggestions.'}</p>
                </div>
                <span className="text-[13px] font-bold text-[var(--text-primary)]">{fa ? pack.titleFa : pack.titleEn}</span>
                <button
                  type="button"
                  onClick={() => setTypeOpen((value) => !value)}
                  aria-expanded={typeOpen}
                  aria-controls="business-type-options"
                  className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] bg-white px-3.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
                >
                  {typeOpen ? (fa ? 'بستن' : 'Close') : (fa ? 'تغییر' : 'Change')}
                </button>
              </div>
              {(typeOpen || type !== saved.type) && (
                <div id="business-type-options">
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
                          <span className="mt-0.5 block text-[13px] leading-5 text-[var(--text-muted)]">
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
                    <p className="min-w-0 flex-1 text-[13px] leading-5 text-[var(--text-secondary)]">
                      {fa
                        ? `قابلیت پیش‌فرض «${fa ? pack.titleFa : pack.titleEn}» هنوز خاموش است: ${missingDefaults.map((key) => `«${capabilityLabel(key, 'fa')}»`).join('، ')}.`
                        : `This type’s default is still off: ${missingDefaults.map((key) => capabilityLabel(key, 'en')).join(', ')}.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => { const nextKeys = [...keys, ...missingDefaults.filter((key) => !keys.includes(key))]; setKeys(nextKeys); void persist({ ...saved, capabilities: nextKeys }, saved.capabilities) }}
                      className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3.5 text-xs font-bold text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {fa ? 'روشن کن' : 'Turn on'}
                    </button>
                  </div>
                )}

                </div>
              )}
            </div>
          </div>

          {/* Capabilities */}
          <div className="settings-capabilities spatial-surface rounded-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="ui-h3">{fa ? 'قابلیت‌ها' : 'Capabilities'}</h3>
                <p className="ui-caption mt-0.5">{fa ? 'روشن یعنی بخشش در منو می‌آید و ایجنت هم از آن استفاده می‌کند. هر تغییر همان لحظه ذخیره می‌شود.' : 'On adds its section and lets the agent use it. Every change saves at once.'}</p>
              </div>
              <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[13px] font-bold tabular-nums text-[var(--text-secondary)]">
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
                      aria-busy={pendingKey === option.key || undefined}
                      disabled={pendingKey !== null}
                      onClick={() => void toggle(option.key)}
                      className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-wait sm:px-3.5"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn('text-[13px] font-bold', on ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>{fa ? option.fa : option.en}</span>
                          {/* "Ready" is the normal state and says nothing; only unfinished setup is flagged. */}
                          {status?.state === 'setup' && <ReadinessBadge state="setup" fa={fa} />}
                          {!on && (isDefault || recommended) && <span className="text-[12px] text-[var(--text-muted)]">{fa ? 'پیشنهادی' : 'Suggested'}</span>}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-5 text-[var(--text-muted)]">
                          {fa ? option.descriptionFa : option.descriptionEn}
                          {sections.length
                            ? ` · ${fa ? 'در منو:' : 'Menu:'} ${sections.map((module) => label(module)).join(fa ? '، ' : ', ')}`
                            : ` · ${fa ? 'بدون بخش جدا' : 'No separate section'}`}
                          {keptBy.length > 0 && (fa
                            ? ` (همراه «${[...new Set(keptBy)].map((key) => capabilityLabel(key, 'fa')).join('» و «')}» می‌ماند)`
                            : ` (stays with ${[...new Set(keptBy)].map((key) => capabilityLabel(key, 'en')).join(' and ')})`)}
                        </span>
                      </span>
                      <SwitchTrack checked={on} pending={pendingKey === option.key} />
                    </button>
                    {status?.state === 'setup' && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 pb-3 ps-[3.75rem] sm:px-3.5 sm:ps-[4rem]">
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
                <p className="text-[13px] font-bold text-[var(--text-secondary)]">{fa ? 'موارد ثبت‌شده قبلی' : 'Earlier entries'}</p>
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

      {/* Save bar — while something changed, and for the moment it confirms the save */}
      <AnimatePresence>
        {(dirty || saveState.saved) && (
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
                <p className="truncate text-[var(--text-muted)]">{fa ? 'نام یا نوع کسب‌وکار' : 'Business name or type'}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={reset} disabled={saving || saveState.saved} className="min-h-11 flex-1 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] sm:flex-none">
                  {fa ? 'برگرداندن' : 'Discard'}
                </button>
                <SaveButton state={saveState.state} onClick={() => void save()} className="flex-1 sm:flex-none" />
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
