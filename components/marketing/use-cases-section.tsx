import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
	ArrowLeft,
	ArrowRight,
	CalendarCheck2,
	GraduationCap,
	Instagram,
	MessagesSquare,
	ShoppingBag,
	type LucideIcon,
} from 'lucide-react'

type UseCase = {
	title: string
	desc: string
	fit: string
	href: string
	icon: LucideIcon
}

const COPY: Record<'fa' | 'en', { eyebrow: string; title: string; subtitle: string; cta: string; items: UseCase[] }> = {
	fa: {
		eyebrow: 'برای کسب‌وکار شما',
		title: 'جایی که مکالمه زیاد است، ویجنت به‌کار می‌آید.',
		subtitle: 'از «قیمت؟» زیر یک پست تا پیگیری سفارش و رزرو وقت؛ مسیر را بر اساس کاری که واقعاً هر روز انجام می‌دهید انتخاب کنید.',
		cta: 'دیدن راهکار',
		items: [
			{
				title: 'پیج‌های فروش اینستاگرامی',
				desc: 'دایرکت، کامنت و پاسخ استوری را با قیمت، موجودی، کارت محصول و پیگیری خودکار مدیریت کنید.',
				fit: 'برای پوشاک، آرایشی، اکسسوری و فروشندگان خانگی',
				href: '/solutions/instagram',
				icon: Instagram,
			},
			{
				title: 'فروشگاه‌های آنلاین و ووکامرس',
				desc: 'محصول مناسب پیشنهاد دهید، موجودی را دقیق بگویید و وضعیت سفارش را بدون رفت‌وبرگشت پاسخ دهید.',
				fit: 'برای فروشگاه‌هایی با کاتالوگ و سفارش روزانه',
				href: '/solutions/ecommerce-ai',
				icon: ShoppingBag,
			},
			{
				title: 'خدمات، مشاوره و رزرو',
				desc: 'سؤال‌های اولیه را پاسخ دهید، اطلاعات متقاضی را بگیرید و موارد جدی را با خلاصه به کارشناس بسپارید.',
				fit: 'برای کلینیک، سالن، آژانس، تعمیر و خدمات تخصصی',
				href: '/solutions/customer-support-ai',
				icon: CalendarCheck2,
			},
			{
				title: 'آموزشگاه‌ها و فروش دوره',
				desc: 'دوره مناسب را معرفی کنید، پیش‌نیاز و شرایط ثبت‌نام را توضیح دهید و علاقه‌مندها را برای پیگیری نگه دارید.',
				fit: 'برای مدرس، موسسه، بوت‌کمپ و دوره آنلاین',
				href: '/solutions/persian-ai-chatbot',
				icon: GraduationCap,
			},
			{
				title: 'پشتیبانی در پیام‌رسان‌ها',
				desc: 'یک ربات آگاه برای تلگرام، بله و روبیکا داشته باشید و همه گفتگوها را از یک صندوق دنبال کنید.',
				fit: 'برای جامعه‌های کاربری، خدمات اشتراکی و تیم‌های پشتیبانی',
				href: '/solutions/telegram',
				icon: MessagesSquare,
			},
		],
	},
	en: {
		eyebrow: 'Made for your business',
		title: 'Where conversations pile up, Vigent goes to work.',
		subtitle: 'From a “price?” comment to order tracking and booking, choose the path that matches the work your team actually does every day.',
		cta: 'Explore solution',
		items: [
			{ title: 'Instagram sellers', desc: 'Handle DMs, comments and story replies with live prices, stock, product cards and automated follow-up.', fit: 'For fashion, beauty, accessories and home sellers', href: '/solutions/instagram', icon: Instagram },
			{ title: 'Online and WooCommerce stores', desc: 'Recommend the right item, answer stock questions accurately and share order status without back-and-forth.', fit: 'For stores with daily catalogs and orders', href: '/solutions/ecommerce-ai', icon: ShoppingBag },
			{ title: 'Services, consulting and booking', desc: 'Answer first questions, collect lead details and hand serious cases to a specialist with context.', fit: 'For clinics, salons, agencies, repair and specialists', href: '/solutions/customer-support-ai', icon: CalendarCheck2 },
			{ title: 'Education and course sales', desc: 'Recommend courses, explain prerequisites and enrollment, and retain interested leads for follow-up.', fit: 'For instructors, institutes, bootcamps and online courses', href: '/solutions/persian-ai-chatbot', icon: GraduationCap },
			{ title: 'Messaging support teams', desc: 'Run one knowledgeable bot across Telegram, Bale and Rubika, then follow every conversation from one inbox.', fit: 'For communities, subscriptions and support teams', href: '/solutions/telegram', icon: MessagesSquare },
		],
	},
}

export async function UseCasesSection() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section id="businesses" className="bg-white py-20 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="grid gap-6 border-t border-black/10 pt-7 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
					<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">{copy.eyebrow}</p>
					<div>
						<h2 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-black sm:text-5xl lg:text-6xl">{copy.title}</h2>
						<p className="mt-5 max-w-2xl text-[15px] leading-8 text-black/55">{copy.subtitle}</p>
					</div>
				</div>

				<div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
					{copy.items.map(({ title, desc, fit, href, icon: Icon }, index) => (
						<Link
							key={title}
							href={href}
							className={`group relative flex min-h-[300px] flex-col overflow-hidden rounded-[1.5rem] border border-black/10 p-5 transition-[background-color,border-color,transform] duration-300 hover:-translate-y-1 hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:p-6 ${index === 0 ? 'bg-black text-white' : 'bg-[#f7f7f5] text-black'} ${index < 2 ? 'lg:col-span-3' : 'lg:col-span-2'}`}
						>
							<div className="flex items-center justify-between">
								<span className={`flex h-11 w-11 items-center justify-center rounded-xl ${index === 0 ? 'bg-white/10' : 'border border-black/10 bg-white'}`}>
									<Icon className="h-4.5 w-4.5" />
								</span>
								<span className={`text-[9px] font-medium uppercase tracking-[0.12em] ${index === 0 ? 'text-white/35' : 'text-black/30'}`}>Vigent</span>
							</div>
							<h3 className="mt-8 text-xl font-medium leading-snug sm:text-2xl">{title}</h3>
							<p className={`mt-3 text-sm leading-7 ${index === 0 ? 'text-white/55' : 'text-black/55'}`}>{desc}</p>
							<div className={`mt-auto border-t pt-4 ${index === 0 ? 'border-white/10' : 'border-black/10'}`}>
								<p className={`text-[10px] leading-5 ${index === 0 ? 'text-white/40' : 'text-black/40'}`}>{fit}</p>
								<span className="mt-3 inline-flex items-center gap-2 text-xs font-medium">
									{copy.cta}<Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1 ltr:group-hover:translate-x-1" />
								</span>
							</div>
						</Link>
					))}
				</div>
			</div>
		</section>
	)
}
