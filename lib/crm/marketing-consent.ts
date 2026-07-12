import { prisma } from '@/lib/prisma'

const OPT_OUT_PHRASES = new Set([
  'stop',
  'unsubscribe',
  'cancel messages',
  'لغو',
  'لغو پیام',
  'لغو پیامها',
  'لغو پیام‌ها',
  'توقف پیام',
  'دیگه پیام نده',
  'دیگر پیام نده',
])

export function isMarketingOptOutMessage(text: string): boolean {
  const normalized = text
    .toLocaleLowerCase('fa')
    .replace(/[.!?؟،,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return OPT_OUT_PHRASES.has(normalized)
}

/** Timestamped consent change is the audit record; no raw inbound text stored. */
export async function optOutContact(contactId: string): Promise<void> {
  await prisma.contact.updateMany({
    where: { id: contactId },
    data: {
      marketingOptIn: false,
      marketingOptOutAt: new Date(),
    },
  })
}

export function optOutConfirmation(text: string): string {
  return /^[\x00-\x7F\s]+$/.test(text)
    ? 'You are unsubscribed from informational campaigns. Service replies to your direct requests remain available.'
    : 'ارسال پیام‌های اطلاع‌رسانی برای شما متوقف شد. پاسخ به درخواست‌های مستقیم شما همچنان فعال است.'
}

