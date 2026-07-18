'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	CalendarDays,
	Camera,
	Database,
	MessagesSquare,
	Package,
	Plug,
	Sparkles,
	Users,
	type LucideIcon,
} from 'lucide-react'
import type { BusinessTypeValue, DashboardModuleKey } from '@/lib/verticals/registry'

export type IntelligenceCoreProps = {
	locale: 'fa' | 'en'
	businessName?: string | null
	businessLabel?: string | null
	businessType?: BusinessTypeValue | null
	modules?: readonly string[]
	className?: string
}

type NetworkPoint = {
	x: number
	y: number
}

type NetworkSize = {
	width: number
	height: number
}

type ConnectionGeometry = {
	path: string
	start: NetworkPoint
	end: NetworkPoint
	sourceCenter: NetworkPoint
}

type ConnectionTiming = {
	duration: number
	firstDelay: number
	returnFlow: boolean
}

const NODE_META: Partial<
	Record<DashboardModuleKey, { fa: string; en: string; icon: LucideIcon }>
> = {
	agents: { fa: 'ایجنت‌ها', en: 'Agents', icon: Bot },
	products: { fa: 'کاتالوگ', en: 'Catalog', icon: Package },
	appointments: { fa: 'رزروها', en: 'Bookings', icon: CalendarDays },
	conversations: {
		fa: 'گفتگوها',
		en: 'Conversations',
		icon: MessagesSquare,
	},
	contacts: { fa: 'مشتری‌ها', en: 'Customers', icon: Users },
	integrations: { fa: 'کانال‌ها', en: 'Channels', icon: Plug },
	instagram: { fa: 'اینستاگرام', en: 'Instagram', icon: Camera },
}

const DEFAULT_MODULES: DashboardModuleKey[] = [
	'agents',
	'products',
	'conversations',
	'contacts',
	'instagram',
	'integrations',
]

const DESKTOP_LAYOUTS: Record<number, readonly NetworkPoint[]> = {
	4: [
		{ x: 18, y: 25 },
		{ x: 82, y: 25 },
		{ x: 18, y: 75 },
		{ x: 82, y: 75 },
	],
	5: [
		{ x: 18, y: 19 },
		{ x: 82, y: 25 },
		{ x: 14, y: 50 },
		{ x: 86, y: 63 },
		{ x: 18, y: 81 },
	],
	6: [
		{ x: 18, y: 18 },
		{ x: 82, y: 18 },
		{ x: 14, y: 50 },
		{ x: 86, y: 50 },
		{ x: 18, y: 82 },
		{ x: 82, y: 82 },
	],
}

const MOBILE_LAYOUTS: Record<number, readonly NetworkPoint[]> = {
	4: [
		{ x: 20, y: 23 },
		{ x: 80, y: 23 },
		{ x: 20, y: 77 },
		{ x: 80, y: 77 },
	],
	5: [
		{ x: 20, y: 17 },
		{ x: 80, y: 24 },
		{ x: 15, y: 50 },
		{ x: 85, y: 63 },
		{ x: 20, y: 83 },
	],
	6: [
		{ x: 20, y: 17 },
		{ x: 80, y: 17 },
		{ x: 14, y: 50 },
		{ x: 86, y: 50 },
		{ x: 20, y: 83 },
		{ x: 80, y: 83 },
	],
}

function getLayout(count: number, compact: boolean): readonly NetworkPoint[] {
	const normalizedCount = Math.min(6, Math.max(4, count))
	const layouts = compact ? MOBILE_LAYOUTS : DESKTOP_LAYOUTS

	return layouts[normalizedCount] ?? layouts[6]
}

const FALLBACK_NETWORK_SIZE = {
	mobile: { width: 320, height: 352 },
	desktop: { width: 657, height: 368 },
} as const

function getCanvasSize(compact: boolean, size: NetworkSize): NetworkSize {
	if (size.width > 0 && size.height > 0) return size
	return compact ? FALLBACK_NETWORK_SIZE.mobile : FALLBACK_NETWORK_SIZE.desktop
}

function getCanvasPoint(point: NetworkPoint, size: NetworkSize): NetworkPoint {
	return {
		x: (point.x / 100) * size.width,
		y: (point.y / 100) * size.height,
	}
}

function getRectangleAttachment(
	center: NetworkPoint,
	halfWidth: number,
	halfHeight: number,
	toward: NetworkPoint,
): NetworkPoint {
	const dx = toward.x - center.x
	const dy = toward.y - center.y
	const denominator = Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight)

	if (!Number.isFinite(denominator) || denominator === 0) return center

	const scale = 1 / denominator
	return {
		x: center.x + dx * scale,
		y: center.y + dy * scale,
	}
}

