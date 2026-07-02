/**
 * CUSTOMER IDENTIFICATION (F3)
 * =============================
 *
 * Collects the customer's name + phone at the START of a conversation (per the
 * user's decision: "همون اولش بگیری کاربر"). The agent — guided by an injected
 * instruction — asks for these details before proceeding to substantive answers.
 *
 * Strategy:
 *   1. When a new conversation opens AND the agent has requireCustomerInfo=true,
 *      the conversation is marked customerInfoState='pending'.
 *   2. While 'pending', an extra system instruction is injected telling the LLM
 *      to first politely ask for name + phone, and to not answer substantive
 *      questions until it has at least a name.
 *   3. A lightweight extractor scans each incoming user message for an Iranian
 *      phone pattern + a likely-name; when found, the contact row is updated
 *      and the conversation is marked 'collected'.
 *   4. Messenger channels (Telegram/Bale/Rubika/WhatsApp/Instagram) already
 *      carry a trusted platform identity, so for those channels we default to
 *      customerInfoState='skipped' unless the agent explicitly opts in.
 */

import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const PHONE_RE = /(\+?98|0)?9\d{9}/g

export interface ExtractedIdentity {
  name: string | null
  phone: string | null
}

/**
 * Best-effort extraction of a name and phone from a free-form user message.
 * The phone is normalized to E.164-ish (+98XXXXXXXXXX). The name is detected
 * via lightweight Persian cues ("اسمم ...", "من ... هستم", "name: ...").
 */
export function extractIdentity(text: string): ExtractedIdentity {
  let phone: string | null = null
  const phoneMatch = text.match(PHONE_RE)
  if (phoneMatch) {
    const raw = phoneMatch[0]
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 10 && digits.startsWith('9')) {
      phone = `+98${digits}`
    } else if (digits.length === 11 && digits.startsWith('09')) {
      phone = `+98${digits.slice(1)}`
    } else if (digits.length === 12 && digits.startsWith('98')) {
      phone = `+${digits}`
    } else if (digits.length >= 10) {
      phone = `+${digits}`
    }
  }

  let name: string | null = null
  // Persian cues
  const faPatterns = [
    /(?:اسمم|اسمی|اسم|من)\s+(?:من\s+)?([\p{L}\s]{2,30})\s+(?:هستم|است|می‌باشم)/u,
    /([\p{L}\s]{2,30})\s+(?:صحبت\s+می‌کنم|هستم)/u,
    /(?:بنده|من)\s+([\p{L}\s]{2,30})\s*(?:$|[،.])/u,
  ]
  for (const re of faPatterns) {
    const m = text.match(re)
    if (m && m[1]) {
      const candidate = m[1].trim().replace(/\s+/g, ' ')
      if (candidate.length >= 2 && candidate.length <= 30) {
        name = candidate
        break
      }
    }
  }
  // English cues
  if (!name) {
    const enPatterns = [
      /(?:my\s+name\s+is|i\s*am|i'm|name:?)\s+([A-Za-z][A-Za-z\s]{1,30})/i,
    ]
    for (const re of enPatterns) {
      const m = text.match(re)
      if (m && m[1]) {
        const candidate = m[1].trim().replace(/\s+/g, ' ')
        if (candidate.length >= 2 && candidate.length <= 30) {
          name = candidate
          break
        }
      }
    }
  }

  return { name, phone }
}

/** Channels where the platform already provides a trusted sender identity. */
export function channelHasTrustedIdentity(channel: ChannelType): boolean {
  return (
    channel === 'TELEGRAM' ||
    channel === 'WHATSAPP' ||
    channel === 'INSTAGRAM' ||
    channel === 'RUBIKA' ||
    channel === 'BALE'
  )
}

/**
 * Decide the initial customerInfoState for a brand-new conversation.
 *  - Messenger channels: 'skipped' (we already know who they are from the platform)
 *  - Web widget / API: 'pending' if the agent requires it, else 'skipped'
 */
export function initialState(
  channel: ChannelType,
  requireCustomerInfo: boolean,
): 'pending' | 'skipped' {
  if (requireCustomerInfo && !channelHasTrustedIdentity(channel)) return 'pending'
  return 'skipped'
}

/**
 * Persist extracted identity onto the contact + flip the conversation state to
 * 'collected' when we have at least a name OR a phone. Fire-and-forget safe.
 */
export async function applyExtractedIdentity(params: {
  conversationId: string
  contactId: string | null
  extracted: ExtractedIdentity
}): Promise<void> {
  const { conversationId, contactId, extracted } = params
  if (!extracted.name && !extracted.phone) return

  if (contactId) {
    const existing = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, name: true, phone: true },
    })
    if (existing) {
      const data: { name?: string; phone?: string } = {}
      if (extracted.name && !existing.name) data.name = extracted.name
      if (extracted.phone && !existing.phone) data.phone = extracted.phone
      if (Object.keys(data).length) {
        await prisma.contact.update({ where: { id: contactId }, data })
      }
    }
  }

  // Mark conversation as collected once we have a name (phone optional).
  if (extracted.name) {
    await prisma.conversation
      .update({
        where: { id: conversationId },
        data: { customerInfoState: 'collected', identifiedAt: new Date() },
      })
      .catch(() => {})
  }
}

/**
 * The extra instruction appended to the system prompt while the conversation is
 * still in the 'pending' identification state. Tells the LLM to collect name+phone
 * FIRST, before answering substantive questions.
 */
export function identificationInstruction(isFa: boolean, customPrompt?: string | null): string {
  if (customPrompt && customPrompt.trim()) {
    return isFa
      ? `\n\n### مهم: شناسایی مشتری (الزامی)\n${customPrompt.trim()}`
      : `\n\n### Required: customer identification\n${customPrompt.trim()}`
  }
  return isFa
    ? `\n\n### مهم: شناسایی مشتری (الزامی قبل از پاسخ اصلی)
در ابتدای گفتگو، قبل از هر چیز، مودبانه نام و شماره تماس مشتری را بپرس.
قوانین:
• اگر مشتری فقط سلام کرد، خوش‌آمد بگو و نامش را بپرس.
• اگر مشتری مستقیم سؤال فنی پرسید، اول تأیید کن که به زودی پاسخ می‌دهی، بعد نامش را بپرس.
• تا وقتی حداقل نام را نداری، وارد بحث جزئیات محصول/قیمت نشو.
• وقتی نام + شماره را گرفتی، تشکر کن و بعد کامل پاسخ بده.
• اگر مشتری از دادن شماره امتناع کرد، فقط نام کافی است — اصرار نکن.`
    : `\n\n### Required: customer identification (before substantive answers)
At the very start of the conversation, politely ask for the customer's name and phone.
Rules:
• If they only say "hi", greet and ask their name.
• If they ask a technical question right away, acknowledge you'll answer, then ask their name.
• Don't dive into product/price details until you have at least their name.
• Once you have name + phone, thank them and answer fully.
• If they refuse the phone, name alone is enough — don't push.`
}
