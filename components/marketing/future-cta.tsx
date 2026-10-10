'use client'

import { Fragment, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Phone } from 'lucide-react'
import { SUPPORT_PHONE_DISPLAY } from '@/lib/marketing/contact'
import { CtaPair, SUPPORT_TEL, toSiteLocale } from '@/components/marketing/site/ui'

// Each title is split into a lead and a closing `mark`: the mark is the phrase
// the signature stroke underlines and the star lands on.
const COPY = {
	fa: {
		start: 'شروع رایگان',
		call: 'تماس با پشتیبانی',
		callAria: `تماس با پشتیبانی ویجنت به شماره ${SUPPORT_PHONE_DISPLAY}`,
		aria: 'شروع با ویجنت',
		variants: {
			home: { lead: 'یه بار امتحانش کن،', mark: 'خودت می‌بینی', desc: 'چند دقیقه وقت بذار، ایجنتت رو با اطلاعات خودت بساز و با چند تا پیام واقعی تستش کن. خوشت نیومد؟ چیزی از دست ندادی.' },
			solutions: { lead: 'مسئلهٔ شما در این', mark: 'فهرست نبود؟', desc: 'با پشتیبانی تماس بگیرید تا راهکار مناسب کسب‌وکارتان را با هم پیدا کنیم.' },
			solution: { lead: 'همین هفته', mark: 'راه‌اندازی کنید', desc: 'اولین برنامه را در چند دقیقه وصل کنید و ویجنت را روی گفتگوهای واقعی خودتان بسنجید.' },
		},
	},
	en: {
		start: 'Start free',
		call: 'Call support',
		callAria: `Call Vigent support at ${SUPPORT_PHONE_DISPLAY}`,
		aria: 'Get started with Vigent',
		variants: {
			home: { lead: 'Give it one try —', mark: 'you’ll see', desc: 'Take a few minutes, build your agent from your own info and test it with a few real messages. Not for you? You’ve lost nothing.' },
			solutions: { lead: 'Your problem wasn’t', mark: 'on the list?', desc: 'Call support and we’ll find the right solution for your business together.' },
			solution: { lead: 'Get set up', mark: 'this week', desc: 'Connect your first channel in minutes and measure Vigent on your own real conversations.' },
		},
	},
} as const

/** The four-point star of the Vigent logo. */
const STAR = 'M0-11C.9-3.6 3.6-.9 11 0 3.6.9.9 3.6 0 11-.9 3.6-3.6.9-11 0-3.6-.9-.9-3.6 0-11Z'

/** Night-sky specks: [left %, top %, flicker seconds, delay seconds]. Phones show every other one. */
const SPECKS = [
	[8, 14, 4.5, 0], [17, 38, 6, 1.2], [26, 9, 5, 2.1], [34, 27, 7, 0.4], [46, 6, 5.5, 3], [58, 16, 6.5, 1.7],
	[67, 34, 4.8, 0.9], [74, 10, 6, 2.6], [85, 24, 5.2, 0.2], [92, 44, 7, 1.4], [12, 58, 6, 3.3], [88, 60, 5, 2],
] as const

/** Words as separate inline blocks so they can settle one after another (`--i` is the stagger index). */
function Words({ text, from = 0 }: { text: string; from?: number }) {
	return text.split(' ').map((word, index) => (
		<Fragment key={index}>
			{index > 0 ? ' ' : null}
			<span className="vg-sig-w" style={{ '--i': from + index } as CSSProperties}>{word}</span>
		</Fragment>
	))
}

/**
 * Closing call to action shared by every public page: a night card where a
 * horizon line opens from its centre and violet light rises behind it, while
 * the title settles word by word and its closing phrase is signed with an ink
 * stroke and the logo star. The entrance plays once when the card scrolls into
 * view (MotionPauser adds `.vg-in`; every transition lives in site.css).
 * Without JS or with reduced motion the finished card is simply rendered.
 * Copy adapts to the section of the site.
 */
