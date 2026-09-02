'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  Briefcase,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
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
  businessType,
  businessProfile,
  agentTemplate,
}: Props) {
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
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col justify-center px-4 py-5 sm:px-8 lg:overflow-hidden">
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
                businessLabel={getVerticalPack(draftBusinessType ?? businessType).titleFa}
                customHref={agentTemplate ? `/agents/new?business=${agentTemplate}&onboarding=1` : '/agents/new?onboarding=1'}
                onBack={() => { setDirection(-1); setPhaseOverride('details') }}
                onContinue={() => { setDirection(1); setPhaseOverride('knowledge') }}
                onRecommendedCreated={(createdAgentId) => {
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
              <CtaStep
                icon={Plug}
                step={4}
                title="در صورت تمایل یک برنامه متصل کنید"
                subtitle="می‌توانید ایجنت را به اینستاگرام، تلگرام یا گفتگوی سایت متصل کنید"
                tip="این مرحله اختیاری است. با اتصال یک برنامه، پیام مشتری مستقیماً به ایجنت می‌رسد؛ هر زمان بخواهید از پنل هم می‌توانید این کار را انجام دهید."
                ctaLabel="اتصال یک برنامه"
                ctaHref={businessType === 'SOCIAL'
                  ? '/instagram'
                  : resolvedAgentId ? `/agents/${resolvedAgentId}/channels` : '/agents'}
                done={hasChannel}
                skipLabel="فعلاً بدون اتصال ادامه می‌دهم"
                onSkip={async () => {
                  await skipSetupStep('SKIP_CHANNEL', router)
                  setDirection(1)
                  setPhaseOverride('done')
                }}
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
  initialType,
  initialProfile,
  onBack,
  onNext,
}: {
  initialType: BusinessTypeValue
  initialProfile: { businessName: string; services: string[] } | null
  onBack: () => void
  onNext: () => void
}) {
  const pack = getVerticalPack(initialType)
  const suggestions = getBusinessServiceOptions(initialType)
  const [businessName, setBusinessName] = useState(initialProfile?.businessName ?? '')
  const [services, setServices] = useState<string[]>(initialProfile?.services ?? suggestions.slice(0, 2).map((option) => option.fa))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nameInvalid, setNameInvalid] = useState(false)
  const businessNameRef = useRef<HTMLInputElement>(null)
  const reduceMotion = useReducedMotion()

  const Icon = ICONS[initialType]

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
          <label
            htmlFor="business-name"
            className={cn(
              'mb-2 block text-[13px] font-medium',
              nameInvalid ? 'text-red-600' : 'text-[var(--text-primary)]',
            )}
          >
            نام کسب‌وکار
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
            placeholder="مثلاً فروشگاه رزین‌مهر"
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
                ? 'این فیلد خالی است؛ لطفاً نام کسب‌وکار را وارد کنید.'
                : 'نام کسب‌وکار باید حداقل دو حرف داشته باشد.'}
            </p>
          )}
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

// ─── Step 2: Create a recommended or customized agent ───────────
function AgentStep({
  done,
  businessLabel,
  customHref,
  onBack,
  onContinue,
  onRecommendedCreated,
}: {
  done: boolean
  businessLabel: string
  customHref: string
  onBack: () => void
  onContinue: () => void
  onRecommendedCreated: (agentId: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function createRecommended() {
    if (creating) return
    setCreating(true)
    setError('')
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupMode: 'recommended' }),
      })
      if (!response.ok) throw new Error('CREATE_FAILED')
      const data = await response.json().catch(() => null)
      const createdAgentId = data?.agent?.id
      if (typeof createdAgentId !== 'string' || !createdAgentId) throw new Error('INVALID_AGENT')
      onRecommendedCreated(createdAgentId)
    } catch {
      setError('ساخت ایجنت انجام نشد؛ دوباره تلاش کنید.')
      setCreating(false)
    }
  }

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-2xl text-center">
      <motion.div variants={staggerChild} className="mx-auto flex justify-center">
        <div className="relative">
          <motion.div
            animate={done ? {} : { scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--text-primary)] text-white"
            style={{ boxShadow: 'var(--shadow-lift)' }}
          >
            {done ? <Check className="h-9 w-9" strokeWidth={2} /> : <Sparkles className="h-9 w-9" strokeWidth={1.5} />}
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
        مرحله ۲ از ۴
      </motion.p>
      <motion.h2 variants={staggerChild} className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
        {done ? 'ایجنت شما ساخته شد' : 'ایجنت هوشمند خود را بسازید'}
      </motion.h2>
      <motion.p variants={staggerChild} className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-muted)]">
        {done
          ? 'ایجنت آماده است؛ حالا می‌توانید محصولات و خدمات را به آن متصل کنید.'
          : `یک ایجنت آماده و متناسب با «${businessLabel}» بسازید یا جزئیات را خودتان شخصی‌سازی کنید.`}
      </motion.p>

      {done ? (
        <motion.button
          variants={staggerChild}
          type="button"
          onClick={onContinue}
          className="spatial-press mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-8 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
        >
          ادامه به محصولات و خدمات
          <ArrowLeft className="h-4 w-4" />
        </motion.button>
      ) : (
        <motion.div variants={staggerChild} className="mt-7 grid gap-3 text-start sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void createRecommended()}
            disabled={creating}
            aria-busy={creating}
            className="group spatial-press flex min-h-44 w-full cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-[var(--text-primary)] p-4 text-start text-white shadow-[var(--shadow-control)] transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--border-strong)] disabled:cursor-wait disabled:opacity-70"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </span>
            <span className="flex min-w-0 flex-1 self-stretch flex-col items-start">
              <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold text-white/90">پیشنهاد ویجنت</span>
              <span className="mt-3 text-sm font-semibold leading-6">
                {creating ? 'در حال ساخت ایجنت…' : 'ساخت ایجنت هوشمند متناسب با کسب‌وکار من'}
              </span>
              <span className="mt-1 text-[11px] leading-5 text-white/70">نام، نقش و رفتار پیشنهادی به‌صورت خودکار تنظیم می‌شود.</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[11px] font-semibold text-white">
                {creating ? 'لطفاً صبر کنید' : 'ساخت خودکار ایجنت'}
                {!creating && <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />}
              </span>
            </span>
          </button>

          <a
            href={customHref}
            className="group spatial-surface spatial-press flex min-h-44 w-full cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border-default)] p-4 text-start transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--border-default)]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)]">
              <Settings2 className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 self-stretch flex-col items-start">
              <span className="rounded-full bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">انتخاب شخصی‌سازی‌شده</span>
              <span className="mt-3 text-sm font-semibold leading-6 text-[var(--text-primary)]">ساخت ایجنت با شخصی‌سازی</span>
              <span className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">نام، نقش، لحن، زبان و قواعد پاسخ‌گویی را خودتان تنظیم کنید.</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[11px] font-semibold text-[var(--text-primary)]">
                انتخاب و شخصی‌سازی
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              </span>
            </span>
          </a>
        </motion.div>
      )}

      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      <motion.button
        variants={staggerChild}
        type="button"
        onClick={onBack}
        className="spatial-press mx-auto mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-medium text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4 rotate-180" />
        بازگشت به اطلاعات کسب‌وکار
      </motion.button>
    </motion.div>
  )
}

