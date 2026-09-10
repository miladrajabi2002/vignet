import type { ChatTool } from '@/lib/ai/openrouter'

export const VIGENTO_USER_SKILL_VERSION = 'workspace-1.0.0'
export const VIGENTO_ADMIN_SKILL_VERSION = 'admin-1.0.0'

export const USER_VIGENTO_TOOL_NAMES = [
  'get_workspace_overview',
  'get_agent_health',
  'analyze_own_conversations',
  'get_own_customer_activity',
  'get_own_booking_summary',
  'get_own_store_health',
  'search_own_products',
  'get_own_usage',
  'get_knowledge_status',
  'inspect_own_knowledge',
  'inspect_own_conversation',
] as const

export type UserVigentoToolName = typeof USER_VIGENTO_TOOL_NAMES[number]

export const ADMIN_VIGENTO_TOOL_NAMES = [
  'get_platform_summary',
  'find_workspace',
  'inspect_conversation',
  'find_user',
  'find_agent',
  'read_project_file',
  'propose_credit_adjustment',
  'propose_resolve_conversation',
  'propose_update_workspace',
  'propose_set_agent_active',
  'propose_delete_user_account',
] as const

export const USER_VIGENTO_TOOLS: readonly ChatTool[] = Object.freeze([
  { type: 'function', function: { name: 'get_workspace_overview', description: 'Read an overview of this authenticated workspace only, including conversations, messages, contacts, appointments and AI cost.', parameters: { type: 'object', additionalProperties: false, properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['days'] } } },
  { type: 'function', function: { name: 'get_agent_health', description: 'Inspect agents belonging to this authenticated workspace only, including activity and assigned knowledge/catalog counts.', parameters: { type: 'object', additionalProperties: false, properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['days'] } } },
  { type: 'function', function: { name: 'analyze_own_conversations', description: 'Analyze recent conversation status, handoffs and bounded summaries in this authenticated workspace only.', parameters: { type: 'object', additionalProperties: false, properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['days'] } } },
  { type: 'function', function: { name: 'get_own_customer_activity', description: 'Read the most recently active customers in this authenticated workspace only.', parameters: { type: 'object', additionalProperties: false, properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['days'] } } },
  { type: 'function', function: { name: 'get_own_booking_summary', description: 'Read upcoming appointments and service counts in this authenticated workspace only.', parameters: { type: 'object', additionalProperties: false, properties: { daysAhead: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['daysAhead'] } } },
  { type: 'function', function: { name: 'get_own_store_health', description: 'Read catalog, order and store integration health for this authenticated workspace only. Credentials are never returned.', parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] } } },
  { type: 'function', function: { name: 'search_own_products', description: 'Search bounded product details in this authenticated workspace only by name, SKU or text, with an optional stock filter.', parameters: { type: 'object', additionalProperties: false, properties: { query: { type: 'string', maxLength: 120 }, inventory: { type: 'string', enum: ['ANY', 'AVAILABLE', 'OUT_OF_STOCK'] }, limit: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['query', 'inventory', 'limit'] } } },
  { type: 'function', function: { name: 'get_own_usage', description: 'Read AI usage and charged amount for this authenticated workspace only.', parameters: { type: 'object', additionalProperties: false, properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['days'] } } },
  { type: 'function', function: { name: 'get_knowledge_status', description: 'Read knowledge-base ingestion status for agents in this authenticated workspace only.', parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] } } },
  { type: 'function', function: { name: 'inspect_own_knowledge', description: 'Inspect a bounded excerpt of one exact knowledge-base id only if it belongs to this authenticated workspace.', parameters: { type: 'object', additionalProperties: false, properties: { knowledgeBaseId: { type: 'string', minLength: 8, maxLength: 80 } }, required: ['knowledgeBaseId'] } } },
  { type: 'function', function: { name: 'inspect_own_conversation', description: 'Inspect one exact conversation id only if it belongs to this authenticated workspace. A foreign or missing id returns the same NOT_FOUND result.', parameters: { type: 'object', additionalProperties: false, properties: { conversationId: { type: 'string', minLength: 8, maxLength: 80 } }, required: ['conversationId'] } } },
])

const userNames = new Set<string>(USER_VIGENTO_TOOL_NAMES)
for (const adminName of ADMIN_VIGENTO_TOOL_NAMES) {
  if (userNames.has(adminName)) throw new Error(`VIGENTO_CAPABILITY_COLLISION:${adminName}`)
}
