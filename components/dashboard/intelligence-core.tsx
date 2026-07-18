'use client'

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
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
import {
	NeuralConnectionNode,
	NeuralConnectionPath,
	NeuralNetworkDefs,
	NeuralSignalParticle,
	NeuralSignalTrace,
} from '@/components/marketing/neural-network-primitives'
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
	inboundPath: string
	outboundPath: string
	start: NetworkPoint
	end: NetworkPoint
	sourceCenter: NetworkPoint
}

type ConnectionTiming = {
	duration: number
	firstDelay: number
	returnFlow: boolean
}

const NODE_META: Partial<Record<DashboardModuleKey, { fa: string; en: string; icon: LucideIcon }>> =
	{
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
		{ x: 17, y: 18 },
		{ x: 83, y: 18 },
		{ x: 17, y: 82 },
		{ x: 83, y: 82 },
	],
	5: [
		{ x: 17, y: 16 },
		{ x: 83, y: 22 },
		{ x: 12, y: 50 },
		{ x: 88, y: 64 },
		{ x: 17, y: 84 },
	],
	6: [
		{ x: 17, y: 16 },
		{ x: 83, y: 16 },
		{ x: 12, y: 50 },
		{ x: 88, y: 50 },
		{ x: 17, y: 84 },
		{ x: 83, y: 84 },
	],
}

