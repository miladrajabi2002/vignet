'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
	BookOpen,
	Check,
	ChevronLeft,
	ChevronRight,
	Database,
	Globe2,
	MessageCircleMore,
	PackageSearch,
	Send,
	ShieldCheck,
	Sparkles,
	UsersRound,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

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
	sharedBrain: string
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
		viewAll: 'مشاهده همه پیام‌ها',
	},
	en: {
		knowledge: 'Knowledge',
		rules: 'Rules',
		crm: 'CRM',
		incoming: 'Receive',
		outgoing: 'Reply',
		source: 'Source',
		confidence: 'Confidence',
		viewAll: 'View all messages',
	},
} as const

const SECONDARY_MESSAGES = {
	fa: [
		{
			channel: 'واتساپ',
			text: 'هزینه و زمان ارسال چقدره؟',
			time: '۴ دقیقه پیش',
			kind: 'whatsapp' as const,
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
			channel: 'WhatsApp',
			text: 'How much is delivery and how long does it take?',
			time: '4 min ago',
			kind: 'whatsapp' as const,
		},
		{
			channel: 'Website',
			text: 'I want to book an appointment for tomorrow.',
			time: '6 min ago',
			kind: 'website' as const,
		},
	],
} as const

function SignalParticle({
	path,
	delay,
	filterId,
	duration = 2.85,
}: {
	path: string
	delay: number
	filterId: string
	duration?: number
}) {
	return (
		<circle r="2.5" fill="#6ee7b7" filter={`url(#${filterId})`} opacity="0">
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
		</circle>
	)
}

