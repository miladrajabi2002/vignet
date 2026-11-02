'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ChannelType } from '@prisma/client'
import {
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  ShoppingBag,
} from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { ChannelBadge, ChannelGlyph, SourceTagBadges, isSourceTag } from '@/components/crm/channel-badge'
import {
  asContactStage,
  ContactStageBadge,
  type ContactStage,
} from '@/components/crm/contact-stage-badge'
import { ContactDetailEditor } from '@/components/crm/contact-detail'
import { ContactCustomerToggle } from '@/components/crm/contact-customer-toggle'
import type { ManualOrderView } from '@/components/crm/contact-purchases'
import type { CustomField } from '@/lib/crm/customer-brief'
import { ContactDeleteAction } from '@/components/crm/contact-delete-action'
import { contactAvatarSrc } from '@/lib/crm/avatar'
import { contactDisplayName } from '@/lib/crm/display'
import { relativeTime } from '@/lib/format'
import { displayPhone } from '@/lib/phone'
import { formatContactAddress, type ContactAddress } from '@/lib/crm/contact-address'
import { PurchaseCard, type PurchaseView } from '@/components/payments/purchase-card'
import { displayOrderCode } from '@/lib/commerce/order-ref'
import { cn } from '@/lib/utils'

type DetailTab = 'overview' | 'conversations' | 'edit'

type ContactPreview = {
  id: string
  name: string | null
  phone: string | null
  stage: string
  tags: string[]
  channels: ChannelType[]
  conversationCount: number
  lastActivity: string
  avatarUrl?: string | null
  avatarFallbackUrl?: string | null
  channelUsernames?: Partial<Record<ChannelType, string | null>>
  marketingOptIn: boolean
}

type ContactDetailData = {
  id: string
  name: string | null
  phone: string | null
  stage: string
  tags: string[]
  notes: string | null
  aiBrief: string | null
  customFields: CustomField[]
  identifiedAt: string | null
  marketingOptIn: boolean
  createdAt: string
  updatedAt: string
  lastActivityAt: string | null
  address: ContactAddress | null
  telegramId: string | null
  telegramUsername: string | null
  telegramAvatarUrl: string | null
  whatsappId: string | null
  whatsappName: string | null
  whatsappAvatarUrl: string | null
  instagramId: string | null
  instagramUsername: string | null
  instagramAvatarUrl: string | null
  rubikaId: string | null
  rubikaUsername: string | null
  rubikaAvatarUrl: string | null
  baleId: string | null
  baleUsername: string | null
  baleAvatarUrl: string | null
  conversations: Array<{
    id: string
    channel: ChannelType
    status: string
    messageCount: number
    lastMessageAt: string | null
    createdAt: string
    agent: { name: string }
    /** One line of the last message, already stripped of Markdown and cards. */
    preview?: string
  }>
  /** What they paid for, newest first. */
  purchases?: PurchaseView[]
  /** Orders the owner recorded by hand (phone, in-store), newest first. */
  manualOrders?: ManualOrderView[]
}

type ChannelIdentity = {
  channel: ChannelType
  handle: string | null
  avatarUrl: string | null
}

type PurchaseEntry =
  | { kind: 'paid'; id: string; at: Date; total: number; purchase: PurchaseView }
  | { kind: 'manual'; id: string; at: Date; total: number; order: ManualOrderView }

const STAGE_TRANSLATION_KEY: Record<ContactStage, string> = {
  lead: 'stageLead',
  qualified: 'stageQualified',
  customer: 'stageCustomer',
  lost: 'stageLost',
}

/** Purchases the sheet lists before «همه» hands over to the full profile. */
const PURCHASES_SHOWN = 3

const FOOTER_COLUMNS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('COPY_FAILED')
}

