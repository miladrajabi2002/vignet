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
	start: string
	noCode: string
	scenarios: Scenario[]
}> = {
	fa: {
		eyebrow: 'دموی واقعی محصول',
		title: 'یک پیام را از ورود تا نتیجه دنبال کنید.',
		subtitle: 'نوع کسب‌وکار را عوض کنید؛ ببینید ویجنت چه می‌فهمد، از کجا پاسخ می‌آورد و بعد از پاسخ چه کاری انجام می‌دهد.',
		watch: 'پخش خودکار', incoming: 'پیام ورودی', knowledge: 'دانش و تصمیم', action: 'اقدام داخل گفتگو', result: 'نتیجه ثبت‌شده', live: 'آنلاین', replay: 'پخش دوباره', start: 'ساخت ایجنت من', noCode: 'بدون کدنویسی · قابل ویرایش · آماده اتصال',
		scenarios: [
			{ key: 'instagram', label: 'پیج اینستاگرام', audience: 'فروش در دایرکت', question: 'قیمت این مانتو چنده؟ رنگ کرم سایز ۴۰ دارید؟', answer: '۲٬۳۹۰٬۰۰۰ تومان است و رنگ کرم سایز ۴۰ همین الان موجود است.', action: 'کارت محصول و لینک خرید در دایرکت ارسال شد', result: 'یک سرنخ خرید با محصول موردعلاقه ثبت شد', source: 'کاتالوگ محصول + موجودی', channel: 'Instagram Direct', icon: InstagramIcon },
			{ key: 'store', label: 'فروشگاه آنلاین', audience: 'مشاوره و سفارش', question: 'برای دویدن سبک چه کفشی تا سه میلیون پیشنهاد می‌دید؟', answer: 'با این بودجه دو گزینه مناسب دارید؛ این مدل سبک‌تر است و کفی جذب ضربه دارد.', action: 'دو محصول از کاتالوگ مقایسه و نمایش داده شد', result: 'مشتری یکی از گزینه‌ها را به سبد اضافه کرد', source: 'ووکامرس + کاتالوگ', channel: 'Website widget', icon: ShoppingBag },
			{ key: 'service', label: 'خدمات و رزرو', audience: 'ثبت درخواست', question: 'برای فردا عصر وقت مشاوره حضوری دارید؟', answer: 'بله، ساعت ۵ و ۶:۳۰ خالی است. کدام زمان برای شما بهتر است؟', action: 'نام و شماره مشتری برای رزرو دریافت شد', result: 'درخواست رزرو برای تأیید همکار ارسال شد', source: 'تقویم خدمات + قوانین رزرو', channel: 'WhatsApp', icon: UserRoundCheck },
			{ key: 'education', label: 'آموزش و دوره', audience: 'راهنمای ثبت‌نام', question: 'برای شروع طراحی سایت کدوم دوره رو بگیرم؟ پیش‌نیاز داره؟', answer: 'مسیر مقدماتی برای شروع از صفر مناسب است و به تجربه برنامه‌نویسی نیاز ندارد.', action: 'دوره مناسب با سرفصل و دکمه ثبت‌نام نمایش داده شد', result: 'علاقه‌مندی به دوره برای پیگیری ذخیره شد', source: 'سرفصل دوره‌ها + پرسش‌های ثبت‌نام', channel: 'Telegram', icon: GraduationCap },
			{ key: 'support', label: 'پشتیبانی پیام‌رسان', audience: 'حل مسئله و ارجاع', question: 'پرداخت انجام شده ولی اشتراکم فعال نیست؛ می‌شه بررسی کنید؟', answer: 'حتماً. اطلاعات پرداخت شما ثبت شد و موضوع را برای بررسی فوری به همکار مربوطه می‌سپارم.', action: 'گفتگو با خلاصه و اطلاعات پرداخت تحویل شد', result: 'اپراتور از تلگرام هشدار دریافت کرد', source: 'راهنمای پشتیبانی + تشخیص حساسیت', channel: 'Bale / Rubika', icon: MessagesSquare },
		],
	},
	en: {
		eyebrow: 'Real product demo', title: 'Follow one message from arrival to outcome.', subtitle: 'Change the business type to see what Vigent understands, where the answer comes from, and what happens after the reply.', watch: 'Auto play', incoming: 'Incoming message', knowledge: 'Knowledge and decision', action: 'In-conversation action', result: 'Recorded outcome', live: 'Online', replay: 'Replay', start: 'Build my agent', noCode: 'No code · Fully editable · Ready to connect',
		scenarios: [
			{ key: 'instagram', label: 'Instagram shop', audience: 'Sell in DMs', question: 'How much is this coat? Do you have cream in size 40?', answer: 'It is 2,390,000 toman, and cream in size 40 is currently in stock.', action: 'Product card and checkout link sent in DM', result: 'A purchase lead was saved with product interest', source: 'Product catalog + live stock', channel: 'Instagram Direct', icon: InstagramIcon },
			{ key: 'store', label: 'Online store', audience: 'Advice and orders', question: 'What shoes do you recommend for light running under three million?', answer: 'There are two good options in that range. This one is lighter and has a shock-absorbing sole.', action: 'Two catalog products compared and shown', result: 'Customer added one option to cart', source: 'WooCommerce + catalog', channel: 'Website widget', icon: ShoppingBag },
			{ key: 'service', label: 'Services and booking', audience: 'Capture requests', question: 'Do you have an in-person consultation tomorrow afternoon?', answer: 'Yes, 5:00 and 6:30 are open. Which works better for you?', action: 'Customer name and phone captured for booking', result: 'Booking request sent to a teammate for confirmation', source: 'Service calendar + booking rules', channel: 'WhatsApp', icon: UserRoundCheck },
			{ key: 'education', label: 'Education and courses', audience: 'Enrollment guide', question: 'Which web design course should I start with? Any prerequisites?', answer: 'The beginner path starts from zero and needs no programming experience.', action: 'Matching course shown with syllabus and enroll button', result: 'Course interest saved for follow-up', source: 'Course catalog + enrollment FAQ', channel: 'Telegram', icon: GraduationCap },
			{ key: 'support', label: 'Messaging support', audience: 'Resolve and hand off', question: 'I paid, but my subscription is not active. Can you check?', answer: 'Absolutely. I saved your payment details and will hand this to the right teammate for immediate review.', action: 'Conversation handed off with summary and payment details', result: 'Operator received an alert in Telegram', source: 'Support guide + sensitivity detection', channel: 'Bale / Rubika', icon: MessagesSquare },
		],
	},
}

