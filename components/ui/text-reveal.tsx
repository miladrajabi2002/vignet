'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Mask-reveal text animation: words rise into view from behind a clip on scroll.
 * Staggered with Framer Motion. Purely presentational.
 */
export function TextReveal({
  text,
  className,
  delay = 0,
}: {
  text: string
  className?: string
  delay?: number
}) {
  const words = text.split(' ')
  return (
    <span className={cn('inline-flex flex-wrap', className)}>
      {words.map((word, i) => (
        <span key={i} className="mx-[0.25ch] overflow-hidden py-[0.1em]">
          <motion.span
            className="inline-block"
            initial={{ y: '110%' }}
            whileInView={{ y: '0%' }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{
              duration: 0.6,
              ease: [0.16, 1, 0.3, 1],
              delay: delay + i * 0.05,
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  )
}
