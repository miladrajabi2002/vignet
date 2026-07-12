'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Settings, Wand2 } from 'lucide-react'
import { AgentWizard } from '@/components/agent-builder/agent-wizard'

type BuildMode = 'choice' | 'ai' | 'manual'

interface Props {
  initialBusiness?: string
  workspaceProductCount?: number
  onboardingMode?: boolean
  modelPolicy: {
    plan: 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS'
    enabledModels: string[]
    trialModel: string
    creditBalanceIRR: number
    replyPricesIRR: Record<string, number>
  }
}

export function AgentBuilderEntry({ initialBusiness, workspaceProductCount, onboardingMode = false, modelPolicy }: Props) {
  const [mode, setMode] = useState<BuildMode>('choice')

  // The choice screen lets the user pick AI-guided or manual
  if (mode === 'choice') {
    return <ChoiceScreen onPick={setMode} />
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setMode('choice')}
        className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-medium text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)]"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        تغییر روش ساخت
      </button>
      <AgentWizard
        initialBusiness={initialBusiness}
        workspaceProductCount={workspaceProductCount}
        modelPolicy={modelPolicy as never}
        showVigento={mode === 'ai'}
        onboardingMode={onboardingMode}
      />
    </div>
  )
}

function ChoiceScreen({ onPick }: { onPick: (mode: 'ai' | 'manual') => void }) {
  const fa = true // RTL Persian
  const Arrow = fa ? ArrowLeft : ArrowRight

  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {fa ? 'ایجنت خود را بسازید' : 'Build your agent'}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {fa ? 'یک روش برای شروع انتخاب کنید' : 'Choose a way to get started'}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* AI-guided option */}
        <motion.button
          onClick={() => onPick('ai')}
          whileTap={{ scale: 0.985 }}
          transition={{ duration: 0.15 }}
          className="spatial-surface spatial-press group relative min-h-64 overflow-hidden rounded-[1.75rem] p-6 text-start hover:border-black/20"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--text-primary)] text-white">
            <Wand2 className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-[var(--text-primary)]">
            {fa ? 'ساخت با هوش مصنوعی' : 'Build with AI'}
          </h2>
          <p className="mt-1.5 text-[13px] leading-5 text-[var(--text-muted)]">
            {fa ? 'هوش مصنوعی ویجنتو از توضیح شما یک ایجنت کامل می‌سازد؛ سریع‌ترین مسیر برای شروع.' : 'Vigento AI builds a complete agent from your description. The fastest path.'}
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
            {fa ? 'شروع' : 'Start'}
            <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
          </div>
        </motion.button>

        {/* Manual option */}
        <motion.button
          onClick={() => onPick('manual')}
          whileTap={{ scale: 0.985 }}
          transition={{ duration: 0.15 }}
          className="spatial-surface spatial-press group relative min-h-64 overflow-hidden rounded-[1.75rem] p-6 text-start hover:border-black/20"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
            <Settings className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-[var(--text-primary)]">
            {fa ? 'ساخت دستی' : 'Build manually'}
          </h2>
          <p className="mt-1.5 text-[13px] leading-5 text-[var(--text-muted)]">
            {fa ? 'گام‌به‌گام، تمام تنظیمات را خودتان انجام دهید. کنترل کامل.' : 'Step by step, configure everything yourself. Full control.'}
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
            {fa ? 'شروع' : 'Start'}
            <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
          </div>
        </motion.button>
      </div>
    </div>
  )
}
