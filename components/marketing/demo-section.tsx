'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Check,
	Clock3,
	Database,
	GraduationCap,
	MessagesSquare,
	PackageSearch,
	Pause,
	Play,
	RotateCcw,
	ShoppingBag,
	UserRoundCheck,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

type Scenario = {
	key: string
	label: string
	audience: string
	question: string
	answer: string
	action: string
	result: string
	source: string
	channel: string
	icon: ComponentType<{ className?: string }>
}

const COPY: Record<'fa' | 'en', {
	eyebrow: string
	title: string
	subtitle: string
	watch: string
	incoming: string
	knowledge: string
	action: string
	result: string
	live: string
	replay: string
	playAria: string
	pauseAria: string
	start: string
	noCode: string
	scenarios: Scenario[]
}> = {
	fa: {
		eyebrow: 'دموی واقعی محصول',
		title: 'از پیام تا نتیجه، در یک نگاه',
		subtitle: 'یک سناریو انتخاب کنید؛ منبع پاسخ، اقدام ایجنت و نتیجه ثبت‌شده را قدم‌به‌قدم و داخل همان پنل ببینید.',
		watch: 'پخش خودکار', incoming: 'پیام', knowledge: 'درک و دانش', action: 'اقدام', result: 'نتیجه', live: 'آنلاین', replay: 'پخش دوباره', playAria: 'شروع پخش خودکار دمو', pauseAria: 'توقف پخش خودکار دمو', start: 'ساخت ایجنت من', noCode: 'بدون کدنویسی · هوش مصنوعی آماده · اتصال ساده',
		scenarios: [
			{ key: 'instagram', label: 'پیج اینستاگرام', audience: 'فروش در دایرکت', question: 'قیمت این مانتو چنده؟ رنگ کرم سایز ۴۰ دارید؟', answer: '۲٬۳۹۰٬۰۰۰ تومان است و رنگ کرم سایز ۴۰ همین الان موجود است.', action: 'قیمت، موجودی و لینک خرید در دایرکت ارسال شد', result: 'گفتگو و محصول درخواستی در صندوق گفتگو ثبت شد', source: 'کاتالوگ محصول + موجودی', channel: 'Instagram Direct', icon: InstagramIcon },
			{ key: 'store', label: 'فروشگاه آنلاین', audience: 'مشاوره و سفارش', question: 'برای دویدن سبک چه کفشی تا سه میلیون پیشنهاد می‌دید؟', answer: 'با این بودجه دو گزینه مناسب دارید؛ این مدل سبک‌تر است و کفی جذب ضربه دارد.', action: 'دو محصول از کاتالوگ مقایسه و نمایش داده شد', result: 'مقایسه و لینک هر دو محصول در همان گفتگو نمایش داده شد', source: 'ووکامرس + کاتالوگ', channel: 'Website widget', icon: ShoppingBag },
			{ key: 'service', label: 'خدمات و رزرو', audience: 'ثبت درخواست', question: 'برای فردا عصر وقت مشاوره حضوری دارید؟', answer: 'بله، ساعت ۵ و ۶:۳۰ خالی است. کدام زمان برای شما بهتر است؟', action: 'نام و شماره مشتری برای رزرو دریافت شد', result: 'درخواست رزرو برای تأیید همکار ارسال شد', source: 'ساعات کاری + قوانین رزرو', channel: 'WhatsApp', icon: UserRoundCheck },
			{ key: 'education', label: 'آموزش و دوره', audience: 'راهنمای ثبت‌نام', question: 'برای شروع طراحی سایت کدوم دوره رو بگیرم؟ پیش‌نیاز داره؟', answer: 'مسیر مقدماتی برای شروع از صفر مناسب است و به تجربه برنامه‌نویسی نیاز ندارد.', action: 'سرفصل و لینک ثبت‌نام دوره مناسب ارسال شد', result: 'سؤال و دوره پیشنهادی در همان گفتگو ثبت شد', source: 'سرفصل دوره‌ها + پرسش‌های ثبت‌نام', channel: 'Telegram', icon: GraduationCap },
			{ key: 'support', label: 'پشتیبانی پیام‌رسان', audience: 'حل مسئله و ارجاع', question: 'پرداخت انجام شده ولی اشتراکم فعال نیست؛ می‌شه بررسی کنید؟', answer: 'حتماً. اطلاعات پرداخت شما ثبت شد و موضوع را برای بررسی فوری به همکار مربوطه می‌سپارم.', action: 'گفتگو با خلاصه و اطلاعات پرداخت تحویل شد', result: 'اپراتور از تلگرام هشدار دریافت کرد', source: 'راهنمای پشتیبانی + تشخیص حساسیت', channel: 'Bale / Rubika', icon: MessagesSquare },
		],
	},
	en: {
		eyebrow: 'Real product demo', title: 'From message to outcome, at a glance', subtitle: 'Change the business type to see what Vigent understands, where the answer comes from, and what happens after the reply.', watch: 'Auto play', incoming: 'Message', knowledge: 'Understand and know', action: 'Action', result: 'Outcome', live: 'Online', replay: 'Replay', playAria: 'Start demo autoplay', pauseAria: 'Pause demo autoplay', start: 'Build my agent', noCode: 'No code · AI included · Ready to connect',
		scenarios: [
			{ key: 'instagram', label: 'Instagram shop', audience: 'Sell in DMs', question: 'How much is this coat? Do you have cream in size 40?', answer: 'It is 2,390,000 toman, and cream in size 40 is currently in stock.', action: 'Price, stock and checkout link sent in the DM', result: 'The conversation and requested product were saved in the inbox', source: 'Product catalog + live stock', channel: 'Instagram Direct', icon: InstagramIcon },
			{ key: 'store', label: 'Online store', audience: 'Advice and orders', question: 'What shoes do you recommend for light running under three million?', answer: 'There are two good options in that range. This one is lighter and has a shock-absorbing sole.', action: 'Two catalog products compared and shown', result: 'Both product comparisons and links appeared in the conversation', source: 'WooCommerce + catalog', channel: 'Website widget', icon: ShoppingBag },
			{ key: 'service', label: 'Services and booking', audience: 'Capture requests', question: 'Do you have an in-person consultation tomorrow afternoon?', answer: 'Yes, 5:00 and 6:30 are open. Which works better for you?', action: 'Customer name and phone captured for booking', result: 'Booking request sent to a teammate for confirmation', source: 'Business hours + booking rules', channel: 'WhatsApp', icon: UserRoundCheck },
			{ key: 'education', label: 'Education and courses', audience: 'Enrollment guide', question: 'Which web design course should I start with? Any prerequisites?', answer: 'The beginner path starts from zero and needs no programming experience.', action: 'Matching syllabus and enrollment link sent', result: 'The question and suggested course were saved in the conversation', source: 'Course catalog + enrollment FAQ', channel: 'Telegram', icon: GraduationCap },
			{ key: 'support', label: 'Messaging support', audience: 'Resolve and hand off', question: 'I paid, but my subscription is not active. Can you check?', answer: 'Absolutely. I saved your payment details and will hand this to the right teammate for immediate review.', action: 'Conversation handed off with summary and payment details', result: 'Operator received an alert in Telegram', source: 'Support guide + sensitivity detection', channel: 'Bale / Rubika', icon: MessagesSquare },
		],
	},
}

