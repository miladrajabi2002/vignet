import type { CSSProperties, ReactNode } from 'react'
import {
	BarChart3,
	Bot,
	Check,
	CircleAlert,
	Code2,
	FileText,
	Globe,
	Inbox,
	Link2,
	MessageCircle,
	Package,
	RefreshCw,
	Send,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
	UserPlus,
	UserRound,
	Users,
	Wallet,
	WandSparkles,
	Zap,
} from 'lucide-react'
import { InstagramIcon, TelegramIcon } from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'

/*
 * Explainer motion graphics (public pages, docs and dashboard).
 *
 * Each one shows a single mechanism playing out — how credit is charged,
 * how the agent answers from knowledge, how a hand-off reaches a teammate —
 * so the reader sees cause and effect instead of reading a paragraph about
 * it. They follow the public site's motion rules (site.css):
 * - server-rendered, CSS-only, on the shared scene clock: `vg-tN` appears at
 *   step N and stays, `vg-xN` shows only during step N, `vg-uN` is the
 *   "before" state that leaves at step N, `vg-fN` fills a bar at step N;
 * - the wrapper is a `.vg-anim` block, so loops pause off-screen
 *   (MotionPauser is mounted in the marketing and dashboard layouts);
 * - only opacity/transform animate and every element keeps its box from the
 *   first paint, so nothing shifts layout;
 * - reduced motion freezes on the finished, readable frame (`.vg-ex`).
 * The graphic is one labelled image for assistive tech; the surrounding
 * page text carries the details.
 */

export type MotionLocale = 'fa' | 'en'
type T = (fa: string, en: string) => string
const tr = (locale: MotionLocale): T => (fa, en) => (locale === 'fa' ? fa : en)

const IN = 'max-w-[88%] self-start rounded-control rounded-ss-[5px] ltr:self-end ltr:rounded-ss-control ltr:rounded-se-[5px] bg-white px-3 py-2 text-[12.5px] leading-[1.8] text-vg-ink shadow-[0_1px_2px_rgba(17,17,17,0.06)]'
const OUT = 'max-w-[88%] self-end rounded-control rounded-se-[5px] ltr:self-start ltr:rounded-se-control ltr:rounded-ss-[5px] bg-vg-ink px-3 py-2 text-[12.5px] leading-[1.8] text-white'

/**
 * `alwaysOn` skips the off-screen pause (`.vg-anim`) for layouts that mount
 * no MotionPauser (auth) — only use it where the graphic is always visible.
 */
function Frame({ label, clock = '12s', dark = false, alwaysOn = false, className, children }: { label: string; clock?: string; dark?: boolean; alwaysOn?: boolean; className?: string; children: ReactNode }) {
	return (
		<div
			role="img"
			aria-label={label}
			className={cn(
				'vg-ex relative flex w-full flex-col gap-2.5 overflow-hidden rounded-card border p-3.5 text-start sm:p-4',
				!alwaysOn && 'vg-anim',
				dark ? 'border-white/10 bg-white/[0.04] text-white' : 'vg-dots border-vg-line bg-white text-vg-ink shadow-[0_30px_60px_-48px_rgba(17,17,17,0.45)]',
				className,
			)}
			style={{ '--vg-T': clock } as CSSProperties}
		>
			{children}
		</div>
	)
}

function Head({ icon: Icon, title, meta, tint = '#f3f1ff', color = '#5b3de8' }: { icon: typeof Bot; title: string; meta?: ReactNode; tint?: string; color?: string }) {
	return (
		<div className="flex items-center gap-2.5">
			<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-chip" style={{ background: tint, color }}><Icon className="size-4" strokeWidth={1.9} /></span>
			<span className="grow text-[13.5px] font-bold">{title}</span>
			{meta}
		</div>
	)
}

function Dots({ className }: { className?: string }) {
	return (
		<span className={cn('inline-flex h-6 items-center gap-[3px] rounded-full bg-vg-tint px-2', className)}>
			{[0, 0.2, 0.4].map((delay) => <span key={delay} className="vg-tdot size-1 rounded-full bg-vg-signal" style={{ animationDelay: `${delay}s` }} />)}
		</span>
	)
}

/** Typing bubble on the agent's side, visible only during `step`. */
function Typing({ step, label }: { step: number; label?: string }) {
	return (
		<span className={cn(`vg-x${step}`, 'inline-flex h-7 items-center gap-1.5 self-end rounded-full bg-vg-tint px-2.5 text-[11px] font-medium text-[#4c2fd0] ltr:self-start')}>
			<span className="inline-flex gap-[3px]">
				{[0, 0.2, 0.4].map((delay) => <span key={delay} className="vg-tdot size-1 rounded-full bg-vg-signal" style={{ animationDelay: `${delay}s` }} />)}
			</span>
			{label}
		</span>
	)
}

const TONES = {
	ok: 'bg-[#dcfce7] text-[#166534]',
	violet: 'bg-vg-tint text-[#4c2fd0]',
	warn: 'bg-[#fef3c7] text-[#92400e]',
	ink: 'bg-vg-ink text-white',
	danger: 'bg-[#fef2f2] text-[#b91c1c]',
} as const

