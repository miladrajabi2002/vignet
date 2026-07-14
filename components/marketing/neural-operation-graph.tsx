'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Database, MessageCircleMore, PackageSearch, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { InstagramIcon } from './social-links'

type Scenario = {
	channel: string
	person: string
	text: string
	time: string
	reply: string
	source: string
	result: string
}

type NeuralOperationGraphProps = {
	locale: 'fa' | 'en'
	reduce: boolean | null
	scenarioIdx: number
	scenario: Scenario
	allMessages: string
	core: string
	coreHint: string
	sharedBrain: string
}

const LABELS = {
	fa: { knowledge: 'دانش', rules: 'قواعد', crm: 'CRM', outcome: 'پاسخ + اقدام' },
	en: { knowledge: 'Knowledge', rules: 'Rules', crm: 'CRM', outcome: 'Reply + action' },
} as const

function SignalParticle({ path, delay, filterId }: { path: string; delay: number; filterId: string }) {
	return (
		<circle r="2.2" fill="white" filter={`url(#${filterId})`} opacity="0">
			<animateMotion path={path} begin={`${delay}s`} dur="2.8s" repeatCount="indefinite" />
			<animate attributeName="opacity" values="0;1;1;0" begin={`${delay}s`} dur="2.8s" repeatCount="indefinite" />
		</circle>
	)
}

function NetworkDefs({ id }: { id: string }) {
	return (
		<defs>
			<filter id={id} x="-300%" y="-300%" width="700%" height="700%">
				<feGaussianBlur stdDeviation="2.4" result="glow" />
				<feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<linearGradient id={`${id}-line`} x1="0" x2="1">
				<stop offset="0" stopColor="white" stopOpacity="0.08" />
				<stop offset="0.5" stopColor="white" stopOpacity="0.38" />
				<stop offset="1" stopColor="white" stopOpacity="0.08" />
			</linearGradient>
		</defs>
	)
}

