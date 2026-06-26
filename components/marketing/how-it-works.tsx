'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'

export function HowItWorks() {
  const t = useTranslations('marketing.how')
  const steps = [t('step1'), t('step2'), t('step3')]

  return (
    <section className="bg-black py-28">
      <div className="mx-auto max-w-5xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center text-3xl font-light text-white md:text-4xl"
        >
          {t('title')}
        </motion.h2>

        <div className="relative mt-20 grid grid-cols-1 gap-12 md:grid-cols-3">
          {/* Connector line */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent md:block"
          />
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black font-mono text-lg text-white">
                {i + 1}
              </div>
              <p className="mt-5 max-w-[14rem] text-white/60">{step}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