function Chip({ step, tone = 'ok', className, children }: { step?: number; tone?: keyof typeof TONES; className?: string; children: ReactNode }) {
	return <span className={cn(step !== undefined && `vg-t${step}`, 'inline-flex h-7 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-medium', TONES[tone], className)}>{children}</span>
}

/** A button being tapped during `step`: the pointer glides on and presses, the ring blooms. */
function Tap({ step }: { step: number }) {
	return (
		<>
			<span className={cn(`vg-x${step}`, 'pointer-events-none absolute inset-0 rounded-[inherit]')}>
				<span className="vg-tap absolute inset-0 rounded-[inherit] border-2 border-vg-signal" />
			</span>
			<span className="vg-cur vg-cur-step" style={{ '--vg-cur-at': step } as CSSProperties}><i /></span>
		</>
	)
}

/* ── Credit: only a successful AI reply is charged ──────────────────────
   Three events on one wallet: an AI reply (charged), an Instagram
   automation (free) and a failed request (refunded). The balance changes
   once — that single change is the whole lesson. Amounts are samples. */

export function CreditFlowMotion({ locale, className }: { locale: MotionLocale; className?: string }) {
	const t = tr(locale)
	const lanes = [
		{
			icon: Sparkles, tint: '#f3f1ff', color: '#5b3de8',
			title: t('پاسخ هوش مصنوعی', 'AI reply'),
			sub: t('«قیمت کت مشکی؟» ← پاسخ داده شد', '“Black coat price?” → answered'),
			show: 0, wait: 1, result: 2,
			chip: <Chip step={2} tone="violet">{t('کسر ۴۵۰ تومان', '−450 toman')}</Chip>,
		},
		{
			icon: InstagramIcon as typeof Bot, tint: '#fdf2f8', color: '#be185d',
			title: t('اتوماسیون اینستاگرام', 'Instagram automation'),
			sub: t('کامنت «قیمت؟» ← دایرکت خودکار', 'Comment “price?” → auto DM'),
			show: 4, wait: 4, result: 5,
			chip: <Chip step={5}><Check className="size-3.5" strokeWidth={2.4} />{t('رایگان · ۰ تومان', 'Free · 0 toman')}</Chip>,
		},
		{
			icon: CircleAlert, tint: '#f4f4f5', color: '#52525b',
			title: t('درخواست ناموفق', 'Failed request'),
			sub: t('پاسخ ساخته نشد ← رزرو اعتبار برگشت', 'No reply produced → hold released'),
			show: 6, wait: 6, result: 7,
			chip: <Chip step={7}><RefreshCw className="size-3.5" strokeWidth={2.2} />{t('بدون هزینه', 'No charge')}</Chip>,
		},
	]
	return (
		<Frame label={t('نمایش مصرف اعتبار: فقط پاسخ موفق هوش مصنوعی هزینه دارد؛ اتوماسیون اینستاگرام و درخواست ناموفق رایگان است.', 'How credit is used: only a successful AI reply is charged; Instagram automation and failed requests are free.')} clock="12s" className={className}>
			<Head
				icon={Wallet}
				title={t('اعتبار پاسخ', 'Reply credit')}
				meta={
					<span className="relative grid justify-items-end text-[14px] font-bold tabular-nums">
						<span className="vg-u3 [grid-area:1/1]">{t('۱۲۰٬۰۰۰ تومان', '120,000 toman')}</span>
						<span className="vg-t3 [grid-area:1/1]">{t('۱۱۹٬۵۵۰ تومان', '119,550 toman')}</span>
						<span className="vg-x3 absolute end-[calc(100%+8px)] top-0.5 whitespace-nowrap rounded-full bg-[#fef2f2] px-1.5 text-[11px] font-bold text-[#b91c1c]">{t('−۴۵۰', '−450')}</span>
						<span className="vg-x8 absolute end-[calc(100%+8px)] top-0.5 whitespace-nowrap rounded-full bg-[#f0fdf4] px-1.5 text-[11px] font-medium text-[#166534]">{t('بدون تغییر', 'unchanged')}</span>
					</span>
				}
			/>
			<div className="flex flex-col gap-2">
				{lanes.map((lane) => {
					const Icon = lane.icon
					return (
						<div key={lane.title} className={cn(`vg-t${lane.show}`, 'flex items-center gap-2.5 rounded-2xl border border-vg-line bg-white p-2.5')}>
							<span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: lane.tint, color: lane.color }}><span className="inline-flex size-[17px]"><Icon className="size-full" strokeWidth={1.9} /></span></span>
							<span className="min-w-0 grow">
								<span className="block text-[13px] font-bold">{lane.title}</span>
								<span className="block text-[11.5px] leading-[1.7] text-vg-cap sm:truncate">{lane.sub}</span>
							</span>
							<span className="grid shrink-0 justify-items-end">
								<Dots className={cn(`vg-x${lane.wait}`, '[grid-area:1/1]')} />
								<span className="[grid-area:1/1]">{lane.chip}</span>
							</span>
						</div>
					)
				})}
			</div>
			<p className="flex items-center gap-1.5 text-[11.5px] leading-[1.8] text-vg-sub">
				<ShieldCheck className="size-3.5 shrink-0 text-vg-ok" strokeWidth={2} />
				{t('فقط پاسخ موفق هوش مصنوعی از اعتبار کم می‌شود · مبالغ نمونه‌اند', 'Only a successful AI reply is charged · sample amounts')}
			</p>
		</Frame>
	)
}

