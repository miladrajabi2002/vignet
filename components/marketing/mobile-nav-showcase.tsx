'use client'

import { useState, type ComponentType } from 'react'
import Link from 'next/link'
import {
	BookOpenText,
	CircleDollarSign,
	House,
	LayoutDashboard,
	LogIn,
	PlayCircle,
	Rocket,
	Sparkles,
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

type VariantId = 'orbit' | 'focus' | 'split' | 'contrast'

type Variant = {
	id: VariantId
	number: string
	name: string
	short: string
	description: string
	links: string[]
	recommended?: boolean
}

const VARIANTS: Variant[] = [
	{
		id: 'orbit',
		number: '۰۱',
		name: 'مدار',
		short: 'دکمه مرکزی برجسته',
		description: 'شروع کار دقیقاً در مرکز توجه است؛ بقیه لینک‌ها آرام و متقارن دور آن قرار می‌گیرند.',
		links: ['خانه', 'مستندات', 'شروع رایگان', 'تعرفه‌ها', 'ورود / داشبورد'],
		recommended: true,
	},
	{
		id: 'focus',
		number: '۰۲',
		name: 'تمرکز',
		short: 'CTA عریض و خوانا',
		description: 'برای تبدیل بهتر در موبایل؛ عبارت «شروع رایگان» از آیکن مهم‌تر است و کاملاً خوانده می‌شود.',
		links: ['خانه', 'دمو', 'شروع رایگان', 'تعرفه‌ها', 'ورود / داشبورد'],
	},
	{
		id: 'split',
		number: '۰۳',
		name: 'دو‌تکه',
		short: 'ناوبری + اکشن مستقل',
		description: 'لینک‌های اطلاعاتی در یک داک قرار دارند و شروع کار مثل یک کنترل مستقل و مهم دیده می‌شود.',
		links: ['خانه', 'مستندات', 'تعرفه‌ها', 'ورود / داشبورد', 'شروع کار'],
	},
	{
		id: 'contrast',
		number: '۰۴',
		name: 'کنتراست',
		short: 'داک مشکی سینمایی',
		description: 'انتخاب جسورانه‌تر و برندمحور؛ با بخش‌های مشکی سایت هماهنگ است و CTA سفید در مرکز می‌درخشد.',
		links: ['خانه', 'مستندات', 'شروع کار', 'دمو', 'ورود / داشبورد'],
	},
]

type NavCellProps = {
	icon: ComponentType<{ className?: string; strokeWidth?: number }>
	label: string
	active?: boolean
	inverse?: boolean
}

function NavCell({ icon: Icon, label, active = false, inverse = false }: NavCellProps) {
	return (
		<div className={cn(
			'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[10px] font-medium',
			inverse ? 'text-white/54' : 'text-black/46',
			active && (inverse ? 'bg-white/[0.09] font-semibold text-white' : 'font-semibold text-black'),
		)}>
			<span className={cn(
				'grid size-7 place-items-center rounded-[0.7rem]',
				active && (inverse ? 'bg-white text-black' : 'bg-black text-white'),
			)}>
				<Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
			</span>
			<span className="max-w-full truncate leading-4">{label}</span>
		</div>
	)
}

function AccountCell({ signedIn, inverse = false }: { signedIn: boolean; inverse?: boolean }) {
	return signedIn
		? <NavCell icon={LayoutDashboard} label="داشبورد" inverse={inverse} />
		: <NavCell icon={LogIn} label="ورود" inverse={inverse} />
}

function OrbitNav({ signedIn }: { signedIn: boolean }) {
	return (
		<nav aria-hidden className="absolute inset-x-3 bottom-3 grid h-[4.65rem] grid-cols-5 items-end rounded-[1.65rem] border border-black/[0.08] bg-white/92 p-1.5 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
			<NavCell icon={House} label="خانه" active />
			<NavCell icon={BookOpenText} label="مستندات" />
			<div className="relative h-full min-w-0">
				<div className="absolute -top-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[10px] font-bold text-black">
					<span className="grid size-[3.35rem] place-items-center rounded-[1.15rem] border-[5px] border-[#f5f5f3] bg-black text-white shadow-[0_14px_28px_-12px_rgba(0,0,0,0.72)]">
						<Rocket className="size-5" strokeWidth={2} />
					</span>
					<span className="whitespace-nowrap leading-4">شروع رایگان</span>
				</div>
			</div>
			<NavCell icon={CircleDollarSign} label="تعرفه‌ها" />
			<AccountCell signedIn={signedIn} />
		</nav>
	)
}

function FocusNav({ signedIn }: { signedIn: boolean }) {
	return (
		<nav aria-hidden className="absolute inset-x-3 bottom-3 grid h-[4.5rem] grid-cols-[1fr_1fr_1.55fr_1fr_1fr] gap-1 rounded-[1.5rem] border border-black/[0.08] bg-white/94 p-1.5 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
			<NavCell icon={House} label="خانه" active />
			<NavCell icon={PlayCircle} label="دمو" />
			<div className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.05rem] bg-black px-1 text-[10px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(0,0,0,0.8)]">
				<Rocket className="size-[1.1rem]" strokeWidth={2} />
				<span className="max-w-full truncate leading-4">شروع رایگان</span>
			</div>
			<NavCell icon={CircleDollarSign} label="تعرفه‌ها" />
			<AccountCell signedIn={signedIn} />
		</nav>
	)
}

