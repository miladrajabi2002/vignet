import type { ChannelType } from '@prisma/client'
import type { MessengerAdapter } from '@/lib/channels/types'
import {
  telegramAdapter,
  setTelegramWebhook,
  getTelegramBotInfo,
} from '@/lib/channels/telegram'
import { baleAdapter, setBaleWebhook, getBaleBotInfo } from '@/lib/channels/bale'
import {
  rubikaAdapter,
  setRubikaWebhook,
  getRubikaBotInfo,
} from '@/lib/channels/rubika'
import {
  whatsappAdapter,
  setWhatsappWebhook,
  getWhatsappInfo,
} from '@/lib/channels/whatsapp'
import {
  instagramAdapter,
  setInstagramWebhook,
  getInstagramInfo,
} from '@/lib/channels/instagram'

/** Channel types that are bot-token messenger channels (vs. web widget/api). */
export const MESSENGER_TYPES = [
  'TELEGRAM',
  'BALE',
  'RUBIKA',
  'WHATSAPP',
  'INSTAGRAM',
] as const
export type MessengerType = (typeof MESSENGER_TYPES)[number]

export function isMessengerType(type: ChannelType): type is MessengerType {
  return (MESSENGER_TYPES as readonly string[]).includes(type)
}

/** Build the adapter for a messenger channel from its decrypted bot token. */
export function getAdapter(
  type: MessengerType,
  token: string,
): MessengerAdapter {
  switch (type) {
    case 'TELEGRAM':
      return telegramAdapter(token)
    case 'BALE':
      return baleAdapter(token)
    case 'RUBIKA':
      return rubikaAdapter(token)
    case 'WHATSAPP':
      return whatsappAdapter(token)
    case 'INSTAGRAM':
      return instagramAdapter(token)
  }
}

/** Register the platform webhook pointing at our public route. */
export function setWebhook(
  type: MessengerType,
  token: string,
  url: string,
): Promise<boolean> {
  switch (type) {
    case 'TELEGRAM':
      return setTelegramWebhook(token, url)
    case 'BALE':
      return setBaleWebhook(token, url)
    case 'RUBIKA':
      return setRubikaWebhook(token, url)
    case 'WHATSAPP':
      return setWhatsappWebhook()
    case 'INSTAGRAM':
      return setInstagramWebhook()
  }
}

/** Verify a bot token, returning its username when valid. */
export function getBotInfo(
  type: MessengerType,
  token: string,
): Promise<{ username: string } | null> {
  switch (type) {
    case 'TELEGRAM':
      return getTelegramBotInfo(token)
    case 'BALE':
      return getBaleBotInfo(token)
    case 'RUBIKA':
      return getRubikaBotInfo(token)
    case 'WHATSAPP':
      return getWhatsappInfo(token)
    case 'INSTAGRAM':
      return getInstagramInfo(token)
  }
}

/** Map a messenger channel to the Contact field that stores its user id. */
export function contactIdField(
  type: MessengerType,
): 'telegramId' | 'baleId' | 'rubikaId' | 'whatsappId' | 'instagramId' {
  switch (type) {
    case 'TELEGRAM':
      return 'telegramId'
    case 'BALE':
      return 'baleId'
    case 'RUBIKA':
      return 'rubikaId'
    case 'WHATSAPP':
      return 'whatsappId'
    case 'INSTAGRAM':
      return 'instagramId'
  }
}