/* ── Knowledge: sources become ready, then an answer cites one ─────────── */

export function KnowledgeFlowMotion({ locale, className }: { locale: MotionLocale; className?: string }) {
	const t = tr(locale)
	const sources = [
		{ icon: FileText, label: t('کاتالوگ محصولات.pdf', 'catalog.pdf'), until: 'vg-u1', ready: 'vg-t1', glow: '' },
		{ icon: Globe, label: t('صفحهٔ شرایط ارسال', 'Shipping policy page'), until: 'vg-u2', ready: 'vg-t2', glow: 'vg-x5' },
		{ icon: MessageCircle, label: t('۱۲ پرسش پرتکرار', '12 FAQs'), until: 'vg-u3', ready: 'vg-t3', glow: '' },
	]
	return (
		<Frame label={t('نمایش دانش ایجنت: منابع پردازش می‌شوند و ایجنت پاسخ را با ذکر منبع از همین دانش می‌دهد.', 'Agent knowledge: sources are processed and the agent answers from them, citing the source.')} clock="13s" className={className}>
			<div className="grid gap-2.5 sm:grid-cols-[0.95fr_1.05fr]">
				<div className="flex flex-col gap-2">
					<span className="text-[12px] font-medium text-vg-cap">{t('منابع دانش', 'Knowledge sources')}</span>
					{sources.map(({ icon: Icon, label, until, ready, glow }) => (
						<span key={label} className="relative flex items-center gap-2 rounded-xl border border-vg-line bg-white p-2.5 text-[12.5px]">
							<Icon className="size-4 shrink-0 text-vg-signal" strokeWidth={1.8} />
							<span className="min-w-0 grow truncate">{label}</span>
							<span className="grid shrink-0 justify-items-end text-[11px]">
								<span className={cn(until, 'inline-flex items-center gap-1 text-vg-cap [grid-area:1/1]')}><RefreshCw className="size-3" strokeWidth={2} />{t('پردازش', 'Processing')}</span>
								<span className={cn(ready, 'inline-flex items-center gap-1 font-medium text-vg-ok [grid-area:1/1]')}><Check className="size-3" strokeWidth={2.6} />{t('آماده', 'Ready')}</span>
							</span>
							{glow ? <span className={cn(glow, 'absolute -inset-px rounded-xl border-[1.5px] border-vg-signal shadow-[0_0_0_4px_rgba(91,61,232,0.1)]')} /> : null}
						</span>
					))}
				</div>
				<div className="flex min-h-[176px] flex-col gap-2 rounded-2xl bg-vg-bg p-2.5">
					<div className={cn(IN, 'vg-t4')}>{t('ارسال به شیراز چند روز طول می‌کشه؟', 'How long does shipping to Shiraz take?')}</div>
					<Typing step={5} label={t('جستجو در دانش…', 'Searching knowledge…')} />
					<div className={cn(OUT, 'vg-t6')}>{t('با پست پیشتاز ۳ تا ۴ روز کاری می‌رسه.', 'Express post gets there in 3–4 business days.')}</div>
					<Chip step={7} tone="violet" className="self-end ltr:self-start"><Globe className="size-3" strokeWidth={2} />{t('منبع: شرایط ارسال', 'Source: shipping policy')}</Chip>
				</div>
			</div>
		</Frame>
	)
}

/* ── Learning loop: analysis → finding → approved → answered next time ─── */

