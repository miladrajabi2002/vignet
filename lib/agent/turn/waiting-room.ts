/**
 * The waiting room: a conversation handed to a person whom the customer is
 * still waiting for.
 *
 * Before 2026-10-23 a handed-off thread went silent (or repeated «لطفاً کمی
 * صبر کنید») until an operator answered: the median wait was 95 minutes, one
 * in ten waited over 14 hours, and 108 customer messages in two weeks went
 * unanswered. Now, until the first operator reply, the assistant keeps
 * answering factual questions (price, stock, specs, shipping, hours) under
 * strict limits, and the owner is reminded while the customer keeps writing.
 * The first operator message ends the waiting room for good.
 */
import { prisma } from '@/lib/prisma'
import { notifyWorkspace } from '@/lib/notifications/create'

/** Reminders to the owner after the transfer, while the customer keeps writing. */
const REMINDER_AFTER_MS = [10 * 60_000, 30 * 60_000] as const

export interface WaitingRoomStatus {
  /** The customer is waiting for a person who has not answered yet. */
  waiting: boolean
  /** When the conversation was handed over (latest transfer). */
  since: Date | null
}

/**
 * A thread is in the waiting room when it is human-owned through a transfer
 * (an alert exists) that nobody has claimed or answered since. A thread an
 * operator took over by hand (no alert) or already answered stays theirs.
 */
export async function waitingRoomStatus(conversationId: string): Promise<WaitingRoomStatus> {
  const [alert, notice] = await Promise.all([
    prisma.handoffAlert.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, state: true, claimedBy: true },
    }),
    // The transfer line the engine itself sends (persistHandoff). A test chat
    // from the dashboard has this marker but never an alert.
    prisma.message.findFirst({
      where: { conversationId, role: 'ASSISTANT', metadata: { path: ['handoffNotice'], equals: true } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])
  if (alert && (alert.state !== 'open' || alert.claimedBy)) return { waiting: false, since: null }
  const since = [alert?.createdAt, notice?.createdAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  if (!since) return { waiting: false, since: null }
  const operatorReply = await prisma.message.findFirst({
    where: {
      conversationId,
      role: 'ASSISTANT',
      createdAt: { gt: since },
      metadata: { path: ['operator'], equals: true },
    },
    select: { id: true },
  })
  return { waiting: !operatorReply, since }
}

/** Instruction appended to the reply prompt for a waiting-room turn. */
export function waitingRoomInstruction(lang: 'fa' | 'en' | 'ar', minutesWaiting: number): string {
  if (lang === 'en') {
    return `\n\n=== Waiting for a colleague ===\nThis conversation was handed to a human colleague ${minutesWaiting} minutes ago and they have not replied yet. Keep helping meanwhile, within these limits:\n- Answer factual questions (price, stock, specs, shipping, hours, how to order) only from the catalog and knowledge above.\n- Never give a discount, promise a time, confirm an order or decide anything that was handed to the colleague; say the colleague will settle that.\n- Do not repeat "please wait". If the message is only thanks or waiting, reply in one short sentence.\n- Never claim the colleague has seen the message or will reply at a given time.`
  }
  return `\n\n=== در انتظار همکار ===\nاین گفتگو ${minutesWaiting} دقیقه پیش به همکار انسانی سپرده شده و او هنوز جواب نداده. تا آن موقع کمک کن، با این مرزها:\n- به سؤال‌های اطلاعاتی (قیمت، موجودی، مشخصات، ارسال، ساعت کاری، روش سفارش) فقط از کاتالوگ و دانش بالا جواب بده.\n- تخفیف نده، زمان قول نده، سفارش را تأیید نکن و دربارهٔ موضوعی که به همکار سپرده شده تصمیم نگیر؛ بگو این را همکار نهایی می‌کند.\n- «لطفاً صبر کنید» را تکرار نکن. اگر پیام فقط تشکر یا انتظار است، یک جملهٔ کوتاه جواب بده.\n- هرگز نگو همکار پیام را دیده یا تا زمان مشخصی جواب می‌دهد.`
}

/**
 * Remind the owner when the customer is still writing 10 and 30 minutes
 * after the transfer (at most two reminders per transfer). Never throws.
 */
export async function remindOwnerIfStillWaiting(params: {
  workspaceId: string
  conversationId: string
  since: Date
  contactName: string | null
}): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.conversationId },
      select: { metadata: true },
    })
    const metadata = (conversation?.metadata ?? {}) as Record<string, unknown>
    const sinceKey = params.since.toISOString()
    const sent = metadata.waitingReminderFor === sinceKey && typeof metadata.waitingReminders === 'number'
      ? metadata.waitingReminders
      : 0
    const due = REMINDER_AFTER_MS[sent]
    const waitedMs = Date.now() - params.since.getTime()
    if (due === undefined || waitedMs < due) return
    await prisma.conversation.update({
      where: { id: params.conversationId },
      data: { metadata: { ...metadata, waitingReminderFor: sinceKey, waitingReminders: sent + 1 } },
    })
    const minutes = Math.round(waitedMs / 60_000)
    const who = params.contactName?.trim() || 'یک مشتری'
    await notifyWorkspace({
      workspaceId: params.workspaceId,
      type: 'HANDOFF',
      title: `${who} ${minutes} دقیقه است منتظر جواب همکار است`,
      body: 'گفتگو به اپراتور سپرده شده و هنوز کسی جواب نداده. تا آن موقع دستیار فقط به سؤال‌های اطلاعاتی جواب می‌دهد.',
      link: `/conversations/${params.conversationId}`,
      operatorTelegram: true,
    })
  } catch (error) {
    console.error('[waiting-room] owner reminder failed:', error)
  }
}
