'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  Briefcase,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  GraduationCap,
  Headphones,
  Loader2,
  Package,
  Plug,
  Settings2,
  ShoppingBag,
  Sparkles,
  Utensils,
  ArrowLeft,
  Link2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CapabilityOptions } from '@/components/onboarding/capability-options'
import { WooConnectWizard } from '@/components/onboarding/woo-connect-wizard'
import {
  BUSINESS_TYPES,
  getVerticalPack,
  getBusinessServiceOptions,
  type BusinessTypeValue,
} from '@/lib/verticals/registry'

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

// ─── Persian digit map (for step badges) ────────────────────────
// The onboarding flow shows "مرحله N از ۴" badges. We hardcode Persian
// digits (۱, ۲, …) everywhere else so they don't get rendered as English
// digits by JS template literals. This map is used by CtaStep which takes
// `step` as a JS number — we convert before rendering.
const TO_FA_DIGIT: Record<number, string> = {
  0: '۰', 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵', 6: '۶', 7: '۷', 8: '۸', 9: '۹',
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
  workspaceName: string
  businessType: string | null
  businessProfile: { businessName: string; services: string[] } | null
  agentTemplate?: string
}

export function OnboardingFlow({
  hasProfile,
  hasAgent,
  hasKnowledge,
  hasChannel,
  agentId,
  workspaceName,
  businessType,
  businessProfile,
  agentTemplate,
}: Props) {
  const router = useRouter()
  const [direction, setDirection] = useState(1)
  const [phaseOverride, setPhaseOverride] = useState<Phase | null>(null)
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
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col justify-center px-4 py-5 sm:px-8 lg:overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentPhase}
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
                  setPhaseOverride('details')
                }}
              />
            )}

            {currentPhase === 'details' && (
              <DetailsStep
                workspaceName={workspaceName}
                initialType={draftBusinessType ?? businessType as BusinessTypeValue}
                initialProfile={businessProfile}
                onBack={() => { setDirection(-1); setPhaseOverride('type') }}
                onNext={() => { setDirection(1); setPhaseOverride('agent'); router.refresh() }}
              />
            )}

            {currentPhase === 'agent' && (
              <CtaStep
                icon={Sparkles}
                step={2}
                title="ایجنت هوشمند بسازید"
                subtitle="دستیار شما برای پاسخ‌گویی به مشتریان"
                tip="ایجنت پیام مشتری را می‌فهمد، از محصولات شما پاسخ می‌دهد و سفارش می‌گیرد. با هوش مصنوعی یا دستی — انتخاب با شماست."
                ctaLabel="ساخت ایجنت"
                ctaHref={agentTemplate ? `/agents/new?business=${agentTemplate}&onboarding=1` : '/agents/new?onboarding=1'}
                done={hasAgent}
                backLabel="بازگشت به اطلاعات کسب‌وکار"
                onBack={() => { setDirection(-1); setPhaseOverride('details') }}
                onContinue={() => { setDirection(1); setPhaseOverride('knowledge') }}
              />
            )}

            {currentPhase === 'knowledge' && (
              <KnowledgeStep
                done={hasKnowledge}
                onBack={() => { setDirection(-1); setPhaseOverride('agent') }}
                onContinue={() => { setDirection(1); setPhaseOverride('channel') }}
                onWooConnected={() => {
                  // Woo was just connected — set the flag so the channel
                  // step shows the success banner.
                  setDirection(1)
                  setWooJustConnected(true)
                  setPhaseOverride('channel')
                }}
                onSkip={() => skipSetupStep('SKIP_KNOWLEDGE', router)}
              />
            )}

            {currentPhase === 'channel' && (
              <CtaStep
                icon={Plug}
                step={4}
                title="یک کانال متصل کنید"
                subtitle="ایجنت را به اینستاگرام، تلگرام، واتساپ یا وب متصل کنید"
                tip="پس از اتصال، پیام‌های مشتریان مستقیماً به ایجنت می‌رسند و پاسخ می‌گیرند — بدون کار اضافه از شما."
                ctaLabel="اتصال کانال"
                ctaHref={businessType === 'SOCIAL'
                  ? '/instagram'
                  : agentId ? `/agents/${agentId}/channels` : '/agents'}
                done={hasChannel}
                skipLabel="بعداً اتصال می‌دهم"
                onSkip={() => skipSetupStep('SKIP_CHANNEL', router)}
                backLabel="بازگشت به محصولات و خدمات"
                onBack={() => { setDirection(-1); setWooJustConnected(false); setPhaseOverride('knowledge') }}
                onContinue={() => { setDirection(1); setWooJustConnected(false); setPhaseOverride('done') }}
                successBanner={wooJustConnected ? 'با موفقیت سایت شما به ویجنت وصل شد' : undefined}
              />
            )}

            {currentPhase === 'done' && <DoneStep />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Step 1: Choose business type ───────────────────────────────
function TypeStep({
  selectedType,
  onSelect,
}: {
  selectedType: BusinessTypeValue | null
  onSelect: (type: BusinessTypeValue) => void
}) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show">
      <motion.div variants={staggerChild} className="text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          شروع راه‌اندازی
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          کسب‌وکار شما چیست؟
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-muted)]">
          نوع کسب‌وکار خود را انتخاب کنید تا ویژگی‌های مناسب شما فعال شود
        </p>
      </motion.div>

      <motion.div
        variants={staggerChild}
        className="mt-5 grid gap-2.5 sm:grid-cols-2 md:grid-cols-4"
      >
        {BUSINESS_TYPES.map((type) => {
          const pack = getVerticalPack(type)
          const Icon = ICONS[type]
          const active = selectedType === type
          const features = pack.featuresFa
          return (
            <motion.button
              key={type}
              variants={staggerChild}
              type="button"
              onClick={() => onSelect(type)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
              className={cn(
                'spatial-press group relative overflow-hidden rounded-[1.35rem] border bg-white p-4 text-start transition-colors duration-200',
                active
                  ? 'border-[var(--text-primary)]'
                  : 'border-[var(--border-default)] hover:border-[var(--border-hover)]',
              )}
              style={{ boxShadow: active ? 'var(--shadow-lift)' : 'var(--shadow-card)' }}
            >
              {/* Selected indicator */}
              {active && (
                <motion.span
                  layoutId="type-selected"
                  className="absolute end-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[var(--text-primary)] text-white"
                  transition={{ duration: 0.2 }}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.span>
              )}

              <span className={cn(
                'grid h-11 w-11 place-items-center rounded-xl transition-colors duration-200',
                active ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]',
              )}>
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>

              <h3 className="mt-3.5 text-[14px] font-semibold text-[var(--text-primary)]">
                {pack.titleFa}
              </h3>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--text-muted)]">
                {pack.descriptionFa}
              </p>

              {/* Feature pills */}
              <div className="mt-3 flex flex-wrap gap-1">
                {features.slice(0, 2).map((f) => (
                  <span key={f} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                    {f}
                  </span>
                ))}
              </div>
            </motion.button>
          )
        })}
      </motion.div>
    </motion.div>
  )
}

