import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import { Phone, MessageSquare } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge, ChannelGlyph, SourceTagBadges } from '@/components/crm/channel-badge'
import { conversationPreviewText } from '@/lib/conversations/preview'
import { ContactDetailEditor } from '@/components/crm/contact-detail'
import { contactDisplayName } from '@/lib/crm/display'
import { BackButton } from '@/components/dashboard/back-button'
import { relativeTime } from '@/lib/format'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { contactAvatarSrc } from '@/lib/crm/avatar'
import { ContactDeleteAction } from '@/components/crm/contact-delete-action'
import { displayPhone } from '@/lib/phone'

export default async function ContactDetailPage(
  props: {
    params: Promise<{ contactId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('contacts')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

  const contact = await prisma.contact.findFirst({
    where: { id: params.contactId, workspaceId: user.workspaceId },
    include: {
      conversations: {
        where: { deletedAt: null },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
        select: {
          id: true,
          channel: true,
          status: true,
          messageCount: true,
          lastMessageAt: true,
          createdAt: true,
          agent: { select: { name: true } },
          messages: { where: { role: { in: ['USER', 'ASSISTANT'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { content: true } },
        },
      },
    },
  })
  if (!contact) notFound()

  const channels: ChannelType[] = []
  if (contact.telegramId) channels.push('TELEGRAM')
  if (contact.whatsappId) channels.push('WHATSAPP')
  if (contact.instagramId) channels.push('INSTAGRAM')
  if (contact.rubikaId) channels.push('RUBIKA')
  if (contact.baleId) channels.push('BALE')

  // Resolve the contact's display name with a per-channel fallback. Instagram
  // DMs only carry a sender id (no name/username), so without this the contact
  // shows as "ناشناس" until the visitor types their name. The fallback uses the
  // first connected channel ("کاربر اینستاگرام", "کاربر تلگرام", etc.).
  const firstChannel = channels[0] ?? null
  const who = contactDisplayName({
    name: contact.name,
    phone: contact.phone,
    channel: firstChannel,
    channelId: firstChannel ? (firstChannel as string) : null,
    anonymousLabel: t('anonymous'),
  })

  // Pick the first available avatar across channels (Instagram first since it
  // has the most useful profile pictures).
  const primaryAvatar = contact.instagramId
    ? { rawUrl: contact.instagramAvatarUrl, channel: 'INSTAGRAM' as const }
    : contact.telegramAvatarUrl
      ? { rawUrl: contact.telegramAvatarUrl, channel: 'TELEGRAM' as const }
      : contact.baleAvatarUrl
        ? { rawUrl: contact.baleAvatarUrl, channel: 'BALE' as const }
        : contact.rubikaAvatarUrl
          ? { rawUrl: contact.rubikaAvatarUrl, channel: 'RUBIKA' as const }
          : contact.whatsappAvatarUrl
            ? { rawUrl: contact.whatsappAvatarUrl, channel: 'WHATSAPP' as const }
            : null
  const avatarUrl = primaryAvatar
    ? contactAvatarSrc({
        contactId: contact.id,
        channel: primaryAvatar.channel,
        rawUrl: primaryAvatar.rawUrl,
      })
    : null
  const avatarFallbackUrl = contact.instagramId
    ? contact.telegramAvatarUrl ??
      contact.baleAvatarUrl ??
      contact.rubikaAvatarUrl ??
      contact.whatsappAvatarUrl ??
      null
    : null

  // Build a list of per-channel identities (only channels the contact is
  // linked to) so the operator can see e.g. "Instagram @foo", "Telegram @bar"
  // at a glance. Each entry includes the channel, the handle, and the
  // channel-specific avatar (if any).
  const identities: Array<{
    channel: ChannelType
    handle: string | null
    avatarUrl: string | null
  }> = []
  if (contact.telegramId)
    identities.push({
      channel: 'TELEGRAM',
      handle: contact.telegramUsername,
      avatarUrl: contact.telegramAvatarUrl,
    })
  if (contact.baleId)
    identities.push({
      channel: 'BALE',
      handle: contact.baleUsername,
      avatarUrl: contact.baleAvatarUrl,
    })
  if (contact.rubikaId)
    identities.push({
      channel: 'RUBIKA',
      handle: contact.rubikaUsername,
      avatarUrl: contact.rubikaAvatarUrl,
    })
  if (contact.whatsappId)
    identities.push({
      channel: 'WHATSAPP',
      handle: contact.whatsappName,
      avatarUrl: contact.whatsappAvatarUrl,
    })
  if (contact.instagramId)
    identities.push({
      channel: 'INSTAGRAM',
      handle: contact.instagramUsername,
      avatarUrl: contact.instagramAvatarUrl,
    })

  const lastActivity =
    contact.lastActivityAt ??
    contact.conversations[0]?.lastMessageAt ??
    contact.createdAt

  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  const dateFmt = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  const totalMessages = contact.conversations.reduce((sum, c) => sum + c.messageCount, 0)
  const latest = contact.conversations[0]
  const stageLabel = t(({ lead: 'stageLead', qualified: 'stageQualified', customer: 'stageCustomer', lost: 'stageLost' } as Record<string, string>)[contact.stage] ?? 'stageLead')

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <BackButton href="/contacts" label={t('title')} />

      {/* Header: who this is, the one useful action, and delete. */}
      <div className="spatial-surface rounded-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <ContactAvatar
            src={avatarUrl}
            fallbackSrc={avatarFallbackUrl}
            alt={who}
            size="lg"
            loading="eager"
            className="bg-[var(--text-primary)]/5 text-[var(--text-primary)]"
          />
          <div className="min-w-[10rem] flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-[22px] font-bold leading-9 tracking-tight text-[var(--text-primary)]">
              {who}
              <SourceTagBadges tags={contact.tags} />
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-[var(--text-secondary)]">
              <span>{stageLabel}</span>
              {channels.map((ch) => <ChannelBadge key={ch} type={ch} />)}
              {contact.phone && (
                <span dir="ltr" className="inline-flex items-center gap-1 tabular-nums">
                  <Phone className="h-3.5 w-3.5" />
                  {displayPhone(contact.phone)}
                </span>
              )}
            </p>
          </div>
          {latest && (
            <Link
              href={`/conversations/${latest.id}`}
              className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
            >
              <MessageSquare className="h-4 w-4" />
              {locale === 'fa' ? 'پیام به مشتری' : 'Message customer'}
            </Link>
          )}
          <ContactDeleteAction contactId={contact.id} compact />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Editable details */}
        <ContactDetailEditor
          contactId={contact.id}
          initialName={contact.name ?? ''}
          initialStage={contact.stage}
          initialTags={contact.tags}
          initialNotes={contact.notes ?? ''}
          initialMarketingOptIn={contact.marketingOptIn}
        />

        {/* Summary and timeline */}
        <div className="spatial-surface rounded-card p-5 sm:p-6">
          <h2 className="ui-h3">{locale === 'fa' ? 'خلاصه' : 'Summary'}</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[13px]">
            <dt className="text-[var(--text-muted)]">{locale === 'fa' ? 'اولین تماس' : 'First contact'}</dt>
            <dd className="text-[var(--text-primary)]">{dateFmt.format(contact.createdAt)}</dd>
            <dt className="text-[var(--text-muted)]">{locale === 'fa' ? 'گفتگوها' : 'Conversations'}</dt>
            <dd className="tabular-nums text-[var(--text-primary)]">
              {locale === 'fa'
                ? `${nf.format(contact.conversations.length)} گفتگو · ${nf.format(totalMessages)} پیام`
                : `${contact.conversations.length} conversations · ${totalMessages} messages`}
            </dd>
            <dt className="text-[var(--text-muted)]">{t('detail.lastActivity')}</dt>
            <dd className="text-[var(--text-primary)]">{relativeTime(lastActivity, locale)}</dd>
            {identities.some((id) => id.handle) && (
              <>
                <dt className="text-[var(--text-muted)]">{locale === 'fa' ? 'شناسه‌ها' : 'Handles'}</dt>
                <dd className="flex flex-wrap gap-x-3 gap-y-1">
                  {identities.filter((id) => id.handle).map((id) => (
                    <span key={id.channel} className="inline-flex items-center gap-1">
                      <ChannelGlyph type={id.channel} />
                      <span dir="ltr" className="text-[var(--text-primary)]">@{id.handle}</span>
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>

          <h2 className="ui-h3 mt-5 border-t border-[var(--border-subtle)] pt-4">{t('detail.history')}</h2>
          {contact.conversations.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              {t('detail.noHistory')}
            </p>
          ) : (
            <div className="mt-1 divide-y divide-[var(--border-subtle)]">
              {contact.conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/conversations/${c.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-black/[0.035]"
                >
                  <ChannelGlyph type={c.channel} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border-default)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-[var(--text-primary)]">
                      {c.messages[0] ? conversationPreviewText(c.messages[0].content) : c.agent.name}
                    </p>
                    <p className="text-[12px] tabular-nums text-[var(--text-muted)]">
                      {c.agent.name} · {nf.format(c.messageCount)} {locale === 'fa' ? 'پیام' : 'messages'}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[12px] text-[var(--text-muted)]">
                    {relativeTime(new Date(c.lastMessageAt ?? c.createdAt), locale)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