function getConnectionTiming(index: number): ConnectionTiming {
	return {
		duration: 3.25 + (index % 3) * 0.34,
		firstDelay: 0.2 + index * 0.3,
		returnFlow: index % 3 === 1,
	}
}

function getConnectionGeometry(
	point: NetworkPoint,
	compact: boolean,
	size: NetworkSize,
): ConnectionGeometry {
	const canvas = getCanvasSize(compact, size)
	const sourceCenter = getCanvasPoint(point, canvas)
	const coreCenter = { x: canvas.width / 2, y: canvas.height / 2 }
	const start = getRectangleAttachment(
		sourceCenter,
		compact ? 46 : 56,
		compact ? 20 : 24,
		coreCenter,
	)
	const end = getRectangleAttachment(
		coreCenter,
		compact ? 66 : 82,
		compact ? 75 : 84,
		sourceCenter,
	)

	const sourceLength = Math.hypot(
		start.x - sourceCenter.x,
		start.y - sourceCenter.y,
	)
	const coreLength = Math.hypot(end.x - coreCenter.x, end.y - coreCenter.y)
	const routeLength = Math.hypot(end.x - start.x, end.y - start.y)
	const handleLength = Math.min(compact ? 44 : 64, routeLength * 0.42)
	const sourceNormal = {
		x: (start.x - sourceCenter.x) / sourceLength,
		y: (start.y - sourceCenter.y) / sourceLength,
	}
	const coreNormal = {
		x: (end.x - coreCenter.x) / coreLength,
		y: (end.y - coreCenter.y) / coreLength,
	}
	const firstControl = {
		x: start.x + sourceNormal.x * handleLength,
		y: start.y + sourceNormal.y * handleLength,
	}
	const secondControl = {
		x: end.x + coreNormal.x * handleLength,
		y: end.y + coreNormal.y * handleLength,
	}
	const format = (value: number) => value.toFixed(2)

	return {
		start,
		end,
		sourceCenter,
		path: [
			`M ${format(start.x)} ${format(start.y)}`,
			`C ${format(firstControl.x)} ${format(firstControl.y)}`,
			`${format(secondControl.x)} ${format(secondControl.y)}`,
			`${format(end.x)} ${format(end.y)}`,
		].join(' '),
	}
}

function NetworkDefs({ id }: { id: string }) {
	return (
		<defs>
			<filter id={`${id}-particle`} x="-350%" y="-350%" width="800%" height="800%">
				<feGaussianBlur stdDeviation="2.8" result="particleGlow" />
				<feMerge>
					<feMergeNode in="particleGlow" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>

			<filter id={`${id}-soft`} x="-90%" y="-90%" width="280%" height="280%">
				<feGaussianBlur stdDeviation="4.3" />
			</filter>

			<linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
				<stop offset="0" stopColor="#34d399" stopOpacity=".08" />
				<stop offset=".5" stopColor="#a7f3d0" stopOpacity=".72" />
				<stop offset="1" stopColor="#34d399" stopOpacity=".08" />
			</linearGradient>

			<marker
				id={`${id}-arrow`}
				viewBox="0 0 8 6"
				refX="7"
				refY="3"
				markerWidth="7"
				markerHeight="7"
				markerUnits="userSpaceOnUse"
				orient="auto-start-reverse"
			>
				<path d="M 0 0 L 8 3 L 0 6 Z" fill="#6ee7b7" fillOpacity=".88" />
			</marker>
		</defs>
	)
}

