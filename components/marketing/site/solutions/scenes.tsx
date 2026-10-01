import type { CSSProperties, ReactNode } from 'react'
import {
	AtSign,
	BookOpen,
	Bot,
	CheckCheck,
	CircleAlert,
	Clock,
	FileText,
	Globe,
	Heart,
	Inbox,
	Mic,
	Moon,
	Package,
	Plug,
	RefreshCw,
	Send,
	ShoppingCart,
	Sparkles,
	Truck,
	UserCheck,
	Zap,
} from 'lucide-react'
import { InstagramIcon } from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'
import { CHANNELS, ChannelBadge, type IconType, type SiteLocale } from '../ui'

/*
 * One motion graphic per solution page. Every scene is server-rendered,
 * decorative (aria-hidden — the page text carries the meaning) and animated
 * purely in CSS on the shared scene clock from site.css: `vg-tN` makes an
 * element appear at step N and stay, `vg-xN` shows it only during step N.
 * The wrapper is a `.vg-anim` block, so loops pause while off-screen, and
 * reduced motion shows the finished frame. Only opacity/transform animate,
 * and every element keeps its box from the first paint (no layout shift).
 */

type T = (fa: string, en: string) => string
const tr = (locale: SiteLocale): T => (fa, en) => (locale === 'fa' ? fa : en)

const IN = 'max-w-[86%] self-start rounded-control rounded-ss-[5px] ltr:self-end ltr:rounded-ss-control ltr:rounded-se-[5px] bg-[#f4f4f5] px-3 py-2 text-[12.5px] leading-[1.8] text-vg-ink lg:text-[13px]'
const OUT = 'max-w-[86%] self-end rounded-control rounded-se-[5px] ltr:self-start ltr:rounded-se-control ltr:rounded-ss-[5px] bg-vg-ink px-3 py-2 text-[12.5px] leading-[1.8] text-white lg:text-[13px]'

function Frame({ children, className, clock }: { children: ReactNode; className?: string; clock?: string }) {
	return (
		<div
			aria-hidden
			className={cn('vg-anim vg-dots relative flex grow flex-col gap-3 overflow-hidden rounded-sheet border border-vg-line bg-white p-4 text-start shadow-[0_50px_90px_-60px_rgba(17,17,17,0.5)] lg:h-[520px] lg:p-[22px]', className)}
			style={clock ? ({ '--vg-T': clock } as CSSProperties) : undefined}
		>
			{children}
		</div>
	)
}

function Head({ icon: Icon, title, meta, tint = '#f3f1ff', color = '#5b3de8' }: { icon: IconType; title: string; meta?: ReactNode; tint?: string; color?: string }) {
	return (
		<div className="flex items-center gap-2.5">
			<span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: tint, color }}><Icon className="size-[18px]" strokeWidth={1.8} /></span>
			<span className="grow text-[14.5px] font-bold lg:text-[15.5px]">{title}</span>
			{meta}
		</div>
	)
}

function Typing({ step, className }: { step: number; className?: string }) {
	return (
		<span className={cn(`vg-x${step}`, 'inline-flex h-8 items-center gap-1 self-end rounded-full bg-vg-tint px-3 ltr:self-start', className)}>
			{[0, 0.2, 0.4].map((delay) => <span key={delay} className="vg-tdot size-[5px] rounded-full bg-vg-signal" style={{ animationDelay: `${delay}s` }} />)}
		</span>
	)
}

function Chip({ step, children, tone = 'ok', className }: { step: number; children: ReactNode; tone?: 'ok' | 'violet' | 'warn' | 'ink'; className?: string }) {
	const tones = { ok: 'bg-[#dcfce7] text-[#166534]', violet: 'bg-vg-tint text-[#4c2fd0]', warn: 'bg-[#fef3c7] text-[#92400e]', ink: 'bg-vg-ink text-white' }
	return <span className={cn(`vg-t${step}`, 'inline-flex h-7 w-fit items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium lg:text-[12px]', tones[tone], className)}>{children}</span>
}

/* ── Unified inbox: six channels pour into one list and one contact record ── */

