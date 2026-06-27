import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import { ArrowLeft, User, Phone, MessageSquare } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ContactDetailEditor } from '@/components/crm/contact-detail'
import { relativeTime } from '@/lib/format'

export default async function ContactDetailPage({
  params,
}: {
  params: { contactId: string }
}) {
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

  const who = contact.name || contact.phone || t('anonymous')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t('title')}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-light text-[var(--text-primary)]">
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Editable details */}
        <ContactDetailEditor
          contactId={contact.id}
          initialName={contact.name ?? ''}
          initialStage={contact.stage}
          initialTags={contact.tags}
          initialNotes={contact.notes ?? ''}
        />

        {/* Conversation history */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
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
                  className="flex items-center gap-3 py-3 transition-colors hover:opacity-80"
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
