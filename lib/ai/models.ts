/**
 * The four platform-managed AI modes exposed to customers.
 *
 * Users store an alias (fast / balanced / premium), never a raw provider slug.
 * The actual OpenRouter model is resolved server-side and can be rotated with
 * env variables without migrating every Agent row.
 */

export const MODEL_ALIASES = ['fast', 'standard', 'balanced', 'premium'] as const
export type ModelAlias = (typeof MODEL_ALIASES)[number]

export const DEFAULT_MODEL: ModelAlias = 'fast'

export type ModelTier = 'free' | 'economy' | 'balanced' | 'premium'

export interface AgentModel {
  /** Stable alias persisted on Agent.model. */
  id: ModelAlias
  name: string
  provider: string
  /** Default provider slug. The admin policy may override this at runtime. */
  providerId: string
  tier: ModelTier
  quality: number
  cost: number
  goodForPersian: boolean
  /** Fixed customer charge for one successful text reply, in Iranian rials. */
  replyPriceIRR: number
  /** Public reference rates used by the pricing guide (USD / 1M tokens). */
  inputUsdPerMillion: number
  outputUsdPerMillion: number
  descFa: string
  descEn: string
}

export const AGENT_MODELS: AgentModel[] = [
  {
    id: 'fast',
    name: 'سریع و اقتصادی',
    provider: 'DeepSeek V4 Flash',
    providerId: 'deepseek/deepseek-v4-flash',
    tier: 'economy',
    quality: 4,
    cost: 1,
    goodForPersian: true,
    replyPriceIRR: 3_000,
    inputUsdPerMillion: 0.09,
    outputUsdPerMillion: 0.18,
    descFa: 'پیشنهاد پیش‌فرض ویجنت؛ سریع، کم‌هزینه و مناسب بیشتر گفتگوهای فروش و پشتیبانی.',
    descEn: 'Vigent’s default: fast, low-cost and suited to most support and sales conversations.',
  },
  {
    id: 'standard',
    name: 'استاندارد و متعادل',
    provider: 'OpenAI GPT-4o Mini',
    providerId: 'openai/gpt-4o-mini',
    tier: 'balanced',
    quality: 4,
    cost: 2,
    goodForPersian: true,
    replyPriceIRR: 4_500,
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.60,
    descFa: 'انتخاب متعادل برای پاسخ‌های دقیق، سریع و چندمنظوره.',
    descEn: 'A balanced choice for accurate, fast and general-purpose replies.',
  },
  {
    id: 'balanced',
    name: 'چندزبانه و تصویری',
    provider: 'Qwen3.5 35B',
    providerId: 'qwen/qwen3.5-35b-a3b',
    tier: 'balanced',
    quality: 4,
    cost: 2,
    goodForPersian: true,
    replyPriceIRR: 6_500,
    inputUsdPerMillion: 0.14,
    outputUsdPerMillion: 1,
    descFa: 'بسیار سریع و مناسب گفتگوهای چندزبانه و پیام‌هایی که تصویر یا ساختار دقیق دارند.',
    descEn: 'Very fast and well suited to multilingual, image-aware and structured conversations.',
  },
  {
    id: 'premium',
    name: 'دقیق و حرفه‌ای',
    provider: 'DeepSeek V4 Pro',
    providerId: 'deepseek/deepseek-v4-pro',
    tier: 'premium',
    quality: 5,
    cost: 4,
    goodForPersian: true,
    replyPriceIRR: 30_000,
    inputUsdPerMillion: 0.435,
    outputUsdPerMillion: 0.87,
    descFa: 'برای گفتگوهای حساس، مبهم و چندمرحله‌ای؛ دقیق‌تر است و فقط برای موارد مهم پیشنهاد می‌شود.',
    descEn: 'For sensitive, ambiguous and multi-step conversations; best reserved for high-value cases.',
  },
]

const BY_ALIAS = new Map<ModelAlias, AgentModel>(AGENT_MODELS.map((model) => [model.id, model]))

/** Historical values are mapped into a safe managed mode at runtime. */
const LEGACY_ALIAS_MAP: Record<string, ModelAlias> = {
  'deepseek/deepseek-v4-flash': 'fast',
  'deepseek/deepseek-chat': 'fast',
  'deepseek/deepseek-chat-v3-0324:free': 'fast',
  'openai/gpt-oss-120b:free': 'fast',
  'meta-llama/llama-3.3-70b-instruct:free': 'fast',
  'google/gemini-2.5-flash-lite': 'fast',
  'google/gemini-flash-1.5': 'fast',
  'qwen/qwen3.5-35b-a3b': 'balanced',
  'qwen/qwen-2.5-72b-instruct': 'balanced',
  'openai/gpt-4o-mini': 'standard',
  'anthropic/claude-haiku-4.5': 'balanced',
  'deepseek/deepseek-v4-pro': 'premium',
  'anthropic/claude-sonnet-5': 'premium',
  'anthropic/claude-3.5-sonnet': 'premium',
  'openai/gpt-4o': 'premium',
}

export function isModelAlias(value: string | null | undefined): value is ModelAlias {
  return MODEL_ALIASES.includes(value as ModelAlias)
}

export function resolveModelAlias(value: string | null | undefined): ModelAlias {
  if (isModelAlias(value)) return value
  if (value && LEGACY_ALIAS_MAP[value]) return LEGACY_ALIAS_MAP[value]
  return DEFAULT_MODEL
}

/** Public display metadata for an alias or a legacy stored value. */
export function findModel(value: string | null | undefined): AgentModel {
  return BY_ALIAS.get(resolveModelAlias(value)) ?? BY_ALIAS.get(DEFAULT_MODEL)!
}

/**
 * Resolve a provider slug. Call this only on the server: env overrides let the
 * operator rotate a model while the customer-facing alias stays stable.
 */
export function resolveModelId(
  value: string | null | undefined,
  providerModels?: Partial<Record<ModelAlias, string>>,
): string {
  const alias = resolveModelAlias(value)
  const configured = providerModels?.[alias]?.trim()
  if (configured) return configured
  if (alias === 'balanced') {
    return process.env.OPENROUTER_MODEL_BALANCED || 'qwen/qwen3.5-35b-a3b'
  }
  if (alias === 'standard') {
    return process.env.OPENROUTER_MODEL_STANDARD || 'openai/gpt-4o-mini'
  }
  if (alias === 'premium') {
    return process.env.OPENROUTER_MODEL_PREMIUM || 'deepseek/deepseek-v4-pro'
  }
  return process.env.OPENROUTER_MODEL_FAST || 'deepseek/deepseek-v4-flash'
}

/** Fixed customer price, optionally overridable server-side. */
export function getReplyPriceIRR(value: string | null | undefined): number {
  const model = findModel(value)
  const envName = `AI_REPLY_PRICE_${model.id.toUpperCase()}_IRR`
  const override = Number(process.env[envName])
  return Number.isFinite(override) && override > 0 ? Math.round(override) : model.replyPriceIRR
}
