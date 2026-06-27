/**
 * Curated catalog of OpenRouter models recommended for agent use.
 *
 * The list is intentionally short and opinionated: each entry is a model that
 * works well as a customer-support / sales agent on OpenRouter, balancing
 * answer quality against per-token cost. We surface a `tier` (economy /
 * balanced / premium) plus 1–5 quality & cost ratings so the user can choose
 * with confidence instead of typing a raw model slug.
 *
 * `DEFAULT_MODEL` mirrors the Prisma `Workspace.defaultModel` default and is the
 * model used when an agent leaves the field empty.
 */

export const DEFAULT_MODEL = 'deepseek/deepseek-chat'

export type ModelTier = 'economy' | 'balanced' | 'premium'

export interface AgentModel {
  /** OpenRouter model slug, e.g. "deepseek/deepseek-chat". */
  id: string
  /** Short display name. */
  name: string
  /** Provider/family label. */
  provider: string
  tier: ModelTier
  /** 1 (basic) … 5 (best) answer quality. */
  quality: number
  /** 1 (cheapest) … 5 (most expensive). */
  cost: number
  /** Whether the model handles Persian well. */
  goodForPersian: boolean
  descFa: string
  descEn: string
}

export const AGENT_MODELS: AgentModel[] = [
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    tier: 'economy',
    quality: 4,
    cost: 1,
    goodForPersian: true,
    descFa: 'بهترین انتخاب اقتصادی؛ کیفیت بالا با کمترین هزینه. مناسب اغلب کسب‌وکارها.',
    descEn: 'Best value: high quality at the lowest cost. Great default for most businesses.',
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    tier: 'economy',
    quality: 3,
    cost: 1,
    goodForPersian: true,
    descFa: 'بسیار سریع و ارزان؛ مناسب پاسخ‌های کوتاه و حجم بالای پیام.',
    descEn: 'Very fast and cheap; ideal for short replies and high message volume.',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    tier: 'balanced',
    quality: 4,
    cost: 2,
    goodForPersian: true,
    descFa: 'تعادل خوب بین کیفیت و قیمت؛ پایدار و قابل اعتماد.',
    descEn: 'A solid quality/price balance; stable and reliable.',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    tier: 'balanced',
    quality: 4,
    cost: 2,
    goodForPersian: true,
    descFa: 'سریع و دقیق در دنبال‌کردن دستورالعمل‌ها؛ لحن طبیعی.',
    descEn: 'Fast and precise at following instructions; natural tone.',
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B',
    provider: 'Qwen',
    tier: 'balanced',
    quality: 4,
    cost: 2,
    goodForPersian: true,
    descFa: 'چندزبانه و قوی در فارسی؛ گزینهٔ خوب برای محتوای بومی.',
    descEn: 'Strong multilingual model with good Persian; great for local content.',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    tier: 'premium',
    quality: 5,
    cost: 4,
    goodForPersian: true,
    descFa: 'بالاترین کیفیت استدلال و درک؛ برای گفتگوهای پیچیده و حساس.',
    descEn: 'Top-tier reasoning and understanding; for complex, sensitive conversations.',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    tier: 'premium',
    quality: 5,
    cost: 4,
    goodForPersian: true,
    descFa: 'مدل پرچم‌دار OpenAI؛ کیفیت بسیار بالا با هزینهٔ بیشتر.',
    descEn: "OpenAI's flagship; very high quality at a higher cost.",
  },
]

/** Look up a model by id (returns undefined for custom slugs). */
export function findModel(id: string | null | undefined): AgentModel | undefined {
  if (!id) return undefined
  return AGENT_MODELS.find((m) => m.id === id)
}
