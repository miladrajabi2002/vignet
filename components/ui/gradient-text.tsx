import { cn } from '@/lib/utils'

/**
 * Renders text with the monochrome top-down white→grey gradient used across the
 * marketing site (the `.gradient-text` utility). Keeps the effect in one place.
 */
export function GradientText({
  children,
  className,
  as: Tag = 'span',
}: {
  children: React.ReactNode
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p'
}) {
  return <Tag className={cn('gradient-text', className)}>{children}</Tag>
}
