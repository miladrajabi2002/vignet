import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Store, ArrowRight } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { WebWidgetChannel } from '@/components/channels/web-widget-channel'
import { ChatLinkChannel } from '@/components/channels/chat-link-channel'
import {
  MessengerChannel,
  type MessengerKind,
} from '@/components/channels/messenger-channel'
import { normalizeMessengerSettings } from '@/lib/channels/config'
import {
  normalizeChatLinkSettings,
  normalizeSlug,
  chatLinkUrl,
} from '@/lib/chat-link/config'

/** Public webhook path segment per messenger type. */
const WEBHOOK_PATH: Record<MessengerKind, string> = {
  TELEGRAM: 'telegram',
  BALE: 'bale',
  RUBIKA: 'rubika',
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
}

export default async function AgentChannelsPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('channels')

  const [agent, workspace] = await Promise.all([
    prisma.agent.findFirst({
      where: { id: params.agentId, workspaceId: user.workspaceId },
      select: {
        id: true,
        name: true,
        channels: {
          select: { id: true, type: true, config: true, lastInboundAt: true },
        },
        chatLink: {
          select: { slug: true, enabled: true, settings: true, views: true },
        },
      },
    }),
    prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { openrouterKeyEnc: true, slug: true },
    }),
  ])
  if (!agent) notFound()

  const widget = agent.channels.find((c) => c.type === 'WEB_WIDGET')
  const hasApiKey = !!workspace?.openrouterKeyEnc

  // Chat Link: existing config, or a sensible suggested slug for first-time setup.
  const chatLink = agent.chatLink
    ? {
        slug: agent.chatLink.slug,
        enabled: agent.chatLink.enabled,
        settings: normalizeChatLinkSettings(agent.chatLink.settings),
        views: agent.chatLink.views,
        url: chatLinkUrl(agent.chatLink.slug),
      }
    : null
  const suggestedSlug =
    normalizeSlug(workspace?.slug ?? '') ??
    `chat-${agent.id.slice(-6).toLowerCase()}`
  const baseUrl = process.env.NEXT_PUBLIC_WIDGET_URL ?? 'http://localhost:3000'
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'

  const messengers: { type: MessengerKind; label: string; hint: string }[] = [
    { type: 'TELEGRAM', label: t('telegram'), hint: t('telegramHint') },
    { type: 'BALE', label: t('bale'), hint: t('baleHint') },
    { type: 'RUBIKA', label: t('rubika'), hint: t('rubikaHint') },
    { type: 'WHATSAPP', label: t('whatsapp'), hint: t('whatsappHint') },
    { type: 'INSTAGRAM', label: t('instagram'), hint: t('instagramHint') },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>

      <WebWidgetChannel
        agentId={agent.id}
        agentName={agent.name}
        baseUrl={baseUrl}
        enabled={!!widget}
        channelId={widget?.id ?? null}
        config={(widget?.config as Record<string, unknown> | null) ?? null}
        hasApiKey={hasApiKey}
      />

      <ChatLinkChannel
        agentId={agent.id}
        agentName={agent.name}
        appUrl={appUrl}
        initialLink={chatLink}
        suggestedSlug={suggestedSlug}
      />

      {messengers.map((m) => {
        const ch = agent.channels.find((c) => c.type === m.type)
        const config =
          ch && ch.config && typeof ch.config === 'object'
            ? (ch.config as Record<string, unknown>)
            : null
        const botUsername = config ? String(config.botUsername ?? '') : ''
        const webhookToken = config ? String(config.webhookToken ?? '') : ''
        const isMeta = m.type === 'WHATSAPP' || m.type === 'INSTAGRAM'
        const callbackUrl =
          isMeta && webhookToken
            ? `${appUrl}/api/webhook/${WEBHOOK_PATH[m.type]}/${webhookToken}`
            : null

        return (
          <MessengerChannel
            key={m.type}
            agentId={agent.id}
            type={m.type}
            label={m.label}
            hint={m.hint}
            enabled={!!ch}
            channelId={ch?.id ?? null}
            botUsername={botUsername || null}
            callbackUrl={callbackUrl}
            verifyToken={isMeta ? webhookToken || null : null}
            lastInboundAt={ch?.lastInboundAt ? ch.lastInboundAt.toISOString() : null}
            quickReplies={ch ? normalizeMessengerSettings(ch.config).quickReplies : []}
          />
        )
      })}

      {/* Not a chat channel — a data source. Point users to Store Integrations
          without cluttering the channel list with a toggle that doesn't belong. */}
      <Link
        href="/integrations"
        className="group flex items-start gap-4 rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--border-strong)]"
      >
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)]">
          <Store className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--text-primary)]">
            {t('storeTitle')}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">
            {t('storeDesc')}
          </span>
        </span>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">
          {t('storeCta')}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </span>
      </Link>
    </div>
  )
}
