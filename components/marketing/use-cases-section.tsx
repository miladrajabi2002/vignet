import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowLeft, GraduationCap, HeartPulse, ShoppingBag } from 'lucide-react'

const COPY = {
	fa: {
		eyebrow: 'برای کسب‌وکار شما',
		title: 'از یک سناریوی واقعی شروع کنید',
		subtitle: 'قالب آماده را انتخاب کنید، اطلاعات خودتان را اضافه کنید و همان روز پاسخ‌گویی را شروع کنید.',
		cta: 'دیدن راهکار',
		items: [
			{ title: 'فروشگاه اینترنتی', desc: 'پیشنهاد محصول، موجودی، پیگیری سفارش و جمع‌آوری سرنخ', href: '/solutions/ecommerce-ai', icon: ShoppingBag },
			{ title: 'خدمات و رزرو', desc: 'پاسخ به سوال‌ها، ثبت درخواست و تحویل موارد مهم به همکار', href: '/solutions/customer-support-ai', icon: HeartPulse },
			{ title: 'آموزش و دوره', desc: 'معرفی دوره، پاسخ به سوالات ثبت‌نام و پیگیری علاقه‌مندان', href: '/solutions/persian-ai-chatbot', icon: GraduationCap },
		],
	},
	en: {
		eyebrow: 'Built for your business',
		title: 'Start with a real business scenario',
		subtitle: 'Pick a ready template, add your information, and start answering customers the same day.',
		cta: 'Explore solution',
		items: [
			{ title: 'Online stores', desc: 'Product discovery, stock, order tracking and lead capture', href: '/solutions/ecommerce-ai', icon: ShoppingBag },
			{ title: 'Services & booking', desc: 'Answer questions, capture requests and hand off important cases', href: '/solutions/customer-support-ai', icon: HeartPulse },
			{ title: 'Education & courses', desc: 'Introduce courses, answer enrollment questions and follow up leads', href: '/solutions/persian-ai-chatbot', icon: GraduationCap },
		],
	},
} as const

export async function UseCasesSection() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]

	return (
		<section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] py-20 md:py-24">
			<div className="mx-auto max-w-6xl px-6">
				<div className="max-w-2xl">
					<span className="text-xs text-[var(--text-muted)]">{copy.eyebrow}</span>
					<h2 className="mt-4 text-3xl font-light leading-tight text-[var(--text-primary)] md:text-4xl">{copy.title}</h2>
					<p className="mt-4 max-w-xl leading-7 text-[var(--text-secondary)]">{copy.subtitle}</p>
				</div>

				<div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--border-default)] md:grid-cols-3">
					{copy.items.map(({ title, desc, href, icon: Icon }) => (
						<Link key={href} href={href} className="group bg-[var(--bg-base)] p-6 transition-colors hover:bg-[var(--bg-elevated)] md:p-7">
							<Icon className="h-5 w-5 text-[var(--text-secondary)]" />
							<h3 className="mt-5 text-lg font-medium text-[var(--text-primary)]">{title}</h3>
							<p className="mt-2 min-h-14 text-sm leading-7 text-[var(--text-secondary)]">{desc}</p>
							<span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
								{copy.cta}
								<ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1 rtl:rotate-0 ltr:rotate-180 ltr:group-hover:translate-x-1" />
							</span>
						</Link>
					))}
				</div>
			</div>
		</section>
	)
}
