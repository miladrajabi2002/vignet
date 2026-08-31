import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HomeLocale } from './home-variants/shared/types'
import { InstagramDemoLazy } from './instagram-demo-lazy'
import { MarketingSectionHeading } from './section-heading'
import styles from './home-variants/home-variants.module.css'

export function InstagramAutomationSection({ locale }: { locale: HomeLocale }) {
	const fa = locale === 'fa'
	const bullets = fa
		? [
				'پاسخ خودکار کامنت + دایرکت خصوصی',
				'قیف فالو: شرط فالو، پیام یادآوری، سپس پاسخ',
				'پاسخ به منشن و ری‌اکشن استوری',
				'پاسخ هوشمند دایرکت از دادهٔ واقعی شما',
				'کنترل کامل کلمات توقف، سیاست پاسخ و لحن',
			]
		: [
				'Automatic comment replies + private DMs',
				'Follow funnel: condition, reminder, then reply',
				'Story mention and reaction replies',
				'Grounded smart DMs from your real data',
				'Full control over stop words, policy and tone',
			]

	return (
		<section id="instagram-automation" className="marketing-story-section marketing-section-instagram relative scroll-mt-24 overflow-hidden bg-[#070707] px-5 py-16 text-white sm:px-8 sm:py-24 lg:py-28">
			<div aria-hidden className={cn('pointer-events-none absolute inset-0', styles.darkGrid, styles.gridFade)} />
			<div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
				<div className="lg:sticky lg:top-28 lg:self-start">
					<MarketingSectionHeading
						align="start"
						inverse
						eyebrow={fa ? 'اتوماسیون اینستاگرام' : 'Instagram automation'}
						title={fa ? 'دایرکت، کامنت و استوری؛ هم خودکار و هم هوشمند' : 'DMs, comments and stories — automated and intelligent'}
						subtitle={fa
							? 'سناریوهای ثابت کامنت، منشن استوری و قیف فالو بدون مصرف اعتبار اجرا می‌شوند؛ در دایرکت هم ایجنت هوشمند از دادهٔ کسب‌وکار شما پاسخ می‌دهد.'
							: 'Deterministic comment, story and follow-funnel scenarios use no AI credit; in DMs, your agent answers from real business data.'}
					/>
					<ul className="mt-7 grid gap-2.5 text-[13px] leading-6 text-white/70 sm:grid-cols-2 lg:grid-cols-1">
						{bullets.map((item, index) => (
							<li key={item} data-scroll-reveal="side" style={{ '--reveal-order': index } as React.CSSProperties} className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-2.5">
								<span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-300/10 text-emerald-300">
									<CheckCircle2 className="size-3.5" aria-hidden />
								</span>
								{item}
							</li>
						))}
					</ul>
				</div>
				<InstagramDemoLazy locale={locale} />
			</div>
		</section>
	)
}
