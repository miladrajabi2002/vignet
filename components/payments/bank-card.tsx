import type { CSSProperties } from 'react'
import { bankByKey, bankLogoUrl, formatPan } from '@/lib/payments/card/bins'
import { cn } from '@/lib/utils'

/**
 * The face of a bank card, the way Iranian cards look: the bank's colour,
 * its mark on a white tile, the chip, the Shetab arrow at the edge, the
 * sixteen digits across the middle, then the cardholder and a masked
 * expiry. Sizes follow the card's own width, so one face serves the
 * customer's pay page, the dashboard lists and the small chat bubbles.
 */
export function BankCardFace({
	bankKey,
	pan,
	holder,
	lang = 'fa',
	size = 'md',
	muted = false,
	className,
}: {
	bankKey: string
	/** 16 digits, or a masked form like «603799******5678». */
	pan: string
	holder?: string | null
	lang?: 'fa' | 'en'
	size?: 'sm' | 'md'
	/** A switched-off card. */
	muted?: boolean
	className?: string
}) {
	const bank = bankByKey(bankKey)
	const logo = bankLogoUrl(bank, 'color')
	// Already-spaced masks («6104 33•• •••• 5675») are kept as they are.
	const number = /^\d{16}$/.test(pan) ? formatPan(pan) : pan.includes(' ') ? pan : pan.replace(/(.{4})(?=.)/g, '$1 ')
	const small = size === 'sm'
	return (
		<div
			dir={lang === 'en' ? 'ltr' : 'rtl'}
			className={cn(
				'relative aspect-[1.586] w-full overflow-hidden text-white transition-[filter,opacity] duration-300',
				small ? 'rounded-[14px]' : 'rounded-[20px]',
				muted && 'opacity-60 grayscale',
				className,
			)}
			style={{
				containerType: 'inline-size',
				'--bank-deep': bank.colors[0],
				'--bank-light': bank.colors[1],
				background: 'radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,.16), transparent 55%), linear-gradient(135deg, var(--bank-light), var(--bank-deep) 85%)',
				boxShadow: 'inset 0 1px 0 rgba(255,255,255,.22), 0 2px 4px rgba(0,0,0,.06), 0 20px 36px -22px var(--bank-deep)',
			} as CSSProperties}
		>
			{/* The Shetab arrow sits on the left edge of every Iranian card, whatever the language. */}
			<span aria-hidden className="absolute top-1/2 -translate-y-1/2" style={{ left: '3.4cqi', borderStyle: 'solid', borderColor: 'transparent rgba(255,255,255,.55) transparent transparent', borderWidth: '1.7cqi 2.4cqi 1.7cqi 0' }} />
			<div className="absolute inset-0 flex flex-col" style={{ padding: '6.5cqi 7cqi 6cqi' }}>
				<div className="flex items-start justify-between">
					<span className={cn('grid shrink-0 place-items-center', bank.key === 'unknown' ? 'bg-white/15 ring-1 ring-inset ring-white/25' : 'bg-white shadow-[0_2px_6px_rgba(0,0,0,.12)]')} style={{ width: '17cqi', height: '17cqi', borderRadius: '3.2cqi', padding: '1.8cqi' }}>
						{bank.key === 'unknown' ? null : logo
							// eslint-disable-next-line @next/next/no-img-element
							? <img src={logo} alt={lang === 'en' ? bank.en : bank.fa} className="size-full object-contain" loading="lazy" />
							: <span className="font-bold" style={{ color: bank.colors[0], fontSize: '5cqi' }}>{shortBankName(lang === 'en' ? bank.en : bank.fa).slice(0, 2)}</span>}
					</span>
					<CardChip />
				</div>
				<div className="relative flex flex-1 items-center justify-center">
					<span
						dir="ltr"
						className="whitespace-nowrap font-mono font-bold tabular-nums"
						style={{ fontSize: '7.4cqi', letterSpacing: '.06em', textShadow: '0 1px 0 rgba(255,255,255,.18), 0 2px 3px rgba(0,0,0,.28)' }}
					>
						{number}
					</span>
				</div>
				<div className="flex items-end justify-between gap-3" style={{ fontSize: small ? '4.4cqi' : '4cqi' }}>
					<span className="min-w-0 truncate font-bold text-white/95">{holder ?? ''}</span>
					<span className="shrink-0 font-medium text-white/85">{lang === 'en' ? 'EXP' : 'انقضا:'} <span dir="ltr" className="font-mono">**/**</span></span>
				</div>
			</div>
		</div>
	)
}

/** The gold contact chip of a bank card. */
function CardChip() {
	return (
		<span
			aria-hidden
			className="relative block shrink-0"
			style={{ width: '11.5cqi', height: '9cqi', borderRadius: '2cqi', background: 'linear-gradient(140deg, #fff3a8, #f5c518 45%, #e9b10d 70%, #ffe27a)', boxShadow: 'inset 0 0 0 1px rgba(150,105,0,.35), 0 1px 2px rgba(0,0,0,.2)' }}
		>
			<span className="absolute" style={{ inset: '22% 24%', borderRadius: '1.2cqi', background: 'linear-gradient(140deg, #f7d64a, #dca90c)', boxShadow: 'inset 0 0 0 1px rgba(150,105,0,.3)' }} />
		</span>
	)
}

const BANK_PREFIXES = ['مؤسسه اعتباری ', 'بانک ']

function shortBankName(name: string): string {
	const prefix = BANK_PREFIXES.find((value) => name.startsWith(value))
	return prefix ? name.slice(prefix.length) : name
}

/** The bank's colour mark for lists and chips. */
export function BankMark({ bankKey, size = 28, className }: { bankKey: string; size?: number; className?: string }) {
	const bank = bankByKey(bankKey)
	const logo = bankLogoUrl(bank, 'color')
	if (!logo) {
		return (
			<span
				aria-hidden
				className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', className)}
				style={{ width: size, height: size, background: bank.colors[1] }}
			>
				{shortBankName(bank.fa).slice(0, 1)}
			</span>
		)
	}
	// eslint-disable-next-line @next/next/no-img-element
	return <img src={logo} alt="" width={size} height={size} className={cn('shrink-0', className)} style={{ width: size, height: size }} loading="lazy" />
}
