import Link from 'next/link'
import { BookOpen, CircleHelp, MessagesSquare, Phone, Plus } from 'lucide-react'
import { SUPPORT_PHONE_DISPLAY } from '@/lib/marketing/contact'
import { cn } from '@/lib/utils'
import { Container, SUPPORT_TEL, SectionHead, btnDark, btnGhost, type SiteLocale } from './ui'

export type FaqItem = { q: string; a: string }

const COPY = {
	fa: {
		pill: 'پرسش و پاسخ',
		title: 'سؤالات متداول',
		lead: 'پاسخ کوتاه و شفاف سؤال‌هایی که قبل از شروع برای همه پیش می‌آید.',
		moreTitle: 'جواب سؤالتان را پیدا نکردید؟',
		moreBody: 'مستندات را ببینید یا مستقیم با پشتیبانی تماس بگیرید.',
		docs: 'مستندات را ببینید',
		support: 'تماس با پشتیبانی',
		supportAria: `تماس با پشتیبانی ویجنت به شماره ${SUPPORT_PHONE_DISPLAY}`,
	},
	en: {
		pill: 'Questions & answers',
		title: 'Frequently asked questions',
		lead: 'Short, clear answers to what everyone asks before starting.',
		moreTitle: 'Didn’t find your answer?',
		moreBody: 'Browse the documentation or call support directly.',
		docs: 'Read the docs',
		support: 'Call support',
		supportAria: `Call Vigent support at ${SUPPORT_PHONE_DISPLAY}`,
	},
} as const

/**
 * FAQ built on native <details name>: zero JavaScript, every answer is in the
 * HTML for search and answer engines, one item open at a time, first open.
 */
export function Faq({
	locale,
	items,
	title,
	lead,
	columns = 2,
	id = 'faq',
	className,
}: {
	locale: SiteLocale
	items: FaqItem[]
	title?: string
	lead?: string
	columns?: 1 | 2
	id?: string
	className?: string
}) {
	const c = COPY[locale]
	const mid = Math.ceil(items.length / 2)
	const groups = columns === 2 ? [items.slice(0, mid), items.slice(mid)] : [items]
	const group = `${id}-items`

	return (
		<section id={id} aria-labelledby={`${id}-title`} className={cn('vg-cv scroll-mt-24 pt-12 lg:border-t lg:border-black/[0.06] lg:bg-white lg:py-[110px]', className)}>
			<Container className={columns === 1 ? 'lg:max-w-[860px]' : undefined}>
				<SectionHead className="vg-rv" id={`${id}-title`} pill={c.pill} icon={CircleHelp} title={title ?? c.title} lead={lead ?? c.lead} titleClassName="lg:text-[42px] lg:leading-[1.4]" />
				<div className={cn('vg-rv-group mt-[18px] grid grid-cols-1 items-start gap-2 lg:mt-10 lg:gap-3', columns === 2 && 'lg:grid-cols-2')}>
					{groups.map((list, gi) => (
						<div key={gi} className="flex flex-col gap-2 lg:gap-3">
							{list.map((item, ii) => (
								<details
									key={item.q}
									name={group}
									open={gi === 0 && ii === 0}
									className="vg-details group rounded-card border border-vg-line bg-white transition-colors duration-200 open:border-black/[0.16] open:bg-[#fafaf9]"
								>
									<summary className="vg-press flex min-h-[60px] items-center justify-between gap-3.5 rounded-card px-4 py-3 text-start text-[15px] font-medium leading-[1.8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vg-signal lg:min-h-16 lg:px-5 lg:text-[16px]">
										<h3 className="font-medium">{item.q}</h3>
										<span aria-hidden className="vg-plus inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-vg-sub">
											<Plus className="size-[15px]" strokeWidth={2} />
										</span>
									</summary>
									<div className="vg-details-body px-4 pb-4 lg:px-5 lg:pb-5">
										<p className="border-s-2 border-[rgba(16,185,129,0.5)] ps-3.5 text-start text-[14px] leading-[2] text-vg-sub lg:text-[15px]">{item.a}</p>
									</div>
								</details>
							))}
						</div>
					))}
				</div>

				<div className="vg-rv mt-4 flex flex-col items-center gap-2.5 rounded-card border border-vg-line bg-white px-4 py-5 text-center lg:mt-7 lg:flex-row lg:justify-between lg:gap-5 lg:px-6 lg:text-start">
					<div className="flex flex-col items-center gap-2.5 lg:flex-row lg:gap-3.5">
						<span aria-hidden className="inline-flex size-11 items-center justify-center rounded-control bg-vg-tint text-vg-signal lg:size-[46px]"><MessagesSquare className="size-5" strokeWidth={1.8} /></span>
						<div>
							<p className="text-[16px] font-bold lg:text-[17px]">{c.moreTitle}</p>
							<p className="mt-0.5 text-[13.5px] leading-[1.9] text-vg-sub lg:text-[14px]">{c.moreBody}</p>
						</div>
					</div>
					<div className="mt-1 flex w-full flex-col gap-2 lg:mt-0 lg:w-auto lg:shrink-0 lg:flex-row-reverse">
						<a href={SUPPORT_TEL} aria-label={c.supportAria} className={cn(btnDark, 'h-12 w-full rounded-control px-5 text-[14px] lg:w-auto')}>
							<Phone aria-hidden className="size-4" strokeWidth={1.8} />
							{c.support}
						</a>
						<Link href="/docs" className={cn(btnGhost, 'h-[46px] w-full rounded-control px-[18px] text-[14px] lg:h-12 lg:w-auto')}>
							<BookOpen aria-hidden className="size-[17px]" strokeWidth={1.8} />
							{c.docs}
						</Link>
					</div>
				</div>
			</Container>
		</section>
	)
}
