import { describe, expect, it } from 'vitest'
import { resolveBaileysInboundIdentity } from '@/mini-services/whatsapp-bridge/inbound-identity'

describe('WhatsApp QR inbound identity', () => {
  it('uses senderPn for an inbound LID instead of saving the opaque LID as a phone', () => {
    expect(resolveBaileysInboundIdentity({
      remoteJid: '181316641398869@lid',
      senderPn: '989128352271@s.whatsapp.net',
    })).toEqual({
      chatId: '989128352271',
      senderId: '181316641398869',
      phone: '989128352271',
    })
  })

  it('supports the inverse identity exposed as remoteJidAlt', () => {
    expect(resolveBaileysInboundIdentity({
      remoteJid: '181316641398869@lid',
      remoteJidAlt: '989128352271:12@s.whatsapp.net',
    })).toEqual({
      chatId: '989128352271',
      senderId: '181316641398869',
      phone: '989128352271',
    })
  })

  it('keeps the complete LID as the reply target when no PN mapping exists', () => {
    expect(resolveBaileysInboundIdentity({
      remoteJid: '181316641398869@lid',
    })).toEqual({
      chatId: '181316641398869@lid',
      senderId: '181316641398869',
      phone: undefined,
    })
  })
})