function NetworkDefs({ id }: { id: string }) {
	return (
		<defs>
			<filter id={id} x="-350%" y="-350%" width="800%" height="800%">
				<feGaussianBlur stdDeviation="2.8" result="glow" />
				<feMerge>
					<feMergeNode in="glow" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>

			<linearGradient id={`${id}-line`} x1="0" x2="1">
				<stop offset="0" stopColor="#6ee7b7" stopOpacity="0.06" />
				<stop offset="0.5" stopColor="#6ee7b7" stopOpacity="0.55" />
				<stop offset="1" stopColor="#6ee7b7" stopOpacity="0.06" />
			</linearGradient>
		</defs>
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

	if (activeIndex === 4) {
		return (
			<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/90 text-white shadow-[0_0_18px_rgba(139,92,246,0.22)]">
				<BookOpen className="h-4 w-4" />
			</span>
		)
	}

	return (
		<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/90 text-white shadow-[0_0_18px_rgba(16,185,129,0.22)]">
			<MessageCircleMore className="h-4 w-4" />
		</span>
	)
}

function SecondaryChannelBadge({ kind }: { kind: 'whatsapp' | 'website' }) {
	if (kind === 'website') {
		return (
			<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
				<Globe2 className="h-3.5 w-3.5" />
			</span>
		)
	}

	return (
		<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
			<MessageCircleMore className="h-3.5 w-3.5" />
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
	const labels = LABELS[locale]
	const secondaryMessages = SECONDARY_MESSAGES[locale]
	const Arrow = locale === 'fa' ? ChevronLeft : ChevronRight

	return (
		<div
			dir={locale === 'fa' ? 'rtl' : 'ltr'}
			className="rounded-[1.45rem] border border-white/[0.16] bg-[rgba(8,8,8,0.96)] p-3 shadow-[0_20px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl"
		>
			<div className="flex items-center justify-between gap-2 px-0.5">
				<p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[9px] font-medium text-white/[0.55]">
					<MessageCircleMore className="h-3.5 w-3.5 shrink-0" />
					{label}
				</p>
				<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
			</div>

			<div className="mt-3 space-y-2">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={`${activeIndex}-${scenario.person}`}
						initial={reduce ? false : { opacity: 0, y: 7, scale: 0.985 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={reduce ? undefined : { opacity: 0, y: -5, scale: 0.99 }}
						transition={{
							duration: reduce ? 0 : 0.3,
							ease: [0.23, 1, 0.32, 1],
						}}
						className="rounded-[1.1rem] border border-white/[0.14] bg-white/[0.065] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
					>
						<div className="flex items-center gap-2.5">
							<MainChannelBadge activeIndex={activeIndex} />

							<div className="min-w-0 flex-1">
								<p className="truncate text-[10px] font-semibold text-white">
									{scenario.person} · {scenario.channel}
								</p>
								<p className="mt-0.5 whitespace-nowrap text-[7.5px] text-white/[0.35]">
									{scenario.time}
								</p>
							</div>
						</div>

						<p className="mt-3 text-[10px] font-medium leading-[1.75] text-white/[0.82]">
							{scenario.text}
						</p>
					</motion.div>
				</AnimatePresence>

				{secondaryMessages.map((message) => (
					<div
						key={message.channel}
						className="flex items-center gap-2.5 rounded-xl border border-white/[0.085] bg-white/[0.028] px-2.5 py-2"
					>
						<SecondaryChannelBadge kind={message.kind} />
						<div className="min-w-0 flex-1">
							<div className="flex items-center justify-between gap-2">
								<p className="truncate text-[8px] font-medium text-white/[0.62]">
									{message.channel}
								</p>
								<p className="shrink-0 whitespace-nowrap text-[6.5px] text-white/[0.28]">
									{message.time}
								</p>
							</div>
							<p className="mt-0.5 truncate text-[7.5px] text-white/[0.42]">
								{message.text}
							</p>
						</div>
					</div>
				))}
			</div>

			<div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[8px] text-white/[0.55]">
				<span>{labels.viewAll}</span>
				<Arrow className="h-3.5 w-3.5" />
			</div>
		</div>
	)
}

function ResultCard({
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
	const labels = LABELS[locale]

	return (
		<div
			dir={locale === 'fa' ? 'rtl' : 'ltr'}
			className="rounded-[1.55rem] bg-white p-4 text-black shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
						<Sparkles className="h-4 w-4" />
					</span>
					<p className="whitespace-nowrap text-[10px] font-semibold sm:text-[11px]">
						{label}
					</p>
				</div>

				<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
			</div>

			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={`${activeIndex}-${scenario.reply}`}
					initial={reduce ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={reduce ? undefined : { opacity: 0, y: -5 }}
					transition={{
						duration: reduce ? 0 : 0.32,
						ease: [0.23, 1, 0.32, 1],
					}}
				>
					<p className="mt-3 min-h-[52px] text-[10px] leading-[1.95] text-black/[0.68] sm:text-[11px]">
						{scenario.reply}
					</p>

					<div className="mt-3 grid grid-cols-2 gap-2">
						{scenario.quickActions.slice(0, 4).map((action) => (
							<span
								key={action}
								className="truncate rounded-xl border border-black/[0.08] bg-black/[0.025] px-2 py-2 text-center text-[7.5px] font-medium text-black/[0.54]"
							>
								{action}
							</span>
						))}
					</div>

					<div className="mt-3 rounded-xl border border-black/[0.07] bg-black/[0.025] px-3 py-2.5">
						<div className="flex items-center justify-between gap-2 text-[7px] text-black/[0.42]">
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
							<span className="whitespace-nowrap text-[clamp(6.2px,0.9vw,8px)] font-semibold tracking-[-0.025em]">
								{scenario.result}
							</span>
						</p>
					</div>
				</motion.div>
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
		<motion.div
			animate={
				reduce
					? undefined
					: {
							scale: [1, 1.025, 1],
							boxShadow: [
								'0 0 34px rgba(52,211,153,0.10)',
								'0 0 58px rgba(52,211,153,0.23)',
								'0 0 34px rgba(52,211,153,0.10)',
							],
						}
			}
			transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
			className="relative grid h-[126px] w-[126px] place-items-center rounded-[2rem] border border-white/25 bg-white/[0.085] text-center backdrop-blur-xl"
		>
			<span
				aria-hidden
				className="absolute inset-2 rounded-[1.5rem] border border-white/10"
			/>
			<span
				aria-hidden
				className="absolute -inset-2 -z-10 rounded-[2.3rem] border border-emerald-300/20 shadow-[0_0_25px_rgba(52,211,153,0.12)]"
			/>

			<div className="relative">
				<span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white text-black shadow-[0_0_28px_rgba(255,255,255,0.2)]">
					<Sparkles className="h-[18px] w-[18px]" />
				</span>
				<p className="mt-2.5 whitespace-nowrap text-[12px] font-semibold text-white">
					{core}
				</p>
				<p className="mt-0.5 max-w-[96px] truncate text-[7.5px] text-white/[0.36]">
					{coreHint}
				</p>
			</div>
		</motion.div>
	)
}

function NetworkNode({
	cx,
	cy,
	active = true,
}: {
	cx: number
	cy: number
	active?: boolean
}) {
	return (
		<g>
			<circle
				cx={cx}
				cy={cy}
				r="9"
				fill="#090909"
				stroke={active ? '#6ee7b7' : 'white'}
				strokeOpacity={active ? 0.82 : 0.2}
			/>
			<circle
				cx={cx}
				cy={cy}
				r="2.5"
				fill={active ? '#6ee7b7' : 'white'}
				fillOpacity={active ? 1 : 0.32}
			/>
		</g>
	)
}

function FlowTag({
	icon,
	children,
	className,
}: {
	icon: ReactNode
	children: ReactNode
	className: string
}) {
	return (
		<div
			aria-hidden
			className={`absolute z-20 flex items-center gap-1 rounded-full border border-white/10 bg-black/[0.82] px-2 py-1 text-[7px] text-white/[0.46] backdrop-blur ${className}`}
		>
			{icon}
			{children}
		</div>
	)
}

function CrmChip({ locale }: { locale: 'fa' | 'en' }) {
	return (
		<div className="mt-2.5 inline-flex items-center gap-1.5 self-start rounded-full border border-white/[0.14] bg-black/75 px-2.5 py-1.5 text-[8px] text-white/[0.58] backdrop-blur">
			<UsersRound className="h-3.5 w-3.5" />
			{LABELS[locale].crm}
			<span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.85)]" />
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
	sharedBrain,
}: NeuralOperationGraphProps) {
	const labels = LABELS[locale]

	const inUpper = 'M 248 140 C 270 140 272 95 300 95 C 320 95 324 120 331 132'
	const inLower = 'M 248 190 C 270 190 272 220 300 220 C 320 220 324 195 331 182'
	const outUpper = 'M 429 132 C 436 120 440 95 460 95 C 488 95 490 140 512 140'
	const outLower = 'M 429 182 C 436 195 440 220 460 220 C 488 220 490 190 512 190'

	return (
		<div dir="ltr" className="relative hidden h-[330px] overflow-hidden sm:block">
			<svg
				aria-hidden
				viewBox="0 0 760 330"
				preserveAspectRatio="xMidYMid meet"
				className="absolute inset-0 h-full w-full"
			>
				<NetworkDefs id="vigent-desktop-flow" />

				{[inUpper, inLower, outUpper, outLower].map((path) => (
					<path
						key={path}
						d={path}
						fill="none"
						stroke="url(#vigent-desktop-flow-line)"
						strokeWidth="1.2"
						strokeDasharray="4 7"
						strokeLinecap="round"
					/>
				))}

				<NetworkNode cx={300} cy={95} />
				<NetworkNode cx={300} cy={220} />
				<NetworkNode cx={460} cy={95} />
				<NetworkNode cx={460} cy={220} />

				{!reduce ? (
					<>
						<SignalParticle path={inUpper} delay={0} filterId="vigent-desktop-flow" />
						<SignalParticle path={inLower} delay={0.9} filterId="vigent-desktop-flow" />
						<SignalParticle path={outUpper} delay={1.45} filterId="vigent-desktop-flow" />
						<SignalParticle path={outLower} delay={2.3} filterId="vigent-desktop-flow" />
					</>
				) : null}
			</svg>

			<div className="absolute start-5 top-1/2 z-10 w-[228px] -translate-y-1/2">
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

			<div className="absolute end-5 top-1/2 z-10 flex w-[228px] -translate-y-1/2 flex-col">
				<ResultCard
					locale={locale}
					scenario={scenario}
					label={sharedBrain}
					activeIndex={activeIndex}
					reduce={reduce}
				/>
				<CrmChip locale={locale} />
			</div>

			<FlowTag
				icon={<Database className="h-2.5 w-2.5" />}
				className="left-[34.2%] top-[14%] -translate-x-1/2"
			>
				{labels.knowledge}
			</FlowTag>

			<FlowTag
				icon={<ShieldCheck className="h-2.5 w-2.5" />}
				className="left-[34.2%] bottom-[14%] -translate-x-1/2"
			>
				{labels.rules}
			</FlowTag>

			<FlowTag
				icon={<Send className="h-2.5 w-2.5" />}
				className="right-[31.5%] top-[43%] translate-x-1/2"
			>
				{labels.outgoing}
			</FlowTag>

			<FlowTag
				icon={<MessageCircleMore className="h-2.5 w-2.5" />}
				className="left-[31.5%] top-[43%] -translate-x-1/2"
			>
				{labels.incoming}
			</FlowTag>
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
	sharedBrain,
}: NeuralOperationGraphProps) {
	const labels = LABELS[locale]
	const incomingPath = 'M 160 0 C 160 24 160 38 160 54'
	const outgoingPath = 'M 160 186 C 160 206 160 224 160 248'
	const knowledgePath = 'M 76 104 C 105 104 116 113 136 124'
	const rulesPath = 'M 244 104 C 215 104 204 113 184 124'

	return (
		<div className="relative px-3 pb-5 pt-5 sm:hidden">
			<MessageCard
				locale={locale}
				scenario={scenario}
				label={allMessages}
				activeIndex={activeIndex}
				reduce={reduce}
			/>

			<div dir="ltr" className="relative mx-auto h-[250px] w-full max-w-[360px]">
				<svg
					aria-hidden
					viewBox="0 0 320 250"
					preserveAspectRatio="xMidYMid meet"
					className="absolute inset-0 h-full w-full"
				>
					<NetworkDefs id="vigent-mobile-flow" />

					{[incomingPath, outgoingPath, knowledgePath, rulesPath].map((path) => (
						<path
							key={path}
							d={path}
							fill="none"
							stroke="url(#vigent-mobile-flow-line)"
							strokeWidth="1.2"
							strokeDasharray="4 7"
							strokeLinecap="round"
						/>
					))}

					<NetworkNode cx={160} cy={38} />
					<NetworkNode cx={160} cy={214} />
					<NetworkNode cx={92} cy={104} />
					<NetworkNode cx={228} cy={104} />

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
								delay={0.7}
								filterId="vigent-mobile-flow"
								duration={2.5}
							/>
							<SignalParticle
								path={rulesPath}
								delay={1.25}
								filterId="vigent-mobile-flow"
								duration={2.5}
							/>
							<SignalParticle
								path={outgoingPath}
								delay={1.85}
								filterId="vigent-mobile-flow"
								duration={2.5}
							/>
						</>
					) : null}
				</svg>

				<div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
					<Core core={core} coreHint={coreHint} reduce={reduce} />
				</div>

				<FlowTag
					icon={<Database className="h-2.5 w-2.5" />}
					className="left-[6%] top-[29%]"
				>
					{labels.knowledge}
				</FlowTag>

				<FlowTag
					icon={<ShieldCheck className="h-2.5 w-2.5" />}
					className="right-[6%] top-[29%]"
				>
					{labels.rules}
				</FlowTag>

				<FlowTag
					icon={<MessageCircleMore className="h-2.5 w-2.5" />}
					className="left-1/2 top-[4%] -translate-x-1/2"
				>
					{labels.incoming}
				</FlowTag>

				<FlowTag
					icon={<Send className="h-2.5 w-2.5" />}
					className="bottom-[4%] left-1/2 -translate-x-1/2"
				>
					{labels.outgoing}
				</FlowTag>
			</div>

			<div className="flex flex-col">
				<ResultCard
					locale={locale}
					scenario={scenario}
					label={sharedBrain}
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
