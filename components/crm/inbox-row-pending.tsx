'use client'

import { useLinkStatus } from 'next/link'
import { Loader2 } from 'lucide-react'

/** Spinner inside an inbox row while its conversation is loading. */
export function InboxRowPending() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" aria-hidden="true" />
}