export function FutureCta() {
	const locale = toSiteLocale(useLocale())
	const pathname = usePathname() ?? '/'
	const copy = COPY[locale]
	const fa = locale === 'fa'
	const path = pathname.replace(/^\/en(?=\/|$)/, '') || '/'
	const variant = path.startsWith('/solutions/') ? copy.variants.solution : path === '/solutions' ? copy.variants.solutions : copy.variants.home

	return (
		<section aria-label={copy.aria} className="overflow-x-clip px-5 pb-10 pt-12 sm:px-10 lg:px-0 lg:pb-[100px] lg:pt-[110px]">
			<div className="vg-cta vg-rv relative mx-auto w-full max-w-[1040px]">
			{/* Ambient backlight: the card glows onto the page from its sides, the
			    way a wall-mounted TV spills light, instead of a flat empty band. */}
			<div aria-hidden className="vg-cta-glow vg-anim" />
			<div className="vg-dawn relative flex min-h-[26rem] w-full flex-col items-center justify-center overflow-hidden rounded-sheet border border-white/[0.08] bg-[#0e0e11] px-5 pt-14 text-center shadow-[0_16px_50px_rgba(30,18,70,0.22)] sm:min-h-[31rem] sm:rounded-[2.75rem] sm:px-8 sm:pt-16 sm:shadow-[0_28px_90px_rgba(30,18,70,0.28)]">
				{/* The sky: paper grid fading downward, specks, the rising halo, the
				    planet's edge and its rim of light. All gradients, no blur filters. */}
				<div aria-hidden className="vg-dawn-sky vg-anim">
					<span className="vg-dawn-grid marketing-grid-dark" />
					{SPECKS.map(([left, top, duration, delay]) => (
						<span key={`${left}-${top}`} className="vg-dawn-dot" style={{ left: `${left}%`, top: `${top}%`, '--d': `${duration}s`, '--s': `${delay}s` } as CSSProperties} />
					))}
					<span className="vg-dawn-halo"><i /></span>
					<span className="vg-dawn-planet" />
					<span className="vg-dawn-rim" />
				</div>

				{/* w-full gives the cq container a definite inline size. */}
				<div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center [container-type:inline-size]">
					<h2
						className="vg-oneline font-medium leading-[1.3] text-white sm:font-bold"
						style={{ '--title-fit': fa ? '7.4cqw' : '5.6cqw', '--title-max': '2.8rem', '--title-fallback': fa ? 'clamp(1.2rem, 7.2vw, 2.8rem)' : 'clamp(0.9rem, 5.4vw, 2.8rem)' } as CSSProperties}
					>
						<Words text={variant.lead} />{' '}
						<span className="vg-sig">
							<Words text={variant.mark} from={variant.lead.split(' ').length} />
							<svg aria-hidden className="vg-sig-ln" viewBox="0 0 300 20" preserveAspectRatio="none"><path d="M298 7.5C220 1 120 2.5 2 12 110 7.5 215 7 298 7.5Z" /></svg>
							<svg aria-hidden className="vg-sig-ln vg-sig-ln-b" viewBox="0 0 300 20" preserveAspectRatio="none"><path d="M262 15C200 11.5 140 12 84 16.5 140 14 205 13.6 262 15Z" /></svg>
							<span aria-hidden className="vg-sig-star vg-anim"><svg viewBox="-12 -12 24 24"><path d={STAR} /></svg></span>
						</span>
					</h2>
					<p className="vg-dawn-rise mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-7 text-white/70 sm:mt-7 sm:max-w-2xl sm:leading-8">{variant.desc}</p>
					<CtaPair
						locale={locale}
						onDark
						className="vg-dawn-rise mt-7 [--rise-d:1050ms] sm:mt-9"
						primary={copy.start}
						secondary={copy.call}
						secondaryHref={SUPPORT_TEL}
						secondaryIcon={Phone}
						secondaryAria={copy.callAria}
					/>
				</div>
			</div>
			</div>
		</section>
	)
}
