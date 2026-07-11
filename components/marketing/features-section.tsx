'use client'

import type { ComponentType } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	Bot,
	Check,
	Database,
	Gauge,
	GraduationCap,
	MessageSquareMore,
	Mic2,
	Package,
	Sparkles,
	UserRoundCheck,
	Workflow,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

type Capability = {
	title: string
	desc: string
	icon: ComponentType<{ className?: string }>
}

const COPY: Record<'fa' | 'en', {
	eyebrow: string
	titleLead: string
	titleRest: string
	subtitle: string
	panelTitle: string
	panelNote: string
	live: string
	previewLabel: string
	preview: string
	layers: { label: string; value: string }[]
	capabilities: Capability[]
}> = {
	fa: {
		eyebrow: 'قابل تنظیم، نه یک ربات آماده',
		titleLead: 'ایجنت شما',
		titleRest: 'با دانش، لحن و قوانین خودتان',
		subtitle: 'از شخصیت و مرز پاسخ‌گویی تا محصولات، کانال‌ها و تحویل به اپراتور را خودتان کنترل می‌کنید؛ بدون نوشتن پرامپت پیچیده.',
		panelTitle: 'موتور شخصیت ۶ لایه',
		panelNote: 'هر لایه مستقل و قابل ویرایش است',
		live: 'فعال',
		previewLabel: 'نمونه رفتار ایجنت',
		preview: 'کوتاه، صمیمی و دقیق پاسخ بده؛ فقط از اطلاعات تأییدشده فروشگاه استفاده کن و برای موضوعات مالی گفتگو را به همکار بسپار.',
		layers: [
			{ label: 'شخصیت', value: 'مشاور فروش دقیق و خوش‌برخورد' },
			{ label: 'لحن برند', value: 'صمیمی، کوتاه و محترمانه' },
			{ label: 'محدوده و قوانین', value: 'محصول و سفارش؛ بدون حدس و فقط اطلاعات تأییدشده' },
			{ label: 'وقتی پاسخ را نمی‌داند', value: 'شفاف بگوید و گفتگو را به همکار بسپارد' },
			{ label: 'قالب پاسخ', value: 'پاسخ کوتاه + اقدام بعدی' },
			{ label: 'مثال‌های واقعی', value: 'پرسش و پاسخ‌های مورد تأیید شما' },
		],
		capabilities: [
			{ title: 'پایگاه دانش', desc: 'فایل، سایت و سؤال‌های پرتکرار', icon: Database },
			{ title: 'محصول و موجودی', desc: 'کاتالوگ، قیمت و ووکامرس', icon: Package },
			{ title: 'اتوماسیون اینستاگرام', desc: 'دایرکت، کامنت و پاسخ استوری', icon: InstagramIcon },
			{ title: 'صندوق و CRM', desc: 'گفتگو، مشتری و پیگیری در یک پنل', icon: MessageSquareMore },
			{ title: 'پیام صوتی فارسی', desc: 'شنیدن، فهمیدن و پاسخ صوتی', icon: Mic2 },
			{ title: 'تحویل به همکار', desc: 'همراه خلاصه و اطلاعات مشتری', icon: UserRoundCheck },
			{ title: 'مرکز یادگیری', desc: 'یادگیری فقط بعد از تأیید شما', icon: GraduationCap },
			{ title: 'بینش و گزارش', desc: 'تحلیل گفتگو، رضایت مشتری و آمار عملکرد', icon: Gauge },
		],
	},
	en: {
		eyebrow: 'Configurable, not a generic bot',
		titleLead: 'Your agent',
		titleRest: 'with your knowledge, voice and rules',
		subtitle: 'Control personality, reply boundaries, products, channels and human handoff without writing a complicated prompt.',
		panelTitle: 'Six-layer personality engine',
		panelNote: 'Every layer is independently editable',
		live: 'Live',
		previewLabel: 'Agent behavior preview',
		preview: 'Reply clearly and briefly, use only approved store information, and hand financial issues to a teammate.',
		layers: [
			{ label: 'Personality', value: 'Accurate, friendly sales advisor' },
			{ label: 'Brand voice', value: 'Warm, concise and respectful' },
			{ label: 'Scope and rules', value: 'Products and orders; never guess beyond approved facts' },
			{ label: 'When unsure', value: 'Say so clearly and hand the conversation to a teammate' },
			{ label: 'Reply format', value: 'Short answer plus next action' },
			{ label: 'Real examples', value: 'Your approved question-answer pairs' },
		],
		capabilities: [
			{ title: 'Knowledge base', desc: 'Files, website and common questions', icon: Database },
			{ title: 'Products and stock', desc: 'Catalog, prices and WooCommerce', icon: Package },
			{ title: 'Instagram automation', desc: 'DMs, comments and story replies', icon: InstagramIcon },
			{ title: 'Inbox and CRM', desc: 'Conversations, contacts and follow-up', icon: MessageSquareMore },
			{ title: 'Persian voice', desc: 'Understand and answer voice notes', icon: Mic2 },
			{ title: 'Human handoff', desc: 'With a summary and customer context', icon: UserRoundCheck },
			{ title: 'Learning center', desc: 'Learns only after your approval', icon: GraduationCap },
			{ title: 'Insights and reports', desc: 'Conversation trends, customer satisfaction and performance analytics', icon: Gauge },
		],
	},
}

