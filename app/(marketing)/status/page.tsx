import { getTranslations, getLocale } from 'next-intl/server'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { runHealthChecks, type HealthReport } from '@/lib/health'

export const dynamic = 'force-dynamic'

const META: Record<
  HealthReport['status'],
  { color: string; Icon: typeof CheckCircle2 }
> = {
  operational: { color: 'var(--green)', Icon: CheckCircle2 },
  degraded: { color: 'var(--amber)', Icon: AlertTriangle },
  down: { color: 'var(--red)', Icon: XCircle },
}

export default async function StatusPage() {
  const t = await getTranslations('status')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const report = await runHealthChecks()
  const { color, Icon } = META[report.status]

  return (
    <section className="min-h-screen bg-black px-6 py-32">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-light text-white md:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-white/45">{t('subtitle')}</p>

        {/* Overall banner */}
        <div
          className="mt-10 flex items-center gap-3 rounded-2xl border p-6"
          style={{ borderColor: color, background: 'rgba(255,255,255,0.02)' }}
        >
          <Icon className="h-7 w-7" style={{ color }} />
          <div>
            <div className="text-lg text-white">{t(report.status)}</div>
            <div className="text-xs text-white/40">
              {t('lastChecked')}{' '}
              {new Date(report.checkedAt).toLocaleString(
                locale === 'fa' ? 'fa-IR' : 'en-US',
                { dateStyle: 'medium', timeStyle: 'short' },
              )}
            </div>
          </div>
        </div>

        {/* Per-component */}
        <div className="mt-6 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08]">
          {report.checks.map((c) => (
            <div key={c.name} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: c.ok ? 'var(--green)' : 'var(--red)',
                  }}
                />
                <span className="text-sm text-white">{t(c.name)}</span>
              </div>
              <span className="text-xs text-white/40">
                {c.ok ? `${c.latencyMs} ${t('ms')}` : t('unreachable')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
