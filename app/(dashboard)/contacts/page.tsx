import { getLocale } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ContactsView, type ContactRow } from '@/components/crm/contacts-view'

export default async function ContactsPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

  const contacts = await prisma.contact.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { updatedAt: 'desc' },
    take: 300,
    select: {
      id: true,
      name: true,
      phone: true,
      stage: true,
      tags: true,
      updatedAt: true,
      telegramId: true,
      whatsappId: true,
      instagramId: true,
      rubikaId: true,
      baleId: true,
      _count: { select: { conversations: true } },
    },
  })

  const rows: ContactRow[] = contacts.map((c) => {
    const channels: ChannelType[] = []
    if (c.telegramId) channels.push('TELEGRAM')
    if (c.whatsappId) channels.push('WHATSAPP')
    if (c.instagramId) channels.push('INSTAGRAM')
    if (c.rubikaId) channels.push('RUBIKA')
    if (c.baleId) channels.push('BALE')
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      stage: c.stage,
      tags: c.tags,
      channels,
      conversationCount: c._count.conversations,
      updatedAt: c.updatedAt.toISOString(),
    }
  })

  return <ContactsView initial={rows} locale={locale} />
}