export function LearningLoopMotion({ locale, className }: { locale: MotionLocale; className?: string }) {
	const t = tr(locale)
	const stages = [
		{ label: t('بررسی گفتگوها', 'Review chats'), step: 0 },
		{ label: t('یافتن مشکل', 'Find the gap'), step: 2 },
		{ label: t('تأیید شما', 'You approve'), step: 4 },
		{ label: t('یاد گرفت', 'Learned'), step: 6 },
	]
	return (
		<Frame label={t('چرخهٔ یادگیری: گفتگوها بررسی می‌شوند، سؤال بی‌پاسخ پیدا می‌شود، با تأیید شما به دانش اضافه می‌شود و دفعهٔ بعد ایجنت درست جواب می‌دهد.', 'Learning loop: chats are reviewed, an unanswered question is found, you approve the fix, and next time the agent answers correctly.')} clock="15s" className={className}>
			<ol className="flex items-center gap-1">
				{stages.map((stage, i) => (
					<li key={stage.label} className="flex min-w-0 grow items-center gap-1">
						<span className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] text-[11px] font-bold text-vg-cap">
							{locale === 'fa' ? '۱۲۳۴'[i] : i + 1}
							<span className={cn(`vg-t${stage.step}`, 'absolute inset-0 inline-flex items-center justify-center rounded-full bg-vg-ink text-white')}><Check className="size-3" strokeWidth={3} /></span>
						</span>
						<span className="hidden truncate text-[11px] text-vg-sub sm:inline">{stage.label}</span>
						{i < stages.length - 1 ? <span className="relative mx-0.5 h-[2px] min-w-3 grow overflow-hidden rounded-full bg-black/[0.07]"><span className={cn('vg-fx absolute inset-0 bg-vg-ink', `vg-f${stage.step + 1}`)} /></span> : null}
					</li>
				))}
			</ol>
			<div className="grid gap-2 sm:grid-cols-2">
				<div className="flex flex-col gap-2">
					<div className="vg-t0 rounded-2xl border border-vg-line bg-white p-2.5">
						<div className="flex items-center justify-between text-[12px]"><span className="font-bold">{t('۲۴ گفتگوی امروز', 'Today’s 24 chats')}</span><span className="text-vg-cap">{t('تحلیل', 'Analysis')}</span></div>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]"><span className="vg-fx vg-f1 block h-full rounded-full bg-vg-signal" /></div>
					</div>
					<div className="vg-t2 flex items-start gap-2 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-2.5 text-[12px] leading-[1.8]">
						<CircleAlert className="mt-0.5 size-4 shrink-0 text-[#b45309]" strokeWidth={2} />
						<span>{t('۳ مشتری پرسیدند «جمعه‌ها باز هستید؟» و ایجنت جوابی نداشت.', '3 customers asked “Are you open Fridays?” and the agent had no answer.')}</span>
					</div>
					<div className="vg-t3 rounded-2xl border border-[rgba(91,61,232,0.3)] bg-white p-2.5 text-[12px] leading-[1.8]">
						<span className="font-medium text-vg-signal">{t('پیشنهاد دانش:', 'Knowledge fix:')}</span> {t('جمعه‌ها ۱۰ تا ۱۴ باز هستیم.', 'We’re open Fridays 10–14.')}
						<div className="mt-2 flex gap-1.5">
							<span className="relative inline-flex h-8 items-center gap-1 rounded-chip bg-vg-ink px-3 text-[11.5px] text-white"><Check className="size-3.5" strokeWidth={2.4} />{t('تأیید', 'Approve')}<Tap step={4} /></span>
							<span className="inline-flex h-8 items-center rounded-chip border border-black/10 bg-white px-3 text-[11.5px]">{t('ویرایش', 'Edit')}</span>
						</div>
					</div>
				</div>
				<div className="flex min-h-[150px] flex-col gap-2 rounded-2xl bg-vg-bg p-2.5">
					<Chip step={5} className="self-center"><WandSparkles className="size-3.5" strokeWidth={2} />{t('به دانش ایجنت اضافه شد', 'Added to the agent’s knowledge')}</Chip>
					<span className="vg-t6 self-center text-[11px] text-vg-cap">{t('فردا، گفتگوی بعدی…', 'Next day, next chat…')}</span>
					<div className={cn(IN, 'vg-t7')}>{t('سلام، فردا جمعه‌ست؛ بازید؟', 'Hi, tomorrow’s Friday — are you open?')}</div>
					<div className={cn(OUT, 'vg-t8')}>{t('بله، جمعه‌ها ۱۰ تا ۱۴ در خدمتیم.', 'Yes, we’re open Fridays 10 to 14.')}</div>
				</div>
			</div>
		</Frame>
	)
}

/* ── Handoff: a sensitive chat reaches a teammate with a summary ───────── */

