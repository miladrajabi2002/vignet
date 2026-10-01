'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import {
	Bookmark,
	Check,
	CircleDashed,
	Heart,
	Info,
	Link2,
	MessageCircle,
	Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { InstagramIcon } from '@/components/marketing/social-links'
import {
	IG_SENT_ROW,
	IgAvatar,
	IgBubble,
	IgDmScreen,
	IgIncoming,
	IgMeta,
	IgPhone,
	IgStatusBar,
	IgTimestamp,
	IgTypingDots,
	pt,
	useIgClock,
} from '@/components/instagram/ios-kit'
import { EASE_OUT } from './scroll'
import type { HomeLocale } from './types'

/* ------------------------------------------------------------------ */
/* Instagram direct simulator — faithful UI + fast AI reply loop      */
/* ------------------------------------------------------------------ */

type InstagramDemoMode = 'direct' | 'story' | 'comment'

const INSTAGRAM_SCENARIO_DELAYS: Record<InstagramDemoMode, readonly number[]> = {
	direct: [650, 1600, 650, 1400, 2000, 1100, 650, 1400, 1400, 1700, 1100, 650, 1400, 4800],
	story: [2000, 1600, 700, 1400, 1900, 1250, 650, 1400, 4800],
	comment: [1600, 650, 900, 1200, 1400, 2400, 1250, 650, 1400, 4800],
}

