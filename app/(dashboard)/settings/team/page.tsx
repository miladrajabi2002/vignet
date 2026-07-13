import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { CustomerAccountCard } from '@/components/settings/customer-account-card'

export default async function TeamPage() {
  const sessionUser = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { name: true, phone: true, language: true },
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Vigento AI</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{locale === 'fa' ? 'تنظیمات مشتری' : 'Customer settings'}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{locale === 'fa' ? 'اطلاعات حساب، زبان و شناسه ورود خود را مدیریت کنید.' : 'Manage your profile, language and sign-in identity.'}</p>
      </div>
      <CustomerAccountCard initialName={user.name ?? ''} phone={user.phone} initialLanguage={user.language} locale={locale} />
    </div>
  )
}
