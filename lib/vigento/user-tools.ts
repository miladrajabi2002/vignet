import { z } from 'zod'
import type { WorkspaceVigentoRepository } from '@/lib/vigento/workspace-repository'
import type { UserVigentoToolName } from '@/lib/vigento/profiles'

const daysSchema = z.object({ days: z.number().int().min(1).max(90) }).strict()
const bookingSchema = z.object({ daysAhead: z.number().int().min(1).max(90) }).strict()
const emptySchema = z.object({}).strict()
const productSchema = z.object({
  query: z.string().trim().max(120),
  inventory: z.enum(['ANY', 'AVAILABLE', 'OUT_OF_STOCK']),
  limit: z.number().int().min(1).max(20),
}).strict()
const knowledgeSchema = z.object({
  knowledgeBaseId: z.string().trim().min(8).max(80),
}).strict()
const conversationSchema = z.object({
  conversationId: z.string().trim().min(8).max(80),
}).strict()

export function safeVigentoToolError(error: unknown): string {
  if (error instanceof z.ZodError) return 'INVALID_ARGUMENTS'
  if (error instanceof SyntaxError) return 'INVALID_JSON_ARGUMENTS'
  return 'TOOL_FAILED'
}

function parseJson(rawArgs: string): unknown {
  return JSON.parse(rawArgs || '{}') as unknown
}

export async function executeWorkspaceVigentoTool(
  repository: WorkspaceVigentoRepository,
  name: UserVigentoToolName,
  rawArgs: string,
): Promise<unknown> {
  const args = parseJson(rawArgs)
  switch (name) {
    case 'get_workspace_overview':
      return repository.getOverview(daysSchema.parse(args).days)
    case 'get_agent_health':
      return repository.getAgentHealth(daysSchema.parse(args).days)
    case 'analyze_own_conversations':
      return repository.getConversationInsights(daysSchema.parse(args).days)
    case 'get_own_customer_activity':
      return repository.getCustomerActivity(daysSchema.parse(args).days)
    case 'get_own_booking_summary':
      return repository.getBookingSummary(bookingSchema.parse(args).daysAhead)
    case 'get_own_store_health':
      emptySchema.parse(args)
      return repository.getStoreHealth()
    case 'search_own_products': {
      const input = productSchema.parse(args)
      return repository.searchProducts(input.query, input.inventory, input.limit)
    }
    case 'get_own_usage':
      return repository.getUsage(daysSchema.parse(args).days)
    case 'get_knowledge_status':
      emptySchema.parse(args)
      return repository.getKnowledgeStatus()
    case 'inspect_own_knowledge':
      return repository.inspectKnowledge(knowledgeSchema.parse(args).knowledgeBaseId)
    case 'inspect_own_conversation':
      return repository.inspectConversation(conversationSchema.parse(args).conversationId)
  }
}