function InstagramAutomationScreen({ locale, step }: { locale: HomeLocale; step: number }) {
	const fa = locale === 'fa'
	const liked = step >= 1
	const commentText = fa ? 'لینک خرید این مدل رو می‌فرستین؟' : 'Can you send the checkout link for this one?'
	const typedComment = useInstagramTypedText(commentText, step === 0)
	return (
		<div className="flex h-full min-h-0 flex-col bg-white text-black" dir="ltr" style={{ paddingTop: pt(54) }}>
			<div className="flex h-[52px] shrink-0 items-center border-b border-black/[0.08] px-2.5">
				<InstagramIcon className="h-5 w-5" aria-hidden />
				<p className="ms-2 text-[12px] font-semibold">vigent.store</p>
				<span className="ms-auto grid h-10 w-10 place-items-center" aria-hidden><Info className="h-5 w-5" /></span>
			</div>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div className="flex items-center gap-2.5 px-3 py-2">
					<span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 text-[9px] font-bold text-white">V</span>
					<p className="text-[11.5px] font-semibold">vigent.store</p>
					<span className="ms-auto text-[15px] tracking-[2px]">•••</span>
				</div>
				<div className="relative grid aspect-square max-h-[250px] w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_25%,#fff8e9_0%,#f5d5b8_40%,#c98b70_100%)]">
					<CoatArt tone="black" className="absolute h-36 w-24 -translate-x-10 rotate-[-6deg] drop-shadow-[0_18px_30px_rgba(66,35,20,0.3)]" />
					<CoatArt className="relative h-40 w-28 translate-x-6 rotate-[4deg] drop-shadow-[0_22px_40px_rgba(66,35,20,0.3)]" />
					<span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur"><bdi>{fa ? '۳ رنگ موجود' : '3 colors'}</bdi></span>
				</div>
				<div className="flex items-center gap-3 px-3 py-2">
					<Heart className={cn('h-[22px] w-[22px] transition-colors duration-200', liked ? 'fill-[#ff3040] text-[#ff3040]' : 'text-black')} aria-hidden />
					<MessageCircle className="h-[22px] w-[22px] -scale-x-100" aria-hidden />
					<Send className="h-[21px] w-[21px]" aria-hidden />
					<Bookmark className="ms-auto h-[21px] w-[21px]" aria-hidden />
				</div>
				<p className="px-3 text-[10.5px] font-semibold">1,248 likes</p>
				<p className="mt-1 px-3 text-[10.5px] leading-5"><span className="font-semibold">vigent.store</span> <bdi>{fa ? 'مانتو کتان در دو رنگ کرم و مشکی. برای لینک خرید کامنت بذار.' : 'Linen coat in cream and black. Comment for the checkout link.'}</bdi></p>
				<div className="mt-2 border-t border-black/[0.08] px-3 pt-2">
					<AnimatePresence mode="wait" initial={false}>
						{step === 0 ? (
							<m.div
								key="comment-draft"
								initial={{ opacity: 0, transform: 'translateY(6px)' }}
								animate={{ opacity: 1, transform: 'translateY(0px)' }}
								exit={{ opacity: 0, transform: 'translateY(-3px) scale(0.985)' }}
								transition={{ duration: 0.2, ease: EASE_OUT }}
								className="flex h-9 items-center gap-2 rounded-full border border-black/15 bg-black/[0.02] px-2"
								aria-label={fa ? 'مشتری در حال نوشتن کامنت است' : 'The customer is typing a comment'}
							>
								<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black/10 text-[8px] font-semibold">M</span>
								<span dir={fa ? 'rtl' : 'ltr'} className="flex min-w-0 flex-1 items-center text-[10px] text-black/85">
									<bdi className="truncate">{typedComment}</bdi>
									<InstagramTypingCaret />
								</span>
								<span className="shrink-0 text-[9px] font-semibold text-[#0095f6]">Post</span>
							</m.div>
						) : (
							<m.p key="sent-comment" initial={{ opacity: 0.2, transform: 'translate3d(7px, 8px, 0) scale(0.98)' }} animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }} transition={{ type: 'spring', duration: 0.42, bounce: 0 }} className="text-[11px] leading-5">
								<span className="font-semibold">maryam.karimi</span> <bdi>{commentText}</bdi>
							</m.p>
						)}
					</AnimatePresence>
					<AnimatePresence initial={false}>
						{step >= 2 ? (
							<m.p initial={{ opacity: 0, transform: 'translateY(5px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={{ duration: 0.2, ease: EASE_OUT }} className="mt-1.5 text-[10.5px] leading-5 text-black/70">
								<span className="font-semibold text-black">vigent.store</span> <bdi>{fa ? 'دایرکتت رو چک کن مریم جان 💌' : 'Check your DMs, Maryam 💌'}</bdi>
							</m.p>
						) : null}
					</AnimatePresence>
					{step >= 3 ? <m.span initial={{ opacity: 0, transform: 'translateY(4px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[8.5px] font-semibold text-emerald-700"><Check className="h-3 w-3" aria-hidden /><bdi>{fa ? 'دایرکت با موفقیت ارسال شد' : 'DM sent successfully'}</bdi></m.span> : null}
				</div>
			</div>
		</div>
	)
}

/**
 * A drawn linen coat (collar, lapels, buttons, belt) so the product cards,
 * the post and the story show an actual garment instead of a bag icon.
 */
function CoatArt({ tone = 'cream', className }: { tone?: 'cream' | 'black'; className?: string }) {
	const body = tone === 'cream' ? '#efe3d2' : '#2b2b2e'
	const shade = tone === 'cream' ? '#d9c6ad' : '#18181a'
	const line = tone === 'cream' ? '#bca487' : '#45454a'
	return (
		<svg viewBox="0 0 80 110" aria-hidden className={className}>
			<path d="M26 8 L40 16 L54 8 L68 18 L74 58 L64 60 L62 34 L64 104 L16 104 L18 34 L16 60 L6 58 L12 18 Z" fill={body} />
			<path d="M40 16 L40 104" stroke={line} strokeWidth="1.2" />
			<path d="M26 8 L40 16 L33 40 Z M54 8 L40 16 L47 40 Z" fill={shade} />
			<path d="M18 62 L62 62" stroke={line} strokeWidth="3" strokeLinecap="round" />
			<circle cx="44" cy="48" r="1.6" fill={line} />
			<circle cx="44" cy="76" r="1.6" fill={line} />
			<circle cx="44" cy="90" r="1.6" fill={line} />
		</svg>
	)
}

const STORE_AVATAR_BG = 'linear-gradient(135deg,#d8b48f,#8a6446)'

function StoreAvatar({ size, ring }: { size: number; ring?: 'hairline' }) {
	return <IgAvatar size={size} ring={ring} label="V" background={STORE_AVATAR_BG} />
}

function InstagramTyping({ fa }: { fa: boolean }) {
	return (
		<m.div
			layout
			initial={{ opacity: 0, transform: 'translateY(8px) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
			exit={{ opacity: 0, transform: 'translateY(-2px) scale(0.94)' }}
			transition={{ duration: 0.24, ease: EASE_OUT, layout: { duration: 0.32, ease: EASE_OUT } }}
			className="flex shrink-0"
			aria-label={fa ? 'فروشگاه در حال نوشتن پاسخ است' : 'The store is typing a reply'}
		>
			<IgIncoming avatar={<StoreAvatar size={28} />}>
				<IgBubble side="in">
					<IgTypingDots />
				</IgBubble>
			</IgIncoming>
		</m.div>
	)
}

/**
 * One animated bubble. `nested` bubbles live inside another row (the incoming
 * group, the story-reply card) — that row owns the sent-colour tone.
 */
function InstagramMessage({
	fa,
	children,
	sent = false,
	nested = false,
	className,
	delay = 0,
}: {
	fa: boolean
	children: ReactNode
	sent?: boolean
	nested?: boolean
	className?: string
	delay?: number
}) {
	const entranceDelay = delay + (sent ? 0.08 : 0)
	return (
		<m.div
			layout
			initial={{ opacity: sent ? 0.2 : 0, transform: sent ? 'translate3d(10px, 18px, 0) scale(0.965)' : 'translate3d(0, 14px, 0) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }}
			exit={{ opacity: 0, transform: sent ? 'translate3d(5px, -3px, 0) scale(0.97)' : 'translate3d(0, -4px, 0) scale(0.94)' }}
			transition={{
				opacity: { duration: sent ? 0.2 : 0.4, delay: entranceDelay, ease: EASE_OUT },
				transform: sent
					? { type: 'spring', duration: 0.46, bounce: 0, delay: entranceDelay }
					: { duration: 0.4, delay: entranceDelay, ease: EASE_OUT },
				layout: { type: 'spring', duration: 0.42, bounce: 0 },
			}}
			style={{ transformOrigin: sent ? 'right bottom' : 'left bottom' }}
			className={cn('flex min-w-0 shrink-0', sent ? 'ml-auto justify-end' : 'max-w-full', sent && !nested && cn('max-w-[76%]', IG_SENT_ROW), className)}
		>
			<IgBubble side={sent ? 'out' : 'in'} dir={fa ? 'rtl' : 'ltr'}>
				{children}
			</IgBubble>
		</m.div>
	)
}

function InstagramIncomingReply({
	fa,
	typing,
	visible,
	children,
}: {
	fa: boolean
	typing: boolean
	visible: boolean
	children: ReactNode
}) {
	return (
		<AnimatePresence mode="wait" initial={false}>
			{typing ? (
				<InstagramTyping key="typing" fa={fa} />
			) : visible ? (
				<m.div key="reply" layout="position" className="flex shrink-0">
					<IgIncoming avatar={<StoreAvatar size={28} />}>
						<InstagramMessage fa={fa} nested delay={0.05}>
							{children}
						</InstagramMessage>
					</IgIncoming>
				</m.div>
			) : null}
		</AnimatePresence>
	)
}

function InstagramSeen() {
	return (
		<m.div
			layout="position"
			initial={{ opacity: 0, transform: 'translateY(3px)' }}
			animate={{ opacity: 1, transform: 'translateY(0px)' }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2, ease: EASE_OUT }}
			className="shrink-0"
		>
			<IgMeta>Seen just now</IgMeta>
		</m.div>
	)
}

/** Small product line inside a reply bubble (hold / checkout confirmations). */
function InstagramInlineProduct({ title, meta }: { title: string; meta: string }) {
	return (
		<div className="mt-2 flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-black/[0.05]">
			<span className="grid h-9 w-8 shrink-0 place-items-center rounded-lg bg-[#f6ede2]"><CoatArt className="h-7 w-5" /></span>
			<div className="min-w-0 flex-1 leading-snug">
				<p className="font-semibold" style={{ fontSize: pt(12.5) }}>{title}</p>
				<p className="text-black/50" style={{ fontSize: pt(11) }}>{meta}</p>
			</div>
		</div>
	)
}

function InstagramStoryReplyCard({ locale }: { locale: HomeLocale }) {
	const fa = locale === 'fa'
	return (
		<m.div
			layout="position"
			initial={{ opacity: 0, transform: 'translateY(14px) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
			transition={{ duration: 0.4, ease: EASE_OUT }}
			className={cn('ml-auto flex w-[76%] shrink-0 flex-col items-end', IG_SENT_ROW)}
			style={{ gap: pt(3) }}
		>
			<IgMeta>You replied to their story</IgMeta>
			<div className="relative h-[112px] w-[70px] overflow-hidden rounded-control bg-[radial-gradient(circle_at_28%_16%,#f8dfc7_0%,#b9816d_42%,#4b3039_78%,#181018_100%)] text-white shadow-[0_8px_20px_rgba(0,0,0,0.14)] ring-1 ring-black/10">
				<div className="absolute inset-x-1.5 top-1.5 flex items-center gap-1 text-[5.5px] font-semibold"><span className="grid h-2.5 w-2.5 place-items-center rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 text-[4px]">V</span>vigent.store</div>
				<CoatArt className="absolute bottom-6 left-1/2 h-14 w-10 -translate-x-1/2 drop-shadow" />
				<span className="absolute inset-x-1 bottom-1.5 rounded-full bg-black/55 px-1 py-0.5 text-center text-[5.5px] font-semibold">{fa ? 'مانتو کتان کرم' : 'Cream linen coat'}</span>
			</div>
			<InstagramMessage fa={fa} sent nested className="max-w-full">
				{fa ? 'این رنگ کرمش هنوز موجوده؟' : 'Is this cream color still available?'}
			</InstagramMessage>
		</m.div>
	)
}

function InstagramProductCatalog({ locale, compact = false }: { locale: HomeLocale; compact?: boolean }) {
	const fa = locale === 'fa'
	const products = [
		{ name: fa ? 'مانتو کتان کرم' : 'Cream linen coat', meta: fa ? 'سایز ۳۶ تا ۴۲' : 'Sizes 36–42', price: fa ? '۱٬۲۸۰٬۰۰۰ تومان' : '1,280,000 tomans', colors: 'from-[#f6ede2] to-[#dcc6ad]', tone: 'cream' as const },
		{ name: fa ? 'مانتو کتان مشکی' : 'Black linen coat', meta: fa ? 'سایز ۳۸ تا ۴۴' : 'Sizes 38–44', price: fa ? '۱٬۳۵۰٬۰۰۰ تومان' : '1,350,000 tomans', colors: 'from-[#d9d6d2] to-[#a8a39c]', tone: 'black' as const },
	]
	return (
		<m.div
			layout="position"
			initial={{ opacity: 0, transform: 'translateY(14px) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
			transition={{ duration: 0.4, ease: EASE_OUT, layout: { duration: 0.36, ease: EASE_OUT } }}
			className="flex w-[84%] shrink-0 gap-2 overflow-hidden"
			style={{ marginLeft: pt(38) }}
			aria-label={fa ? 'کاتالوگ محصولات پیشنهادی' : 'Suggested product catalog'}
		>
			{products.map((product) => (
				<div key={product.name} dir={fa ? 'rtl' : 'ltr'} className={cn('min-w-0 flex-1 overflow-hidden rounded-2xl border border-black/10 bg-white', compact && 'first:flex-[1.12] last:flex-[0.88]')}>
					<div className={cn('relative grid place-items-center bg-gradient-to-br', product.colors, compact ? 'h-[70px]' : 'h-[82px]')}>
						<CoatArt tone={product.tone} className={cn('drop-shadow-[0_8px_14px_rgba(0,0,0,0.25)]', compact ? 'h-[60px] w-11' : 'h-[70px] w-12')} />
						<span className="absolute end-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[7px] font-semibold text-white backdrop-blur">{fa ? 'موجود' : 'In stock'}</span>
					</div>
					<div className="p-2">
						<p className="truncate text-[9px] font-semibold text-black">{product.name}</p>
						<p className="mt-0.5 truncate text-[7.5px] text-black/50">{product.meta}</p>
						<p className="mt-1 text-[8px] font-semibold text-black/80">{product.price}</p>
						<span className="mt-1.5 grid h-6 place-items-center rounded-lg bg-[#efeff3] text-[7.5px] font-bold text-black">{fa ? 'مشاهده محصول' : 'View product'}</span>
					</div>
				</div>
			))}
		</m.div>
	)
}

function InstagramStoryViewer({ locale, step }: { locale: HomeLocale; step: number }) {
	const fa = locale === 'fa'
	const storyReply = fa ? 'این رنگ کرمش هنوز موجوده؟' : 'Is this cream color still available?'
	const typing = step === 1
	const typedStoryReply = useInstagramTypedText(storyReply, typing)
	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_30%_18%,#f8dfc7_0%,#b9816d_38%,#4b3039_72%,#181018_100%)] text-white" dir="ltr" style={{ paddingTop: pt(50) }}>
			<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34),transparent_28%,transparent_68%,rgba(0,0,0,0.55))]" />
			<div className="relative z-10 px-3 pt-2">
				<div className="flex gap-1" aria-hidden>
					<span className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/35"><m.span className="block h-full origin-left bg-white" initial={{ transform: 'scaleX(0)' }} animate={{ transform: 'scaleX(1)' }} transition={{ duration: 3.5, ease: 'linear' }} /></span>
					<span className="h-[2px] flex-1 rounded-full bg-white/35" />
					<span className="h-[2px] flex-1 rounded-full bg-white/35" />
				</div>
				<div className="mt-2 flex items-center gap-2">
					<span className="grid h-8 w-8 place-items-center rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' }}>
						<span className="grid h-full w-full place-items-center rounded-full bg-[#1b1118] text-[9px] font-bold">V</span>
					</span>
					<p className="text-[10.5px] font-semibold">vigent.store</p>
					<span className="text-[8px] text-white/65">2h</span>
					<span className="ms-auto grid h-8 w-8 place-items-center text-[18px] tracking-[2px]" aria-hidden>•••</span>
				</div>
			</div>

			<div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center">
				<m.div initial={{ opacity: 0, transform: 'translateY(10px) rotate(-5deg)' }} animate={{ opacity: 1, transform: 'translateY(0px) rotate(-5deg)' }} transition={{ duration: 0.35, ease: EASE_OUT }} className="relative h-52 w-40 rounded-sheet border border-white/20 bg-[#eadac8]/80 shadow-[0_32px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
					<CoatArt className="absolute left-1/2 top-5 h-36 w-24 -translate-x-1/2 drop-shadow-[0_16px_28px_rgba(66,35,20,0.3)]" />
					<span className="absolute inset-x-3 bottom-4 rounded-full bg-black/60 px-3 py-1.5 text-[9px] font-semibold backdrop-blur">{fa ? 'مانتو کتان · رنگ کرم' : 'Linen coat · Cream'}</span>
				</m.div>
				<p className="mt-5 text-[18px] font-bold drop-shadow">{fa ? 'رنگ محبوب دوباره موجود شد' : 'Your favorite color is back'}</p>
				<p className="mt-1 text-[10px] text-white/75">{fa ? 'برای قیمت و سایز، همین استوری رو ریپلای کن' : 'Reply for price and available sizes'}</p>
				<span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[9px] font-bold text-black"><Link2 className="h-3 w-3" aria-hidden />{fa ? 'مشاهده محصول' : 'View product'}</span>
			</div>

			{/* Reply bar like the app: the field on its own, like + share outside it.
			    While typing, like/share fold away and «Send» appears in the field. */}
			<div className="relative z-10 flex shrink-0 items-center px-3 pb-4">
				<m.div
					initial={{ borderColor: 'rgba(255,255,255,0.35)' }}
					animate={{ borderColor: typing ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}
					transition={{ duration: 0.2 }}
					className="flex h-11 min-w-0 flex-1 items-center rounded-full border bg-black/15 pe-1.5 ps-4 backdrop-blur-sm"
					aria-label={typing ? (fa ? 'مشتری در حال نوشتن ریپلای استوری است' : 'The customer is typing a story reply') : undefined}
				>
					<span dir={typing && fa ? 'rtl' : 'ltr'} className="flex min-w-0 flex-1 items-center overflow-hidden text-start text-[10.5px] text-white/75">
						{typing ? <><bdi className="truncate">{typedStoryReply}</bdi><InstagramTypingCaret /></> : 'Send message'}
					</span>
					<AnimatePresence initial={false}>
						{typing && typedStoryReply ? (
							<m.span
								key="send"
								initial={{ opacity: 0, transform: 'scale(0.9)' }}
								animate={{ opacity: 1, transform: 'scale(1)' }}
								exit={{ opacity: 0, transform: 'scale(0.9)' }}
								transition={{ duration: 0.18, ease: EASE_OUT }}
								className="ms-2 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
								aria-hidden
							>
								Send
							</m.span>
						) : null}
					</AnimatePresence>
				</m.div>
				<m.span
					initial={false}
					animate={{ width: typing ? 0 : 'auto', opacity: typing ? 0 : 1 }}
					transition={{ duration: 0.22, ease: EASE_OUT }}
					className="flex shrink-0 items-center gap-4 overflow-hidden"
					aria-hidden
				>
					<Heart className="ms-4 h-[22px] w-[22px] shrink-0" strokeWidth={1.8} />
					<Send className="h-[21px] w-[21px] shrink-0" strokeWidth={1.8} />
				</m.span>
			</div>
		</div>
	)
}

function useInstagramTypedText(text: string | null, active: boolean) {
	const reduce = useReducedMotion()
	const [typedText, setTypedText] = useState('')

	useEffect(() => {
		if (!text || !active) {
			setTypedText('')
			return
		}

		const characters = Array.from(text)
		if (reduce) {
			setTypedText(text)
			return
		}

		let characterIndex = 0
		let typingTimer: number | undefined
		setTypedText('')
		const characterDelay = Math.max(28, Math.min(56, Math.round(1100 / characters.length)))
		const startTimer = window.setTimeout(() => {
			typingTimer = window.setInterval(() => {
				characterIndex += 1
				setTypedText(characters.slice(0, characterIndex).join(''))
				if (characterIndex >= characters.length && typingTimer !== undefined) window.clearInterval(typingTimer)
			}, characterDelay)
		}, 90)

		return () => {
			window.clearTimeout(startTimer)
			if (typingTimer !== undefined) window.clearInterval(typingTimer)
		}
	}, [active, reduce, text])

	return typedText
}

function InstagramTypingCaret() {
	return (
		<m.span
			aria-hidden
			className="mx-0.5 h-3.5 w-px shrink-0 bg-[#5a50f5]"
			animate={{ opacity: [1, 1, 0, 0] }}
			transition={{ duration: 0.8, times: [0, 0.45, 0.5, 1], repeat: Infinity, ease: 'linear' }}
		/>
	)
}

function InstagramConversationScreen({ locale, mode, step }: { locale: HomeLocale; mode: InstagramDemoMode; step: number }) {
	const fa = locale === 'fa'
	const directQuestion = fa ? 'سلام، اون مانتو کتان کرم سایز ۳۸ هست؟' : 'Hi, is that cream linen coat available in size 38?'
	const directFollowUp = fa ? 'آره بفرست، مقایسه کنم 🙏' : 'Yes please, let me compare.'
	const directOrder = fa ? 'همون کرم ۳۸ رو برمی‌دارم' : 'I’ll take the cream one in 38.'
	const storyFollowUp = fa ? 'قدم ۱۶۵ـه، ۳۸ اندازه‌م می‌شه؟ ارسال تهران چند روزه؟' : 'I’m 165 cm — will a 38 fit? How long is delivery to Tehran?'
	const commentFollowUp = fa ? 'کرمش سایز ۳۸ موجوده؟' : 'Is cream available in size 38?'
	const customerDraft = mode === 'direct'
		? step === 1
			? { id: 'direct-question', text: directQuestion }
			: step === 5
				? { id: 'direct-follow-up', text: directFollowUp }
				: step === 10
					? { id: 'direct-order', text: directOrder }
					: null
		: mode === 'story' && step === 3
			? { id: 'story-follow-up', text: storyFollowUp }
			: mode === 'comment' && step === 2
				? { id: 'comment-follow-up', text: commentFollowUp }
				: null
	const typedDraft = useInstagramTypedText(customerDraft?.text ?? null, Boolean(customerDraft))
	const time = useIgClock()

	return (
		<IgDmScreen
			anchor="bottom"
			topInset={54}
			live
			header={{
				name: 'Vigent Store',
				subtitle: 'Active now',
				avatar: <StoreAvatar size={36} ring="hairline" />,
			}}
			composer={{
				placeholder: 'Message...',
				draft: customerDraft ? (
					<span
						dir={fa ? 'rtl' : 'ltr'}
						className="flex min-w-0 items-center"
						aria-label={fa ? 'مشتری در حال نوشتن پیام است' : 'The customer is typing a message'}
					>
						<bdi className="truncate">{typedDraft}</bdi>
						<InstagramTypingCaret />
					</span>
				) : undefined,
			}}
		>
			<IgTimestamp>Today {time}</IgTimestamp>
			{mode === 'direct' ? (
				<>
					{step >= 2 ? <InstagramMessage fa={fa} sent>{directQuestion}</InstagramMessage> : null}
					<AnimatePresence initial={false}>{step === 3 ? <InstagramSeen key="direct-seen-one" /> : null}</AnimatePresence>
					<InstagramIncomingReply fa={fa} typing={step === 3} visible={step >= 4}>
						{fa ? 'سلام، وقتت بخیر 🌿 بله، کرم سایز ۳۸ موجوده. کتانش خنکه و قدش ۱۱۸ سانت؛ قیمتش ۱٬۲۸۰٬۰۰۰ تومنه. مشکی‌ش رو هم بفرستم؟' : 'Hi, good evening 🌿 Yes, cream in 38 is in stock. It’s breathable linen, 118 cm long, 1,280,000 tomans. Shall I send the black one too?'}
					</InstagramIncomingReply>
					{step >= 6 ? <InstagramMessage fa={fa} sent>{directFollowUp}</InstagramMessage> : null}
					<AnimatePresence initial={false}>{step === 7 ? <InstagramSeen key="direct-seen-two" /> : null}</AnimatePresence>
					<InstagramIncomingReply fa={fa} typing={step === 7} visible={step >= 8}>
						{fa ? 'این دو تا الان موجودن 👇 قیمت و سایزها روی کارت‌ها هست.' : 'Both are in stock right now 👇 prices and sizes are on the cards.'}
					</InstagramIncomingReply>
					{step >= 9 ? <InstagramProductCatalog locale={locale} compact /> : null}
					{step >= 11 ? <InstagramMessage fa={fa} sent>{directOrder}</InstagramMessage> : null}
					<AnimatePresence initial={false}>{step === 12 ? <InstagramSeen key="direct-seen-three" /> : null}</AnimatePresence>
					<InstagramIncomingReply fa={fa} typing={step === 12} visible={step >= 13}>
						<>
							{fa ? 'عالیه! یکی از کرم ۳۸ برات کنار گذاشتم. این لینک پرداخته؛ ارسال تهران فردا انجام می‌شه 👇' : 'Great choice! I’ve set one cream 38 aside for you. Here’s the payment link — Tehran delivery is tomorrow 👇'}
							<InstagramInlineProduct
								title={fa ? 'مانتو کتان کرم · سایز ۳۸' : 'Cream linen coat · Size 38'}
								meta={fa ? '۱٬۲۸۰٬۰۰۰ تومان · پرداخت آنلاین' : '1,280,000 tomans · Checkout'}
							/>
						</>
					</InstagramIncomingReply>
				</>
			) : mode === 'story' ? (
				<>
					<InstagramStoryReplyCard locale={locale} />
					<AnimatePresence initial={false}>{step === 1 ? <InstagramSeen key="story-seen-one" /> : null}</AnimatePresence>
					<InstagramIncomingReply fa={fa} typing={step === 1} visible={step >= 2}>
						{fa ? 'بله، رنگ کرم موجوده؛ سایزهای ۳۶ تا ۴۲ داریم. قد کار ۱۱۸ سانته.' : 'Yes, cream is available in sizes 36–42. The coat length is 118 cm.'}
					</InstagramIncomingReply>
					{step >= 4 ? <InstagramMessage fa={fa} sent>{storyFollowUp}</InstagramMessage> : null}
					<AnimatePresence initial={false}>{step === 5 ? <InstagramSeen key="story-seen-two" /> : null}</AnimatePresence>
					<InstagramIncomingReply fa={fa} typing={step === 5} visible={step >= 6}>
						<>
							{fa ? 'برای قد ۱۶۵ همون ۳۸ اندازه‌ست و قدش تا پایین زانو می‌رسه. ارسال تهران یک‌روزه‌ست؛ کارت محصول رو برات گذاشتم.' : 'At 165 cm a 38 is right — it falls just below the knee. Tehran delivery takes one day; here’s the product card.'}
							<InstagramInlineProduct
								title={fa ? 'مانتو کتان کرم' : 'Cream linen coat'}
								meta={fa ? 'سایز ۳۸ · موجود' : 'Size 38 · In stock'}
							/>
						</>
					</InstagramIncomingReply>
				</>
			) : (
				<>
					<m.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="mx-auto mb-1 shrink-0 rounded-full bg-black/[0.04] text-black/55"
						style={{ fontSize: pt(12), padding: `${pt(5)} ${pt(12)}` }}
					>
						Replied privately to your comment
					</m.p>
					<InstagramIncomingReply fa={fa} typing={step === 0} visible={step >= 1}>
						{fa ? 'سلام مریم جان 🌿 این مدل در دو رنگ کرم و مشکی موجوده؛ کارت‌هاش رو برات فرستادم.' : 'Hi Maryam 🌿 This style comes in cream and black — here are the product cards.'}
					</InstagramIncomingReply>
					{step >= 1 ? <InstagramProductCatalog locale={locale} compact /> : null}
					{step >= 3 ? <InstagramMessage fa={fa} sent>{commentFollowUp}</InstagramMessage> : null}
					<AnimatePresence initial={false}>{step === 4 ? <InstagramSeen key="comment-seen" /> : null}</AnimatePresence>
					<InstagramIncomingReply fa={fa} typing={step === 4} visible={step >= 5}>
						{fa ? 'بله موجوده. ۱۰ دقیقه برات نگهش می‌دارم؛ از «مشاهده محصول» خریدت رو کامل کن.' : 'Yes, it’s in stock. I’ll hold it for 10 minutes — finish checkout from “View product”.'}
					</InstagramIncomingReply>
				</>
			)}
		</IgDmScreen>
	)
}

export function InstagramMock({ locale, inverse = true, className, active = true }: { locale: HomeLocale; inverse?: boolean; className?: string; active?: boolean }) {
	const fa = locale === 'fa'
	const reduce = useReducedMotion()
	const [mode, setMode] = useState<InstagramDemoMode>('direct')
	const [step, setStep] = useState(reduce ? INSTAGRAM_SCENARIO_DELAYS.direct.length - 1 : 0)
	const scenarioOrder: InstagramDemoMode[] = ['direct', 'story', 'comment']

	useEffect(() => {
		if (!active) return
		setMode('direct')
		setStep(reduce ? INSTAGRAM_SCENARIO_DELAYS.direct.length - 1 : 0)
	}, [active, reduce])

	useEffect(() => {
		if (!active) return
		if (reduce) {
			setStep(INSTAGRAM_SCENARIO_DELAYS[mode].length - 1)
		} else {
			setStep(0)
		}
	}, [active, mode, reduce])

	useEffect(() => {
		if (!active || reduce) return
		const delays = INSTAGRAM_SCENARIO_DELAYS[mode]
		const delay = delays[step] ?? 2200
		const timer = window.setTimeout(() => {
			if (step >= delays.length - 1) {
				const currentIndex = scenarioOrder.indexOf(mode)
				setMode(scenarioOrder[(currentIndex + 1) % scenarioOrder.length])
				setStep(0)
				return
			}
			setStep((current) => current + 1)
		}, delay)
		return () => window.clearTimeout(timer)
		// scenarioOrder is intentionally static for this deterministic demo.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active, mode, reduce, step])

	const scenarios = [
		{
			id: 'direct' as const,
			Icon: Send,
			label: fa ? 'دایرکت هوشمند' : 'Smart DM',
			detail: fa ? 'سؤال دربارهٔ محصول، جواب از موجودی واقعی' : 'Product question, answered from live stock',
		},
		{
			id: 'story' as const,
			Icon: CircleDashed,
			label: fa ? 'ریپلای استوری' : 'Story reply',
			detail: fa ? 'استوری را می‌شناسد و مرتبط جواب می‌دهد' : 'Knows the story, replies in context',
		},
		{
			id: 'comment' as const,
			Icon: MessageCircle,
			label: fa ? 'کامنت به دایرکت' : 'Comment to DM',
			detail: fa ? 'جواب کوتاه زیر پست، ادامه در دایرکت' : 'Short public reply, the rest in DM',
		},
	]
	const activeScenario = scenarios[scenarios.findIndex((scenario) => scenario.id === mode)]
	const showStoryViewer = mode === 'story' && step < 2
	const showCommentFeed = mode === 'comment' && step < 4
	const conversationStep = mode === 'story' ? Math.max(0, step - 2) : mode === 'comment' ? Math.max(0, step - 4) : step
	const renderScenarioScreen = () => {
		if (showStoryViewer) return <InstagramStoryViewer locale={locale} step={step} />
		if (showCommentFeed) return <InstagramAutomationScreen locale={locale} step={step} />
		return <InstagramConversationScreen locale={locale} mode={mode} step={conversationStep} />
	}
	const tabLabel = fa ? 'سناریوهای اینستاگرام' : 'Instagram scenarios'

	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'relative',
				inverse ? 'text-white' : 'text-black',
				className,
			)}
		>
			<div className="grid items-center justify-center gap-4 md:grid-cols-[minmax(300px,370px)_minmax(210px,250px)] md:gap-7">
				<IgPhone tone={showStoryViewer ? 'dark' : 'light'} className="max-w-[260px] sm:max-w-[320px]">
					<div className="relative min-h-0 flex-1 overflow-hidden">
						<IgStatusBar tone={showStoryViewer ? 'dark' : 'light'} overlay />
						<AnimatePresence mode="wait" initial={false}>
							<m.div
								key={showStoryViewer ? 'story-viewer' : showCommentFeed ? 'comment-feed' : `${mode}-conversation`}
								initial={reduce ? false : { opacity: 0, transform: 'translateX(8px) scale(0.99)' }}
								animate={{ opacity: 1, transform: 'translateX(0px) scale(1)' }}
								exit={reduce ? undefined : { opacity: 0, transform: 'translateX(-6px) scale(0.99)' }}
								transition={{ duration: 0.22, ease: EASE_OUT }}
								className="h-full"
							>
								{renderScenarioScreen()}
							</m.div>
						</AnimatePresence>
					</div>
				</IgPhone>

				<div>
					<p className="sr-only" aria-live="polite">{activeScenario.label}</p>

					{/* Mobile: icon tabs + the active scenario's one-line story */}
					<div className="md:hidden">
						<div
							className={cn('grid grid-cols-3 gap-1 rounded-2xl border p-1', inverse ? 'border-white/10 bg-white/[0.045]' : 'border-black/10 bg-black/[0.04]')}
							role="tablist"
							aria-label={tabLabel}
						>
							{scenarios.map(({ id, Icon, label }) => {
								const selected = mode === id
								return (
									<button
										key={id}
										type="button"
										role="tab"
										aria-selected={selected}
										onClick={() => setMode(id)}
										className={cn(
											'relative flex min-h-[58px] touch-manipulation flex-col items-center justify-center gap-1 overflow-hidden rounded-xl px-1.5 text-[11.5px] font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aa99ec]',
											selected
												? inverse
													? 'bg-white text-black shadow-[0_5px_16px_rgba(0,0,0,0.24)]'
													: 'bg-black text-white shadow-[0_5px_16px_rgba(0,0,0,0.15)]'
												: inverse
													? 'text-white/65'
													: 'text-black/60',
										)}
									>
										<Icon className="size-4" strokeWidth={2} aria-hidden />
										{label}
										{selected ? (
											<ScenarioProgress mode={mode} step={step} reduce={Boolean(reduce)} fa={fa} className="absolute inset-x-3 bottom-1 h-[2px] bg-black/10" />
										) : null}
									</button>
								)
							})}
						</div>
						<p className={cn('mt-2.5 text-center text-[12.5px] leading-5', inverse ? 'text-white/60' : 'text-black/60')}>
							{activeScenario.detail}
						</p>
					</div>

					{/* Desktop: one card per scenario; the active one fills as it plays */}
					<div className="hidden md:block">
						<p className={cn('mb-3 ps-1 text-[12px] font-medium', inverse ? 'text-white/45' : 'text-black/45')}>
							{fa ? 'سه سناریوی نمونه · برای دیدن هرکدام بزنید' : 'Three sample flows · click to watch one'}
						</p>
						<div className="space-y-2" role="tablist" aria-label={tabLabel} aria-orientation="vertical">
							{scenarios.map(({ id, Icon, label, detail }) => {
								const selected = mode === id
								return (
									<button
										key={id}
										type="button"
										role="tab"
										aria-selected={selected}
										onClick={() => setMode(id)}
										className={cn(
											'relative flex w-full touch-manipulation items-center gap-3 overflow-hidden rounded-2xl border p-3 text-start transition-[background-color,border-color,transform] duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aa99ec]',
											selected
												? inverse
													? 'border-white/15 bg-white/[0.07]'
													: 'border-black/10 bg-black/[0.04]'
												: inverse
													? 'border-transparent hover:bg-white/[0.035]'
													: 'border-transparent hover:bg-black/[0.03]',
										)}
									>
										<span
											className={cn(
												'grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-200',
												selected ? 'text-white' : inverse ? 'bg-white/[0.06] text-white/65' : 'bg-black/[0.05] text-black/55',
											)}
											style={selected ? { background: 'linear-gradient(45deg,#f58529,#dd2a7b 50%,#8134af)' } : undefined}
											aria-hidden
										>
											<Icon className="size-[18px]" strokeWidth={2} />
										</span>
										<span className="min-w-0 flex-1">
											<span className={cn('block text-[14px] font-semibold', !selected && (inverse ? 'text-white/75' : 'text-black/70'))}>{label}</span>
											<span className={cn('mt-0.5 block text-[12px] leading-5', inverse ? (selected ? 'text-white/65' : 'text-white/40') : selected ? 'text-black/60' : 'text-black/40')}>{detail}</span>
										</span>
										{selected ? (
											<ScenarioProgress mode={mode} step={step} reduce={Boolean(reduce)} fa={fa} className={cn('absolute inset-x-3 bottom-0 h-[2px]', inverse ? 'bg-white/10' : 'bg-black/10')} />
										) : null}
									</button>
								)
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

/** Fills across the scenario's whole run, one step at a time. */
function ScenarioProgress({ mode, step, reduce, fa, className }: { mode: InstagramDemoMode; step: number; reduce: boolean; fa: boolean; className?: string }) {
	const delays = INSTAGRAM_SCENARIO_DELAYS[mode]
	const total = delays.reduce((sum, delay) => sum + delay, 0)
	const elapsed = delays.slice(0, step).reduce((sum, delay) => sum + delay, 0)
	const duration = delays[step] ?? 0
	return (
		<span aria-hidden className={cn('block overflow-hidden rounded-full', className)}>
			<m.span
				key={`${mode}-${step}`}
				className={cn('block h-full rounded-full bg-[linear-gradient(90deg,#8134af,#dd2a7b,#f58529)]', fa ? 'origin-right' : 'origin-left')}
				initial={{ scaleX: reduce ? 1 : elapsed / total }}
				animate={{ scaleX: reduce ? 1 : (elapsed + duration) / total }}
				transition={{ duration: reduce ? 0 : duration / 1000, ease: 'linear' }}
			/>
		</span>
	)
}

/* ------------------------------------------------------------------ */
/* Trace log — terminal-style decision trace (variant 4)               */
/* ------------------------------------------------------------------ */

export type TraceLine = { tone: 'in' | 'ai' | 'tool' | 'ok' | 'warn'; text: string }
