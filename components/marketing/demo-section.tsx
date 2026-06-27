'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { TextReveal } from '@/components/ui/text-reveal'

/**
 * "See it in action" section: a mocked chat exchange inside a spotlight card,
 * framed by a mask-revealed headline. Pure B&W, illustrative only.
 */
export function DemoSection() {
  const t = useTranslations('marketing.demo')
  const bubbles = t.raw('bubbles') as { role: 'user' | 'agent'; text: string }[]

  return (
    <section className="relative overflow-hidden bg-black py-28">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="text-center text-3xl font-light text-white md:text-4xl">
          <TextReveal text={t('title')} />
        </h2>
        <p className="mx-auto mt-4 max-w-md text-center text-white/45">
          {t('subtitle')}
        </p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-14 max-w-lg"
        >
          <SpotlightCard className="p-5">
            <div className="space-y-3">
              {bubbles.map((b, i) => (
                <div
                  key={i}
                  className={
                    b.role === 'user' ? 'flex justify-start' : 'flex justify-end'
                  }
                >
                  <div
                    className={
                      b.role === 'user'
                        ? 'max-w-[80%] rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm text-white/80'
                        : 'max-w-[80%] rounded-2xl bg-white px-4 py-2.5 text-sm text-black'
                    }
                  >
                    {b.text}
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </motion.div>
      </div>
    </section>
  )
}
