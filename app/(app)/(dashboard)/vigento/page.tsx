import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { VigentoWorkspace } from '@/components/dashboard/vigento-workspace'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('ویجنتو', 'Vigento')

export default async function VigentoPage(props: { searchParams: Promise<{ q?: string }> }) {
  const [user, localeValue, searchParams] = await Promise.all([requireUser(), getLocale(), props.searchParams])
  const locale = localeValue === 'en' ? 'en' : 'fa'
  // `?q=` comes from the overview card's starter questions.
  const initialQuestion = typeof searchParams.q === 'string' ? searchParams.q.slice(0, 1000) : undefined
  const workspaceId = user.workspaceId
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  // The first suggestions follow what is going on in this workspace right now.
  const [openConversations, handedOff, products, knowledgeNotReady, unanswered7d] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId, status: 'OPEN' } }),
    prisma.conversation.count({ where: { workspaceId, handedOff: true, status: { not: 'RESOLVED' } } }),
    prisma.product.count({ where: { workspaceId, active: true } }),
    prisma.knowledgeBase.count({ where: { agent: { workspaceId }, status: { not: 'READY' } } }),
    prisma.message.count({ where: { unanswered: true, createdAt: { gte: weekAgo }, conversation: { workspaceId, isPlayground: false } } }),
  ])
  return (
    <VigentoWorkspace
      locale={locale}
      ownerName={user.name}
      initialQuestion={initialQuestion}
      signals={{ openConversations, handedOff, products, knowledgeNotReady, unanswered7d }}
    />
  )
}
