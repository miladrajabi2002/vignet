import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { KeyRound, Users, ChevronRight } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
        OperatorChannelSetup,
        type OperatorChannelInfo,
} from '@/components/crm/operator-channel-setup'

export default async function SettingsPage() {
  const t = await getTranslations()
  const user = await requireUser()

  const items = [
    {
      href: '/settings/ai-keys',
      icon: KeyRound,
      title: t('settings.aiKeys.title'),
      desc: t('settings.aiKeys.subtitle'),
    },
    {
      href: '/settings/team',
      icon: Users,
      title: t('dashboard.contacts'),
      desc: t('settings.title'),
    },
  ]

  // Load the workspace's operator Telegram bot (masked) so the setup card can
  // render without an extra round-trip. We strip the raw token here — only the
  // masked hint is sent to the client.
  const op = await prisma.operatorChannel.findUnique({
    where: { workspaceId: user.workspaceId },
    select: {
      id: true,
      botUsername: true,
      operatorChatId: true,
      active: true,
      lastError: true,
      botToken: true,
    },
  })
  const operatorChannel: OperatorChannelInfo | null = op
    ? {
        id: op.id,
        botUsername: op.botUsername,
        operatorChatId: op.operatorChatId,
        active: op.active,
        lastError: op.lastError,
        botTokenMasked: op.botToken ? '••••' : null,
      }
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-light text-[var(--text-primary)]">
        {t('settings.title')}
      </h1>
      <div className="space-y-3">
        {items.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--border-hover)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--text-primary)]">
                {title}
              </div>
              <div className="truncate text-sm text-[var(--text-secondary)]">
                {desc}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] rtl:rotate-180" />
          </Link>
        ))}
      </div>

      <OperatorChannelSetup current={operatorChannel} />
    </div>
  )
}
