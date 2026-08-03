export interface BaileysInboundKey {
  remoteJid?: string | null
  remoteJidAlt?: string | null
  senderPn?: string | null
  participantPn?: string | null
}

export interface ResolvedInboundIdentity {
  /** Destination passed through the app and back to Baileys for replies. */
  chatId: string
  /** Stable Baileys identity, kept separate from the provider destination. */
  senderId: string
  /** E.164 digits when Baileys exposes the phone-number identity. */
  phone?: string
}

function phoneDigits(value: string | null | undefined): string | undefined {
  const input = value?.trim()
  if (!input) return undefined

  // In PN addressing mode Baileys uses 98912...@s.whatsapp.net. Some stanza
  // attributes can include a device suffix (98912...:12@s.whatsapp.net).
  const jid = input.match(/^(\d+)(?::\d+)?@s\.whatsapp\.net$/i)
  if (jid) return jid[1]

  // senderPn/participantPn may occasionally arrive as bare E.164 digits.
  const bare = input.replace(/^\+/, '')
  return /^\d{7,15}$/.test(bare) ? bare : undefined
}

/**
 * Resolve WhatsApp's newer LID addressing without mistaking an opaque @lid
 * identifier for a mobile number. Baileys 6.7.x exposes the corresponding PN
 * in senderPn; newer releases can additionally expose remoteJidAlt.
 */
export function resolveBaileysInboundIdentity(
  key: BaileysInboundKey,
): ResolvedInboundIdentity | null {
  const remoteJid = key.remoteJid?.trim()
  if (!remoteJid) return null

  const phone = [
    key.senderPn,
    key.remoteJidAlt,
    key.participantPn,
    remoteJid,
  ].map(phoneDigits).find(Boolean)
  const opaqueLid = remoteJid.match(/^(\d+)@lid$/i)?.[1]

  return {
    // Prefer the PN when available. If WhatsApp supplied only a LID, retain
    // the complete @lid JID so /send-text does not append the wrong PN suffix.
    chatId: phone ?? remoteJid,
    // Keeping the original LID lets the CRM find and repair contacts created
    // by the old bridge, which stored the bare LID (for example
    // 181316641398869) as their WhatsApp identity.
    senderId: opaqueLid ?? phone ?? remoteJid,
    phone,
  }
}
