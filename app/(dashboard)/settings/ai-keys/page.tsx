import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AiKeyForm } from '@/components/settings/ai-key-form'

export default async function AiKeysPage() {
  const user = await requireUser()
  const t = await getTranslations('settings')

  const ws = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { openrouterKeyHint: true },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-light text-[var(--text-primary)]">
        {t('title')}
      </h1>
      <AiKeyForm currentHint={ws?.openrouterKeyHint ?? null} />
    </div>
  )
}
