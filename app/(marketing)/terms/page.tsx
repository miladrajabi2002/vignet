import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { LegalPage, type LegalSection } from '@/components/marketing/legal-page'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

// Per-request rendering: /terms and /en/terms share this route via the
// middleware rewrite, so the copy and metadata must resolve per request
// (see the privacy page and pricing page for the same reasoning).
export const dynamic = 'force-dynamic'

type LegalCopy = {
	title: string
	description: string
	ogTitle: string
	ogDescription: string
	eyebrow: string
	h1: string
	heroDescription: string
	updatedAt: string
	sections: LegalSection[]
}

const COPY: Record<'fa' | 'en', LegalCopy> = {
	fa: {
		title: 'شرایط استفاده',
		description: 'شرایط استفاده از وب‌سایت، داشبورد و سرویس‌های هوش مصنوعی ویجنت.',
		ogTitle: 'شرایط استفاده ویجنت',
		ogDescription: 'قواعد و تعهدات استفاده از وب‌سایت، داشبورد و سرویس‌های ویجنت.',
		eyebrow: 'Vigent Terms',
		h1: 'شرایط استفاده',
		heroDescription: 'قواعدی روشن برای استفاده مسئولانه از ویجنت، حفاظت از حساب و مدیریت سرویس‌های هوش مصنوعی و کانال‌های متصل.',
		updatedAt: 'آخرین به‌روزرسانی: ۳۱ تیر ۱۴۰۵',
		sections: [
			{
				title: 'پذیرش شرایط',
				paragraphs: [
					'با ایجاد حساب یا استفاده از وب‌سایت و سرویس‌های ویجنت، این شرایط و سیاست حریم خصوصی را می‌پذیرید. اگر از طرف یک کسب‌وکار اقدام می‌کنید، تأیید می‌کنید اختیار پذیرش این شرایط را دارید.',
				],
			},
			{
				title: 'ماهیت سرویس',
				paragraphs: [
					'ویجنت ابزارهای مدیریت گفتگو، CRM، اتوماسیون، رزرو، فروش و ایجنت هوش مصنوعی را در اختیار کسب‌وکارها قرار می‌دهد. قابلیت‌ها، محدودیت‌ها و کانال‌های قابل اتصال ممکن است با توجه به پلن، تنظیمات یا دسترسی سرویس‌های ثالث متفاوت باشند.',
				],
			},
			{
				title: 'حساب و مسئولیت کاربر',
				items: [
					'اطلاعات درست ارائه کنید و امنیت شماره تلفن، نشست‌ها و دسترسی اعضای فضای کاری را حفظ کنید.',
					'پیش از بارگذاری یا پردازش داده مشتریان، مجوزها و اطلاع‌رسانی‌های قانونی لازم را فراهم کنید.',
					'پاسخ‌ها، اتوماسیون‌ها و دسترسی‌های ایجنت را متناسب با کسب‌وکار خود تنظیم و به‌طور منظم بازبینی کنید.',
					'در صورت مشاهده دسترسی غیرمجاز یا رخداد امنیتی، موضوع را بدون تأخیر از مسیر پشتیبانی گزارش کنید.',
				],
			},
			{
				title: 'استفاده قابل قبول',
				items: [
					'استفاده غیرقانونی، فریبکارانه، مزاحمت‌آمیز یا ناقض حقوق دیگران مجاز نیست.',
					'ارسال هرزنامه، دورزدن محدودیت‌های فنی، اختلال در سرویس یا تلاش برای دسترسی غیرمجاز ممنوع است.',
					'نباید از ویجنت برای تصمیم‌های پرخطر پزشکی، حقوقی، مالی یا ایمنی بدون بررسی متخصص انسانی استفاده شود.',
					'محتوای بارگذاری‌شده و نحوه استفاده از کانال‌های متصل باید با قوانین و شرایط همان پلتفرم‌ها سازگار باشد.',
				],
			},
			{
				title: 'هوش مصنوعی و نظارت انسانی',
				paragraphs: [
					'خروجی هوش مصنوعی می‌تواند ناقص، نادقیق یا نامتناسب باشد. شما مسئول بررسی تنظیمات، دانش مبنا و خروجی‌هایی هستید که به نام کسب‌وکارتان برای مشتری ارسال می‌شوند. برای موضوعات حساس باید مسیر تحویل به اپراتور انسانی فعال باشد.',
				],
			},
			{
				title: 'پلن، پرداخت و اعتبار',
				paragraphs: [
					'هزینه، دوره، اعتبار و محدودیت هر پلن هنگام خرید نمایش داده می‌شود. مبلغ پرداخت‌شده مربوط به همان دوره و امکانات اعلام‌شده است. مصرف اعتبار هوش مصنوعی و قابلیت‌های رایگان یا مشمول هزینه طبق اطلاعات صفحه تعرفه و داشبورد محاسبه می‌شود.',
					'در صورت پایان دوره، اتمام اعتبار یا پرداخت ناموفق، ممکن است بخشی از قابلیت‌های عملیاتی تا تمدید یا شارژ مجدد محدود شود؛ داده‌های قبلی مطابق سیاست نگهداری حفظ خواهند شد.',
				],
			},
			{
				title: 'مالکیت داده و مجوز پردازش',
				paragraphs: [
					'مالکیت محتوای کسب‌وکار و داده‌هایی که در ویجنت وارد می‌کنید برای شما باقی می‌ماند. شما فقط به اندازه لازم برای میزبانی، پردازش، پشتیبان‌گیری و ارائه قابلیت‌های درخواستی، مجوز پردازش این داده‌ها را به ویجنت می‌دهید.',
					'حقوق نرم‌افزار، طراحی، نام و اجزای اختصاصی ویجنت متعلق به صاحبان آن است و این شرایط حق کپی، فروش مجدد یا مهندسی معکوس سرویس را ایجاد نمی‌کند.',
				],
			},
			{
				title: 'سرویس‌های ثالث و دسترس‌پذیری',
				paragraphs: [
					'عملکرد برخی قابلیت‌ها به پیام‌رسان‌ها، شبکه‌های اجتماعی، مدل‌های هوش مصنوعی، درگاه پرداخت و زیرساخت‌های ثالث وابسته است. تغییر سیاست، قطعی یا محدودیت این سرویس‌ها ممکن است خارج از کنترل ویجنت باشد.',
					'برای پایداری سرویس تلاش می‌کنیم، اما دسترسی بدون وقفه یا بدون خطا تضمین نمی‌شود و نگهداری برنامه‌ریزی‌شده یا رخدادهای اضطراری ممکن است موقتاً بخشی از سرویس را متوقف کند.',
				],
			},
			{
				title: 'تعلیق، خاتمه و تغییر شرایط',
				paragraphs: [
					'در صورت نقض این شرایط، خطر امنیتی، سوءاستفاده یا الزام قانونی ممکن است دسترسی محدود یا تعلیق شود. شما نیز می‌توانید درخواست بستن حساب را از پشتیبانی ثبت کنید.',
					'ممکن است این شرایط با تغییر محصول یا الزامات قانونی به‌روزرسانی شود. تغییرات مهم از طریق سرویس یا همین صفحه اطلاع‌رسانی می‌شوند و ادامه استفاده پس از لازم‌الاجراشدن نسخه جدید به معنی پذیرش آن است.',
				],
			},
			{
				title: 'تماس و حل مسئله',
				paragraphs: [
					'برای پرسش درباره این شرایط، صورتحساب یا عملکرد سرویس، از بخش پشتیبانی داخل داشبورد ویجنت درخواست ثبت کنید تا موضوع همراه با سوابق لازم بررسی شود.',
				],
			},
		],
	},
	en: {
		title: 'Terms of Service',
		description: 'Terms of use for the Vigent website, dashboard and AI services.',
		ogTitle: 'Vigent Terms of Service',
		ogDescription: 'The rules and commitments for using the Vigent website, dashboard and services.',
		eyebrow: 'Vigent Terms',
		h1: 'Terms of Service',
		heroDescription: 'Clear rules for using Vigent responsibly, protecting your account and managing AI services and connected channels.',
		updatedAt: 'Last updated: July 22, 2026',
		sections: [
			{
				title: 'Accepting the terms',
				paragraphs: [
					'By creating an account or using the Vigent website and services, you accept these terms and the privacy policy. If you act on behalf of a business, you confirm that you are authorized to accept these terms.',
				],
			},
			{
				title: 'Nature of the service',
				paragraphs: [
					'Vigent provides businesses with conversation management, CRM, automation, booking, sales and AI agent tooling. Features, limits and connectable channels may vary depending on your plan, configuration or third-party service availability.',
				],
			},
			{
				title: 'Account and user responsibility',
				items: [
					'Provide accurate information and keep your phone number, sessions and workspace member access secure.',
					'Before uploading or processing customer data, secure the required permissions and legal notices.',
					'Configure agent replies, automations and access to fit your business, and review them regularly.',
					'Report unauthorized access or security incidents without delay through the support channel.',
				],
			},
			{
				title: 'Acceptable use',
				items: [
					'Illegal, deceptive, harassing use or use that violates the rights of others is not permitted.',
					'Sending spam, circumventing technical limits, disrupting the service or attempting unauthorized access is prohibited.',
					'Vigent must not be used for high-stakes medical, legal, financial or safety decisions without review by a qualified human expert.',
					'Uploaded content and the way connected channels are used must comply with the rules and terms of those platforms.',
				],
			},
			{
				title: 'AI and human oversight',
				paragraphs: [
					'AI output can be incomplete, inaccurate or inappropriate. You are responsible for reviewing configuration, knowledge bases and the replies sent to customers in your business\u2019s name. For sensitive matters, the human-operator handoff path must be active.',
				],
			},
			{
				title: 'Plans, payment and credit',
				paragraphs: [
					'The price, period, credit and limits of each plan are shown at purchase time. The amount paid applies to that period and the advertised features. AI credit usage and free or billable capabilities are calculated per the pricing page and dashboard.',
					'If the period ends, credit runs out or a payment fails, some operational capabilities may be limited until renewal or a top-up; existing data is retained under the retention policy.',
				],
			},
			{
				title: 'Data ownership and processing license',
				paragraphs: [
					'You keep ownership of your business content and the data you enter into Vigent. You grant Vigent only the license needed to host, process, back up and deliver the requested capabilities.',
					'Software rights, design, naming and proprietary components of Vigent belong to their owners; these terms grant no right to copy, resell or reverse-engineer the service.',
				],
			},
			{
				title: 'Third-party services and availability',
				paragraphs: [
					'Some capabilities depend on messaging platforms, social networks, AI models, payment gateways and third-party infrastructure. Policy changes, outages or restrictions in those services can be outside Vigent\u2019s control.',
					'We work to keep the service stable, but uninterrupted or error-free access is not guaranteed; scheduled maintenance or emergency incidents may temporarily pause parts of the service.',
				],
			},
			{
				title: 'Suspension, termination and changes',
				paragraphs: [
					'Access may be limited or suspended for violations of these terms, security risk, abuse or legal requirements. You can also request account closure through support.',
					'These terms may be updated as the product or legal requirements change. Material changes are announced via the service or this page; continued use after a new version takes effect means acceptance of it.',
				],
			},
			{
				title: 'Contact and issue resolution',
				paragraphs: [
					'For questions about these terms, billing or how the service works, open a request via the support section inside the Vigent dashboard so the matter can be reviewed with the necessary history.',
				],
			},
		],
	},
}

export async function generateMetadata(): Promise<Metadata> {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const url = locale === 'en' ? `${SITE_URL}/en/terms` : `${SITE_URL}/terms`
	return {
		title: copy.title,
		description: copy.description,
		alternates: {
			canonical: url,
			languages: {
				fa: `${SITE_URL}/terms`,
				en: `${SITE_URL}/en/terms`,
				'x-default': `${SITE_URL}/terms`,
			},
		},
		openGraph: {
			type: 'website',
			url,
			title: copy.ogTitle,
			description: copy.ogDescription,
		},
	}
}

export default async function TermsPage() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	return (
		<LegalPage
			eyebrow={copy.eyebrow}
			title={copy.h1}
			description={copy.heroDescription}
			updatedAt={copy.updatedAt}
			sections={copy.sections}
		/>
	)
}
