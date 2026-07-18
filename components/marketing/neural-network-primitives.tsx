type NeuralSignalParticleProps = {
	path: string
	delay: number
	filterId: string
	duration?: number
}

type NeuralConnectionPathProps = {
	path: string
	filterId: string
	variant?: 'primary' | 'auxiliary'
	compact?: boolean
	reduce?: boolean | null
}

type NeuralConnectionNodeProps = {
	cx: number
	cy: number
	active?: boolean
	pulse?: boolean
	pulseBegin?: number
	pulseDuration?: number
}

export function NeuralSignalParticle({
	path,
	delay,
	filterId,
	duration = 2.85,
}: NeuralSignalParticleProps) {
	return (
		<g>
			<circle r="6" fill="#34d399" filter={`url(#${filterId})`} opacity="0">
				<animateMotion
					path={path}
					begin={`${delay}s`}
					dur={`${duration}s`}
					repeatCount="indefinite"
				/>
				<animate
					attributeName="opacity"
					values="0;0.16;0.12;0"
					begin={`${delay}s`}
					dur={`${duration}s`}
					repeatCount="indefinite"
				/>
			</circle>

			<circle r="2.5" fill="#a7f3d0" filter={`url(#${filterId})`} opacity="0">
				<animateMotion
					path={path}
					begin={`${delay}s`}
					dur={`${duration}s`}
					repeatCount="indefinite"
				/>
				<animate
					attributeName="opacity"
					values="0;1;1;0"
					begin={`${delay}s`}
					dur={`${duration}s`}
					repeatCount="indefinite"
				/>
				<animate
					attributeName="r"
					values="1.8;2.8;2.2"
					begin={`${delay}s`}
					dur={`${duration}s`}
					repeatCount="indefinite"
				/>
			</circle>
		</g>
	)
}

export function NeuralNetworkDefs({ id }: { id: string }) {
	return (
		<defs>
			<filter id={id} x="-350%" y="-350%" width="800%" height="800%">
				<feGaussianBlur stdDeviation="2.8" result="glow" />
				<feMerge>
					<feMergeNode in="glow" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>

			<filter id={`${id}-soft`} x="-80%" y="-80%" width="260%" height="260%">
				<feGaussianBlur stdDeviation="4.5" />
			</filter>

			<linearGradient id={`${id}-line`} x1="0" x2="1">
				<stop offset="0" stopColor="#34d399" stopOpacity="0.08" />
				<stop offset="0.48" stopColor="#a7f3d0" stopOpacity="0.72" />
				<stop offset="1" stopColor="#34d399" stopOpacity="0.08" />
			</linearGradient>

			<marker
				id={`${id}-arrow`}
				viewBox="0 0 8 6"
				refX="7"
				refY="3"
				markerWidth="7"
				markerHeight="7"
				orient="auto"
			>
				<path d="M 0 0 L 8 3 L 0 6 Z" fill="#6ee7b7" fillOpacity="0.88" />
			</marker>
		</defs>
	)
}

export function NeuralConnectionPath({
	path,
	filterId,
	variant = 'primary',
	compact = false,
	reduce = false,
}: NeuralConnectionPathProps) {
	const auxiliary = variant === 'auxiliary'
	const glowWidth = auxiliary ? (compact ? 5 : 6) : compact ? 4 : 5
	const glowOpacity = auxiliary ? (compact ? 0.11 : 0.12) : compact ? 0.09 : 0.1
	const lineWidth = auxiliary ? (compact ? 1.35 : 1.4) : compact ? 1.2 : 1.25
	const lineOpacity = auxiliary ? (compact ? 0.75 : 0.72) : 1
	const dashArray = compact || auxiliary ? '4 7' : '4 8'

	return (
		<g>
			<path
				d={path}
				fill="none"
				stroke="#34d399"
				strokeWidth={glowWidth}
				strokeOpacity={glowOpacity}
				strokeLinecap="round"
				filter={`url(#${filterId}-soft)`}
			/>
			<path
				d={path}
				fill="none"
				stroke={auxiliary ? '#6ee7b7' : `url(#${filterId}-line)`}
				strokeWidth={lineWidth}
				strokeOpacity={lineOpacity}
				strokeDasharray={dashArray}
				strokeLinecap="round"
				markerEnd={auxiliary ? `url(#${filterId}-arrow)` : undefined}
			>
				{auxiliary && !reduce ? (
					<animate
						attributeName="stroke-dashoffset"
						values="0;-22"
						dur="1.7s"
						repeatCount="indefinite"
					/>
				) : null}
			</path>
		</g>
	)
}

export function NeuralSignalTrace({
	path,
	delay,
	duration,
	filterId,
	compact = false,
}: {
	path: string
	delay: number
	duration: number
	filterId: string
	compact?: boolean
}) {
	return (
		<path
			d={path}
			pathLength="1"
			fill="none"
			stroke="#a7f3d0"
			strokeWidth={compact ? 1.25 : 1.5}
			strokeLinecap="round"
			strokeDasharray="0.065 0.935"
			strokeDashoffset="1"
			filter={`url(#${filterId})`}
			opacity="0"
		>
			<animate
				attributeName="stroke-dashoffset"
				values="1;0"
				begin={`${delay}s`}
				dur={`${duration}s`}
				repeatCount="indefinite"
			/>
			<animate
				attributeName="opacity"
				values="0;0.58;0.38;0"
				keyTimes="0;0.12;0.82;1"
				begin={`${delay}s`}
				dur={`${duration}s`}
				repeatCount="indefinite"
			/>
		</path>
	)
}

export function NeuralConnectionNode({
	cx,
	cy,
	active = true,
	pulse = false,
	pulseBegin,
	pulseDuration = 2.8,
}: NeuralConnectionNodeProps) {
	return (
		<g>
			{pulse ? (
				<circle cx={cx} cy={cy} r="9" fill="none" stroke="#6ee7b7" strokeWidth="1" opacity="0">
					<animate
						attributeName="r"
						values="9;16;9"
						begin={pulseBegin === undefined ? undefined : `${pulseBegin}s`}
						dur={`${pulseDuration}s`}
						repeatCount="indefinite"
					/>
					<animate
						attributeName="opacity"
						values="0;0.24;0"
						begin={pulseBegin === undefined ? undefined : `${pulseBegin}s`}
						dur={`${pulseDuration}s`}
						repeatCount="indefinite"
					/>
				</circle>
			) : null}

			<circle
				cx={cx}
				cy={cy}
				r="9"
				fill="#090909"
				stroke={active ? '#6ee7b7' : 'white'}
				strokeOpacity={active ? 0.88 : 0.2}
			/>
			<circle
				cx={cx}
				cy={cy}
				r="3"
				fill={active ? '#a7f3d0' : 'white'}
				fillOpacity={active ? 1 : 0.32}
			/>
		</g>
	)
}
