import { getTranslations, getLocale } from 'next-intl/server'
import { Activity, AlertTriangle, CheckCircle2, Clock3, Server, XCircle } from 'lucide-react'
import { runHealthChecks, type HealthReport } from '@/lib/health'
import { formatDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

const META: Record<HealthReport['status'], { color: string; Icon: typeof CheckCircle2; tone: string }> = {
	operational: { color: 'var(--success)', Icon: CheckCircle2, tone: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' },
	degraded: { color: 'var(--warning)', Icon: AlertTriangle, tone: 'border-amber-400/20 bg-amber-400/10 text-amber-300' },
	down: { color: 'var(--danger)', Icon: XCircle, tone: 'border-red-400/20 bg-red-400/10 text-red-300' },
}

export default async function StatusPage() {
	const t = await getTranslations('status')
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const report = await runHealthChecks()
	const { color, Icon, tone } = META[report.status]
	const healthy = report.checks.filter((check) => check.ok).length
	const averageLatency = Math.round(report.checks.reduce((sum, check) => sum + check.latencyMs, 0) / Math.max(report.checks.length, 1))
	const checkedAt = formatDateTime(new Date(report.checkedAt), locale)

	return (
		<div className="marketing-page-shell min-h-screen px-3 pb-20 pt-24 sm:px-5 sm:pt-28">
			<div className="mx-auto max-w-6xl">
				<header className="marketing-page-hero marketing-grid-dark px-6 py-10 sm:px-9 sm:py-14">
					<div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
						<div>
							<p className="inline-flex items-center gap-2 text-[10px] font-medium text-white/40"><Activity className="h-3.5 w-3.5" />Vigent System Status</p>
							<h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl rtl:tracking-normal">{t('title')}</h1>
							<p className="mt-4 max-w-2xl text-sm leading-7 text-white/50">{t('subtitle')}</p>
						</div>
						<div className={`inline-flex min-h-12 items-center gap-3 self-start rounded-full border px-5 text-sm font-medium lg:self-auto ${tone}`}>
							<Icon className="h-5 w-5" />{t(report.status)}
						</div>
					</div>
				</header>

				<section className="relative z-10 -mt-5 grid gap-3 px-3 sm:grid-cols-3 sm:px-6">
					<Metric icon={Server} label={locale === 'fa' ? 'سرویس‌های سالم' : 'Healthy services'} value={`${healthy} / ${report.checks.length}`} />
					<Metric icon={Activity} label={locale === 'fa' ? 'میانگین پاسخ' : 'Average response'} value={`${averageLatency} ${t('ms')}`} />
					<Metric icon={Clock3} label={t('lastChecked')} value={checkedAt} small />
				</section>

				<section className="mt-10 overflow-hidden rounded-[1.75rem] border border-black/[0.08] bg-white shadow-[0_18px_55px_rgba(0,0,0,0.07)]">
					<div className="flex items-center justify-between border-b border-black/[0.07] px-5 py-4 sm:px-6">
						<div>
							<h2 className="text-sm font-semibold text-black">{locale === 'fa' ? 'زیرساخت‌های ویجنت' : 'Vigent infrastructure'}</h2>
							<p className="mt-1 text-[10px] text-black/40">{locale === 'fa' ? 'بررسی زنده اتصال و زمان پاسخ هر سرویس' : 'Live connectivity and latency for every service'}</p>
						</div>
						<span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 0 6px color-mix(in srgb, ${color} 12%, transparent)` }} />
					</div>
					<div className="grid md:grid-cols-2">
						{report.checks.map((check, index) => (
							<div key={check.name} className={`flex min-h-20 items-center justify-between gap-4 px-5 py-4 sm:px-6 ${index % 2 === 0 ? 'md:border-e md:border-black/[0.07]' : ''} ${index < report.checks.length - 2 ? 'border-b border-black/[0.07]' : ''}`}>
								<div className="flex min-w-0 items-center gap-3">
									<span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${check.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
										{check.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
									</span>
									<span className="truncate text-sm font-medium text-black">{t(check.name)}</span>
								</div>
								<span className="shrink-0 rounded-full bg-black/[0.035] px-3 py-1.5 font-mono text-[10px] text-black/45">
									{check.ok ? `${check.latencyMs} ${t('ms')}` : t('unreachable')}
								</span>
							</div>
						))}
					</div>
				</section>
			</div>
		</div>
	)
}

function Metric({ icon: Icon, label, value, small = false }: { icon: typeof Activity; label: string; value: string; small?: boolean }) {
	return (
		<div className="spatial-surface flex min-h-28 items-center gap-4 rounded-[1.4rem] p-4 sm:p-5">
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black text-white"><Icon className="h-4 w-4" /></span>
			<div className="min-w-0"><p className="text-[10px] text-black/40">{label}</p><p className={`mt-1 font-semibold text-black ${small ? 'truncate text-xs' : 'text-lg tabular-nums'}`}>{value}</p></div>
		</div>
	)
}
