/**
 * Direction and size of a daily series' movement. A plain module (no
 * 'use client') so server components can read the same trend the client
 * sparkline colours itself with.
 */

export type TrendDirection = 'up' | 'down' | 'flat'

/**
 * Compares the last value with the first non-zero one.
 * >5% change = up/down, otherwise flat.
 */
export function computeTrend(series: number[]): { direction: TrendDirection; pct: number } {
  if (!series || series.length === 0) return { direction: 'flat', pct: 0 }
  const firstNonZero = series.find((v) => v > 0) ?? 0
  const last = series[series.length - 1] ?? 0

  if (firstNonZero === 0 && last === 0) return { direction: 'flat', pct: 0 }
  if (firstNonZero === 0 && last > 0) return { direction: 'up', pct: 100 }

  const pct = Math.round(((last - firstNonZero) / firstNonZero) * 100)
  if (pct > 5) return { direction: 'up', pct }
  if (pct < -5) return { direction: 'down', pct }
  return { direction: 'flat', pct }
}

/**
 * Whether the movement is good news: `null` when flat. `invert` is for
 * metrics where up is bad (errors, costs).
 */
export function isTrendGood(direction: TrendDirection, invert = false): boolean | null {
  if (direction === 'flat') return null
  return invert ? direction === 'down' : direction === 'up'
}
