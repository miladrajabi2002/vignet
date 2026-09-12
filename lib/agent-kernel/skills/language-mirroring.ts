export const LANGUAGE_MIRRORING_SKILL_VERSION = '1.0.0'

/**
 * Universal reply-language policy for EVERY agent and EVERY turn.
 *
 * Before this skill the kernel pinned the reply language to the agent's
 * configured locale («به زبان فارسی پاسخ بده» / «Respond in English»), so a
 * customer writing Arabic or English to a Persian shop still received
 * Persian answers. The mirroring rule below replaces that pin: the reply
 * always follows the language of the customer's LATEST message, whatever
 * that language is — Persian, Arabic, English or any other. It is injected
 * into the system message at the highest policy priority (just under
 * security) and costs nothing extra: no extra model call, no extra latency.
 */
export function languageMirroringInstruction(isFa: boolean): string {
  // The instruction is authored in Persian or English to match the rest of
  // the kernel instruction set, but it explicitly governs ALL languages.
  return isFa
    ? 'زبان پاسخ (قانون سراسری، مقدم بر هر قالب و نقشی): همیشه دقیقاً به همان زبان و خطّی پاسخ بده که مشتری در آخرین پیامش نوشته است — فارسی به فارسی، عربی به عربی، انگلیسی به انگلیسی، و هر زبان دیگری به همان زبان. اگر پیام مشتری آمیخته از چند زبان است، به زبانِ غالبِ همان پیام جواب بده. کد محصول، اعداد، نام برند و اصطلاحات فنی را به شکل اصلی خودشان نگه دار و آن‌ها را ترجمه نکن. هیچ‌وقت زبان پاسخ را خودت یک‌طرفه عوض نکن؛ فقط زمانی که مشتری خودش زبانش را عوض کرد تو هم همراهش عوض کن. اگر پیام مشتری هیچ زبان قابل‌تشخیصی ندارد (فقط عدد یا ایموجی)، به زبان پیام‌های قبلی خودش جواب بده و اگر نبود، فارسی.'
    : 'Reply language (universal rule, takes precedence over any role or template): always answer in exactly the same language and script the customer used in their LATEST message — Persian in Persian, Arabic in Arabic, English in English, and every other language in that language. When the customer mixes languages, reply in the dominant language of that message. Keep product codes, numbers, brand names and technical terms in their original form without translating. Never switch the reply language on your own; follow only when the customer switches. If the customer message has no recognizable language (digits or emoji only), use the language of their earlier messages, else Persian.'
}
