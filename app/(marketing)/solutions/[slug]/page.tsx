import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { SOLUTIONS, getSolution } from '@/lib/marketing/solutions'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

export function generateStaticParams() {
	return SOLUTIONS.map((s) => ({ slug: s.slug }))
}

export function generateMetadata({
	params,
}: {
	params: { slug: string }
}): Metadata {
	const solution = getSolution(params.slug)
	if (!solution) return {}
	return {
		title: solution.metaTitle,
		description: solution.metaDescription,
		alternates: { canonical: `${SITE_URL}/solutions/${solution.slug}` },
		openGraph: {
			title: solution.metaTitle,
			description: solution.metaDescription,
			url: `${SITE_URL}/solutions/${solution.slug}`,
			type: 'website',
		},
	}
}

export default function SolutionPage({
	params,
}: {
	params: { slug: string }
}) {
	const solution = getSolution(params.slug)
	if (!solution) notFound()

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: solution.faq.map((f) => ({
			'@type': 'Question',
			name: f.q,
			acceptedAnswer: { '@type': 'Answer', text: f.a },
		})),
	}

	return (
		<div className="bg-[var(--bg-base)]">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>

			{/* Hero */}
			<section className="mx-auto max-w-3xl px-6 pb-16 pt-32 text-center md:pt-40">
				<h1 className="text-3xl font-medium leading-tight text-[var(--text-primary)] md:text-4xl">
					{solution.title}
				</h1>
				<p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--text-secondary)]">
					{solution.subtitle}
				</p>
				<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
					<Link
						href="/login"
						className="inline-flex items-center gap-2 rounded-full bg-[var(--white)] px-6 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
					>
						شروع رایگان — ۱۴ روز
					</Link>
					<Link
						href="/#demo"
						className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] px-6 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
					>
						مشاهده دمو
					</Link>
				</div>
				<p className="mt-4 text-xs text-[var(--text-muted)]">
					بدون نیاز به کارت بانکی · راه‌اندازی در کمتر از ۵ دقیقه
				</p>
			</section>

			{/* Benefits */}
			<section className="mx-auto max-w-4xl px-6 py-16">
				<div className="grid gap-4 sm:grid-cols-2">
					{solution.benefits.map((b) => (
						<div
							key={b.title}
							className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
						>
							<h2 className="text-sm font-medium text-[var(--text-primary)]">
								{b.title}
							</h2>
							<p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
								{b.desc}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* Steps */}
			<section className="mx-auto max-w-3xl px-6 py-16">
				<h2 className="text-center text-xl font-medium text-[var(--text-primary)]">
					راه‌اندازی در سه قدم
				</h2>
				<ol className="mx-auto mt-8 max-w-xl space-y-4">
					{solution.steps.map((step, i) => (
						<li key={i} className="flex items-start gap-3">
							<span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-xs font-medium text-[var(--text-primary)]">
								{(i + 1).toLocaleString('fa-IR')}
							</span>
							<p className="text-sm leading-relaxed text-[var(--text-secondary)]">
								{step}
							</p>
						</li>
					))}
				</ol>
			</section>

			{/* FAQ */}
			<section className="mx-auto max-w-3xl px-6 py-16">
				<h2 className="text-center text-xl font-medium text-[var(--text-primary)]">
					سوالات متداول
				</h2>
				<div className="mt-8 space-y-3">
					{solution.faq.map((f) => (
						<div
							key={f.q}
							className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
						>
							<h3 className="flex items-start gap-2 text-sm font-medium text-[var(--text-primary)]">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
								{f.q}
							</h3>
							<p className="mt-2 ps-6 text-sm leading-relaxed text-[var(--text-secondary)]">
								{f.a}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* CTA */}
			<section className="mx-auto max-w-3xl px-6 pb-24 pt-8 text-center">
				<div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-12">
					<h2 className="text-xl font-medium text-[var(--text-primary)]">
						ایجنت هوشمند خود را امروز بسازید
					</h2>
					<p className="mt-2 text-sm text-[var(--text-secondary)]">
						۱۴ روز رایگان — فقط با شماره موبایل
					</p>
					<Link
						href="/login"
						className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--white)] px-6 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
					>
						شروع رایگان
						<ArrowLeft className="h-4 w-4 rtl:rotate-180" />
					</Link>
				</div>
			</section>
		</div>
	)
}
