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

function TelegramIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
		>
			<path
				d="M20.665 3.717 2.934 10.554c-1.21.486-1.203 1.161-.222 1.462l4.55 1.42 1.737 5.33c.211.584.107.816.72.816.474 0 .683-.216.948-.474l2.185-2.124 4.546 3.358c.838.462 1.442.224 1.65-.778l2.986-14.075c.306-1.225-.467-1.78-1.369-1.372ZM8.153 13.11l10.37-6.543c.518-.314.994-.145.604.202l-8.563 7.727-.334 3.56-2.077-4.946Z"
				fill="currentColor"
			/>
		</svg>
	)
}

function RubikaIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
		>
			<path
				d="M7.2 3.8h9.6c1.9 0 3.4 1.5 3.4 3.4v9.6c0 1.9-1.5 3.4-3.4 3.4H7.2c-1.9 0-3.4-1.5-3.4-3.4V7.2c0-1.9 1.5-3.4 3.4-3.4Z"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinejoin="round"
			/>
			<path
				d="M8.5 8.2h7a1.4 1.4 0 0 1 1.4 1.4v4.8a1.4 1.4 0 0 1-1.4 1.4h-4.2l-2.3 1.8v-1.8h-.5a1.4 1.4 0 0 1-1.4-1.4V9.6a1.4 1.4 0 0 1 1.4-1.4Z"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M10 11.1h4M10 13.4h2.8"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
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

	if (activeIndex === 3) {
		return (
			<span
				className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#229ED9] text-white shadow-[0_0_18px_rgba(34,158,217,0.34)]"
				title="Telegram"
			>
				<TelegramIcon className="h-[19px] w-[19px]" />
			</span>
		)
	}

	if (activeIndex === 4) {
		return (
			<span
				className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1B4BFF] text-white shadow-[0_0_18px_rgba(27,75,255,0.28)]"
				title="Rubika"
			>
				<RubikaIcon className="h-[18px] w-[18px]" />
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
	const secondaryMessages = SECONDARY_MESSAGES[locale]

	return (
		<div
			dir={locale === 'fa' ? 'rtl' : 'ltr'}
			className="flex h-[232px] flex-col rounded-[1.4rem] border border-white/[0.16] bg-[rgba(8,8,8,0.96)] p-2.5 shadow-[0_20px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl"
		>
			<div className="flex items-center justify-between gap-2 px-0.5">
				<p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-white/[0.62]">
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
						className="h-[92px] rounded-[1.05rem] border border-white/[0.14] bg-white/[0.065] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
					>
						<div className="flex items-center gap-2.5">
							<MainChannelBadge activeIndex={activeIndex} />

							<div className="min-w-0 flex-1">
								<p className="truncate text-[11px] font-semibold text-white">
									{scenario.person} · {scenario.channel}
								</p>
								<p className="mt-0.5 whitespace-nowrap text-[9px] text-white/[0.42]">
									{scenario.time}
								</p>
							</div>
						</div>

						<p className="mt-2.5 line-clamp-2 text-[10.5px] font-medium leading-[1.65] text-white/[0.84]">
							{scenario.text}
						</p>
					</m.div>
				</AnimatePresence>

				{secondaryMessages.map((message) => (
					<div
						key={message.channel}
						className="flex h-[40px] items-center gap-2 rounded-xl border border-white/[0.085] bg-white/[0.028] px-2.5 py-1.5"
					>
						<SecondaryChannelBadge kind={message.kind} />
						<div className="min-w-0 flex-1">
							<div className="flex items-center justify-between gap-2">
								<p className="truncate text-[9px] font-medium text-white/[0.66]">
									{message.channel}
								</p>
								<p className="shrink-0 whitespace-nowrap text-[9px] text-white/[0.4]">
									{message.time}
								</p>
							</div>
							<p className="mt-0.5 truncate text-[9px] text-white/[0.48]">{message.text}</p>
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
			className="flex h-[264px] flex-col rounded-[1.5rem] bg-white p-3.5 text-black shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
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
				<span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.85)]" />
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
		<div dir="ltr" className="relative hidden h-[312px] overflow-hidden sm:block">
			<svg
				aria-hidden
				viewBox="0 0 780 312"
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
