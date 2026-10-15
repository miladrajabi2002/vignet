import type { CSSProperties } from 'react'
import { bankByKey, bankLogoUrl, formatPan } from '@/lib/payments/card/bins'
import { cn } from '@/lib/utils'

/**
 * The face of a bank card: the bank's own colour, its real mark, the number
 * and the cardholder. Deliberately plain — no texture, no chip — so the
 * sixteen digits are the only thing to read.
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
	const logo = bankLogoUrl(bank, 'mono')
	const number = /^\d{16}$/.test(pan) ? formatPan(pan) : pan.replace(/(.{4})(?=.)/g, '$1 ')
	const small = size === 'sm'
	return (
		<div
			dir={lang === 'en' ? 'ltr' : 'rtl'}
			className={cn(
				'relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden text-white transition-[filter,opacity] duration-300',
				small ? 'rounded-[16px] p-3.5' : 'rounded-[20px] p-5',
				muted && 'opacity-60 grayscale',
				className,
			)}
			style={{
				'--bank-deep': bank.colors[0],
				'--bank-light': bank.colors[1],
				background: 'linear-gradient(140deg, var(--bank-light), var(--bank-deep) 78%)',
				boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 18px 34px -22px var(--bank-deep)',
			} as CSSProperties}
		>
			<span aria-hidden className="pointer-events-none absolute -end-[18%] -top-[46%] size-[72%] rounded-full bg-white/[0.07]" />
			<div className="relative flex items-center gap-2.5">
				{logo
					// eslint-disable-next-line @next/next/no-img-element
					? <img src={logo} alt="" width={small ? 26 : 34} height={small ? 26 : 34} className={cn('shrink-0', small ? 'size-[26px]' : 'size-[34px]')} loading="lazy" />
					: <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-white/20 font-bold', small ? 'size-[26px] text-[10px]' : 'size-[34px] text-[12px]')}>{(lang === 'en' ? bank.en : bank.fa).slice(0, 1)}</span>}
				<span className={cn('min-w-0 truncate font-bold', small ? 'text-[12.5px]' : 'text-[15px]')}>{lang === 'en' ? bank.en : bank.fa}</span>
			</div>
			<div
				dir="ltr"
				className={cn('relative whitespace-nowrap text-left font-mono font-medium tabular-nums tracking-[0.08em]', small ? 'text-[15px]' : 'text-[clamp(17px,5.4vw,23px)]')}
				style={{ textShadow: '0 1px 1px rgba(0,0,0,.22)' }}
			>
				{number}
			</div>
			<div className={cn('relative min-h-[1.5em] truncate font-medium text-white/90', small ? 'text-[11.5px]' : 'text-[13px]')}>{holder ?? ''}</div>
		</div>
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
