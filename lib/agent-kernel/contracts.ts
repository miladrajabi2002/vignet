import type { ChatMessage } from '@/lib/ai/openrouter'

export type AgentSkillPhase = 'policy' | 'context' | 'action' | 'postprocess'

export type AgentSkillKey =
  | 'security-boundaries'
  | 'language-mirroring'
  | 'response-style'
  | 'conversation-flow'
  | 'evidence-grounding'
  | 'action-capability-boundaries'
  | 'visual-reference-grounding'
  | 'knowledge-retrieval'
  | 'product-consultation'
  | 'order-tracking'
  | 'appointment-booking'
  | 'customer-identification'
  | 'customer-preferences'
  | 'operator-handoff'
  | 'sales-intelligence'
  | 'product-card-hydration'
  | 'persian-response-polish'

export interface AgentSkillManifest {
  key: AgentSkillKey
  version: string
  phase: AgentSkillPhase
  priority: number
  description: string
}

export interface AgentSkillPlanInput {
  language: string
  userMessage: string
  history: ChatMessage[]
  hasKnowledgeContext?: boolean
  productTurn?: boolean
  catalogAccessEnabled?: boolean
  orderTurn?: boolean
  bookingTurn?: boolean
  identificationPending?: boolean
  hasCustomerPreferences?: boolean
  handoffEnabled?: boolean
  salesIntelligenceEnabled?: boolean
  richProductCards?: boolean
  deterministicClosing?: boolean
  /** Verified media on the current inbound event, never inferred from prose. */
  inboundMediaKind?: 'photo' | 'video' | 'voice' | 'sticker' | 'file' | 'audio'
}

export interface AgentSkillPlan {
  kernelVersion: string
  active: AgentSkillManifest[]
  instructions: {
    language: string
    responseStyle: string
    conversationFlow: string
    evidence: string
    capabilities: string
    visualReference: string
    ending: string
  }
}

export interface AgentSkillTrace {
  kernelVersion: string
  active: Array<Pick<AgentSkillManifest, 'key' | 'version' | 'phase'>>
}

export function hasAgentSkill(plan: AgentSkillPlan, key: AgentSkillKey): boolean {
  return plan.active.some((skill) => skill.key === key)
}

export function agentSkillTrace(plan: AgentSkillPlan): AgentSkillTrace {
  return {
    kernelVersion: plan.kernelVersion,
    active: plan.active.map(({ key, version, phase }) => ({ key, version, phase })),
  }
}