// ─── Shared CTA step ────────────────────────────────────────────
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
      <motion.div variants={staggerChild} className="mx-auto mt-8 flex w-full max-w-sm flex-col items-stretch gap-3">
        {done ? (
          <button
            type="button"
            onClick={onContinue}
            className="spatial-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-8 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
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
              className="spatial-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-8 text-[13px] font-medium text-white shadow-[var(--shadow-control)] hover:bg-black"
            >
              {ctaLabel}
              <ArrowLeft className="h-4 w-4 rtl:rotate-0" />
            </a>
            {skipLabel && onSkip && (
              <button
                type="button"
                onClick={() => void skip()}
                disabled={skipping}
                className="spatial-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-5 text-[13px] font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] transition-[border-color,color,box-shadow] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:shadow-[var(--shadow-control)] disabled:cursor-wait disabled:opacity-50"
              >
                {skipping && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {skipping ? 'در حال ثبت…' : skipLabel}
                {!skipping && <ArrowLeft className="h-4 w-4" />}
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

// ─── Step 3: Optional products / services and WooCommerce ──────────────
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
            محصولات و خدمات کسب‌وکار
          </motion.h2>

          <motion.p variants={staggerChild} className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-muted)]">
            این مرحله اختیاری است. پس از پایان راه‌اندازی هم می‌توانید محصولات و خدمات را از منوی پنل اضافه کنید.
          </motion.p>
        </>
      )}

      {showWizard ? (
        <motion.div variants={staggerChild} className="mt-2 text-start">
          <WooConnectWizard
            onConnected={() => {
              setShowWizard(false)
              if (onWooConnected) onWooConnected()
              else onContinue()
            }}
            onDismiss={() => setShowWizard(false)}
          />
        </motion.div>
      ) : (
        <motion.div variants={staggerChild} className="mt-6 text-start">
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="spatial-surface spatial-press group relative w-full overflow-hidden rounded-[1.5rem] p-5 text-start transition-[border-color] hover:border-[var(--border-strong)]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
                <Link2 className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent-strong)]">
                پیشنهادی در صورت داشتن سایت
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-[var(--text-primary)]">
              اتصال سایت وردپرس یا فروشگاه ووکامرس
            </h3>
            <p className="mt-1.5 text-[12px] leading-6 text-[var(--text-muted)]">
              اگر سایت وردپرسی دارید یا محصولاتتان در ووکامرس ثبت شده، سایت را متصل کنید تا محصولات و سفارش‌ها خودکار وارد و همگام شوند.
            </p>
            <span className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-xs font-semibold text-white shadow-[var(--shadow-control)]">
              برای اتصال کلیک کنید
              <ArrowLeft className="h-3.5 w-3.5" />
            </span>
          </button>
        </motion.div>
      )}

      {!showWizard && (
        <>
          <motion.div variants={staggerChild} className="mt-4 flex flex-col items-stretch gap-2">
            {done ? (
              <button
                type="button"
                onClick={onContinue}
                className="spatial-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-8 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
              >
                <Check className="h-4 w-4" strokeWidth={3} />
                ادامه به برنامه‌های متصل
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void skip()}
                disabled={skipping}
                className="spatial-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-5 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-50"
              >
                {skipping && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {skipping ? 'در حال ثبت…' : 'فعلاً سایت، محصول یا خدمتی برای اتصال ندارم'}
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

// ─── Final step ─────────────────────────────────────────────────
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
