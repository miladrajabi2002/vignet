import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  Store,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
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
  InstagramPagePicker,
  type PickerPage,
} from '@/components/channels/instagram-page-picker'
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

/** Shape of the `ig_oauth_pending` cookie stashed by the OAuth callback. */
interface IgOauthPending {
  agentId: string
  userToken: string
  userTokenExpiresAt: string
  pages: PickerPage[]
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

  // ── Instagram OAuth redirect-back handling ──────────────────────────────
  // The OAuth callback (/api/instagram/oauth/callback) redirects back to this
  // page with one of three query shapes:
  //   ?ig_connected=1  → single IG page was auto-connected (success)
  //   ?ig_pick=1       → multiple IG pages found; we stashed them in a cookie
  //                       and the operator needs to pick one (render the picker)
  //   ?ig_error=no_page|exchange|denied|state → failure with a specific reason
  const igConnected = !!searchParams.ig_connected
  const igPick = !!searchParams.ig_pick
  const igError =
    typeof searchParams.ig_error === 'string' ? searchParams.ig_error : null

  // When picking, read the httpOnly `ig_oauth_pending` cookie server-side
  // (the client can't) and pass the page list to the picker. The cookie is
  // base64url-encoded JSON.
  let pickPages: PickerPage[] = []
  let pickExpired = false
  if (igPick) {
    const cookieStore = await cookies()
    const raw = cookieStore.get('ig_oauth_pending')?.value
    if (raw) {
      try {
        const decoded = JSON.parse(
          Buffer.from(raw, 'base64url').toString('utf8'),
        ) as IgOauthPending
        if (decoded && Array.isArray(decoded.pages) && decoded.pages.length) {
          pickPages = decoded.pages
        } else {
          pickExpired = true
        }
      } catch {
        pickExpired = true
      }
    } else {
      pickExpired = true
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>

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
              href={`/agents/${agent.id}/instagram`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success hover:underline"
            >
              مدیریت اتوماسیون اینستاگرام
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      )}

      {igPick && (
        <>
          {pickExpired ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-50/80 p-4 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  نشست انتخاب صفحه منقضی شده است.
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                  لطفاً دوباره از ابتدا اتصال اینستاگرام را شروع کنید.
                </p>
              </div>
            </div>
          ) : (
            <InstagramPagePicker agentId={agent.id} pages={pickPages} />
          )}
        </>
      )}

      {igError === 'no_page' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-50/80 p-4 dark:bg-amber-950/30">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              هیچ صفحه فیسبوکی با اکانت اینستاگرام متصل پیدا نشد.
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              ابتدا اکانت اینستاگرام خود را به یک صفحه فیسبوک متصل کنید، سپس
              دوباره تلاش کنید.
            </p>
            <a
              href="/docs/instagram-connection"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              راهنمای اتصال اینستاگرام به فیسبوک
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </a>
          </div>
        </div>
      )}

      {igError && igError !== 'no_page' && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-danger">اتصال ناموفق بود.</p>
            <p className="mt-0.5 text-xs leading-relaxed text-danger/80">
              دوباره تلاش کنید یا راهنما را بخوانید.{' '}
              {igError === 'denied' && '(دسترسی لغو شد)'}
              {igError === 'exchange' && '(خطا در تأیید کد)'}
              {igError === 'state' && '(نشست نامعتبر)'}
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
        const botAvatar =
          config && m.type === 'INSTAGRAM'
            ? String(config.igProfilePictureUrl ?? '')
            : ''
        const isMeta = m.type === 'WHATSAPP' || m.type === 'INSTAGRAM'
        // WhatsApp still needs manual webhook setup in the Meta dashboard;
        // Instagram OAuth channels are managed globally by the platform app.
        const callbackUrl =
          isMeta && m.type === 'WHATSAPP' && webhookToken
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
            verifyToken={m.type === 'WHATSAPP' ? webhookToken || null : null}
            lastInboundAt={ch?.lastInboundAt ? ch.lastInboundAt.toISOString() : null}
            quickReplies={ch ? normalizeMessengerSettings(ch.config).quickReplies : []}
            botAvatar={botAvatar || null}
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
