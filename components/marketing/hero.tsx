import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
	ArrowLeft,
	Bot,
	Check,
	Clock3,
	MessageCircle,
	Play,
	ShoppingBag,
} from 'lucide-react'

/**
 * The first viewport is a compact product thesis: what Vigent does, where it
 * works, and the business result. Keeping it server-rendered avoids shipping
 * animation code before the visitor has seen the product.
 */
export async function Hero() {
	const t = await getTranslations('marketing.hero')

	return (
		<section className="relative overflow-hidden bg-[var(--bg-base)] pb-10 pt-28 md:pb-12 md:pt-28">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage:
						'radial-gradient(rgba(var(--ink-rgb),0.055) 1px, transparent 1px)',
					backgroundSize: '40px 40px',
					maskImage: 'linear-gradient(to bottom, black, transparent 88%)',
					WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 88%)',
				}}
			/>

			<div className="relative mx-auto max-w-6xl px-5 md:px-6">
				<div className="mx-auto max-w-4xl text-center">
					<span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-xs text-[var(--text-secondary)]">
						<Bot className="h-3.5 w-3.5" />
						{t('badge')}
					</span>

					<h1 className="mt-5 text-balance text-3xl font-light leading-[1.22] text-[var(--text-primary)] sm:text-4xl md:text-5xl md:leading-[1.16]">
						{t('title')}
					</h1>
					<p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-7 text-[var(--text-secondary)] md:text-base md:leading-8">
						{t('subtitle')}
					</p>

					<div className="mt-7 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-center">
						<Link
							href="/login?next=/onboarding"
							className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-[var(--white)] px-3 text-xs font-medium text-[var(--bg-base)] shadow-[0_10px_30px_rgba(var(--ink-rgb),0.14)] transition-transform duration-200 hover:-translate-y-0.5 sm:gap-2 sm:px-7 sm:text-sm"
						>
							{t('ctaPrimary')}
							<ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
						</Link>
						<Link
							href="#demo"
							className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-[var(--border-hover)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] transition-colors duration-200 hover:border-[var(--border-strong)] sm:gap-2 sm:px-7 sm:text-sm"
						>
							<Play className="h-3.5 w-3.5 fill-current" />
							{t('ctaSecondary')}
						</Link>
					</div>
					<p className="mt-4 hidden text-xs leading-6 text-[var(--text-muted)] sm:block">{t('trust')}</p>
				</div>

				{/* A real product story, presented as one unframed surface rather than a mock device. */}
				<div className="mx-auto mt-8 max-w-5xl border-y border-[var(--border-default)] bg-[var(--bg-surface)]/70 px-4 py-4 sm:px-6 md:mt-10 md:py-5">
					<div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr] md:gap-8">
						<div className="min-w-0">
							<div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
								<MessageCircle className="h-3.5 w-3.5" />
								{t('sceneIncoming')}
							</div>
							<div className="space-y-2.5">
								<p className="ms-auto max-w-[88%] rounded-2xl rounded-ee-sm bg-[var(--white)] px-4 py-3 text-sm leading-6 text-[var(--bg-base)]">
									{t('sceneCustomer')}
								</p>
								<div className="max-w-[92%] rounded-2xl rounded-es-sm border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
									<p className="text-sm leading-6 text-[var(--text-primary)]">{t('sceneAgent')}</p>
									<div className="mt-3 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-3">
										<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--white-10)]">
											<ShoppingBag className="h-4 w-4 text-[var(--text-secondary)]" />
										</span>
										<span className="text-start">
											<span className="block text-xs font-medium text-[var(--text-primary)]">{t('sceneProduct')}</span>
											<span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{t('sceneStock')}</span>
										</span>
									</div>
								</div>
							</div>
						</div>

						<div className="hidden h-20 w-px bg-[var(--border-default)] md:block" />

						<div className="hidden md:block">
							<p className="text-xs text-[var(--text-muted)]">{t('sceneResult')}</p>
							<div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
								<Outcome icon={Check} label={t('sceneLead')} />
								<Outcome icon={Clock3} label={t('sceneSpeed')} />
								<Outcome icon={ShoppingBag} label={t('sceneSale')} />
								<Outcome icon={Bot} label={t('sceneFollowup')} />
							</div>
							<p className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-xs leading-6 text-[var(--text-secondary)]">
								{t('sceneChannels')}
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

function Outcome({ icon: Icon, label }: { icon: typeof Check; label: string }) {
	return (
		<div className="flex items-center gap-2.5 text-sm text-[var(--text-primary)]">
			<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-base)]">
				<Icon className="h-3.5 w-3.5" />
			</span>
			<span>{label}</span>
		</div>
	)
}