export function HandoffMotion({ locale, className }: { locale: MotionLocale; className?: string }) {
	const t = tr(locale)
	return (
		<Frame label={t('ارجاع به اپراتور: ایجنت موضوع حساس را تشخیص می‌دهد، با خلاصه به همکار می‌سپارد و همکار گفتگو را ادامه می‌دهد.', 'Operator handoff: the agent spots a sensitive issue, hands it to a teammate with a summary, and the teammate takes over.')} clock="14s" className={className}>
			<div className="grid gap-2.5 sm:grid-cols-[1.1fr_0.9fr]">
				<div className="flex min-h-[210px] flex-col gap-2 rounded-2xl bg-vg-bg p-2.5">
					<div className={cn(IN, 'vg-t0')}>{t('پول از حسابم کم شد ولی سفارش ثبت نشد! با پشتیبانی کار دارم.', 'I was charged but the order never went through! I need support.')}</div>
					<Chip step={1} tone="warn" className="self-center"><CircleAlert className="size-3.5" strokeWidth={2} />{t('انتقال به اپراتور · مشکل پرداخت', 'Handoff · payment issue')}</Chip>
					<div className={cn(OUT, 'vg-t2')}>{t('متوجه‌ام؛ همین الان به همکارم سپردم و چند دقیقه دیگه پیگیری می‌کنه.', 'Understood — I’ve passed this to a teammate who’ll follow up in a few minutes.')}</div>
					<div className="vg-t7 flex max-w-[88%] flex-col self-end ltr:self-start">
						<span className="mb-0.5 px-1 text-[10.5px] text-vg-cap">{t('مریم · پشتیبانی', 'Maryam · Support')}</span>
						<span className="rounded-control rounded-se-[5px] bg-[#0369a1] px-3 py-2 text-[12.5px] leading-[1.8] text-white ltr:rounded-se-control ltr:rounded-ss-[5px]">{t('سلام سارا جان، سفارش‌تون ثبت شد؛ کد پیگیری ۴۸۲۱.', 'Hi Sara, your order is now placed — tracking code 4821.')}</span>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<div className="vg-t3 flex flex-col gap-2 rounded-2xl border border-vg-line bg-white p-2.5">
						<div className="flex items-center gap-2 text-[12px] font-bold"><span className="inline-flex size-6 items-center justify-center rounded-full bg-[#e0f2fe] text-[#0369a1]"><TelegramIcon className="size-3.5" /></span>{t('ربات اپراتور', 'Operator bot')}<span className="ms-auto text-[10.5px] font-normal text-vg-cap">{t('همین حالا', 'now')}</span></div>
						<div className="text-[12px] font-bold">{t('گفتگوی حساس · سارا', 'Sensitive chat · Sara')}</div>
						<div className="vg-t4 rounded-xl bg-vg-bg p-2 text-[11.5px] leading-[1.8] text-vg-sub">{t('خلاصه: پرداخت ۲٬۴۸۰٬۰۰۰ تومان موفق، سفارش ثبت نشده، اینستاگرام.', 'Summary: 2,480,000 toman paid, order not created, Instagram.')}</div>
						<span className="relative inline-flex h-8 w-fit items-center gap-1.5 rounded-chip bg-vg-ink px-3 text-[11.5px] text-white"><Send className="size-3.5" strokeWidth={2} />{t('پاسخ از تلگرام', 'Reply from Telegram')}<Tap step={5} /></span>
					</div>
					<Chip step={6} tone="violet"><UserRound className="size-3.5" strokeWidth={2} />{t('در دست اپراتور', 'With an operator')}</Chip>
				</div>
			</div>
		</Frame>
	)
}

/* ── Instagram automation: trigger → keyword → instant DM, no credit ───── */

export type AutomationKind = 'comment' | 'dm' | 'story'

export function AutomationMotion({ locale, kind = 'comment', className }: { locale: MotionLocale; kind?: AutomationKind; className?: string }) {
	const t = tr(locale)
	const igGradient = 'linear-gradient(160deg,#8a3ffc,#3797f0)'
	const trigger =
		kind === 'comment' ? (
			<div className="flex flex-col overflow-hidden rounded-2xl border border-vg-line bg-white">
				<div className="relative flex h-20 items-center justify-center bg-[radial-gradient(circle_at_30%_25%,#fff8e9_0%,#f5d5b8_45%,#c98b70_100%)]">
					<span className="absolute bottom-1.5 end-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] text-white">{t('کت پاییزه · موجود شد', 'Autumn coat · back in stock')}</span>
				</div>
				<div className="flex flex-col gap-1 p-2.5 text-[12px] leading-[1.7]">
					<p className="vg-t0"><b>sara.m</b> {t('قیمت؟', 'Price?')}</p>
					<p className="vg-t2 ps-3 text-vg-sub"><b className="text-vg-ink">your.shop</b> {t('دایرکت رو ببین 💌', 'Check your DMs 💌')}</p>
				</div>
			</div>
		) : kind === 'story' ? (
			<div className="flex items-center gap-2.5">
				<div className="relative h-32 w-20 shrink-0 overflow-hidden rounded-xl bg-[linear-gradient(170deg,#fde68a,#f472b6_55%,#7c3aed)]">
					<span className="absolute inset-x-1.5 top-1.5 h-[2px] overflow-hidden rounded bg-white/40"><span className="vg-scan block h-full bg-white" /></span>
				</div>
				<div className={cn(IN, 'vg-t0 border border-vg-line')}>{t('↩︎ پاسخ به استوری: «این چنده؟»', '↩︎ Story reply: “How much is this?”')}</div>
			</div>
		) : (
			<div className="flex flex-col gap-1.5 self-start rounded-2xl border border-vg-line bg-vg-bg p-2.5">
				<span className="text-[11px] text-vg-cap">{t('پیام تازه در دایرکت', 'New DM')}</span>
				<div className={cn(IN, 'vg-t0')}>{t('سلام، لیست قیمت رو می‌فرستید؟', 'Hi, can you send the price list?')}</div>
			</div>
		)
	const keyword = kind === 'dm' ? t('کلیدواژه: «قیمت»', 'Keyword: “price”') : kind === 'story' ? t('پاسخ استوری', 'Story reply') : t('کلیدواژه: «قیمت»', 'Keyword: “price”')
	return (
		<Frame label={t('اتوماسیون اینستاگرام: پیام یا کامنت مشتری با کلیدواژه شناسایی می‌شود و دایرکت آماده فوراً ارسال می‌شود، بدون مصرف اعتبار.', 'Instagram automation: a customer’s comment or message matches a keyword and a ready DM is sent instantly, using no credit.')} clock="12s" className={className}>
			<div className="grid gap-2.5 sm:grid-cols-2">
				{trigger}
				<div className="flex min-h-[150px] flex-col gap-1.5 rounded-2xl border border-vg-line bg-white p-2.5">
					<div className="flex items-center gap-1.5 text-[12px] font-bold"><Send className="size-3.5 -rotate-12" strokeWidth={2} />{t('دایرکت · sara.m', 'DM · sara.m')}</div>
					<div className="vg-t3 max-w-[90%] self-end rounded-control rounded-se-[5px] px-3 py-2 text-[12px] leading-[1.8] text-white ltr:self-start ltr:rounded-se-control ltr:rounded-ss-[5px]" style={{ background: igGradient }}>{t('سلام سارا 🌿 کت پاییزه ۲٬۴۸۰٬۰۰۰ تومانه؛ لینک خرید 👇', 'Hi Sara 🌿 The autumn coat is 2,480,000 toman — buy link 👇')}</div>
					<div className="vg-t4 flex w-[170px] items-center gap-2 self-end rounded-xl border border-vg-line p-1.5 ltr:self-start">
						<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f6ede2] text-[#92400e]"><Link2 className="size-4" strokeWidth={2} /></span>
						<span className="min-w-0"><span className="block truncate text-[11.5px] font-bold">{t('کت پاییزه', 'Autumn coat')}</span><span className="block text-[10.5px] text-vg-cap">{t('مشاهده و خرید', 'View & buy')}</span></span>
					</div>
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-center gap-1.5">
				<span className="relative">
					<Chip tone="violet"><InstagramIcon className="size-3.5" />{keyword}</Chip>
					<span className="vg-x1 absolute -inset-1 rounded-full border-[1.5px] border-vg-signal" />
				</span>
				<Chip step={5}><Zap className="size-3.5" strokeWidth={2} />{t('ارسال فوری · بدون مصرف اعتبار', 'Instant · no credit used')}</Chip>
			</div>
		</Frame>
	)
}

