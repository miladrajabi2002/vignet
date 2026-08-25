'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
	Check,
	Database,
	Globe2,
	MessageCircleMore,
	PackageSearch,
	ShieldCheck,
	Sparkles,
	UsersRound,
} from 'lucide-react'
import {
	NeuralConnectionNode as NetworkNode,
	NeuralConnectionPath,
	NeuralNetworkDefs as NetworkDefs,
	NeuralSignalParticle as SignalParticle,
} from './neural-network-primitives'
import { InstagramIcon, TelegramIcon } from './social-links'

type Scenario = {
	name: string
	channel: string
	person: string
	text: string
	time: string
	reply: string
	source: string
	result: string
	confidence: string
	quickActions: readonly string[]
}

type NeuralOperationGraphProps = {
	locale: 'fa' | 'en'
	reduce: boolean | null
	activeIndex: number
	scenario: Scenario
	allMessages: string
	core: string
	coreHint: string
}

const LABELS = {
	fa: {
		knowledge: 'دانش',
		rules: 'قواعد',
		crm: 'CRM',
		incoming: 'دریافت',
		outgoing: 'پاسخ',
		source: 'منبع',
		confidence: 'اطمینان',
	},
	en: {
		knowledge: 'Knowledge',
		rules: 'Rules',
		crm: 'CRM',
		incoming: 'Receive',
		outgoing: 'Reply',
		source: 'Source',
		confidence: 'Confidence',
	},
} as const

const SECONDARY_MESSAGES = {
	fa: [
		{
			channel: 'تلگرام',
			text: 'هزینه و زمان ارسال چقدره؟',
			time: '۴ دقیقه پیش',
			kind: 'messenger' as const,
		},
		{
			channel: 'وب‌سایت',
			text: 'می‌خوام برای فردا نوبت بگیرم.',
			time: '۶ دقیقه پیش',
			kind: 'website' as const,
		},
	],
	en: [
		{
			channel: 'Telegram',
			text: 'How much is delivery and how long does it take?',
			time: '4 min ago',
			kind: 'messenger' as const,
		},
		{
			channel: 'Website',
			text: 'I want to book an appointment for tomorrow.',
			time: '6 min ago',
			kind: 'website' as const,
		},
	],
} as const

function RubikaIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="780 0 500 543"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
		>
			<g transform="translate(-494 -579.79)">
				<path fill="#b8ce01" d="M1523.57,579.8h1.76c.48,42.73-.25,128.44-.25,128.44-40.86-22.92-82-45.3-122.84-68.29q40.13-22.82,80.32-45.51c12.69-7.16,26.33-13.31,41-14.64Z" />
				<path fill="#7db425" d="M1525.23,579.79h3c15.89,1.43,30.25,9,43.94,16.68q38.24,21.57,76.38,43.34c-41,22.73-82.45,45.82-123.51,68.48-.35-42.73.63-85.77.15-128.5Z" />
				<path fill="#f6a925" d="M1402.27,639.9l122.84,68.29-123.69,72.26s-.06-45.85.08-68.71C1401.39,688,1402.27,639.9,1402.27,639.9Z" />
				<path fill="#35ac9d" d="M1648.69,639.82l.35.19c-.1,42.59,0,85.18,0,127.77-.07,4.17-.11,12.77-.11,12.77l-123.81-72.31s82.58-45.69,123.61-68.42Z" />
				<path fill="#59d6bd" d="M1648.94,640c27.28,15.51,54.37,31.36,81.47,47.17,13.11,7.36,27,15.52,34.16,29.39-38.38,21.25-115.68,64-115.68,64s-.06-8.61,0-12.78c0-42.59-.06-85.18,0-127.77Z" />
				<path fill="#ef7414" d="M1324,684.82c25.65-15,78.19-44.88,78.19-44.88l-.72,140.51s-77-42.45-115.26-63.71c8.34-14.82,23.4-23.83,37.79-31.92Z" />
				<path fill="#fff" d="M1525,708.23l123.81,72.3s-39.84,22.05-59.62,32.64c-21.14,12-64.09,35.82-64.09,35.82l-123.66-68.54Z" />
				<path fill="#e74b50" d="M1277.5,772.82c.11-18.86-.23-38.88,8.66-56.08,38.29,21.26,115.26,63.71,115.26,63.71-41.37,23.92-82.54,48.2-123.89,72.15-.06-26.6,0-53.19,0-79.78Z" />
				<path fill="#794387" d="M1764.57,716.56c7.54,14.1,8.64,30.5,8.22,46.19,0,29.81,0,90.11,0,90.11l-123.88-72.31S1726.19,737.81,1764.57,716.56Z" />
				<path fill="#e4e4e4" d="M1401.42,780.45c.19-.08,123.66,68.54,123.66,68.54s.05,71.69.07,106.76c.2,11.29-.07,34.11-.07,34.11-41.27-22.78-82.32-45.76-123.6-68.54l-.07-.31q0-70.28,0-140.56Z" />
				<path fill="#794387" d="M1277.53,852.6c41.35-24,82.52-48.23,123.89-72.15q-.06,70.29,0,140.56c-6.35-2.65-12.13-6.43-18.19-9.64C1348,892,1312.88,872.18,1277.52,853v-.37Z" />
				<path fill="#f1f1f1" d="M1648.89,780.55q0,43.1,0,86.18c-.13,18.27.46,36.47,0,54.73-41.21,22.4-123.82,68.4-123.82,68.4s.27-22.82.07-34.11c0-35.07-.07-106.76-.07-106.76Z" />
				<path fill="#4c3683" d="M1648.89,780.55s123.88,72.14,123.88,72.31c-41.17,22.82-123.87,68.6-123.87,68.6h0c.46-18.26-.13-36.46,0-54.73q0-43.1,0-86.18Z" />
				<path fill="#4c3683" d="M1277.52,853c35.36,19.21,70.43,39,105.7,58.4,6.06,3.21,11.84,7,18.19,9.64l.07.31q-57,33.23-113.94,66.49c-4-6.09-6-13.19-7.51-20.25-2.39-11.77-2.52-23.83-2.52-35.79q0-39.4,0-78.8Z" />
				<path fill="#e74b50" d="M1772.77,852.86c.06,27.65,0,55.3,0,82.95.4,17.73-.12,36.62-9.57,52.25-34.2-20-114.33-66.6-114.33-66.6S1731.6,875.68,1772.77,852.86Z" />
				<path fill="#0f68a0" d="M1287.54,987.81q56.94-33.3,113.94-66.49c-.25,46.83.08,93.67-.16,140.49q-40.35-22.75-80.49-45.86c-12.51-7.4-25.32-15.63-33.29-28.14Z" />
				<path fill="#49bdca" d="M1401.48,921.32c41.28,22.78,82.33,45.76,123.6,68.54-41.2,24-123.7,72-123.76,71.95.24-46.82-.09-93.66.16-140.49Z" />
				<path fill="#f6a925" d="M1648.7,921.55l.2-.09c.12,46.84-.25,93.69.19,140.53l-.31.15c-32.66-19.51-65.71-38.4-98.52-57.68-8.26-4.7-25.18-14.6-25.18-14.6S1607.49,944,1648.7,921.55Z" />
				<path fill="#ef7414" d="M1648.9,921.46h0c3.65,2.49,80.13,46.62,114.33,66.6-4.86,8.3-12.56,14.39-20.32,19.84-12.52,8.42-25.88,15.47-38.9,23.05-18.31,10.35-36.5,20.91-54.92,31-.44-46.84-.07-93.69-.19-140.53Z" />
				<path fill="#7db425" d="M1525.08,989.86v132.93c-10.25-1.51-21.42-3.87-30.5-9.08-31.11-17.26-62.27-34.42-93.26-51.9C1442.52,1037.76,1483.88,1013.91,1525.08,989.86Z" />
				<path fill="#b8ce01" d="M1525.08,989.86s16.92,9.9,25.18,14.6c32.81,19.28,65.86,38.17,98.52,57.68q-47.79,26.44-95.57,53a62.48,62.48,0,0,1-25.87,7.69c-.56,0-2.26,0-2.26,0Z" />
			</g>
		</svg>
	)
}

function MainChannelBadge({ activeIndex }: { activeIndex: number }) {
	if (activeIndex === 0) {
		return (
			<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 text-white shadow-[0_0_18px_rgba(236,72,153,0.35)]">
				<InstagramIcon className="h-[18px] w-[18px]" />
			</span>
		)
	}

	if (activeIndex === 2) {
		return (
			<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/90 text-white shadow-[0_0_18px_rgba(14,165,233,0.22)]">
				<Globe2 className="h-4 w-4" />
			</span>
		)
	}

	if (activeIndex === 1 || activeIndex === 3) {
		return (
			<span
				className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#229ED9]/10 text-[#229ED9] shadow-[0_0_18px_rgba(34,158,217,0.16)]"
				title="Telegram"
			>
				<TelegramIcon className="h-5 w-5" />
			</span>
		)
	}

	if (activeIndex === 4) {
		return (
			<span
				className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[0.035] shadow-[0_0_18px_rgba(73,189,202,0.14)]"
				title="Rubika"
			>
				<RubikaIcon className="h-5 w-5" />
			</span>
		)
	}

	return (
		<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/90 text-white shadow-[0_0_18px_rgba(16,185,129,0.22)]">
			<MessageCircleMore className="h-4 w-4" />
		</span>
	)
}