function MessageCard({ locale, scenario, label, scenarioIdx, reduce }: { locale: 'fa' | 'en'; scenario: Scenario; label: string; scenarioIdx: number; reduce: boolean | null }) {
	return (
		<div dir={locale === 'fa' ? 'rtl' : 'ltr'} className="rounded-2xl border border-white/15 bg-[#0b0b0b]/95 p-3 shadow-[0_16px_35px_rgba(0,0,0,0.3)] backdrop-blur-xl">
			<p className="flex items-center gap-1.5 text-[9px] text-white/40"><MessageCircleMore className="h-3 w-3" />{label}</p>
			<AnimatePresence mode="wait">
				<motion.div key={scenarioIdx} initial={reduce ? false : { opacity: 0, transform: 'translateY(5px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={reduce ? undefined : { opacity: 0, transform: 'translateY(-3px)' }} transition={{ duration: reduce ? 0 : 0.24, ease: [0.23, 1, 0.32, 1] }} className="mt-2.5">
					<div className="flex items-center gap-2">
						<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-black">{scenarioIdx === 0 ? <InstagramIcon className="h-3.5 w-3.5" /> : <MessageCircleMore className="h-3.5 w-3.5" />}</span>
						<div className="min-w-0"><p className="truncate text-[9px] font-medium text-white">{scenario.person} · {scenario.channel}</p><p className="mt-0.5 text-[8px] text-white/35">{scenario.time}</p></div>
					</div>
					<p className="mt-2.5 text-[10px] leading-5 text-white/75">{scenario.text}</p>
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

function ResultCard({ locale, scenario, label, scenarioIdx, reduce }: { locale: 'fa' | 'en'; scenario: Scenario; label: string; scenarioIdx: number; reduce: boolean | null }) {
	return (
		<div dir={locale === 'fa' ? 'rtl' : 'ltr'} className="rounded-2xl bg-white p-3 text-black shadow-[0_18px_38px_rgba(0,0,0,0.34)]">
			<div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-white"><Sparkles className="h-3.5 w-3.5" /></span><p className="text-[10px] font-semibold">{label}</p></div>
			<AnimatePresence mode="wait">
				<motion.div key={scenarioIdx} initial={reduce ? false : { opacity: 0, transform: 'translateY(5px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: reduce ? 0 : 0.24, ease: [0.23, 1, 0.32, 1] }}>
					<p className="mt-2 text-[10px] leading-5 text-black/70">{scenario.reply}</p>
					<span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-black/[0.045] px-2 py-1 text-[8px] text-black/45"><PackageSearch className="h-2.5 w-2.5" />{scenario.source}</span>
					<p className="mt-1.5 flex items-center gap-1.5 text-[8px] font-medium text-emerald-700"><span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-white"><Check className="h-2.5 w-2.5" /></span>{scenario.result}</p>
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

function Core({ core, coreHint, reduce }: { core: string; coreHint: string; reduce: boolean | null }) {
	return (
		<motion.div animate={reduce ? undefined : { transform: ['scale(1)', 'scale(1.025)', 'scale(1)'] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} className="relative grid h-[92px] w-[92px] place-items-center rounded-[1.65rem] border border-white/25 bg-white/[0.09] text-center shadow-[0_0_42px_rgba(255,255,255,0.08)] backdrop-blur-xl">
			<span aria-hidden className="absolute inset-2 rounded-[1.25rem] border border-white/10" />
			<div className="relative"><span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.22)]"><Sparkles className="h-4 w-4" /></span><p className="mt-2 text-[10px] font-semibold text-white">{core}</p><p className="mt-0.5 max-w-[76px] truncate text-[7px] text-white/35">{coreHint}</p></div>
		</motion.div>
	)
}

export function NeuralOperationGraph({ locale, reduce, scenarioIdx, scenario, allMessages, core, coreHint, sharedBrain }: NeuralOperationGraphProps) {
	const labels = LABELS[locale]
	const activeBranch = scenarioIdx % 2
	const desktopIn = ['M 150 125 C 168 125 176 72 205 65', 'M 150 125 C 170 125 180 125 205 125', 'M 150 125 C 168 125 176 178 205 185']
	const desktopCore = ['M 205 65 C 236 65 238 110 268 125', 'M 205 125 C 232 125 242 125 268 125', 'M 205 185 C 236 185 238 140 268 125']
	const desktopOut = ['M 360 125 C 386 112 388 78 415 72', 'M 360 125 C 386 125 392 125 415 125', 'M 360 125 C 386 138 388 172 415 178']
	const desktopEnd = ['M 415 72 C 444 78 447 112 465 125', 'M 415 125 C 438 125 448 125 465 125', 'M 415 178 C 444 172 447 138 465 125']
	const mobilePaths = ['M 160 82 C 160 112 98 112 98 145', 'M 160 82 C 160 112 222 112 222 145', 'M 98 145 C 98 174 132 178 145 190', 'M 222 145 C 222 174 188 178 175 190', 'M 145 238 C 126 252 98 256 98 282', 'M 175 238 C 194 252 222 256 222 282', 'M 98 282 C 98 310 140 312 160 322', 'M 222 282 C 222 310 180 312 160 322']

	return (
		<>
			<div dir="ltr" className="relative hidden h-[250px] overflow-hidden px-4 py-4 sm:block">
				<svg aria-hidden viewBox="0 0 560 250" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
					<NetworkDefs id="vigent-signal-desktop" />
					{[...desktopIn, ...desktopCore, ...desktopOut, ...desktopEnd].map((path) => <path key={path} d={path} fill="none" stroke="url(#vigent-signal-desktop-line)" strokeWidth="1" strokeDasharray="3 6" />)}
					{[[205, 65], [205, 125], [205, 185], [415, 72], [415, 125], [415, 178]].map(([cx, cy], index) => <g key={`${cx}-${cy}`}><circle cx={cx} cy={cy} r="8" fill="#0b0b0b" stroke="white" strokeOpacity={index % 3 === activeBranch ? 0.55 : 0.2} /><circle cx={cx} cy={cy} r="2" fill="white" fillOpacity={index % 3 === activeBranch ? 0.9 : 0.35} /></g>)}
					{!reduce && <><SignalParticle path={desktopIn[activeBranch]} delay={0} filterId="vigent-signal-desktop" /><SignalParticle path={desktopCore[activeBranch]} delay={0.75} filterId="vigent-signal-desktop" /><SignalParticle path={desktopOut[activeBranch]} delay={1.45} filterId="vigent-signal-desktop" /><SignalParticle path={desktopEnd[activeBranch]} delay={2.05} filterId="vigent-signal-desktop" /></>}
				</svg>
				<div className="absolute start-4 top-1/2 z-10 w-[150px] -translate-y-1/2"><MessageCard locale={locale} scenario={scenario} label={allMessages} scenarioIdx={scenarioIdx} reduce={reduce} /></div>
				<div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"><Core core={core} coreHint={coreHint} reduce={reduce} /></div>
				<div className="absolute end-4 top-1/2 z-10 w-[170px] -translate-y-1/2"><ResultCard locale={locale} scenario={scenario} label={sharedBrain} scenarioIdx={scenarioIdx} reduce={reduce} /></div>
				<div aria-hidden className="absolute left-[34.5%] top-[13%] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[7px] text-white/40"><Database className="h-2.5 w-2.5" />{labels.knowledge}</div>
				<div aria-hidden className="absolute left-[34.5%] top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[7px] text-white/40"><ShieldCheck className="h-2.5 w-2.5" />{labels.rules}</div>
				<div aria-hidden className="absolute left-[74%] bottom-[11%] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[7px] text-white/40"><UsersRound className="h-2.5 w-2.5" />{labels.crm}</div>
			</div>

			<div dir="ltr" className="relative h-[382px] overflow-hidden sm:hidden">
				<svg aria-hidden viewBox="0 0 320 382" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
					<NetworkDefs id="vigent-signal-mobile" />
					{mobilePaths.map((path) => <path key={path} d={path} fill="none" stroke="url(#vigent-signal-mobile-line)" strokeWidth="1" strokeDasharray="3 6" />)}
					{[[98,145],[222,145],[98,282],[222,282]].map(([cx,cy],index)=><g key={`${cx}-${cy}`}><circle cx={cx} cy={cy} r="8" fill="#0b0b0b" stroke="white" strokeOpacity={index%2===activeBranch?0.55:0.2}/><circle cx={cx} cy={cy} r="2" fill="white" fillOpacity={index%2===activeBranch?0.9:0.35}/></g>)}
					{!reduce && <><SignalParticle path={mobilePaths[activeBranch]} delay={0} filterId="vigent-signal-mobile" /><SignalParticle path={mobilePaths[2 + activeBranch]} delay={0.8} filterId="vigent-signal-mobile" /><SignalParticle path={mobilePaths[4 + activeBranch]} delay={1.45} filterId="vigent-signal-mobile" /><SignalParticle path={mobilePaths[6 + activeBranch]} delay={2.05} filterId="vigent-signal-mobile" /></>}
				</svg>
				<div className="absolute inset-x-5 top-3 z-10"><MessageCard locale={locale} scenario={scenario} label={allMessages} scenarioIdx={scenarioIdx} reduce={reduce} /></div>
				<div className="absolute left-1/2 top-[55%] z-10 -translate-x-1/2 -translate-y-1/2"><Core core={core} coreHint={coreHint} reduce={reduce} /></div>
				<div className="absolute inset-x-5 bottom-3 z-10"><ResultCard locale={locale} scenario={scenario} label={labels.outcome} scenarioIdx={scenarioIdx} reduce={reduce} /></div>
				<span aria-hidden className="absolute left-[24%] top-[36%] rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[7px] text-white/40">{labels.knowledge}</span>
				<span aria-hidden className="absolute right-[22%] top-[36%] rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[7px] text-white/40">{labels.rules}</span>
			</div>
		</>
	)
}
