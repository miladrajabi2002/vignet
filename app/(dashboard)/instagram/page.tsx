import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AgentInstagramPage from '@/app/(dashboard)/agents/[agentId]/instagram/page'

/**
 * Workspace-level Instagram entry point. The implementation remains agent-backed,
 * while the user stays in the dedicated Instagram workspace.
 *
 * When no IG channel is connected yet, the per-agent page now embeds the
 * connect flow directly, so the operator can connect straight from this tab
 * and is returned here after the OAuth round-trip (?ig_connected=1 /
 * ?ig_error=...).
 */
export default async function InstagramWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const locale = await getLocale()
  const sp = searchParams ? await searchParams : {}
  const agent = await prisma.agent.findFirst({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  return (
    <div className="mx-auto max-w-6xl">
      {agent ? (
        <AgentInstagramPage
          params={Promise.resolve({ agentId: agent.id })}
          returnTo="/instagram"
          igConnected={sp.ig_connected === '1' || sp.ig_connected === 'true'}
          igError={typeof sp.ig_error === 'string' && sp.ig_error ? sp.ig_error : null}
        />
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
