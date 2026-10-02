import { Check, Globe, GraduationCap, MessageSquare, RefreshCw, Rocket, ShoppingBag, Sparkles, CalendarDays, BriefcaseBusiness, Utensils } from 'lucide-react'
import { InstagramGlyph, TelegramGlyph } from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'
import { Container, SectionPill, type IconType, type SiteLocale } from '../ui'
import { OnboardingPlayer, type PlayerStep } from './onboarding-player'
import './onboarding.css'

const COPY = {
	fa: {
pill: 'راه‌اندازی در ۵ قدم',
		title: 'از ثبت‌نام تا اولین گفتگوی واقعی',
		titleTail: 'در پنج قدم کوتاه',
		leadMobile: 'پنج قدم کوتاه؛ هر کدام همان لحظه یک نتیجهٔ قابل‌دیدن دارد.',
		stepOf: ['قدم', 'از ۵'],
		labels: { tabs: 'مراحل راه‌اندازی', goal: 'گفتگوی زنده', result: 'نتیجهٔ این قدم', clockNote: 'از حدود ۷ دقیقه · بدون یک خط کد', clockLabel: 'کل راه‌اندازی حدود ۷ دقیقه، بدون کدنویسی', prev: 'قدم قبلی', next: 'قدم بعدی', pause: 'توقف پخش', play: 'ادامهٔ پخش', pauseShort: 'توقف', playShort: 'پخش' },
		steps: [
			{ title: 'ورود با شماره موبایل', duration: '۳۰ ثانیه', desc: 'بدون رمز و فرم طولانی؛ فقط یک کد پیامکی. فضای کاری شما همان لحظه ساخته می‌شود.', result: 'فضای کاری + اعتبار اولیهٔ پاسخ', path: 'login' },
			{ title: 'معرفی کسب‌وکار', duration: '۱ دقیقه', desc: 'نوع کسب‌وکار را انتخاب می‌کنید؛ مسیر راه‌اندازی و قالب ایجنت متناسب با آن آماده می‌شود.', result: 'مسیر پیشنهادی متناسب با کار شما', path: 'onboarding/business' },
			{ title: 'ساخت ایجنت', duration: '۲ دقیقه', desc: 'هدف، لحن و محدودهٔ پاسخ را مشخص می‌کنید؛ یا فقط توضیح دهید تا ویجنتو، دستیار هوشمند داخل پنل، پیش‌نویسش را بسازد.', result: 'یک ایجنت آماده برای آزمایش', path: 'onboarding/agent' },
			{ title: 'افزودن دانش و محصول', duration: '۲ دقیقه', desc: 'فایل و آدرس سایت را می‌دهید یا ووکامرس را وصل می‌کنید تا محصول و سفارش خودکار همگام شوند.', result: 'پاسخ از دادهٔ واقعی شما', path: 'onboarding/knowledge' },
			{ title: 'وصل‌کردن یک برنامه', duration: '۱ دقیقه', desc: 'اینستاگرام، تلگرام، بله، روبیکا یا ویجت سایت؛ اولین گفتگوی واقعی در همان داشبورد می‌نشیند.', result: 'اولین گفتگوی واقعی، زنده', path: 'onboarding/channels' },
		],
		nums: ['۱', '۲', '۳', '۴', '۵'],
		p0: { title: 'ورود به ویجنت', sent: 'کد تأیید به ۰۹۱۲ ••• ••۷۱ ارسال شد', sms: 'پیامک', smsText: 'کد ورود شما به ویجنت: ۴۸۲۹۱', code: ['۴', '۸', '۲', '۹', '۱'], cta: 'ورود و ساخت فضای کاری', done: 'فضای کاری شما ساخته شد', credit: 'اعتبار اولیهٔ پاسخ فعال شد' },
		p1: { title: 'کسب‌وکار شما چیست؟', types: ['فروشگاه', 'رستوران', 'کلینیک', 'آموزش', 'خدمات', 'سایر'], ready: 'مسیر فروشگاه آماده شد', parts: ['کاتالوگ', 'ووکامرس', 'پیش‌سفارش'] },
		p2: { title: 'ایجنت خود را بسازید', say: 'به ویجنتو بگویید:', prompt: 'یک فروشندهٔ خوش‌برخورد برای فروشگاه مانتو که قیمت و سایز را دقیق بگوید', tone: 'لحن', tones: ['محاوره‌ای', 'رسمی'], goals: 'اهداف', goalList: ['فروش', 'پشتیبانی', 'رزرو'], done: 'پیش‌نویس شش‌لایهٔ ایجنت ساخته شد' },
		p3: { title: 'دانش و محصول', pdf: 'قوانین ارسال و مرجوعی.pdf', site: 'yourshop.ir', reading: 'در حال خواندن', read: 'خوانده شد', woo: 'محصولات ووکامرس', syncing: 'همگام‌سازی', synced: 'همگام شد', q: 'تا چند روز می‌شه مرجوع کرد؟', a: 'تا ۷ روز بعد از تحویل.', source: 'منبع: قوانین مرجوعی' },
		p4: { title: 'یک برنامه وصل کنید', channels: ['اینستاگرام', 'تلگرام', 'ویجت سایت', 'بله و روبیکا'], waiting: 'منتظر اولین پیام…', product: 'مانتو کتان', productMeta: 'سایز ۳۸ · موجود', q: 'سلام، این مانتو سایز ۳۸ داره؟', a: 'بله موجوده! کارت محصول رو فرستادم.', answered: 'پاسخ داده شد' },
	},
	en: {
pill: 'Set up in 5 steps',
		title: 'From sign-up to your first real conversation',
		titleTail: 'in five short steps',
		leadMobile: 'Five short steps, each with a result you can see right away.',
		stepOf: ['Step', 'of 5'],
		labels: { tabs: 'Setup steps', goal: 'Live conversation', result: 'Result of this step', clockNote: 'of about 7 minutes · no code', clockLabel: 'The whole setup takes about 7 minutes, with no code', prev: 'Previous step', next: 'Next step', pause: 'Pause', play: 'Play', pauseShort: 'Pause', playShort: 'Play' },
		steps: [
			{ title: 'Sign in with your mobile', duration: '30 sec', desc: 'No password, no long form — just an SMS code. Your workspace is created instantly.', result: 'Your workspace + starter reply credit', path: 'login' },
			{ title: 'Describe your business', duration: '1 min', desc: 'Pick your business type; a matching setup path and agent template are prepared.', result: 'A setup path tailored to you', path: 'onboarding/business' },
			{ title: 'Build your agent', duration: '2 min', desc: 'Set the goal, tone and scope — or just describe it and Vigento, the built-in panel assistant, drafts it for you.', result: 'An agent ready to test', path: 'onboarding/agent' },
			{ title: 'Add knowledge & products', duration: '2 min', desc: 'Upload files, add your site URL or connect WooCommerce so products and orders sync automatically.', result: 'Answers from your real data', path: 'onboarding/knowledge' },
			{ title: 'Connect a channel', duration: '1 min', desc: 'Instagram, Telegram, Bale, Rubika or the website widget; your first real conversation lands in the dashboard.', result: 'Your first real conversation, live', path: 'onboarding/channels' },
		],
		nums: ['1', '2', '3', '4', '5'],
		p0: { title: 'Sign in to Vigent', sent: 'Code sent to 0912 ••• ••71', sms: 'SMS', smsText: 'Your Vigent sign-in code: 48291', code: ['4', '8', '2', '9', '1'], cta: 'Sign in & create workspace', done: 'Your workspace is ready', credit: 'Starter reply credit activated' },
		p1: { title: 'What is your business?', types: ['Store', 'Restaurant', 'Clinic', 'Education', 'Services', 'Other'], ready: 'Store path ready', parts: ['Catalog', 'WooCommerce', 'Pre-orders'] },
		p2: { title: 'Build your agent', say: 'Tell Vigento:', prompt: 'A friendly sales assistant for a clothing store that gives exact prices and sizes', tone: 'Tone', tones: ['Casual', 'Formal'], goals: 'Goals', goalList: ['Sales', 'Support', 'Booking'], done: 'Six-layer agent draft created' },
		p3: { title: 'Knowledge & products', pdf: 'shipping-and-returns.pdf', site: 'yourshop.com', reading: 'Reading', read: 'Read', woo: 'WooCommerce products', syncing: 'Syncing', synced: 'Synced', q: 'How long do I have to return it?', a: 'Up to 7 days after delivery.', source: 'Source: returns policy' },
		p4: { title: 'Connect a channel', channels: ['Instagram', 'Telegram', 'Widget', 'Bale & Rubika'], waiting: 'Waiting for the first message…', product: 'Linen coat', productMeta: 'Size 38 · In stock', q: 'Hi, is this coat in size 38?', a: 'Yes, in stock! I sent the product card.', answered: 'Answered' },
	},
} as const

