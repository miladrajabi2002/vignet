import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { LegalPage, type LegalSection } from '@/components/marketing/legal-page'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

// Per-request rendering: /privacy and /en/privacy share this route via the
// middleware rewrite. A statically prerendered shell would bake the fa copy
// (and fa metadata) into the English URL — the same "mixed shell" problem the
// pricing page solved with force-dynamic.
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
		title: 'حریم خصوصی',
		description: 'سیاست حریم خصوصی ویجنت و توضیح نحوه جمع‌آوری، استفاده، نگهداری و حفاظت از داده‌ها.',
		ogTitle: 'حریم خصوصی ویجنت',
		ogDescription: 'نحوه جمع‌آوری، استفاده، نگهداری و حفاظت از داده‌ها در ویجنت.',
		eyebrow: 'Vigent Privacy',
		h1: 'حریم خصوصی',
		heroDescription: 'شفاف می‌گوییم چه داده‌ای برای ارائه سرویس لازم است، چرا پردازش می‌شود و چه انتخاب‌هایی در اختیار شماست.',
		updatedAt: 'آخرین به‌روزرسانی: ۳۱ تیر ۱۴۰۵',
		sections: [
			{
				title: 'دامنه این سیاست',
				paragraphs: [
					'این سیاست توضیح می‌دهد ویجنت هنگام استفاده شما از وب‌سایت، داشبورد، ایجنت‌های هوشمند و اتصال‌های ارتباطی چه داده‌هایی را دریافت می‌کند و چگونه از آن‌ها استفاده می‌شود.',
				],
			},
			{
				title: 'داده‌هایی که دریافت می‌کنیم',
				items: [
					'اطلاعات حساب و فضای کاری، مانند نام، شماره تلفن و تنظیمات کسب‌وکار.',
					'محتوایی که خودتان وارد می‌کنید؛ از جمله اسناد دانش، محصولات، قوانین پاسخ‌گویی و تنظیمات ایجنت.',
					'پیام‌ها و اطلاعات مخاطبان که از کانال‌های متصل برای ارائه سرویس پردازش می‌شوند.',
					'اطلاعات فنی و کاربردی مانند رخدادهای امنیتی، گزارش خطا، نوع مرورگر، زمان استفاده و مصرف سرویس.',
					'اطلاعات پرداخت و اشتراک؛ اطلاعات حساس کارت بانکی مستقیماً توسط درگاه پرداخت پردازش می‌شود.',
				],
			},
			{
				title: 'هدف استفاده از داده‌ها',
				items: [
					'ارائه، نگهداری و بهبود قابلیت‌های ویجنت و پاسخ‌گویی به درخواست‌های شما.',
					'اجرای اتوماسیون‌ها، پردازش گفتگوها و نمایش گزارش‌های فضای کاری شما.',
					'حفاظت از حساب‌ها، جلوگیری از سوءاستفاده و بررسی رخدادهای امنیتی.',
					'مدیریت اشتراک، محاسبه مصرف و انجام الزامات مالی و قانونی.',
					'ارسال پیام‌های ضروری درباره سرویس، امنیت یا تغییرات مهم شرایط استفاده.',
				],
			},
			{
				title: 'سرویس‌دهندگان و انتقال داده',
				paragraphs: [
					'برای ارائه سرویس ممکن است از ارائه‌دهندگان زیرساخت، پایگاه داده، هوش مصنوعی، پیام‌رسان، ایمیل و پرداخت استفاده کنیم. فقط داده لازم برای انجام همان خدمت در اختیار آن‌ها قرار می‌گیرد و هر اتصال تابع سیاست‌های سرویس‌دهنده مربوط نیز هست.',
					'ویجنت اطلاعات شخصی شما را برای تبلیغات به اشخاص ثالث نمی‌فروشد. افشای اطلاعات فقط در چارچوب ارائه سرویس، درخواست معتبر قانونی یا حفاظت از حقوق و امنیت کاربران انجام می‌شود.',
				],
			},
			{
				title: 'نگهداری و امنیت',
				paragraphs: [
					'داده‌ها تا زمانی نگهداری می‌شوند که برای ارائه سرویس، انجام تعهدات قراردادی، حل اختلاف یا رعایت الزامات قانونی لازم باشند. مدت نگهداری می‌تواند بسته به نوع داده و وضعیت حساب متفاوت باشد.',
					'از کنترل دسترسی، ثبت رخداد، ارتباطات رمزگذاری‌شده و تدابیر فنی متناسب برای کاهش خطر دسترسی غیرمجاز استفاده می‌کنیم؛ با این حال هیچ سامانه اینترنتی امنیت مطلق را تضمین نمی‌کند.',
				],
			},
			{
				title: 'انتخاب‌ها و حقوق شما',
				items: [
					'می‌توانید اطلاعات حساب و تنظیمات فضای کاری را از داخل داشبورد مشاهده یا اصلاح کنید.',
					'برای دریافت نسخه داده‌ها، اصلاح اطلاعات نادرست یا درخواست حذف حساب می‌توانید از مسیر پشتیبانی داخل ویجنت درخواست ثبت کنید.',
					'ممکن است بخشی از اطلاعات برای انجام تعهدات قانونی، امنیتی یا مالی حتی پس از درخواست حذف نگهداری شود.',
				],
			},
			{
				title: 'کوکی‌ها، کاربران خردسال و تغییرات',
				paragraphs: [
					'ویجنت از کوکی‌ها و فناوری‌های مشابه برای ورود امن، حفظ نشست و عملکرد اصلی محصول استفاده می‌کند. این سرویس برای استفاده مستقل افراد زیر سن قانونی طراحی نشده است.',
					'ممکن است این سیاست با تکامل محصول یا الزامات قانونی اصلاح شود. نسخه جدید در همین نشانی منتشر و تاریخ به‌روزرسانی آن اعلام خواهد شد.',
				],
			},
			{
				title: 'تماس با ما',
				paragraphs: [
					'برای پرسش‌های حریم خصوصی یا درخواست مرتبط با داده‌های خود، از بخش پشتیبانی داخل داشبورد ویجنت پیام بفرستید تا درخواست به شکل قابل پیگیری بررسی شود.',
				],
			},
		],
	},
	en: {
		title: 'Privacy Policy',
		description: 'Vigent privacy policy: what data we collect, why we process it, how long we keep it, and how it is protected.',
		ogTitle: 'Vigent Privacy Policy',
		ogDescription: 'How data is collected, used, retained and protected in Vigent.',
		eyebrow: 'Vigent Privacy',
		h1: 'Privacy Policy',
		heroDescription: 'We state plainly which data the service needs, why it is processed, and the choices you have.',
		updatedAt: 'Last updated: July 22, 2026',
		sections: [
			{
				title: 'Scope of this policy',
				paragraphs: [
					'This policy explains what data Vigent receives when you use the website, dashboard, AI agents and connected channels, and how that data is used.',
				],
			},
			{
				title: 'Data we receive',
				items: [
					'Account and workspace information, such as your name, phone number and business settings.',
					'Content you enter yourself, including knowledge documents, products, reply policies and agent settings.',
					'Messages and contact information processed from connected channels in order to deliver the service.',
					'Technical and usage information such as security events, error reports, browser type, usage times and service consumption.',
					'Payment and subscription information; sensitive card data is processed directly by the payment gateway.',
				],
			},
			{
				title: 'Why we use the data',
				items: [
					'Providing, maintaining and improving Vigent capabilities and responding to your requests.',
					'Running automations, processing conversations and rendering your workspace reports.',
					'Protecting accounts, preventing abuse and investigating security events.',
					'Managing subscriptions, calculating usage and meeting financial and legal obligations.',
					'Sending essential messages about the service, security or important changes to the terms.',
				],
			},
			{
				title: 'Service providers and data transfer',
				paragraphs: [
					'To deliver the service we may rely on providers of infrastructure, databases, AI models, messaging platforms, email and payments. They only receive the data required for that specific service, and each connection is also governed by the relevant provider\u2019s policies.',
					'Vigent does not sell your personal information to third parties for advertising. Disclosure only happens within the framework of service delivery, a valid legal request, or the protection of users\u2019 rights and safety.',
				],
			},
			{
				title: 'Retention and security',
				paragraphs: [
					'Data is retained as long as necessary to deliver the service, meet contractual obligations, resolve disputes or comply with legal requirements. Retention periods can vary by data type and account status.',
					'We use access controls, event logging, encrypted communications and proportionate technical measures to reduce the risk of unauthorized access; however, no internet-connected system can guarantee absolute security.',
				],
			},
			{
				title: 'Your choices and rights',
				items: [
					'You can view or correct account and workspace settings directly inside the dashboard.',
					'To request a copy of your data, correct inaccurate information or delete your account, open a request through the in-product support channel.',
					'Some information may be retained after a deletion request to meet legal, security or financial obligations.',
				],
			},
			{
				title: 'Cookies, minors and changes',
				paragraphs: [
					'Vigent uses cookies and similar technologies for secure sign-in, session continuity and core product functionality. The service is not designed for independent use by people under the legal age.',
					'This policy may be revised as the product or legal requirements evolve. The new version will be published at this address with its update date noted.',
				],
			},
			{
				title: 'Contact us',
				paragraphs: [
					'For privacy questions or requests about your data, send a message via the support section inside the Vigent dashboard so the request can be tracked end to end.',
				],
			},
		],
	},
}

export async function generateMetadata(): Promise<Metadata> {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const url = locale === 'en' ? `${SITE_URL}/en/privacy` : `${SITE_URL}/privacy`
	return {
		title: copy.title,
		description: copy.description,
		alternates: {
			canonical: url,
			languages: {
				fa: `${SITE_URL}/privacy`,
				en: `${SITE_URL}/en/privacy`,
				'x-default': `${SITE_URL}/privacy`,
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

export default async function PrivacyPage() {
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
