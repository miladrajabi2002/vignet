import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BadgeCheck, CreditCard, Sparkles } from 'lucide-react'
import { PricingSection } from '@/components/marketing/pricing-section'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

export const metadata: Metadata = {
	title: 'تعرفه‌ها و پلن‌ها',
	description: 'پلن‌ها، تعرفه ماهانه و اعتبار پاسخ هوش مصنوعی ویجنت را شفاف مقایسه کنید و پلن مناسب کسب‌وکار خود را انتخاب کنید.',
	alternates: { canonical: `${SITE_URL}/pricing` },
	openGraph: {
		type: 'website',
		url: `${SITE_URL}/pricing`,
		title: 'تعرفه‌ها و پلن‌های ویجنت',
		description: 'مقایسه شفاف پلن‌ها، اعتبار پاسخ هوش مصنوعی و امکانات هر سطح از ویجنت.',
	},
}

const assurances = [
	{ icon: Sparkles, title: 'یک ماه شروع رایگان', text: 'فرصت کافی برای راه‌اندازی و ارزیابی جریان واقعی کسب‌وکار.' },
	{ icon: CreditCard, title: 'مصرف شفاف اعتبار', text: 'اعتبار هوش مصنوعی فقط مطابق مصرف ثبت‌شده در داشبورد محاسبه می‌شود.' },
	{ icon: BadgeCheck, title: 'بدون هزینه پاسخ ناموفق', text: 'پاسخ ناموفق هزینه‌ای ندارد و اتوماسیون ثابت اینستاگرام رایگان است.' },
] as const

export default function PricingPage() {
	return (
		<div className="marketing-page-shell min-h-screen pb-20 pt-24 sm:pt-28">
			<div className="mx-auto max-w-7xl px-3 sm:px-5">
				<header className="marketing-page-hero marketing-grid-dark px-6 py-12 text-white sm:px-10 sm:py-16">
					<div className="relative z-10 mx-auto max-w-3xl text-center">
						<p className="text-[10px] font-medium tracking-[0.14em] text-white/40 rtl:tracking-normal">VIGENT PRICING</p>
						<h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.2] tracking-[-0.04em] sm:text-5xl rtl:tracking-normal">
							تعرفه روشن برای رشد واقعی کسب‌وکار
						</h1>
						<p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/50">
							از یک ماه رایگان شروع کنید، پلن مناسب تعداد کانال‌های خود را انتخاب کنید و مصرف پاسخ‌های هوش مصنوعی را شفاف ببینید.
						</p>
					</div>
				</header>

				<section className="relative z-10 -mt-5 grid gap-3 px-3 sm:grid-cols-3 sm:px-6" aria-label="مزایای تعرفه ویجنت">
					{assurances.map(({ icon: Icon, title, text }) => (
						<article key={title} className="spatial-surface rounded-[1.4rem] bg-white p-5">
							<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white">
								<Icon className="h-4 w-4" />
							</span>
							<h2 className="mt-4 text-sm font-semibold text-black">{title}</h2>
							<p className="mt-2 text-xs leading-6 text-black/45">{text}</p>
						</article>
					))}
				</section>
			</div>

			<Suspense fallback={<div className="min-h-[38rem]" aria-hidden />}>
				<PricingSection />
			</Suspense>
		</div>
	)
}