const TYPE_ICONS: (IconType | null)[] = [ShoppingBag, Utensils, CalendarDays, GraduationCap, BriefcaseBusiness, null]

/** The touch pointer the player glides onto each scene's `[data-ob-target]`. */
function Pointer() {
	return <span className="vg-cur"><i /></span>
}

/* The five scenes, in their resting (first-frame) markup. The player adds
   `.cN` cue classes over time; onboarding.css turns those into motion. */
function Scenes({ locale }: { locale: SiteLocale }) {
	const c = COPY[locale]
	const channels: { icon: IconType; color: string }[] = [
		{ icon: InstagramGlyph as IconType, color: '#be185d' },
		{ icon: TelegramGlyph as IconType, color: '#0369a1' },
		{ icon: Globe, color: '#5b3de8' },
		{ icon: MessageSquare, color: '#047857' },
	]
	const sources = [
		{ row: 'r1', icon: <span className="ob-ic pdf">PDF</span>, name: c.p3.pdf, busy: c.p3.reading, done: c.p3.read },
		{ row: 'r2', icon: <span className="ob-ic web"><Globe strokeWidth={1.8} /></span>, name: c.p3.site, busy: c.p3.reading, done: c.p3.read },
		{ row: 'r3', icon: <span className="ob-ic woo"><RefreshCw strokeWidth={1.8} /></span>, name: c.p3.woo, busy: c.p3.syncing, done: c.p3.synced },
	]
	return [
		<div key="p0" className="ob-scene ob-s1">
			<div className="ob-sms"><MessageSquare strokeWidth={1.8} /><span><b>{c.p0.sms}</b>{c.p0.smsText}</span></div>
			<div className="ob-form">
				<div className="ob-t">{c.p0.title}</div>
				<div className="ob-sub">{c.p0.sent}</div>
				<div dir="ltr" className="ob-otp">{c.p0.code.map((digit, i) => <b key={i}><i>{digit}</i></b>)}</div>
				<span className="ob-btn" data-ob-target><span className="ob-btn-lab">{c.p0.cta}</span><span className="ob-spin" /></span>
			</div>
			<div className="ob-done">
				<span className="ob-bigck"><Check strokeWidth={2.4} /></span>
				<div className="ob-t">{c.p0.done}</div>
				<span className="ob-okchip">{c.p0.credit}</span>
			</div>
			<Pointer />
		</div>,
		<div key="p1" className="ob-scene ob-s2">
			<div className="ob-t">{c.p1.title}</div>
			<div className="ob-types">
				{c.p1.types.map((type, i) => {
					const Icon = TYPE_ICONS[i]
					return (
						<span key={type} className={cn('ob-tile', i === 0 && 'pick', !Icon && 'other')} data-ob-target={i === 0 ? '' : undefined}>
							{Icon ? <Icon strokeWidth={1.8} /> : null}
							{type}
						</span>
					)
				})}
			</div>
			<div className="ob-path">
				<span className="ob-path-h"><Sparkles strokeWidth={1.8} />{c.p1.ready}</span>
				<span className="ob-chips">{c.p1.parts.map((part) => <i key={part}>{part}</i>)}</span>
			</div>
			<Pointer />
		</div>,
		<div key="p2" className="ob-scene ob-s3">
			<div className="ob-t">{c.p2.title}</div>
			<div className="ob-prompt">
				{/* The full text holds the box height; the visible copy is typed over it. */}
				<div className="ob-ghost">{c.p2.say} {c.p2.prompt}</div>
				<div className="ob-live"><span className="ob-say">{c.p2.say}</span> <span data-ob-typed /><span className="ob-caret" /></div>
			</div>
			<div className="ob-row"><span className="ob-k">{c.p2.tone}</span><span className="ob-toggle"><span className="ob-thumb" />{c.p2.tones.map((tone) => <em key={tone}>{tone}</em>)}</span></div>
			<div className="ob-row"><span className="ob-k">{c.p2.goals}</span><span className="ob-goals">{c.p2.goalList.map((goal) => <i key={goal}>{goal}</i>)}</span></div>
			<div className="ob-layers">
				<span className="ob-stack">{[0, 1, 2, 3, 4, 5].map((layer) => <i key={layer} />)}</span>
				<span className="ob-lay-t"><Check strokeWidth={2.4} />{c.p2.done}</span>
			</div>
		</div>,
		<div key="p3" className="ob-scene ob-s4">
			<div className="ob-t">{c.p3.title}</div>
			{sources.map((source) => (
				<div key={source.row} className={cn('ob-src', source.row)}>
					{source.icon}
					<span className="ob-nm">{source.name}</span>
					<span className="ob-st"><em className="w">{source.busy}</em><em className="d"><Check strokeWidth={2.6} />{source.done}</em></span>
					<span className="ob-pb"><i /></span>
				</div>
			))}
			<div className="ob-proof">
				<span className="ob-pq">{c.p3.q}</span>
				<span className="ob-pa">{c.p3.a}<em>{c.p3.source}</em></span>
			</div>
		</div>,
		<div key="p4" className="ob-scene ob-s5">
			<div className="ob-t">{c.p4.title}</div>
			<div className="ob-chs">
				{c.p4.channels.map((name, i) => {
					const { icon: Icon, color } = channels[i]
					return (
						<span key={name} className={cn('ob-ch', i === 0 && 'pick')} data-ob-target={i === 0 ? '' : undefined}>
							<Icon strokeWidth={1.8} style={{ color }} />
							{name}
							{i === 0 ? <b className="ob-badge"><Check strokeWidth={3} /></b> : null}
						</span>
					)
				})}
			</div>
			<div className="ob-chat">
				<span className="ob-wait">{c.p4.waiting}</span>
				<div className="ob-bq"><InstagramGlyph />{c.p4.q}</div>
				<div className="ob-reply"><span className="ob-dots"><i /><i /><i /></span><span className="ob-ba">{c.p4.a}</span></div>
				<div className="ob-pc"><span className="ob-pc-th"><ShoppingBag strokeWidth={1.8} /></span><span><b>{c.p4.product}</b><small>{c.p4.productMeta}</small></span></div>
				<span className="ob-okp">{c.p4.answered}</span>
			</div>
			<Pointer />
		</div>,
	]
}