/* ── Behaviour: the same question, answered in the tone you pick ──────── */

export function ToneMotion({ locale, className }: { locale: MotionLocale; className?: string }) {
	const t = tr(locale)
	const seg = { animationDuration: '12s' }
	return (
		<Frame label={t('تنظیم رفتار: با تغییر لحن، ایجنت همان سؤال را با لحن انتخابی شما جواب می‌دهد.', 'Behavior settings: switch the tone and the agent answers the same question in that tone.')} clock="12s" className={className}>
			<Head icon={SlidersHorizontal} title={t('لحن پاسخ', 'Reply tone')} />
			<div className="relative flex rounded-xl bg-[#f4f4f5] p-1 text-[12px]">
				<span className="vg-seg absolute inset-y-1 start-1 w-[calc(50%-4px)] rounded-chip bg-white shadow-[0_1px_2px_rgba(17,17,17,0.08)]" style={seg} />
				<span className="relative grow basis-0 p-[6px] text-center font-medium">{t('صمیمی', 'Friendly')}</span>
				<span className="relative grow basis-0 p-[6px] text-center font-medium">{t('رسمی', 'Formal')}</span>
			</div>
			<div className="flex flex-col gap-2 rounded-2xl bg-vg-bg p-2.5">
				<div className={IN}>{t('سفارشم کی می‌رسه؟', 'When will my order arrive?')}</div>
				<div className="grid">
					<div className={cn(OUT, 'vg-u5 [grid-area:1/1]')}>{t('سلام عزیزم 🌸 فردا دستت می‌رسه، خیالت راحت!', 'Hey! 🌸 It’ll be with you tomorrow — no worries!')}</div>
					<div className={cn(OUT, 'vg-t5 [grid-area:1/1]')}>{t('سلام، وقت بخیر. سفارش شما فردا تحویل داده می‌شود.', 'Good day. Your order will be delivered tomorrow.')}</div>
				</div>
			</div>
			<div className="flex items-center justify-between gap-2 px-0.5 text-[12px]">
				<span>{t('ارجاع به انسان هنگام شکایت', 'Hand off to a human on complaints')}</span>
				<span className="relative inline-block h-5 w-9 shrink-0 rounded-full bg-vg-ink"><span className="absolute end-0.5 top-0.5 size-4 rounded-full bg-white" /></span>
			</div>
		</Frame>
	)
}

/* ── Sign-up: the workspace assembles itself for the business type ─────── */

