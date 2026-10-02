import type { CSSProperties } from 'react'

/**
 * The demo pointer for CSS-only scenes (site.css `.vg-cur-step`): a touch dot
 * that glides onto its target, presses it and fades, so the viewer sees what
 * was clicked before the result appears. Render it inside the `relative`
 * target. `at` is the scene step it plays in (fractions allowed); the press
 * lands ~6% of the clock later, just before step `at + 1`. `clock` overrides
 * the scene clock for loops that do not run on --vg-T (vg-sq*, vg-seg).
 */
export function DemoPointer({ at, clock }: { at: number; clock?: string }) {
	return <span aria-hidden className="vg-cur vg-cur-step" style={{ '--vg-cur-at': at, ...(clock ? { '--vg-T': clock } : null) } as CSSProperties}><i /></span>
}
