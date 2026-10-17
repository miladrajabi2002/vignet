import 'server-only'
import { cache, createElement, type ReactNode, type SVGProps } from 'react'
import type { IconNode, LucideProps } from 'lucide-react'
import { __iconNode as arrowLeftRight } from 'lucide-react/dist/esm/icons/arrow-left-right.mjs'
import { __iconNode as bookOpen } from 'lucide-react/dist/esm/icons/book-open.mjs'
import { __iconNode as calendarDays } from 'lucide-react/dist/esm/icons/calendar-days.mjs'
import { __iconNode as check } from 'lucide-react/dist/esm/icons/check.mjs'
import { __iconNode as circleCheck } from 'lucide-react/dist/esm/icons/circle-check.mjs'
import { __iconNode as eye } from 'lucide-react/dist/esm/icons/eye.mjs'
import { __iconNode as globe } from 'lucide-react/dist/esm/icons/globe.mjs'
import { __iconNode as inbox } from 'lucide-react/dist/esm/icons/inbox.mjs'
import { __iconNode as link2 } from 'lucide-react/dist/esm/icons/link-2.mjs'
import { __iconNode as messageSquare } from 'lucide-react/dist/esm/icons/message-square.mjs'
import { __iconNode as messagesSquare } from 'lucide-react/dist/esm/icons/messages-square.mjs'
import { __iconNode as moonStar } from 'lucide-react/dist/esm/icons/moon-star.mjs'
import { __iconNode as packageCheck } from 'lucide-react/dist/esm/icons/package-check.mjs'
import { __iconNode as plus } from 'lucide-react/dist/esm/icons/plus.mjs'
import { __iconNode as shoppingBag } from 'lucide-react/dist/esm/icons/shopping-bag.mjs'
import { __iconNode as shoppingCart } from 'lucide-react/dist/esm/icons/shopping-cart.mjs'
import { __iconNode as sparkles } from 'lucide-react/dist/esm/icons/sparkles.mjs'
import { __iconNode as store } from 'lucide-react/dist/esm/icons/store.mjs'
import { __iconNode as userRound } from 'lucide-react/dist/esm/icons/user-round.mjs'
import { __iconNode as walletCards } from 'lucide-react/dist/esm/icons/wallet-cards.mjs'
import { BALE_GLYPH, INSTAGRAM_LINE_GLYPH, RUBIKA_GLYPH, TELEGRAM_GLYPH, type BrandGlyph } from '@/components/marketing/social-links'

/*
 * Icons the homepage repeats, drawn once per page.
 *
 * The homepage drew the same icons dozens of times (31 checks, each channel
 * logo four times; Bale alone is 5.7 KB of path data), and server-rendered
 * logos were repeated again in the RSC payload. Each icon here renders the
 * same outer <svg> as before; the first copy on a page also carries the
 * drawing as a <symbol>, and every copy shows it through <use>, so the page
 * looks exactly the same.
 *
 * "First copy" is tracked per render with React's cache(), so every page (and
 * every client-side navigation) defines its own symbols. Keep these icons out
 * of the shared layout (navbar, footer, closing CTA): the layout outlives the
 * page that would hold its symbols. They are Server Components only
 * ('server-only' fails the build otherwise), so the drawings never ship in
 * client JS — import them only from files no client component imports. Colour gradients (the Instagram app logo)
 * are left inline: the first copy may sit in a breakpoint-hidden block, where
 * browsers still draw a symbol's shapes but not its gradients.
 */

const lucide = (node: IconNode): BrandGlyph => ({ viewBox: '0 0 24 24', body: node.map(([tag, attrs]) => createElement(tag, attrs)) })

