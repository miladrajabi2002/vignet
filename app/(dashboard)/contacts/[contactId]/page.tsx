import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import { User, Phone, MessageSquare } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ContactDetailEditor } from '@/components/crm/contact-detail'
import { contactDisplayName } from '@/lib/crm/display'
import { BackButton } from '@/components/dashboard/back-button'
import { relativeTime } from '@/lib/format'

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
  const avatarUrl =
    contact.instagramAvatarUrl ??
    contact.telegramAvatarUrl ??
    contact.baleAvatarUrl ??
    contact.rubikaAvatarUrl ??
    contact.whatsappAvatarUrl ??
    null

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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header card — avatar + name + channels + phone + back link */}
      <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
        <div className="mb-4">
          <BackButton href="/contacts" label={t('title')} />
        </div>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={who}
              width={56}
              height={56}
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-14 w-14 shrink-0 rounded-full border border-[var(--border-default)] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--text-primary)]/10 text-[var(--text-primary)]">
              <User className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {who}
              </h1>
              {channels.map((ch) => (
                <ChannelBadge key={ch} type={ch} />
              ))}
            </div>
            {contact.phone && (
              <p
                dir="ltr"
                className="mt-0.5 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)]"
              >
                <Phone className="h-3.5 w-3.5" />
                {contact.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Per-channel identities */}
      {identities.length > 0 && (
        <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            {locale === 'fa' ? 'هویت در کانال‌ها' : 'Channel identities'}
          </h2>
          <div className="flex flex-wrap gap-3">
            {identities.map((id) => (
              <div
                key={id.channel}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1.5"
              >
                {id.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={id.avatarUrl}
                    alt={id.handle ?? id.channel}
                    width={24}
                    height={24}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="h-6 w-6 rounded-full border border-[var(--border-default)] object-cover"
                  />
                ) : null}
                <ChannelBadge type={id.channel} />
                {id.handle && (
                  <span
                    dir="ltr"
                    className="text-xs text-[var(--text-primary)]"
                  >
                    @{id.handle}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            {locale === 'fa'
              ? `آخرین فعالیت: ${relativeTime(lastActivity, locale)}`
              : `Last activity: ${relativeTime(lastActivity, locale)}`}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Editable details */}
        <ContactDetailEditor
          contactId={contact.id}
          initialName={contact.name ?? ''}
          initialStage={contact.stage}
          initialTags={contact.tags}
          initialNotes={contact.notes ?? ''}
          initialMarketingOptIn={contact.marketingOptIn}
        />

        {/* Conversation history */}
        <div className="spatial-surface rounded-[1.5rem] p-5">
          <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            {t('detail.history')}
          </h2>
          {contact.conversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              {t('detail.noHistory')}
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {contact.conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/conversations/${c.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-black/[0.035]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-[var(--text-primary)]">
                        {c.agent.name}
                      </span>
                      <ChannelBadge type={c.channel} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {c.messageCount} · {t('detail.lastActivity')}{' '}
                      {relativeTime(
                        new Date(c.lastMessageAt ?? c.createdAt),
                        locale,
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