function SignalParticle({
	path,
	delay,
	duration,
	filterId,
	reverse = false,
}: {
	path: string
	delay: number
	duration: number
	filterId: string
	reverse?: boolean
}) {
	return (
		<g>
			<circle r="6" fill="#34d399" filter={`url(#${filterId}-particle)`} opacity="0">
				<animateMotion
					path={path}
					begin={`${delay}s`}
					dur={`${duration}s`}
					repeatCount="indefinite"
					keyPoints={reverse ? '1;0' : undefined}
					keyTimes={reverse ? '0;1' : undefined}
					calcMode={reverse ? 'linear' : undefined}
				/>
				<animate
					attributeName="opacity"
					values="0;.16;.12;0"
					begin={`${delay}s`}
					dur={`${duration}s`}
					repeatCount="indefinite"
				/>
			</circle>

			<circle r="2.5" fill="#a7f3d0" filter={`url(#${filterId}-particle)`} opacity="0">
				<animateMotion
					path={path}
					begin={`${delay}s`}
					dur={`${duration}s`}
					repeatCount="indefinite"
					keyPoints={reverse ? '1;0' : undefined}
					keyTimes={reverse ? '0;1' : undefined}
					calcMode={reverse ? 'linear' : undefined}
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

function NetworkTerminal({
	point,
	pulseDelay,
	pulsePeriod,
	reduce,
}: {
	point: NetworkPoint
	pulseDelay: number
	pulsePeriod: number
	reduce: boolean | null
}) {
	return (
		<g>
			{!reduce ? (
				<circle
					cx={point.x}
					cy={point.y}
					r="6"
					fill="none"
					stroke="#6ee7b7"
					strokeWidth=".8"
					opacity="0"
				>
					<animate
						attributeName="r"
						values="6;13;6"
						dur={`${pulsePeriod}s`}
						begin={`${pulseDelay}s`}
						repeatCount="indefinite"
					/>
					<animate
						attributeName="opacity"
						values="0;.3;0"
						dur={`${pulsePeriod}s`}
						begin={`${pulseDelay}s`}
						repeatCount="indefinite"
					/>
				</circle>
			) : null}

			<circle
				cx={point.x}
				cy={point.y}
				r="6"
				fill="#090909"
				stroke="#6ee7b7"
				strokeWidth=".8"
				strokeOpacity=".82"
			/>
			<circle cx={point.x} cy={point.y} r="2" fill="#d1fae5" />
		</g>
	)
}

function ConnectionNetwork({
	nodeKeys,
	positions,
	reduce,
	compact,
	size,
	className,
}: {
	nodeKeys: DashboardModuleKey[]
	positions: readonly NetworkPoint[]
	reduce: boolean | null
	compact: boolean
	size: NetworkSize
	className: string
}) {
	const id = compact ? 'vigent-intelligence-mobile' : 'vigent-intelligence-desktop'
	const canvas = getCanvasSize(compact, size)

	return (
		<svg
			viewBox={`0 0 ${canvas.width} ${canvas.height}`}
			preserveAspectRatio="none"
			className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
			aria-hidden
		>
			<NetworkDefs id={id} />

			{nodeKeys.map((key, index) => {
				const point = positions[index]
				if (!point) return null

				const geometry = getConnectionGeometry(point, compact, size)
				const { duration, firstDelay, returnFlow } = getConnectionTiming(index)
				const pulsePeriod = duration * 0.5

				return (
					<g key={key}>
						<motion.path
							d={geometry.path}
							fill="none"
							stroke="#34d399"
							strokeWidth="6"
							strokeOpacity=".09"
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
							filter={`url(#${id}-soft)`}
							initial={reduce ? false : { pathLength: 0, opacity: 0 }}
							animate={{ pathLength: 1, opacity: 1 }}
							transition={{
								duration: 0.46,
								delay: 0.04 + index * 0.045,
								ease: [0.23, 1, 0.32, 1],
							}}
						/>

						<motion.path
							d={geometry.path}
							fill="none"
							stroke={`url(#${id}-line)`}
							strokeWidth="1.15"
							strokeDasharray="4 8"
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
							markerStart={returnFlow ? `url(#${id}-arrow)` : undefined}
							markerEnd={returnFlow ? undefined : `url(#${id}-arrow)`}
							initial={reduce ? false : { pathLength: 0, opacity: 0 }}
							animate={{ pathLength: 1, opacity: 1 }}
							transition={{
								duration: 0.52,
								delay: 0.06 + index * 0.05,
								ease: [0.23, 1, 0.32, 1],
							}}
						>
							{!reduce ? (
								<animate
									attributeName="stroke-dashoffset"
									values={returnFlow ? '0;24' : '0;-24'}
									dur={`${2.7 + (index % 2) * 0.3}s`}
									repeatCount="indefinite"
								/>
							) : null}
						</motion.path>

						<NetworkTerminal
							point={geometry.end}
							pulseDelay={returnFlow ? firstDelay : firstDelay + duration}
							pulsePeriod={pulsePeriod}
							reduce={reduce}
						/>

						{!reduce ? (
							<>
								<SignalParticle
									path={geometry.path}
									delay={firstDelay}
									duration={duration}
									filterId={id}
									reverse={returnFlow}
								/>
								<SignalParticle
									path={geometry.path}
									delay={firstDelay + duration * 0.5}
									duration={duration}
									filterId={id}
									reverse={returnFlow}
								/>
								{returnFlow ? (
									<SignalParticle
										path={geometry.path}
										delay={1.15 + index * 0.28}
										duration={4.15}
										filterId={id}
										reverse={!returnFlow}
									/>
								) : null}
							</>
						) : null}
					</g>
				)
			})}
		</svg>
	)
}

function ModuleNode({
	moduleKey,
	locale,
	index,
	point,
	reduce,
	compact,
	size,
}: {
	moduleKey: DashboardModuleKey
	locale: 'fa' | 'en'
	index: number
	point: NetworkPoint
	reduce: boolean | null
	compact: boolean
	size: NetworkSize
}) {
	const meta = NODE_META[moduleKey] ?? {
		fa: moduleKey,
		en: moduleKey,
		icon: Database,
	}
	const Icon = meta.icon
	const geometry = getConnectionGeometry(point, compact, size)
	const { duration, firstDelay, returnFlow } = getConnectionTiming(index)
	const portOffset = {
		x: geometry.start.x - geometry.sourceCenter.x,
		y: geometry.start.y - geometry.sourceCenter.y,
	}
	const pulseDelay = returnFlow ? firstDelay + duration : firstDelay

	return (
		<div
			style={
				{
					'--node-x': `${point.x}%`,
					'--node-y': `${point.y}%`,
				} as CSSProperties
			}
			className={`absolute left-[var(--node-x)] top-[var(--node-y)] z-20 -translate-x-1/2 -translate-y-1/2 ${compact ? 'w-[92px]' : 'w-[112px]'}`}
		>
			<motion.div
				initial={reduce ? false : { opacity: 0, scale: 0.92, y: 5 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				transition={{
					duration: reduce ? 0 : 0.3,
					delay: 0.1 + index * 0.055,
					ease: [0.23, 1, 0.32, 1],
				}}
				className="relative flex min-h-10 w-full items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#111]/95 p-1.5 pe-2.5 text-white shadow-[0_14px_34px_rgba(0,0,0,.34)] backdrop-blur-xl sm:gap-2 sm:rounded-2xl sm:p-2 sm:pe-3"
			>
				<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-black shadow-[0_6px_18px_rgba(255,255,255,.08)] sm:h-8 sm:w-8">
					<Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
				</span>

				<span className="min-w-0 flex-1 truncate whitespace-nowrap text-[9px] font-semibold sm:text-[11px]">
					{locale === 'fa' ? meta.fa : meta.en}
				</span>

				<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.75)]" />
			</motion.div>

			<span
				aria-hidden
				style={{
					left: `calc(50% + ${portOffset.x}px)`,
					top: `calc(50% + ${portOffset.y}px)`,
				}}
				className="pointer-events-none absolute z-30 grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center"
			>
				{!reduce ? (
					<motion.span
						className="absolute inset-1 rounded-full border border-emerald-300/70"
						animate={{ scale: [0.75, 2.15, 2.15], opacity: [0, 0.48, 0] }}
						transition={{
							duration: duration * 0.5,
							delay: pulseDelay,
							repeat: Infinity,
							times: [0, 0.22, 1],
							ease: 'easeOut',
						}}
					/>
				) : null}
				<span className="relative grid h-2.5 w-2.5 place-items-center rounded-full border border-emerald-200/80 bg-[#090909] shadow-[0_0_12px_rgba(52,211,153,.5)]">
					<span className="h-1 w-1 rounded-full bg-emerald-200" />
				</span>
			</span>
		</div>
	)
}

function IntelligenceCoreCard({
	locale,
	coreName,
	reduce,
}: {
	locale: 'fa' | 'en'
	coreName: string
	reduce: boolean | null
}) {
	const fa = locale === 'fa'

	return (
		<div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-4">
			{!reduce ? (
				<>
					<motion.span
						aria-hidden
						className="absolute h-36 w-36 rounded-[2.4rem] border border-emerald-300/[0.11] shadow-[0_0_44px_rgba(52,211,153,.08)] sm:h-44 sm:w-44 sm:rounded-[2.8rem]"
						animate={{ scale: [0.94, 1.08], opacity: [0, 0.26, 0] }}
						transition={{
							duration: 2.8,
							repeat: Infinity,
							ease: 'easeOut',
						}}
					/>
					<motion.span
						aria-hidden
						className="absolute h-36 w-36 rounded-[2.4rem] border border-emerald-300/[0.08] sm:h-44 sm:w-44 sm:rounded-[2.8rem]"
						animate={{ scale: [0.94, 1.08], opacity: [0, 0.18, 0] }}
						transition={{
							duration: 2.8,
							delay: 1.4,
							repeat: Infinity,
							ease: 'easeOut',
						}}
					/>
				</>
			) : null}

			<motion.div
				initial={reduce ? false : { opacity: 0, scale: 0.94 }}
				animate={
					reduce
						? { opacity: 1, scale: 1 }
						: {
								opacity: 1,
								scale: [1, 1.018, 1],
							}
				}
				transition={
					reduce
						? { duration: 0 }
						: {
								opacity: { duration: 0.36, delay: 0.08 },
								scale: {
									duration: 3.5,
									repeat: Infinity,
									ease: 'easeInOut',
								},
							}
				}
				className="relative w-[132px] rounded-[1.8rem] border border-white/[0.22] bg-white/[0.075] p-3 text-center text-white shadow-[0_0_54px_rgba(52,211,153,.14),0_24px_58px_rgba(0,0,0,.42)] backdrop-blur-xl sm:w-[164px] sm:rounded-[2.1rem] sm:p-4"
			>
				<span
					aria-hidden
					className="absolute inset-2 rounded-[1.35rem] border border-white/[0.09] sm:rounded-[1.6rem]"
				/>

				<div className="relative">
					<span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-black shadow-[0_0_26px_rgba(255,255,255,.18)] sm:h-11 sm:w-11">
						<Sparkles className="h-[18px] w-[18px]" />
					</span>

					<p className="mt-2.5 whitespace-nowrap text-[12px] font-black sm:text-[14px]">
						Vigento AI
					</p>

					<p
						dir="auto"
						title={coreName}
						className="mx-auto mt-1 max-w-[112px] truncate text-[8px] font-medium text-white/[0.45] sm:max-w-[138px] sm:text-[9px]"
					>
						{coreName}
					</p>

					<div className="mt-3 rounded-xl border border-white/[0.07] bg-black/[0.2] px-2 py-2 sm:px-2.5">
						<p className="whitespace-nowrap text-[7px] font-semibold text-white/[0.7] sm:text-[8px]">
							{fa ? 'همه عملیات، یک هسته هوشمند' : 'One intelligent operating core'}
						</p>
						<div className="mt-2 flex items-center gap-1">
							{[0, 1, 2].map((item) => (
								<span
									key={item}
									className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]"
								>
									<motion.span
										className="block h-full rounded-full bg-emerald-300"
										initial={reduce ? false : { transform: 'scaleX(0)' }}
										animate={{ transform: 'scaleX(1)' }}
										style={{
											transformOrigin: fa ? 'right' : 'left',
										}}
										transition={{
											duration: reduce ? 0 : 0.45,
											delay: 0.25 + item * 0.08,
											ease: [0.23, 1, 0.32, 1],
										}}
									/>
								</span>
							))}
						</div>
					</div>
				</div>
			</motion.div>
		</div>
	)
}

export function IntelligenceCore({
	locale,
	businessName,
	businessLabel,
	modules = [],
	className = '',
}: IntelligenceCoreProps) {
	const reduce = useReducedMotion()
	const stageRef = useRef<HTMLDivElement>(null)
	const [stageSize, setStageSize] = useState<NetworkSize>({ width: 0, height: 0 })
	const fa = locale === 'fa'
	const Arrow = fa ? ArrowLeft : ArrowRight

	useEffect(() => {
		const stage = stageRef.current
		if (!stage) return

		const measure = () => {
			const bounds = stage.getBoundingClientRect()
			const width = Math.round(bounds.width)
			const height = Math.round(bounds.height)

			setStageSize((current) =>
				current.width === width && current.height === height
					? current
					: { width, height },
			)
		}

		measure()
		if (typeof ResizeObserver === 'undefined') return

		const observer = new ResizeObserver(measure)
		observer.observe(stage)

		return () => observer.disconnect()
	}, [])

	const requested = modules
		.filter((module): module is DashboardModuleKey => module in NODE_META)
		.slice(0, 6)

	const nodeKeys = requested.length >= 4 ? requested : DEFAULT_MODULES.slice(0, 6)

	const desktopPositions = getLayout(nodeKeys.length, false)
	const mobilePositions = getLayout(nodeKeys.length, true)

	const coreName =
		businessName?.trim() || businessLabel || (fa ? 'کسب‌وکار شما' : 'Your business')

	return (
		<section
			dir={fa ? 'rtl' : 'ltr'}
			className={`spatial-surface relative min-w-0 overflow-hidden rounded-[1.75rem] ${className}`}
		>
			<header className="flex items-center justify-between gap-2.5 px-4 py-4 sm:px-5">
				<div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
						<Sparkles className="h-4 w-4" />
					</span>
					<div className="min-w-0">
						<h2 className="truncate text-[12px] font-black text-[var(--text-primary)] sm:text-[13px]">
							Vigento AI{' '}
							<span className="font-medium text-[var(--text-muted)]">
								| {fa ? 'هوش مصنوعی ویجنتو' : 'Vigento intelligence'}
							</span>
						</h2>
						<p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
							{businessLabel ||
								(fa
									? 'مرکز هماهنگی هوشمند کسب‌وکار'
									: 'Intelligent business orchestration')}
						</p>
					</div>
				</div>

				<span
					aria-label={fa ? 'همه بخش‌ها متصل هستند' : 'All systems are connected'}
					className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-bold text-emerald-700 sm:text-[11px]"
				>
					<span className="relative flex h-1.5 w-1.5">
						{!reduce ? (
							<span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-40" />
						) : null}
						<span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
					</span>
					<span className="sm:hidden">{fa ? 'متصل' : 'Online'}</span>
					<span className="hidden sm:inline">
						{fa ? 'همه‌چیز متصل' : 'All connected'}
					</span>
				</span>
			</header>

			<div
				ref={stageRef}
				className="relative mx-3 h-[22rem] overflow-hidden rounded-[1.5rem] bg-[#050505] sm:mx-4 sm:h-[23rem] sm:rounded-[1.75rem]"
			>
				<div
					aria-hidden
					className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(52,211,153,.075),transparent_31%),linear-gradient(rgba(255,255,255,.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.028)_1px,transparent_1px)] bg-[size:auto,25px_25px,25px_25px] sm:bg-[size:auto,29px_29px,29px_29px]"
				/>
				<div
					aria-hidden
					className="absolute -left-20 top-1/3 h-48 w-48 rounded-full bg-white/[0.035] blur-3xl"
				/>
				<div
					aria-hidden
					className="absolute -right-20 bottom-1/4 h-48 w-48 rounded-full bg-emerald-300/[0.035] blur-3xl"
				/>

				<ConnectionNetwork
					nodeKeys={nodeKeys}
					positions={mobilePositions}
					reduce={reduce}
					compact
					size={stageSize}
					className="sm:hidden"
				/>
				<ConnectionNetwork
					nodeKeys={nodeKeys}
					positions={desktopPositions}
					reduce={reduce}
					compact={false}
					size={stageSize}
					className="hidden sm:block"
				/>

				<div className="sm:hidden">
					{nodeKeys.map((key, index) => (
						<ModuleNode
							key={key}
							moduleKey={key}
							locale={locale}
							index={index}
							point={mobilePositions[index]}
							reduce={reduce}
							compact
							size={stageSize}
						/>
					))}
				</div>

				<div className="hidden sm:block">
					{nodeKeys.map((key, index) => (
						<ModuleNode
							key={key}
							moduleKey={key}
							locale={locale}
							index={index}
							point={desktopPositions[index]}
							reduce={reduce}
							compact={false}
							size={stageSize}
						/>
					))}
				</div>

				<IntelligenceCoreCard locale={locale} coreName={coreName} reduce={reduce} />

				<p className="sr-only">
					{fa
						? `ویجنتو به ${nodeKeys
								.map((key) => NODE_META[key]?.fa ?? key)
								.join('، ')} متصل است.`
						: `Vigento is connected to ${nodeKeys
								.map((key) => NODE_META[key]?.en ?? key)
								.join(', ')}.`}
				</p>
			</div>

			<footer className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<div className="min-w-0 text-center sm:text-start">
					<p className="text-[11px] font-bold text-[var(--text-primary)]">
						{fa ? 'یک هسته برای تمام عملیات' : 'One core for every operation'}
					</p>
					<p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
						{fa
							? 'ایجنت، داده، گفتگو و کانال‌ها زیر نظر ویجنتو'
							: 'Agents, data, conversations and channels under Vigento'}
					</p>
				</div>

				<Link
					href="/vigento"
					className="spatial-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-black px-4 text-[11px] font-bold text-white shadow-[var(--shadow-control)]"
				>
					{fa ? 'باز کردن مرکز هوش مصنوعی' : 'Open AI center'}
					<Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
				</Link>
			</footer>
		</section>
	)
}
