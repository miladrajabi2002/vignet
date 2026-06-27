'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

/**
 * Wraps page content in a soft fade/slide transition keyed on the pathname, so
 * client-side route changes animate in. Keep transitions subtle and B&W-safe.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
