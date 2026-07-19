import { z } from 'zod'
import { getRoleTemplate } from '@/lib/ai/prompt-builder'
import { promptConfigSchema } from '@/lib/validations/agent'

const roleKeys = [
  'full_service',
  'sales_consultant',
  'support_specialist',
  'after_sales',
  'lead_capture',
  'custom',
] as const

const recommendedChannels = [
  'INSTAGRAM',
  'WHATSAPP',
  'TELEGRAM',
  'BALE',
  'RUBIKA',
  'WEB_WIDGET',
  'CHAT_LINK',
] as const

export const vigentoDraftSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
  roleTemplate: z.enum(roleKeys),
  welcomeMessage: z.string().min(1).max(500),
  fallbackMessage: z.string().min(1).max(500),
  handoffEnabled: z.boolean(),
  handoffMessage: z.string().max(500),
  handoffKeywords: z.array(z.string().min(1).max(50)).max(12),
  requireCustomerInfo: z.boolean(),
  customerInfoPrompt: z.string().max(1000),
  promptConfig: promptConfigSchema,
  knowledgePlan: z.array(
    z.object({
      type: z.enum(['faq', 'catalog', 'document', 'url', 'policy']),
      label: z.string().min(1).max(100),
      required: z.boolean(),
      reason: z.string().min(1).max(220),
    }),
  ).min(2).max(6),
  channelPolicy: z.object({
    recommended: z.array(z.enum(recommendedChannels)).min(1).max(5),
    guidance: z.array(z.string().min(1).max(220)).min(1).max(6),
  }),
  evalCases: z.array(
    z.object({
      input: z.string().min(1).max(300),
      expectedBehavior: z.string().min(1).max(500),
      risk: z.enum(['normal', 'boundary', 'handoff']),
    }),
  ).min(3).max(6),
})

export type VigentoDraft = z.infer<typeof vigentoDraftSchema>

export function extractVigentoDraft(content: string): VigentoDraft {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const first = unfenced.indexOf('{')
  const last = unfenced.lastIndexOf('}')
  if (first < 0 || last <= first) throw new Error('VIGENTO_JSON_MISSING')
  const parsed: unknown = JSON.parse(unfenced.slice(first, last + 1))
  return vigentoDraftSchema.parse(parsed)
}

function detectRole(description: string): typeof roleKeys[number] {
  const value = description.toLocaleLowerCase('fa')
  if (/(رزرو|نوبت|مشاوره|فرم|لید|lead|booking|appointment)/i.test(value)) return 'lead_capture'
  if (/(پشتیبانی|سوال|راهنما|faq|support|help desk)/i.test(value)) return 'support_specialist'
  if (/(مرجوع|گارانتی|پیگیری سفارش|after.?sales|warranty|return)/i.test(value)) return 'after_sales'
  if (/(فروش|محصول|قیمت|کاتالوگ|sales|product|catalog)/i.test(value)) return 'sales_consultant'
  return 'full_service'
}

