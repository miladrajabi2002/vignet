import { stripTrailingPersianPeriod } from '@/lib/ai/response-postprocess'
import { hasAgentSkill, type AgentSkillPlan } from '@/lib/agent-kernel/contracts'
import { enforceActionCapabilities } from '@/lib/agent-kernel/skills/action-capabilities'
import { enforceVisualReferenceGrounding } from '@/lib/agent-kernel/skills/visual-reference'

export interface AgentSkillPostprocessContext {
  /** Trusted rows selected by the scoped catalog repository for this turn. */
  catalogProducts?: Array<{ name: string }>
  /** Current customer text is required for deterministic capability guards. */
  userMessage?: string
  isFa?: boolean
  /** Verified channel media on this turn, when the platform payload proves one. */
  inboundMediaKind?: string
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
  if (hasAgentSkill(plan, 'action-capability-boundaries') && context.userMessage) {
    output = enforceActionCapabilities({
      reply: output,
      userMessage: context.userMessage,
      isFa: context.isFa ?? true,
    })
  }
  if (hasAgentSkill(plan, 'visual-reference-grounding') && context.userMessage) {
    output = enforceVisualReferenceGrounding({
      reply: output,
      userMessage: context.userMessage,
      inboundMediaKind: context.inboundMediaKind,
      isFa: context.isFa ?? true,
    })
  }
  if (hasAgentSkill(plan, 'product-consultation')) {
    output = ensureSingleProductIdentity(output, context)
  }
  if (hasAgentSkill(plan, 'persian-response-polish')) {
    output = stripTrailingPersianPeriod(output)
  }
  return output
}
