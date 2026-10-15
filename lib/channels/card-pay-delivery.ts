/**
 * Deliver a payment-gateway card on a messenger: the adapter's own card when
 * it has one (copy buttons on Telegram), otherwise the card number and the
 * amount as separate, copyable messages.
 */
import type { MessengerAdapter } from '@/lib/channels/types'
import { cardPaySplitMessages, type CardPayView } from '@/lib/payments/card/pay-card'

export async function sendCardPay(adapter: Pick<MessengerAdapter, 'sendText' | 'sendCardPayCard'>, chatId: string, card: CardPayView): Promise<void> {
  if (adapter.sendCardPayCard) {
    try {
      await adapter.sendCardPayCard(chatId, card)
      return
    } catch (error) {
      console.error('[card-pay] channel card failed, sending text:', error)
    }
  }
  for (const text of cardPaySplitMessages(card)) await adapter.sendText(chatId, text)
}
