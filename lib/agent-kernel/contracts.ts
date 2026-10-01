import type { ChatMessage } from '@/lib/ai/openrouter'

export type AgentSkillPhase = 'policy' | 'context' | 'action' | 'postprocess'

export type AgentSkillKey =
  | 'security-boundaries'
  | 'language-mirroring'
  | 'response-style'
  | 'conversation-flow'
  | 'conversation-state'
  | 'evidence-grounding'
  | 'action-capability-boundaries'
  | 'visual-reference-grounding'
  | 'knowledge-retrieval'
  | 'product-consultation'
  | 'order-tracking'
  | 'appointment-booking'
  | 'course-enrollment'
  | 'customer-identification'
  | 'customer-preferences'
  | 'operator-handoff'
  | 'sales-intelligence'
  | 'product-card-hydration'
  | 'persian-response-polish'
  | 'humanizer-polish'

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
  /** The customer asks for a booking but the business has bookings switched off. */
  bookingUnavailable?: boolean
  /** Course/class enrollment intent while the courses capability is on. */
  courseTurn?: boolean
  identificationPending?: boolean
  hasCustomerPreferences?: boolean
  handoffEnabled?: boolean
  salesIntelligenceEnabled?: boolean
  richProductCards?: boolean
  deterministicClosing?: boolean
  /** A structured active goal/slot state is available for this turn. */
  hasConversationState?: boolean
  /** Verified media on the current inbound event, never inferred from prose. */
  inboundMediaKind?: 'photo' | 'video' | 'voice' | 'sticker' | 'file' | 'audio'
  /** First turns of a new session after an idle gap, with a previous-session digest. */
  returningCustomer?: boolean
  /** The agent can file in-chat pre-orders (changes the capability boundary). */
  orderCaptureEnabled?: boolean
  /** Confirmed carts get a payment link on the store (in-chat checkout). */
  payLinkEnabled?: boolean
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
    /** Anti-AI-tell writing rules (humanizer-polish skill). */
    humanizer: string
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
