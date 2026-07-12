'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Settings, Wand2 } from 'lucide-react'
import { AgentWizard } from '@/components/agent-builder/agent-wizard'
import { VigentoComposer } from '@/components/agent-builder/vigento-composer'

type BuildMode = 'choice' | 'ai' | 'manual'

interface Props {
  initialBusiness?: string
  workspaceProductCount?: number
  modelPolicy: {
    plan: 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS'
    enabledModels: string[]
    trialModel: string
    creditBalanceIRR: number
    replyPricesIRR: Record<string, number>
  }
}

export function AgentBuilderEntry({ initialBusiness, workspaceProductCount, modelPolicy }: Props) {
  const [mode, setMode] = useState<BuildMode>('choice')

  // The choice screen lets the user pick AI-guided or manual
  if (mode === 'choice') {
    return <ChoiceScreen onPick={setMode} />
  }

  // Both modes use the same AgentWizard, but AI mode shows the VigentoComposer
  // prominently at the top
  return (
    <div className="space-y-5">
      {mode === 'ai' && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-white p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--text-primary)] text-white">
              <Wand2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">ویجنتو</h2>
              <p className="text-[11px] text-[var(--text-muted)]">دستیار هوشمند ساخت ایجنت</p>
            </div>
          </div>
          <VigentoComposer
            locale="fa"
            currentName=""
            onApply={() => {
              // After applying, switch to manual mode to review/edit
              setMode('manual')
            }}
          />
        </div>
      )}

      <AgentWizard
        initialBusiness={initialBusiness}
        workspaceProductCount={workspaceProductCount}
        modelPolicy={modelPolicy as never}
      />
    </div>
  )
}

function ChoiceScreen({ onPick }: { onPick: (mode: 'ai' | 'manual') => void }) {
  const fa = true // RTL Persian
  const Arrow = fa ? ArrowLeft : ArrowRight

  return (
    <div className="mx-auto max-w-2xl py-8">
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
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white p-6 text-start transition-colors duration-150 hover:border-[var(--text-primary)]"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--text-primary)] text-white">
            <Wand2 className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-[var(--text-primary)]">
            {fa ? 'ساخت با هوش مصنوعی' : 'Build with AI'}
          </h2>
          <p className="mt-1.5 text-[13px] leading-5 text-[var(--text-muted)]">
            {fa ? 'ویجنتو، دستیار هوشمند ما، از توضیح شما یک ایجنت کامل می‌سازد. سریع‌ترین راه.' : 'Vigento, our AI copilot, builds a complete agent from your description. Fastest path.'}
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
            {fa ? 'شروع' : 'Start'}
            <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
          </div>
        </motion.button>

        {/* Manual option */}
        <motion.button
          onClick={() => onPick('manual')}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white p-6 text-start transition-colors duration-150 hover:border-[var(--text-primary)]"
          style={{ boxShadow: 'var(--shadow-card)' }}
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
