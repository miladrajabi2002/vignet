import { getLocale } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import { Users, UserPlus, GitMerge, Tag } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ContactsView, type ContactRow } from '@/components/crm/contacts-view'
import { MetricsExplainer } from '@/components/dashboard/metrics-explainer'
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
    <div className="space-y-6">
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

      <MetricsExplainer
        title={
          locale === 'fa'
            ? 'این مخاطبین از کجا می‌آیند؟'
            : 'Where do these contacts come from?'
        }
        items={[
          {
            icon: UserPlus,
            term:
              locale === 'fa' ? 'ایجاد خودکار: ' : 'Auto-created: ',
            body:
              locale === 'fa'
                ? 'هر بار که یک شخص برای اولین بار از طریق یکی از کانال‌ها (تلگرام، بله، روبیکا، واتساپ، اینستاگرام یا وب‌ویجت) با ایجنت شما صحبت کند، یک مخاطب جدید به‌صورت خودکار ایجاد می‌شود. نیازی به افزودن دستی نیست.'
                : 'Every time someone talks to your agent for the first time through any channel (Telegram, Bale, Rubika, WhatsApp, Instagram, or web widget), a new contact is created automatically. No manual entry needed.',
          },
          {
            icon: GitMerge,
            term:
              locale === 'fa'
                ? 'یکپارچه‌سازی بین کانال‌ها: '
                : 'Cross-channel unification: ',
            body:
              locale === 'fa'
                ? 'اگر یک شخص از دو کانال مختلف (مثلاً تلگرام و واتساپ) با شماره تلفن یکسان پیام بدهد، هر دو ارتباط به همان مخاطب متصل می‌شود — «یک مشتری، چند کانال». این کار با تطبیق شماره تلفن انجام می‌شود.'
                : 'If the same person messages from two different channels (e.g. Telegram and WhatsApp) with the same phone number, both connections are linked to one contact — "one customer, many channels". This is done by matching phone numbers.',
          },
          {
            icon: Users,
            term:
              locale === 'fa' ? 'مرحله (Stage): ' : 'Pipeline stage: ',
            body:
              locale === 'fa'
                ? 'هر مخاطب یک مرحله فروش دارد: لید (سرنخ)، واجد شرایط، مشتری، یا از دست رفته. می‌توانید در نمای pipeline مرحله را با drag-and-drop تغییر دهید. مراحل به‌صورت پیش‌فرض روی «لید» هستند.'
                : 'Each contact has a sales stage: lead, qualified, customer, or lost. Drag-and-drop in the pipeline view to change it. New contacts default to "lead".',
          },
          {
            icon: Tag,
            term: locale === 'fa' ? 'تگ‌ها: ' : 'Tags: ',
            body:
              locale === 'fa'
                ? 'تگ‌ها برچسب‌های دلخواه هستند که می‌توانید به مخاطب اضافه کنید (مثلاً «VIP»، «خرید عمده»). در صفحه جزئیات مخاطب قابل ویرایش هستند و برای فیلتر کردن و دسته‌بندی استفاده می‌شوند.'
                : 'Tags are custom labels you can add to a contact (e.g. "VIP", "wholesale"). Edit them on the contact detail page; use them for filtering and segmentation.',
          },
        ]}
      />
    </div>
  )
}
