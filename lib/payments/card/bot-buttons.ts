/**
 * Glass buttons under a payment alert in the owner's Telegram manager bot.
 * Pure: the payment service builds them without loading the bot.
 *
 * Callback data (see lib/channels/operator-bot.ts):
 *   py:v:<id> details · py:y:<id> ask to confirm · py:n:<id> ask to reject ·
 *   py:h:<id> a paid order was delivered
 */
import type { TelegramInlineKeyboardButton } from '@/lib/channels/operator-bot'

export function paymentAlertButtons(payment: { id: string; status: string; purpose?: string; handledAt?: Date | null }): TelegramInlineKeyboardButton[][] {
  if (payment.status === 'PENDING' || payment.status === 'CLAIMED') {
    return [
      [
        { text: '✅ واریز را دیدم، تأیید', callback_data: `py:y:${payment.id}` },
        { text: '❌ رد', callback_data: `py:n:${payment.id}` },
      ],
      [{ text: '🧾 جزئیات پرداخت', callback_data: `py:v:${payment.id}` }],
    ]
  }
  if (payment.status === 'PAID' && payment.purpose === 'ORDER' && !payment.handledAt) {
    return [
      [{ text: '📦 رسیدگی شد (ارسال کردم)', callback_data: `py:h:${payment.id}` }],
      [{ text: '🧾 جزئیات سفارش', callback_data: `py:v:${payment.id}` }],
    ]
  }
  return [[{ text: '🧾 جزئیات پرداخت', callback_data: `py:v:${payment.id}` }]]
}
