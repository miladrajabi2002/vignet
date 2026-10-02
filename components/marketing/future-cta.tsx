'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Phone } from 'lucide-react'
import { SUPPORT_PHONE_DISPLAY } from '@/lib/marketing/contact'
import { CtaPair, SUPPORT_TEL, toSiteLocale } from '@/components/marketing/site/ui'

const COPY = {
	fa: {
		start: 'شروع رایگان',
		call: 'تماس با پشتیبانی',
		callAria: `تماس با پشتیبانی ویجنت به شماره ${SUPPORT_PHONE_DISPLAY}`,
		aria: 'شروع با ویجنت',
		variants: {
home: { title: 'یه بار امتحانش کن، خودت می‌بینی', desc: 'چند دقیقه وقت بذار، ایجنتت رو با اطلاعات خودت بساز و با چند تا پیام واقعی تستش کن. خوشت نیومد؟ چیزی از دست ندادی.' },
			solutions: { title: 'مسئلهٔ شما در این فهرست نبود؟', desc: 'با پشتیبانی تماس بگیرید تا راهکار مناسب کسب‌وکارتان را با هم پیدا کنیم.' },
			solution: { title: 'همین هفته راه‌اندازی کنید', desc: 'اولین برنامه را در چند دقیقه وصل کنید و ویجنت را روی گفتگوهای واقعی خودتان بسنجید.' },
		},
	},
	en: {
		start: 'Start free',
		call: 'Call support',
		callAria: `Call Vigent support at ${SUPPORT_PHONE_DISPLAY}`,
		aria: 'Get started with Vigent',
		variants: {
home: { title: 'Give it one try — you’ll see', desc: 'Take a few minutes, build your agent from your own info and test it with a few real messages. Not for you? You’ve lost nothing.' },
			solutions: { title: 'Your problem wasn’t on the list?', desc: 'Call support and we’ll find the right solution for your business together.' },
			solution: { title: 'Get set up this week', desc: 'Connect your first channel in minutes and measure Vigent on your own real conversations.' },
		},
	},
} as const

/**
 * Closing call to action shared by every public page, crowned by the
 * writora.xyz "lamp": two conic wings, a purple orb and a hairline that sit
 * closed and open to the measured width of the title when the card scrolls
 * into view (MotionPauser adds `.vg-in`; the transition lives in site.css).
 * Phones open slower and narrower so the beam frames the title instead of
 * washing across the whole card. Without JS or with reduced motion the lamp
 * is simply rendered open. Copy adapts to the section of the site.
 */
