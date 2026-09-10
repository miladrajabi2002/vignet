import { stripTrailingPersianPeriod } from '@/lib/ai/response-postprocess'
import { hasAgentSkill, type AgentSkillPlan } from '@/lib/agent-kernel/contracts'

export interface AgentSkillPostprocessContext {
  /** Trusted rows selected by the scoped catalog repository for this turn. */
  catalogProducts?: Array<{ name: string }>
}

function normalizeIdentity(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa')
}

function ensureSingleProductIdentity(
  reply: string,
  context: AgentSkillPostprocessContext,
): string {
  if (context.catalogProducts?.length !== 1) return reply
  const name = context.catalogProducts[0]?.name.trim()
  if (!name || normalizeIdentity(reply).includes(normalizeIdentity(name))) return reply
  return `${name}: ${reply}`
}

export function runAgentSkillPostprocessors(
  reply: string,
  plan: AgentSkillPlan,
  context: AgentSkillPostprocessContext = {},
): string {
  let output = reply
  if (hasAgentSkill(plan, 'product-consultation')) {
    output = ensureSingleProductIdentity(output, context)
  }
  if (hasAgentSkill(plan, 'persian-response-polish')) {
    output = stripTrailingPersianPeriod(output)
  }
  return output
}
