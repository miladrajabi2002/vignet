/**
 * Platform-aware prompt guidance.
 *
 * Tells the agent WHICH surface it is currently speaking on
 * (Telegram / WhatsApp / Instagram / Rubika / Bale / Web Widget / Chat Link /
 * API) and — when known — the sub-origin (DM / comment / story reply / etc.).
 *
 * Why: an Instagram public comment and a Telegram DM are very different
 * audiences. A long multi-paragraph answer is great in a widget but spammy
 * in a Telegram DM, and unacceptable under a public comment. The agent
 * should:
 *   • keep comment replies short and never ask for private data publicly;
 *     route the customer to DM when conversation needs to go deeper.
 *   • keep messenger replies (Telegram/WhatsApp/Rubika/Bale) short,
 *     conversational, no markdown headings, no long bullet lists.
 *   • on the web widget / chat link, longer structured answers are fine
 *     (the widget renders markdown and supports product cards).
 *   • the API channel is downstream of an integrator; reply with the same
 *     format the agent normally uses, but no marketing/CTA polish.
 *
 * The block is APPENDED to the system prompt (after safety rules) so it
 * does not override evidence, scope or guardrails — it only shapes
 * formatting/length/CTA on the channel the customer is actually using.
 */

import type { ChannelType } from '@prisma/client'
import type { InboundSource } from '@/lib/conversations/source'
import type { TurnLanguage } from '@/lib/ai/turn-language'

export interface PlatformContextInput {
  /** Logical channel (TELEGRAM / WHATSAPP / INSTAGRAM / RUBIKA / BALE / WEB_WIDGET / CHAT_LINK / API). */
  channel: ChannelType
  /** Channel-native origin (DM / COMMENT / STORY_REPLY / etc.) when available. */
  source: InboundSource | null
  /** Reply locale detected from the customer's current message. */
  turnLanguage: TurnLanguage
}

/**
 * A short, lowercase machine-facing identifier the model can echo back if
 * asked "where am I" — kept stable so we can grep logs for it.
 */
export function platformTag(input: PlatformContextInput): string {
  const channel = input.channel.toLowerCase()
  const kind = input.source?.kind?.toLowerCase() ?? 'message'
  return `${channel}:${kind}`
}

/**
 * Build the platform-awareness system block. Returns "" when no guidance is
 * applicable (currently never, but kept as a safe escape).
 */