export function FutureCta() {
	const locale = toSiteLocale(useLocale())
	const pathname = usePathname() ?? '/'
	const copy = COPY[locale]
	const fa = locale === 'fa'
	const path = pathname.replace(/^\/en(?=\/|$)/, '') || '/'
	const variant = path.startsWith('/solutions/') ? copy.variants.solution : path === '/solutions' ? copy.variants.solutions : copy.variants.home
	const textRef = useRef<HTMLSpanElement>(null)
	const [lampOpen, setLampOpen] = useState<number | null>(null)

	useEffect(() => {
		const el = textRef.current
		if (!el) return
		// The band opens beyond the title (text width + 8rem), at least 30rem,
		// capped at 46rem. Re-measured once the webfont settles and on resize.
		const measure = () => setLampOpen(Math.ceil(Math.min(Math.max(el.getBoundingClientRect().width + 128, 480), 736)))
		measure()
		let cancelled = false
		document.fonts?.ready.then(() => {
			if (!cancelled) measure()
		})
		let frame = 0
		const onResize = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(measure)
		}
		window.addEventListener('resize', onResize)
		return () => {
			cancelled = true
			cancelAnimationFrame(frame)
			window.removeEventListener('resize', onResize)
		}
	}, [variant.title])

	return (
		<section aria-label={copy.aria} className="overflow-x-clip px-5 pb-10 pt-12 sm:px-10 lg:px-0 lg:pb-[100px] lg:pt-[110px]">
			<div
				className="vg-cta vg-rv relative mx-auto w-full max-w-[1040px]"
				style={lampOpen ? ({ '--lamp-open': `${lampOpen}px` } as CSSProperties) : undefined}
			>
			{/* Ambient backlight: the card glows onto the page from its sides, the
			    way a wall-mounted TV spills light, instead of a flat empty band. */}
			<div aria-hidden className="vg-cta-glow vg-anim" />
			<div
				className="marketing-grid relative flex min-h-[24.5rem] w-full flex-col items-center justify-center overflow-hidden rounded-sheet border border-black/[0.07] bg-white px-5 pb-12 pt-16 text-center shadow-[0_16px_50px_rgba(56,35,100,0.07)] sm:min-h-[31rem] sm:rounded-[2.75rem] sm:px-8 sm:pb-20 sm:pt-0 sm:shadow-[0_28px_90px_rgba(56,35,100,0.09)]"
			>
				{/* The lamp (writora.xyz): conic wings masked by white, a blur band,
				    the purple orb, the hairline and a white cap above them. */}
				<div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 flex h-[17rem] items-center justify-center sm:h-[26rem]">
					<div className="relative isolate flex h-full w-full scale-y-110 items-center justify-center sm:scale-y-125">
						<div
							className="vg-lamp-wing absolute inset-auto right-1/2 h-56 overflow-visible from-purple-500 via-transparent to-transparent [--conic-position:from_70deg_at_center_top]"
							style={{ backgroundImage: 'conic-gradient(var(--conic-position), var(--tw-gradient-stops))' }}
						>
							<div className="absolute bottom-0 left-0 z-20 h-40 w-full bg-white [mask-image:linear-gradient(to_top,white,transparent)]" />
							<div className="absolute bottom-0 left-0 z-20 h-full w-40 bg-white [mask-image:linear-gradient(to_right,white,transparent)]" />
						</div>
						<div
							className="vg-lamp-wing absolute inset-auto left-1/2 h-56 from-transparent via-transparent to-purple-500 [--conic-position:from_290deg_at_center_top]"
							style={{ backgroundImage: 'conic-gradient(var(--conic-position), var(--tw-gradient-stops))' }}
						>
							<div className="absolute bottom-0 right-0 z-20 h-full w-40 bg-white [mask-image:linear-gradient(to_left,white,transparent)]" />
							<div className="absolute bottom-0 right-0 z-20 h-40 w-full bg-white [mask-image:linear-gradient(to_top,white,transparent)]" />
						</div>
						<div className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 bg-white blur-[4.5rem] sm:blur-[8rem]" />
						{/* Live backdrop-blur is compositor work phones pay on every
						    paint; it is invisible over the white band, so phones skip it. */}
						<div className="absolute top-1/2 z-50 hidden h-48 w-full bg-transparent opacity-10 backdrop-blur-md sm:block" />
						<div className="vg-lamp-orb absolute inset-auto z-30 h-24 -translate-y-[6rem] rounded-full bg-purple-400 blur-2xl sm:h-36" />
						<div className="vg-lamp-line absolute inset-auto z-50 h-0.5 -translate-y-[7rem] bg-purple-400" />
						<div className="absolute inset-auto z-40 h-44 w-full -translate-y-[12.5rem] bg-white" />
					</div>
				</div>

				{/* w-full gives the cq container a definite inline size. */}
				<div className="relative z-50 mx-auto flex w-full max-w-5xl flex-col items-center [container-type:inline-size]">
					<h2
						className="vg-oneline mt-6 font-medium leading-[1.3] text-[#111318] sm:mt-7 sm:font-bold"
						style={{ '--title-fit': fa ? '7.4cqw' : '5.6cqw', '--title-max': '2.8rem', '--title-fallback': fa ? 'clamp(1.2rem, 7.2vw, 2.8rem)' : 'clamp(0.9rem, 5.4vw, 2.8rem)' } as CSSProperties}
					>
						<span ref={textRef}>{variant.title}</span>
					</h2>
					<p className="mx-auto mt-4 max-w-xl text-pretty text-[15px] leading-7 text-vg-sub sm:mt-6 sm:max-w-2xl sm:text-[15px] sm:leading-8">{variant.desc}</p>
					<CtaPair
						locale={locale}
						className="mt-7 sm:mt-9"
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