function UnifiedInboxScene({ locale }: { locale: SiteLocale }) {
	const t = tr(locale)
	const rows = [
		{ ch: 0, name: t('سارا', 'Sara'), text: t('کت مشکی سایز M موجوده؟', 'Black cardigan in M?'), status: t('پاسخ داده شد', 'Answered'), tone: 'ok' },
		{ ch: 1, name: t('امیر', 'Amir'), text: t('سفارشم کی می‌رسه؟', 'When does my order arrive?'), status: t('حل شد', 'Resolved'), tone: 'ok' },
		{ ch: 2, name: t('مهدی', 'Mehdi'), text: t('قرارداد سازمانی', 'Enterprise contract'), status: t('نیاز به شما', 'Needs you'), tone: 'warn' },
		{ ch: 4, name: t('نگار', 'Negar'), text: t('جمعه ساعت ۵ وقت دارید؟', 'Friday 5 pm free?'), status: t('رزرو شد', 'Booked'), tone: 'ok' },
		{ ch: 3, name: t('رضا', 'Reza'), text: t('فاکتور رسمی می‌دید؟', 'Can I get an invoice?'), status: t('پاسخ داده شد', 'Answered'), tone: 'ok' },
	] as const
	return (
		<Frame clock="13s">
			<Head icon={Inbox} title={t('صندوق گفتگو', 'Conversations')} meta={<span className="rounded-full bg-vg-ink px-2.5 py-1 text-[11.5px] text-white">{t('همه', 'All')}</span>} />
			<div className="flex justify-between gap-1 rounded-2xl bg-vg-bg p-2">
				{CHANNELS.map((channel, i) => (
					<span key={channel.id} className="relative">
						<ChannelBadge channel={channel} size={36} iconSize={17} />
						<span className={cn(`vg-x${i}`, 'absolute -end-1 -top-1 size-3 rounded-full border-2 border-vg-bg bg-vg-signal')} />
					</span>
				))}
			</div>
			<div className="flex grow gap-3">
				<div className="flex min-w-0 grow flex-col gap-1.5">
					{rows.map((row, i) => {
						const channel = CHANNELS[row.ch]
						return (
							<div key={row.name} className={cn(`vg-t${i}`, 'flex items-center gap-2.5 rounded-2xl border px-2.5 py-2', i === 2 ? 'border-[#fde68a] bg-[#fffbeb]' : 'border-vg-line bg-white')}>
								<ChannelBadge channel={channel} size={32} iconSize={15} />
								<div className="min-w-0 grow">
									<div className="flex items-center gap-1.5 text-[13px] font-bold">{row.name}<span className="text-[11px] font-normal" style={{ color: channel.color }}>{channel.short[locale]}</span></div>
									<div className="truncate text-[12px] text-vg-sub">{row.text}</div>
								</div>
								<span className={cn(`vg-t${i + 1}`, 'shrink-0 rounded-full px-2 py-0.5 text-[11px]', row.tone === 'warn' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#dcfce7] text-[#166534]')}>{row.status}</span>
							</div>
						)
					})}
				</div>
				<div className="vg-t6 hidden w-[200px] shrink-0 flex-col gap-2 rounded-2xl bg-vg-bg p-3 lg:flex">
					<div className="flex items-center gap-2"><span className="inline-flex size-9 items-center justify-center rounded-full bg-vg-soft font-bold text-[#4c2fd0]">{t('س', 'S')}</span><div><div className="text-[13px] font-bold">{t('سارا', 'Sara')}</div><div className="text-[11px] text-vg-cap">{t('۳ برنامه', '3 channels')}</div></div></div>
					<div className="flex gap-1">{[0, 4, 1].map((c) => <ChannelBadge key={c} channel={CHANNELS[c]} size={24} iconSize={12} radius={7} />)}</div>
					<div className="rounded-xl bg-white p-2 text-[11.5px] leading-[1.8] text-vg-sub">{t('۲ سفارش قبلی · آخرین خرید: کت کرم', '2 past orders · last: cream coat')}</div>
					<span className="vg-t7 w-fit rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] text-[#166534]">{t('قصد خرید بالا', 'High intent')}</span>
					<span className="vg-t8 mt-auto flex flex-col gap-1 rounded-xl bg-vg-ink p-2.5 text-[11.5px] leading-[1.7] text-white">
						<Inbox className="size-4 text-[#b9adff]" strokeWidth={2} />
						{t('۶ برنامه، ۱ صندوق؛ هیچ پیامی گم نمی‌شود', '6 channels, 1 inbox — nothing gets lost')}
					</span>
				</div>
			</div>
			<Chip step={7} tone="ink" className="self-center lg:hidden"><Inbox className="size-3.5" strokeWidth={2} />{t('۶ برنامه · ۱ صندوق · بدون پیام گم‌شده', '6 channels · 1 inbox · nothing lost')}</Chip>
		</Frame>
	)
}

/* ── Persian chatbot: a 2 a.m. voice note answered from the store's own PDF ── */

function PersianChatbotScene({ locale }: { locale: SiteLocale }) {
	const t = tr(locale)
	const sources = [
		{ icon: FileText, label: t('قوانین ارسال.pdf', 'shipping.pdf'), glow: 'vg-x3' },
		{ icon: Globe, label: t('سایت شما', 'Your website'), glow: '' },
		{ icon: BookOpen, label: t('پرسش‌های پرتکرار', 'FAQs'), glow: 'vg-x6' },
	]
	return (
		<Frame clock="14s">
			<Head icon={Moon} title={t('گفتگو · ساعت ۲:۱۴ بامداد', 'Chat · 2:14 a.m.')} meta={<span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-1 text-[11px] text-[#166534]"><span className="size-1.5 rounded-full bg-[#16a34a]" />{t('ایجنت آنلاین', 'Agent online')}</span>} />
			<div className="flex grow gap-3">
				<div className="flex min-w-0 grow flex-col gap-2 rounded-2xl bg-vg-bg p-3">
					<div className={cn(IN, 'vg-t0 flex w-[210px] items-center gap-2 bg-white')}>
						<span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-vg-ink text-white"><Mic className="size-3.5" strokeWidth={2} /></span>
						<span className="flex h-6 grow items-center gap-[3px]">{[0.1, 0.3, 0.5, 0.2, 0.4, 0.15, 0.35, 0.05, 0.25, 0.45].map((d) => <span key={d} className="vg-wave h-5 w-[3px] rounded bg-vg-signal/70" style={{ animationDelay: `${d}s` }} />)}</span>
						<span className="text-[11px] text-vg-cap">0:05</span>
					</div>
					<p className="vg-t1 self-start ps-1 text-[11.5px] ltr:self-end leading-[1.8] text-vg-cap">{t('«ارسال به شیراز چند روزه؟ پرداخت در محل هم دارید؟»', '“How long to Shiraz? Do you take cash on delivery?”')}</p>
					<div className="relative flex flex-col">
						<Typing step={2} className="absolute end-0 top-0 ltr:end-auto ltr:start-0" />
						<div className={cn(OUT, 'vg-t3')}>{t('سلام، شب بخیر 🌙 ارسال به شیراز ۳ تا ۴ روز کاریه و پرداخت در محل هم داریم.', 'Hi, good evening 🌙 Shiraz takes 3–4 business days, and yes, cash on delivery is available.')}</div>
					</div>
					<div className="vg-t4 flex flex-wrap justify-end gap-1.5 ltr:justify-start">
						<span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-vg-sub"><FileText className="size-3" strokeWidth={2} />{t('منبع: قوانین ارسال', 'Source: shipping policy')}</span>
						<span className="inline-flex items-center gap-1 rounded-full bg-vg-tint px-2 py-0.5 text-[11px] text-[#4c2fd0]"><Zap className="size-3" strokeWidth={2} />{t('۳ ثانیه', '3 sec')}</span>
					</div>
					<div className={cn(IN, 'vg-t5 bg-white')}>{t('عالیه، مرسی 🙏 مرجوعی چطوره؟', 'Great, thanks 🙏 What about returns?')}</div>
					<div className="relative flex flex-col">
						<Typing step={6} className="absolute end-0 top-0 ltr:end-auto ltr:start-0" />
						<div className={cn(OUT, 'vg-t7')}>{t('تا ۷ روز بعد از تحویل، بدون هزینه مرجوع می‌شه 🌿', 'Free returns within 7 days of delivery 🌿')}</div>
					</div>
				</div>
				<div className="hidden w-[180px] shrink-0 flex-col gap-2 lg:flex">
					<span className="text-[12px] font-medium text-vg-cap">{t('دانش ایجنت', 'Agent knowledge')}</span>
					{sources.map(({ icon: Icon, label, glow }) => (
						<span key={label} className="relative flex items-center gap-2 rounded-xl border border-vg-line bg-white p-2.5 text-[12.5px]">
							<Icon className="size-4 text-vg-signal" strokeWidth={1.8} />{label}
							{glow ? <span className={cn(glow, 'absolute -inset-px rounded-xl border-[1.5px] border-vg-signal shadow-[0_0_0_4px_rgba(91,61,232,0.1)]')} /> : null}
						</span>
					))}
					<span className="mt-auto rounded-xl bg-vg-bg p-2.5 text-[11.5px] leading-[1.8] text-vg-sub">{t('لحن: صمیمی و مؤدب · فقط از دانش تأییدشده', 'Tone: warm and polite · approved knowledge only')}</span>
				</div>
			</div>
		</Frame>
	)
}

/* ── Store AI: a chat that walks from question to paid order ── */

function EcommerceScene({ locale }: { locale: SiteLocale }) {
	const t = tr(locale)
	const stages = [t('گفتگو', 'Chat'), t('پیشنهاد', 'Suggest'), t('سبد', 'Cart'), t('پرداخت', 'Paid')]
	const stageSteps = [0, 3, 5, 7]
	const products = [
		{ name: t('رانینگ ایر', 'Run Air'), price: t('۲٬۴۹۰٬۰۰۰', '2,490,000'), hue: '#e0e7ff' },
		{ name: t('ترِیل پرو', 'Trail Pro'), price: t('۲٬۸۵۰٬۰۰۰', '2,850,000'), hue: '#fde68a' },
		{ name: t('سیتی لایت', 'City Lite'), price: t('۱٬۹۹۰٬۰۰۰', '1,990,000'), hue: '#dcfce7' },
	]
	return (
		<Frame clock="14s">
			<div className="flex items-center gap-1.5">
				{stages.map((stage, i) => (
					<span key={stage} className="flex grow items-center gap-1.5">
						<span className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] text-[11px] text-vg-cap">
							{i + 1}
							<span className={cn(`vg-t${stageSteps[i]}`, 'absolute inset-0 inline-flex items-center justify-center rounded-full bg-vg-signal text-white')}>✓</span>
						</span>
						<span className="text-[11.5px] font-medium">{stage}</span>
						{i < stages.length - 1 ? <span className="h-px grow bg-black/10" /> : null}
					</span>
				))}
			</div>
			<div className="flex grow flex-col gap-2 rounded-2xl bg-vg-bg p-3">
				<div className={cn(IN, 'vg-t0 bg-white')}>{t('کتونی رانینگ سایز ۴۲، زیر ۳ میلیون دارید؟', 'Running shoes in 42, under 3 million?')}</div>
				<div className="relative flex flex-col">
					<Typing step={1} className="absolute end-0 top-0 ltr:end-auto ltr:start-0" />
					<div className={cn(OUT, 'vg-t2')}>{t('سه مدل با سایز ۴۲ موجوده 👇', 'Three models in size 42 are in stock 👇')}</div>
				</div>
				<div className="vg-t3 grid grid-cols-3 gap-2">
					{products.map((product, i) => (
						<div key={product.name} className="relative overflow-hidden rounded-xl border border-vg-line bg-white">
							<div className="flex h-12 items-center justify-center lg:h-16" style={{ background: product.hue }}>
								<svg viewBox="0 0 60 30" className="h-6 w-12 lg:h-8 lg:w-16"><path d="M4 22 C10 20 14 12 20 10 L30 16 C36 18 46 18 56 20 L56 26 L4 26 Z" fill="#111" opacity=".85" /><path d="M4 26 L56 26" stroke="#fff" strokeWidth="2" /></svg>
							</div>
							<div className="p-1.5 lg:p-2">
								<div className="truncate text-[11px] font-bold lg:text-[12px]">{product.name}</div>
								<div className="text-[10.5px] text-vg-sub lg:text-[11px]">{product.price}</div>
							</div>
							{i === 1 ? <span className="vg-t4 absolute inset-0 rounded-xl border-2 border-vg-signal" /> : null}
						</div>
					))}
				</div>
				<div className={cn(IN, 'vg-t4 bg-white')}>{t('دومی رو برمی‌دارم', 'I’ll take the second one')}</div>
				<div className={cn(OUT, 'vg-t5 w-[230px] bg-white text-vg-ink shadow-[0_10px_30px_-18px_rgba(17,17,17,0.5)] ring-1 ring-vg-line')}>
					<div className="flex items-center gap-2 text-[12px] font-bold"><ShoppingCart className="size-3.5 text-vg-signal" strokeWidth={2} />{t('ترِیل پرو · سایز ۴۲', 'Trail Pro · size 42')}</div>
					<div className="mt-1 flex items-center justify-between text-[11.5px] text-vg-sub">{t('۲٬۸۵۰٬۰۰۰ تومان', '2,850,000 toman')}<span className="rounded-md bg-vg-ink px-2 py-0.5 text-[11px] text-white">{t('پرداخت امن', 'Pay')}</span></div>
				</div>
				<div className="mt-auto flex flex-wrap justify-center gap-1.5">
					<Chip step={7}><CheckCheck className="size-3.5" strokeWidth={2} />{t('سفارش #۱۰۴۲ ثبت شد', 'Order #1042 placed')}</Chip>
					<Chip step={8} tone="violet"><Package className="size-3.5" strokeWidth={2} />{t('موجودی: ۵ ← ۴', 'Stock: 5 → 4')}</Chip>
				</div>
			</div>
		</Frame>
	)
}

/* ── Support AI: routine questions close themselves; the risky one is escalated ── */

function SupportScene({ locale }: { locale: SiteLocale }) {
	const t = tr(locale)
	const auto = [
		{ text: t('ساعت کاری‌تون چنده؟', 'What are your hours?'), step: 0 },
		{ text: t('کد تخفیف اعمال نمی‌شه', 'Discount code won’t apply'), step: 1 },
		{ text: t('آدرس شعبه کجاست؟', 'Where’s the branch?'), step: 2 },
		{ text: t('وضعیت سفارش ۸۴۱۲', 'Status of order 8412'), step: 4 },
	]
	return (
		<Frame clock="14s">
			<Head icon={UserCheck} title={t('پشتیبانی امروز', 'Support today')} meta={<span className="text-[11.5px] text-vg-cap">{t('نمونهٔ یک روز کاری', 'A sample day')}</span>} />
			<div className="grid grow grid-cols-1 gap-3 lg:grid-cols-2">
				<div className="flex flex-col gap-2 rounded-2xl bg-vg-bg p-3">
					<span className="flex items-center gap-1.5 text-[12px] font-bold text-[#166534]"><Bot className="size-3.5" strokeWidth={2} />{t('خودکار حل شد', 'Resolved automatically')}</span>
					{auto.map((row) => (
						<div key={row.text} className={cn(`vg-t${row.step}`, 'flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-[12.5px]')}>
							<span className="grow truncate">{row.text}</span>
							<CheckCheck className="size-4 shrink-0 text-vg-ok" strokeWidth={2} />
						</div>
					))}
				</div>
				<div className="flex flex-col gap-2 rounded-2xl border border-[#fecaca] bg-[#fff7f7] p-3">
					<span className="flex items-center gap-1.5 text-[12px] font-bold text-[#b91c1c]"><CircleAlert className="size-3.5" strokeWidth={2} />{t('نیاز به اپراتور', 'Needs an operator')}</span>
					<div className="vg-t3 rounded-xl bg-white px-2.5 py-2 text-[12.5px]">
						<div className="flex items-center justify-between gap-2"><b className="font-bold">{t('پرداخت شد، سفارش ثبت نشد', 'Paid, but no order')}</b><span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10.5px] text-[#b91c1c]">{t('فوری', 'Urgent')}</span></div>
					</div>
					<div className="vg-t5 rounded-xl bg-white px-2.5 py-2 text-[11.5px] leading-[1.9] text-vg-sub">
						<span className="flex items-center gap-1 font-bold text-vg-ink"><Sparkles className="size-3 text-vg-signal" strokeWidth={2} />{t('خلاصهٔ ایجنت', 'Agent summary')}</span>
						{t('پرداخت ساعت ۱۲:۴۰ با کد پیگیری ۸۴۲۱۹؛ سفارش در حالت «در انتظار» مانده.', 'Paid at 12:40, ref 84219; the order is stuck at “pending”.')}
					</div>
					<Chip step={6} tone="violet"><UserCheck className="size-3.5" strokeWidth={2} />{t('ارجاع به رضا · پشتیبانی', 'Assigned to Reza · support')}</Chip>
					<Chip step={8} className="mt-auto"><CheckCheck className="size-3.5" strokeWidth={2} />{t('پیگیری شد و به مشتری خبر داده شد', 'Fixed and the customer notified')}</Chip>
				</div>
			</div>
			<div className="vg-t7 flex items-center justify-center gap-4 rounded-2xl bg-vg-ink px-3 py-2.5 text-[12px] text-white">
				<span className="inline-flex items-center gap-1.5"><Bot className="size-3.5 text-[#b9adff]" strokeWidth={2} />{t('۸۶٪ خودکار', '86% automated')}</span>
				<span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-[#b9adff]" strokeWidth={2} />{t('پاسخ در ۴ ثانیه', '4 sec replies')}</span>
			</div>
		</Frame>
	)
}

/* ── Instagram: comment → auto reply → private DM, plus a story mention ── */

function Coat({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 80 110" className={className}>
			<path d="M26 8 L40 16 L54 8 L68 18 L74 58 L64 60 L62 34 L64 104 L16 104 L18 34 L16 60 L6 58 L12 18 Z" fill="#efe3d2" />
			<path d="M40 16 L40 104" stroke="#bca487" strokeWidth="1.2" />
			<path d="M26 8 L40 16 L33 40 Z M54 8 L40 16 L47 40 Z" fill="#d9c6ad" />
			<path d="M18 62 L62 62" stroke="#bca487" strokeWidth="3" strokeLinecap="round" />
		</svg>
	)
}

function InstagramScene({ locale }: { locale: SiteLocale }) {
	const t = tr(locale)
	return (
		<Frame clock="15s" className="bg-[#fafafa]">
			<div className="flex grow flex-col gap-3 lg:flex-row">
				<div className="flex flex-col overflow-hidden rounded-2xl border border-vg-line bg-white lg:w-[46%]">
					<div className="flex items-center gap-2 p-2.5 text-[12.5px] font-bold">
						<span className="inline-flex size-7 items-center justify-center rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' }}><span className="size-full rounded-full border-2 border-white bg-[#efe3d2]" /></span>
						{t('shop.maryam', 'shop.maryam')}
					</div>
					<div className="relative flex h-28 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_25%,#fff8e9_0%,#f5d5b8_45%,#c98b70_100%)] lg:h-40">
						<Coat className="h-24 w-16 drop-shadow-[0_14px_22px_rgba(66,35,20,0.3)] lg:h-32 lg:w-24" />
						<span className="absolute bottom-2 end-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">{t('مانتو کتان · ۳ رنگ', 'Linen coat · 3 colours')}</span>
						<Heart className="vg-x1 absolute size-10 fill-white text-white drop-shadow" strokeWidth={1.5} />
					</div>
					<div className="flex flex-col gap-1.5 p-2.5 text-[12px] leading-[1.7]">
						<p className="vg-t0"><b>neda.r</b> {t('قیمت؟ 😍', 'Price? 😍')}</p>
						<p className="vg-t1 ps-4 text-vg-sub"><b className="text-vg-ink">shop.maryam</b> {t('دایرکت شد نِدا جان 💌', 'Sent to your DMs 💌')}</p>
						<p className="vg-t4"><b>sahar.m</b> {t('منم می‌خوام، سایز ۴۰', 'Me too, size 40')}</p>
						<p className="vg-t5 ps-4 text-vg-sub"><b className="text-vg-ink">shop.maryam</b> {t('دایرکت رو ببین 💜', 'Check your DMs 💜')}</p>
					</div>
				</div>
				<div className="flex grow flex-col gap-2 rounded-2xl border border-vg-line bg-white p-3">
					<div className="flex items-center gap-2 text-[12.5px] font-bold"><Send className="size-3.5 -rotate-12" strokeWidth={2} />{t('دایرکت · neda.r', 'DM · neda.r')}</div>
					<div className="vg-t2 max-w-[88%] self-end rounded-control rounded-se-[5px] bg-[linear-gradient(160deg,#8a3ffc,#3797f0)] ltr:self-start ltr:rounded-se-control ltr:rounded-ss-[5px] px-3 py-2 text-[12.5px] leading-[1.8] text-white">{t('سلام ندا جان 🌿 مانتو کتان ۱٬۲۸۰٬۰۰۰ تومنه؛ سایز ۳۶ تا ۴۲ موجوده.', 'Hi Neda 🌿 The linen coat is 1,280,000 toman, sizes 36–42 in stock.')}</div>
					<div className="vg-t3 flex w-[180px] items-center gap-2 self-end rounded-xl ltr:self-start border border-vg-line p-1.5">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f6ede2]"><Coat className="h-7 w-5" /></span>
						<span className="min-w-0"><span className="block truncate text-[11.5px] font-bold">{t('مانتو کتان کرم', 'Cream linen coat')}</span><span className="block text-[10.5px] text-vg-cap">{t('مشاهده و خرید', 'View & buy')}</span></span>
					</div>
					<div className="vg-t6 mt-2 flex items-center gap-2 rounded-xl bg-[#fdf2f8] px-2.5 py-2 text-[12px] text-[#9d174d]"><AtSign className="size-3.5 shrink-0" strokeWidth={2} />{t('@sara.k شما را در استوری منشن کرد', '@sara.k mentioned you in a story')}</div>
					<div className="vg-t7 max-w-[88%] self-end rounded-control rounded-se-[5px] bg-[linear-gradient(160deg,#8a3ffc,#3797f0)] ltr:self-start ltr:rounded-se-control ltr:rounded-ss-[5px] px-3 py-2 text-[12.5px] text-white">{t('مرسی از منشن 💜 کد تخفیف: VIG10', 'Thanks for the mention 💜 Code: VIG10')}</div>
				</div>
			</div>
			<div className="flex flex-wrap justify-center gap-1.5">
				<Chip step={1} tone="violet"><InstagramIcon className="size-3.5" />{t('کامنت ← دایرکت خودکار', 'Comment → auto DM')}</Chip>
				<Chip step={8}><Zap className="size-3.5" strokeWidth={2} />{t('سناریوی ثابت، بدون مصرف اعتبار', 'Fixed scenario, no credit used')}</Chip>
			</div>
		</Frame>
	)
}

/* ── Telegram: a bot with inline buttons tracking an order ── */

function TelegramScene({ locale }: { locale: SiteLocale }) {
	const t = tr(locale)
	const keys = [t('🛍 محصولات', '🛍 Products'), t('📦 پیگیری سفارش', '📦 Track order'), t('👤 پشتیبان', '👤 Support')]
	const dir = locale === 'fa' ? 'rtl' : 'ltr'
	const tgIn = 'max-w-[86%] self-start rounded-control rounded-tl-[4px] bg-white px-3 py-2 text-[12.5px] leading-[1.8] shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
	const tgOut = 'max-w-[86%] self-end rounded-control rounded-tr-[4px] bg-[#e3fbd3] px-3 py-2 text-[12.5px] leading-[1.8] shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
	return (
		<Frame clock="13s" className="gap-0 p-0 lg:p-0">
			<div className="flex items-center gap-2.5 border-b border-black/[0.06] bg-white px-4 py-3">
				<span className="inline-flex size-9 items-center justify-center rounded-full bg-[#2aabee] text-white"><Bot className="size-[18px]" strokeWidth={1.8} /></span>
				<div className="grow"><div className="text-[14px] font-bold">{t('فروشگاه ویجنت', 'Vigent Store')}</div><div className="text-[11.5px] text-[#2aabee]">{t('ربات', 'bot')}</div></div>
				<Send className="size-4 -rotate-12 text-[#2aabee]" strokeWidth={2} />
			</div>
			{/* Telegram never mirrors bubbles: the bot sits left, you sit right. */}
			<div dir="ltr" className="flex grow flex-col gap-2 bg-[#dfe8d5] p-3 lg:p-4" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' }}>
				<div dir={dir} className={cn(tgIn, 'vg-t0')}>{t('سلام! 👋 چطور کمکتون کنم؟', 'Hi! 👋 How can I help?')}</div>
				<div dir={dir} className="vg-t0 grid w-[86%] grid-cols-3 gap-1 self-start">
					{keys.map((key, i) => (
						<span key={key} className="relative rounded-lg bg-white/70 py-1.5 text-center text-[11px] font-medium text-[#1c6f9e] lg:text-[12px]">
							{key}
							{i === 1 ? <span className="vg-x1 absolute inset-0 rounded-lg bg-[#2aabee]/25" /> : null}
							{i === 1 ? <span className="vg-cur vg-cur-step" style={{ '--vg-cur-at': 1 } as CSSProperties}><i /></span> : null}
						</span>
					))}
				</div>
				<div dir={dir} className={cn(tgOut, 'vg-t2')}>{t('سفارش ۱۰۴۲', 'Order 1042')} <CheckCheck className="inline size-3.5 text-[#4fae4e]" strokeWidth={2} /></div>
				<div className="relative flex flex-col">
					<span dir={dir} className="vg-x3 absolute left-0 top-0 rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-[#1c6f9e]">{t('در حال نوشتن…', 'typing…')}</span>
					<div dir={dir} className={cn(tgIn, 'vg-t4 w-[250px]')}>
						<div className="flex items-center gap-1.5 font-bold"><Package className="size-3.5 text-[#2aabee]" strokeWidth={2} />{t('سفارش #۱۰۴۲', 'Order #1042')}</div>
						<div className="mt-2 flex items-center gap-1 text-[10.5px] text-vg-sub">
							<span className="text-[#16a34a]">{t('ثبت ✓', 'Placed ✓')}</span><span className="h-0.5 grow rounded bg-[#16a34a]" />
							<span className="text-[#16a34a]">{t('ارسال ✓', 'Shipped ✓')}</span><span className="h-0.5 grow rounded bg-black/10"><span className="vg-t5 block h-full w-1/2 rounded bg-[#2aabee]" /></span>
							<span>{t('تحویل', 'Delivery')}</span>
						</div>
						<div className="mt-1.5 flex items-center gap-1 text-[11.5px]"><Truck className="size-3.5 text-vg-cap" strokeWidth={2} />{t('فردا، ساعت ۱۰ تا ۱۴', 'Tomorrow, 10:00–14:00')}</div>
					</div>
				</div>
				<div dir={dir} className={cn(tgOut, 'vg-t6')}>{t('مرسی 🙏', 'Thanks 🙏')} <CheckCheck className="inline size-3.5 text-[#4fae4e]" strokeWidth={2} /></div>
				<div dir={dir} className={cn(tgIn, 'vg-t7')}>{t('خواهش می‌کنم! موقع تحویل هم خبرتون می‌کنم 🌿', 'You’re welcome! I’ll ping you at delivery 🌿')}</div>
			</div>
		</Frame>
	)
}

/* ── WooCommerce: a price change in the store reaches the chat in seconds ── */

function WooCommerceScene({ locale }: { locale: SiteLocale }) {
	const t = tr(locale)
	const rows = [
		{ name: t('کیف چرم قهوه‌ای', 'Brown leather bag'), old: t('۱٬۲۰۰٬۰۰۰', '1,200,000'), price: t('۱٬۰۵۰٬۰۰۰', '1,050,000'), stock: t('۲', '2') },
		{ name: t('کیف پول مردانه', 'Men’s wallet'), old: '', price: t('۴۹۰٬۰۰۰', '490,000'), stock: t('۱۴', '14') },
		{ name: t('کمربند چرم', 'Leather belt'), old: '', price: t('۶۲۰٬۰۰۰', '620,000'), stock: t('۷', '7') },
	]
	return (
		<Frame clock="14s">
			<div className="flex grow flex-col gap-3 lg:flex-row">
				<div className="flex flex-col gap-2 rounded-2xl border border-vg-line bg-[#f6f7f7] p-3 lg:w-[52%]">
					<div className="flex items-center gap-2 text-[12.5px] font-bold"><span className="inline-flex size-6 items-center justify-center rounded-md bg-[#7f54b3] text-[11px] text-white">W</span>{t('محصولات ووکامرس', 'WooCommerce products')}</div>
					<div className="overflow-hidden rounded-xl border border-vg-line bg-white text-[11.5px]">
						<div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-vg-line bg-vg-bg px-2.5 py-1.5 text-[11px] text-vg-cap"><span>{t('محصول', 'Product')}</span><span>{t('قیمت', 'Price')}</span><span>{t('موجودی', 'Stock')}</span></div>
						{rows.map((row, i) => (
							<div key={row.name} className={cn('relative grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2.5 py-2', i > 0 && 'border-t border-black/[0.05]')}>
								<span className="truncate">{row.name}</span>
								<span className="relative tabular-nums">
									{row.old ? (
										<>
											<span className="vg-x0 absolute end-0">{row.old}</span>
											<span className="vg-t1 font-bold text-vg-signal">{row.price}</span>
										</>
									) : row.price}
								</span>
								<span className="w-6 text-center tabular-nums">{row.stock}</span>
								{i === 0 ? <span className="vg-x1 absolute inset-0 bg-vg-tint/60" /> : null}
							</div>
						))}
					</div>
					<div className="vg-t8 flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-[11.5px]"><Package className="size-3.5 text-[#7f54b3]" strokeWidth={2} />{t('سفارش جدید #۲۲۸۱ · در حال پردازش', 'New order #2281 · processing')}</div>
				</div>
				<div className="flex items-center justify-center gap-2 lg:w-9 lg:flex-col">
					<span className="h-px w-8 bg-black/10 lg:h-10 lg:w-px" />
					<span className="inline-flex size-9 items-center justify-center rounded-full bg-vg-ink text-white"><RefreshCw className="vg-spin size-4" strokeWidth={2} /></span>
					<span className="h-px w-8 bg-black/10 lg:h-10 lg:w-px" />
				</div>
				<div className="flex grow flex-col gap-2 rounded-2xl bg-vg-bg p-3">
					<Chip step={2} tone="violet"><Plug className="size-3.5" strokeWidth={2} />{t('همگام شد · ۲ ثانیه پیش', 'Synced · 2 sec ago')}</Chip>
					<div className={cn(IN, 'vg-t3 bg-white')}>{t('کیف چرم قهوه‌ای چنده؟', 'How much is the brown leather bag?')}</div>
					<div className="relative flex flex-col">
						<Typing step={4} className="absolute end-0 top-0 ltr:end-auto ltr:start-0" />
						<div className={cn(OUT, 'vg-t5')}>{t('الان با تخفیف ۱٬۰۵۰٬۰۰۰ تومنه و فقط ۲ تا مونده 👌', 'It’s 1,050,000 toman on sale now, only 2 left 👌')}</div>
					</div>
					<div className="vg-t6 flex w-[200px] items-center gap-2 self-end rounded-xl ltr:self-start border border-vg-line bg-white p-1.5">
						<span className="size-9 shrink-0 rounded-lg bg-[linear-gradient(160deg,#a16207,#713f12)]" />
						<span className="min-w-0"><span className="block truncate text-[11.5px] font-bold">{rows[0].name}</span><span className="block text-[10.5px] text-vg-cap">{t('افزودن به سبد', 'Add to cart')}</span></span>
					</div>
					<div className={cn(IN, 'vg-t7 bg-white')}>{t('عالیه، ثبتش کن', 'Great, order it')}</div>
				</div>
			</div>
		</Frame>
	)
}

const SCENES: Record<string, (props: { locale: SiteLocale }) => ReactNode> = {
	'unified-inbox': UnifiedInboxScene,
	'persian-ai-chatbot': PersianChatbotScene,
	'ecommerce-ai': EcommerceScene,
	'customer-support-ai': SupportScene,
	instagram: InstagramScene,
	telegram: TelegramScene,
	woocommerce: WooCommerceScene,
}

export function SolutionScene({ slug, locale }: { slug: string; locale: SiteLocale }) {
	const Scene = SCENES[slug] ?? UnifiedInboxScene
	return <Scene locale={locale} />
}
