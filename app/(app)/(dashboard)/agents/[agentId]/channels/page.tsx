import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  Store,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
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
import { getEffectivePlanDefs, planResourceLimit, recommendedUpgradePlan } from '@/lib/billing/plans'
import { getActiveChannelConnectionCount } from '@/lib/billing/entitlements'
import { ChannelBoard, type ChannelBoardItem } from '@/components/channels/channel-board'
import { ChannelMark } from '@/components/ui/channel-mark'
import { loadChatLinkShowcase } from '@/lib/chat-link/showcase'
import { PlanLimitNotice, type PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('اتصال‌های ایجنت', 'Agent connections')

export default async function AgentChannelsPage(
  props: {
    params: Promise<{ agentId: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  },
) {
  const params = await props.params
  const searchParams = await props.searchParams
  const user = await requireUser()
  const t = await getTranslations('channels')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const nf = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR')

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [agent, workspace, planDefs, usedChannels, weekGroups] = await Promise.all([
    prisma.agent.findFirst({
      where: { id: params.agentId, workspaceId: user.workspaceId },
      select: {
        id: true,
        name: true,
        avatar: true,
        welcomeMessage: true,
        productAccessEnabled: true,
        requireCustomerInfo: true,
        customerInfoPrompt: true,
        channels: {
          select: { id: true, type: true, config: true, lastInboundAt: true, healthStatus: true, healthCheckedAt: true, healthError: true },
        },
        chatLink: {
          select: { slug: true, enabled: true, settings: true, views: true },
        },
      },
    }),
    prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { slug: true, plan: true },
    }),
    getEffectivePlanDefs(),
    getActiveChannelConnectionCount(user.workspaceId),
    // How busy each connection has been lately — a connected channel's sheet
    // answers «is anyone writing here?» before anything else.
    prisma.conversation.groupBy({
      by: ['channel'],
      where: {
        agentId: params.agentId,
        workspaceId: user.workspaceId,
        deletedAt: null,
        lastMessageAt: { gte: weekAgo },
      },
      _count: { _all: true },
    }),
  ])
  if (!agent) notFound()
  const weekConversations = new Map(weekGroups.map((group) => [group.channel, group._count._all]))

  const currentPlan = workspace?.plan ?? 'TRIAL'
  const maxChannels = planDefs[currentPlan].maxChannels
  const channelUsagePercent = Math.min(100, Math.round((usedChannels / maxChannels) * 100))
  const recommendedPlan = recommendedUpgradePlan(planDefs, currentPlan, 'channels', usedChannels)
  const channelLimit: PlanLimitInfo = {
    resource: 'channels',
    plan: currentPlan,
    used: usedChannels,
    limit: maxChannels,
    recommendedPlan,
    recommendedLimit: recommendedPlan ? planResourceLimit(planDefs[recommendedPlan], 'channels') : null,
  }

  const widget = agent.channels.find((c) => c.type === 'WEB_WIDGET')
  // What the chat link's product shelf would show, for its live preview.
  const showcase = agent.productAccessEnabled
    ? await loadChatLinkShowcase(agent.id).catch(() => [])
    : []

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

  // ── Instagram OAuth redirect-back handling ──────────────────────────────
  // With Instagram Login (Business Login for Instagram), the flow is:
  //   ?ig_connected=1  → IG account connected successfully (single account, no picker)
  //   ?ig_error=exchange|denied|state → failure with a specific reason
  const igConnected = !!searchParams.ig_connected
  const igError =
    typeof searchParams.ig_error === 'string' ? searchParams.ig_error : null

  const messengers: { type: MessengerKind; label: string; hint: string }[] = [
    { type: 'TELEGRAM', label: t('telegram'), hint: t('telegramHint') },
    { type: 'BALE', label: t('bale'), hint: t('baleHint') },
    { type: 'RUBIKA', label: t('rubika'), hint: t('rubikaHint') },
    { type: 'INSTAGRAM', label: t('instagram'), hint: t('instagramHint') },
  ]

  const host = appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const initialOpen = typeof searchParams.open === 'string' ? searchParams.open.toUpperCase() : null

  const channelItems: ChannelBoardItem[] = [
    {
      key: 'CHAT_LINK',
      label: t('chatLink'),
      hint: chatLink ? `${host}/c/${chatLink.slug}` : t('chatLinkHint'),
      status: chatLink ? (chatLink.enabled ? 'on' : 'paused') : 'off',
      mark: <ChannelMark channel="CHAT_LINK" />,
      size: chatLink ? 'xl' : 'lg',
      content: (
        <ChatLinkChannel
          agentId={agent.id}
          agentName={agent.name}
          agentAvatar={agent.avatar}
          agentWelcome={agent.welcomeMessage}
          appUrl={appUrl}
          initialLink={chatLink}
          suggestedSlug={suggestedSlug}
          customerIdentificationRequired={agent.requireCustomerInfo}
          customerIdentificationMessage={agent.customerInfoPrompt}
          productAccess={agent.productAccessEnabled}
          showcase={showcase.map((product) => ({ name: product.name, price: product.price, imageUrl: product.imageUrl }))}
        />
      ),
    },
    {
      key: 'WEB_WIDGET',
      label: t('webWidget'),
      hint: t('widgetHint'),
      status: widget ? 'on' : 'off',
      mark: <ChannelMark channel="WEB_WIDGET" />,
      size: widget ? 'xl' : 'lg',
      content: (
        <WebWidgetChannel
          agentId={agent.id}
          agentName={agent.name}
          agentWelcome={agent.welcomeMessage}
          weekConversations={weekConversations.get('WEB_WIDGET') ?? 0}
          baseUrl={baseUrl}
          enabled={!!widget}
          channelId={widget?.id ?? null}
          config={(widget?.config as Record<string, unknown> | null) ?? null}
          customerIdentificationRequired={agent.requireCustomerInfo}
          customerIdentificationMessage={agent.customerInfoPrompt}
        />
      ),
    },
    ...messengers.map((messenger): ChannelBoardItem => {
      const channel = agent.channels.find((item) => item.type === messenger.type)
      const config = channel?.config && typeof channel.config === 'object'
        ? channel.config as Record<string, unknown>
        : null
      const botUsername = config ? String(config.botUsername ?? '') : ''
      const botAvatar = channel && messenger.type === 'INSTAGRAM'
        ? `/api/agents/${agent.id}/channels/${channel.id}/avatar`
        : ''
      const quickReplies = messenger.type === 'INSTAGRAM'
        ? []
        : channel
          ? normalizeMessengerSettings(channel.config).quickReplies
          : []
      return {
        key: messenger.type,
        label: messenger.label,
        hint: channel && botUsername ? `@${botUsername}` : messenger.hint,
        // Connected on paper, but the periodic check says the provider no
        // longer accepts the stored credentials.
        status: channel ? (channel.healthStatus === 'down' ? 'attention' : 'on') : 'off',
        mark: <ChannelMark channel={messenger.type} />,
        size: 'lg',
        content: (
          <MessengerChannel
            agentId={agent.id}
            agentName={agent.name}
            agentWelcome={agent.welcomeMessage}
            weekConversations={weekConversations.get(messenger.type) ?? 0}
            type={messenger.type}
            label={messenger.label}
            enabled={!!channel}
            channelId={channel?.id ?? null}
            botUsername={botUsername || null}
            lastInboundAt={channel?.lastInboundAt ? channel.lastInboundAt.toISOString() : null}
            healthStatus={channel?.healthStatus ?? 'unknown'}
            healthCheckedAt={channel?.healthCheckedAt ? channel.healthCheckedAt.toISOString() : null}
            healthError={channel?.healthError ?? null}
            quickReplies={quickReplies}
            botAvatar={botAvatar || null}
          />
        ),
      }
    }),
  ]

  return (
    <div className="space-y-4">
      {/* A full quota is one message with one action, not a meter plus a warning. */}
      {usedChannels >= maxChannels ? (
        <PlanLimitNotice limit={channelLimit} locale={locale} />
      ) : (
      channelUsagePercent < 80 ? (
        <p className="flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] text-[var(--text-secondary)]" aria-label={t('quotaTitle')}>
          <span className="font-bold text-[var(--text-primary)]">{t('quotaTitle')}</span>
          <span className="tabular-nums text-[var(--text-muted)]">{t('quotaUsage', { used: nf.format(usedChannels), limit: nf.format(maxChannels) })}</span>
        </p>
      ) : (
      <section className="spatial-surface rounded-card p-5 sm:p-6" aria-labelledby="channel-quota-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="channel-quota-title" className="text-sm font-bold text-[var(--text-primary)]">
              {t('quotaTitle')}
            </h2>
            <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
              {t('quotaHint')}
            </p>
          </div>
          <div className="shrink-0 text-start sm:text-end">
            <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
              {t('quotaUsage', { used: nf.format(usedChannels), limit: nf.format(maxChannels) })}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {t('quotaRemaining', { count: nf.format(maxChannels - usedChannels) })}
            </p>
          </div>
        </div>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={maxChannels}
          aria-valuenow={usedChannels}
          aria-label={t('quotaTitle')}
        >
          <div
            className="h-full rounded-full bg-[var(--text-primary)]"
            style={{ width: `${channelUsagePercent}%` }}
          />
        </div>
      </section>
      )
      )}

      {/* ── Instagram OAuth status banners ──────────────────────────────── */}
      {igConnected && (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-success">
              {t('igConnectedTitle')}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-success/80">
              {t('igConnectedBody')}
            </p>
            <Link
              href="/instagram"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success hover:underline"
            >
              {t('igManage')}
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      )}

      {igError && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-danger">{t('igFailedTitle')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-danger/80">
              {t('igFailedBody')}{' '}
              {igError === 'denied' && t('igErrorDenied')}
              {igError === 'exchange' && t('igErrorExchange')}
              {igError === 'state' && t('igErrorState')}
              {igError === 'channel_limit' && t('igErrorChannelLimit')}
              {igError === 'audience_limit' && t('igErrorAudienceLimit')}
            </p>
            {igError === 'audience_limit' && (
              <a href="/billing#vigent-plans" className="mt-2 me-4 inline-flex items-center gap-1 text-xs font-bold text-danger hover:underline">
                {t('igUpgradePlan')}
                <ArrowRight className="h-3 w-3 rtl:rotate-180" />
              </a>
            )}
            <a
              href="/docs/instagram-connection"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
            >
              {t('igGuide')}
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </a>
          </div>
        </div>
      )}

      <ChannelBoard items={channelItems} initialOpen={initialOpen} />

      {/* Not a chat channel — a data source. Point users to Store Integrations
          without cluttering the channel list with a toggle that doesn't belong. */}
      <Link
        href="/integrations"
        className="group flex items-start gap-4 rounded-card border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6 transition-colors hover:border-[var(--border-strong)]"
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