function PhoneConversation({ scenario, copy }: { scenario: Scenario; copy: typeof COPY.fa | typeof COPY.en }) {
	const reduce = useReducedMotion()
	return (
		<div className="relative mx-auto h-[420px] w-full max-w-[360px] rounded-[1.5rem] border border-[var(--border-default)] bg-white p-1 sm:h-[500px] sm:max-w-[290px] sm:rounded-[2.6rem] sm:border-[7px] sm:border-[var(--text-primary)] sm:bg-[var(--text-primary)] sm:p-1.5" style={{ boxShadow: 'var(--shadow-card)' }}>
			<div className="absolute left-1/2 top-3 z-20 hidden h-4 w-24 -translate-x-1/2 rounded-full bg-[var(--text-primary)] sm:block" />
			<div className="flex h-full flex-col overflow-hidden rounded-[1.2rem] bg-white sm:rounded-[2rem]">
				<div className="flex items-center gap-2.5 border-b border-[var(--border-default)] px-4 py-3 sm:pb-3 sm:pt-7">
					<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--text-primary)] text-white"><Bot className="h-4 w-4" /></span>
					<div><p className="text-[11px] font-medium text-[var(--text-primary)]">Vigent Agent</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-secondary)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />{copy.live}</p></div>
					<span className="ms-auto max-w-[42%] truncate text-[10px] text-[var(--text-muted)]">{scenario.channel}</span>
				</div>
				<div className="flex-1 space-y-3 overflow-hidden bg-[var(--bg-surface)] px-3.5 py-5">
					<motion.div key={`${scenario.key}-q`} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.4 }} className="ms-auto max-w-[88%] rounded-2xl rounded-ee-sm bg-[var(--text-primary)] px-3 py-2.5 text-[11px] leading-5 text-white">{scenario.question}</motion.div>
					<motion.div key={`${scenario.key}-a`} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.45, delay: 0.3 }} className="max-w-[92%] rounded-2xl rounded-es-sm border border-[var(--border-default)] bg-white px-3 py-2.5 text-[11px] leading-5 text-[var(--text-secondary)]">
						{scenario.answer}
						<span className="mt-2 flex w-fit max-w-full items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2 py-1 text-[10px] text-[var(--text-muted)]"><Database className="h-2.5 w-2.5 shrink-0" />{scenario.source}</span>
					</motion.div>
					<motion.div key={`${scenario.key}-action`} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.65 }} className="rounded-xl border border-[var(--success)]/20 bg-green-50 p-2.5">
						<div className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white"><Check className="h-3 w-3" /></span><p className="text-[10px] leading-4 text-[var(--success)]">{scenario.action}</p></div>
					</motion.div>
					<motion.div key={`${scenario.key}-result`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.35, delay: 0.85 }} className="rounded-xl bg-[var(--text-primary)] px-3 py-2.5 text-white lg:hidden">
						<p className="text-[10px] text-white/60">{copy.result}</p>
						<p className="mt-1 flex items-start gap-1.5 text-[10px] leading-4 text-white/80"><Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success)]" />{scenario.result}</p>
					</motion.div>
				</div>
				<div className="border-t border-[var(--border-default)] bg-white p-3"><div className="h-9 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]" /></div>
			</div>
		</div>
	)
}