const MOBILE_LAYOUTS: Record<number, readonly NetworkPoint[]> = {
	4: [
		{ x: 20, y: 15 },
		{ x: 80, y: 15 },
		{ x: 20, y: 85 },
		{ x: 80, y: 85 },
	],
	5: [
		{ x: 17, y: 13 },
		{ x: 50, y: 10 },
		{ x: 83, y: 13 },
		{ x: 30, y: 87 },
		{ x: 70, y: 87 },
	],
	6: [
		{ x: 17, y: 13 },
		{ x: 50, y: 10 },
		{ x: 83, y: 13 },
		{ x: 17, y: 87 },
		{ x: 50, y: 90 },
		{ x: 83, y: 87 },
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

function normalizeVector(vector: NetworkPoint): NetworkPoint {
	const length = Math.hypot(vector.x, vector.y)
	if (length === 0) return { x: 0, y: 0 }
	return { x: vector.x / length, y: vector.y / length }
}

function distanceBetween(a: NetworkPoint, b: NetworkPoint): number {
	return Math.hypot(b.x - a.x, b.y - a.y)
}

function formatPoint(point: NetworkPoint): string {
	return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`
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

function getConnectionTiming(index: number, compact: boolean): ConnectionTiming {
	return {
		duration: (compact ? 3.35 : 3.05) + (index % 3) * 0.22,
		firstDelay: 0.18 + index * 0.42,
		returnFlow: index % 3 === 1,
	}
}

function getCoreRectangle(compact: boolean, canvas: NetworkSize, coreSize: NetworkSize) {
	return {
		center: { x: canvas.width / 2, y: canvas.height / 2 },
		halfWidth: coreSize.width > 0 ? coreSize.width / 2 : compact ? 66 : 82,
		halfHeight: coreSize.height > 0 ? coreSize.height / 2 : compact ? 75 : 84,
	}
}

function getConnectionGeometry(
	point: NetworkPoint,
	index: number,
	compact: boolean,
	size: NetworkSize,
	coreSize: NetworkSize,
): ConnectionGeometry {
	const canvas = getCanvasSize(compact, size)
	const sourceCenter = getCanvasPoint(point, canvas)
	const core = getCoreRectangle(compact, canvas, coreSize)
	const start = getRectangleAttachment(
		sourceCenter,
		compact ? 46 : 66,
		compact ? 23 : 27,
		core.center,
	)
	const end = getRectangleAttachment(core.center, core.halfWidth, core.halfHeight, sourceCenter)

	const routeBias = point.y < 36 ? -(compact ? 7 : 12) : point.y > 64 ? (compact ? 7 : 12) : 0
	const sideBias = routeBias === 0 ? (point.x < 50 ? -(compact ? 3 : 7) : compact ? 3 : 7) : 0
	const sequenceBias = routeBias === 0 ? 0 : (index % 2 === 0 ? -1 : 1) * (compact ? 2 : 4)
	const junction = {
		x: start.x + (end.x - start.x) * (compact ? 0.5 : 0.52) + sideBias + sequenceBias,
		y: start.y + (end.y - start.y) * (compact ? 0.5 : 0.52) + routeBias,
	}
	const sourceNormal = normalizeVector({
		x: start.x - sourceCenter.x,
		y: start.y - sourceCenter.y,
	})
	const coreNormal = normalizeVector({
		x: end.x - core.center.x,
		y: end.y - core.center.y,
	})
	const firstLeg = normalizeVector({
		x: junction.x - start.x,
		y: junction.y - start.y,
	})
	const secondLeg = normalizeVector({
		x: end.x - junction.x,
		y: end.y - junction.y,
	})
	const firstDistance = distanceBetween(start, junction)
	const secondDistance = distanceBetween(junction, end)
	const sourceHandle = Math.min(compact ? 34 : 48, firstDistance * 0.52)
	const junctionInHandle = Math.min(compact ? 26 : 38, firstDistance * 0.42)
	const junctionOutHandle = Math.min(compact ? 26 : 38, secondDistance * 0.42)
	const coreHandle = Math.min(compact ? 34 : 48, secondDistance * 0.52)
	const firstControl = {
		x: start.x + sourceNormal.x * sourceHandle,
		y: start.y + sourceNormal.y * sourceHandle,
	}
	const junctionInControl = {
		x: junction.x - firstLeg.x * junctionInHandle,
		y: junction.y - firstLeg.y * junctionInHandle,
	}
	const junctionOutControl = {
		x: junction.x + secondLeg.x * junctionOutHandle,
		y: junction.y + secondLeg.y * junctionOutHandle,
	}
	const coreControl = {
		x: end.x + coreNormal.x * coreHandle,
		y: end.y + coreNormal.y * coreHandle,
	}
	const inboundPath = [
		`M ${formatPoint(start)}`,
		`C ${formatPoint(firstControl)} ${formatPoint(junctionInControl)} ${formatPoint(junction)}`,
		`C ${formatPoint(junctionOutControl)} ${formatPoint(coreControl)} ${formatPoint(end)}`,
	].join(' ')
	const outboundPath = [
		`M ${formatPoint(end)}`,
		`C ${formatPoint(coreControl)} ${formatPoint(junctionOutControl)} ${formatPoint(junction)}`,
		`C ${formatPoint(junctionInControl)} ${formatPoint(firstControl)} ${formatPoint(start)}`,
	].join(' ')

	return {
		start,
		end,
		sourceCenter,
		inboundPath,
		outboundPath,
	}
}

function ConnectionNetwork({
	nodeKeys,
	positions,
	reduce,
	compact,
	size,
	coreSize,
	className,
}: {
	nodeKeys: DashboardModuleKey[]
	positions: readonly NetworkPoint[]
	reduce: boolean | null
	compact: boolean
	size: NetworkSize
	coreSize: NetworkSize
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
			<NeuralNetworkDefs id={id} />

			{nodeKeys.map((key, index) => {
				const point = positions[index]
				if (!point) return null

				const geometry = getConnectionGeometry(point, index, compact, size, coreSize)
				const { duration, firstDelay, returnFlow } = getConnectionTiming(index, compact)
				const flowPath = returnFlow ? geometry.outboundPath : geometry.inboundPath
				const pulsePeriod = compact ? duration : duration * 0.52
				const corePulseBegin = returnFlow ? firstDelay : firstDelay + duration

				return (
					<g key={key}>
						<NeuralConnectionPath path={flowPath} filterId={id} compact={compact} />

						<NeuralConnectionNode
							cx={geometry.end.x}
							cy={geometry.end.y}
							pulse={!reduce}
							pulseBegin={corePulseBegin}
							pulseDuration={pulsePeriod}
						/>

						{!reduce ? (
							<>
								<NeuralSignalTrace
									path={flowPath}
									delay={firstDelay}
									duration={duration}
									filterId={id}
									compact={compact}
								/>
								<NeuralSignalParticle
									path={flowPath}
									delay={firstDelay}
									duration={duration}
									filterId={id}
								/>
								{!compact ? (
									<>
										<NeuralSignalTrace
											path={flowPath}
											delay={firstDelay + duration * 0.52}
											duration={duration}
											filterId={id}
										/>
										<NeuralSignalParticle
											path={flowPath}
											delay={firstDelay + duration * 0.52}
											duration={duration}
											filterId={id}
										/>
									</>
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
	coreSize,
}: {
	moduleKey: DashboardModuleKey
	locale: 'fa' | 'en'
	index: number
	point: NetworkPoint
	reduce: boolean | null
	compact: boolean
	size: NetworkSize
	coreSize: NetworkSize
}) {
	const meta = NODE_META[moduleKey] ?? {
		fa: moduleKey,
		en: moduleKey,
		icon: Database,
	}
	const Icon = meta.icon
	const geometry = getConnectionGeometry(point, index, compact, size, coreSize)
	const { duration, firstDelay, returnFlow } = getConnectionTiming(index, compact)
	const portOffset = {
		x: geometry.start.x - geometry.sourceCenter.x,
		y: geometry.start.y - geometry.sourceCenter.y,
	}
	const pulseDelay = returnFlow ? firstDelay + duration : firstDelay
	const pulseDuration = compact ? duration : duration * 0.52

	return (
		<div
			style={
				{
					'--node-x': `${point.x}%`,
					'--node-y': `${point.y}%`,
				} as CSSProperties
			}
			className={`absolute left-[var(--node-x)] top-[var(--node-y)] z-20 -translate-x-1/2 -translate-y-1/2 ${compact ? 'w-[92px]' : 'w-[132px]'}`}
		>
			<motion.div
				initial={reduce ? false : { opacity: 0, y: 7, scale: 0.985 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				transition={{
					duration: reduce ? 0 : 0.3,
					delay: 0.08 + index * 0.06,
					ease: [0.23, 1, 0.32, 1],
				}}
				className={`relative flex w-full items-center border border-white/[0.82] bg-white text-black shadow-[0_18px_42px_rgba(0,0,0,0.32),inset_0_0_0_1px_rgba(0,0,0,0.035)] ${compact ? 'h-[46px] gap-1.5 rounded-[1.05rem] p-1.5' : 'h-[54px] gap-2.5 rounded-[1.25rem] p-2.5'}`}
			>
				<span
					className={`grid shrink-0 place-items-center border border-black/[0.08] bg-black/[0.045] text-black/[0.74] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${compact ? 'h-8 w-8 rounded-[0.7rem]' : 'h-9 w-9 rounded-xl'}`}
				>
					<Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
				</span>

				<span
					className={`min-w-0 flex-1 truncate whitespace-nowrap font-bold text-black/[0.84] ${compact ? 'text-[9px]' : 'text-[11px]'}`}
				>
					{locale === 'fa' ? meta.fa : meta.en}
				</span>

				<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.72)]" />
			</motion.div>

			<span
				aria-hidden
				style={{
					left: `calc(50% + ${portOffset.x}px)`,
					top: `calc(50% + ${portOffset.y}px)`,
				}}
				className="pointer-events-none absolute z-30 grid h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center"
			>
				{!reduce ? (
					<motion.span
						className="absolute inset-0 rounded-full border border-emerald-300"
						animate={{ scale: [1, 1.78, 1], opacity: [0, 0.24, 0] }}
						transition={{
							duration: pulseDuration,
							delay: pulseDelay,
							repeat: Infinity,
							ease: 'easeInOut',
						}}
					/>
				) : null}
				<span className="relative grid h-[18px] w-[18px] place-items-center rounded-full border border-emerald-300/90 bg-[#090909]">
					<span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />
				</span>
			</span>
		</div>
	)
}

function IntelligenceCoreCard({
	locale,
	coreName,
	reduce,
	coreRef,
}: {
	locale: 'fa' | 'en'
	coreName: string
	reduce: boolean | null
	coreRef: RefObject<HTMLDivElement | null>
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
				ref={coreRef}
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
	const coreRef = useRef<HTMLDivElement>(null)
	const [stageSize, setStageSize] = useState<NetworkSize>({
		width: 0,
		height: 0,
	})
	const [coreSize, setCoreSize] = useState<NetworkSize>({
		width: 0,
		height: 0,
	})
	const fa = locale === 'fa'
	const Arrow = fa ? ArrowLeft : ArrowRight

	useEffect(() => {
		const stage = stageRef.current
		const core = coreRef.current
		if (!stage) return

		const measure = () => {
			const bounds = stage.getBoundingClientRect()
			const width = Math.round(bounds.width)
			const height = Math.round(bounds.height)

			setStageSize((current) =>
				current.width === width && current.height === height ? current : { width, height },
			)

			if (core) {
				const coreWidth = Math.round(core.offsetWidth)
				const coreHeight = Math.round(core.offsetHeight)

				setCoreSize((current) =>
					current.width === coreWidth && current.height === coreHeight
						? current
						: { width: coreWidth, height: coreHeight },
				)
			}
		}

		measure()
		if (typeof ResizeObserver === 'undefined') return

		const observer = new ResizeObserver(measure)
		observer.observe(stage)
		if (core) observer.observe(core)

		return () => observer.disconnect()
	}, [])

	const requested = modules
		.filter((module): module is DashboardModuleKey => module in NODE_META)
		.slice(0, 6)

	const nodeKeys = requested.length >= 4 ? requested : DEFAULT_MODULES.slice(0, 6)

	const desktopPositions = getLayout(nodeKeys.length, false)
	const mobilePositions = getLayout(nodeKeys.length, true)

	const coreName = businessName?.trim() || businessLabel || (fa ? 'کسب‌وکار شما' : 'Your business')

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
								(fa ? 'مرکز هماهنگی هوشمند کسب‌وکار' : 'Intelligent business orchestration')}
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
					<span className="hidden sm:inline">{fa ? 'همه‌چیز متصل' : 'All connected'}</span>
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
					coreSize={coreSize}
					className="sm:hidden"
				/>
				<ConnectionNetwork
					nodeKeys={nodeKeys}
					positions={desktopPositions}
					reduce={reduce}
					compact={false}
					size={stageSize}
					coreSize={coreSize}
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
							coreSize={coreSize}
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
							coreSize={coreSize}
						/>
					))}
				</div>

				<IntelligenceCoreCard
					locale={locale}
					coreName={coreName}
					reduce={reduce}
					coreRef={coreRef}
				/>

				<p className="sr-only">
					{fa
						? `ویجنتو به ${nodeKeys.map((key) => NODE_META[key]?.fa ?? key).join('، ')} متصل است.`
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
