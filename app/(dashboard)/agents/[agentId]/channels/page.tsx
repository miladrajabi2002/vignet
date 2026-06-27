import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { WebWidgetChannel } from '@/components/channels/web-widget-channel'
import {
  MessengerChannel,
  type MessengerKind,
} from '@/components/channels/messenger-channel'

/** Public webhook path segment per messenger type. */
const WEBHOOK_PATH: Record<MessengerKind, string> = {
  TELEGRAM: 'telegram',
  BALE: 'bale',
  RUBIKA: 'rubika',
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
}

export default async function AgentChannelsPage({
  params,
}: {
  params: { agentId: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('channels')

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: {
      id: true,
      name: true,
      channels: { select: { id: true, type: true, config: true } },
    },
  })
  if (!agent) notFound()

  const widget = agent.channels.find((c) => c.type === 'WEB_WIDGET')
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
      <Link
        href={`/agents/${agent.id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {agent.name}
      </Link>
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>

      <WebWidgetChannel
        agentId={agent.id}
        baseUrl={baseUrl}
        enabled={!!widget}
        channelId={widget?.id ?? null}
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
          />
        )
      })}
    </div>
  )
}