function PhoneConversation({ scenario, copy }: { scenario: Scenario; copy: typeof COPY.fa | typeof COPY.en }) {
	const reduce = useReducedMotion()
	return (
		<div className="relative mx-auto h-[500px] w-full max-w-[290px] rounded-[2.6rem] border-[7px] border-black bg-black p-1.5 shadow-[0_26px_70px_rgba(0,0,0,0.24)]">
			<div className="absolute left-1/2 top-3 z-20 h-4 w-24 -translate-x-1/2 rounded-full bg-black" />
			<div className="flex h-full flex-col overflow-hidden rounded-[2rem] bg-white">
				<div className="flex items-center gap-2.5 border-b border-black/10 px-4 pb-3 pt-7">
					<span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"><Bot className="h-4 w-4" /></span>
					<div><p className="text-[11px] font-medium text-black">Vigent Agent</p><p className="mt-0.5 flex items-center gap-1 text-[8px] text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{copy.live}</p></div>
					<span className="ms-auto text-[8px] text-black/35">{scenario.channel}</span>
				</div>
				<div className="flex-1 space-y-3 overflow-hidden bg-[#f7f7f5] px-3.5 py-5">
					<motion.div key={`${scenario.key}-q`} initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="ms-auto max-w-[88%] rounded-2xl rounded-ee-sm bg-black px-3 py-2.5 text-[10px] leading-5 text-white">{scenario.question}</motion.div>
					<motion.div key={`${scenario.key}-a`} initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.3 }} className="max-w-[92%] rounded-2xl rounded-es-sm border border-black/10 bg-white px-3 py-2.5 text-[10px] leading-5 text-black/65">
						{scenario.answer}
						<span className="mt-2 flex w-max items-center gap-1 rounded-full bg-black/[0.05] px-2 py-1 text-[7px] text-black/40"><Database className="h-2.5 w-2.5" />{scenario.source}</span>
					</motion.div>
					<motion.div key={`${scenario.key}-action`} initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.65 }} className="rounded-xl border border-emerald-700/15 bg-emerald-50 p-2.5">
						<div className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-3 w-3" /></span><p className="text-[9px] leading-4 text-emerald-800">{scenario.action}</p></div>
					</motion.div>
				</div>
				<div className="border-t border-black/10 bg-white p-3"><div className="h-9 rounded-full border border-black/10 bg-[#f7f7f5]" /></div>
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
		<div className="flex h-full flex-col rounded-[1.5rem] border border-black/10 bg-white p-4 sm:p-6">
			<div className="flex items-center justify-between border-b border-black/10 pb-4"><div><p className="text-[10px] font-medium text-black/35">{scenario.audience}</p><h3 className="mt-1 text-lg font-medium text-black">{scenario.label}</h3></div><Clock3 className="h-4 w-4 text-black/25" /></div>
			<div className="mt-3 flex-1">
				{steps.map(({ label, value, Icon }, index) => (
					<div key={label} className="relative flex gap-3 py-3.5 sm:gap-4 sm:py-4">
						{index < steps.length - 1 && <span className="absolute bottom-[-10px] start-[17px] top-[46px] border-s border-dashed border-black/15 sm:start-[19px]" />}
						<span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-[#f7f7f5] sm:h-10 sm:w-10"><Icon className="h-4 w-4 text-black/55" /></span>
						<div><p className="text-[9px] font-medium uppercase tracking-[0.12em] text-black/30">{label}</p><p className="mt-1 text-xs leading-6 text-black/65">{value}</p></div>
					</div>
				))}
			</div>
			<div className="rounded-xl bg-black p-4 text-white">
				<p className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/35">{copy.result}</p>
				<p className="mt-2 flex items-start gap-2 text-xs leading-6 text-white/75"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-400" />{scenario.result}</p>
			</div>
	</div>
	)
}

