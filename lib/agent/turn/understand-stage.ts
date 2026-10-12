/**
 * Turn stage «understand»: build the closed candidate list, read the message
 * with the understanding model, verify the reading and turn it into routing.
 *
 * Every turn of every agent is read. When the reading cannot be obtained the
 * stage returns `route: null`, and the engine answers the turn as a plain
 * conversation turn: nothing is read into the message by any other means.
 */
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { ChatAgent } from '@/lib/ai/chat-types'
import type { ConversationWorkingState } from '@/lib/ai/conversation-state'
import type { TurnLedger } from '@/lib/ai/llm/aux'
import type { TurnLanguage } from '@/lib/ai/turn-language'
import { loadCartForUnderstanding } from '@/lib/commerce/order-service'
import { buildTurnCandidates } from '@/lib/agent/understand/candidates'
import { writeUnderstandingLog } from '@/lib/agent/understand/log'
import { understandTurn, type UnderstandOutcome } from '@/lib/agent/understand/understand'
import { routeFromUnderstanding, type UnderstoodRoute } from '@/lib/agent/turn/route'
import type { Capability, TurnCandidates } from '@/lib/agent/understand/types'

export interface UnderstandingStage {
  outcome: UnderstandOutcome | null
  route: UnderstoodRoute | null
  candidates: TurnCandidates | null
  /** Write the per-turn log once the engine knows what it routed. */
  finalize(routedDomains: string[]): void
}

export interface UnderstandingStageInput {
  workspaceId: string
  agent: ChatAgent
  conversationId: string
  inboundMessageId: string | null
  message: string
  /** Model-facing history (current session + cross-channel context). */
  history: ChatMessage[]
  state: ConversationWorkingState
  capabilityGates?: { products?: boolean; bookings?: boolean; courses?: boolean }
  serviceNames: string[]
  corpusTokens?: ReadonlySet<string> | null
  /** Identity plus attribute/variation words: what a verified search term may be. */
  searchVocabulary?: ReadonlySet<string> | null
  ledger?: TurnLedger | null
  turnLang: TurnLanguage
}

export function agentCapabilities(input: Pick<UnderstandingStageInput, 'agent' | 'capabilityGates' | 'serviceNames'>): Capability[] {
  const { agent } = input
  const products = agent.productAccessEnabled
  const capabilities: Capability[] = []
  if (products) capabilities.push('products')
  if (products && agent.orderCaptureEnabled) capabilities.push('order_capture')
  if (products && agent.restockAlertsEnabled !== false) capabilities.push('restock')
  if (agent.orderTrackingEnabled) capabilities.push('order_tracking')
  if (input.capabilityGates?.bookings !== false && input.serviceNames.length > 0) capabilities.push('bookings')
  if (input.capabilityGates?.courses === true) capabilities.push('courses')
  if (agent.handoffEnabled) capabilities.push('handoff')
  return capabilities
}

export async function runUnderstandingStage(input: UnderstandingStageInput): Promise<UnderstandingStage> {
  let outcome: UnderstandOutcome | null = null
  let route: UnderstoodRoute | null = null
  let candidates: TurnCandidates | null = null

  // A message with no text (a bare photo or voice note) has nothing to read.
  if (input.message.trim()) {
    const capabilities = agentCapabilities(input)
    const cart = capabilities.includes('order_capture')
      ? await loadCartForUnderstanding(input.conversationId).catch(() => null)
      : null
    candidates = await buildTurnCandidates({
      agentId: input.agent.id,
      workspaceId: input.workspaceId,
      history: input.history,
      state: input.state,
      capabilities,
      serviceNames: input.serviceNames,
      coursesEnabled: capabilities.includes('courses'),
      vocabulary: input.corpusTokens ?? null,
      draft: cart ? { status: cart.status, expecting: cart.expecting, items: cart.items } : null,
      openCheckout: cart?.openCheckout ? { expecting: cart.expecting } : null,
    }).catch(() => null)
    if (candidates) {
      const recent = input.history
        .filter((item): item is ChatMessage & { role: 'user' | 'assistant' } => item.role === 'user' || item.role === 'assistant')
        .slice(-6)
        .map((item) => ({ role: item.role, content: item.content }))
      outcome = await understandTurn({
        workspaceId: input.workspaceId,
        agentId: input.agent.id,
        conversationId: input.conversationId,
        message: input.message,
        recent,
        candidates,
        vocabulary: input.searchVocabulary ?? input.corpusTokens ?? null,
        ledger: input.ledger,
      })
      if (outcome.ok) {
        route = routeFromUnderstanding({
          verified: outcome.verified,
          candidates,
          message: input.message,
          state: input.state,
          corpusTokens: input.corpusTokens ?? null,
          lang: input.turnLang === 'en' ? 'en' : input.turnLang === 'ar' ? 'ar' : 'fa',
        })
      }
    }
  }

  let logged = false
  return {
    outcome,
    route,
    candidates,
    finalize: (routedDomains) => {
      if (logged) return
      logged = true
      writeUnderstandingLog({
        workspaceId: input.workspaceId,
        agentId: input.agent.id,
        conversationId: input.conversationId,
        messageId: input.inboundMessageId,
        outcome,
        routedDomains,
      })
    },
  }
}
