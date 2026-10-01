import { Check, Globe, GraduationCap, MessageSquare, RefreshCw, Rocket, Send, ShoppingBag, Sparkles, CalendarDays, BriefcaseBusiness, Utensils } from 'lucide-react'
import type { CSSProperties } from 'react'
import { InstagramIcon } from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'
import { Container, SectionPill, type IconType, type SiteLocale } from '../ui'
import { OnboardingStepper, type StepperStep } from './onboarding-stepper'

const COPY = {
	fa: {
pill: 'راه‌اندازی در ۵ قدم',
		title: 'از ثبت‌نام تا اولین گفتگوی واقعی',
		titleTail: 'در پنج قدم کوتاه',
		leadMobile: 'پنج قدم کوتاه؛ هر کدام همان لحظه یک نتیجهٔ قابل‌دیدن دارد.',
		stats: [
			{ value: '۷', label: 'دقیقه در کل' },
			{ value: '۰', label: 'خط کد' },
			{ value: '۵', label: 'قدم کوتاه' },
		],
		tabsLabel: 'مراحل راه‌اندازی',
		steps: [
			{ title: 'ورود با شماره موبایل', duration: '۳۰ ثانیه', desc: 'بدون رمز و فرم طولانی؛ فقط یک کد پیامکی. فضای کاری شما همان لحظه ساخته می‌شود.', result: 'فضای کاری + اعتبار اولیهٔ پاسخ', path: 'login' },
			{ title: 'معرفی کسب‌وکار', duration: '۱ دقیقه', desc: 'نوع کسب‌وکار را انتخاب می‌کنید؛ مسیر راه‌اندازی و قالب ایجنت متناسب با آن آماده می‌شود.', result: 'مسیر پیشنهادی متناسب با کار شما', path: 'onboarding/business' },
			{ title: 'ساخت ایجنت', duration: '۲ دقیقه', desc: 'هدف، لحن و محدودهٔ پاسخ را مشخص می‌کنید؛یا فقط توضیح دهید تا ویجنتو، دستیار هوشمند داخل پنل، پیش‌نویسش را بسازد.', result: 'یک ایجنت آماده برای آزمایش', path: 'onboarding/agent' },
			{ title: 'افزودن دانش و محصول', duration: '۲ دقیقه', desc: 'فایل و آدرس سایت را می‌دهید یا ووکامرس را وصل می‌کنید تا محصول و سفارش خودکار همگام شوند.', result: 'پاسخ از دادهٔ واقعی شما', path: 'onboarding/knowledge' },
			{ title: 'وصل‌کردن یک برنامه', duration: '۱ دقیقه', desc: 'اینستاگرام، تلگرام، بله، روبیکا یا ویجت سایت؛ اولین گفتگوی واقعی در همان داشبورد می‌نشیند.', result: 'اولین گفتگوی واقعی، زنده', path: 'onboarding/channels' },
		],
		nums: ['۱', '۲', '۳', '۴', '۵'],
		p0: { title: 'ورود به ویجنت', sent: 'کد تأیید به ۰۹۱۲ ••• ••۷۱ ارسال شد', code: ['۴', '۸', '۲'], cta: 'ورود و ساخت فضای کاری' },
		p1: { title: 'کسب‌وکار شما چیست؟', types: ['فروشگاه', 'رستوران', 'کلینیک', 'آموزش', 'خدمات', 'سایر'], ready: 'مسیر فروشگاه آماده شد: کاتالوگ، ووکامرس، پیش‌سفارش' },
		p2: { title: 'ایجنت خود را بسازید', say: 'به ویجنتو بگویید:', prompt: 'یک فروشندهٔ خوش‌برخورد برای فروشگاه مانتو که قیمت و سایز را دقیق بگوید', tone: 'لحن', tones: ['محاوره‌ای', 'رسمی'], goals: 'اهداف', goalList: ['فروش', 'پشتیبانی', 'رزرو'], done: 'پیش‌نویس شش‌لایهٔ ایجنت ساخته شد' },
		p3: { title: 'دانش و محصول', pdf: 'قوانین ارسال و مرجوعی.pdf', site: 'yourshop.ir', reading: 'در حال خواندن', woo: 'همگام‌سازی محصولات ووکامرس', plugin: 'افزونهٔ رسمی' },
		p4: { title: 'یک برنامه وصل کنید', connected: 'وصل شد', connect: 'اتصال', channels: ['اینستاگرام', 'تلگرام', 'ویجت سایت', 'بله و روبیکا'], first: 'اولین گفتگوی واقعی', q: 'سلام، این مانتو سایز ۳۸ داره؟', a: 'بله موجوده! کارت محصول رو فرستادم.', answered: 'پاسخ داده شد' },
	},
	en: {
pill: 'Set up in 5 steps',
		title: 'From sign-up to your first real conversation',
		titleTail: 'in five short steps',
		leadMobile: 'Five short steps, each with a result you can see right away.',
		stats: [
			{ value: '7', label: 'minutes total' },
			{ value: '0', label: 'lines of code' },
			{ value: '5', label: 'short steps' },
		],
		tabsLabel: 'Setup steps',
		steps: [
			{ title: 'Sign in with your mobile', duration: '30 sec', desc: 'No password, no long form — just an SMS code. Your workspace is created instantly.', result: 'Your workspace + starter reply credit', path: 'login' },
			{ title: 'Describe your business', duration: '1 min', desc: 'Pick your business type; a matching setup path and agent template are prepared.', result: 'A setup path tailored to you', path: 'onboarding/business' },
			{ title: 'Build your agent', duration: '2 min', desc: 'Set the goal, tone and scope —or just describe it and Vigento, the built-in panel assistant, drafts it for you.', result: 'An agent ready to test', path: 'onboarding/agent' },
			{ title: 'Add knowledge & products', duration: '2 min', desc: 'Upload files, add your site URL or connect WooCommerce so products and orders sync automatically.', result: 'Answers from your real data', path: 'onboarding/knowledge' },
			{ title: 'Connect a channel', duration: '1 min', desc: 'Instagram, Telegram, Bale, Rubika or the website widget; your first real conversation lands in the dashboard.', result: 'Your first real conversation, live', path: 'onboarding/channels' },
		],
		nums: ['1', '2', '3', '4', '5'],
		p0: { title: 'Sign in to Vigent', sent: 'Code sent to 0912 ••• ••71', code: ['4', '8', '2'], cta: 'Sign in & create workspace' },
		p1: { title: 'What is your business?', types: ['Store', 'Restaurant', 'Clinic', 'Education', 'Services', 'Other'], ready: 'Store path ready: catalog, WooCommerce, pre-orders' },
		p2: { title: 'Build your agent', say: 'Tell Vigento:', prompt: 'A friendly sales assistant for a clothing store that gives exact prices and sizes', tone: 'Tone', tones: ['Casual', 'Formal'], goals: 'Goals', goalList: ['Sales', 'Support', 'Booking'], done: 'Six-layer agent draft created' },
		p3: { title: 'Knowledge & products', pdf: 'shipping-and-returns.pdf', site: 'yourshop.com', reading: 'Reading', woo: 'Syncing WooCommerce products', plugin: 'Official plugin' },
		p4: { title: 'Connect a channel', connected: 'Connected', connect: 'Connect', channels: ['Instagram', 'Telegram', 'Website widget', 'Bale & Rubika'], first: 'First real conversation', q: 'Hi, is this coat in size 38?', a: 'Yes, in stock! I sent the product card.', answered: 'Answered' },
	},
} as const

