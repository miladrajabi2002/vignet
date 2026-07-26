'use client'

/**
 * Product showcase rail — the customer-facing carousel that renders the
 * `[[product:{…}]]` snapshots an agent reply carries. Shared by the public
 * chat link (/c/[slug]), the operator inbox and the admin transcript so a
 * recommendation looks identical everywhere.
 *
 * Discoverability is the whole point of this component: a bare
 * `overflow-x:auto` rail hid every product past the second or third card —
 * desktop mice have no horizontal wheel and the thin scrollbar reads as
 * decoration, so visitors never learned more products existed. Three
 * affordances fix that without stealing space from the cards:
 *   1. prev/next buttons (logical direction, so RTL scrolls the right way),
 *   2. a scroll progress bar that shows how much of the rail is left,
 *   3. a "see all" toggle that reflows the rail into a responsive grid —
 *      the mobile-friendly escape hatch when swiping is awkward.
 *
 * The vanilla widget (public/widget/loader.js) mirrors this behaviour.
 */

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, LayoutGrid, Package, Rows3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
	MAX_SHOWCASE_PRODUCTS,
	safeHttpUrl,
	type ShowcaseProduct,
} from './product-showcase'

/** Matches the rail's `gap-3`; used to advance exactly one card per click. */
const RAIL_GAP_PX = 12
/** Sub-pixel scroll positions must not flicker the edge buttons. */
const EDGE_EPSILON = 4

type ScrollState = {
	/** True when at least one card is out of view — all controls hinge on this. */
	overflowing: boolean
	atStart: boolean
	atEnd: boolean
	/** 0…1 position of the viewport inside the scrollable width. */
	progress: number
	/** Visible fraction of the rail, i.e. the progress thumb's width. */
	ratio: number
}

const INITIAL_SCROLL: ScrollState = {
	overflowing: false,
	atStart: true,
	atEnd: false,
	progress: 0,
	ratio: 1,
}

function formatCount(value: number, locale: 'fa' | 'en'): string {
	return value.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')
}