export function buildPlatformContextBlock(input: PlatformContextInput): string {
  const isFa = input.turnLanguage !== 'en'
  const tag = platformTag(input)
  const kind = input.source?.kind ?? null

  // Channel-family classification
  const isMessenger =
    input.channel === 'TELEGRAM' ||
    input.channel === 'WHATSAPP' ||
    input.channel === 'RUBIKA' ||
    input.channel === 'BALE'
  const isInstagram = input.channel === 'INSTAGRAM'
  const isPublicComment = isInstagram && (kind === 'COMMENT' || kind === 'REACTION' || kind === 'STORY_MENTION')
  const isStoryReply = isInstagram && (kind === 'STORY_REPLY' || kind === 'STORY_REACTION')
  const isInstagramDM = isInstagram && (kind === 'DM' || kind === 'MESSAGE' || kind === null)
  const isWebLike = input.channel === 'WEB_WIDGET' || input.channel === 'CHAT_LINK'
  const isApi = input.channel === 'API'

  const lines: string[] = []
  if (isFa) {
    lines.push('### بستر گفتگو (channel-awareness)')
    lines.push(`• شما همین‌الان روی بستر \`${tag}\` در حال پاسخ هستید؛ این بستر تعیین می‌کند چه مقدار متن، چند خط و چه قالبی برای کاربر مناسب است.`)
  } else {
    lines.push('### Conversation surface (channel-awareness)')
    lines.push(`• You are currently replying on the \`${tag}\` surface; it dictates how much text, how many lines and which format is appropriate for the user.`)
  }

  // ─── Public comment lane ───────────────────────────────────────────────
  if (isPublicComment) {
    if (isFa) {
      lines.push('• این یک کامنت عمومی اینستاگرام است، نه دایرکت. قوانین سخت‌گیرانه‌تر است:')
      lines.push('  • پاسخ حداکثر ۱ الی ۲ جمله کوتاه باشد؛ کامنت طولانی یا لیست‌وار توسط کاربران نادیده گرفته می‌شود.')
      lines.push('  • هرگز اطلاعات شخصی (شماره تماس، کد ملی، آدرس، رمز، شماره سفارش، قیمت نهایی، موجودی دقیق) در کامنت عمومی ننویس.')
      lines.push('  • لینک پرداخت، لینک سایت، شماره کارت و QR code را فقط در دایرکت بفرست، نه در کامنت.')
      lines.push('  • اگر پاسخ کامل به داده شخصی نیاز دارد، در کامنت کوتاه راهنمایی کن و کاربر را به دایرکت دعوت کن (مثلاً «در دایرکت چک می‌کنم و کامل می‌گم، لطفاً دایرکت بدید»).')
      lines.push('  • هیچ سؤالی که پاسخش اطلاعات شخصی باشد در کامنت نپرس؛ سؤال‌های عمومی (مثل «برای چه کاربردی می‌خواید؟») فقط در صورت نیاز کوتاه پرسیده شود.')
      lines.push('  • ایموجی و حالت دوستانه در کامنت خوب است ولی بیش از حد استفاده نکن.')
    } else {
      lines.push('• This is a public Instagram COMMENT, not a DM. Stricter rules apply:')
      lines.push('  • Keep the reply to 1–2 short sentences; long or list-style comments get ignored.')
      lines.push('  • Never write personal data (phone, ID, address, password, order number, final price, exact stock) in a public comment.')
      lines.push('  • Payment links, site URLs, card numbers and QR codes belong in DM only — never in a comment.')
      lines.push('  • If the full answer needs personal data, briefly hint in the comment and move the user to DM (e.g. "I\'ll check in DM — please DM me").')
      lines.push('  • Do not ask a question whose answer is personal; only ask general clarifiers (e.g. "what use case?") when truly needed and short.')
      lines.push('  • Emoji and a friendly tone are fine in comments, but don\'t overuse them.')
    }
    return lines.join('\n')
  }

  // ─── Story reply lane ──────────────────────────────────────────────────
  if (isStoryReply) {
    if (isFa) {
      lines.push('• کاربر در پاسخ به استوری شما پیام داده. این یک واکنش کوتاه و شخصی است؛ پاسخ را کوتاه، صمیمی و مرتبط با همان استوری بده.')
      lines.push('  • نیازی به معرفی دوباره فروشگاه یا پر کردن پاسخ با اطلاعات عمومی نیست؛ مگر اینکه کاربر صریحاً بپرسد.')
      lines.push('  • اگر کاربر فقط ایموجی فرستاده، یک پاسخ کوتاه و طبیعی بده (مثلاً «ممنونم! 🙏» یا «چشم، هر سوالی هست بپرس») به‌جای باز کردن موضوع فروش.')
    } else {
      lines.push('• The customer replied to your Story. This is a short, personal reaction — keep the reply short, warm and tied to that story.')
      lines.push('  • No need to re-introduce the shop or pad the reply with generic info unless the customer explicitly asks.')
      lines.push('  • If the customer sent only emoji, reply briefly and naturally ("Thanks! 🙏" or "Sure, ask anything") instead of opening a sales pitch.')
    }
    return lines.join('\n')
  }

  // ─── Messenger lane (Telegram / WhatsApp / Rubika / Bale / Instagram DM)
  if (isMessenger || isInstagramDM) {
    const channelLabel = isFa ? channelFaName(input.channel) : channelEnName(input.channel)
    if (isFa) {
      lines.push(`• این گفتگو در ${channelLabel} است؛ کاربر پیام‌های کوتاه و سریع می‌فرستد و انتظار پاسخ در همان حالت را دارد.`)
      lines.push('  • پاسخ‌ها کوتاه، محاوره‌ای و طبیعی باشند؛ در اکثر پاسخ‌ها حداکثر ۲ تا ۳ جمله کافی است.')
      lines.push('  • از قالب Markdown سنگین (هدینگ #، بلوک کد ```، جدول، لیست بلند) پرهیز کن؛ ایتالیک و بولد خفیف OK است.')
      lines.push('  • برای اطلاعات چند بخشی، به‌جای یک پیام طولانی، چند پیام کوتاه منطقی فکر کن — ولی فقط یک پیام نهایی بفرست.')
      lines.push('  • لینک پرداخت، شماره کارت، آدرس سایت و QR فقط وقتی نیاز واقعی است بفرست و ترجیحاً در یک خط جدا.')
      lines.push('  • از ایموجی سنگین پرهیز کن؛ یک ایموجی در پایان برای گرمی کافی است و در پیام‌های رسمی اصلاً استفاده نکن.')
    } else {
      lines.push(`• This conversation is on ${channelLabel}; the customer sends short, fast messages and expects replies in the same shape.`)
      lines.push('  • Keep replies short, conversational and natural; at most 2–3 sentences is enough for most replies.')
      lines.push('  • Avoid heavy Markdown (no # headings, no ``` code blocks, no tables, no long lists). Light bold/italic is OK.')
      lines.push('  • For multi-part information, think in short logical messages — but only send one final message.')
      lines.push('  • Send payment links, card numbers, site URLs and QR only when truly needed, and ideally on a separate line.')
      lines.push('  • Avoid heavy emoji; one emoji at the end for warmth is enough — none in formal replies.')
    }
    return lines.join('\n')
  }

  // ─── Web widget / Chat link lane ──────────────────────────────────────
  if (isWebLike) {
    if (isFa) {
      lines.push('• این گفتگو در ویجت وب یا لینک چت سایت شما است؛ این بستر Markdown و کارت محصول را رندر می‌کند و کاربر برای تصمیم خرید آنجاست.')
      lines.push('  • پاسخ می‌تواند ساختاریافته‌تر باشد (بولد، بولت، کارت محصول) ولی همچنان مختصر؛ طولانی‌نویسی برای پرکردن پاسخ مجاز نیست.')
      lines.push('  • وقتی کاربر محصول را پرسید، کارت محصول ارسال کن (قالب `[[product:…]]`) تا دکمه‌های اقدام نمایش داده شود.')
      lines.push('  • در ویجت می‌توانی برای ادامه گفتگو یک سؤال کوتاه بپرسی (مثل رنگ/سایز/کد) چون محیط تعاملی است.')
    } else {
      lines.push('• This conversation is in the web widget or chat link on the site; this surface renders Markdown and product cards and the customer is there to make a purchase decision.')
      lines.push('  • Replies can be more structured (bold, bullets, product cards) but still concise; padding length is not allowed.')
      lines.push('  • When the customer asks about a product, emit a product card (`[[product:…]]` format) so action buttons appear.')
      lines.push('  • In the widget you can ask one short follow-up (color/size/code) to keep the conversation going since the surface is interactive.')
    }
    return lines.join('\n')
  }

  // ─── API lane ─────────────────────────────────────────────────────────
  if (isApi) {
    if (isFa) {
      lines.push('• این پاسخ از طریق API به یک ادغام‌کننده (integrator) ارسال می‌شود، نه به کاربر نهایی. فرمت را تمیز و قابل تجزیه نگه‌دار.')
      lines.push('  • از CTAهای بازاریابی، امضا و جمله‌های پرکننده (مثل «اگر سوالی بود بپرسید») پرهیز کن؛ این‌ها در خروجی API مزاحم هستند.')
      lines.push('  • فقط پاسخ مستقیم به درخواست را بده؛ اگر داده ناقص است صریحاً بگو «اطلاعات دقیق در دسترس نیست».')
    } else {
      lines.push('• This reply goes out via the API to an integrator, not to an end user. Keep the format clean and parseable.')
      lines.push('  • Avoid marketing CTAs, signatures and filler sentences ("feel free to ask"); they are noise in API output.')
      lines.push('  • Just answer the request directly; if data is missing, say "exact information is unavailable".')
    }
    return lines.join('\n')
  }

  // Fallback (should never happen): keep the tag-only line so the agent at
  // least knows the channel it is operating on.
  return lines.join('\n')
}

function channelFaName(channel: ChannelType): string {
  switch (channel) {
    case 'TELEGRAM': return 'تلگرام'
    case 'WHATSAPP': return 'واتساپ'
    case 'INSTAGRAM': return 'دایرکت اینستاگرام'
    case 'RUBIKA': return 'روبیکا'
    case 'BALE': return 'بله'
    case 'WEB_WIDGET': return 'ویجت وب‌سایت'
    case 'CHAT_LINK': return 'لینک چت'
    case 'API': return 'API'
    default: return channel
  }
}

function channelEnName(channel: ChannelType): string {
  switch (channel) {
    case 'TELEGRAM': return 'Telegram'
    case 'WHATSAPP': return 'WhatsApp'
    case 'INSTAGRAM': return 'Instagram DM'
    case 'RUBIKA': return 'Rubika'
    case 'BALE': return 'Bale'
    case 'WEB_WIDGET': return 'Web Widget'
    case 'CHAT_LINK': return 'Chat Link'
    case 'API': return 'API'
    default: return channel
  }
}
