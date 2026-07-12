import type { ComponentType } from 'react'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
	ArrowLeft,
	ArrowRight,
	BriefcaseBusiness,
	CalendarCheck2,
	Check,
	GraduationCap,
	Network,
	ShoppingBag,
	Sparkles,
	UtensilsCrossed,
} from 'lucide-react'

type UseCase = {
	title: string
	desc: string
	fit: string
	features: string[]
	href: string
	icon: ComponentType<{ className?: string }>
}

type SectionCopy = {
	eyebrow: string
	title: string
	subtitle: string
	cta: string
	sharedTitle: string
	sharedDesc: string
	sharedFeatures: string[]
	items: UseCase[]
}

const COPY: Record<'fa' | 'en', SectionCopy> = {
	fa: {
		eyebrow: 'یک ویجنت، متناسب با مدل کار شما',
		title: 'برای هر کسب‌وکار، یک فضای کاری تخصصی',
		subtitle: 'به‌جای ده‌ها ابزار جدا، مدل عملیاتی کسب‌وکارتان را انتخاب کنید؛ ویجنت پنل، ایجنت، اتوماسیون و گزارش‌های مناسب همان کار را آماده می‌کند.',
		cta: 'دیدن راهکار',
		sharedTitle: 'هسته مشترک همه بسته‌ها',
		sharedDesc: 'نوع کسب‌وکار فقط تجربه و ابزارهای تخصصی را تغییر می‌دهد؛ مشتری، گفتگو و دانش شما همیشه در یک هسته واحد باقی می‌ماند.',
		sharedFeatures: ['CRM و پرونده کامل مشتری', 'صندوق چندکاناله', 'ویجنتو و ایجنت شش‌لایه', 'ربات مدیر و اعلان', 'گزارش و اتوماسیون'],
		items: [
			{
				title: 'فروشگاه و فروش چندکاناله',
				desc: 'کاتالوگ، موجودی و پیشنهاد محصول را به گفتگو وصل کنید؛ از سایت تا دایرکت، مشتری پاسخ یکسان و قابل‌اعتماد می‌گیرد.',
				fit: 'فروشگاه آنلاین، ووکامرس، پیج فروش و فروشندگان خانگی',
				features: ['موجودی و کاتالوگ', 'مقایسه محصول', 'پیگیری سفارش', 'اتوماسیون اینستاگرام'],
				href: '/solutions/ecommerce-ai',
				icon: ShoppingBag,
			},
			{
				title: 'رستوران، کافه و سفارش غذا',
				desc: 'منو و وضعیت موجودی را پاسخ دهید، سفارش و اطلاعات ارسال را جمع کنید و مشتری‌های تکراری را در CRM نگه دارید.',
				fit: 'رستوران، کافه، فست‌فود، شیرینی و آشپزخانه بیرون‌بر',
				features: ['منوی هوشمند', 'ثبت سفارش', 'محدوده ارسال', 'پیشنهاد مکمل'],
				href: '/solutions/customer-support-ai',
				icon: UtensilsCrossed,
			},
			{
				title: 'رزرو و نوبت‌دهی',
				desc: 'ایجنت زمان‌های آزاد را می‌بیند، خدمت مناسب را پیشنهاد می‌دهد، اطلاعات لازم را می‌گیرد و نوبت را بدون تداخل ثبت می‌کند.',
				fit: 'کلینیک، سالن، مشاور، مربی، تعمیرگاه و خدمات حضوری',
				features: ['تقویم و ظرفیت', 'رزرو با AI', 'یادآوری مدیر', 'لغو و جابه‌جایی'],
				href: '/solutions/customer-support-ai',
				icon: CalendarCheck2,
			},
			{
				title: 'خدمات و جذب مشتری',
				desc: 'درخواست را دقیق دسته‌بندی کنید، سرنخ واجدشرایط بسازید، پیش‌نیازها را جمع کنید و پرونده کامل را به متخصص تحویل دهید.',
				fit: 'آژانس، خدمات فنی، حقوقی، مالی، املاک و کسب‌وکارهای پروژه‌ای',
				features: ['فرم هوشمند', 'امتیازدهی سرنخ', 'پیگیری خودکار', 'تحویل با خلاصه'],
				href: '/solutions/customer-support-ai',
				icon: BriefcaseBusiness,
			},
			{
				title: 'آموزش، دوره و عضویت',
				desc: 'دوره مناسب را پیشنهاد دهید، پیش‌نیاز و ثبت‌نام را توضیح دهید و اعضا را بعد از خرید هم از همان گفتگو پشتیبانی کنید.',
				fit: 'مدرس، موسسه، بوت‌کمپ، کوچ و جامعه اشتراکی',
				features: ['پیشنهاد دوره', 'ثبت‌نام و عضویت', 'پشتیبانی هنرجو', 'پیگیری علاقه‌مند'],
				href: '/solutions/persian-ai-chatbot',
				icon: GraduationCap,
			},
		],
	},
	en: {
		eyebrow: 'One Vigent, shaped around your operation',
		title: 'A specialized workspace for every business model',
		subtitle: 'Choose how your business works. Vigent prepares the right workspace, agent, automations and decision-ready reports without splitting customer data across tools.',
		cta: 'Explore solution',
		sharedTitle: 'The shared core in every workspace',
		sharedDesc: 'Your business model changes the specialist tools and experience, while customers, conversations and knowledge stay in one reliable core.',
		sharedFeatures: ['Complete customer CRM', 'Omnichannel inbox', 'Vigento & six-layer agents', 'Manager bot & alerts', 'Reports & automation'],
		items: [
			{ title: 'Commerce and omnichannel sales', desc: 'Connect catalog, stock and recommendations to every conversation, from the store widget to Instagram DMs.', fit: 'Online stores, WooCommerce, social sellers and home businesses', features: ['Live catalog', 'Product comparison', 'Order follow-up', 'Instagram automation'], href: '/solutions/ecommerce-ai', icon: ShoppingBag },
			{ title: 'Restaurants and food ordering', desc: 'Answer from the live menu, capture delivery details and keep repeat customers in the same CRM.', fit: 'Restaurants, cafés, takeaways, bakeries and kitchens', features: ['Smart menu', 'Order capture', 'Delivery zones', 'Upsell suggestions'], href: '/solutions/customer-support-ai', icon: UtensilsCrossed },
			{ title: 'Appointments and booking', desc: 'Let the agent see availability, recommend the right service, collect details and reserve a conflict-free slot.', fit: 'Clinics, salons, consultants, coaches and repair services', features: ['Calendar & capacity', 'AI booking', 'Manager reminders', 'Cancel & reschedule'], href: '/solutions/customer-support-ai', icon: CalendarCheck2 },
			{ title: 'Services and lead conversion', desc: 'Classify requests, qualify leads, collect prerequisites and hand a complete case to the right specialist.', fit: 'Agencies, field services, legal, finance and real estate', features: ['Smart intake', 'Lead scoring', 'Automated follow-up', 'Context handoff'], href: '/solutions/customer-support-ai', icon: BriefcaseBusiness },
			{ title: 'Education, courses and membership', desc: 'Recommend the right course, explain enrollment and keep supporting members after purchase in the same thread.', fit: 'Instructors, institutes, bootcamps, coaches and communities', features: ['Course matching', 'Enrollment', 'Learner support', 'Lead nurturing'], href: '/solutions/persian-ai-chatbot', icon: GraduationCap },
		],
	},
}