export function WorkspaceAssemblyMotion({ locale, className }: { locale: MotionLocale; className?: string }) {
	const t = tr(locale)
	const types = [t('فروشگاه', 'Store'), t('رستوران', 'Restaurant'), t('کلینیک', 'Clinic')]
	const modules = [
		{ icon: Bot, label: t('ایجنت فروش', 'Sales agent') },
		{ icon: Inbox, label: t('صندوق گفتگو', 'Inbox') },
		{ icon: Users, label: t('CRM مشتریان', 'Customer CRM') },
		{ icon: Package, label: t('کاتالوگ محصول', 'Product catalog') },
		{ icon: InstagramIcon as typeof Bot, label: t('اتوماسیون اینستاگرام', 'Instagram automation') },
		{ icon: BarChart3, label: t('گزارش‌ها', 'Reports') },
	]
	return (
		<Frame dark alwaysOn label={t('آماده‌سازی پنل: با انتخاب نوع کسب‌وکار، ایجنت، صندوق گفتگو، CRM، کاتالوگ، اتوماسیون و گزارش‌ها آماده می‌شوند.', 'Workspace setup: pick your business type and the agent, inbox, CRM, catalog, automation and reports are prepared.')} clock="11s" className={className}>
			<div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
				<span className="text-white/50">{t('نوع کسب‌وکار:', 'Business type:')}</span>
				{types.map((type, i) => (
					<span key={type} className={cn('relative inline-flex h-7 items-center gap-1 rounded-full px-2.5', i === 0 ? 'bg-white font-medium text-black' : 'border border-white/10 text-white/45')}>
						{i === 0 ? <Check className="size-3" strokeWidth={3} /> : null}
						{type}
						{i === 0 ? <Tap step={0} /> : null}
					</span>
				))}
			</div>
			<div className="flex h-1 gap-1">
				{modules.map((module, i) => (
					<span key={module.label} className="relative grow overflow-hidden rounded-full bg-white/10"><span className={cn('vg-fx absolute inset-0 rounded-full bg-[#b9adff]', `vg-f${i + 1}`)} /></span>
				))}
			</div>
			<ul className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">
				{modules.map(({ icon: Icon, label }, i) => (
					<li key={label} className={cn(`vg-t${i + 1}`, 'flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2 text-[11.5px] text-white/80')}>
						<span className="inline-flex size-4 shrink-0 text-[#b9adff]"><Icon className="size-full" strokeWidth={1.9} /></span>
						<span className="min-w-0 grow truncate">{label}</span>
						<Check className="size-3.5 shrink-0 text-emerald-300" strokeWidth={2.6} />
					</li>
				))}
			</ul>
			<span className="vg-t8 inline-flex h-8 w-fit items-center gap-1.5 self-center rounded-full bg-white px-3 text-[12px] font-medium text-black"><Sparkles className="size-3.5 text-vg-signal" strokeWidth={2} />{t('پنل شما آماده است', 'Your workspace is ready')}</span>
		</Frame>
	)
}

/* ── Website widget: paste one line, the chat bubble appears and answers ── */

export function WidgetInstallMotion({ locale, className }: { locale: MotionLocale; className?: string }) {
	const t = tr(locale)
	return (
		<Frame label={t('نصب ویجت: یک خط کد در سایت قرار می‌گیرد، حباب چت ظاهر می‌شود و ایجنت به بازدیدکننده پاسخ می‌دهد.', 'Widget install: one line of code goes on your site, the chat bubble appears and the agent answers visitors.')} clock="14s" className={className}>
			<div className="vg-t0 flex items-center gap-2 overflow-hidden rounded-xl bg-[#0f0f12] px-3 py-2">
				<Code2 className="size-3.5 shrink-0 text-[#9685fb]" strokeWidth={2} />
				<code dir="ltr" className="min-w-0 grow truncate text-start font-mono text-[11px] text-white/75">{'<script src="https://vigent.ir/widget/loader.js" data-agent-id="…"></script>'}</code>
				<span className="vg-x1 shrink-0 rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-300">{t('ذخیره شد', 'Saved')}</span>
			</div>
			<div className="relative h-[250px] overflow-hidden rounded-2xl border border-vg-line bg-white">
				<div className="flex items-center gap-1.5 border-b border-vg-line bg-[#fafafa] px-2.5 py-1.5">
					<span className="size-2 rounded-full bg-[#fca5a5]" /><span className="size-2 rounded-full bg-[#fcd34d]" /><span className="size-2 rounded-full bg-[#86efac]" />
					<span dir="ltr" className="ms-2 rounded-md bg-white px-2 py-0.5 text-[10.5px] text-vg-cap">yourshop.ir</span>
				</div>
				<div aria-hidden className="flex flex-col gap-2 p-3">
					<span className="h-2.5 w-2/5 rounded bg-black/[0.08]" />
					<span className="h-2 w-4/5 rounded bg-black/[0.05]" />
					<span className="h-2 w-3/5 rounded bg-black/[0.05]" />
					<span className="mt-1 grid grid-cols-3 gap-2"><span className="h-12 rounded-lg bg-black/[0.05]" /><span className="h-12 rounded-lg bg-black/[0.05]" /><span className="h-12 rounded-lg bg-black/[0.05]" /></span>
				</div>
				<div className="vg-t4 absolute bottom-14 end-3 flex w-[200px] flex-col gap-1.5 overflow-hidden rounded-2xl border border-vg-line bg-vg-bg shadow-[0_24px_40px_-24px_rgba(17,17,17,0.5)]">
					<div className="flex items-center gap-2 bg-vg-ink px-2.5 py-2 text-[11.5px] font-medium text-white"><span className="inline-flex size-5 items-center justify-center rounded-full bg-white/15"><Sparkles className="size-3" strokeWidth={2} /></span>{t('پشتیبانی فروشگاه', 'Shop support')}</div>
					<div className="flex flex-col gap-1.5 px-2 pb-2">
						<div className={cn(IN, 'vg-t5 text-[11.5px]')}>{t('هزینهٔ ارسال چقدره؟', 'How much is shipping?')}</div>
						<Typing step={6} />
						<div className={cn(OUT, 'vg-t7 text-[11.5px]')}>{t('برای خرید بالای ۲ میلیون رایگانه 🙂', 'Free on orders over 2 million 🙂')}</div>
					</div>
				</div>
				<div className="vg-x3 absolute bottom-[3.75rem] end-3 max-w-[180px] rounded-2xl rounded-ee-[5px] border border-vg-line bg-white px-2.5 py-1.5 text-[11.5px] shadow-[0_12px_24px_-16px_rgba(17,17,17,0.5)]">{t('سلام! سؤالی دارید؟ 👋', 'Hi! Any questions? 👋')}</div>
				<span className="vg-t2 absolute bottom-3 end-3 inline-flex size-10 items-center justify-center rounded-full bg-vg-ink text-white shadow-[0_12px_24px_-10px_rgba(17,17,17,0.6)]">
					<span className="vg-ring absolute inset-0 rounded-full border-[1.5px] border-[rgba(91,61,232,0.5)]" />
					<MessageCircle className="relative size-[18px]" strokeWidth={2} />
				</span>
			</div>
		</Frame>
	)
}

