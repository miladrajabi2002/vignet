'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ChannelType } from '@prisma/client'
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { ChannelBadge, SourceTagBadges } from '@/components/crm/channel-badge'
import {
  asContactStage,
  ContactStageBadge,
  type ContactStage,
} from '@/components/crm/contact-stage-badge'
import { ContactDetailEditor } from '@/components/crm/contact-detail'
import { ContactDeleteAction } from '@/components/crm/contact-delete-action'
import { contactAvatarSrc } from '@/lib/crm/avatar'
import { contactDisplayName } from '@/lib/crm/display'
import { relativeTime } from '@/lib/format'
import { displayPhone } from '@/lib/phone'
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
  marketingOptIn: boolean
  createdAt: string
  updatedAt: string
  lastActivityAt: string | null
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
  }>
}

type ChannelIdentity = {
  channel: ChannelType
  handle: string | null
  avatarUrl: string | null
}

const STAGE_TRANSLATION_KEY: Record<ContactStage, string> = {
  lead: 'stageLead',
  qualified: 'stageQualified',
  customer: 'stageCustomer',
  lost: 'stageLost',
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
  const lastActivity = detail
    ? detail.lastActivityAt ??
      detail.conversations[0]?.lastMessageAt ??
      detail.updatedAt
    : preview?.lastActivity

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

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: 'overview', label: t('detail.overviewTab') },
    { key: 'conversations', label: t('detail.conversationsTab') },
    { key: 'edit', label: t('detail.editTab') },
  ]

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
      contentClassName="bg-[var(--bg-base)]/70"
      footer={
        detail ? (
          <div className={cn('grid gap-2', phone ? 'grid-cols-4' : 'grid-cols-2')}>
            {phone && (
              <>
                <a
                  href={`tel:${phone}`}
                  className="spatial-press flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-default)] bg-white text-[10px] font-medium text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {t('detail.call')}
                </a>
                <button
                  type="button"
                  onClick={() => copyValue(phone, 'phone-footer')}
                  className="spatial-press flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-default)] bg-white text-[10px] font-medium text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                >
                  {copiedKey === 'phone-footer' ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copiedKey === 'phone-footer' ? t('detail.copied') : t('detail.copy')}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setTab('edit')}
              aria-pressed={tab === 'edit'}
              className="spatial-press flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-default)] bg-white text-[10px] font-medium text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t('detail.editTab')}
            </button>
            <Link
              href={`/contacts/${detail.id}`}
              className="spatial-press flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-black text-[10px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('detail.openFullProfile')}
            </Link>
          </div>
        ) : undefined
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {copiedKey ? t('detail.copied') : ''}
      </p>

      <div className="rounded-[1.35rem] border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-xs)]">
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
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 truncate text-lg font-bold text-[var(--text-primary)]">
                {displayName}
              </h3>
              <ContactStageBadge stage={stage} label={t(STAGE_TRANSLATION_KEY[stageKey])} />
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {lastActivity
                ? `${t('latestActivity')}: ${relativeTime(lastActivity, locale)}`
                : t('detail.sheetTitle')}
            </p>
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t('detail.sheetTitle')}
        className="sticky top-0 z-10 mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-[var(--border-subtle)] bg-white/95 p-1 backdrop-blur-xl"
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              'min-h-11 rounded-xl px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60',
              tab === item.key
                ? 'bg-black text-white shadow-[var(--shadow-control)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
            )}
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
              {detail.phone && (
                <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
                  <p className="text-xs font-medium text-[var(--text-muted)]">{t('detail.phone')}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-base font-semibold text-[var(--text-primary)]">
                      {displayPhone(detail.phone)}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyValue(detail.phone!, 'phone-overview')}
                      className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                    >
                      {copiedKey === 'phone-overview' ? (
                        <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                      {copiedKey === 'phone-overview' ? t('detail.copied') : t('detail.copy')}
                    </button>
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
                <div className="flex items-start gap-3">
                  {detail.marketingOptIn ? (
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  )}
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    {detail.marketingOptIn
                      ? t('detail.consentGranted')
                      : t('detail.consentMissing')}
                  </p>
                </div>
              </section>

              {detail.tags.length > 0 && (
                <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
                  <div className="flex flex-wrap gap-2">
                    <SourceTagBadges tags={detail.tags} />
                    {detail.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)]">{t('detail.channelIdentities')}</h4>
                <div className="mt-3 space-y-2">
                  {identities.map((identity) => {
                    const identityKey = `identity-${identity.channel}`
                    return (
                      <div key={identity.channel} className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--bg-base)] px-2.5 py-2">
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
                        ) : null}
                        <ChannelBadge type={identity.channel} />
                        {identity.handle && (
                          <>
                            <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-xs font-medium text-[var(--text-primary)]">
                              {identity.channel === 'WHATSAPP' ? identity.handle : `@${identity.handle}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyValue(identity.handle!, identityKey)}
                              aria-label={`${t('detail.copy')} ${identity.handle}`}
                              className="spatial-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                            >
                              {copiedKey === identityKey ? (
                                <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                              ) : (
                                <Copy className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)]">{t('detail.notes')}</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
                  {detail.notes || t('detail.noNotes')}
                </p>
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
                      className="spatial-press flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
                        <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{conversation.agent.name}</span>
                          <ChannelBadge type={conversation.channel} />
                        </span>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          {conversation.messageCount.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')} {t('conversations')} · {relativeTime(conversation.lastMessageAt ?? conversation.createdAt, locale)}
                        </span>
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
                initialMarketingOptIn={detail.marketingOptIn}
                embedded
                onSaved={(updated) => setDetail((current) => current ? { ...current, ...updated } : current)}
              />
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <ContactDeleteAction contactId={detail.id} returnTo={returnTo} />
              </div>
            </div>
          )}
        </div>
      )}
    </MobileBottomSheet>
  )
}