const SYMBOLS = {
	'arrow-left-right': lucide(arrowLeftRight),
	'book-open': lucide(bookOpen),
	'calendar-days': lucide(calendarDays),
	check: lucide(check),
	'circle-check': lucide(circleCheck),
	eye: lucide(eye),
	globe: lucide(globe),
	inbox: lucide(inbox),
	'link-2': lucide(link2),
	'message-square': lucide(messageSquare),
	'messages-square': lucide(messagesSquare),
	'moon-star': lucide(moonStar),
	'package-check': lucide(packageCheck),
	plus: lucide(plus),
	'shopping-bag': lucide(shoppingBag),
	'shopping-cart': lucide(shoppingCart),
	sparkles: lucide(sparkles),
	store: lucide(store),
	'user-round': lucide(userRound),
	'wallet-cards': lucide(walletCards),
	bale: BALE_GLYPH,
	'instagram-line': INSTAGRAM_LINE_GLYPH,
	rubika: RUBIKA_GLYPH,
	telegram: TELEGRAM_GLYPH,
} satisfies Record<string, BrandGlyph>

type SpriteIconId = keyof typeof SYMBOLS

const definedThisRender = cache(() => new Set<SpriteIconId>())

/** The <symbol> on the first copy of an icon in this render, then a <use> on every copy. */
function drawing(id: SpriteIconId): ReactNode {
	const defined = definedThisRender()
	const ref = <use href={`#vs-${id}`} />
	if (defined.has(id)) return ref
	defined.add(id)
	return (
		<>
			<symbol id={`vs-${id}`} viewBox={SYMBOLS[id].viewBox}>
				{SYMBOLS[id].body}
			</symbol>
			{ref}
		</>
	)
}

// <use> fills the outer viewport from its origin, so the outer viewBox starts
// at 0 0 while the symbol keeps the drawing's own (Bale's is "54 4 32 32").
const outerViewBox = (id: SpriteIconId) => `0 0 ${SYMBOLS[id].viewBox.split(' ').slice(2).join(' ')}`

const hasA11yProp = (props: object) => Object.keys(props).some((key) => key.startsWith('aria-') || key === 'role' || key === 'title')

/** Same props and outer <svg> as the lucide icon. */
function lucideIcon(id: SpriteIconId) {
	return function SpriteIcon({ size = 24, color = 'currentColor', strokeWidth = 2, absoluteStrokeWidth, className, children, ...rest }: LucideProps) {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeWidth={absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				className={className}
				{...(!children && !hasA11yProp(rest) && { 'aria-hidden': 'true' })}
				{...rest}
			>
				{drawing(id)}
				{children}
			</svg>
		)
	}
}

/** Same outer <svg> as the social-links brand mark. */
function brandIcon(id: SpriteIconId, fill?: string) {
	return function SpriteIcon({ className }: { className?: string }) {
		return (
			<svg viewBox={outerViewBox(id)} fill={fill} className={className} aria-hidden="true">
				{drawing(id)}
			</svg>
		)
	}
}

export const ArrowLeftRight = lucideIcon('arrow-left-right')
export const BookOpen = lucideIcon('book-open')
export const CalendarDays = lucideIcon('calendar-days')
export const Check = lucideIcon('check')
export const CircleCheck = lucideIcon('circle-check')
export const Eye = lucideIcon('eye')
export const Globe = lucideIcon('globe')
export const Inbox = lucideIcon('inbox')
export const Link2 = lucideIcon('link-2')
export const MessageSquare = lucideIcon('message-square')
export const MessagesSquare = lucideIcon('messages-square')
export const MoonStar = lucideIcon('moon-star')
export const PackageCheck = lucideIcon('package-check')
export const Plus = lucideIcon('plus')
export const ShoppingBag = lucideIcon('shopping-bag')
export const ShoppingCart = lucideIcon('shopping-cart')
export const Sparkles = lucideIcon('sparkles')
export const Store = lucideIcon('store')
export const UserRound = lucideIcon('user-round')
export const WalletCards = lucideIcon('wallet-cards')

export const BaleIcon = brandIcon('bale', 'currentColor')
export const RubikaIcon = brandIcon('rubika')
export const TelegramIcon = brandIcon('telegram', 'currentColor')

/** The line Instagram glyph (social-links InstagramGlyph). */
export function InstagramGlyph({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
			{drawing('instagram-line')}
		</svg>
	)
}
