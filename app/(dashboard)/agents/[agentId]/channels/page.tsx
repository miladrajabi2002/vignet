import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
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
import {
  WhatsAppNumberPicker,
  type PendingWhatsappNumber,
} from '@/components/channels/whatsapp-connect-wizard'
import { normalizeMessengerSettings } from '@/lib/channels/config'
import {
  normalizeChatLinkSettings,
  normalizeSlug,
  chatLinkUrl,
} from '@/lib/chat-link/config'
import { openPendingWhatsappOAuth } from '@/lib/whatsapp/pending-oauth'
import { getEffectivePlanDefs } from '@/lib/billing/plans'
import { getActiveChannelConnectionCount } from '@/lib/billing/entitlements'

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
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  },
) {
  const params = await props.params
  const searchParams = await props.searchParams
  const user = await requireUser()
  const t = await getTranslations('channels')

  const [agent, workspace, planDefs, usedChannels] = await Promise.all([
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
      select: { slug: true, plan: true },
    }),
    getEffectivePlanDefs(),
    getActiveChannelConnectionCount(user.workspaceId),
  ])
  if (!agent) notFound()

  const maxChannels = planDefs[workspace?.plan ?? 'TRIAL'].maxChannels
  const channelUsagePercent = Math.min(100, Math.round((usedChannels / maxChannels) * 100))

  const widget = agent.channels.find((c) => c.type === 'WEB_WIDGET')

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

  // ── WhatsApp OAuth redirect-back handling ───────────────────────────────
  // The callback at /api/whatsapp/oauth/callback sets one of:
  //   ?wa_connected=1  → single phone number connected immediately
  //   ?wa_error=denied|state|exchange|no_number → failure with a reason
  //   ?wa_pick=1       → multiple numbers found; the candidate numbers are
  //                      stashed in a short-lived `wa_oauth_pending` cookie
  //                      (base64url JSON; httpOnly so it can only be read
  //                      server-side) and the user must pick one. The picker
  //                      POSTs the chosen phoneNumberId to
  //                      /api/agents/[agentId]/channels/whatsapp-connect.
  const waConnected = !!searchParams.wa_connected
  const waError =
    typeof searchParams.wa_error === 'string' ? searchParams.wa_error : null
  const waPick = !!searchParams.wa_pick

  // Read and authenticate the encrypted pending-numbers cookie server-side.
  let waPendingNumbers: PendingWhatsappNumber[] = []
  if (waPick) {
    try {
      const jar = await cookies()
      const raw = jar.get('wa_oauth_pending')?.value
      if (raw) {
        const pending = openPendingWhatsappOAuth(raw)
        if (
          pending?.userId === user.id &&
          pending.workspaceId === user.workspaceId &&
          pending.agentId === agent.id
        ) {
          waPendingNumbers = pending.numbers
        }
      }
    } catch {
      // Malformed cookie — fall through to the empty-picker defensive branch
      // (the picker renders a "no number found, retry" message).
      waPendingNumbers = []
    }
  }

  const messengers: { type: MessengerKind; label: string; hint: string }[] = [
    { type: 'TELEGRAM', label: t('telegram'), hint: t('telegramHint') },
    { type: 'BALE', label: t('bale'), hint: t('baleHint') },
    { type: 'RUBIKA', label: t('rubika'), hint: t('rubikaHint') },
    { type: 'WHATSAPP', label: t('whatsapp'), hint: t('whatsappHint') },
    { type: 'INSTAGRAM', label: t('instagram'), hint: t('instagramHint') },
  ]

  return (
    <div className="space-y-6">
      <section className="spatial-surface rounded-[1.5rem] p-5 sm:p-6" aria-labelledby="channel-quota-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="channel-quota-title" className="text-sm font-semibold text-[var(--text-primary)]">
              {t('quotaTitle')}
            </h2>
            <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
              {t('quotaHint')}
            </p>
          </div>
          <div className="shrink-0 text-start sm:text-end">
            <p className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">
              {t('quotaUsage', { used: usedChannels, limit: maxChannels })}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {usedChannels >= maxChannels ? t('quotaFull') : t('quotaRemaining', { count: maxChannels - usedChannels })}
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
            className={`h-full rounded-full ${usedChannels >= maxChannels ? 'bg-danger' : 'bg-[var(--text-primary)]'}`}
            style={{ width: `${channelUsagePercent}%` }}
          />
        </div>
      </section>

      {/* ── Instagram OAuth status banners ──────────────────────────────── */}
      {igConnected && (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-success">
              اکانت اینستاگرام با موفقیت متصل شد.
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-success/80">
              حالا می‌توانید اتوماسیون‌های دایرکت و کامنت را در صفحه مدیریت
              اینستاگرام فعال کنید.
            </p>
            <Link
              href="/instagram"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success hover:underline"
            >
              مدیریت اتوماسیون اینستاگرام
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      )}

      {igError && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-danger">اتصال ناموفق بود.</p>
            <p className="mt-0.5 text-xs leading-relaxed text-danger/80">
              دوباره تلاش کنید یا راهنما را بخوانید.{' '}
              {igError === 'denied' && '(دسترسی لغو شد)'}
              {igError === 'exchange' && '(خطا در تأیید کد)'}
              {igError === 'state' && '(نشست نامعتبر)'}
              {igError === 'channel_limit' && '(سهمیه اتصال کانال پلن شما تکمیل شده است)'}
            </p>
            <a
              href="/docs/instagram-connection"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
            >
              راهنمای اتصال اینستاگرام
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </a>
          </div>
        </div>
      )}

      {/* ── WhatsApp OAuth status banners ──────────────────────────────── */}
      {waConnected && (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-success">
              واتساپ با موفقیت متصل شد.
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-success/80">
              شمارهٔ واتساپ Business شما به‌صورت خودکار متصل شد و وب‌هوک آن هم
              تنظیم شد — نیازی به کار دیگری ندارید.
            </p>
          </div>
        </div>
      )}

      {waError && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-danger">
              اتصال واتساپ ناموفق بود.
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-danger/80">
              دوباره تلاش کنید.{' '}
              {waError === 'denied' && '(دسترسی لغو شد)'}
              {waError === 'exchange' && '(خطا در تأیید کد متا)'}
              {waError === 'state' && '(نشست نامعتبر — دوباره تلاش کنید)'}
              {waError === 'no_number' &&
                '(هیچ شمارهٔ واتساپ Business روی حساب متای شما پیدا نشد)'}
              {waError === 'channel_limit' && '(سهمیه اتصال کانال پلن شما تکمیل شده است)'}
            </p>
          </div>
        </div>
      )}

      {/* ── WhatsApp multi-number picker ─────────────────────────────────
          Shown when Meta's OAuth callback found MORE than one WhatsApp
          phone number. The candidate numbers are read server-side from the
          `wa_oauth_pending` cookie and passed to the client picker, which
          POSTs the operator's choice to /api/agents/[agentId]/channels/
          whatsapp-connect to finalize the connection. */}
      {waPick && (
        <WhatsAppNumberPicker
          agentId={agent.id}
          numbers={waPendingNumbers}
        />
      )}

      <WebWidgetChannel
        agentId={agent.id}
        agentName={agent.name}
        baseUrl={baseUrl}
        enabled={!!widget}
        channelId={widget?.id ?? null}
        config={(widget?.config as Record<string, unknown> | null) ?? null}
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
        // WhatsApp OAuth channels store mode='OAUTH' (plus displayPhoneNumber
        // / verifiedName) in their config. QR-bridge channels store mode='QR'.
        // Legacy token-paste channels have mode='LEGACY' or no mode at all.
        const waIsOAuth =
          m.type === 'WHATSAPP' && config?.mode === 'OAUTH'
        const waIsQr =
          m.type === 'WHATSAPP' && config?.mode === 'QR'
        // For OAuth + QR WhatsApp channels, show the verified business name (or
        // display phone number) as the "username" so the connected card
        // identifies which number is wired up. For all other channels, fall
        // back to the legacy `botUsername` field.
        const waDisplay =
          m.type === 'WHATSAPP' && (waIsOAuth || waIsQr)
            ? String(config?.verifiedName ?? config?.displayPhoneNumber ?? '')
            : ''
        const botUsername =
          (config ? String(config.botUsername ?? '') : '') || waDisplay
        const webhookToken = config ? String(config.webhookToken ?? '') : ''
        const botAvatar =
          config && m.type === 'INSTAGRAM'
            ? String(config.igProfilePictureUrl ?? '')
            : ''
        const isMeta = m.type === 'WHATSAPP' || m.type === 'INSTAGRAM'
        // LEGACY WhatsApp channels still need manual webhook setup in the
        // Meta dashboard; OAuth (mode='OAUTH') and QR-bridge (mode='QR')
        // channels are managed by the platform — the backend handles webhook
        // subscription for OAuth, and the QR bridge forwards inbound messages
        // directly. So we hide the per-token callback URL / verify token block
        // for both OAuth and QR channels. Instagram OAuth channels are likewise
        // globally managed.
        const callbackUrl =
          isMeta &&
          m.type === 'WHATSAPP' &&
          webhookToken &&
          !waIsOAuth &&
          !waIsQr
            ? `${appUrl}/api/webhook/${WEBHOOK_PATH[m.type]}/${webhookToken}`
            : null
        // FRONTEND-AUTO-V3: Instagram no longer renders the legacy quick-replies
        // editor on this page — the dedicated `/agents/{agentId}/instagram`
        // automation tab is the canonical place for IG message builders.
        // We deliberately pass an empty array for IG so MessengerChannel never
        // renders the ChannelSettings card (also guarded by
        // SUPPORTS_QUICK_REPLIES.INSTAGRAM = false in messenger-channel.tsx).
        const quickReplies =
          m.type === 'INSTAGRAM'
            ? []
            : ch
              ? normalizeMessengerSettings(ch.config).quickReplies
              : []

        const channel = (
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
            verifyToken={
              m.type === 'WHATSAPP' && !waIsOAuth && !waIsQr
                ? webhookToken || null
                : null
            }
            lastInboundAt={ch?.lastInboundAt ? ch.lastInboundAt.toISOString() : null}
            quickReplies={quickReplies}
            botAvatar={botAvatar || null}
          />
        )
        return m.type === 'INSTAGRAM'
          ? <div key={m.type} id="instagram-connection" className="scroll-mt-24">{channel}</div>
          : channel
      })}

      {/* Not a chat channel — a data source. Point users to Store Integrations
          without cluttering the channel list with a toggle that doesn't belong. */}
      <Link
        href="/integrations"
        className="group flex items-start gap-4 rounded-[1.5rem] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6 transition-colors hover:border-[var(--border-strong)]"
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
