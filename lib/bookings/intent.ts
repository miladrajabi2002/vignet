import type { ChatMessage } from '@/lib/ai/openrouter'

const BOOKING_INTENT = /(رزرو|نوبت|وقت|تقویم|ساعت|امروز|فردا|پس.?فردا|لغو نوبت|appointment|booking|book|slot|schedule|calendar|tomorrow|cancel)/i

export function hasBookingIntent(messages: ChatMessage[]): boolean {
  return messages
    .slice(-8)
    .some((message) => typeof message.content === 'string' && BOOKING_INTENT.test(message.content))
}