function LayerPanel() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<div className="overflow-hidden rounded-[1.4rem] border border-white/12 bg-white/[0.055]">
			<div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-5">
				<div className="flex items-center gap-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black"><Bot className="h-4 w-4" aria-hidden /></span>
					<div><p className="text-sm font-medium text-white">{copy.panelTitle}</p><p className="mt-0.5 text-[11px] text-white/60">{copy.panelNote}</p></div>
				</div>
				<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{copy.live}</span>
			</div>

			<div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
				{copy.layers.map((layer, index) => (
					<motion.div
						key={layer.label}
						initial={{ opacity: 0, y: reduce ? 0 : 8 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: '-30px' }}
						transition={{ duration: 0.35, delay: index * 0.045 }}
						className="rounded-xl border border-white/10 bg-black/25 p-3"
					>
						<div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-200"><Check className="h-3 w-3" aria-hidden /></span><p className="text-[11px] font-medium text-white/85">{layer.label}</p><span className="ms-auto font-mono text-[9px] text-white/35">0{index + 1}</span></div>
						<p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/60">{layer.value}</p>
					</motion.div>
				))}
			</div>

			<div className="m-3 mt-0 rounded-xl bg-white p-3.5 text-black sm:m-4 sm:mt-0">
				<div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-emerald-600" aria-hidden /><p className="text-[11px] font-semibold">{copy.previewLabel}</p></div>
				<p className="mt-2 text-[11px] leading-5 text-black/65">{copy.preview}</p>
			</div>
		</div>
	)
}

export function FeaturesSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<section id="features" className="marketing-story-section bg-black py-16 text-white sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="grid gap-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-12">
					<div className="border-t border-white/15 pt-6">
						<p className="marketing-eyebrow !text-white/50">{copy.eyebrow}</p>
						<h2 className="mt-4 font-semibold leading-[1.3] text-white">
							<span className="block text-[clamp(1.75rem,3.2vw,2.75rem)]">{copy.titleLead}</span>
							<span className={`mt-1 block whitespace-nowrap ${locale === 'fa' ? 'text-[clamp(1.08rem,3vw,2.15rem)]' : 'text-[clamp(0.96rem,2.55vw,2rem)]'}`}>{copy.titleRest}</span>
						</h2>
						<p className="marketing-subtitle mt-4 !text-white/58">{copy.subtitle}</p>
						<div className="mt-7 hidden items-center gap-2 text-[11px] text-white/55 lg:flex"><Workflow className="h-4 w-4" aria-hidden /><span>{locale === 'fa' ? 'از قالب آماده شروع کنید و هر جزئیات را تغییر دهید' : 'Start from a template and change every detail'}</span></div>
					</div>
					<LayerPanel />
				</div>

				<div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:gap-3">
					{copy.capabilities.map(({ title, desc, icon: Icon }, index) => (
						<motion.article
							key={title}
							initial={{ opacity: 0, y: reduce ? 0 : 10 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: '-40px' }}
							transition={{ duration: 0.4, delay: (index % 4) * 0.05 }}
							className="min-h-36 rounded-2xl border border-white/10 bg-white/[0.055] p-3.5 sm:min-h-40 sm:p-4"
						>
							<span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/25"><Icon className="h-4 w-4 text-white/65" aria-hidden /></span>
							<h3 className="mt-4 text-sm font-medium leading-5 text-white/90">{title}</h3>
							<p className="mt-1.5 text-[11px] leading-5 text-white/60">{desc}</p>
						</motion.article>
					))}
				</div>
			</div>
		</section>
	)
}