function SplitNav({ signedIn }: { signedIn: boolean }) {
	return (
		<nav aria-hidden className="absolute inset-x-3 bottom-3 flex h-[4.5rem] gap-2">
			<div className="grid min-w-0 flex-1 grid-cols-4 rounded-[1.5rem] border border-black/[0.08] bg-white/94 p-1.5 shadow-[0_18px_45px_-20px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
				<NavCell icon={House} label="خانه" active />
				<NavCell icon={BookOpenText} label="مستندات" />
				<NavCell icon={CircleDollarSign} label="تعرفه‌ها" />
				<AccountCell signedIn={signedIn} />
			</div>
			<div className="flex w-[4.6rem] shrink-0 flex-col items-center justify-center gap-1 rounded-[1.5rem] bg-black text-[10px] font-bold text-white shadow-[0_16px_32px_-14px_rgba(0,0,0,0.72)]">
				<span className="grid size-7 place-items-center rounded-[0.7rem] bg-white/12"><Rocket className="size-4" strokeWidth={2} /></span>
				<span className="leading-4">شروع</span>
			</div>
		</nav>
	)
}

function ContrastNav({ signedIn }: { signedIn: boolean }) {
	return (
		<nav aria-hidden className="absolute inset-x-3 bottom-3 grid h-[4.65rem] grid-cols-5 gap-0.5 rounded-[1.65rem] border border-white/10 bg-[#111] p-1.5 shadow-[0_22px_48px_-18px_rgba(0,0,0,0.72)]">
			<NavCell icon={House} label="خانه" active inverse />
			<NavCell icon={BookOpenText} label="مستندات" inverse />
			<div className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.15rem] bg-white text-[10px] font-bold text-black shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]">
				<span className="grid size-7 place-items-center rounded-[0.7rem] bg-black text-white"><Rocket className="size-4" strokeWidth={2} /></span>
				<span className="max-w-full truncate leading-4">شروع کار</span>
			</div>
			<NavCell icon={PlayCircle} label="دمو" inverse />
			<AccountCell signedIn={signedIn} inverse />
		</nav>
	)
}

function PreviewNav({ variant, signedIn }: { variant: VariantId; signedIn: boolean }) {
	if (variant === 'focus') return <FocusNav signedIn={signedIn} />
	if (variant === 'split') return <SplitNav signedIn={signedIn} />
	if (variant === 'contrast') return <ContrastNav signedIn={signedIn} />
	return <OrbitNav signedIn={signedIn} />
}

