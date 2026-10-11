/**
 * The one chart palette, for the user dashboard and the owner console alike.
 * A plain module (no 'use client') so server pages can pass these to the
 * client charts as ordinary strings.
 *
 * A metric keeps its colour on every page:
 *   1st series  iris, drawn with a soft area  (the thing the chart is about)
 *   2nd series  ink, a thin line              (a subset or a comparison)
 *   3rd series  warm grey
 * Amber and red are not series colours: they mean "handed to an operator"
 * and "error", and appear only on those.
 */

/** Ink: the second series. */
export const CHART_INK = '#111111'
/** The accent (--signal): the first series. */
export const CHART_ACCENT = '#5b3de8'
/** Iris 200: the accent's tint, for the quieter half of a stacked bar. */
export const CHART_ACCENT_TINT = '#d5cdff'
/** Warm grey: the third series. */
export const CHART_GREY = '#8c8780'
/** Status, never decoration: a conversation handed to a human. */
export const CHART_HANDOFF = '#d97706'
/** Status, never decoration: errors and failures. */
export const CHART_ERROR = '#dc2626'

/** Donut/pie series: the accent first, then ink, grey and their quieter steps. */
export const CHART_COLORS = [
  CHART_ACCENT,
  CHART_INK,
  CHART_GREY,
  '#b9adff', // iris 300
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
  TRIAL: CHART_GREY,
}
