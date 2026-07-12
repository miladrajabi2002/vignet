'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
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
  Rocket,
  Settings2,
  ShoppingBag,
  Sparkles,
  Utensils,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BUSINESS_TYPES,
  getVerticalPack,
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
type Phase = 'type' | 'details' | 'agent' | 'knowledge' | 'test' | 'channel' | 'done'

const PHASES: { key: Phase; label: string; icon: LucideIcon }[] = [
  { key: 'type', label: 'کسب‌وکار', icon: Rocket },
  { key: 'details', label: 'اطلاعات', icon: Briefcase },
  { key: 'agent', label: 'ایجنت', icon: Sparkles },
  { key: 'knowledge', label: 'دانش', icon: Package },
  { key: 'test', label: 'آزمایش', icon: Sparkles },
  { key: 'channel', label: 'اتصال', icon: Plug },
  { key: 'done', label: 'پایان', icon: CheckCircle2 },
]

// ─── Main component ─────────────────────────────────────────────
interface Props {
  hasProfile: boolean
  hasAgent: boolean
  hasKnowledge: boolean
  hasConversation: boolean
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
  hasConversation,
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

  // Determine current phase from server state
  const serverPhase: Phase = (() => {
    if (!hasProfile) return 'type'
    if (!hasAgent) return 'agent'
    if (!hasKnowledge) return 'knowledge'
    if (!hasConversation) return 'test'
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

  const phaseIndex = PHASES.findIndex((p) => p.key === currentPhase)

  return (
    <div className="relative min-h-dvh bg-[var(--bg-base)]">
      {/* ─── Ambient background ─── */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-0 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[var(--bg-surface)] opacity-60 blur-3xl" />
      </div>

      {/* ─── Progress header ─── */}
      <div className="sticky top-0 z-20 border-b border-[var(--border-default)] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 sm:px-8">
          {PHASES.map((p, i) => {
            const Icon = p.icon
            const isDone = i < phaseIndex
            const isCurrent = i === phaseIndex
            const isFuture = i > phaseIndex
            return (
              <div key={p.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.08 : 1,
                    }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className={cn(
                      'relative grid h-9 w-9 place-items-center rounded-full border-2 transition-colors duration-300',
                      isDone && 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white',
                      isCurrent && 'border-[var(--text-primary)] bg-white text-[var(--text-primary)]',
                      isFuture && 'border-[var(--border-default)] bg-white text-[var(--text-hint)]',
                    )}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : (
                      <Icon className="h-4 w-4" strokeWidth={isCurrent ? 2.5 : 1.5} />
                    )}
                    {isCurrent && (
                      <motion.span
                        layoutId="phase-glow"
                        className="absolute -inset-1 rounded-full border-2 border-[var(--text-primary)] opacity-20"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0, 0.2] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                  </motion.div>
                  <span className={cn(
                    'hidden text-[10px] font-medium transition-colors duration-300 sm:block',
                    isCurrent ? 'text-[var(--text-primary)]' : isDone ? 'text-[var(--text-secondary)]' : 'text-[var(--text-hint)]'
                  )}>
                    {p.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className="relative mx-1.5 mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-[var(--border-default)]">
                    <motion.div
                      initial={false}
                      animate={{ width: isDone ? '100%' : '0%' }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="h-full rounded-full bg-[var(--text-primary)]"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Step content ─── */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-68px)] max-w-6xl flex-col justify-center px-4 py-4 sm:px-8 lg:h-[calc(100dvh-68px)] lg:overflow-hidden">
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
                step={3}
                title="ایجنت هوشمند بسازید"
                subtitle="دستیار شما برای پاسخ‌گویی به مشتریان"
                tip="ایجنت پیام مشتری را می‌فهمد، از محصولات شما پاسخ می‌دهد و سفارش می‌گیرد. با هوش مصنوعی یا دستی — انتخاب با شماست."
                ctaLabel="ساخت ایجنت"
                ctaHref={agentTemplate ? `/agents/new?business=${agentTemplate}` : '/agents/new'}
                done={hasAgent}
              />
            )}

            {currentPhase === 'knowledge' && (
              <CtaStep
                icon={Package}
                step={4}
                title="محصولات یا خدمات را اضافه کنید"
                subtitle="ایجنت برای پاسخ دقیق، به شناخت کسب‌وکار شما نیاز دارد"
                tip="محصولات را با نام، قیمت و موجودی وارد کنید. ایجنت از این داده‌ها برای پیشنهاد و فروش استفاده می‌کند."
                ctaLabel="افزودن محصولات"
                ctaHref="/products"
                done={hasKnowledge}
              />
            )}

            {currentPhase === 'test' && (
              <CtaStep
                icon={Sparkles}
                step={5}
                title="ایجنت را در یک گفتگوی واقعی آزمایش کنید"
                subtitle="قبل از اتصال به مشتری، یک سؤال عادی و یک درخواست اپراتور را امتحان کنید"
                tip="این تست هم کیفیت پاسخ را روشن می‌کند و هم مسیر تحویل به انسان را قبل از شروع کار واقعی بررسی می‌کند."
                ctaLabel="باز کردن محیط آزمایش"
                ctaHref={agentId ? `/agents/${agentId}` : '/agents'}
                done={hasConversation}
              />
            )}

            {currentPhase === 'channel' && (
              <CtaStep
                icon={Plug}
                step={6}
                title="یک کانال متصل کنید"
                subtitle="ایجنت را به اینستاگرام، تلگرام، واتساپ یا وب متصل کنید"
                tip="پس از اتصال، پیام‌های مشتریان مستقیماً به ایجنت می‌رسند و پاسخ می‌گیرند — بدون کار اضافه از شما."
                ctaLabel="اتصال کانال"
                ctaHref={businessType === 'SOCIAL'
                  ? '/instagram'
                  : agentId ? `/agents/${agentId}/channels` : '/agents'}
                done={hasChannel}
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
          مرحله ۱ از ۶
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
  const suggestions = pack.suggestedServicesFa
  const [businessName, setBusinessName] = useState(initialProfile?.businessName ?? workspaceName)
  const [services, setServices] = useState<string[]>(initialProfile?.services ?? suggestions.slice(0, 2))
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
          مرحله ۲ از ۶
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
        <div>
          <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">خدمات اصلی</div>
          <p className="mb-3 text-[12px] text-[var(--text-muted)]">حداقل یک مورد را انتخاب کنید</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((service) => {
              const active = services.includes(service)
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => {
                    setServices((s) => s.includes(service) ? s.filter((x) => x !== service) : [...s, service])
                    setError('')
                  }}
                  className={cn(
                    'min-h-10 rounded-xl border px-4 text-[13px] transition-all duration-200',
                    active
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                      : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-hover)]',
                  )}
                >
                  {active && <Check className="me-1.5 inline h-3.5 w-3.5" strokeWidth={3} />}
                  {service}
                </button>
              )
            })}
          </div>
        </div>

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
}: {
  icon: LucideIcon
  step: number
  title: string
  subtitle: string
  tip: string
  ctaLabel: string
  ctaHref: string
  done?: boolean
}) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="mx-auto max-w-lg text-center">
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
        مرحله {step} از ۵
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
      <motion.div variants={staggerChild} className="mt-8">
        {done ? (
          <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
            <motion.span
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="grid h-7 w-7 place-items-center rounded-full bg-[var(--text-primary)] text-white"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </motion.span>
            این مرحله تکمیل شد
          </div>
        ) : (
          <a
            href={ctaHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-8 text-[13px] font-medium text-white transition-all duration-200 hover:bg-black"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            {ctaLabel}
            <ArrowLeft className="h-4 w-4 rtl:rotate-0" />
          </a>
        )}
      </motion.div>

      {done && (
        <motion.p variants={staggerChild} className="mt-3 text-xs text-[var(--text-muted)]">
          در حال انتقال به مرحله بعد…
        </motion.p>
      )}
    </motion.div>
  )
}

// ─── Step 6: Done ───────────────────────────────────────────────
function DoneStep() {
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
        <a
          href="/overview"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-8 text-[13px] font-medium text-white transition-all duration-200 hover:bg-black"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          ورود به داشبورد
          <ArrowLeft className="h-4 w-4 rtl:rotate-0" />
        </a>
      </motion.div>
    </motion.div>
  )
}
