import Link from 'next/link'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4">
      {/* Subtle dot grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage:
            'radial-gradient(ellipse 60% 60% at 50% 40%, black, transparent)',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 60% at 50% 40%, black, transparent)',
        }}
      />
      <Link
        href="/"
        className="absolute top-8 font-mono text-lg font-medium tracking-widest text-white"
      >
        VIGENT
      </Link>
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  )
}
