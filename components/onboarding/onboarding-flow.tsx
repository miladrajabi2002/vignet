'use client'

import { useLocale } from 'next-intl'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  Briefcase,
  CalendarDays,
  Camera,
  Check,
  CircleAlert,
  GraduationCap,
  Headphones,
  Copy,
  FileText,
  Loader2,
  PencilLine,
  Plus,
  Settings2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Utensils,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CapabilityOptions } from '@/components/onboarding/capability-options'
import { GoalPicker } from '@/components/agents/goal-picker'
import { Switch } from '@/components/ui/switch'
import { StoreAccessPrompt } from '@/components/agents/store-access-prompt'
import { getBusinessGoals } from '@/lib/ai/prompt-builder'
import { WooConnectWizard } from '@/components/onboarding/woo-connect-wizard'
import { ChannelMark, type ChannelKey } from '@/components/ui/channel-mark'
import {
  BUSINESS_TYPES,
  getVerticalPack,
  getBusinessServiceOptions,
  getDefaultCapabilities,
  type BusinessTypeValue,
  type CapabilityKey,
} from '@/lib/verticals/registry'
import type { BusinessProfile } from '@/lib/verticals/profile'

// ─── Icons per business type ────────────────────────────────────
const ICONS: Record<BusinessTypeValue, LucideIcon> = {
  COMMERCE: ShoppingBag,
  FOOD: Utensils,
  APPOINTMENTS: CalendarDays,
  SERVICES: Briefcase,
  EDUCATION: GraduationCap,
  SUPPORT: Headphones,
  SOCIAL: Camera,
  CUSTOM: Settings2,
}

// ─── Animation variants ─────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1] as const

const stepVariants: Variants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 32 : -32,
    scale: 0.98,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -32 : 32,
    scale: 0.98,
  }),
}

const staggerParent: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
}

// ─── Phase definitions ──────────────────────────────────────────
type Phase = 'type' | 'details' | 'agent' | 'knowledge' | 'channel' | 'done'

// ─── Main component ─────────────────────────────────────────────
interface Props {
  hasProfile: boolean
  hasAgent: boolean
  hasKnowledge: boolean
  hasChannel: boolean
  agentId: string | null
  businessType: string | null
  businessProfile: BusinessProfile | null
  agentTemplate?: string
  /** Name, greeting and pre-chat form default the recommended template would give the agent. */
  agentPreset: { name: string; welcomeMessage: string; requireCustomerInfo: boolean }
}

export function OnboardingFlow({
  hasProfile,
  hasAgent,
  hasKnowledge,
  hasChannel,
  agentId,
  businessType,
  businessProfile,
  agentTemplate,
  agentPreset,
}: Props) {
  const fa = useLocale() !== 'en'
  const router = useRouter()
  const phaseContentRef = useRef<HTMLDivElement>(null)
  const [direction, setDirection] = useState(1)
  const [phaseOverride, setPhaseOverride] = useState<Phase | null>(null)
  const [detailsFromTypeSelection, setDetailsFromTypeSelection] = useState(false)
  const [resolvedAgentId, setResolvedAgentId] = useState(agentId)
  const [draftBusinessType, setDraftBusinessType] = useState<BusinessTypeValue | null>(
    hasProfile ? businessType as BusinessTypeValue : null,
  )
  // Set to true when the user just successfully connected WooCommerce via
  // the in-onboarding wizard. Drives the "با موفقیت سایت شما به ویجنت وصل شد"
  // success banner shown on the channel step. Reset when the user advances
  // past the channel step.
  const [wooJustConnected, setWooJustConnected] = useState(false)

  // Determine current phase from server state
  const serverPhase: Phase = (() => {
    if (!hasProfile) return 'type'
    if (!hasAgent) return 'agent'
    if (!hasKnowledge) return 'knowledge'
    if (!hasChannel) return 'channel'
    return 'done'
  })()
  const currentPhase = phaseOverride ?? serverPhase

  useEffect(() => {
    setPhaseOverride(null)
  }, [serverPhase])

  useEffect(() => {
    setResolvedAgentId(agentId)
  }, [agentId])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const frame = window.requestAnimationFrame(() => {
      phaseContentRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [currentPhase])

  // Poll for state updates when user completes an external CTA
  useEffect(() => {
    if (currentPhase === 'done' || currentPhase === 'type' || currentPhase === 'details') return
    const interval = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(interval)
  }, [currentPhase, router])

  return (
    <div className="relative bg-[var(--bg-base)]">
      {/* ─── Ambient background ─── */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-0 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[var(--bg-surface)] opacity-60 blur-3xl" />
      </div>

      {/* ─── Step content ─── */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col px-4 py-5 sm:justify-center sm:px-8 lg:overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            ref={phaseContentRef}
            key={currentPhase}
            tabIndex={-1}
            className="outline-none"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: EASE }}
          >
            {currentPhase === 'type' && (
              <TypeStep
                selectedType={draftBusinessType}
                onSelect={(type) => {
                  setDirection(1)
                  setDraftBusinessType(type)
                  setDetailsFromTypeSelection(true)
                  setPhaseOverride('details')
                }}
              />
            )}

            {currentPhase === 'details' && (
              <DetailsStep
                initialType={draftBusinessType ?? businessType as BusinessTypeValue}
                initialProfile={detailsFromTypeSelection ? null : businessProfile}
                onBack={() => { setDirection(-1); setPhaseOverride('type') }}
                onNext={() => {
                  setDirection(1)
                  setDetailsFromTypeSelection(false)
                  setPhaseOverride('agent')
                  router.refresh()
                }}
              />
            )}

            {currentPhase === 'agent' && (
              <AgentStep
                done={hasAgent}
                businessType={draftBusinessType ?? businessType}
                businessLabel={getVerticalPack(draftBusinessType ?? businessType).titleFa}
                preset={agentPreset}
                website={businessProfile?.website}
                customHref={agentTemplate ? `/agents/new?business=${agentTemplate}&onboarding=1` : '/agents/new?onboarding=1'}
                onBack={() => { setDirection(-1); setPhaseOverride('details') }}
                onContinue={() => { setDirection(1); setPhaseOverride('knowledge') }}
                onCreated={(createdAgentId) => {
                  setDirection(1)
                  setResolvedAgentId(createdAgentId)
                  setPhaseOverride('knowledge')
                  router.refresh()
                }}
              />
            )}

            {currentPhase === 'knowledge' && (
              <KnowledgeStep
                done={hasKnowledge}
                agentId={resolvedAgentId}
                sellsProducts={businessProfile?.capabilities.includes('products') ?? true}
                onSaved={() => { router.refresh() }}
                onBack={() => { setDirection(-1); setPhaseOverride('agent') }}
                onContinue={() => { setDirection(1); setPhaseOverride('channel') }}
                onWooConnected={() => {
                  // Woo was just connected — set the flag so the channel
                  // step shows the success banner.
                  setDirection(1)
                  setWooJustConnected(true)
                  setPhaseOverride('channel')
                }}
                onSkip={async () => {
                  await skipSetupStep('SKIP_KNOWLEDGE', router)
                  setDirection(1)
                  setPhaseOverride('channel')
                }}
              />
            )}

            {currentPhase === 'channel' && (
              <ChannelStep
                agentId={resolvedAgentId}
                instagramFirst={businessType === 'SOCIAL'}
                done={hasChannel}
                successBanner={wooJustConnected ? (fa ? 'با موفقیت سایت شما به ویجنت وصل شد' : 'Your site is now connected to Vigent') : undefined}
                onLinkCreated={() => { router.refresh() }}
                onSkip={async () => {
                  await skipSetupStep('SKIP_CHANNEL', router)
                  setDirection(1)
                  setPhaseOverride('done')
                }}
                onBack={() => { setDirection(-1); setWooJustConnected(false); setPhaseOverride('knowledge') }}
                onContinue={() => { setDirection(1); setWooJustConnected(false); setPhaseOverride('done') }}
              />
            )}

            {currentPhase === 'done' && <DoneStep agentId={resolvedAgentId} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Shared step heading ────────────────────────────────────────
// The step bar above already names the step, so the heading is just the
// question and one line of help — no icon tile pushing the form down.
function StepHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <motion.div variants={staggerChild} className="text-center">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] text-balance sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p> : null}
    </motion.div>
  )
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)]"
    >
      <ArrowLeft className="h-4 w-4 rotate-180" />
      {label}
    </button>
  )
}