const TYPE_ICONS: (IconType | null)[] = [ShoppingBag, Utensils, CalendarDays, GraduationCap, BriefcaseBusiness, null]

function Caret({ className }: { className?: string }) {
	return <span aria-hidden className={cn('vg-caret ms-0.5 inline-block h-3.5 w-[1.5px] bg-vg-signal align-middle', className)} />
}

function Panels({ locale }: { locale: SiteLocale }) {
	const c = COPY[locale]
	const channelIcons: { icon: IconType; color: string }[] = [
		{ icon: InstagramIcon as IconType, color: '#be185d' },
		{ icon: Send, color: '#0369a1' },
		{ icon: Globe, color: '#5b3de8' },
		{ icon: MessageSquare, color: '#047857' },
	]
	return [
		<div key="p0" className="vg-pop flex grow flex-col items-center justify-center gap-3.5 text-center">
			<div className="text-[20px] font-bold">{c.p0.title}</div>
			<div className="text-[13px] text-vg-cap">{c.p0.sent}</div>
			<div dir="ltr" className="flex gap-2.5">
				{c.p0.code.map((digit) => <span key={digit} className="flex h-14 w-12 items-center justify-center rounded-control border-[1.5px] border-vg-ink text-[22px] font-bold">{digit}</span>)}
				<span className="flex h-14 w-12 items-center justify-center rounded-control border-[1.5px] border-vg-signal shadow-[0_0_0_4px_rgba(91,61,232,0.12)]"><Caret className="h-[22px]" /></span>
				<span className="h-14 w-12 rounded-control border-[1.5px] border-black/[0.12]" />
			</div>
			<span className="mt-1.5 inline-flex h-11 items-center rounded-xl bg-vg-ink px-7 text-[14px] font-medium text-white">{c.p0.cta}</span>
		</div>,
		<div key="p1" className="vg-pop flex grow flex-col gap-4">
			<div className="text-[18px] font-bold">{c.p1.title}</div>
			<div className="grid grid-cols-3 gap-2.5">
				{c.p1.types.map((type, i) => {
					const Icon = TYPE_ICONS[i]
					return (
						<span key={type} className={cn('flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[13px]', i === 0 ? 'border-[1.5px] border-vg-ink bg-vg-tint font-bold' : 'border border-black/10', !Icon && 'text-vg-cap')}>
							{Icon ? <Icon className={cn('size-5', i === 0 && 'text-vg-signal')} strokeWidth={1.8} /> : null}
							{type}
						</span>
					)
				})}
			</div>
			<div className="mt-auto flex items-center gap-2.5 rounded-control bg-vg-tint px-3.5 py-3 text-[13px] text-[#4c2fd0]"><Sparkles className="size-4" strokeWidth={1.8} />{c.p1.ready}</div>
		</div>,
		<div key="p2" className="vg-pop flex grow flex-col gap-3.5">
			<div className="text-[18px] font-bold">{c.p2.title}</div>
			<div className="rounded-2xl border-[1.5px] border-vg-signal p-3.5 text-[13px] leading-[1.9] shadow-[0_0_0_4px_rgba(91,61,232,0.08)]"><span className="text-vg-cap">{c.p2.say}</span> {c.p2.prompt}<Caret /></div>
			<div className="flex flex-col gap-2 text-[13px]">
				<div className="flex items-center justify-between"><span className="text-vg-cap">{c.p2.tone}</span><span className="flex rounded-chip bg-[#f4f4f5] p-[3px]"><span className="rounded-lg bg-white px-3.5 py-[5px] font-medium shadow-[var(--shadow-xs)]">{c.p2.tones[0]}</span><span className="px-3.5 py-[5px] text-vg-cap">{c.p2.tones[1]}</span></span></div>
				<div className="flex items-center justify-between"><span className="text-vg-cap">{c.p2.goals}</span><span className="flex gap-1.5">{c.p2.goalList.map((goal, i) => <span key={goal} className={cn('rounded-full px-2.5 py-1 text-[12px]', i < 2 ? 'bg-vg-ink text-white' : 'bg-[#f4f4f5]')}>{goal}</span>)}</span></div>
			</div>
			<div className="mt-auto flex items-center gap-2 text-[13px] text-vg-ok"><Check className="size-4" strokeWidth={2.2} />{c.p2.done}</div>
		</div>,
		<div key="p3" className="vg-pop flex grow flex-col gap-3">
			<div className="text-[18px] font-bold">{c.p3.title}</div>
			<div className="flex items-center gap-3 rounded-control border border-vg-line px-3.5 py-3"><span className="inline-flex size-9 items-center justify-center rounded-chip bg-[#fef2f2] text-[12px] font-bold text-[#b91c1c]">PDF</span><span className="grow text-[13px]">{c.p3.pdf}</span><Check className="size-[18px] text-vg-ok" strokeWidth={2.2} /></div>
			<div className="rounded-control border border-vg-line px-3.5 py-3">
				<div className="flex items-center gap-3"><span className="inline-flex size-9 items-center justify-center rounded-chip bg-vg-tint text-vg-signal"><Globe className="size-[18px]" strokeWidth={1.8} /></span><span dir="ltr" className="grow text-start text-[13px]">{c.p3.site}</span><span className="text-[12px] text-vg-cap">{c.p3.reading}</span></div>
				<div className="mt-2.5 h-1 overflow-hidden rounded bg-[#f4f4f5]"><span className="vg-obfill block h-full bg-vg-signal" /></div>
			</div>
			<div className="rounded-control border border-vg-line px-3.5 py-3">
				<div className="flex items-center gap-3"><span className="inline-flex size-9 items-center justify-center rounded-chip bg-[#f3e8ff] text-[#7e22ce]"><RefreshCw className="vg-spin size-[18px]" strokeWidth={1.8} /></span><span className="grow text-[13px]">{c.p3.woo}</span><span className="text-[12px] text-vg-cap">{c.p3.plugin}</span></div>
				<div className="mt-2.5 h-1 overflow-hidden rounded bg-[#f4f4f5]"><span className="vg-obfill block h-full bg-vg-ink [animation-duration:3s]" /></div>
			</div>
		</div>,
		<div key="p4" className="vg-pop flex grow gap-5">
			<div className="flex grow flex-col gap-2">
				<div className="mb-1 text-[18px] font-bold">{c.p4.title}</div>
				{c.p4.channels.map((name, i) => {
					const { icon: Icon, color } = channelIcons[i]
					const on = i === 0
					return (
						<div key={name} className={cn('flex items-center gap-2.5 rounded-control px-3 py-2.5 text-[13px]', on ? 'border-[1.5px] border-vg-ok bg-[#f0fdf4]' : 'border border-vg-line')}>
							<span className="inline-flex size-[18px]" style={{ color }}><Icon className="size-full" strokeWidth={1.8} /></span>
							<span className={cn('grow', on && 'font-bold')}>{name}</span>
							{on ? <span className="text-[12px] font-bold text-vg-ok">{c.p4.connected}</span> : <span className="rounded-lg bg-[#f4f4f5] px-2.5 py-1 text-[12px]">{c.p4.connect}</span>}
						</div>
					)
				})}
			</div>
			<div className="flex w-[210px] flex-col justify-end gap-2 rounded-card bg-vg-bg p-3.5">
				<span className="text-center text-[12px] text-vg-cap">{c.p4.first}</span>
				<div className="vg-sq1 self-start rounded-[14px_14px_4px_14px] bg-white px-2.5 py-2 text-[12px] ltr:self-end">{c.p4.q}</div>
				<div className="vg-sq2 self-end rounded-[14px_14px_14px_4px] bg-vg-ink px-2.5 py-2 text-[12px] leading-[1.7] text-white ltr:self-start">{c.p4.a}</div>
				<div className="vg-sq3 self-center rounded-full bg-[#dcfce7] px-2.5 py-1 text-[12px] text-[#166534]">{c.p4.answered}</div>
			</div>
		</div>,
	]
}