export function Onboarding({ locale }: { locale: SiteLocale }) {
	const c = COPY[locale]
	const steps: PlayerStep[] = c.steps.map((step, i) => ({ ...step, num: c.nums[i], eyebrow: `${c.stepOf[0]} ${c.nums[i]} ${c.stepOf[1]} · ${step.duration}` }))
	return (
		<section id="start" aria-labelledby="start-title" className="vg-cv pt-14 md:pt-20 lg:py-[120px]">
			<Container>
				<OnboardingPlayer
					fa={locale === 'fa'}
					steps={steps}
					typed={c.p2.prompt}
					labels={c.labels}
					intro={
						<div className="flex flex-col items-center lg:items-start">
							<SectionPill icon={Rocket}>{c.pill}</SectionPill>
							<h2 id="start-title" className="mt-3 text-balance text-[28px] font-bold leading-[1.5] lg:mt-4 lg:text-[48px] lg:leading-[1.35]">
								{c.title}
								<span className="hidden lg:inline">{locale === 'fa' ? '،' : ','}</span>
								<span className="hidden font-medium text-vg-dim lg:block">{c.titleTail}</span>
							</h2>
							<p className="mt-2 text-[15px] leading-[1.95] text-vg-sub lg:hidden">{c.leadMobile}</p>
						</div>
					}
				>
					{Scenes({ locale })}
				</OnboardingPlayer>
			</Container>
		</section>
	)
}