export function ProductShowcaseRail({
	products,
	locale = 'fa',
	accent = '#111111',
	onAccent = '#ffffff',
	compact = false,
	className,
}: {
	products: ShowcaseProduct[]
	locale?: 'fa' | 'en'
	accent?: string
	onAccent?: string
	compact?: boolean
	className?: string
}) {
	const items = products.slice(0, MAX_SHOWCASE_PRODUCTS)
	const railRef = useRef<HTMLDivElement | null>(null)
	const frameRef = useRef<number | null>(null)
	const [expanded, setExpanded] = useState(false)
	const [scroll, setScroll] = useState<ScrollState>(INITIAL_SCROLL)

	// `scrollLeft` is negative in RTL, so every measurement works off its
	// absolute value and the buttons convert back with an explicit sign.
	const measure = useCallback(() => {
		const el = railRef.current
		if (!el) return
		const max = Math.max(0, el.scrollWidth - el.clientWidth)
		const pos = Math.min(Math.abs(el.scrollLeft), max)
		const next: ScrollState = {
			overflowing: max > EDGE_EPSILON,
			atStart: pos <= EDGE_EPSILON,
			atEnd: max - pos <= EDGE_EPSILON,
			progress: max > EDGE_EPSILON ? pos / max : 0,
			ratio: el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1,
		}
		setScroll((prev) =>
			prev.overflowing === next.overflowing &&
			prev.atStart === next.atStart &&
			prev.atEnd === next.atEnd &&
			Math.abs(prev.progress - next.progress) < 0.004 &&
			Math.abs(prev.ratio - next.ratio) < 0.004
				? prev
				: next,
		)
	}, [])

	// Touch scrolling fires far more often than a frame, and `measure()` reads
	// layout, so coalesce every source of remeasurement into one frame.
	const scheduleMeasure = useCallback(() => {
		if (frameRef.current !== null) return
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null
			measure()
		})
	}, [measure])

	// Card count, container width and font loading all change what "overflowing"
	// means, so remeasure on the element itself rather than on window resize.
	useEffect(() => {
		const el = railRef.current
		if (!el) {
			setScroll(INITIAL_SCROLL)
			return
		}
		measure()
		if (typeof ResizeObserver === 'undefined') return
		const observer = new ResizeObserver(scheduleMeasure)
		observer.observe(el)
		return () => observer.disconnect()
	}, [measure, scheduleMeasure, expanded, items.length])

	useEffect(
		() => () => {
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
		},
		[],
	)

	const scrollByCard = useCallback(
		(towardEnd: boolean) => {
			const el = railRef.current
			if (!el) return
			const card = el.firstElementChild as HTMLElement | null
			const step = Math.min(
				(card?.offsetWidth ?? el.clientWidth * 0.8) + RAIL_GAP_PX,
				Math.max(el.clientWidth, 1),
			)
			const rtl = getComputedStyle(el).direction === 'rtl'
			const reduce =
				typeof window !== 'undefined' &&
				typeof window.matchMedia === 'function' &&
				window.matchMedia('(prefers-reduced-motion: reduce)').matches
			el.scrollBy({
				left: step * (towardEnd ? 1 : -1) * (rtl ? -1 : 1),
				behavior: reduce ? 'auto' : 'smooth',
			})
		},
		[],
	)

	if (!items.length) return null

	const accentStyle = {
		'--showcase-accent': accent,
		'--showcase-on-accent': onAccent,
	} as CSSProperties

	const isFa = locale === 'fa'
	const showNav = !expanded && scroll.overflowing
	// The toggle is the only way to reach hidden cards on a touch device whose
	// swipe is competing with the chat's vertical scroll, so it stays visible
	// once expanded even after the grid stops overflowing.
	const showToggle = expanded || scroll.overflowing
	const thumbWidth = Math.max(18, Math.round(scroll.ratio * 100))
	const PrevIcon = isFa ? ChevronRight : ChevronLeft
	const NextIcon = isFa ? ChevronLeft : ChevronRight

	return (
		<section
			aria-label={isFa ? 'ویترین محصولات پیشنهادی' : 'Recommended products'}
			dir={isFa ? 'rtl' : 'ltr'}
			className={cn('min-w-0 max-w-full', className)}
			style={accentStyle}
		>
			<div className="mb-2 flex items-center gap-2 px-0.5">
				<span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-black/55">
					<Package aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
					<span className="truncate">{isFa ? 'ویترین محصولات' : 'Product showcase'}</span>
					<span className="tabular-nums text-black/35">{formatCount(items.length, locale)}</span>
				</span>

				<div className="ms-auto flex shrink-0 items-center gap-1">
					{showNav && (
						<>
							<RailButton
								label={isFa ? 'محصول قبلی' : 'Previous product'}
								disabled={scroll.atStart}
								onClick={() => scrollByCard(false)}
							>
								<PrevIcon aria-hidden="true" className="h-4 w-4" />
							</RailButton>
							<RailButton
								label={isFa ? 'محصول بعدی' : 'Next product'}
								disabled={scroll.atEnd}
								onClick={() => scrollByCard(true)}
							>
								<NextIcon aria-hidden="true" className="h-4 w-4" />
							</RailButton>
						</>
					)}
					{showToggle && (
						<button
							type="button"
							onClick={() => setExpanded((value) => !value)}
							aria-expanded={expanded}
							className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-3 text-[11px] font-bold text-neutral-700 shadow-sm transition-colors duration-150 hover:border-black/25 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--showcase-accent)] focus-visible:ring-offset-1 sm:min-h-8"
						>
							{expanded ? (
								<>
									<Rows3 aria-hidden="true" className="h-3.5 w-3.5" />
									{isFa ? 'نمایش کشویی' : 'Carousel'}
								</>
							) : (
								<>
									<LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
									{isFa ? 'همه محصولات' : 'See all'}
								</>
							)}
						</button>
					)}
				</div>
			</div>

			{expanded ? (
				<>
					<div
						className={cn(
							'grid gap-3',
							compact
								? '[grid-template-columns:repeat(auto-fill,minmax(8.75rem,1fr))]'
								: '[grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]',
						)}
					>
						{items.map((product, index) => (
							<ShowcaseCard
								key={product.id || `${product.name}-${index}`}
								product={product}
								locale={locale}
								compact={compact}
								layout="grid"
							/>
						))}
					</div>
					<button
						type="button"
						onClick={() => setExpanded(false)}
						className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white/80 text-[11px] font-bold text-neutral-600 transition-colors duration-150 hover:border-black/25 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--showcase-accent)] focus-visible:ring-offset-1"
					>
						<Rows3 aria-hidden="true" className="h-3.5 w-3.5" />
						{isFa ? 'بستن ویترین' : 'Collapse showcase'}
					</button>
				</>
			) : (
				<>
					<div
						ref={railRef}
						onScroll={scheduleMeasure}
						role="region"
						aria-label={isFa ? 'اسکرول افقی محصولات' : 'Product list, scrolls horizontally'}
						tabIndex={0}
						className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-color:rgba(0,0,0,.16)_transparent] [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--showcase-accent)]/40"
					>
						{items.map((product, index) => (
							<ShowcaseCard
								key={product.id || `${product.name}-${index}`}
								product={product}
								locale={locale}
								compact={compact}
								layout="rail"
							/>
						))}
					</div>

					{scroll.overflowing && (
						<div
							aria-hidden="true"
							className="-mt-1 h-1 overflow-hidden rounded-full bg-black/[0.07]"
						>
							{/* No transition: the thumb tracks the live scroll offset, and
							    easing it would visibly lag behind a finger swipe. */}
							<div
								className="h-full rounded-full bg-[var(--showcase-accent)] opacity-70"
								style={{
									width: `${thumbWidth}%`,
									marginInlineStart: `${scroll.progress * (100 - thumbWidth)}%`,
								}}
							/>
						</div>
					)}
				</>
			)}
		</section>
	)
}

