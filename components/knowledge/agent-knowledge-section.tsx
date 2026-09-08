import { ImprovementIntro } from '@/components/agents/improvement-intro'
import { getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { KbManager } from '@/components/knowledge/kb-manager'

export async function AgentKnowledgeSection({ agentId }: { agentId: string }) {
  const user = await requireUser()
  const isFa = (await getLocale()) !== 'en'

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId: user.workspaceId },
    select: { id: true, name: true },
  })
  if (!agent) notFound()

  const items = await prisma.knowledgeBase.findMany({
    where: { agentId: agent.id, type: { not: 'PRODUCT_CATALOG' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      chunkCount: true,
      errorMsg: true,
      // ─ F4: freshness tracking
      lastIngestedAt: true,
      refreshIntervalHours: true,
    },
  })
  return (
    <div className="space-y-6">
      <ImprovementIntro section="knowledge"
        title={isFa ? 'دانش ایجنت' : 'Agent knowledge'}
        description={isFa
          ? 'اطلاعاتی را که ایجنت برای پاسخ‌گویی نیاز دارد، اینجا اضافه و به‌روز کنید: معرفی کسب‌وکار، توضیح خدمات، شرایط ارسال و مرجوعی و سؤال‌های متداول. می‌توانید متن بنویسید، فایل بارگذاری کنید یا لینک سایت بدهید و وضعیت آماده‌شدن هر منبع را ببینید. ایجنت از این منابع برای پاسخ‌های دقیق‌تر استفاده می‌کند؛ پاسخ‌های تأییدشده در یادگیری هم به همین دانش اضافه می‌شوند.'
          : 'Add and update the information your agent needs: business details, services, shipping and return policies, and FAQs. Enter text, upload a file or add a website URL, then check each source’s processing status. The agent uses these sources for more accurate replies. Approved learning answers join this knowledge base too.'} />
      <KbManager agentId={agent.id} items={items} />
    </div>
  )
}
