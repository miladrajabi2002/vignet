import { responseEndingInstruction } from '@/lib/ai/response-policy'
import type { AgentSkillManifest, AgentSkillPlan, AgentSkillPlanInput } from '@/lib/agent-kernel/contracts'
import { RESPONSE_STYLE_SKILL_VERSION, responseStyleInstruction } from '@/lib/agent-kernel/skills/response-style'
import { CONVERSATION_FLOW_SKILL_VERSION, conversationFlowInstruction } from '@/lib/agent-kernel/skills/conversation-flow'
import { EVIDENCE_GROUNDING_SKILL_VERSION, evidenceGroundingInstruction } from '@/lib/agent-kernel/skills/evidence-grounding'
import { ACTION_CAPABILITY_SKILL_VERSION, actionCapabilityInstruction } from '@/lib/agent-kernel/skills/action-capabilities'
import { needsVisualReferenceSkill, VISUAL_REFERENCE_SKILL_VERSION, visualReferenceInstruction } from '@/lib/agent-kernel/skills/visual-reference'

export const AGENT_KERNEL_VERSION = '2026.09.11'

const manifests = {
  security: { key: 'security-boundaries', version: '1.0.0', phase: 'policy', priority: 1000, description: 'Immutable safety and instruction hierarchy.' },
  capabilities: { key: 'action-capability-boundaries', version: ACTION_CAPABILITY_SKILL_VERSION, phase: 'policy', priority: 925, description: 'Prevent claims about actions the runtime cannot execute.' },
  evidence: { key: 'evidence-grounding', version: EVIDENCE_GROUNDING_SKILL_VERSION, phase: 'policy', priority: 900, description: 'Ground business claims and action outcomes in trusted evidence.' },
  visualReference: { key: 'visual-reference-grounding', version: VISUAL_REFERENCE_SKILL_VERSION, phase: 'policy', priority: 875, description: 'Distinguish verified inbound media from references to earlier outbound cards.' },
  flow: { key: 'conversation-flow', version: CONVERSATION_FLOW_SKILL_VERSION, phase: 'policy', priority: 800, description: 'Preserve continuity and ask only necessary questions.' },
  style: { key: 'response-style', version: RESPONSE_STYLE_SKILL_VERSION, phase: 'policy', priority: 700, description: 'Apply the configured natural response style.' },
  knowledge: { key: 'knowledge-retrieval', version: '1.0.0', phase: 'context', priority: 600, description: 'Use workspace- and agent-scoped knowledge.' },
  product: { key: 'product-consultation', version: '1.3.0', phase: 'context', priority: 610, description: 'Answer from the assigned product catalog and preserve exact single-product identity.' },
  order: { key: 'order-tracking', version: '1.0.0', phase: 'context', priority: 620, description: 'Read an exact workspace-scoped order without mutation.' },
  identification: { key: 'customer-identification', version: '1.0.0', phase: 'action', priority: 650, description: 'Collect the configured minimum customer identity.' },
  preferences: { key: 'customer-preferences', version: '1.0.0', phase: 'context', priority: 500, description: 'Apply explicit CRM interaction preferences.' },
  handoff: { key: 'operator-handoff', version: '1.0.0', phase: 'action', priority: 950, description: 'Transfer control to a human through a deterministic gate.' },
  booking: { key: 'appointment-booking', version: '1.0.0', phase: 'action', priority: 640, description: 'Run the bounded booking workflow and emit receipts.' },
  sales: { key: 'sales-intelligence', version: '1.0.0', phase: 'context', priority: 400, description: 'Apply grounded sales guidance without overriding safety.' },
  cards: { key: 'product-card-hydration', version: '1.0.0', phase: 'postprocess', priority: 300, description: 'Hydrate product cards from trusted database rows.' },
  persian: { key: 'persian-response-polish', version: '1.0.0', phase: 'postprocess', priority: 200, description: 'Apply conservative Persian chat punctuation.' },
} satisfies Record<string, AgentSkillManifest>

export const AGENT_SKILL_MANIFESTS: readonly AgentSkillManifest[] = Object.freeze(
  Object.values(manifests).sort((a, b) => b.priority - a.priority),
)

export function compileAgentSkillPlan(input: AgentSkillPlanInput): AgentSkillPlan {
  const isFa = input.language !== 'en'
  const selected: Array<AgentSkillManifest | null> = [
    manifests.security,
    manifests.capabilities,
    manifests.evidence,
    needsVisualReferenceSkill(input) ? manifests.visualReference : null,
    manifests.flow,
    manifests.style,
    !input.deterministicClosing && input.hasKnowledgeContext ? manifests.knowledge : null,
    !input.deterministicClosing && input.catalogAccessEnabled && input.productTurn ? manifests.product : null,
    !input.deterministicClosing && input.orderTurn ? manifests.order : null,
    input.identificationPending ? manifests.identification : null,
    input.hasCustomerPreferences ? manifests.preferences : null,
    input.handoffEnabled ? manifests.handoff : null,
    !input.deterministicClosing && input.bookingTurn ? manifests.booking : null,
    !input.deterministicClosing && input.salesIntelligenceEnabled ? manifests.sales : null,
    !input.deterministicClosing && input.richProductCards && input.productTurn ? manifests.cards : null,
    isFa ? manifests.persian : null,
  ]
  const active = selected.filter((skill): skill is AgentSkillManifest => skill !== null)
    .sort((a, b) => b.priority - a.priority)

  return {
    kernelVersion: AGENT_KERNEL_VERSION,
    active,
    instructions: {
      language: isFa ? 'به زبان فارسی پاسخ بده.' : 'Respond in English.',
      responseStyle: responseStyleInstruction(isFa),
      conversationFlow: conversationFlowInstruction({
        isFa,
        history: input.history,
        userMessage: input.userMessage,
      }),
      evidence: evidenceGroundingInstruction(isFa),
      capabilities: actionCapabilityInstruction(isFa),
      visualReference: visualReferenceInstruction({
        isFa,
        userMessage: input.userMessage,
        history: input.history,
        inboundMediaKind: input.inboundMediaKind,
      }),
      ending: responseEndingInstruction(isFa),
    },
  }
}
