/**
 * Chart colours of the owner console. A plain module (no 'use client') so
 * server pages can pass these to the client charts as ordinary strings.
 */

/** Ink: the default series. */
export const CHART_INK = '#111111'
/** The console's one accent (--signal), for a second or highlighted series. */
export const CHART_ACCENT = '#5b3de8'
/** Iris 200: the accent's tint, for the quieter half of a stacked bar. */
export const CHART_ACCENT_TINT = '#d5cdff'

/** Donut/pie series: ink first, then the accent, then their quieter steps. */
export const CHART_COLORS = [
  CHART_INK,
  CHART_ACCENT,
  '#b9adff', // iris 300
  '#8c8780', // warm grey
  '#3d27a6', // iris 800
  CHART_ACCENT_TINT,
  '#55524c', // secondary ink
  '#e6e1ff', // iris 100
]

/**
 * One colour per plan, wherever a plan is drawn (the plan mix, the ring around
 * an account's avatar): the paid tiers carry ink and the accent, the trial
 * stays a neutral grey.
 */
export const PLAN_COLOR: Record<string, string> = {
  BUSINESS: CHART_INK,
  PRO: CHART_ACCENT,
  STARTER: '#b9adff', // iris 300
  TRIAL: '#8c8780', // warm grey
}
