import { Check } from 'lucide-react'
import { InstagramGlyph } from '@/components/marketing/social-links'
import { InstagramDemoLazy } from '@/components/marketing/instagram-demo-lazy'
import { SectionPill, type IconType, type SiteLocale } from '../ui'

const COPY = {
	fa: {
		pill: 'اتوماسیون اینستاگرام',
		title: <>دایرکت، کامنت و استوری؛<br className="lg:hidden" /> هم خودکار و هم هوشمند</>,
lead: 'همهٔ اتوماسیون‌های ثابت، از پاسخ خودکار کامنت و استوری تا سناریوهای دایرکت، رایگان‌اند؛ پیام‌هایی که فکر می‌خواهند را ایجنت هوشمند از روی اطلاعات فروشگاه شما جواب می‌دهد.',
		bullets: [
			'پاسخ خودکار کامنت + دایرکت خصوصی',
			'قیف فالو: شرط فالو، پیام یادآوری، سپس پاسخ',
			'پاسخ به منشن و ری‌اکشن استوری',
			'پاسخ هوشمند دایرکت از دادهٔ واقعی شما',
'خودتان تعیین می‌کنید به چه چیزی جواب داده نشود و با چه لحنی',
		],
	},
	en: {
		pill: 'Instagram automation',
		title: <>DMs, comments and stories —<br className="lg:hidden" /> automated and intelligent</>,
lead: 'Every fixed automation — comment and story replies as well as DM scenarios — is free; messages that need thinking are answered by the smart agent from your store’s own data.',
		bullets: [
			'Automatic comment replies + private DMs',
			'Follow funnel: condition, reminder, then reply',
			'Story mention and reaction replies',
			'Grounded smart DMs from your real data',
'You decide what never gets a reply, and in which tone',
		],
	},
} as const

export function InstagramSection({ locale }: { locale: SiteLocale }) {
	const c = COPY[locale]
	return (
		<section id="instagram" aria-labelledby="instagram-title" className="relative mt-14 scroll-mt-20 overflow-hidden bg-[#070707] px-4 py-14 text-white md:mt-20 md:py-20 lg:mt-0 lg:py-[120px]">
			<div aria-hidden className="vg-dark-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_50%_at_50%_60%,#000,transparent)] lg:[mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,#000,transparent)]" />
			<div aria-hidden className="pointer-events-none absolute left-1/2 top-[300px] size-[510px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(150,133,251,0.22),rgba(236,72,153,0.07)_55%,rgba(7,7,7,0))] lg:left-[220px] lg:top-40 lg:size-[640px] lg:translate-x-0" />

			<div className="relative mx-auto grid w-full max-w-[1200px] gap-5 lg:grid-cols-[440px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-[72px] lg:gap-y-[26px]">
				<header className="vg-rv flex flex-col items-center text-center lg:col-start-1 lg:row-start-1 lg:items-start lg:self-end lg:text-start">
					<SectionPill dark icon={InstagramGlyph as IconType} iconClassName="text-[#f9a8d4]">{c.pill}</SectionPill>
					<h2 id="instagram-title" className="mt-3.5 text-[25px] font-bold leading-[1.55] lg:mt-5 lg:text-[36px] lg:leading-[1.5] xl:text-[48px] xl:leading-[1.4]">{c.title}</h2>
					<p className="mt-2.5 text-[15px] leading-[1.95] text-[#a1a1aa] lg:mt-4 lg:text-[15px] lg:leading-[2]">{c.lead}</p>
				</header>

				<div className="vg-rv min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
					<InstagramDemoLazy locale={locale} />
				</div>

				<ul className="vg-rv-group flex flex-col gap-2 text-[13px] text-white/85 lg:col-start-1 lg:row-start-2 lg:text-[15px] lg:text-white/[0.82]">
					{c.bullets.map((item) => (
						<li key={item} className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3.5 lg:min-h-12">
							<span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-chip bg-[rgba(110,231,183,0.1)] text-[#6ee7b7]"><Check className="size-3.5" strokeWidth={2.2} /></span>
							{item}
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}
