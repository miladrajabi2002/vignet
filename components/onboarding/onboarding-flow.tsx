'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Package,
  Plug,
  Rocket,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BusinessProfileStep } from '@/components/onboarding/business-profile-step'

type Phase = 'profile' | 'agent' | 'knowledge' | 'channel' | 'done'

interface Props {
  hasProfile: boolean
  hasAgent: boolean
  hasKnowledge: boolean
  hasChannel: boolean
  workspaceName: string
  businessType: string | null
  businessProfile: { businessName: string; services: string[] } | null
  agentTemplate?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

export function OnboardingFlow({
  hasProfile,
  hasAgent,
  hasKnowledge,
  hasChannel,
  workspaceName,
  businessType,
  businessProfile,
  agentTemplate,
}: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>(() => {
    if (!hasProfile) return 'profile'
    if (!hasAgent) return 'agent'
    if (!hasKnowledge) return 'knowledge'
    if (!hasChannel) return 'channel'
    return 'done'
  })

  // Auto-advance: poll for state changes when user returns from CTAs
  useEffect(() => {
    if (phase === 'done') return
    const interval = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(interval)
  }, [phase, router])

  // Determine phase from props (auto-advances when server state changes)
  useEffect(() => {
    if (!hasProfile) setPhase('profile')
    else if (!hasAgent) setPhase('agent')
    else if (!hasKnowledge) setPhase('knowledge')
    else if (!hasChannel) setPhase('channel')
    else setPhase('done')
  }, [hasProfile, hasAgent, hasKnowledge, hasChannel])

  const phases: { key: Phase; label: string; icon: LucideIcon }[] = [
    { key: 'profile', label: 'کسب‌وکار', icon: Rocket },
    { key: 'agent', label: 'ایجنت', icon: Bot },
    { key: 'knowledge', label: 'دانش', icon: Package },
    { key: 'channel', label: 'اتصال', icon: Plug },
    { key: 'done', label: 'پایان', icon: CheckCircle2 },
  ]

  const currentIndex = phases.findIndex((p) => p.key === phase)

  return (
    <div className="min-h-dvh">
      {/* Progress indicator — all 5 steps visible at top */}
      <div className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          {phases.map((p, i) => {
            const Icon = p.icon
            const isDone = i < currentIndex
            const isCurrent = i === currentIndex
            return (
              <div key={p.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.05 : 1,
                      backgroundColor: isDone || isCurrent ? 'rgb(17, 17, 17)' : 'rgb(255, 255, 255)',
                      color: isDone || isCurrent ? 'rgb(255, 255, 255)' : 'rgb(107, 114, 128)',
                    }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-full border transition-colors',
                      isDone || isCurrent
                        ? 'border-[var(--text-primary)]'
                        : 'border-[var(--border-default)]',
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </motion.div>
                  <span className={cn(
                    'text-[10px] font-medium',
                    isCurrent ? 'text-[var(--text-primary)]' : isDone ? 'text-[var(--text-secondary)]' : 'text-[var(--text-hint)]'
                  )}>
                    {p.label}
                  </span>
                </div>
                {i < phases.length - 1 && (
                  <div className={cn(
                    'mx-1 h-px flex-1 rounded-full transition-colors duration-300',
                    i < currentIndex ? 'bg-[var(--text-primary)]' : 'bg-[var(--border-default)]'
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Phase content — animated transitions */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <AnimatePresence mode="wait">
          {phase === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <BusinessProfileStep
                workspaceName={workspaceName}
                initialType={businessType as never}
                initialProfile={businessProfile}
              />
            </motion.div>
          )}

          {phase === 'agent' && (
            <StepCard
              key="agent"
              icon={Bot}
              title="ایجنت خود را بسازید"
              subtitle="یک ایجنت هوشمند برای پاسخ‌گویی به مشتریان بسازید. با هوش مصنوعی یا دستی."
              tip="ایجنت همان دستیار هوشمند شماست — به مشتریان پاسخ می‌دهد، محصول می‌شناسد و سفارش می‌گیرد."
              ctaLabel="ساخت ایجنت"
              ctaHref={agentTemplate ? `/agents/new?business=${agentTemplate}` : '/agents/new'}
              done={hasAgent}
            />
          )}

          {phase === 'knowledge' && (
            <StepCard
              key="knowledge"
              icon={Package}
              title="محصولات یا دانش خود را اضافه کنید"
              subtitle="ایجنت برای پاسخ‌گویی دقیق، به دانستن محصولات یا خدمات شما نیاز دارد."
              tip="محصولات را با نام، قیمت و موجودی وارد کنید. ایجنت از این اطلاعات برای پاسخ به مشتری استفاده می‌کند."
              ctaLabel="افزودن محصولات"
              ctaHref="/products"
              done={hasKnowledge}
            />
          )}

          {phase === 'channel' && (
            <StepCard
              key="channel"
              icon={Plug}
              title="یک کانال متصل کنید"
              subtitle="ایجنت را به اینستاگرام، تلگرام، واتساپ یا وب‌سایت خود متصل کنید."
              tip="پس از اتصال، پیام‌های مشتریان مستقیماً به ایجنت شما می‌رسند و پاسخ می‌گیرند."
              ctaLabel="اتصال کانال"
              ctaHref="/agents"
              done={hasChannel}
            />
          )}

          {phase === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
                className="grid h-16 w-16 place-items-center rounded-full bg-[var(--text-primary)] text-white"
              >
                <CheckCircle2 className="h-8 w-8" />
              </motion.div>
              <h2 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
                راه‌اندازی کامل شد!
              </h2>
              <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
                ایجنت شما آماده است. اکنون می‌توانید به داشبورد بروید و گفتگوها را مدیریت کنید.
              </p>
              <a
                href="/overview"
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-black"
              >
                ورود به داشبورد
                <ArrowLeft className="h-4 w-4 rtl:rotate-0" />
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StepCard({
  icon: Icon,
  title,
  subtitle,
  tip,
  ctaLabel,
  ctaHref,
  done,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  tip: string
  ctaLabel: string
  ctaHref: string
  done?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--text-primary)] text-white">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>
          </div>
        </div>

        {/* Tip box */}
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <p className="text-[13px] leading-5 text-[var(--text-secondary)]">{tip}</p>
        </div>

        {/* CTA */}
        <div className="mt-5">
          {done ? (
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--text-muted)]" />
              این مرحله تکمیل شده است
            </div>
          ) : (
            <a
              href={ctaHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-black"
            >
              {ctaLabel}
              <ArrowLeft className="h-4 w-4 rtl:rotate-0" />
            </a>
          )}
        </div>

        {done && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            در حال انتقال به مرحله بعد…
          </p>
        )}
      </div>
    </motion.div>
  )
}