function TracePanel({ scenario, copy }: { scenario: Scenario; copy: typeof COPY.fa | typeof COPY.en }) {
	const steps = [
		{ label: copy.incoming, value: scenario.channel, Icon: scenario.icon },
		{ label: copy.knowledge, value: scenario.source, Icon: Database },
		{ label: copy.action, value: scenario.action, Icon: PackageSearch },
	]
	return (
		<div className="flex h-full flex-col rounded-[1.5rem] border border-[var(--border-default)] bg-white p-4 sm:p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
			<div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4"><div><p className="text-[11px] font-medium text-[var(--text-muted)]">{scenario.audience}</p><h3 className="mt-1 text-lg font-medium text-[var(--text-primary)]">{scenario.label}</h3></div><Clock3 className="h-4 w-4 text-[var(--text-muted)]" /></div>
			<div className="mt-3 flex-1">
				{steps.map(({ label, value, Icon }, index) => (
					<div key={label} className="relative flex gap-3 py-3.5 sm:gap-4 sm:py-4">
						{index < steps.length - 1 && <span className="absolute bottom-[-10px] start-[17px] top-[46px] border-s border-dashed border-[var(--border-default)] sm:start-[19px]" />}
						<span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] sm:h-10 sm:w-10"><Icon className="h-4 w-4 text-[var(--text-secondary)]" /></span>
						<div><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)] rtl:tracking-normal">{label}</p><p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{value}</p></div>
					</div>
				))}
			</div>
			<div className="rounded-xl bg-[var(--text-primary)] p-4 text-white">
				<p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/55 rtl:tracking-normal">{copy.result}</p>
				<p className="mt-2 flex items-start gap-2 text-xs leading-6 text-white/75"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />{scenario.result}</p>
			</div>
	</div>
	)
}

