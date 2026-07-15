import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { Camera } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/dashboard/page-header'
import AgentInstagramPage from '@/app/(dashboard)/agents/[agentId]/instagram/page'

/**
 * Workspace-level Instagram entry point. The implementation remains agent-backed,
 * while the user stays in the dedicated Instagram workspace.
 */
export default async function InstagramWorkspacePage() {
  const user = await requireUser()
  const locale = await getLocale()
  const agent = await prisma.agent.findFirst({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={Camera}
        title={locale === 'fa' ? 'اینستاگرام' : 'Instagram'}
        subtitle={locale === 'fa'
          ? 'اتصال حساب، اتوماسیون‌های رایگان و پاسخ‌گویی هوشمند را از اینجا مدیریت کنید.'
          : 'Manage account connection, free automations and AI replies here.'}
      />
      {agent ? (
        <AgentInstagramPage params={Promise.resolve({ agentId: agent.id })} />
      ) : (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-secondary)]">
          <p>
            {locale === 'fa'
              ? 'برای اتصال اینستاگرام ابتدا یک ایجنت بسازید.'
              : 'Create an agent before connecting Instagram.'}
          </p>
          <Link
            href="/agents/new?business=instagram"
            className="mx-auto mt-4 flex min-h-11 w-fit items-center rounded-xl bg-black px-4 font-semibold text-white"
          >
            {locale === 'fa' ? 'ساخت ایجنت' : 'Create agent'}
          </Link>
        </div>
      )}
    </div>
  )
}