/* ── Customer identification: name and number first, then a CRM record ── */

export function IdentifyMotion({ locale, className }: { locale: MotionLocale; className?: string }) {
	const t = tr(locale)
	return (
		<Frame label={t('شناسایی مشتری: ایجنت اول نام و شماره را می‌گیرد، مخاطب در CRM ثبت می‌شود و بعد پاسخ می‌دهد.', 'Customer identification: the agent collects name and number first, the contact is saved to the CRM, then it answers.')} clock="13s" className={className}>
			<div className="grid gap-2.5 sm:grid-cols-[1.15fr_0.85fr]">
				<div className="flex min-h-[200px] flex-col gap-2 rounded-2xl bg-vg-bg p-2.5">
					<div className={cn(IN, 'vg-t0')}>{t('سلام، سفارشم در چه وضعیتیه؟', 'Hi, what’s the status of my order?')}</div>
					<div className={cn(OUT, 'vg-t1')}>{t('سلام! برای پیگیری، نام و شمارهٔ موبایل‌تون رو بفرمایید.', 'Hi! To look it up, may I have your name and mobile number?')}</div>
					<div className={cn(IN, 'vg-t2')}>{t('سارا محمدی · ۰۹۱۲•••۴۵۶۷', 'Sara Mohammadi · 0912•••4567')}</div>
					<div className={cn(OUT, 'vg-t5')}>{t('ممنون سارا جان! سفارش شما امروز ارسال شده.', 'Thanks, Sara! Your order shipped today.')}</div>
				</div>
				<div className="flex flex-col gap-2">
					<div className="vg-t3 flex flex-col gap-2 rounded-2xl border border-vg-line bg-white p-2.5">
						<div className="flex items-center gap-2 text-[11.5px] font-medium text-vg-cap"><UserPlus className="size-3.5 text-vg-signal" strokeWidth={2} />{t('مخاطب جدید در CRM', 'New CRM contact')}</div>
						<div className="flex items-center gap-2">
							<span className="inline-flex size-8 items-center justify-center rounded-full bg-vg-soft text-[12px] font-bold text-[#4c2fd0]">{t('س', 'S')}</span>
							<span className="min-w-0"><span className="block text-[12.5px] font-bold">{t('سارا محمدی', 'Sara Mohammadi')}</span><span dir="ltr" className="block text-start text-[11px] text-vg-cap">0912•••4567</span></span>
						</div>
						<span className="vg-t4 inline-flex w-fit items-center gap-1 rounded-full bg-[#fdf2f8] px-2 py-0.5 text-[11px] text-[#be185d]"><InstagramIcon className="size-3" />{t('اینستاگرام', 'Instagram')}</span>
					</div>
					<Chip step={6} tone="violet"><Sparkles className="size-3.5" strokeWidth={2} />{t('از این به بعد با نام صدا می‌زند', 'Greets her by name from now on')}</Chip>
				</div>
			</div>
		</Frame>
	)
}
