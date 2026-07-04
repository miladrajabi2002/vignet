/**
 * TrendSpark — tiny decorative sparkline used on blog cards and post headers.
 * The series is derived deterministically from a seed string (post id) via a
 * seeded LCG with upward drift, so it is stable across renders and unique per
 * post. Single monochrome series drawn from the theme's ink tokens: no axes,
 * no legend, aria-hidden. Pure SVG — safe in server components.
 */
export function TrendSpark({
	seed,
	width = 64,
	height = 22,
}: {
	seed: string
	width?: number
	height?: number
}) {
	let h = 0
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
	const rand = () => {
		h = (h * 1664525 + 1013904223) >>> 0
		return h / 2 ** 32
	}

	const n = 12
	const values: number[] = []
	let v = 30 + rand() * 20
	for (let i = 0; i < n; i++) {
		v += rand() * 14 - 5 // random walk with upward drift
		values.push(v)
	}

	const pad = 3
	const min = Math.min(...values)
	const range = Math.max(...values) - min || 1
	const pts = values.map((val, i) => [
		pad + (i * (width - pad * 2)) / (n - 1),
		height - pad - ((val - min) / range) * (height - pad * 2),
	])
	const line = pts
		.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
		.join(' ')
	const area = `${line} L${(width - pad).toFixed(1)} ${height - pad} L${pad} ${height - pad} Z`
	const [lastX, lastY] = pts[n - 1]

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden
			className="shrink-0"
			style={{ direction: 'ltr' }}
		>
			<path d={area} fill="rgba(var(--ink-rgb),0.06)" />
			<path
				d={line}
				fill="none"
				stroke="rgba(var(--ink-rgb),0.4)"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx={lastX} cy={lastY} r="2" fill="var(--text-primary)" />
		</svg>
	)
}
