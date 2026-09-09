import crypto from 'node:crypto'

export type CustomerAgentPreference = {
  id: string
  text: string
  sourceSuggestionId: string
  sourceConversationId: string
  createdAt: string
}

type MetadataRecord = Record<string, unknown>

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as MetadataRecord) }
    : {}
}

/** Customer preferences stay in CRM metadata, partitioned by agent. They never
 * enter shared knowledge or the agent-wide behavior prompt. */
export function readCustomerAgentPreferences(metadata: unknown, agentId: string): CustomerAgentPreference[] {
  const root = asRecord(metadata)
  const byAgent = asRecord(root.agentInteractionPreferences)
  const raw = byAgent[agentId]
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): CustomerAgentPreference[] => {
    const row = asRecord(item)
    if (typeof row.id !== 'string' || typeof row.text !== 'string' || row.text.trim().length < 3) return []
    return [{
      id: row.id,
      text: row.text.trim().slice(0, 500),
      sourceSuggestionId: typeof row.sourceSuggestionId === 'string' ? row.sourceSuggestionId : '',
      sourceConversationId: typeof row.sourceConversationId === 'string' ? row.sourceConversationId : '',
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    }]
  }).slice(-20)
}

export function addCustomerAgentPreference(params: {
  metadata: unknown
  agentId: string
  text: string
  suggestionId: string
  conversationId: string
  createdAt?: string
}) {
  const root = asRecord(params.metadata)
  const byAgent = asRecord(root.agentInteractionPreferences)
  const current = readCustomerAgentPreferences(root, params.agentId)
  const normalized = params.text.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 500)
  const existing = current.find((item) => item.text.normalize('NFKC').toLowerCase() === normalized.toLowerCase())
  const preference = existing ?? {
    id: crypto.randomUUID(),
    text: normalized,
    sourceSuggestionId: params.suggestionId,
    sourceConversationId: params.conversationId,
    createdAt: params.createdAt ?? new Date().toISOString(),
  }
  byAgent[params.agentId] = existing ? current : [...current, preference].slice(-20)
  return { metadata: { ...root, agentInteractionPreferences: byAgent }, preference, created: !existing }
}

export function removeCustomerAgentPreference(metadata: unknown, agentId: string, preferenceId: string) {
  const root = asRecord(metadata)
  const byAgent = asRecord(root.agentInteractionPreferences)
  const current = readCustomerAgentPreferences(root, agentId)
  if (!current.some((item) => item.id === preferenceId)) throw new Error('BEHAVIOR_CHANGED')
  byAgent[agentId] = current.filter((item) => item.id !== preferenceId)
  return { ...root, agentInteractionPreferences: byAgent }
}

export function customerPreferenceInstruction(language: string, preferences: CustomerAgentPreference[]): string {
  if (!preferences.length) return ''
  const rules = preferences.map((preference) => `- ${preference.text}`).join('\n')
  return language === 'en'
    ? `\n\nCustomer-specific interaction preferences (explicitly confirmed for this customer):\n${rules}\nApply these only to response style and interaction flow. They never override business facts, safety rules, permissions, tool results, or the customer's current request.`
    : `\n\nترجیحات تعامل مخصوص همین مشتری (به‌صورت صریح برای این مشتری ثبت شده):\n${rules}\nاین موارد فقط روی سبک پاسخ و روند تعامل اثر دارند و هرگز اطلاعات کسب‌وکار، قواعد ایمنی، مجوزها، نتیجهٔ ابزارها یا درخواست فعلی مشتری را تغییر نمی‌دهند.`
}
