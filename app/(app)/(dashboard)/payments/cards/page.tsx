import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { CardsManager } from '@/components/payments/cards-manager'
import { loadGatewayOverview } from '@/lib/payments/card/dashboard'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('کارت‌های درگاه', 'Gateway cards')

export const dynamic = 'force-dynamic'

export default async function PaymentCardsPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const fa = locale === 'fa'
  const overview = await loadGatewayOverview(user.workspaceId)
  return (
    <PaymentsShell active="cards" overview={overview} locale={locale}>
      <CardsManager cards={overview.cards} />
      {overview.cards.length > 1 && (
        <p className="max-w-2xl text-[13px] leading-7 text-[var(--text-muted)]">
          {fa
            ? 'با چند کارت فعال، هر پرداخت تازه به کارتی می‌رود که امروز کمتر دریافت کرده است. کارت خاموش به هیچ مشتری‌ای نشان داده نمی‌شود.'
            : 'With several active cards, each new payment goes to the card that received least today. A switched-off card is never shown to a customer.'}
        </p>
      )}
    </PaymentsShell>
  )
}
