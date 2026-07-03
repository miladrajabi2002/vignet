import type { ReactNode } from 'react'

// The site uses a single light theme (see globals.css). No theme provider is
// needed — kept as a thin passthrough so the root layout has a stable wrapper
// for any future client-side providers.
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>
}
