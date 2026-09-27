import Link from 'next/link'
import { BellRing, ClipboardList, MessageSquareText } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { CommerceTabs } from '@/components/products/commerce-tabs'
import { ChatRequestAction } from '@/components/products/chat-request-action'
import { displayPhone } from '@/lib/phone'
import { dateLocaleTag } from '@/lib/localized-date'

type DraftItem = { name?: string; variant?: string | null; quantity?: number }

function draftItems(value: unknown): DraftItem[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as DraftItem[]) : []
}

const DRAFT_TONE: Record<string, string> = {
  SUBMITTED: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
}

/**
 * In-chat pre-orders the customer confirmed (the operator arranges payment
 * and delivery) and the back-in-stock waiting list grouped by product.
 */
export default async function ChatRequestsPage() {
  const user = await requireUser()
  const t = await getTranslations('products.requests')
  const productsT = await getTranslations('products')
  const locale = await getLocale()
  const isEn = locale === 'en'
  const numberLocale = isEn ? 'en-US' : 'fa-IR'
  const dateFormatter = new Intl.DateTimeFormat(dateLocaleTag(isEn ? 'en' : 'fa'), { dateStyle: 'medium', timeStyle: 'short' })

  const [drafts, alerts] = await Promise.all([
    prisma.orderDraft.findMany({
      where: { workspaceId: user.workspaceId, status: { in: ['SUBMITTED', 'CONFIRMED', 'CANCELLED'] }, submittedAt: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 60,
    }),
    prisma.restockAlert.findMany({
      where: { workspaceId: user.workspaceId, status: { in: ['ACTIVE', 'NEEDS_FOLLOW_UP', 'SENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { conversation: { select: { contact: { select: { name: true, phone: true } } } } },
    }),
  ])

  const byProduct = new Map<string, { name: string; alerts: typeof alerts }>()
  for (const alert of alerts) {
    const key = `${alert.productId}:${alert.variationId ?? ''}`
    const label = alert.variantLabel ? `${alert.productName} — ${alert.variantLabel}` : alert.productName
    const entry = byProduct.get(key) ?? { name: label, alerts: [] }
    entry.alerts.push(alert)
    byProduct.set(key, entry)
  }
  const groups = [...byProduct.values()].sort((left, right) => right.alerts.length - left.alerts.length)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader icon={MessageSquareText} title={t('title')} subtitle={t('subtitle')} />

      <CommerceTabs
        active="requests"
        productsLabel={productsT('title')}
        ordersLabel={productsT('orders.title')}
        requestsLabel={productsT('orders.requestsTab')}
      />

      <section className="spatial-surface rounded-[1.5rem] !bg-white p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
          <ClipboardList className="h-4 w-4" /> {t('draftsTitle')}
        </h2>
        {drafts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{t('draftsEmpty')}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {drafts.map((draft) => (
              <li key={draft.id} className="rounded-2xl border border-[var(--border-subtle)] p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="font-mono text-sm font-bold text-[var(--text-primary)]">#{draft.code}</span>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', DRAFT_TONE[draft.status] ?? DRAFT_TONE.CANCELLED)}>
                    {t(`draftStatus.${draft.status}` as 'draftStatus.SUBMITTED')}
                  </span>
                  <span className="ms-auto text-xs text-[var(--text-muted)]">
                    {dateFormatter.format(draft.submittedAt ?? draft.createdAt)}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">{t('items')}</dt>
                    <dd className="mt-0.5 text-[var(--text-primary)]">
                      {draftItems(draft.items).map((item, index) => (
                        <p key={index}>
                          {item.name}{item.variant ? ` — ${item.variant}` : ''} × {(item.quantity ?? 1).toLocaleString(numberLocale)}
                        </p>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">{t('customer')}</dt>
                    <dd className="mt-0.5 text-[var(--text-primary)]">
                      {draft.customerName ?? '—'}
                      {draft.customerPhone && <span dir="ltr" className="ms-2 text-[var(--text-secondary)]">{displayPhone(draft.customerPhone)}</span>}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--text-muted)]">{t('address')}</dt>
                    <dd className="mt-0.5 leading-6 text-[var(--text-primary)]">
                      {[draft.city, draft.address].filter(Boolean).join(isEn ? ', ' : '، ')}
                      {draft.postalCode ? ` · ${draft.postalCode}` : ''}
                    </dd>
                  </div>
                  {draft.total != null && (
                    <div>
                      <dt className="text-xs text-[var(--text-muted)]">{t('amount')}</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-[var(--text-primary)]">
                        {draft.total.toLocaleString(numberLocale)} {isEn ? 'Toman' : 'تومان'}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/conversations/${draft.conversationId}`}
                    className="inline-flex min-h-9 items-center rounded-xl border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                  >
                    {t('conversation')}
                  </Link>
                  {draft.status === 'SUBMITTED' && (
                    <>
                      <ChatRequestAction endpoint={`/api/commerce/order-drafts/${draft.id}`} status="CONFIRMED" label={t('confirm')} errorLabel={t('actionError')} tone="primary" />
                      <ChatRequestAction endpoint={`/api/commerce/order-drafts/${draft.id}`} status="CANCELLED" label={t('cancel')} errorLabel={t('actionError')} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="spatial-surface rounded-[1.5rem] !bg-white p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
          <BellRing className="h-4 w-4" /> {t('restockTitle')}
        </h2>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{t('restockEmpty')}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {groups.map((group) => {
              const followUp = group.alerts.filter((alert) => alert.status === 'NEEDS_FOLLOW_UP').length
              return (
                <li key={group.name} className="rounded-2xl border border-[var(--border-subtle)] p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{group.name}</span>
                    <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                      {t('waiting', { count: group.alerts.length })}
                    </span>
                    {followUp > 0 && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        {t('followUp', { count: followUp })}
                      </span>
                    )}
                  </div>
                  <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-sm">
                    {group.alerts.map((alert) => (
                      <li key={alert.id} className="flex flex-wrap items-center gap-2 py-2">
                        <span className="text-[var(--text-primary)]">{alert.conversation.contact?.name ?? '—'}</span>
                        {alert.conversation.contact?.phone && (
                          <span dir="ltr" className="text-xs text-[var(--text-secondary)]">{displayPhone(alert.conversation.contact.phone)}</span>
                        )}
                        <span className="text-xs text-[var(--text-muted)]">{alert.channel}</span>
                        <span className="text-xs text-[var(--text-muted)]">· {t(`alertStatus.${alert.status}` as 'alertStatus.ACTIVE')}</span>
                        <span className="ms-auto flex items-center gap-2">
                          <Link href={`/conversations/${alert.conversationId}`} className="text-xs font-semibold text-blue-600 hover:underline">
                            {t('open')}
                          </Link>
                          {alert.status === 'NEEDS_FOLLOW_UP' && (
                            <ChatRequestAction endpoint={`/api/commerce/restock-alerts/${alert.id}`} status="NOTIFIED" label={t('markContacted')} errorLabel={t('actionError')} tone="primary" />
                          )}
                          <ChatRequestAction endpoint={`/api/commerce/restock-alerts/${alert.id}`} status="CANCELLED" label={t('cancel')} errorLabel={t('actionError')} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
