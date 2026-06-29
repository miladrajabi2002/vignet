/**
 * Subtle animated diagonal beam lines for cinematic section backgrounds.
 * Pure CSS, monochrome, non-interactive. Sits behind content (z-0).
 */
export function BeamLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute -left-1/4 top-1/3 h-px w-[150%] -rotate-12 animate-beam bg-gradient-to-r from-transparent via-[var(--border-hover)] to-transparent" />
      <div className="absolute -left-1/4 top-2/3 h-px w-[150%] rotate-12 animate-beam-slow bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />
    </div>
  )
}
