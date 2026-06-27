import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  ArrowLeft,
  Send,
  MessagesSquare,
  Radio,
  MessageCircle,
  Camera,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { WebWidgetChannel } from '@/components/channels/web-widget-channel'
import {
  MessengerChannel,
  type MessengerKind,
} from '@/components/channels/messenger-channel'

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

  const messengers: {
    type: MessengerKind
    label: string
    hint: string
    icon: typeof Send
  }[] = [
    { type: 'TELEGRAM', label: t('telegram'), hint: t('telegramHint'), icon: Send },
    { type: 'BALE', label: t('bale'), hint: t('baleHint'), icon: MessagesSquare },
    { type: 'RUBIKA', label: t('rubika'), hint: t('rubikaHint'), icon: Radio },
    {
      type: 'WHATSAPP',
      label: t('whatsapp'),
      hint: t('whatsappHint'),
      icon: MessageCircle,
    },
    {
      type: 'INSTAGRAM',
      label: t('instagram'),
      hint: t('instagramHint'),
      icon: Camera,
    },
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
        const botUsername =
          ch && ch.config && typeof ch.config === 'object' && 'botUsername' in ch.config
            ? String((ch.config as Record<string, unknown>).botUsername ?? '')
            : ''
        return (
          <MessengerChannel
            key={m.type}
            agentId={agent.id}
            type={m.type}
            label={m.label}
            hint={m.hint}
            icon={m.icon}
            enabled={!!ch}
            channelId={ch?.id ?? null}
            botUsername={botUsername || null}
          />
        )
      })}
    </div>
  )
}