function PhonePreview({ variant, signedIn }: { variant: VariantId; signedIn: boolean }) {
	return (
		<div className="relative mx-auto w-full max-w-[23rem] rounded-[3rem] border border-black/10 bg-[#171717] p-2 shadow-[0_32px_80px_-28px_rgba(0,0,0,0.5)]">
			<div className="relative aspect-[9/17.5] overflow-hidden rounded-[2.5rem] bg-[var(--bg-base)]">
				<div className="flex h-8 items-center justify-between px-6 text-[9px] font-semibold text-black/55" dir="ltr">
					<span>9:41</span>
					<span className="h-3.5 w-20 rounded-full bg-black" />
					<span>5G</span>
				</div>

				<div className="px-5 pt-5">
					<div className="flex items-center justify-between">
						<Logo priority className="h-7 w-24" />
						<span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[9px] font-medium text-black/48">نسخه موبایل</span>
					</div>

					<div className="mt-12">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-[9px] font-semibold text-black/55">
							<Sparkles className="size-3" /> هوش مصنوعی فروش
						</span>
						<h2 className="mt-4 text-[1.7rem] font-semibold leading-[1.45] text-black">هر گفتگو،<br />یک فرصت واقعی</h2>
						<p className="mt-3 max-w-[17rem] text-[10px] leading-6 text-black/42">فروش و پشتیبانی را از تمام کانال‌ها در یک فضای هوشمند مدیریت کنید.</p>
					</div>

					<div className="mt-10 grid grid-cols-2 gap-2.5">
						<div className="rounded-[1.25rem] border border-black/[0.07] bg-white p-3 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.32)]">
							<span className="grid size-8 place-items-center rounded-xl bg-black text-white"><PlayCircle className="size-4" /></span>
							<p className="mt-4 text-[10px] font-semibold">دموی محصول</p>
							<p className="mt-1 text-[8px] text-black/35">کمتر از دو دقیقه</p>
						</div>
						<div className="rounded-[1.25rem] border border-black/[0.07] bg-white p-3 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.32)]">
							<span className="grid size-8 place-items-center rounded-xl bg-black/[0.055] text-black"><BookOpenText className="size-4" /></span>
							<p className="mt-4 text-[10px] font-semibold">مستندات سریع</p>
							<p className="mt-1 text-[8px] text-black/35">شروع قدم‌به‌قدم</p>
						</div>
					</div>
				</div>

				<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/95 to-transparent" />
				<PreviewNav variant={variant} signedIn={signedIn} />
			</div>
		</div>
	)
}

