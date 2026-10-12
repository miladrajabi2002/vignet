/**
 * The two platform-managed AI modes exposed to customers.
 *
 * Users store an alias (fast / smart), never a raw provider slug. The actual
 * OpenRouter model is resolved server-side and can be rotated from the owner
 * panel without migrating every Agent row.
 *
 * Both modes run the same model. They differ in how the customer's message is
 * read: fast reads it directly, smart lets the model think first
 * (`reasoningEffort`), which reads more turns right and takes about half a
 * second longer (scripts/eval-understanding.ts --reasoning low).
 */

export const MODEL_ALIASES = ['fast', 'smart'] as const
export type ModelAlias = (typeof MODEL_ALIASES)[number]

export const DEFAULT_MODEL: ModelAlias = 'fast'

export type ModelTier = 'economy' | 'smart'

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high'

export interface AgentModel {
  /** Stable alias persisted on Agent.model. */
  id: ModelAlias
  name: string
  nameEn: string
  provider: string
  /** Default provider slug. The admin policy may override this at runtime. */
  providerId: string
  tier: ModelTier
  quality: number
  cost: number
  goodForPersian: boolean
  /** How hard the model thinks while reading the customer's message. Unset: no thinking. */
  reasoningEffort?: ReasoningEffort
  /** Fixed customer charge for one successful text reply, in Iranian rials. */
  replyPriceIRR: number
  /** Public reference rates used by the pricing guide (USD / 1M tokens). */
  inputUsdPerMillion: number
  outputUsdPerMillion: number
  descFa: string
  descEn: string
  /** Short "best for" tags shown on the picker card. */
  bestForFa: string[]
  bestForEn: string[]
}

export const AGENT_MODELS: AgentModel[] = [
  {
    id: 'fast',
    name: 'سریع و اقتصادی',
    nameEn: 'Fast & economical',
    provider: 'DeepSeek V4.1 Flash',
    providerId: 'deepseek/deepseek-v4.1-flash',
    tier: 'economy',
    quality: 4,
    cost: 1,
    goodForPersian: true,
    replyPriceIRR: 4_000,
    inputUsdPerMillion: 0.02,
    outputUsdPerMillion: 0.4,
    descFa: 'پیش‌فرض ویجنت؛ پاسخ فوری با کمترین هزینه. برای بیشتر سؤال‌های روزمرهٔ مشتری کافی است.',
    descEn: 'Vigent’s default: instant replies at the lowest cost. Enough for most everyday customer questions.',
    bestForFa: ['قیمت و موجودی', 'سؤال‌های متداول', 'پیگیری سفارش'],
    bestForEn: ['Price & stock', 'FAQs', 'Order tracking'],
  },
  {
    id: 'smart',
    name: 'هوشمند و دقیق',
    nameEn: 'Smart & precise',
    provider: 'DeepSeek V4.1 Flash',
    providerId: 'deepseek/deepseek-v4.1-flash',
    tier: 'smart',
    quality: 5,
    cost: 2,
    goodForPersian: true,
    reasoningEffort: 'low',
    replyPriceIRR: 6_500,
    inputUsdPerMillion: 0.02,
    outputUsdPerMillion: 0.4,
    descFa: 'پیش از پاسخ، روی پیام مشتری بیشتر فکر می‌کند؛ پیام‌های طولانی و چندمرحله‌ای را دقیق‌تر می‌فهمد و پاسخ کمی دیرتر می‌رسد.',
    descEn: 'Thinks the customer’s message through before answering: reads long, multi-step messages more accurately, and the reply takes a moment longer.',
    bestForFa: ['مشاوره فروش', 'گفتگوی چندمرحله‌ای', 'سؤال‌های پیچیده'],
    bestForEn: ['Sales advice', 'Multi-step chats', 'Complex questions'],
  },
]

const BY_ALIAS = new Map<ModelAlias, AgentModel>(AGENT_MODELS.map((model) => [model.id, model]))

/** Historical values are mapped into a safe managed mode at runtime. */
const LEGACY_ALIAS_MAP: Record<string, ModelAlias> = {
  // Retired managed modes: the economy mode stays fast, every higher mode
  // moves to smart so no agent silently loses quality.
  standard: 'smart',
  balanced: 'smart',
  premium: 'smart',
  'deepseek/deepseek-v4-flash': 'fast',
  'deepseek/deepseek-v4.1-flash': 'smart',
  'deepseek/deepseek-chat': 'fast',
  'deepseek/deepseek-chat-v3-0324:free': 'fast',
  'openai/gpt-oss-120b:free': 'fast',
  'meta-llama/llama-3.3-70b-instruct:free': 'fast',
  'google/gemini-2.5-flash-lite': 'fast',
  'google/gemini-flash-1.5': 'fast',
  'qwen/qwen3.5-35b-a3b': 'smart',
  'qwen/qwen3.6-35b-a3b': 'smart',
  'qwen/qwen-2.5-72b-instruct': 'smart',
  'openai/gpt-5.4-nano': 'smart',
  'openai/gpt-4o-mini': 'smart',
  'qwen/qwen3.7-plus': 'smart',
  'google/gemini-3.1-flash-lite': 'smart',
  'anthropic/claude-haiku-4.5': 'smart',
  'deepseek/deepseek-v4-pro': 'smart',
  'anthropic/claude-sonnet-5': 'smart',
  'anthropic/claude-3.5-sonnet': 'smart',
  'openai/gpt-4o': 'smart',
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
 * Resolve a provider slug: the owner panel's choice for the alias, else the
 * catalog default. Call this only on the server.
 */
export function resolveModelId(
  value: string | null | undefined,
  providerModels?: Partial<Record<ModelAlias, string>>,
): string {
  const alias = resolveModelAlias(value)
  return providerModels?.[alias]?.trim() || findModel(alias).providerId
}

/** Catalog reply price; the owner panel's price (getEffectiveReplyPriceIRR) wins at runtime. */
export function getReplyPriceIRR(value: string | null | undefined): number {
  return findModel(value).replyPriceIRR
}

/** Runtime price selected in the owner panel, with the built-in catalog as fallback. */
export async function getEffectiveReplyPriceIRR(value: string | null | undefined): Promise<number> {
  const { getPlatformCommercialConfig } = await import('@/lib/platform/commercial-config')
  const alias = resolveModelAlias(value)
  return (await getPlatformCommercialConfig()).replyPricesIRR[alias]
}
