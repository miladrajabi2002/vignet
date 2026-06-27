/**
 * Day-of-week × hour activity heatmap. Pure CSS grid (no chart lib) using
 * monochrome opacity to encode intensity, matching the B&W design system.
 *
 * `matrix` is 7 rows (Sat→Fri or locale order supplied by caller) × 24 columns.
 */
export function HourlyHeatmap({
  matrix,
  dayLabels,
  emptyText,
}: {
  matrix: number[][]
  dayLabels: string[]
  emptyText: string
}) {
  const max = Math.max(1, ...matrix.flat())
  const total = matrix.flat().reduce((a, b) => a + b, 0)

  if (total === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-[var(--text-muted)]">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        {matrix.map((row, d) => (
          <div key={d} className="flex items-center gap-1">
            <span className="w-8 shrink-0 text-[10px] text-[var(--text-muted)]">
              {dayLabels[d]}
            </span>
            <div className="flex flex-1 gap-[3px] py-[2px]">
              {row.map((v, h) => (
                <div
                  key={h}
                  title={`${v}`}
                  className="h-3.5 flex-1 rounded-[3px]"
                  style={{
                    backgroundColor:
                      v === 0
                        ? 'rgba(255,255,255,0.04)'
                        : `rgba(255,255,255,${0.12 + (v / max) * 0.78})`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-1 flex gap-1">
          <span className="w-8 shrink-0" />
          <div className="flex flex-1 justify-between text-[9px] text-[var(--text-hint)]">
            <span>0</span>
            <span>6</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
      </div>
    </div>
  )
}