function SkipLink({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {label}
      {!busy && <ArrowLeft className="h-4 w-4" />}
    </button>
  )
}

const PRIMARY_BTN = 'spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-6 text-[13px] font-semibold text-white shadow-[var(--shadow-control)] hover:bg-black'
const ROW_BTN_DARK = 'spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3.5 text-[12px] font-semibold text-white shadow-[var(--shadow-control)] hover:bg-black disabled:cursor-wait'
const ROW_BTN_LIGHT = 'spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3.5 text-[12px] font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:cursor-wait'

// ─── Step 1: Choose business type ───────────────────────────────
function TypeStep({
  selectedType,
  onSelect,
}: {
  selectedType: BusinessTypeValue | null
  onSelect: (type: BusinessTypeValue) => void
}) {
  const fa = useLocale() !== 'en'
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show">
      <StepHeading
        title={fa ? 'کسب‌وکار شما چیست؟' : 'What is your business?'}
        subtitle={fa ? 'نوع کسب‌وکار خود را انتخاب کنید تا ویژگی‌های مناسب شما فعال شود' : 'Pick your business type so the right features are turned on'}
      />

      {/* Two short columns on phones so all eight fit one screen. */}
      <motion.div variants={staggerChild} className="mx-auto mt-5 grid max-w-4xl grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-4">
        {BUSINESS_TYPES.map((type) => {
          const pack = getVerticalPack(type)
          const Icon = ICONS[type]
          const active = selectedType === type
          return (
            <motion.button
              key={type}
              variants={staggerChild}
              type="button"
              onClick={() => onSelect(type)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
              aria-pressed={active}
              className={cn(
                'spatial-press group relative overflow-hidden rounded-card border bg-white p-3 text-start transition-colors duration-200 sm:p-4',
                active
                  ? 'border-[var(--text-primary)]'
                  : 'border-[var(--border-default)] hover:border-[var(--border-hover)]',
              )}
              style={{ boxShadow: active ? 'var(--shadow-lift)' : 'var(--shadow-card)' }}
            >
              <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
                <span className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-200 sm:h-10 sm:w-10',
                  active ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]',
                )}>
                  {active ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.5} />}
                </span>
                <span className="text-[13px] font-bold leading-6 text-[var(--text-primary)] sm:text-[15px]">
                  {fa ? pack.titleFa : pack.titleEn ?? pack.titleFa}
                </span>
              </span>
              <span className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-[var(--text-muted)]">
                {fa ? pack.descriptionFa : pack.descriptionEn ?? pack.descriptionFa}
              </span>
            </motion.button>
          )
        })}
      </motion.div>
    </motion.div>
  )
}

