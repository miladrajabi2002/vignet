import {
  AlertTriangle,
  ArrowUpRight,
  CircleDot,
  Gauge,
  Lightbulb,
  Sparkles,
  Target,
} from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface SalesInsightView {
  leadType: 'UNCLEAR' | 'INFORMATION_SEEKER' | 'BUYER' | 'EXISTING_CUSTOMER' | 'SUPPORT_SEEKER'
  stage:
    | 'UNKNOWN'
    | 'DISCOVERY'
    | 'INFORMATION_GATHERING'
    | 'CONSIDERATION'
    | 'NEGOTIATION'
    | 'PURCHASE_INTENT'
    | 'POST_PURCHASE'
  buyerReadiness: 'COLD' | 'EXPLORING' | 'WARM' | 'HOT' | 'CUSTOMER'
  buyerProbability: number
  sentiment: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'MIXED' | 'DISTRESSED'
  urgency: 'LOW' | 'MEDIUM' | 'HIGH'
  confidence: number
  objections: string[]
  riskFlags: string[]
  signalCodes: string[]
  recommendedAction: string | null
  explanation: string | null
  handoffRecommended: boolean
  analyzedAt: Date | string
}

type Locale = 'fa' | 'en'

const LABELS = {
  leadType: {
    fa: {
      UNCLEAR: 'نیاز به داده بیشتر',
      INFORMATION_SEEKER: 'در حال کسب اطلاعات',
      BUYER: 'خریدار بالقوه',
      EXISTING_CUSTOMER: 'مشتری فعلی',
      SUPPORT_SEEKER: 'درخواست پشتیبانی',
    },
    en: {
      UNCLEAR: 'Needs more data',
      INFORMATION_SEEKER: 'Information seeker',
      BUYER: 'Potential buyer',
      EXISTING_CUSTOMER: 'Existing customer',
      SUPPORT_SEEKER: 'Support request',
    },
  },
  stage: {
    fa: {
      UNKNOWN: 'نامشخص',
      DISCOVERY: 'کشف نیاز',
      INFORMATION_GATHERING: 'جمع‌آوری اطلاعات',
      CONSIDERATION: 'بررسی گزینه‌ها',
      NEGOTIATION: 'مذاکره',
      PURCHASE_INTENT: 'آماده اقدام',
      POST_PURCHASE: 'پس از خرید',
    },
    en: {
      UNKNOWN: 'Unknown',
      DISCOVERY: 'Discovery',
      INFORMATION_GATHERING: 'Information gathering',
      CONSIDERATION: 'Considering',
      NEGOTIATION: 'Negotiating',
      PURCHASE_INTENT: 'Ready to act',
      POST_PURCHASE: 'Post-purchase',
    },
  },
  readiness: {
    fa: { COLD: 'سرد', EXPLORING: 'در حال بررسی', WARM: 'گرم', HOT: 'داغ', CUSTOMER: 'مشتری' },
    en: { COLD: 'Cold', EXPLORING: 'Exploring', WARM: 'Warm', HOT: 'Hot', CUSTOMER: 'Customer' },
  },
  sentiment: {
    fa: { NEGATIVE: 'منفی', NEUTRAL: 'خنثی', POSITIVE: 'مثبت', MIXED: 'ترکیبی', DISTRESSED: 'ناراضی/تحت فشار' },
    en: { NEGATIVE: 'Negative', NEUTRAL: 'Neutral', POSITIVE: 'Positive', MIXED: 'Mixed', DISTRESSED: 'Distressed' },
  },
  urgency: {
    fa: { LOW: 'کم', MEDIUM: 'متوسط', HIGH: 'زیاد' },
    en: { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' },
  },
} as const

const SIGNAL_LABELS: Record<string, readonly [string, string]> = {
  BUY_COMMITMENT: ['درخواست صریح خرید یا رزرو', 'Explicit purchase or booking request'],
  TRANSACTIONAL_QUESTION: ['پرسش عملیاتی پیش از خرید', 'Transactional pre-purchase question'],
  NEGOTIATION: ['ورود به مذاکره', 'Negotiating terms'],
  CONSIDERATION: ['مقایسه و ارزیابی گزینه‌ها', 'Comparing and evaluating options'],
  NEED_DISCOVERY: ['بیان نیاز یا درخواست پیشنهاد', 'Stated need or recommendation request'],
  INFORMATION: ['درخواست اطلاعات', 'Information request'],
  INFORMATION_ONLY: ['تمرکز روی اطلاعات عمومی', 'General information focus'],
  POST_PURCHASE: ['موضوع پس از خرید', 'Post-purchase topic'],
  SUPPORT: ['درخواست پشتیبانی', 'Support request'],
  POSITIVE_SENTIMENT: ['بازخورد مثبت', 'Positive feedback'],
  NEGATIVE_SENTIMENT: ['نارضایتی یا اصطکاک', 'Dissatisfaction or friction'],
  SEVERE_DISTRESS: ['نارضایتی شدید', 'Severe distress'],
  HIGH_URGENCY: ['فوریت بالا', 'High urgency'],
  MEDIUM_URGENCY: ['محدودیت زمانی', 'Time constraint'],
  HUMAN_REQUEST: ['درخواست اپراتور انسانی', 'Requested a human operator'],
  AUTHORITY_REQUIRED: ['نیاز به اختیار انسانی', 'Human authority may be required'],
  REPEATED_REQUEST: ['تکرار درخواست حل‌نشده', 'Repeated unresolved request'],
  OBJECTION_PRICE: ['مانع قیمت یا بودجه', 'Price or budget objection'],
  OBJECTION_TRUST: ['ابهام درباره اعتماد', 'Trust objection'],
  OBJECTION_FIT: ['ابهام درباره تناسب', 'Fit objection'],
  OBJECTION_TIMING: ['مانع زمان تصمیم', 'Timing objection'],
  OBJECTION_AUTHORITY: ['نیاز به تأیید تصمیم‌گیرنده', 'Decision-authority objection'],
  OBJECTION_COMPETITOR: ['بررسی رقیب یا جایگزین', 'Considering a competitor'],
  OBJECTION_RISK: ['نگرانی درباره ریسک', 'Risk objection'],
}

const RISK_LABELS: Record<string, readonly [string, string]> = {
  SELF_HARM: ['خطر آسیب به خود', 'Self-harm risk'],
  IMMEDIATE_DANGER: ['خطر فوری', 'Immediate danger'],
  LEGAL_THREAT: ['موضوع یا تهدید حقوقی', 'Legal escalation'],
  PAYMENT_DISPUTE: ['اختلاف حساس پرداخت', 'Sensitive payment dispute'],
  ALLERGY: ['حساسیت غذایی/سلامتی', 'Allergy concern'],
  FOOD_SAFETY: ['ایمنی یا مسمومیت غذایی', 'Food safety concern'],
  MEDICAL_URGENCY: ['فوریت پزشکی', 'Medical urgency'],
  ACCOUNT_SECURITY: ['امنیت حساب یا داده', 'Account security concern'],
  COMMERCE_FRAUD: ['احتمال تقلب مالی', 'Potential commerce fraud'],
}

const OBJECTION_LABELS: Record<string, readonly [string, string]> = {
  PRICE: ['قیمت یا بودجه', 'Price or budget'],
  TRUST: ['اعتماد و اطمینان', 'Trust'],
  FIT: ['تناسب با نیاز', 'Fit'],
  TIMING: ['زمان تصمیم', 'Timing'],
  AUTHORITY: ['تأیید تصمیم‌گیرنده', 'Decision authority'],
  COMPETITOR: ['رقیب یا گزینه جایگزین', 'Competitor or alternative'],
  RISK: ['ریسک نتیجه', 'Outcome risk'],
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function humanizeCode(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function signalLabel(code: string, locale: Locale): string {
  const value = SIGNAL_LABELS[code]
  return value ? value[locale === 'fa' ? 0 : 1] : humanizeCode(code)
}

function riskLabel(code: string, locale: Locale): string {
  const value = RISK_LABELS[code]
  return value ? value[locale === 'fa' ? 0 : 1] : humanizeCode(code)
}

function objectionLabel(code: string, locale: Locale): string {
  const value = OBJECTION_LABELS[code]
  return value ? value[locale === 'fa' ? 0 : 1] : humanizeCode(code)
}

function probabilityTone(probability: number): string {
  if (probability >= 75) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700'
  if (probability >= 50) return 'border-amber-500/25 bg-amber-500/10 text-amber-700'
  return 'border-violet-500/20 bg-violet-500/[0.08] text-violet-700'
}

function progressTone(probability: number): string {
  if (probability >= 75) return 'bg-emerald-500'
  if (probability >= 50) return 'bg-amber-500'
  return 'bg-violet-500'
}

export function SalesInsightBadge({
  insight,
  locale,
  className,
  compactOnMobile = false,
}: {
  insight: Pick<SalesInsightView, 'leadType' | 'buyerProbability'>
  locale: Locale
  className?: string
  compactOnMobile?: boolean
}) {
  const probability = clampPercent(insight.buyerProbability)
  const converted = insight.leadType === 'EXISTING_CUSTOMER'
  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  return (
    <span
      className={cn(
        'inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums',
        probabilityTone(probability),
        className,
      )}
      title={locale === 'fa' ? 'برآورد هوشمند احتمال خرید' : 'Estimated purchase probability'}
    >
      <Target className="h-3 w-3" aria-hidden="true" />
      <span className={cn(compactOnMobile && 'hidden sm:inline')}>{LABELS.leadType[locale][insight.leadType]}</span>
      {!converted && <span className={cn(compactOnMobile && 'hidden sm:inline')} aria-hidden="true">·</span>}
      <span>{converted ? (locale === 'fa' ? 'تبدیل‌شده' : 'Converted') : `${nf.format(probability)}٪`}</span>
    </span>
  )
}

export function SalesInsightCard({
  insight,
  locale,
}: {
  insight: SalesInsightView
  locale: Locale
}) {
  const probability = clampPercent(insight.buyerProbability)
  const converted = insight.leadType === 'EXISTING_CUSTOMER'
  const confidence = clampPercent(insight.confidence * 100)
  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  const signals = insight.signalCodes.slice(0, 3)
  const objections = insight.objections.filter(Boolean).slice(0, 2)
  const risks = insight.riskFlags.slice(0, 2)

  return (
    <section className="spatial-surface rounded-[1.5rem] p-4" aria-labelledby="sales-insight-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <h2 id="sales-insight-title">{locale === 'fa' ? 'هوش فروش گفتگو' : 'Conversation sales intelligence'}</h2>
          </div>
          <p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">
            {locale === 'fa'
              ? `تحلیل‌شده ${relativeTime(new Date(insight.analyzedAt), locale)} · اطمینان ${nf.format(confidence)}٪`
              : `Analyzed ${relativeTime(new Date(insight.analyzedAt), locale)} · ${nf.format(confidence)}% confidence`}
          </p>
        </div>
        <SalesInsightBadge insight={insight} locale={locale} />
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">{converted ? (locale === 'fa' ? 'وضعیت خرید' : 'Purchase status') : (locale === 'fa' ? 'احتمال تبدیل به خریدار' : 'Purchase likelihood')}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{converted ? (locale === 'fa' ? 'تبدیل‌شده' : 'Converted') : `${nf.format(probability)}٪`}</p>
          </div>
          <div className="text-end text-[11px] leading-5 text-[var(--text-secondary)]">
            <p>{LABELS.readiness[locale][insight.buyerReadiness]}</p>
            <p>{LABELS.stage[locale][insight.stage]}</p>
          </div>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]"
          role="progressbar"
          aria-label={locale === 'fa' ? 'احتمال خرید' : 'Purchase probability'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={probability}
        >
          <div className={cn('h-full rounded-full', progressTone(probability))} style={{ width: `${probability}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric
          icon={<CircleDot className="h-3.5 w-3.5" />}
          label={locale === 'fa' ? 'لحن' : 'Sentiment'}
          value={LABELS.sentiment[locale][insight.sentiment]}
        />
        <Metric
          icon={<Gauge className="h-3.5 w-3.5" />}
          label={locale === 'fa' ? 'فوریت' : 'Urgency'}
          value={LABELS.urgency[locale][insight.urgency]}
        />
      </div>

      {(insight.explanation || signals.length > 0) && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{locale === 'fa' ? 'نشانه‌های تصمیم' : 'Decision signals'}</p>
          {insight.explanation && <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{insight.explanation}</p>}
          {signals.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {signals.map((code) => (
                <li key={code} className="flex items-start gap-2 text-xs leading-5 text-[var(--text-secondary)]">
                  <CircleDot className="mt-1 h-3 w-3 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  <span>{signalLabel(code, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(objections.length > 0 || risks.length > 0) && (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {locale === 'fa' ? 'مانع یا نکته حساس' : 'Objection or sensitive point'}
          </p>
          <ul className="mt-1.5 space-y-1 text-xs leading-5 text-[var(--text-secondary)]">
            {objections.map((objection) => <li key={objection}>• {objectionLabel(objection, locale)}</li>)}
            {risks.map((risk) => <li key={risk}>• {riskLabel(risk, locale)}</li>)}
          </ul>
        </div>
      )}

      {insight.recommendedAction && (
        <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-800">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            {locale === 'fa' ? 'بهترین اقدام بعدی' : 'Recommended next action'}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-primary)]">{insight.recommendedAction}</p>
          {insight.handoffRecommended && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === 'fa' ? 'ورود اپراتور انسانی توصیه شده است' : 'Human operator involvement is recommended'}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-5 text-[var(--text-muted)]">
        {locale === 'fa' ? 'این درصد یک برآورد تصمیم‌یار است، نه تضمین خرید.' : 'This is a decision-support estimate, not a purchase guarantee.'}
      </p>
    </section>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5">
      <p className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">{icon}{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
