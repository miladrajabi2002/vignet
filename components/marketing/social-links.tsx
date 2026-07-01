import { cn } from '@/lib/utils'

/**
 * Brand SVG icons for social platforms.
 * lucide-react has Instagram but no Telegram, so we ship both as crisp
 * brand-accurate SVGs and reuse them everywhere (navbar, footer, blog).
 */

export function InstagramIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
			<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
			<line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
		</svg>
	)
}

export function TelegramIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
			<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
		</svg>
	)
}

/**
 * SocialLinks — compact row of social icon buttons.
 *
 * Used in the navbar, footer and blog pages. Links are placeholders the
 * site owner can swap later by editing SOCIAL_URLS below.
 *
 * `variant` controls the visual weight:
 *  - "compact" → small icon-only buttons for the navbar
 *  - "default" → medium icon buttons for the footer
 *  - "inline"  → text+icon links for blog share bars
 */

const SOCIAL_URLS = {
	instagram: 'https://instagram.com/vigent_ir',
	telegram: 'https://t.me/vigent_ir',
} as const

const SOCIAL_LABELS = {
	instagram: 'اینستاگرام',
	telegram: 'تلگرام',
} as const

export function SocialLinks({
	variant = 'default',
	className,
}: {
	variant?: 'compact' | 'default' | 'inline'
	className?: string
}) {
	const links = [
		{
			href: SOCIAL_URLS.instagram,
			label: SOCIAL_LABELS.instagram,
			Icon: InstagramIcon,
		},
		{
			href: SOCIAL_URLS.telegram,
			label: SOCIAL_LABELS.telegram,
			Icon: TelegramIcon,
		},
	]

	if (variant === 'inline') {
		return (
			<div className={cn('flex items-center gap-3', className)}>
				{links.map(({ href, label, Icon }) => (
					<a
						key={href}
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
					>
						<Icon className="h-4 w-4" />
						{label}
					</a>
				))}
			</div>
		)
	}

	const btn =
		variant === 'compact'
			? 'h-8 w-8 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
			: 'h-9 w-9 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'

	const iconSize = variant === 'compact' ? 'h-4 w-4' : 'h-[18px] w-[18px]'

	return (
		<div className={cn('flex items-center gap-2', className)}>
			{links.map(({ href, label, Icon }) => (
				<a
					key={href}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={label}
					title={label}
					className={cn('inline-flex items-center justify-center transition-colors', btn)}
				>
					<Icon className={iconSize} />
				</a>
			))}
		</div>
	)
}