export function Onboarding({ locale }: { locale: SiteLocale }) {
	const c = COPY[locale]
	const steps: StepperStep[] = c.steps.map((step, i) => ({ ...step, num: c.nums[i] }))
	return (
		<section id="start" aria-labelledby="start-title" className="vg-cv pt-[52px] lg:py-[120px]">
			<Container>
				<div className="vg-rv flex flex-col items-center gap-4 text-center lg:flex-row lg:items-end lg:justify-between lg:text-start">
					<div className="flex flex-col items-center lg:items-start">
						<SectionPill icon={Rocket}>{c.pill}</SectionPill>
						<h2 id="start-title" className="mt-3 text-balance text-[26px] font-bold leading-[1.5] lg:mt-4 lg:text-[44px] lg:leading-[1.35]">
							{c.title}
							<span className="hidden lg:inline">{locale === 'fa' ? '،' : ','}</span>
							<span className="hidden font-medium text-vg-dim lg:block">{c.titleTail}</span>
						</h2>
						<p className="mt-2 text-[14.5px] leading-[1.95] text-vg-sub lg:hidden">{c.leadMobile}</p>
					</div>
					<div className="flex gap-2 lg:gap-2.5">
						{c.stats.map((stat, i) => (
							<span key={stat.label} className={cn('flex h-[70px] w-[100px] flex-col items-center justify-center rounded-card lg:h-24 lg:w-[124px] lg:rounded-card', i === 0 ? 'bg-vg-ink text-white' : 'border border-vg-line bg-white')}>
								<b className="text-[22px] font-bold leading-[1.2] lg:text-[30px] lg:leading-[1.1]">{stat.value}</b>
								<span className={cn('text-[12px] lg:text-[12px]', i === 0 ? 'text-[#a1a1aa]' : 'text-vg-cap')}>{stat.label}</span>
							</span>
						))}
					</div>
				</div>

				{/* Phones: a vertical timeline. The rail fills from step to step and
				    the step being "done" pulses — the phone version of the desktop
				    stepper's autoplay, in CSS only (paused off-screen). */}
				<ol className="vg-anim vg-rv-group mt-3 rounded-3xl border border-vg-line bg-white py-1 lg:hidden" style={{ '--vg-T': '10s' } as CSSProperties}>
					{steps.map((step, i) => (
						<li key={step.title} className="relative flex items-center gap-3 p-3.5 text-start">
							{i < steps.length - 1 ? (
								<span aria-hidden className="absolute -bottom-3.5 start-[31px] top-11 w-[1.5px] overflow-hidden bg-black/10">
									<span className={cn('vg-fy absolute inset-0 bg-vg-signal', `vg-f${i * 2 + 1}`)} />
								</span>
							) : null}
							<span className={cn('relative inline-flex size-[34px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white', i === steps.length - 1 ? 'bg-vg-signal' : 'bg-vg-ink')}>
								<span aria-hidden className={cn(`vg-x${i * 2}`, 'absolute -inset-[5px] rounded-full border-2 border-[rgba(91,61,232,0.35)]')} />
								{step.num}
							</span>
							<span className="grow">
								<span className="block text-[14.5px] font-bold">{step.title}</span>
								<span className="mt-px block text-[12.5px] text-vg-sub">{step.result}</span>
							</span>
							<span className="shrink-0 rounded-full bg-vg-tint px-[9px] py-1 text-[12.5px] text-[#4c2fd0]">{step.duration}</span>
						</li>
					))}
				</ol>

				<div className="vg-rv mt-11 hidden lg:block">
					<OnboardingStepper steps={steps} panels={Panels({ locale })} label={c.tabsLabel} />
				</div>
			</Container>
		</section>
	)
}