// ─── Step 2: Name + services ────────────────────────────────────
function DetailsStep({
  workspaceName,
  initialType,
  initialProfile,
  onBack,
  onNext,
}: {
  workspaceName: string
  initialType: BusinessTypeValue
  initialProfile: { businessName: string; services: string[] } | null
  onBack: () => void
  onNext: () => void
}) {
  const pack = getVerticalPack(initialType)
  const suggestions = getBusinessServiceOptions(initialType)
  const [businessName, setBusinessName] = useState(initialProfile?.businessName ?? workspaceName)
  const [services, setServices] = useState<string[]>(initialProfile?.services ?? suggestions.slice(0, 2).map((option) => option.fa))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const Icon = ICONS[initialType]

  async function save() {
    if (businessName.trim().length < 2) {
      setError('نام کسب‌وکار را وارد کنید')
      return
    }
    if (services.length === 0) {
      setError('حداقل یک خدمت انتخاب کنید')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: initialType, businessName: businessName.trim(), services }),
      })
      if (!res.ok) throw new Error()
      onNext()
    } catch {
      setError('ذخیره ناموفق بود، دوباره تلاش کنید')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show">
      <motion.div variants={staggerChild} className="text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          مرحله ۱ از ۴
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          اطلاعات کسب‌وکار
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-muted)]">
          نام و خدمات اصلی کسب‌وکار خود را وارد کنید
        </p>
      </motion.div>

      <motion.div
        variants={staggerChild}
        className="mx-auto mt-8 max-w-lg space-y-6"
      >
        {/* Selected type badge */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <Icon className="h-3.5 w-3.5" />
            {pack.titleFa}
          </div>
        </div>

        {/* Name input */}
        <div>
          <label htmlFor="business-name" className="mb-2 block text-[13px] font-medium text-[var(--text-primary)]">
            نام کسب‌وکار
          </label>
          <input
            id="business-name"
            value={businessName}
            onChange={(e) => { setBusinessName(e.target.value); setError('') }}
            placeholder="مثلاً فروشگاه رزین‌مهر"
            className="input min-h-12 text-[15px]"
            autoFocus
          />
        </div>

        {/* Services */}
        <CapabilityOptions
          options={suggestions}
          selected={services}
          businessType={initialType}
          locale="fa"
          title="خدمات و قابلیت‌های موردنیاز"
          hint="پیشنهادها بر اساس نوع کسب‌وکار شما مرتب شده‌اند و هر زمان قابل تغییرند."
          onToggle={(service) => {
            setServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service])
            setError('')
          }}
        />

        {/* Error */}
        {error && (
          <p className="text-[13px] text-[var(--red)]">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--bg-surface)]"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-0" />
            بازگشت
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-8 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-black disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'در حال ذخیره…' : 'ذخیره و ادامه'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Steps 3-5: CTA steps ───────────────────────────────────────
function CtaStep({
  icon: Icon,
  step,
  title,
  subtitle,
  tip,
  ctaLabel,
  ctaHref,
  done,
  skipLabel,
  onSkip,
  backLabel,
  onBack,
  onContinue,
  successBanner,
}: {
  icon: LucideIcon
  step: number
  title: string
  subtitle: string
  tip: string
  ctaLabel: string
  ctaHref: string
  done?: boolean
  skipLabel?: string
  onSkip?: () => Promise<void>
  backLabel: string
  onBack: () => void
  onContinue?: () => void
  /**
   * Optional success banner text shown ABOVE the step icon. Used by the
   * channel step to confirm a successful WooCommerce connection just made
   * on the previous step. When undefined, no banner is shown.
   */
  successBanner?: string
}) {
  const [skipping, setSkipping] = useState(false)

  async function skip() {
    if (!onSkip || skipping) return
    setSkipping(true)
    try {
      await onSkip()
    } finally {
      setSkipping(false)
    }
  }

  // Step badge text. The 4th step (channel) is the final onboarding step
  // so we label it "مرحله آخر" instead of "مرحله ۴ از ۴" — cleaner UX and
  // matches the user's request. Earlier steps use Persian digits to stay
  // consistent with the rest of the onboarding flow.
  const stepBadge =
    step === 4 ? 'مرحله آخر' : `مرحله ${TO_FA_DIGIT[step]} از ۴`

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-lg text-center">
      {/* Success banner — shown above the icon when the user just completed
          a milestone (e.g. WooCommerce connect). Animates in subtly so it
          doesn't compete with the rest of the step. */}
      {successBanner && (
        <motion.div
          variants={staggerChild}
          className="mx-auto mb-6 flex max-w-md items-center justify-center gap-2.5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-800"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-600 text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <p className="text-[13px] font-semibold leading-5">{successBanner}</p>
        </motion.div>
      )}

      <motion.div variants={staggerChild} className="mx-auto flex justify-center">
        <div className="relative">
          <motion.div
            animate={done ? {} : { scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--text-primary)] text-white"
            style={{ boxShadow: 'var(--shadow-lift)' }}
          >
            <Icon className="h-9 w-9" strokeWidth={1.5} />
          </motion.div>
          {!done && (
            <motion.span
              className="absolute -inset-2 rounded-3xl border-2 border-[var(--text-primary)]"
              animate={{ opacity: [0.15, 0, 0.15], scale: [1, 1.1, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      </motion.div>

      <motion.p variants={staggerChild} className="mt-6 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {stepBadge}
      </motion.p>

      <motion.h2 variants={staggerChild} className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
        {title}
      </motion.h2>

      <motion.p variants={staggerChild} className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-muted)]">
        {subtitle}
      </motion.p>

      {/* Tip card */}
      <motion.div
        variants={staggerChild}
        className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-start"
      >
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <p className="text-[13px] leading-5 text-[var(--text-secondary)]">{tip}</p>
      </motion.div>

      {/* CTA */}
      <motion.div variants={staggerChild} className="mt-8 flex flex-col items-center gap-2">
        {done ? (
          <button
            type="button"
            onClick={onContinue}
            className="spatial-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-8 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
          >
            <motion.span
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="grid h-7 w-7 place-items-center rounded-full bg-[var(--text-primary)] text-white"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </motion.span>
            ادامه به مرحله بعد
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <>
            <a
              href={ctaHref}
              className="spatial-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-8 text-[13px] font-medium text-white shadow-[var(--shadow-control)] hover:bg-black"
            >
              {ctaLabel}
              <ArrowLeft className="h-4 w-4 rtl:rotate-0" />
            </a>
            {skipLabel && onSkip && (
              <button
                type="button"
                onClick={() => void skip()}
                disabled={skipping}
                className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-medium text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                {skipping && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {skipping ? 'در حال ثبت…' : skipLabel}
              </button>
            )}
          </>
        )}
      </motion.div>
      <motion.button
        variants={staggerChild}
        type="button"
        onClick={onBack}
        className="spatial-press mx-auto mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-medium text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4 rotate-180" />
        {backLabel}
      </motion.button>
    </motion.div>
  )
}

// ─── Step 3: Knowledge / Products (with WooCommerce connect option) ────
function KnowledgeStep({
  done,
  onBack,
  onContinue,
  onSkip,
  onWooConnected,
}: {
  done: boolean
  onBack: () => void
  onContinue: () => void
  onSkip: () => Promise<void>
  /**
   * Called when the user successfully connects WooCommerce via the in-
   * onboarding wizard. Differs from onContinue in that the parent can use
   * this signal to show a "site connected" success banner on the next step.
   */
  onWooConnected?: () => void
}) {
  const [skipping, setSkipping] = useState(false)
  // WooConnectWizard visibility — when open, the wizard renders INLINE
  // (replacing the two-option grid). After a successful connect, we call
  // onWooConnected() (if provided) so the parent can flag the success
  // banner on the next step, then advance to the channel step.
  const [showWizard, setShowWizard] = useState(false)

  async function skip() {
    if (skipping) return
    setSkipping(true)
    try {
      await onSkip()
    } finally {
      setSkipping(false)
    }
  }

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-lg text-center">
      {/* Parent step header (icon / badge / title / subtitle) is hidden when
          the wizard is open — the wizard has its own header and the
          "two ways to add products" subtitle is irrelevant once the user has
          committed to the WordPress path. */}
      {!showWizard && (
        <>
          <motion.div variants={staggerChild} className="mx-auto flex justify-center">
            <div className="relative">
              <motion.div
                animate={done ? {} : { scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--text-primary)] text-white"
                style={{ boxShadow: 'var(--shadow-lift)' }}
              >
                <Package className="h-9 w-9" strokeWidth={1.5} />
              </motion.div>
              {!done && (
                <motion.span
                  className="absolute -inset-2 rounded-3xl border-2 border-[var(--text-primary)]"
                  animate={{ opacity: [0.15, 0, 0.15], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
          </motion.div>

          <motion.p variants={staggerChild} className="mt-6 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            مرحله ۳ از ۴
          </motion.p>

          <motion.h2 variants={staggerChild} className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            محصولات یا خدمات را اضافه کنید
          </motion.h2>

          <motion.p variants={staggerChild} className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-muted)]">
            ایجنت برای پاسخ دقیق، به شناخت کسب‌وکار شما نیاز دارد. دو راه برای افزودن محصولات دارید:
          </motion.p>
        </>
      )}

      {/* When the wizard is open, render it INLINE (replacing the two-option
          grid) instead of as a modal overlay. The user wanted the wizard to
          NOT be a popup. */}
      {showWizard ? (
        <motion.div variants={staggerChild} className="mt-2 text-start">
          <WooConnectWizard
            onConnected={() => {
              setShowWizard(false)
              // Prefer onWooConnected so the parent can flag the success
              // banner on the channel step. Fall back to onContinue if the
              // parent didn't wire it up.
              if (onWooConnected) onWooConnected()
              else onContinue()
            }}
            onDismiss={() => setShowWizard(false)}
          />
        </motion.div>
      ) : (
      <motion.div variants={staggerChild} className="mt-6 grid gap-3 sm:grid-cols-2 text-start">
        {/* Option A: Connect WooCommerce — opens the in-onboarding wizard.
            No longer navigates away to /products; the wizard runs in-place
            and advances the onboarding when the plugin connects. */}
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="spatial-surface spatial-press group relative overflow-hidden rounded-[1.5rem] p-4 text-start transition-[border-color] hover:border-[var(--border-strong)]"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
              <Link2 className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">پیشنهادی</span>
          </div>
          <h3 className="mt-3 text-[14px] font-bold text-[var(--text-primary)]">
            اتصال سایت وردپرس یا ووکامرس
          </h3>
          <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">
            سایت وردپرسی یا فروشگاهی دارید؟ با چند کلیک وصل کنید — محصولات و سفارش‌ها خودکار بروز و اضافه می‌شوند به پنل.
          </p>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[var(--text-primary)]">
            شروع اتصال
            <ArrowLeft className="h-3 w-3 rtl:rotate-0" />
          </div>
        </button>

        {/* Option B: Manual product entry */}
        <Link
          href="/products/new?onboarding=1"
          className="spatial-surface spatial-press group relative overflow-hidden rounded-[1.5rem] p-4 transition-[border-color] hover:border-[var(--border-strong)]"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)]">
              <Package className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">دستی</span>
          </div>
          <h3 className="mt-3 text-[14px] font-bold text-[var(--text-primary)]">
            افزودن دستی محصولات
          </h3>
          <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">
            محصول را با نام، قیمت و موجودی وارد کنید. ایجنت از این داده‌ها برای پیشنهاد و فروش استفاده می‌کند.
          </p>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[var(--text-primary)]">
            افزودن محصول
            <ArrowLeft className="h-3 w-3 rtl:rotate-0" />
          </div>
        </Link>
      </motion.div>
      )}

      {/* CTA buttons — only shown when the wizard is NOT open (the wizard
          has its own back button and dismissal flow). */}
      {!showWizard && (
      <>
      <motion.div variants={staggerChild} className="mt-8 flex flex-col items-center gap-2">
        {done ? (
          <button
            type="button"
            onClick={onContinue}
            className="spatial-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-8 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
          >
            <motion.span
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="grid h-7 w-7 place-items-center rounded-full bg-[var(--text-primary)] text-white"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </motion.span>
            ادامه به مرحله بعد
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void skip()}
            disabled={skipping}
            className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-medium text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {skipping && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {skipping ? 'در حال ثبت…' : 'بعداً اضافه می‌کنم'}
          </button>
        )}
      </motion.div>
      <motion.button
        variants={staggerChild}
        type="button"
        onClick={onBack}
        className="spatial-press mx-auto mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-medium text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4 rotate-180" />
        بازگشت به مرحله ایجنت
      </motion.button>
      </>
      )}
    </motion.div>
  )
}

// ─── Step 6: Done ───────────────────────────────────────────────
function DoneStep() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [leaving, setLeaving] = useState(false)

  async function finish() {
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
      router.push('/overview')
      router.refresh()
      return
    }
    window.setTimeout(() => {
      router.push('/overview')
      router.refresh()
    }, 220)
  }

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-lg text-center"
    >
      <motion.div variants={staggerChild} className="mx-auto flex justify-center">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="grid h-24 w-24 place-items-center rounded-full bg-[var(--text-primary)] text-white"
          style={{ boxShadow: 'var(--shadow-lift)' }}
        >
          <CheckCircle2 className="h-12 w-12" strokeWidth={1.5} />
        </motion.div>
      </motion.div>

      <motion.h2 variants={staggerChild} className="mt-6 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
        راه‌اندازی کامل شد!
      </motion.h2>

      <motion.p variants={staggerChild} className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
        ایجنت شما آماده است. اکنون می‌توانید به داشبورد بروید و گفتگوها را مدیریت کنید.
      </motion.p>

      <motion.div variants={staggerChild} className="mt-8">
        <button
          type="button"
          onClick={() => void finish()}
          disabled={leaving}
          className="spatial-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-8 text-[13px] font-medium text-white shadow-[var(--shadow-control)] hover:bg-black disabled:opacity-70"
        >
          {leaving ? 'در حال آماده‌سازی داشبورد…' : 'ورود به داشبورد'}
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
              <p className="mt-3 text-sm font-semibold">Vigento AI | هوش مصنوعی ویجنتو</p>
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