export function ContactDetailSheet({
  contactId,
  preview,
  locale,
  returnTo,
  triggerRef,
  onClose,
}: {
  contactId: string | null
  preview?: ContactPreview
  locale: 'fa' | 'en'
  returnTo: string
  triggerRef: { current: HTMLElement | null }
  onClose: () => void
}) {
  const t = useTranslations('contacts')
  const fa = locale !== 'en'
  const [detail, setDetail] = useState<ContactDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copiedTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setTab('overview')
    setCopiedKey(null)
    if (!contactId) {
      setDetail(null)
      setError(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(false)
    setDetail(null)

    fetch(`/api/contacts/${encodeURIComponent(contactId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP_${response.status}`)
        return response.json() as Promise<{ contact: ContactDetailData }>
      })
      .then((body) => setDetail(body.contact))
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [contactId, retryKey])

  const identities = useMemo<ChannelIdentity[]>(() => {
    if (!detail) return []
    const result: ChannelIdentity[] = []
    if (detail.telegramId) result.push({ channel: 'TELEGRAM', handle: detail.telegramUsername, avatarUrl: detail.telegramAvatarUrl })
    if (detail.baleId) result.push({ channel: 'BALE', handle: detail.baleUsername, avatarUrl: detail.baleAvatarUrl })
    if (detail.rubikaId) result.push({ channel: 'RUBIKA', handle: detail.rubikaUsername, avatarUrl: detail.rubikaAvatarUrl })
    if (detail.whatsappId) result.push({ channel: 'WHATSAPP', handle: detail.whatsappName, avatarUrl: detail.whatsappAvatarUrl })
    if (detail.instagramId) result.push({ channel: 'INSTAGRAM', handle: detail.instagramUsername, avatarUrl: detail.instagramAvatarUrl })
    return result
  }, [detail])

  // Paid orders and hand-recorded ones read as one history, newest first, like the profile's.
  const purchaseEntries = useMemo<PurchaseEntry[]>(() => {
    if (!detail) return []
    return [
      ...(detail.purchases ?? []).map((purchase): PurchaseEntry => ({ kind: 'paid', id: purchase.id, at: new Date(purchase.paidAt), total: purchase.total, purchase })),
      ...(detail.manualOrders ?? []).map((order): PurchaseEntry => ({ kind: 'manual', id: order.id, at: new Date(order.orderedAt), total: order.amount ?? 0, order })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime())
  }, [detail])

  const firstChannel = detail
    ? identities[0]?.channel ?? null
    : preview?.channels[0] ?? null
  const firstHandle = detail
    ? identities[0]?.handle ?? null
    : firstChannel
      ? preview?.channelUsernames?.[firstChannel] ?? null
      : null
  const displayName = contactDisplayName({
    name: detail?.name ?? preview?.name,
    phone: detail?.phone ?? preview?.phone,
    handle: firstHandle,
    channel: firstChannel,
    channelId: firstChannel,
    anonymousLabel: t('anonymous'),
  })

  const primaryAvatar = detail
    ? detail.instagramId
      ? { channel: 'INSTAGRAM' as const, rawUrl: detail.instagramAvatarUrl }
      : detail.telegramAvatarUrl
        ? { channel: 'TELEGRAM' as const, rawUrl: detail.telegramAvatarUrl }
        : detail.baleAvatarUrl
          ? { channel: 'BALE' as const, rawUrl: detail.baleAvatarUrl }
          : detail.rubikaAvatarUrl
            ? { channel: 'RUBIKA' as const, rawUrl: detail.rubikaAvatarUrl }
            : detail.whatsappAvatarUrl
              ? { channel: 'WHATSAPP' as const, rawUrl: detail.whatsappAvatarUrl }
              : null
    : null
  const avatarUrl = detail && primaryAvatar
    ? contactAvatarSrc({
        contactId: detail.id,
        channel: primaryAvatar.channel,
        rawUrl: primaryAvatar.rawUrl,
      })
    : preview?.avatarUrl ?? null
  const avatarFallbackUrl = detail?.instagramId
    ? detail.telegramAvatarUrl ??
      detail.baleAvatarUrl ??
      detail.rubikaAvatarUrl ??
      detail.whatsappAvatarUrl ??
      null
    : preview?.avatarFallbackUrl ?? null
  const stage = detail?.stage ?? preview?.stage ?? 'lead'
  const stageKey = asContactStage(stage)
  const phone = detail?.phone ?? preview?.phone ?? null
  const channels = detail ? identities.map((identity) => identity.channel) : preview?.channels ?? []
  const addressLine = detail?.address ? formatContactAddress(detail.address, t('detail.postalCode'), locale) : ''
  const lastActivity = detail
    ? detail.lastActivityAt ??
      detail.conversations[0]?.lastMessageAt ??
      detail.updatedAt
    : preview?.lastActivity
  const latestConversation = detail?.conversations[0] ?? null
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const dateFmt = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  const totalMessages = detail?.conversations.reduce((sum, conversation) => sum + conversation.messageCount, 0) ?? 0
  const plainTags = detail?.tags.filter((tag) => !isSourceTag(tag)) ?? []

  async function copyValue(value: string, key: string) {
    try {
      await writeClipboard(value)
      setCopiedKey(key)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopiedKey(null), 2200)
    } catch {
      setCopiedKey(null)
    }
  }

  function setIdentified(identified: boolean) {
    setDetail((current) => current ? { ...current, identifiedAt: identified ? new Date().toISOString() : null } : current)
  }

  const copyButton = (value: string, key: string, label: string) => (
    <button
      type="button"
      onClick={() => copyValue(value, key)}
      aria-label={`${t('detail.copy')} ${label}`}
      className="spatial-press inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      {copiedKey === key ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  )

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: 'overview', label: t('detail.overviewTab') },
    {
      key: 'conversations',
      label: detail?.conversations.length
        ? `${t('detail.conversationsTab')} · ${nf.format(detail.conversations.length)}`
        : t('detail.conversationsTab'),
    },
    { key: 'edit', label: t('detail.editTab') },
  ]

  const footerTiles = detail ? 2 + (latestConversation ? 1 : 0) + (phone ? 1 : 0) : 0
  const tileClass = 'spatial-press flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[12px] font-medium leading-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]'
  const primaryTile = cn(tileClass, 'bg-black text-white focus-visible:ring-offset-2')
  const secondaryTile = cn(tileClass, 'border border-[var(--border-default)] bg-white text-[var(--text-secondary)]')

  return (
    <MobileBottomSheet
      open={Boolean(contactId)}
      title={displayName}
      description={t('detail.sheetTitle')}
      closeLabel={t('detail.close')}
      size="large"
      motionPreset="detail"
      triggerRef={triggerRef}
      onClose={onClose}
      contentClassName="bg-[color:color-mix(in_srgb,var(--bg-base)_70%,transparent)]"
      footer={
        detail ? (
          <div className={cn('grid gap-2', FOOTER_COLUMNS[footerTiles])}>
            {/* The one thing most people open a customer for: answering them. */}
            {latestConversation && (
              <Link href={`/conversations/${latestConversation.id}`} className={primaryTile}>
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {fa ? 'پیام' : 'Message'}
              </Link>
            )}
            {phone && (
              <a href={`tel:${phone}`} className={secondaryTile}>
                <Phone className="h-4 w-4" aria-hidden="true" />
                {t('detail.call')}
              </a>
            )}
            <Link href={`/contacts/${detail.id}`} className={latestConversation ? secondaryTile : primaryTile}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('detail.openFullProfile')}
            </Link>
            <ContactDeleteAction contactId={detail.id} returnTo={returnTo} variant="tile" />
          </div>
        ) : undefined
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {copiedKey ? t('detail.copied') : ''}
      </p>

      <div className="rounded-card border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-xs)]">
        <div className="flex min-w-0 items-center gap-3">
          <ContactAvatar
            src={avatarUrl}
            fallbackSrc={avatarFallbackUrl}
            alt={displayName}
            size="lg"
            loading="eager"
            className="bg-[var(--bg-muted)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="min-w-0 truncate text-lg font-bold text-[var(--text-primary)]">
                {displayName}
              </h3>
              {detail && <SourceTagBadges tags={detail.tags} />}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ContactStageBadge stage={stage} label={t(STAGE_TRANSLATION_KEY[stageKey])} />
              {channels.map((channel) => <ChannelBadge key={channel} type={channel} />)}
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              {lastActivity
                ? `${t('latestActivity')}: ${relativeTime(lastActivity, locale)}`
                : t('detail.sheetTitle')}
            </p>
          </div>
        </div>
      </div>

      {detail && !detail.identifiedAt && !loading && (
        <div className="mt-3">
          <ContactCustomerToggle contactId={detail.id} identified={false} onChange={setIdentified} />
        </div>
      )}

      <div
        role="tablist"
        aria-label={t('detail.sheetTitle')}
        className="ui-seg ui-seg-solid sticky top-0 z-10 mt-3 grid-cols-3"
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className="ui-seg-tab px-2 text-xs"
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {t('detail.loading')}
          </div>
          <div className="h-24 animate-pulse rounded-2xl bg-black/[0.045] motion-reduce:animate-none" />
          <div className="h-32 animate-pulse rounded-2xl bg-black/[0.045] motion-reduce:animate-none" />
        </div>
      )}

      {error && !loading && (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-center">
          <p role="alert" className="text-sm text-red-700">{t('detail.loadFailed')}</p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('detail.retry')}
          </button>
        </div>
      )}

      {detail && !loading && !error && (
        <div className="mt-4" role="tabpanel">
          {tab === 'overview' && (
            <div className="space-y-3">
              <PurchasesSummary contactId={detail.id} entries={purchaseEntries} locale={locale} />

              {/* Everything about how to reach them and where they stand, as one list. */}
              <section className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-default)] bg-white">
                {detail.phone && (
                  <div className="flex min-h-14 items-center gap-2 py-1.5 pe-1.5 ps-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-[var(--text-muted)]">{t('detail.phone')}</p>
                      <p dir="ltr" className="truncate text-start text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                        {displayPhone(detail.phone)}
                      </p>
                    </div>
                    {copyButton(detail.phone, 'phone', t('detail.phone'))}
                  </div>
                )}

                {detail.address && (
                  <div className="flex items-start gap-2 py-1.5 pe-1.5 ps-4">
                    <div className="min-w-0 flex-1 py-1.5">
                      <p className="text-[11.5px] text-[var(--text-muted)]">{t('detail.address')}</p>
                      <p className="break-words text-[13.5px] leading-6 text-[var(--text-primary)]">{addressLine}</p>
                    </div>
                    {copyButton(addressLine, 'address', t('detail.address'))}
                  </div>
                )}

                {identities.length > 0 && (
                  <div className="py-2 pe-1.5 ps-4">
                    <p className="pt-1 text-[11.5px] text-[var(--text-muted)]">{t('detail.channelIdentities')}</p>
                    <ul className="mt-0.5">
                      {identities.map((identity) => (
                        <li key={identity.channel} className="flex min-h-11 items-center gap-2">
                          {identity.avatarUrl || identity.channel === 'INSTAGRAM' ? (
                            <ContactAvatar
                              src={contactAvatarSrc({
                                contactId: detail.id,
                                channel: identity.channel,
                                rawUrl: identity.avatarUrl,
                              })}
                              alt={identity.handle ?? identity.channel}
                              size="xs"
                            />
                          ) : (
                            <ChannelGlyph type={identity.channel} className="grid size-6 place-items-center rounded-full border border-[var(--border-default)]" />
                          )}
                          <ChannelBadge type={identity.channel} />
                          {identity.handle ? (
                            <>
                              <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-[13px] font-medium text-[var(--text-primary)]">
                                {identity.channel === 'WHATSAPP' ? identity.handle : `@${identity.handle}`}
                              </span>
                              {copyButton(identity.handle, `identity-${identity.channel}`, identity.handle)}
                            </>
                          ) : (
                            <span className="flex-1" />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px]">
                  {detail.identifiedAt && (
                    <>
                      <dt className="text-[var(--text-muted)]">{fa ? 'وضعیت' : 'Status'}</dt>
                      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--text-primary)]">
                        {fa ? 'در فهرست مشتریان' : 'In the customers list'}
                        <ContactCustomerToggle contactId={detail.id} identified onChange={setIdentified} />
                      </dd>
                    </>
                  )}
                  <dt className="text-[var(--text-muted)]">{fa ? 'اولین تماس' : 'First contact'}</dt>
                  <dd className="text-[var(--text-primary)]">{dateFmt.format(new Date(detail.createdAt))}</dd>
                  <dt className="text-[var(--text-muted)]">{t('detail.conversationsTab')}</dt>
                  <dd className="tabular-nums text-[var(--text-primary)]">
                    {fa
                      ? `${nf.format(detail.conversations.length)} گفتگو · ${nf.format(totalMessages)} پیام`
                      : `${detail.conversations.length} conversations · ${totalMessages} messages`}
                  </dd>
                  {plainTags.length > 0 && (
                    <>
                      <dt className="text-[var(--text-muted)]">{t('detail.tags')}</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {plainTags.map((tag) => (
                          <span key={tag} className="rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                            {tag}
                          </span>
                        ))}
                      </dd>
                    </>
                  )}
                </dl>

                <div className="flex items-start gap-2.5 px-4 py-3">
                  {detail.marketingOptIn ? (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  )}
                  <p className="text-[12.5px] leading-5 text-[var(--text-secondary)]">
                    {detail.marketingOptIn
                      ? t('detail.consentGranted')
                      : t('detail.consentMissing')}
                  </p>
                </div>
              </section>

              {(detail.aiBrief || detail.customFields.length > 0) && (
                <section className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-white p-4">
                  {detail.aiBrief && (
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-secondary)]">{t('detail.aiBrief')}</h4>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-7 text-[var(--text-primary)]">{detail.aiBrief}</p>
                    </div>
                  )}
                  {detail.customFields.length > 0 && (
                    <div className={cn(detail.aiBrief && 'border-t border-[var(--border-subtle)] pt-3')}>
                      <h4 className="text-xs font-semibold text-[var(--text-secondary)]">{t('detail.customFields')}</h4>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                        {detail.customFields.map((field, index) => (
                          <div key={index} className="contents">
                            <dt className="text-[var(--text-muted)]">{field.label}</dt>
                            <dd className="min-w-0 break-words text-[var(--text-primary)]">{field.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)]">{t('detail.notes')}</h4>
                {detail.notes ? (
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-7 text-[var(--text-primary)]">{detail.notes}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTab('edit')}
                    className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 text-[13px] text-[var(--text-muted)] underline-offset-4 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('detail.noNotes')}
                  </button>
                )}
              </section>
            </div>
          )}

          {tab === 'conversations' && (
            <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white">
              {detail.conversations.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{t('detail.noHistory')}</p>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {detail.conversations.map((conversation) => (
                    <Link
                      key={conversation.id}
                      href={`/conversations/${conversation.id}`}
                      className="spatial-press flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                    >
                      <ChannelGlyph type={conversation.channel} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border-default)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-[var(--text-primary)]">
                          {conversation.preview || conversation.agent.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs tabular-nums text-[var(--text-muted)]">
                          {conversation.agent.name} · {nf.format(conversation.messageCount)} {fa ? 'پیام' : 'messages'}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11.5px] text-[var(--text-muted)]">
                        {relativeTime(conversation.lastMessageAt ?? conversation.createdAt, locale)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'edit' && (
            <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-white p-4">
              <ContactDetailEditor
                key={detail.id}
                contactId={detail.id}
                initialName={detail.name ?? ''}
                initialStage={detail.stage}
                initialTags={detail.tags}
                initialNotes={detail.notes ?? ''}
                initialAiBrief={detail.aiBrief ?? ''}
                initialCustomFields={detail.customFields ?? []}
                initialMarketingOptIn={detail.marketingOptIn}
                embedded
                onSaved={(updated) => setDetail((current) => current ? { ...current, ...updated } : current)}
              />
            </div>
          )}
        </div>
      )}
    </MobileBottomSheet>
  )
}

/**
 * The profile's purchases, cut down for a phone sheet: the total, the last
 * few orders (each opening to its receipt), a way on to the full list and
 * «+ ثبت سفارش دستی», which opens the profile with its order sheet up.
 */
function PurchasesSummary({ contactId, entries, locale }: { contactId: string; entries: PurchaseEntry[]; locale: 'fa' | 'en' }) {
  const fa = locale !== 'en'
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const dateFmt = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })

  if (entries.length === 0) {
    return (
      <Link
        href={`/contacts/${contactId}?order=new`}
        className="spatial-press flex min-h-14 items-center gap-3 rounded-2xl border border-dashed border-[var(--border-default)] bg-white px-4 py-3 text-[13px] text-[var(--text-muted)]"
      >
        <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{fa ? 'هنوز خریدی ثبت نشده است' : 'No purchases yet'}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[var(--text-primary)]">
          <span aria-hidden className="grid size-6 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-base)]"><Plus className="size-3.5" strokeWidth={2.6} /></span>
          {fa ? 'ثبت سفارش دستی' : 'Add an order'}
        </span>
      </Link>
    )
  }

  const spent = entries.reduce((sum, entry) => sum + entry.total, 0)
  const waiting = entries.filter((entry) => entry.kind === 'paid' && entry.purchase.paymentId && !entry.purchase.handledAt).length

  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-white" aria-labelledby="sheet-purchases-title">
      <div className="flex items-center gap-3 p-4 pb-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
          <ShoppingBag className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h4 id="sheet-purchases-title" className="text-sm font-semibold text-[var(--text-primary)]">{fa ? 'خریدها' : 'Purchases'}</h4>
          <p className="text-xs text-[var(--text-muted)]">
            {fa
              ? `${nf.format(entries.length)} سفارش · آخرین ${relativeTime(entries[0].at, locale)}`
              : `${entries.length} orders · last ${relativeTime(entries[0].at, locale)}`}
          </p>
        </div>
        {spent > 0 && (
          <p className="shrink-0 text-end text-[16px] font-extrabold leading-6 tabular-nums text-[var(--text-primary)]">
            {nf.format(Math.round(spent))}
            <span className="block text-[11px] font-normal leading-4 text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span>
          </p>
        )}
      </div>

      {waiting > 0 && (
        <p className="mx-4 mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {fa ? `${nf.format(waiting)} سفارش منتظر رسیدگی است` : `${waiting} to handle`}
        </p>
      )}

      <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
        {entries.slice(0, PURCHASES_SHOWN).map((entry) => (
          <li key={`${entry.kind}:${entry.id}`}>
            <details className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02] [&::-webkit-details-marker]:hidden">
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', entry.kind === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]')}>
                  {entry.kind === 'paid' ? <ShoppingBag className="size-4" aria-hidden /> : <ClipboardList className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                    {entry.kind === 'paid'
                      ? entry.purchase.lines.map((line) => (line.quantity > 1 ? `${nf.format(line.quantity)}× ${line.name}` : line.name)).join('، ') || (fa ? `سفارش #${displayOrderCode(entry.purchase.code)}` : `Order #${displayOrderCode(entry.purchase.code)}`)
                      : entry.order.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-[var(--text-muted)]">
                    <span>{dateFmt.format(entry.at)}</span>
                    {entry.kind === 'paid' ? (
                      entry.purchase.paymentId && !entry.purchase.handledAt
                        ? <span className="font-semibold text-amber-700">· {fa ? 'منتظر رسیدگی' : 'To handle'}</span>
                        : <span className="text-emerald-700">· {fa ? 'پرداخت‌شده' : 'Paid'}</span>
                    ) : (
                      <span>· {fa ? 'ثبت دستی' : 'Added by hand'}</span>
                    )}
                  </span>
                </span>
                {entry.total > 0 && (
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--text-primary)]">{nf.format(Math.round(entry.total))}</span>
                )}
                <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <div className="px-4 pb-4 pt-1">
                {entry.kind === 'paid' ? (
                  <PurchaseCard purchase={entry.purchase} locale={locale} variant="plain" />
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] px-3">
                    {(entry.order.items.length ? entry.order.items : [{ name: entry.order.title, quantity: 1, unitPrice: null }]).map((line, index) => (
                      <li key={index} className="flex items-start gap-2 py-2 text-[13px]">
                        <span className="shrink-0 font-bold tabular-nums text-[var(--text-secondary)]">{nf.format(line.quantity)}×</span>
                        <span className="min-w-0 flex-1 break-words text-[var(--text-primary)]">{line.name}</span>
                        {line.unitPrice != null && <span className="shrink-0 tabular-nums text-[var(--text-primary)]">{nf.format(Math.round(line.unitPrice * line.quantity))}</span>}
                      </li>
                    ))}
                    {entry.order.note && <li className="py-2 text-[12.5px] leading-6 text-[var(--text-secondary)]">{entry.order.note}</li>}
                  </ul>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>

      <div className="flex divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] rtl:divide-x-reverse">
        {entries.length > PURCHASES_SHOWN && (
          <Link
            href={`/contacts/${contactId}`}
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-black/[0.02]"
          >
            {fa ? `همهٔ ${nf.format(entries.length)} سفارش` : `All ${entries.length} orders`}
          </Link>
        )}
        <Link
          href={`/contacts/${contactId}?order=new`}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-black/[0.02]"
        >
          <span aria-hidden className="grid size-6 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-base)]"><Plus className="size-3.5" strokeWidth={2.6} /></span>
          {fa ? 'ثبت سفارش دستی' : 'Add an order'}
        </Link>
      </div>
    </section>
  )
}
