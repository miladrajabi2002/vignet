import type { ComponentType } from 'react'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
	ArrowLeft,
	ArrowRight,
	CalendarCheck2,
	GraduationCap,
	MessagesSquare,
	ShoppingBag,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

type UseCase = {
	title: string
	desc: string
	fit: string
	href: string
	icon: ComponentType<{ className?: string }>
}

const COPY: Record<'fa' | 'en', { eyebrow: string; title: string; subtitle: string; cta: string; items: UseCase[] }> = {
	fa: {
		eyebrow: 'برای کسب‌وکار شما',
		title: 'ویجنت برای کدام کسب‌وکارها ساخته شده؟',
		subtitle: 'اگر فروش یا پشتیبانی شما از گفتگو شروع می‌شود، ویجنت بخش تکراری کار را انجام می‌دهد و موارد مهم را به تیم شما می‌سپارد.',
		cta: 'دیدن راهکار',
		items: [
			{
				title: 'پیج‌های فروش اینستاگرامی',
				desc: 'قیمت، موجودی و لینک خرید را در دایرکت و کامنت پاسخ دهید؛ خودکار و با لحن خودتان.',
				fit: 'برای پوشاک، آرایشی، اکسسوری و فروشندگان خانگی',
				href: '/solutions/instagram',
				icon: InstagramIcon,
			},
			{
				title: 'فروشگاه‌های آنلاین و ووکامرس',
				desc: 'محصول پیشنهاد دهید، موجودی را دقیق بگویید و وضعیت سفارش را همان‌جا پاسخ دهید.',
				fit: 'برای فروشگاه‌هایی با کاتالوگ و سفارش روزانه',
				href: '/solutions/ecommerce-ai',
				icon: ShoppingBag,
			},
			{
				title: 'خدمات، مشاوره و رزرو',
				desc: 'سؤال‌های اولیه و اطلاعات متقاضی را بگیرید و درخواست جدی را خلاصه‌شده تحویل دهید.',
				fit: 'برای کلینیک، سالن، آژانس، تعمیر و خدمات تخصصی',
				href: '/solutions/customer-support-ai',
				icon: CalendarCheck2,
			},
			{
				title: 'آموزشگاه‌ها و فروش دوره',
				desc: 'دوره مناسب، پیش‌نیاز و شرایط ثبت‌نام را توضیح دهید و علاقه‌مندی را ثبت کنید.',
				fit: 'برای مدرس، موسسه، بوت‌کمپ و دوره آنلاین',
				href: '/solutions/persian-ai-chatbot',
				icon: GraduationCap,
			},
			{
				title: 'پشتیبانی در پیام‌رسان‌ها',
				desc: 'تلگرام، بله و روبیکا را با یک ایجنت آگاه پاسخ دهید و همه را در یک صندوق ببینید.',
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
			{ title: 'Instagram sellers', desc: 'Handle DMs, comments and story replies with live prices, stock, product cards and automated follow-up.', fit: 'For fashion, beauty, accessories and home sellers', href: '/solutions/instagram', icon: InstagramIcon },
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
		<section id="businesses" className="marketing-story-section bg-white py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="max-w-4xl border-t border-black/10 pt-6">
					<p className="marketing-eyebrow">{copy.eyebrow}</p>
					<h2 className="marketing-heading mt-4">{copy.title}</h2>
					<p className="marketing-subtitle mt-4">{copy.subtitle}</p>
				</div>

				<div className="mt-9 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
					{copy.items.map(({ title, desc, fit, href, icon: Icon }, index) => (
						<Link
							key={title}
							href={href}
							className={`group relative min-h-[230px] flex-col overflow-hidden rounded-[1.35rem] border border-black/10 bg-[#f5f6f3] p-5 text-black transition-[background-color,border-color,transform] duration-300 hover:-translate-y-1 hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:p-6 ${index > 2 ? 'hidden md:flex' : 'flex'} ${index < 2 ? 'lg:col-span-3' : 'lg:col-span-2'}`}
						>
							<div className="flex items-center justify-between">
								<span className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white">
									<Icon className="h-[18px] w-[18px]" aria-hidden />
								</span>
								<span className="text-[9px] font-medium uppercase tracking-[0.12em] text-black/30">Vigent</span>
							</div>
							<h3 className="mt-6 text-lg font-medium leading-snug sm:text-xl">{title}</h3>
							<p className="mt-2.5 text-[13px] leading-6 text-black/60">{desc}</p>
							<div className="mt-auto border-t border-black/10 pt-3.5">
								<p className="text-[11px] leading-5 text-black/55">{fit}</p>
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