export function MobileNavShowcase() {
	const [selected, setSelected] = useState<VariantId>('orbit')
	const [signedIn, setSignedIn] = useState(false)
	const variant = VARIANTS.find((item) => item.id === selected) ?? VARIANTS[0]

	return (
		<main dir="rtl" className="min-h-dvh overflow-x-hidden bg-[var(--bg-base)] px-4 py-8 text-[var(--text-primary)] sm:px-6 sm:py-12 lg:px-10">
			<div className="mx-auto max-w-7xl">
				<header className="flex flex-col gap-6 border-b border-black/[0.08] pb-8 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<Logo priority className="h-8 w-28" />
						<p className="mt-8 text-[11px] font-semibold text-black/40">آزمایشگاه طراحی · منوی موبایل</p>
						<h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.5] sm:text-4xl">چهار مسیر برای یک شروع بهتر</h1>
						<p className="mt-3 max-w-2xl text-sm leading-8 text-black/48">هر مدل پنج مقصد یا کمتر دارد، «شروع کار» را به اکشن اصلی تبدیل می‌کند و ورود را بعد از احراز هویت به داشبورد تغییر می‌دهد.</p>
					</div>
					<Link href="/" className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-xs font-semibold text-black/60 transition-colors hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)]">
						بازگشت به سایت
					</Link>
				</header>

				<div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="انتخاب مدل منوی موبایل">
					{VARIANTS.map((item) => {
						const active = item.id === selected
						return (
							<button
								key={item.id}
								type="button"
								onClick={() => setSelected(item.id)}
								aria-pressed={active}
								className={cn(
									'relative min-h-[7.5rem] rounded-[1.4rem] border p-4 text-start transition-[transform,background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)] focus-visible:ring-offset-2 motion-reduce:transition-none',
									active
										? 'border-black bg-black text-white shadow-[0_18px_36px_-22px_rgba(0,0,0,0.65)]'
										: 'border-black/[0.08] bg-white/70 text-black hover:-translate-y-0.5 hover:border-black/20 hover:bg-white motion-reduce:hover:translate-y-0',
								)}
							>
								<div className="flex items-center justify-between gap-3">
									<span className={cn('text-xs font-semibold', active ? 'text-white/48' : 'text-black/32')}>{item.number}</span>
									{item.recommended && <span className={cn('rounded-full px-2 py-1 text-[9px] font-bold', active ? 'bg-white text-black' : 'bg-black text-white')}>پیشنهاد من</span>}
								</div>
								<p className="mt-5 text-base font-semibold">{item.name}</p>
								<p className={cn('mt-1 text-[11px]', active ? 'text-white/54' : 'text-black/42')}>{item.short}</p>
							</button>
						)
					})}
				</div>

				<section className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-12 xl:gap-20">
					<div className="order-2 lg:order-1">
						<div className="rounded-[1.75rem] border border-black/[0.08] bg-white/80 p-5 shadow-[0_18px_45px_-34px_rgba(0,0,0,0.35)] sm:p-7">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-[11px] font-semibold text-black/35">مدل {variant.number}</p>
									<h2 className="mt-2 text-2xl font-semibold">{variant.name}</h2>
								</div>
								<div className="inline-flex rounded-xl bg-black/[0.045] p-1" role="group" aria-label="وضعیت ورود کاربر">
									<button type="button" onClick={() => setSignedIn(false)} aria-pressed={!signedIn} className={cn('min-h-10 rounded-lg px-3 text-[11px] font-semibold transition-colors', !signedIn ? 'bg-white text-black shadow-sm' : 'text-black/42')}>مهمان</button>
									<button type="button" onClick={() => setSignedIn(true)} aria-pressed={signedIn} className={cn('min-h-10 rounded-lg px-3 text-[11px] font-semibold transition-colors', signedIn ? 'bg-white text-black shadow-sm' : 'text-black/42')}>واردشده</button>
								</div>
							</div>

							<p className="mt-5 max-w-2xl text-sm leading-8 text-black/50">{variant.description}</p>
							<div className="mt-6 flex flex-wrap gap-2">
								{variant.links.map((link) => <span key={link} className="rounded-full border border-black/[0.08] bg-[var(--bg-base)] px-3 py-1.5 text-[10px] font-medium text-black/55">{link}</span>)}
							</div>

							<div className="mt-7 border-t border-black/[0.07] pt-5">
								<p className="flex items-center gap-2 text-[11px] font-semibold text-black/65"><Sparkles className="size-4" /> برای انتخاب فقط شماره مدل را بگو.</p>
								<p className="mt-2 text-[11px] leading-6 text-black/38">بعد از انتخاب، همان مدل با لینک‌های واقعی، حالت فعال صفحه و وضعیت ورود روی سایت اصلی پیاده می‌شود.</p>
							</div>
						</div>
					</div>

					<div className="order-1 lg:order-2 lg:sticky lg:top-8">
						<PhonePreview variant={selected} signedIn={signedIn} />
					</div>
				</section>
			</div>
		</main>
	)
}
