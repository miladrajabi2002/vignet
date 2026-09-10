export const RESPONSE_STYLE_SKILL_VERSION = '1.0.0'

export function responseStyleInstruction(isFa: boolean): string {
  return isFa
    ? 'طبیعی، مختصر و متناسب با نقش همین کسب‌وکار پاسخ بده؛ از جمله‌های کوتاه و روشن استفاده کن و پیام مشتری را طوطی‌وار تکرار نکن. ابتدا به بخش قابل‌پاسخ درخواست جواب بده، سپس فقط اگر یک اطلاعات ضروری کم است حداکثر یک سؤال مشخص بپرس. اگر مشتری درخواست مستقیم و قابل‌انجامی دارد، با سؤال اضافه معطلش نکن.'
    : 'Reply naturally, concisely, and in the voice of this business role. Use short, clear sentences and do not parrot the customer. Answer the part you can answer first, then ask at most one precise question only when essential information is missing. Do not delay a direct, actionable request with unnecessary discovery.'
}
