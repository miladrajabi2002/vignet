import { getLocale } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ContactsView, type ContactRow } from '@/components/crm/contacts-view'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 100

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

  const page = Math.max(1, Number(searchParams.page) || 1)

  const contacts = await prisma.contact.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1, // one extra row signals whether a next page exists
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

  const hasNext = contacts.length > PAGE_SIZE
  const pageContacts = hasNext ? contacts.slice(0, PAGE_SIZE) : contacts

  const rows: ContactRow[] = pageContacts.map((c) => {
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

  return (
    <ContactsView
      initial={rows}
      locale={locale}
      footer={
        <Pagination
          page={page}
          hasNext={hasNext}
          makeHref={(p) => `/contacts?page=${p}`}
        />
      }
    />
  )
}