export async function UseCasesSection() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section id="businesses" className="marketing-story-section bg-white py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="mx-auto max-w-4xl border-t border-black/10 pt-6 text-center">
					<p className="marketing-eyebrow">{copy.eyebrow}</p>
					<h2 className="marketing-heading mx-auto mt-4">{copy.title}</h2>
					<p className="marketing-subtitle mx-auto mt-4">{copy.subtitle}</p>
				</div>

				<div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
					{copy.items.map(({ title, desc, fit, features, href, icon: Icon }, index) => (
						<Link
							key={title}
							href={href}
							className={`group relative flex min-h-[300px] flex-col overflow-hidden rounded-[1.35rem] border border-black/10 bg-[#f5f6f3] p-5 text-black transition-[background-color,border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-black/20 hover:bg-white hover:shadow-[0_18px_45px_rgba(0,0,0,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:p-6 ${index < 2 ? 'lg:col-span-3' : 'lg:col-span-2'} ${index === 4 ? 'sm:col-span-2 lg:col-span-2' : ''}`}
						>
							<span aria-hidden className="marketing-grid pointer-events-none absolute inset-0 opacity-35 transition-opacity duration-300 group-hover:opacity-55" />
							<div className="relative flex items-center justify-between">
								<span className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white">
									<Icon className="h-[18px] w-[18px]" aria-hidden />
								</span>
								<span className="font-mono text-[10px] text-black/30">0{index + 1}</span>
							</div>
							<h3 className="relative mt-5 text-lg font-medium leading-snug sm:text-xl">{title}</h3>
							<p className="relative mt-2.5 text-[13px] leading-6 text-black/60">{desc}</p>
							<div className="relative mt-4 flex flex-wrap gap-1.5">
								{features.map((feature) => (
									<span key={feature} className="rounded-full border border-black/[0.08] bg-white/75 px-2 py-1 text-[10px] text-black/55">{feature}</span>
								))}
							</div>
							<div className="relative mt-auto border-t border-black/10 pt-3.5">
								<p className="text-[11px] leading-5 text-black/55">{fit}</p>
								<span className="mt-3 inline-flex items-center gap-2 text-xs font-medium">
									{copy.cta}<Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1 ltr:group-hover:translate-x-1" />
								</span>
							</div>
						</Link>
					))}
				</div>

				<div className="marketing-grid-dark relative mt-4 overflow-hidden rounded-[1.5rem] bg-[#101311] p-5 text-white sm:p-7">
					<div aria-hidden className="absolute -end-16 -top-20 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />
					<div className="relative grid items-center gap-6 lg:grid-cols-[0.8fr_1.2fr]">
						<div className="flex items-start gap-3">
							<span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-200/20 bg-emerald-300/10 text-emerald-200">
								<Network className="h-5 w-5" />
								<span className="absolute -end-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#101311] bg-emerald-300" />
							</span>
							<div>
								<h3 className="text-base font-semibold sm:text-lg">{copy.sharedTitle}</h3>
								<p className="mt-1.5 max-w-xl text-xs leading-6 text-white/50 sm:text-sm">{copy.sharedDesc}</p>
							</div>
						</div>
						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
							{copy.sharedFeatures.map((feature, index) => (
								<div key={feature} className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-3 text-[11px] text-white/70">
									<span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-300/15 text-emerald-200">
										{index === 2 ? <Sparkles className="h-3 w-3" /> : <Check className="h-3 w-3" />}
									</span>
									{feature}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