/** Useful and schema-valid degradation when the model/provider is unavailable. */
export function fallbackVigentoDraft(description: string, language: 'fa' | 'en'): VigentoDraft {
  const roleTemplate = detectRole(description)
  const template = getRoleTemplate(roleTemplate) ?? getRoleTemplate('full_service')!
  const isFa = language === 'fa'
  const short = description.replace(/\s+/g, ' ').trim().slice(0, 240)

  return vigentoDraftSchema.parse({
    name: isFa ? 'دستیار هوشمند کسب‌وکار' : 'Business assistant',
    description: short || (isFa ? 'پاسخ‌گویی دقیق و امن به مشتریان' : 'Accurate, safe customer assistance'),
    roleTemplate,
    welcomeMessage: isFa
      ? 'سلام! برای راهنمایی دقیق‌تر بفرمایید چه کمکی از من می‌خواهید؟'
      : 'Hi! Tell me what you need and I will guide you.',
    fallbackMessage: isFa
      ? 'اطلاعات کافی برای پاسخ قطعی ندارم؛ گفتگو را همراه با خلاصه به اپراتور منتقل می‌کنم.'
      : 'I do not have enough verified information, so I will hand this over with context.',
    handoffEnabled: true,
    handoffMessage: isFa
      ? 'برای بررسی دقیق‌تر، گفتگو را همراه با خلاصه به اپراتور منتقل می‌کنم.'
      : 'I am handing this conversation to an operator with a context summary.',
    handoffKeywords: isFa
      ? ['اپراتور', 'انسان', 'شکایت', 'پرداخت ناموفق']
      : ['operator', 'human', 'complaint', 'payment failed'],
    requireCustomerInfo: roleTemplate === 'lead_capture',
    customerInfoPrompt: isFa
      ? 'نام و یک راه ارتباطی را شفاف و فقط در صورت نیاز به پیگیری دریافت کن.'
      : 'Ask for a name and one contact method only when follow-up is needed.',
    promptConfig: template.config,
    knowledgePlan: [
      {
        type: 'faq',
        label: isFa ? 'پرسش‌های پرتکرار واقعی' : 'Verified FAQs',
        required: true,
        reason: isFa ? 'پاسخ‌های پرتکرار باید قابل استناد و کم‌هزینه باشند.' : 'Common answers should be grounded and inexpensive.',
      },
      {
        type: roleTemplate === 'sales_consultant' ? 'catalog' : 'policy',
        label: isFa ? 'اطلاعات مرجع کسب‌وکار' : 'Business source of truth',
        required: true,
        reason: isFa ? 'قیمت، شرایط و مرز پاسخ از منبع معتبر خوانده شود.' : 'Prices, policies, and boundaries need a trusted source.',
      },
      {
        type: 'document',
        label: isFa ? 'سناریوهای استثنا و تحویل' : 'Exceptions and handoff scenarios',
        required: false,
        reason: isFa ? 'موارد حساس سریع و با زمینه کامل تحویل شوند.' : 'Sensitive cases should escalate with full context.',
      },
    ],
    channelPolicy: {
      recommended: roleTemplate === 'sales_consultant'
        ? ['INSTAGRAM', 'WHATSAPP', 'WEB_WIDGET']
        : ['TELEGRAM', 'WHATSAPP', 'WEB_WIDGET'],
      guidance: isFa
        ? ['پاسخ هر کانال کوتاه و متناسب با همان کانال باشد.', 'در نبود فکت معتبر، پاسخ قطعی ساخته نشود.']
        : ['Keep replies concise for each channel.', 'Never invent an answer when verified context is missing.'],
    },
    evalCases: [
      {
        input: isFa ? 'سلام، چه کمکی می‌توانی بکنی؟' : 'Hi, what can you help with?',
        expectedBehavior: isFa ? 'معرفی کوتاه و یک سؤال برای کشف نیاز' : 'Brief introduction and one discovery question',
        risk: 'normal',
      },
      {
        input: isFa ? 'قیمت یا شرایطی که در اطلاعاتت نیست را بگو' : 'Tell me a price or policy that is not in your data',
        expectedBehavior: isFa ? 'عدم حدس‌زدن و درخواست منبع یا تحویل' : 'Refuse to guess and request a source or hand off',
        risk: 'boundary',
      },
      {
        input: isFa ? 'می‌خواهم با اپراتور صحبت کنم' : 'I want to speak to an operator',
        expectedBehavior: isFa ? 'تحویل فوری با خلاصه گفتگو' : 'Immediate handoff with a conversation summary',
        risk: 'handoff',
      },
    ],
  })
}

export function vigentoSystemPrompt(language: 'fa' | 'en'): string {
  const responseLanguage = language === 'fa' ? 'Persian' : 'English'
  return `You are Vigento, a senior conversational-AI architect. Convert the user's business description into one safe, cost-aware agent draft. Return JSON only, in ${responseLanguage}. Use the exact keys and types from this schema: ${JSON.stringify({
    name: 'string <=80',
    description: 'string <=280',
    roleTemplate: roleKeys,
    welcomeMessage: 'string <=500',
    fallbackMessage: 'string <=500',
    handoffEnabled: true,
    handoffMessage: 'string <=500',
    handoffKeywords: ['string'],
    requireCustomerInfo: false,
    customerInfoPrompt: 'string',
    promptConfig: {
      personality: 'string', tone: 'string', doSay: ['string'], dontSay: ['string'],
      fallbackBehavior: 'string', format: { bold: true, emoji: false, links: true, bullets: true, length: 'medium' },
      qaPairs: [{ question: 'string', answer: 'string' }],
      conversation: {
        formality: 'formal|balanced|casual',
        initiative: 'answer_only|guided|proactive',
        empathy: 'neutral|balanced|warm',
        followUp: 'rare|when_needed|often',
        mirrorCustomerTone: true,
        useCustomerName: true,
        avoidRepeatedGreetings: true,
      },
    },
    knowledgePlan: [{ type: 'faq|catalog|document|url|policy', label: 'string', required: true, reason: 'string' }],
    channelPolicy: { recommended: recommendedChannels, guidance: ['string'] },
    evalCases: [{ input: 'string', expectedBehavior: 'string', risk: 'normal|boundary|handoff' }],
  })}. Choose conversation values that fit the described audience and brand instead of always using the same defaults. Make the agent sound natural while keeping follow-up questions purposeful and never pretending to be human. Keep the simplest sufficient workflow. Guardrails must forbid invented prices/policies and unsafe irreversible actions. Recommend vector/context retrieval and evaluation using only capabilities described by the draft; do not claim that sources are already connected. Include 3-6 practical eval cases. Never include secrets or copy sensitive personal data from the description.`
}