function RailButton({
	label,
	disabled,
	onClick,
	children,
}: {
	label: string
	disabled: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 bg-white/90 text-neutral-700 shadow-sm transition-[opacity,border-color,background-color] duration-150 hover:border-black/25 hover:bg-white disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--showcase-accent)] focus-visible:ring-offset-1 sm:h-8 sm:w-8"
		>
			{children}
		</button>
	)
}

function ShowcaseCard({
	product,
	locale,
	compact,
	layout,
}: {
	product: ShowcaseProduct
	locale: 'fa' | 'en'
	compact: boolean
	layout: 'rail' | 'grid'
}) {
	const imageUrl = safeHttpUrl(product.imageUrl || product.image)
	const productUrl = safeHttpUrl(product.productUrl || product.url)
	const description = product.description || product.desc || ''
	const specs = Array.isArray(product.specs) ? product.specs : []
	const isFa = locale === 'fa'

	return (
		<article
			className={cn(
				'group flex flex-col overflow-hidden rounded-2xl border border-black/[0.09] bg-white text-start text-neutral-900 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.34)]',
				layout === 'rail'
					? cn('shrink-0 snap-start', compact ? 'w-[13.25rem]' : 'w-[min(16rem,78vw)]')
					: 'min-w-0',
			)}
		>
			<div
				className={cn(
					'relative overflow-hidden bg-neutral-100',
					compact ? 'aspect-[16/10]' : 'aspect-[4/3]',
				)}
			>
				{imageUrl ? (
					// Remote product domains are tenant-defined and cannot be listed
					// statically in next/image configuration.
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={imageUrl}
						alt={product.name}
						loading="lazy"
						decoding="async"
						width={320}
						height={240}
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none"
					/>
				) : (
					<span className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-300">
						<Package aria-hidden="true" className="h-8 w-8" />
					</span>
				)}
				{product.badge && (
					<span className="absolute start-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-white/70 bg-white/92 px-2.5 py-1 text-[10px] font-semibold text-neutral-700 shadow-sm">
						{product.badge}
					</span>
				)}
			</div>

			<div className="flex flex-1 flex-col p-3.5">
				<h3 className="line-clamp-2 text-[13px] font-bold leading-5 text-neutral-900">
					{product.name}
				</h3>
				{description && (
					<p className="mt-1.5 line-clamp-3 text-[11px] leading-5 text-neutral-500">
						{description}
					</p>
				)}
				{specs.length > 0 && (
					<ul
						className="mt-2 flex flex-wrap gap-1"
						aria-label={isFa ? 'مشخصات محصول' : 'Product specifications'}
					>
						{specs.map((spec) => (
							<li
								key={spec}
								className="max-w-full truncate rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600"
							>
								{spec}
							</li>
						))}
					</ul>
				)}

				<div className="mt-auto pt-3">
					{product.price && (
						<p
							className="mb-2 text-[13px] font-black tabular-nums text-neutral-950"
							dir="auto"
						>
							{product.price}
						</p>
					)}
					{productUrl ? (
						<a
							href={productUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--showcase-accent)] px-3 text-xs font-bold text-[var(--showcase-on-accent)] transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--showcase-accent)] focus-visible:ring-offset-2"
						>
							{isFa ? 'مشاهده محصول' : 'View product'}
							<ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
						</a>
					) : (
						<div className="flex min-h-11 items-center text-[11px] text-neutral-400">
							{isFa ? 'برای اطلاعات بیشتر پیام دهید' : 'Message us for details'}
						</div>
					)}
				</div>
			</div>
		</article>
	)
}