function JourneyStrip({ scenario, copy }: { scenario: Scenario; copy: typeof COPY.fa | typeof COPY.en }) {
	const reduce = useReducedMotion()
	const steps = [
		{ label: copy.incoming, value: scenario.question, Icon: scenario.icon },
		{ label: copy.knowledge, value: scenario.source, Icon: Database },
		{ label: copy.action, value: scenario.action, Icon: PackageSearch },
		{ label: copy.result, value: scenario.result, Icon: Check },
	]

	return (
		<div className="relative mt-5 grid grid-cols-2 gap-2 rounded-[1.25rem] border border-[var(--border-default)] bg-white p-2 sm:grid-cols-4 sm:gap-0 sm:p-3" aria-label={`${copy.incoming}، ${copy.knowledge}، ${copy.action}، ${copy.result}`}>
			<span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[34px] hidden h-px bg-[var(--border-default)] sm:block" />
			{steps.map(({ label, value, Icon }, index) => (
				<motion.div
					key={label}
					initial={reduce ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={reduce ? { duration: 0 } : { duration: 0.32, delay: index * 0.22, ease: [0.16, 1, 0.3, 1] }}
					className="relative min-w-0 rounded-xl bg-[var(--bg-surface)] p-3 sm:bg-transparent sm:px-4 sm:text-center"
				>
					<span className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-white sm:mx-auto ${index === steps.length - 1 ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`} style={{ boxShadow: 'var(--shadow-sm)' }}>
						<Icon className="h-4 w-4" aria-hidden />
					</span>
					<p className="mt-2 text-[11px] font-semibold text-[var(--text-secondary)]">{label}</p>
					<p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--text-muted)]">{value}</p>
				</motion.div>
			))}
		</div>
	)
}

export function DemoSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()
	const [selected, setSelected] = useState(0)
	const [playing, setPlaying] = useState(false)
	const scenario = copy.scenarios[selected]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	useEffect(() => {
		const isDesktop = !window.matchMedia('(max-width: 639px)').matches
		setPlaying(reduce === false && isDesktop)
	}, [reduce])

	useEffect(() => {
		if (!playing || reduce) return
		const timer = window.setInterval(() => setSelected((value) => (value + 1) % copy.scenarios.length), 5600)
		return () => window.clearInterval(timer)
	}, [copy.scenarios.length, playing, reduce])

	return (
		<section id="demo" className="marketing-story-section bg-[var(--bg-surface)] py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="mx-auto max-w-4xl border-t border-[var(--border-default)] pt-6 text-center">
					<p className="marketing-eyebrow">{copy.eyebrow}</p>
					<h2 className="marketing-heading mx-auto mt-4">{copy.title}</h2>
					<p className="marketing-subtitle mx-auto mt-4">{copy.subtitle}</p>
				</div>

				<div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label={copy.eyebrow}>
					{copy.scenarios.map((item, index) => {
						const Icon = item.icon
						return <button key={item.key} type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); setPlaying(false) }} className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 text-start text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${index === copy.scenarios.length - 1 ? 'col-span-2 sm:col-span-1' : ''} ${selected === index ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-default)] bg-white text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'}`}><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /><span>{item.label}</span></button>
					})}
				</div>
				<AnimatePresence mode="wait" initial={false}>
					<JourneyStrip key={`journey-${scenario.key}`} scenario={scenario} copy={copy} />
				</AnimatePresence>

				<div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-white p-3 sm:p-6 lg:p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
					<AnimatePresence mode="wait" initial={false}>
						<motion.div key={scenario.key} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.35 }} className="grid items-center gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
							<PhoneConversation scenario={scenario} copy={copy} />
							<div className="hidden h-full lg:block"><TracePanel scenario={scenario} copy={copy} /></div>
						</motion.div>
					</AnimatePresence>

					<div className="mt-7 flex flex-col gap-4 border-t border-[var(--border-default)] pt-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-2">
							<button type="button" onClick={() => setPlaying((value) => !value)} disabled={!!reduce} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-default)] px-4 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40" aria-label={playing ? copy.pauseAria : copy.playAria}>{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{copy.watch}</button>
							<button type="button" onClick={() => setSelected(0)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]" aria-label={copy.replay}><RotateCcw className="h-3.5 w-3.5" /></button>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="text-[11px] text-[var(--text-muted)]">{copy.noCode}</span><Link href="/login?next=/onboarding" className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-5 text-xs font-medium text-white transition-colors hover:bg-[var(--text-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"><span>{copy.start}</span><Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" /></Link></div>
					</div>
				</div>
			</div>
		</section>
	)
}
