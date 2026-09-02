import {
  getSuggestedRoleTemplate,
  normalizePromptConfig,
} from '@/lib/ai/prompt-builder'
import { getVerticalPack } from '@/lib/verticals/registry'

const AGENT_NAME_BY_BUSINESS = {
  COMMERCE: 'مشاور هوشمند فروش',
  FOOD: 'دستیار سفارش و رزرو',
  APPOINTMENTS: 'دستیار نوبت‌دهی',
  SERVICES: 'دستیار خدمات',
  EDUCATION: 'راهنمای دوره‌ها',
  SUPPORT: 'همکار پشتیبانی',
  SOCIAL: 'دستیار فروش اینستاگرام',
  CUSTOM: 'دستیار هوشمند کسب‌وکار',
} as const

const WELCOME_BY_BUSINESS = {
  COMMERCE: 'سلام! برای انتخاب محصول، بررسی موجودی یا پیگیری سفارش در کنارتان هستم.',
  FOOD: 'سلام! برای دیدن منو، انتخاب غذا، ثبت سفارش یا رزرو میز بفرمایید.',
  APPOINTMENTS: 'سلام! نوع خدمت و زمان مدنظرتان را بفرمایید تا نزدیک‌ترین وقت آزاد را پیدا کنم.',
  SERVICES: 'سلام! برای دریافت راهنمایی یا ثبت درخواست بفرمایید چه کمکی می‌توانم بکنم؟',
  EDUCATION: 'سلام! برای انتخاب دوره و پاسخ به سؤال‌های ثبت‌نام در کنارتان هستم.',
  SUPPORT: 'سلام! موضوع یا مشکل را بفرستید؛ پاسخ می‌دهم یا آن را برای پیگیری به همکار مربوط تحویل می‌دهم.',
  SOCIAL: 'سلام! برای قیمت، موجودی یا انتخاب محصول پیام بدهید؛ همین‌جا راهنمایی‌تان می‌کنم.',
  CUSTOM: 'سلام! بفرمایید چه کمکی از دستم برمی‌آید؟',
} as const

export function getRecommendedAgentPreset(
  businessType: unknown,
  businessName?: string | null,
) {
  const pack = getVerticalPack(businessType)
  const role = getSuggestedRoleTemplate(pack.key)
  const cleanBusinessName = businessName?.trim()
  const baseName = AGENT_NAME_BY_BUSINESS[pack.key]
  const name = (cleanBusinessName ? `${baseName} ${cleanBusinessName}` : baseName)
    .slice(0, 80)
    .trim()

  return {
    name,
    roleTemplate: role.key,
    promptConfig: normalizePromptConfig(role.config),
    welcomeMessage: WELCOME_BY_BUSINESS[pack.key],
    language: 'fa' as const,
    handoffEnabled: true,
    handoffKeywords: ['اپراتور', 'انسان', 'شکایت', 'پرداخت ناموفق'],
    requireCustomerInfo: ['APPOINTMENTS', 'SERVICES', 'EDUCATION'].includes(pack.key),
  }
}