export function DemoSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()
	const [selected, setSelected] = useState(0)
	const [playing, setPlaying] = useState(!reduce)
	const scenario = copy.scenarios[selected]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	useEffect(() => {
		if (!playing || reduce) return
		const timer = window.setInterval(() => setSelected((value) => (value + 1) % copy.scenarios.length), 5600)
		return () => window.clearInterval(timer)
	}, [copy.scenarios.length, playing, reduce])

	return (
		<section id="demo" className="bg-[#f7f7f5] py-20 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="grid gap-6 border-t border-black/10 pt-7 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
					<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">{copy.eyebrow}</p>
					<div><h2 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-black sm:text-5xl lg:text-6xl">{copy.title}</h2><p className="mt-5 max-w-2xl text-[15px] leading-8 text-black/55">{copy.subtitle}</p></div>
				</div>

				<div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label={copy.eyebrow}>
					{copy.scenarios.map((item, index) => {
						const Icon = item.icon
						return <button key={item.key} type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); setPlaying(false) }} className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 text-start text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${selected === index ? 'border-black bg-black text-white' : 'border-black/10 bg-white text-black/55 hover:border-black/20 hover:text-black'}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span>{item.label}</span></button>
					})}
				</div>

				<div className="mt-5 overflow-hidden rounded-[1.8rem] border border-black/10 bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-6 lg:p-8">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div key={scenario.key} initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
							<PhoneConversation scenario={scenario} copy={copy} />
							<TracePanel scenario={scenario} copy={copy} />
						</motion.div>
					</AnimatePresence>

					<div className="mt-7 flex flex-col gap-4 border-t border-black/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-2">
							<button type="button" onClick={() => setPlaying((value) => !value)} disabled={!!reduce} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 px-4 text-[11px] font-medium text-black/55 transition-colors hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-40" aria-label={playing ? 'Pause demo' : 'Play demo'}>{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{copy.watch}</button>
							<button type="button" onClick={() => setSelected(0)} className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/45 transition-colors hover:border-black/20 hover:text-black" aria-label={copy.replay}><RotateCcw className="h-3.5 w-3.5" /></button>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="text-[10px] text-black/35">{copy.noCode}</span><Link href="/login?next=/onboarding" className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-black px-5 text-xs font-medium text-white"><span>{copy.start}</span><Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" /></Link></div>
					</div>
				</div>
			</div>
		</section>
	)
}
