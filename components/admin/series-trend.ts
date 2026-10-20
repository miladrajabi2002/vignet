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
 * Period-over-period trend: the mean of the last `windowDays` complete days
 * against the mean of the `windowDays` before them. `series` runs oldest →
 * newest and ends with today, which is still partial, so it is left out.
 * One quiet or busy day barely moves a window mean, unlike first-vs-last.
 */
export function computePeriodTrend(
  series: number[],
  windowDays: number,
): { direction: TrendDirection; pct: number } {
  const complete = (series ?? []).slice(0, -1)
  const recent = complete.slice(-windowDays)
  const previous = complete.slice(-2 * windowDays, -windowDays)
  if (recent.length === 0 || previous.length === 0) return { direction: 'flat', pct: 0 }

  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
  const recentMean = mean(recent)
  const previousMean = mean(previous)

  if (previousMean === 0 && recentMean === 0) return { direction: 'flat', pct: 0 }
  if (previousMean === 0) return { direction: 'up', pct: 100 }

  const pct = Math.round(((recentMean - previousMean) / previousMean) * 100)
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