function SecondaryChannelBadge({ kind }: { kind: 'messenger' | 'website' }) {
	if (kind === 'website') {
		return (
			<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-600">
				<Globe2 className="h-3.5 w-3.5" />
			</span>
		)
	}

	return (
		<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#229ED9]/10 text-[#229ED9]">
			<TelegramIcon className="h-4 w-4" />
		</span>
	)
}

function MessageCard({
	locale,
	scenario,
	label,
	activeIndex,
	reduce,
}: {
	locale: 'fa' | 'en'
	scenario: Scenario
	label: string
	activeIndex: number
	reduce: boolean | null
}) {
	const secondaryMessages = SECONDARY_MESSAGES[locale]

	return (
		<div
			dir={locale === 'fa' ? 'rtl' : 'ltr'}
			className="flex h-[232px] flex-col rounded-[1.4rem] border border-black/[0.08] bg-white p-2.5 text-black shadow-[0_20px_48px_rgba(0,0,0,0.34)]"
		>
			<div className="flex items-center justify-between gap-2 px-0.5">
				<p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-black/[0.58]">
					<MessageCircleMore className="h-3.5 w-3.5 shrink-0" />
					{label}
				</p>
				<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
			</div>

			<div className="mt-2.5 flex-1 space-y-1.5">
				<AnimatePresence mode="wait" initial={false}>
					<m.div
						key={`${activeIndex}-${scenario.person}`}
						initial={reduce ? false : { opacity: 0, y: 7, scale: 0.985 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={reduce ? undefined : { opacity: 0, y: -5, scale: 0.99 }}
						transition={{
							duration: reduce ? 0 : 0.3,
							ease: [0.23, 1, 0.32, 1],
						}}
						className="h-[92px] rounded-[1.05rem] border border-black/[0.08] bg-black/[0.025] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
					>
						<div className="flex items-center gap-2.5">
							<MainChannelBadge activeIndex={activeIndex} />

							<div className="min-w-0 flex-1">
								<p className="truncate text-[11px] font-semibold text-black/[0.86]">
									{scenario.person} · {scenario.channel}
								</p>
								<p className="mt-0.5 whitespace-nowrap text-[9px] text-black/[0.42]">
									{scenario.time}
								</p>
							</div>
						</div>

						<p className="mt-2.5 line-clamp-2 text-[10.5px] font-medium leading-[1.65] text-black/[0.74]">
							{scenario.text}
						</p>
					</m.div>
				</AnimatePresence>

				{secondaryMessages.map((message) => (
					<div
						key={message.channel}
						className="flex h-[40px] items-center gap-2 rounded-xl border border-black/[0.07] bg-black/[0.018] px-2.5 py-1.5"
					>
						<SecondaryChannelBadge kind={message.kind} />
						<div className="min-w-0 flex-1">
							<div className="flex items-center justify-between gap-2">
								<p className="truncate text-[9px] font-medium text-black/[0.62]">
									{message.channel}
								</p>
								<p className="shrink-0 whitespace-nowrap text-[9px] text-black/[0.4]">
									{message.time}
								</p>
							</div>
							<p className="mt-0.5 truncate text-[9px] text-black/[0.48]">{message.text}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function ResultCard({
	locale,
	scenario,
	activeIndex,
	reduce,
}: {
	locale: 'fa' | 'en'
	scenario: Scenario
	activeIndex: number
	reduce: boolean | null
}) {
	const labels = LABELS[locale]

	return (
		<div
			dir={locale === 'fa' ? 'rtl' : 'ltr'}
			className="flex h-[264px] min-h-[264px] max-h-[264px] shrink-0 flex-col overflow-hidden rounded-[1.5rem] bg-white p-3.5 text-black shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
		>
			<div className="flex items-center justify-between" aria-hidden>
				<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
					<Sparkles className="h-4 w-4" />
				</span>
				<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.09)]" />
			</div>

			<AnimatePresence mode="wait" initial={false}>
				<m.div
					key={`${activeIndex}-${scenario.reply}`}
					initial={reduce ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={reduce ? undefined : { opacity: 0, y: -5 }}
					transition={{
						duration: reduce ? 0 : 0.32,
						ease: [0.23, 1, 0.32, 1],
					}}
				>
					<p className="mt-2.5 h-[52px] overflow-hidden text-[11px] leading-[1.75] text-black/[0.7]">
						{scenario.reply}
					</p>

					<div
						className={`mt-2.5 grid h-[34px] gap-1.5 ${scenario.quickActions.length > 2 ? 'grid-cols-4' : 'grid-cols-2'}`}
					>
						{scenario.quickActions.slice(0, 4).map((action) => (
							<span
								key={action}
								className="flex h-[34px] items-center justify-center truncate rounded-lg border border-black/[0.08] bg-black/[0.025] px-1.5 text-center text-[9px] font-medium text-black/[0.58]"
							>
								{action}
							</span>
						))}
					</div>

					<div className="mt-2.5 rounded-xl border border-black/[0.07] bg-black/[0.025] px-2.5 py-1.5">
						<div className="flex items-center justify-between gap-2 text-[9px] text-black/[0.48]">
							<span className="flex min-w-0 items-center gap-1.5">
								<PackageSearch className="h-3.5 w-3.5 shrink-0" />
								<span className="truncate">
									{labels.source}: {scenario.source}
								</span>
							</span>

							<span className="shrink-0 whitespace-nowrap">
								{labels.confidence}: {scenario.confidence}
							</span>
						</div>

						<p className="mt-2 flex min-w-0 items-center gap-1.5 text-emerald-700">
							<span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
								<Check className="h-3 w-3" />
							</span>
							<span className="line-clamp-2 text-[9px] font-semibold leading-4 tracking-[-0.015em] rtl:tracking-normal">
								{scenario.result}
							</span>
						</p>
					</div>
				</m.div>
			</AnimatePresence>
		</div>
	)
}

function Core({
	core,
	coreHint,
	reduce,
}: {
	core: string
	coreHint: string
	reduce: boolean | null
}) {
	return (
		<m.div
			animate={
				reduce
					? undefined
					: {
							scale: [1, 1.012, 1],
							boxShadow: [
								'0 0 34px rgba(52,211,153,0.10)',
								'0 0 58px rgba(52,211,153,0.23)',
								'0 0 34px rgba(52,211,153,0.10)',
							],
						}
			}
			transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
			className="relative grid h-[112px] w-[112px] place-items-center rounded-[1.8rem] border border-white/25 bg-white/[0.085] text-center backdrop-blur-xl"
		>
			<span aria-hidden className="absolute inset-2 rounded-[1.35rem] border border-white/10" />
			<span
				aria-hidden
				className="absolute -inset-2 -z-10 rounded-[2.05rem] border border-emerald-300/20 shadow-[0_0_25px_rgba(52,211,153,0.12)]"
			/>

			<div className="relative">
				<span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-black shadow-[0_0_28px_rgba(255,255,255,0.2)]">
					<Sparkles className="h-[18px] w-[18px]" />
				</span>
				<p className="mt-2 whitespace-nowrap text-[11px] font-semibold text-white">{core}</p>
				<p className="mt-0.5 max-w-[88px] truncate text-[9px] text-white/[0.46]">{coreHint}</p>
			</div>
		</m.div>
	)
}

function NetworkLabel({
	icon,
	children,
	className,
	direction = 'right',
}: {
	icon: ReactNode
	children: ReactNode
	className: string
	direction?: 'left' | 'right' | 'up' | 'down' | 'none'
}) {
	const connector =
		direction === 'right'
			? 'left-full top-1/2 h-px w-3 -translate-y-1/2 border-t'
			: direction === 'left'
				? 'right-full top-1/2 h-px w-3 -translate-y-1/2 border-t'
				: direction === 'down'
					? 'left-1/2 top-full h-8 w-px -translate-x-1/2 border-l'
					: direction === 'up'
						? 'bottom-full left-1/2 h-8 w-px -translate-x-1/2 border-l'
						: null

	return (
		<div
			aria-hidden
			className={`absolute z-20 flex items-center gap-1 rounded-full border border-white/10 bg-black/[0.86] px-2 py-1 text-[9px] text-white/[0.62] backdrop-blur ${className}`}
		>
			{connector ? (
				<span className={`absolute border-dashed border-emerald-300/35 ${connector}`} />
			) : null}
			{icon}
			{children}
		</div>
	)
}

function CrmChip({ locale }: { locale: 'fa' | 'en' }) {
	return (
		<div className="relative mt-4 inline-flex self-start">
			<span
				aria-hidden
				className="absolute -top-4 left-1/2 h-4 -translate-x-1/2 border-l border-dashed border-emerald-300/35"
			/>
			<span
				aria-hidden
				className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.85)]"
			/>
			<div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-black/80 px-2.5 py-1.5 text-[9px] text-white/[0.68] backdrop-blur">
				<UsersRound className="h-3.5 w-3.5" />
				{LABELS[locale].crm}
			</div>
		</div>
	)
}

function DesktopOperationFlow({
	locale,
	reduce,
	activeIndex,
	scenario,
	allMessages,
	core,
	coreHint,
}: NeuralOperationGraphProps) {
	const labels = LABELS[locale]

	const inUpper = 'M 218 156 C 240 156 244 103 276 103 C 302 103 309 127 324 137'
	const inLower = 'M 218 184 C 240 184 244 229 276 229 C 302 229 309 205 324 195'
	const outUpper = 'M 436 137 C 451 127 458 103 484 103 C 516 103 520 156 542 156'
	const outLower = 'M 436 195 C 451 205 458 229 484 229 C 516 229 520 184 542 184'
	const knowledgePath = 'M 308 58 C 308 88 318 118 338 145'
	const rulesPath = 'M 308 254 C 308 226 318 204 338 187'
	const networkPaths = [inUpper, inLower, outUpper, outLower]
	const auxiliaryPaths = [knowledgePath, rulesPath]

	return (
		<div dir="ltr" className="relative hidden h-[328px] overflow-hidden sm:block">
			<svg
				aria-hidden
				viewBox="0 0 780 328"
				preserveAspectRatio="xMidYMid meet"
				className="absolute inset-0 h-full w-full"
			>
				<NetworkDefs id="vigent-desktop-flow" />

				{networkPaths.map((path) => (
					<NeuralConnectionPath key={path} path={path} filterId="vigent-desktop-flow" />
				))}

				{auxiliaryPaths.map((path) => (
					<NeuralConnectionPath
						key={path}
						path={path}
						filterId="vigent-desktop-flow"
						variant="auxiliary"
						reduce={reduce}
					/>
				))}

				<NetworkNode cx={276} cy={103} pulse={!reduce} />
				<NetworkNode cx={276} cy={229} pulse={!reduce} />
				<NetworkNode cx={484} cy={103} pulse={!reduce} />
				<NetworkNode cx={484} cy={229} pulse={!reduce} />

				{!reduce ? (
					<>
						<SignalParticle path={inUpper} delay={0} filterId="vigent-desktop-flow" />
						<SignalParticle
							path={knowledgePath}
							delay={0.35}
							filterId="vigent-desktop-flow"
							duration={3.05}
						/>
						<SignalParticle
							path={knowledgePath}
							delay={1.85}
							filterId="vigent-desktop-flow"
							duration={3.05}
						/>
						<SignalParticle path={inLower} delay={0.88} filterId="vigent-desktop-flow" />
						<SignalParticle
							path={rulesPath}
							delay={1.05}
							filterId="vigent-desktop-flow"
							duration={3.05}
						/>
						<SignalParticle
							path={rulesPath}
							delay={2.55}
							filterId="vigent-desktop-flow"
							duration={3.05}
						/>
						<SignalParticle path={outUpper} delay={1.62} filterId="vigent-desktop-flow" />
						<SignalParticle path={outLower} delay={2.32} filterId="vigent-desktop-flow" />
					</>
				) : null}
			</svg>

			<div className="absolute start-4 top-1/2 z-10 w-[202px] -translate-y-1/2">
				<MessageCard
					locale={locale}
					scenario={scenario}
					label={allMessages}
					activeIndex={activeIndex}
					reduce={reduce}
				/>
			</div>

			<div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
				<Core core={core} coreHint={coreHint} reduce={reduce} />
			</div>

			<div className="absolute end-4 top-1/2 z-10 flex w-[218px] -translate-y-1/2 flex-col">
				<ResultCard
					locale={locale}
					scenario={scenario}
					activeIndex={activeIndex}
					reduce={reduce}
				/>
				<CrmChip locale={locale} />
			</div>

			<NetworkLabel
				icon={<Database className="h-2.5 w-2.5" />}
				className="left-[39.5%] top-[15%] -translate-x-1/2 shadow-[0_0_18px_rgba(52,211,153,0.14)]"
				direction="none"
			>
				{labels.knowledge}
			</NetworkLabel>

			<NetworkLabel
				icon={<ShieldCheck className="h-2.5 w-2.5" />}
				className="bottom-[15%] left-[39.5%] -translate-x-1/2 shadow-[0_0_18px_rgba(52,211,153,0.14)]"
				direction="none"
			>
				{labels.rules}
			</NetworkLabel>
		</div>
	)
}

function MobileOperationFlow({
	locale,
	reduce,
	activeIndex,
	scenario,
	allMessages,
	core,
	coreHint,
}: NeuralOperationGraphProps) {
	const labels = LABELS[locale]
	const incomingPath = 'M 160 0 C 160 20 160 32 160 48'
	const outgoingPath = 'M 160 174 C 160 192 160 208 160 232'
	const knowledgePath = 'M 120 52 C 120 78 116 98 112 116'
	const rulesPath = 'M 200 180 C 200 154 204 132 208 116'
	const mobileNetworkPaths = [incomingPath, outgoingPath]
	const mobileAuxiliaryPaths = [knowledgePath, rulesPath]

	return (
		<div className="relative px-3 pb-5 pt-5 sm:hidden">
			<MessageCard
				locale={locale}
				scenario={scenario}
				label={allMessages}
				activeIndex={activeIndex}
				reduce={reduce}
			/>

			<div dir="ltr" className="relative mx-auto h-[232px] w-full max-w-[340px]">
				<svg
					aria-hidden
					viewBox="0 0 320 232"
					preserveAspectRatio="xMidYMid meet"
					className="absolute inset-0 h-full w-full"
				>
					<NetworkDefs id="vigent-mobile-flow" />

					{mobileNetworkPaths.map((path) => (
						<NeuralConnectionPath key={path} path={path} filterId="vigent-mobile-flow" compact />
					))}

					{mobileAuxiliaryPaths.map((path) => (
						<NeuralConnectionPath
							key={path}
							path={path}
							filterId="vigent-mobile-flow"
							variant="auxiliary"
							compact
							reduce={reduce}
						/>
					))}

					<NetworkNode cx={160} cy={32} pulse={!reduce} />
					<NetworkNode cx={160} cy={204} pulse={!reduce} />

					{!reduce ? (
						<>
							<SignalParticle
								path={incomingPath}
								delay={0}
								filterId="vigent-mobile-flow"
								duration={2.5}
							/>
							<SignalParticle
								path={knowledgePath}
								delay={0.42}
								filterId="vigent-mobile-flow"
								duration={2.9}
							/>
							<SignalParticle
								path={knowledgePath}
								delay={1.82}
								filterId="vigent-mobile-flow"
								duration={2.9}
							/>
							<SignalParticle
								path={rulesPath}
								delay={1.02}
								filterId="vigent-mobile-flow"
								duration={2.9}
							/>
							<SignalParticle
								path={rulesPath}
								delay={2.42}
								filterId="vigent-mobile-flow"
								duration={2.9}
							/>
							<SignalParticle
								path={outgoingPath}
								delay={2.02}
								filterId="vigent-mobile-flow"
								duration={2.5}
							/>
						</>
					) : null}
				</svg>

				<div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
					<Core core={core} coreHint={coreHint} reduce={reduce} />
				</div>

				<NetworkLabel
					icon={<Database className="h-2.5 w-2.5" />}
					className="left-[37.5%] top-[15%] -translate-x-1/2 shadow-[0_0_16px_rgba(52,211,153,0.14)]"
					direction="none"
				>
					{labels.knowledge}
				</NetworkLabel>

				<NetworkLabel
					icon={<ShieldCheck className="h-2.5 w-2.5" />}
					className="bottom-[15%] left-[62.5%] -translate-x-1/2 shadow-[0_0_16px_rgba(52,211,153,0.14)]"
					direction="none"
				>
					{labels.rules}
				</NetworkLabel>
			</div>

			<div className="flex flex-col">
				<ResultCard
					locale={locale}
					scenario={scenario}
					activeIndex={activeIndex}
					reduce={reduce}
				/>
				<CrmChip locale={locale} />
			</div>
		</div>
	)
}

export function NeuralOperationGraph(props: NeuralOperationGraphProps) {
	return (
		<>
			<DesktopOperationFlow {...props} />
			<MobileOperationFlow {...props} />
		</>
	)
}
