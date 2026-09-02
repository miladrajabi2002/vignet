'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Check, ChevronLeft, Package, Plug, Store } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

const STEPS = [
  { label: 'کسب‌وکار', icon: Store },
  { label: 'ایجنت', icon: Bot },
  { label: 'محصولات و خدمات', icon: Package },
  { label: 'اتصال برنامه', icon: Plug },
] as const

export function OnboardingShell({
  profileComplete,
  hasAgent,
  hasKnowledge,
  hasChannel,
  children,
}: {
  profileComplete: boolean
  hasAgent: boolean
  hasKnowledge: boolean
  hasChannel: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const completed = [profileComplete, hasAgent, hasKnowledge, hasChannel]
  const pathStep = pathname.startsWith('/agents')
    ? 1
    : pathname.startsWith('/products')
      ? 2
      : pathname.startsWith('/integrations') || pathname.includes('/channels') || pathname.startsWith('/instagram')
        ? 3
        : -1
  const firstIncomplete = completed.findIndex((value) => !value)
  const current = pathStep >= 0 ? pathStep : firstIncomplete >= 0 ? firstIncomplete : 3
  const away = pathname !== '/onboarding'
  const setupReady = completed.every(Boolean)

  return (
    <div className="min-h-dvh bg-[var(--bg-base)]">
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="spatial-control mx-auto flex max-w-6xl items-center gap-3 rounded-[1.4rem] px-3 py-2.5 sm:px-4">
          <Link href="/onboarding" aria-label="مسیر راه‌اندازی" className="hidden shrink-0 sm:block">
            <Logo priority className="h-6 w-24" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-2" aria-label="مراحل راه‌اندازی">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const done = completed[index]
              const active = current === index
              return (
                <div key={step.label} className="flex min-w-0 flex-1 items-center last:flex-none">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[11px] transition-colors',
                      done ? 'border-black bg-black text-white' : active ? 'border-black bg-white text-black shadow-[var(--shadow-sm)]' : 'border-[var(--border-default)] bg-white/70 text-[var(--text-hint)]',
                    )}>
                      {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span className={cn('hidden truncate text-[10px] font-semibold lg:block', active || done ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)]')}>{step.label}</span>
                  </div>
                  {index < STEPS.length - 1 && <span className={cn('mx-1.5 h-px min-w-3 flex-1 sm:mx-3', completed[index] ? 'bg-black' : 'bg-[var(--border-default)]')} />}
                </div>
              )
            })}
          </div>
          {away ? (
            <Link href="/onboarding" className="spatial-press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-black px-3 text-[10px] font-semibold text-white shadow-[var(--shadow-control)] sm:text-xs">
              {setupReady ? 'اتصال‌ها تمام شد؛ ادامه' : 'ادامه راه‌اندازی'}
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          ) : <span className="hidden w-24 sm:block" />}
        </div>
      </header>
      <main className={cn('min-h-[calc(100dvh-5rem)]', away && 'px-4 pb-10 pt-5 sm:px-6')}>
        {children}
      </main>
    </div>
  )
}
