/**
 * Turn stage «understand»: build the closed candidate list, read the message
 * with the understanding model, verify it, route it, and keep the legacy
 * router's reading next to it for agreement metrics.
 *
 * Returns routing that the engine applies per domain (mode.ts). Every failure
 * path returns `route: null`, so the engine keeps the legacy decision.
 */
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { ChatAgent } from '@/lib/ai/chat-types'
import type { ProductRequestPlan } from '@/lib/ai/conversation'
import type { ConversationWorkingState } from '@/lib/ai/conversation-state'
import type { TurnLedger } from '@/lib/ai/llm/aux'
import type { TurnLanguage } from '@/lib/ai/turn-language'
import { loadCartForUnderstanding } from '@/lib/commerce/order-service'
import { buildTurnCandidates } from '@/lib/agent/understand/candidates'
import { legacyReading, readingDiff, type LegacyReading } from '@/lib/agent/understand/legacy-adapter'
import { writeUnderstandingLog } from '@/lib/agent/understand/log'
import {
  resolveUnderstandingMode,
  routesFromUnderstanding,
  type ResolvedUnderstandingMode,
  type UnderstandingDomain,
} from '@/lib/agent/understand/mode'
import { understandTurn, type UnderstandOutcome } from '@/lib/agent/understand/understand'
import { routeFromUnderstanding, type UnderstoodRoute } from '@/lib/agent/turn/route'
import type { Capability, TurnCandidates } from '@/lib/agent/understand/types'

export interface UnderstandingStage {
  mode: ResolvedUnderstandingMode
  outcome: UnderstandOutcome | null
  route: UnderstoodRoute | null
  candidates: TurnCandidates | null
  legacy: LegacyReading | null
  /** Does this domain take the model reading on this turn? */
  routes(domain: UnderstandingDomain): boolean
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
  /** History used by the regex planner (for the legacy reading). */
  planningHistory: ChatMessage[]
  state: ConversationWorkingState
  capabilityGates?: { products?: boolean; bookings?: boolean; courses?: boolean }
  serviceNames: string[]
  corpusTokens?: ReadonlySet<string> | null
  /** Identity plus attribute/variation words: what a verified search term may be. */
  searchVocabulary?: ReadonlySet<string> | null
  legacyPlan: ProductRequestPlan
  ledger?: TurnLedger | null
  turnLang: TurnLanguage
  /** A deterministic fast path already answers this turn (closing / greeting). */
  skip?: boolean
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
  const mode = await resolveUnderstandingMode(input.workspaceId).catch(() => ({ mode: 'off' as const, domains: {} as ResolvedUnderstandingMode['domains'], timeoutMs: 6_000 }))
  let outcome: UnderstandOutcome | null = null
  let route: UnderstoodRoute | null = null
  let candidates: TurnCandidates | null = null
  let legacy: LegacyReading | null = null
  let skipped = false

  if (mode.mode !== 'off' && input.message.trim()) {
    const capabilities = agentCapabilities(input)
    const cart = capabilities.includes('order_capture')
      ? await loadCartForUnderstanding(input.conversationId).catch(() => null)
      : null
    legacy = legacyReading({
      message: input.message,
      history: input.planningHistory,
      plan: input.legacyPlan,
      hasDraft: Boolean(cart && !cart.openCheckout),
      capabilities: {
        orderCapture: capabilities.includes('order_capture'),
        bookings: capabilities.includes('bookings'),
        courses: capabilities.includes('courses'),
        restock: capabilities.includes('restock'),
        tracking: capabilities.includes('order_tracking'),
      },
    })
    if (input.skip) {
      skipped = true
    } else {
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
          timeoutMs: mode.timeoutMs,
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
  }

  let logged = false
  const stage: UnderstandingStage = {
    mode,
    outcome,
    route,
    candidates,
    legacy,
    routes: (domain) => route !== null && routesFromUnderstanding(mode, domain),
    finalize: (routedDomains) => {
      if (logged || mode.mode === 'off') return
      logged = true
      const diff = outcome?.ok && legacy ? readingDiff(outcome.verified, legacy) : null
      writeUnderstandingLog({
        workspaceId: input.workspaceId,
        agentId: input.agent.id,
        conversationId: input.conversationId,
        messageId: input.inboundMessageId,
        mode: mode.mode,
        outcome,
        legacy,
        diffKinds: diff?.diffKinds ?? [],
        agreed: diff ? diff.agreed : null,
        routedDomains,
        ...(skipped ? { status: 'skipped' as const } : {}),
      })
    },
  }
  return stage
}