// ─── Step 2: Name, optional site and capabilities ───────────────
function DetailsStep({
  initialType,
  initialProfile,
  onBack,
  onNext,
}: {
  initialType: BusinessTypeValue
  initialProfile: BusinessProfile | null
  onBack: () => void
  onNext: () => void
}) {
  const fa = useLocale() !== 'en'
  const pack = getVerticalPack(initialType)
  const suggestions = getBusinessServiceOptions(initialType)
  const [businessName, setBusinessName] = useState(initialProfile?.businessName ?? '')
  const [website, setWebsite] = useState(initialProfile?.website ?? '')
  // The type only pre-fills a starting set; every one of them can be
  // switched off here or later in settings.
  const [capabilities, setCapabilities] = useState<CapabilityKey[]>(
    () => initialProfile?.capabilities ?? getDefaultCapabilities(initialType),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nameInvalid, setNameInvalid] = useState(false)
  const businessNameRef = useRef<HTMLInputElement>(null)
  const reduceMotion = useReducedMotion()

  async function save() {
    if (businessName.trim().length < 2) {
      setNameInvalid(true)
      setError('')
      requestAnimationFrame(() => {
        const field = businessNameRef.current
        field?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
        field?.focus({ preventScroll: true })
      })
      return
    }
    setNameInvalid(false)
    if (capabilities.length === 0) {
      setError((fa ? 'حداقل یک قابلیت را انتخاب کنید' : 'Choose at least one capability'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType: initialType,
          businessName: businessName.trim(),
          capabilities,
          extras: initialProfile?.extras ?? [],
          website: website.trim(),
          locale: fa ? 'fa' : 'en',
        }),
      })
      if (!res.ok) throw new Error()
      onNext()
    } catch {
      setError((fa ? 'ذخیره ناموفق بود، دوباره تلاش کنید' : 'Could not save. Try again'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show">
      <StepHeading
        title={fa ? 'اطلاعات کسب‌وکار' : 'Business details'}
        subtitle={(
          <>
            {fa ? pack.titleFa : pack.titleEn ?? pack.titleFa}
            {' · '}
            <button type="button" onClick={onBack} className="font-medium text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]">
              {fa ? 'تغییر' : 'Change'}
            </button>
          </>
        )}
      />

      <motion.div variants={staggerChild} className="mx-auto mt-6 max-w-lg space-y-5">
        <div>
          <label
            htmlFor="business-name"
            className={cn('ui-field-label', nameInvalid && 'text-red-600')}
          >
            {fa ? 'نام کسب‌وکار' : 'Business name'}
          </label>
          <input
            ref={businessNameRef}
            id="business-name"
            value={businessName}
            onChange={(e) => {
              const nextName = e.target.value
              setBusinessName(nextName)
              if (nameInvalid) setNameInvalid(nextName.trim().length < 2)
              setError('')
            }}
            placeholder={fa ? 'مثلاً فروشگاه رزین‌مهر' : 'e.g. Rose Garden Shop'}
            required
            aria-invalid={nameInvalid}
            aria-describedby={nameInvalid ? 'business-name-error' : undefined}
            className={cn(
              'input min-h-12 text-[15px] transition-[border-color,box-shadow,background-color]',
              nameInvalid && 'border-red-500 bg-red-50/40 ring-4 ring-red-500/10 focus:border-red-500 focus:ring-red-500/15',
            )}
            autoFocus
          />
          {nameInvalid && (
            <p
              id="business-name-error"
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-[12px] font-medium leading-5 text-red-600"
            >
              <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
              {businessName.trim().length === 0
                ? (fa ? 'این فیلد خالی است؛ لطفاً نام کسب‌وکار را وارد کنید.' : 'This field is empty. Enter your business name.')
                : (fa ? 'نام کسب‌وکار باید حداقل دو حرف داشته باشد.' : 'The business name needs at least two characters.')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="business-website" className="ui-field-label">
            {fa ? 'سایت یا پیج اینستاگرام' : 'Website or Instagram page'}
            <span className="ui-field-opt">{fa ? 'اختیاری' : 'Optional'}</span>
          </label>
          <input
            id="business-website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="instagram.com/yourshop"
            inputMode="url"
            dir="ltr"
            maxLength={300}
            className="input min-h-12 text-start text-[15px] placeholder:text-end"
          />
          <p className="ui-field-hint">
            {fa ? 'اگر نشانی سایت باشد، ایجنت معرفی و راه تماس را از همان صفحه می‌خواند.' : 'If this is a website, the agent reads your intro and contact details from that page.'}
          </p>
        </div>

        <CapabilityOptions
          options={suggestions}
          selected={capabilities}
          businessType={initialType}
          locale={fa ? 'fa' : 'en'}
          title={fa ? 'ایجنت چه کارهایی انجام بدهد؟' : 'What should the agent do?'}
          hint={fa ? 'هر قابلیت را بعداً هم می‌توانید از تنظیمات روشن یا خاموش کنید.' : 'You can switch any of these on or off later in Settings.'}
          onToggle={(key) => {
            setCapabilities((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
            setError('')
          }}
        />

        {error && (
          <p role="alert" className="text-[13px] text-[var(--red)]">{error}</p>
        )}

        {/* Stays in reach however long the capability list gets. */}
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white/95 p-2 shadow-[var(--elev-2)] backdrop-blur">
          <BackLink label={fa ? 'بازگشت' : 'Back'} onClick={onBack} />
          <button type="button" onClick={save} disabled={saving} aria-busy={saving} className={cn(PRIMARY_BTN, 'disabled:opacity-70')}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? (fa ? 'در حال ذخیره…' : 'Saving…') : (fa ? 'ذخیره و ادامه' : 'Save and continue')}
            {!saving && <ArrowLeft className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Step 2: Name the agent, pick a tone, see it talk ───────────
type Formality = 'casual' | 'formal'

const TONE_SAMPLE: Record<Formality, { fa: string; en: string }> = {
  casual: { fa: 'سلام عزیزم 🌸 فردا دستت می‌رسه، خیالت راحت!', en: 'Hi there 🌸 it arrives tomorrow, no worries!' },
  formal: { fa: 'سلام، وقت بخیر. سفارش شما فردا تحویل داده می‌شود.', en: 'Hello. Your order will be delivered tomorrow.' },
}

function isSiteUrl(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw || /instagram\.com|^@/i.test(raw)) return null
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(url)
    return parsed.hostname.includes('.') ? parsed.toString() : null
  } catch {
    return null
  }
}

function AgentStep({
  done,
  businessType,
  businessLabel,
  preset,
  website,
  customHref,
  onBack,
  onContinue,
  onCreated,
}: {
  done: boolean
  businessType: string | null
  businessLabel: string
  preset: { name: string; welcomeMessage: string; requireCustomerInfo: boolean }
  website?: string
  customHref: string
  onBack: () => void
  onContinue: () => void
  onCreated: (agentId: string) => void
}) {
  const fa = useLocale() !== 'en'
  const [name, setName] = useState(preset.name)
  const [welcome, setWelcome] = useState(preset.welcomeMessage)
  const [formality, setFormality] = useState<Formality>('casual')
  const [requireCustomerInfo, setRequireCustomerInfo] = useState(preset.requireCustomerInfo)
  const [handoffEnabled, setHandoffEnabled] = useState(true)
  // Billed per analysed photo, so it stays off unless the owner asks for it.
  const [imageInputEnabled, setImageInputEnabled] = useState(false)
  const goalOptions = getBusinessGoals(businessType)
  const [goals, setGoals] = useState<string[]>(() => goalOptions.map((goal) => goal.key))
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (creating) return
    if (name.trim().length < 2) {
      setError(fa ? 'برای ایجنت یک نام بنویسید.' : 'Give the agent a name.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupMode: 'recommended', name: name.trim(), welcomeMessage: welcome.trim(), formality, goals, requireCustomerInfo, handoffEnabled, imageInputEnabled }),
      })
      if (!response.ok) throw new Error('CREATE_FAILED')
      const data = await response.json().catch(() => null)
      const createdAgentId = data?.agent?.id
      if (typeof createdAgentId !== 'string' || !createdAgentId) throw new Error('INVALID_AGENT')
      // A site given in the previous step becomes the agent's first source.
      // Best effort: the owner can always add it from the next screen.
      const site = isSiteUrl(website)
      if (site && !data?.reused) {
        await fetch(`/api/agents/${createdAgentId}/knowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'url', name: fa ? 'سایت کسب‌وکار' : 'Business website', url: site }),
        }).catch(() => null)
      }
      onCreated(createdAgentId)
    } catch {
      setError((fa ? 'ساخت ایجنت انجام نشد؛ دوباره تلاش کنید.' : 'The agent could not be created. Try again.'))
      setCreating(false)
    }
  }

  if (done) {
    return (
      <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-lg text-center">
        <StepHeading
          title={fa ? 'ایجنت شما ساخته شد' : 'Your agent is ready'}
          subtitle={fa ? 'حالا اطلاعات کسب‌وکارتان را اضافه کنید. بعد از اولین گفتگوها می‌توانید پاسخ‌هایش را بهتر کنید.' : 'Now add your business information. After the first conversations you can improve its answers.'}
        />
        <motion.div variants={staggerChild} className="mt-7 flex items-center justify-between gap-3">
          <BackLink label={fa ? 'بازگشت' : 'Back'} onClick={onBack} />
          <button type="button" onClick={onContinue} className={PRIMARY_BTN}>
            {fa ? 'ادامه به محصولات و خدمات' : 'Continue to products and services'}
            <ArrowLeft className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-3xl">
      <StepHeading
        title={fa ? 'ایجنت شما آماده است' : 'Your agent is ready to go'}
        subtitle={fa ? `نقش و قوانین از الگوی «${businessLabel}» پر شده. هدف، اسم و لحنش را انتخاب کنید.` : `Its role and rules come from the “${businessLabel}” template. Pick its goals, name and tone.`}
      />

      <motion.div variants={staggerChild} className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="spatial-surface rounded-card p-4 sm:p-5">
          <label htmlFor="onb-agent-name" className="ui-field-label">{fa ? 'نام ایجنت' : 'Agent name'}</label>
          <input
            id="onb-agent-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            maxLength={80}
            className="input min-h-12 text-[15px]"
          />

          <GoalPicker id="onb-agent-goals" className="mt-4" goals={goalOptions} selected={goals} onChange={setGoals} fa={fa} />

          <span id="onb-agent-tone" className="ui-field-label mt-4">{fa ? 'لحن' : 'Tone'}</span>
          <div role="radiogroup" aria-labelledby="onb-agent-tone" className="ui-seg w-full grid-cols-2 sm:w-64">
            {(['casual', 'formal'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={formality === value}
                data-active={formality === value}
                onClick={() => setFormality(value)}
                className="ui-seg-tab flex-1 px-6"
              >
                {value === 'casual' ? (fa ? 'صمیمی' : 'Friendly') : (fa ? 'رسمی' : 'Formal')}
              </button>
            ))}
          </div>

          <label htmlFor="onb-agent-welcome" className="ui-field-label mt-4">{fa ? 'پیام خوش‌آمد' : 'Welcome message'}</label>
          <textarea
            id="onb-agent-welcome"
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            maxLength={500}
            rows={3}
            className="input min-h-[5.5rem] py-2.5 text-[15px] leading-7"
          />

          {/* Agent-wide switches the template would otherwise decide silently. */}
          <span className="ui-field-label mt-4">{fa ? 'در گفتگو با مشتری' : 'In customer conversations'}</span>
          <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-default)] bg-white">
            <div className="flex items-center justify-between gap-4 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-6 text-[var(--text-primary)]">{fa ? 'گرفتن نام و شماره پیش از گفتگو' : 'Ask for name and number before chatting'}</p>
                <p className="text-[12px] leading-5 text-[var(--text-muted)]">{fa ? 'در ویجت سایت و لینک چت؛ مخاطب مستقیم در CRM ثبت می‌شود.' : 'On the website widget and chat link; the contact is saved to your CRM.'}</p>
              </div>
              <Switch checked={requireCustomerInfo} onChange={setRequireCustomerInfo} aria-label={fa ? 'گرفتن نام و شماره پیش از گفتگو' : 'Ask for name and number before chatting'} />
            </div>
            <div className="flex items-center justify-between gap-4 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-6 text-[var(--text-primary)]">{fa ? 'تحویل خودکار به اپراتور' : 'Automatic operator handoff'}</p>
                <p className="text-[12px] leading-5 text-[var(--text-muted)]">{fa ? 'برای شکایت، درخواست مستقیم و موارد حساس.' : 'For complaints, direct requests and sensitive cases.'}</p>
              </div>
              <Switch checked={handoffEnabled} onChange={setHandoffEnabled} aria-label={fa ? 'تحویل خودکار به اپراتور' : 'Automatic operator handoff'} />
            </div>
            <div className="flex items-center justify-between gap-4 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-6 text-[var(--text-primary)]">{fa ? 'دیدن عکس‌های مشتری' : 'Read customer photos'}</p>
                <p className="text-[12px] leading-5 text-[var(--text-muted)]">{fa ? 'ایجنت محتوای عکس را می‌بیند و جواب می‌دهد؛ هزینهٔ هر عکس از اعتبار کم می‌شود.' : 'The agent sees the photo and answers; each photo is charged to your credit.'}</p>
              </div>
              <Switch checked={imageInputEnabled} onChange={setImageInputEnabled} aria-label={fa ? 'دیدن عکس‌های مشتری' : 'Read customer photos'} />
            </div>
          </div>

          <a href={customHref} className="mt-4 inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline">
            <SlidersHorizontal className="h-4 w-4" />
            {fa ? 'تنظیمات بیشتر: نقش، قوانین و تحویل به اپراتور' : 'More settings: role, rules and operator handoff'}
          </a>
        </div>

        {/* Live preview: the greeting and one sample exchange in the chosen tone. */}
        <div className="rounded-card border border-[var(--border-subtle)] bg-[#fbfbfa] p-4 sm:p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-bold text-[var(--text-primary)]">{name.trim() || (fa ? 'ایجنت شما' : 'Your agent')}</span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {fa ? 'پیش‌نمایش' : 'Preview'}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-[13px] leading-6">
            <p className="ms-auto max-w-[85%] rounded-2xl rounded-se-md bg-[var(--text-primary)] px-3 py-2 text-white">
              {welcome.trim() || (fa ? 'سلام! چطور می‌توانم کمکتان کنم؟' : 'Hi! How can I help?')}
            </p>
            <p className="max-w-[85%] rounded-2xl rounded-ss-md bg-black/[0.06] px-3 py-2 text-[var(--text-primary)]">
              {fa ? 'سفارشم کی می‌رسه؟' : 'When does my order arrive?'}
            </p>
            <motion.p
              key={formality}
              initial={{ opacity: 0.4, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="ms-auto max-w-[85%] rounded-2xl rounded-se-md bg-[var(--text-primary)] px-3 py-2 text-white"
            >
              {fa ? TONE_SAMPLE[formality].fa : TONE_SAMPLE[formality].en}
            </motion.p>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[var(--text-muted)]">
            {fa ? 'جواب دوم فقط نمونهٔ لحن است؛ ایجنت از اطلاعات خود شما جواب می‌دهد.' : 'The second reply only shows the tone; the agent answers from your own information.'}
          </p>
        </div>
      </motion.div>

      {error && <p role="alert" className="mt-3 text-center text-xs font-medium text-red-600">{error}</p>}

      <motion.div variants={staggerChild} className="mt-4 flex items-center justify-between gap-3">
        <BackLink label={fa ? 'بازگشت' : 'Back'} onClick={onBack} />
        <button type="button" onClick={() => void create()} disabled={creating} aria-busy={creating} className={cn(PRIMARY_BTN, 'disabled:cursor-wait disabled:opacity-70')}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {creating ? (fa ? 'در حال ساخت ایجنت…' : 'Creating the agent…') : (fa ? 'ساخت ایجنت و ادامه' : 'Create agent and continue')}
          {!creating && <ArrowLeft className="h-4 w-4" />}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Step 3: Give the agent something to answer from ────────────
type KnowledgePanel = 'woo' | 'access' | 'products' | 'text' | null

function OptionRow({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
        <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.8} />
      </span>
      <span className="min-w-[10rem] flex-1 text-start">
        <span className="block text-[13px] font-bold leading-6 text-[var(--text-primary)]">{title}</span>
        <span className="block text-[12px] leading-5 text-[var(--text-muted)]">{body}</span>
      </span>
      {action}
    </div>
  )
}

function KnowledgeStep({
  done,
  agentId,
  sellsProducts,
  onBack,
  onContinue,
  onSkip,
  onSaved,
  onWooConnected,
}: {
  done: boolean
  agentId: string | null
  /** Products are offered only when the workspace sells from a catalog. */
  sellsProducts: boolean
  onBack: () => void
  onContinue: () => void
  onSkip: () => Promise<void>
  /** Something was added here; the parent refreshes the setup state. */
  onSaved: () => void
  /**
   * Called when the user successfully connects WooCommerce via the in-
   * onboarding wizard. Differs from onContinue in that the parent can use
   * this signal to show a "site connected" success banner on the next step.
   */
  onWooConnected?: () => void
}) {
  const fa = useLocale() !== 'en'
  const [skipping, setSkipping] = useState(false)
  const [panel, setPanel] = useState<KnowledgePanel>(null)
  const [rows, setRows] = useState([{ name: '', price: '' }, { name: '', price: '' }, { name: '', price: '' }])
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState('')

  async function skip() {
    if (skipping) return
    setSkipping(true)
    try {
      await onSkip()
    } finally {
      setSkipping(false)
    }
  }

  async function saveProducts() {
    const filled = rows.filter((row) => row.name.trim())
    if (!filled.length) {
      setError(fa ? 'دست‌کم نام یک محصول را بنویسید.' : 'Enter at least one product name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      for (const row of filled) {
        const digits = row.price.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d]/g, '')
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: row.name.trim(), price: digits ? Number(digits) : null, active: true }),
        })
        if (!res.ok) throw new Error()
      }
      setAdded(fa ? `${filled.length.toLocaleString('fa-IR')} محصول اضافه شد.` : `${filled.length} products added.`)
      setPanel(null)
      onSaved()
    } catch {
      setError(fa ? 'ذخیرهٔ محصول انجام نشد؛ دوباره تلاش کنید.' : 'Could not save the products. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function saveKnowledge() {
    if (!agentId) return
    if (!file && text.trim().length < 10) {
      setError(fa ? 'یک فایل انتخاب کنید یا چند خط متن بنویسید.' : 'Choose a file or write a few lines.')
      return
    }
    setSaving(true)
    setError('')
    try {
      let res: Response
      if (file) {
        const form = new FormData()
        form.set('file', file)
        form.set('name', file.name)
        res = await fetch(`/api/agents/${agentId}/knowledge`, { method: 'POST', body: form })
      } else {
        res = await fetch(`/api/agents/${agentId}/knowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'text', name: fa ? 'معرفی کسب‌وکار' : 'About the business', content: text.trim() }),
        })
      }
      if (!res.ok) throw new Error()
      setAdded(fa ? 'به دانش ایجنت اضافه شد.' : 'Added to the agent’s knowledge.')
      setPanel(null)
      onSaved()
    } catch {
      setError(fa ? 'ذخیره انجام نشد. فایل باید PDF یا CSV و کمتر از ۲۰ مگابایت باشد.' : 'Could not save. The file must be a PDF or CSV under 20 MB.')
    } finally {
      setSaving(false)
    }
  }

  if (panel === 'woo') {
    return (
      <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-lg text-start">
        <WooConnectWizard
          onConnected={() => setPanel('access')}
          onDismiss={() => setPanel(null)}
        />
      </motion.div>
    )
  }

  // The store is connected: ask what the agent may do with it before moving on.
  if (panel === 'access') {
    const proceed = () => {
      setPanel(null)
      if (onWooConnected) onWooConnected()
      else onContinue()
    }
    return (
      <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-lg text-start">
        <StoreAccessPrompt onDone={proceed} onSkip={proceed} />
      </motion.div>
    )
  }

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-lg text-center">
      <StepHeading
        title={fa ? 'ایجنت از روی چه چیزی جواب بدهد؟' : 'What should the agent answer from?'}
        subtitle={fa ? 'یکی را انتخاب کنید. بعداً هم می‌شود اضافه کرد.' : 'Pick one. You can add more later.'}
      />

      {(done || added) && (
        <motion.p variants={staggerChild} role="status" className="mx-auto mt-5 flex max-w-md items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-800">
          <Check className="h-4 w-4 shrink-0" strokeWidth={3} />
          {added || (fa ? 'ایجنت همین حالا اطلاعاتی برای جواب دادن دارد.' : 'The agent already has something to answer from.')}
        </motion.p>
      )}

      <motion.div variants={staggerChild} className="spatial-surface mt-5 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card text-start">
        <OptionRow
          icon={Store}
          title={fa ? 'سایت وردپرس یا ووکامرس دارم' : 'I have a WordPress or WooCommerce site'}
          body={fa ? 'محصول، قیمت و موجودی خودکار همگام می‌شود' : 'Products, prices and stock sync automatically'}
          action={(
            <button type="button" onClick={() => { setPanel('woo'); setError('') }} className={ROW_BTN_DARK}>
              {fa ? 'اتصال سایت' : 'Connect site'}
            </button>
          )}
        />

        {sellsProducts && (
          <div>
            <OptionRow
              icon={PencilLine}
              title={fa ? 'چند محصول را همین‌جا وارد می‌کنم' : 'I’ll enter a few products here'}
              body={fa ? 'نام و قیمت سه محصول پرفروش کافی است' : 'Name and price of your three best sellers is enough'}
              action={(
                <button type="button" aria-expanded={panel === 'products'} onClick={() => { setPanel(panel === 'products' ? null : 'products'); setError('') }} className={ROW_BTN_LIGHT}>
                  {fa ? 'افزودن محصول' : 'Add products'}
                </button>
              )}
            />
            {panel === 'products' && (
              <div className="space-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3.5">
                {rows.map((row, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
                    <input
                      value={row.name}
                      onChange={(e) => setRows((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                      placeholder={fa ? 'نام محصول' : 'Product name'}
                      aria-label={fa ? `نام محصول ${(index + 1).toLocaleString('fa-IR')}` : `Product ${index + 1} name`}
                      maxLength={160}
                      className="input min-h-11"
                    />
                    <input
                      value={row.price}
                      onChange={(e) => setRows((current) => current.map((item, i) => i === index ? { ...item, price: e.target.value } : item))}
                      placeholder={fa ? 'قیمت (تومان)' : 'Price'}
                      aria-label={fa ? `قیمت محصول ${(index + 1).toLocaleString('fa-IR')}` : `Product ${index + 1} price`}
                      inputMode="numeric"
                      className="input min-h-11 tabular-nums"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button type="button" onClick={() => setRows((current) => [...current, { name: '', price: '' }])} disabled={rows.length >= 8} className="inline-flex min-h-11 items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
                    <Plus className="h-3.5 w-3.5" />
                    {fa ? 'ردیف دیگر' : 'Another row'}
                  </button>
                  <button type="button" onClick={() => void saveProducts()} disabled={saving} aria-busy={saving} className={ROW_BTN_DARK}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {fa ? 'ذخیرهٔ محصول‌ها' : 'Save products'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <OptionRow
            icon={FileText}
            title={fa ? 'فایل یا متن معرفی دارم' : 'I have a file or some text'}
            body={fa ? 'PDF، فهرست قیمت یا پرسش‌های پرتکرار' : 'A PDF, a price list or frequent questions'}
            action={(
              <button type="button" aria-expanded={panel === 'text'} onClick={() => { setPanel(panel === 'text' ? null : 'text'); setError('') }} className={ROW_BTN_LIGHT}>
                {fa ? 'افزودن' : 'Add'}
              </button>
            )}
          />
          {panel === 'text' && (
            <div className="space-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3.5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                disabled={!!file}
                placeholder={fa ? 'مثلاً: شرایط ارسال و مرجوعی، ساعت کاری، پرسش‌های پرتکرار…' : 'e.g. shipping and returns, opening hours, frequent questions…'}
                aria-label={fa ? 'متن معرفی' : 'Intro text'}
                className="input min-h-[6.5rem] py-2.5 leading-7"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[12rem] truncate">{file ? file.name : (fa ? 'یا انتخاب فایل PDF / CSV' : 'or choose a PDF / CSV file')}</span>
                  <input type="file" accept=".pdf,.csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <button type="button" onClick={() => void saveKnowledge()} disabled={saving || !agentId} aria-busy={saving} className={ROW_BTN_DARK}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {fa ? 'افزودن به دانش ایجنت' : 'Add to agent knowledge'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      <motion.div variants={staggerChild} className="mt-4 flex items-center justify-between gap-3">
        <BackLink label={fa ? 'بازگشت' : 'Back'} onClick={onBack} />
        {done || added ? (
          <button type="button" onClick={onContinue} className={PRIMARY_BTN}>
            {fa ? 'ادامه' : 'Continue'}
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <SkipLink label={skipping ? (fa ? 'در حال ثبت…' : 'Saving…') : (fa ? 'فعلاً رد می‌کنم' : 'Skip for now')} busy={skipping} onClick={() => void skip()} />
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Step 4: Where customers reach the agent ────────────────────
const CHANNEL_TILES: { key: ChannelKey; fa: string; en: string; hintFa: string; hintEn: string }[] = [
  { key: 'WEB_WIDGET', fa: 'ویجت سایت', en: 'Website widget', hintFa: 'یک خط کد در سایت شما', hintEn: 'One line of code on your site' },
  { key: 'INSTAGRAM', fa: 'اینستاگرام', en: 'Instagram', hintFa: 'دایرکت، کامنت و استوری', hintEn: 'DMs, comments and stories' },
  { key: 'TELEGRAM', fa: 'تلگرام', en: 'Telegram', hintFa: 'با توکن ربات', hintEn: 'With a bot token' },
  { key: 'BALE', fa: 'بله', en: 'Bale', hintFa: 'با توکن ربات', hintEn: 'With a bot token' },
  { key: 'RUBIKA', fa: 'روبیکا', en: 'Rubika', hintFa: 'با توکن ربات', hintEn: 'With a bot token' },
]

function randomSlug() {
  return `chat-${Math.random().toString(36).slice(2, 8)}`
}

function ChannelStep({
  agentId,
  instagramFirst,
  done,
  successBanner,
  onLinkCreated,
  onSkip,
  onBack,
  onContinue,
}: {
  agentId: string | null
  /** Instagram-first businesses see Instagram as the highlighted tile. */
  instagramFirst: boolean
  done: boolean
  successBanner?: string
  onLinkCreated: () => void
  onSkip: () => Promise<void>
  onBack: () => void
  onContinue: () => void
}) {
  const fa = useLocale() !== 'en'
  const [skipping, setSkipping] = useState(false)
  const [creating, setCreating] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const channelsHref = agentId ? `/agents/${agentId}/channels` : '/agents'

  async function skip() {
    if (skipping) return
    setSkipping(true)
    try {
      await onSkip()
    } finally {
      setSkipping(false)
    }
  }

  async function createLink() {
    if (!agentId || creating) return
    setCreating(true)
    setError('')
    try {
      // A random address can clash; a couple of retries is plenty.
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(`/api/agents/${agentId}/chat-link`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: randomSlug(), enabled: true }),
        })
        if (res.status === 409) continue
        if (!res.ok) throw new Error()
        const data = await res.json().catch(() => null)
        if (typeof data?.link?.url !== 'string') throw new Error()
        setLinkUrl(data.link.url)
        onLinkCreated()
        return
      }
      throw new Error()
    } catch {
      setError(fa ? 'ساخت لینک انجام نشد؛ دوباره تلاش کنید.' : 'The link could not be created. Try again.')
    } finally {
      setCreating(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(linkUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* the address stays selectable on screen */
    }
  }

  const tileBase = 'spatial-surface flex flex-col gap-1 rounded-card p-3.5 text-start'

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-2xl text-center">
      {successBanner && (
        <motion.div
          variants={staggerChild}
          className="mx-auto mb-5 flex max-w-md items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <p className="text-[13px] font-semibold leading-5">{successBanner}</p>
        </motion.div>
      )}

      <StepHeading
        title={fa ? 'مشتری از کجا پیام بدهد؟' : 'Where will customers message you?'}
        subtitle={fa ? 'لینک چت همین حالا ساخته می‌شود. بقیه چند دقیقه کار دارند.' : 'The chat link is ready in one click. The others take a few minutes.'}
      />

      <motion.div variants={staggerChild} className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className={cn(tileBase, !instagramFirst && 'ring-[1.5px] ring-[var(--text-primary)]')}>
          <div className="flex items-center justify-between gap-2">
            <ChannelMark channel="CHAT_LINK" size="sm" className="!h-9 !w-9 !rounded-xl" />
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700">{fa ? 'یک کلیک' : 'One click'}</span>
          </div>
          <span className="mt-1 text-[13px] font-bold text-[var(--text-primary)]">{fa ? 'لینک چت' : 'Chat link'}</span>
          <span className="text-[12px] leading-5 text-[var(--text-muted)]">{fa ? 'صفحهٔ گفتگوی آماده، بدون سایت' : 'A ready chat page, no website needed'}</span>
          {linkUrl ? (
            <button type="button" onClick={() => void copy()} className={cn(ROW_BTN_LIGHT, 'mt-2 w-full')}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? (fa ? 'کپی شد' : 'Copied') : (fa ? 'کپی لینک' : 'Copy link')}
            </button>
          ) : (
            <button type="button" onClick={() => void createLink()} disabled={creating || !agentId} aria-busy={creating} className={cn(instagramFirst ? ROW_BTN_LIGHT : ROW_BTN_DARK, 'mt-2 w-full')}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {fa ? 'ساخت لینک' : 'Create link'}
            </button>
          )}
        </div>

        {CHANNEL_TILES.map((tile) => {
          const primary = instagramFirst && tile.key === 'INSTAGRAM'
          return (
            <div key={tile.key} className={cn(tileBase, primary && 'ring-[1.5px] ring-[var(--text-primary)]')}>
              <ChannelMark channel={tile.key} size="sm" className="!h-9 !w-9 !rounded-xl" />
              <span className="mt-1 text-[13px] font-bold text-[var(--text-primary)]">{fa ? tile.fa : tile.en}</span>
              <span className="text-[12px] leading-5 text-[var(--text-muted)]">{fa ? tile.hintFa : tile.hintEn}</span>
              <a href={tile.key === 'INSTAGRAM' ? '/instagram' : channelsHref} className={cn(primary ? ROW_BTN_DARK : ROW_BTN_LIGHT, 'mt-2 w-full')}>
                {tile.key === 'WEB_WIDGET' ? (fa ? 'دریافت کد' : 'Get the code') : (fa ? 'اتصال' : 'Connect')}
              </a>
            </div>
          )
        })}
      </motion.div>

      {linkUrl && (
        <p role="status" className="mt-3 text-[13px] text-[var(--text-secondary)]">
          {fa ? 'لینک چت ساخته شد: ' : 'Chat link created: '}
          <span dir="ltr" className="select-all font-medium text-[var(--text-primary)]">{linkUrl}</span>
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      <motion.div variants={staggerChild} className="mt-4 flex items-center justify-between gap-3">
        <BackLink label={fa ? 'بازگشت' : 'Back'} onClick={onBack} />
        {done || linkUrl ? (
          <button type="button" onClick={onContinue} className={PRIMARY_BTN}>
            {fa ? 'ادامه' : 'Continue'}
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <SkipLink label={skipping ? (fa ? 'در حال ثبت…' : 'Saving…') : (fa ? 'فعلاً رد می‌کنم' : 'Skip for now')} busy={skipping} onClick={() => void skip()} />
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Final step ─────────────────────────────────────────────────
function DoneStep({ agentId }: { agentId: string | null }) {
  const fa = useLocale() !== 'en'
  const router = useRouter()
  const reduce = useReducedMotion()
  const [leaving, setLeaving] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!agentId) return
    let alive = true
    fetch(`/api/agents/${agentId}/chat-link`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (alive && data?.link?.enabled && typeof data.link.url === 'string') setLinkUrl(data.link.url) })
      .catch(() => null)
    return () => { alive = false }
  }, [agentId])

  // Every exit from this screen closes setup first, then lands on `target`.
  async function finish(target: string) {
    if (leaving) return
    setLeaving(true)
    const response = await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'FINISH' }),
    })
    if (!response.ok) {
      setLeaving(false)
      return
    }
    if (reduce) {
      router.push(target)
      router.refresh()
      return
    }
    window.setTimeout(() => {
      router.push(target)
      router.refresh()
    }, 220)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(linkUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* the address stays selectable on screen */
    }
  }

  const steps: { title: string; body: ReactNode; action: ReactNode }[] = [
    {
      title: fa ? 'یک گفتگوی آزمایشی بکنید' : 'Have a test conversation',
      body: fa ? 'همان چیزی را ببینید که مشتری می‌بیند' : 'See exactly what a customer sees',
      action: (
        <button type="button" onClick={() => void finish(agentId ? `/agents/${agentId}` : '/agents')} disabled={leaving} className={ROW_BTN_LIGHT}>
          {fa ? 'تست ایجنت' : 'Test the agent'}
        </button>
      ),
    },
    linkUrl
      ? {
          title: fa ? 'لینک چت را برای اولین مشتری بفرستید' : 'Send the chat link to your first customer',
          body: <span dir="ltr" className="select-all">{linkUrl.replace(/^https?:\/\//, '')}</span>,
          action: (
            <button type="button" onClick={() => void copy()} className={ROW_BTN_LIGHT}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? (fa ? 'کپی شد' : 'Copied') : (fa ? 'کپی لینک' : 'Copy link')}
            </button>
          ),
        }
      : {
          title: fa ? 'یک راه تماس برای مشتری باز کنید' : 'Open a way for customers to reach you',
          body: fa ? 'لینک چت، ویجت سایت، اینستاگرام یا تلگرام' : 'Chat link, website widget, Instagram or Telegram',
          action: (
            <button type="button" onClick={() => void finish(agentId ? `/agents/${agentId}/channels` : '/agents')} disabled={leaving} className={ROW_BTN_LIGHT}>
              {fa ? 'اتصال برنامه' : 'Connect an app'}
            </button>
          ),
        },
    {
      title: fa ? 'دانش کسب‌وکار را کامل کنید' : 'Complete the business knowledge',
      body: fa ? 'شرایط ارسال، مرجوعی و پرسش‌های پرتکرار' : 'Shipping, returns and frequent questions',
      action: (
        <button type="button" onClick={() => void finish(agentId ? `/agents/${agentId}/improve?tab=knowledge` : '/agents')} disabled={leaving} className={ROW_BTN_LIGHT}>
          {fa ? 'افزودن دانش' : 'Add knowledge'}
        </button>
      ),
    },
  ]

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-lg text-center"
    >
      <StepHeading
        title={fa ? 'ایجنت شما روشن است' : 'Your agent is live'}
        subtitle={fa ? 'سه کار کوتاه تا اولین گفتگوی واقعی:' : 'Three short steps to your first real conversation:'}
      />

      <motion.ol variants={staggerChild} className="spatial-surface mt-6 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card text-start">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/[0.06] text-[13px] font-bold tabular-nums text-[var(--text-primary)]">
              {(index + 1).toLocaleString(fa ? 'fa-IR' : 'en-US')}
            </span>
            <span className="min-w-[10rem] flex-1">
              <span className="block text-[13px] font-bold leading-6 text-[var(--text-primary)]">{step.title}</span>
              <span className="block text-[12px] leading-5 text-[var(--text-muted)]">{step.body}</span>
            </span>
            {step.action}
          </li>
        ))}
      </motion.ol>

      <motion.div variants={staggerChild} className="mt-6">
        <button
          type="button"
          onClick={() => void finish('/overview')}
          disabled={leaving}
          aria-busy={leaving}
          className={cn(PRIMARY_BTN, 'px-8 disabled:opacity-70')}
        >
          {leaving ? (fa ? 'در حال آماده‌سازی داشبورد…' : 'Preparing the dashboard…') : (fa ? 'ورود به داشبورد' : 'Go to the dashboard')}
          <ArrowLeft className="h-4 w-4 rtl:rotate-0" />
        </button>
      </motion.div>
      <AnimatePresence>
        {leaving && !reduce && (
          <motion.div
            className="fixed inset-0 z-[100] grid place-items-center bg-black text-white"
            initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
            animate={{ opacity: 1, clipPath: 'circle(75% at 50% 50%)' }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <Sparkles className="mx-auto h-6 w-6" />
              <p className="mt-3 text-sm font-semibold">{fa ? 'Vigento AI | هوش مصنوعی ویجنتو' : 'Vigento AI'}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

async function skipSetupStep(action: 'SKIP_KNOWLEDGE' | 'SKIP_CHANNEL', router: ReturnType<typeof useRouter>) {
  const response = await fetch('/api/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!response.ok) throw new Error('SKIP_FAILED')
  router.refresh()
}
