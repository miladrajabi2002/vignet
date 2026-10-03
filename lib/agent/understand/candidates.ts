/**
 * The closed world the understanding model may refer to on this turn.
 *
 * Everything here comes from trusted rows: card ids from the agent's own
 * recent replies, the active draft's cart lines, the state's product memory,
 * the workspace's services and courses, and the tenant's catalog vocabulary.
 * Names/prices/variants are read fresh from the catalog, never from text the
 * model wrote.
 */
import { prisma } from '@/lib/prisma'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { assistantCardIds } from '@/lib/ai/conversation'
import type { ConversationWorkingState } from '@/lib/ai/conversation-state'
import { extractTypedVariations } from '@/lib/products/description'
import { variationLabel } from '@/lib/products/presentation'
import type {
  CartCandidate,
  Capability,
  NamedCandidate,
  PendingQuestion,
  ProductCandidate,
  TurnCandidates,
} from '@/lib/agent/understand/types'

export interface CandidateDraft {
  status: string
  expecting: string | null
  items: Array<{ productId: string; variationId: number | null; name: string; variant: string | null; quantity: number }>
}

export interface BuildCandidatesInput {
  agentId: string
  workspaceId: string
  history: ChatMessage[]
  state: ConversationWorkingState
  capabilities: Capability[]
  serviceNames: string[]
  coursesEnabled: boolean
  /** Catalog identity vocabulary (normalized tokens). */
  vocabulary?: ReadonlySet<string> | null
  categories?: string[]
  /** The conversation's active order draft (or a just-reopened checkout). */
  draft?: CandidateDraft | null
  /** An unpaid payment link is out (pending = link/payment follow-ups). */
  openCheckout?: { expecting: string | null } | null
}

const parentOf = (id: string) => id.split('#')[0]

function variationIdOf(id: string): number | null {
  const suffix = id.split('#')[1]
  const match = suffix ? /^v?(\d+)$/i.exec(suffix) : null
  return match ? Number(match[1]) : null
}

/** Card ids of the most recent assistant reply that showed any, in display order. */
export function recentShownCardIds(history: ChatMessage[], lookback = 4): string[] {
  const assistants = history.filter((item) => item.role === 'assistant').slice(-lookback).reverse()
  for (const item of assistants) {
    const ids = assistantCardIds(item)
    if (ids.length) return ids
  }
  return []
}

/** Deterministic, short vocabulary sample: distinctive catalog tokens first. */
export function vocabularySample(vocabulary: ReadonlySet<string> | null | undefined, limit = 40): string[] {
  if (!vocabulary?.size) return []
  return [...vocabulary]
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token))
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .slice(0, limit * 2)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit)
}

function pendingFrom(input: BuildCandidatesInput): PendingQuestion | null {
  const draft = input.draft
  if (input.openCheckout?.expecting === 'confirm_cancel') return { kind: 'confirm_cancel' }
  if (draft) {
    if (draft.expecting === 'confirm_cancel') return { kind: 'confirm_cancel' }
    if (draft.status === 'AWAITING_CONFIRM' || draft.expecting === 'confirm') return { kind: 'confirm_order_summary' }
    if (draft.expecting === 'variant' || draft.expecting === 'product') return { kind: 'ask_choice', slot: draft.expecting }
    if (draft.expecting) return { kind: 'ask_slot', slot: draft.expecting }
  }
  // Set by the agent's previous turn and consumed by this one (the state
  // engine clears it when the customer's next message is applied).
  const pending = input.state.pending
  if (pending) {
    return { kind: pending.kind, ...(pending.slot ? { slot: pending.slot } : {}), ...(pending.text ? { text: pending.text } : {}) }
  }
  if (input.state.lastQuestion) {
    return { kind: 'ask_slot', slot: input.state.lastQuestion.key, text: input.state.lastQuestion.text }
  }
  return null
}

export async function buildTurnCandidates(input: BuildCandidatesInput): Promise<TurnCandidates> {
  const showcaseIds = input.state.lastShowcase?.map((item) => item.id) ?? []
  const historyIds = recentShownCardIds(input.history)
  // Prefer the state's ordered showcase when it matches what the history shows.
  const cardIds = (historyIds.length ? historyIds : showcaseIds).slice(0, 10)
  const activeId = input.state.activeEntity?.type === 'PRODUCT' ? input.state.activeEntity.id : null
  const seenIds = (input.state.discussedEntities ?? []).map((entity) => entity.id)
  const draftItems = input.draft?.items ?? []

  const wanted = [...new Set([...cardIds, ...(activeId ? [activeId] : []), ...seenIds].map(parentOf))].slice(0, 30)
  const [rows, courses] = await Promise.all([
    wanted.length
      ? prisma.product.findMany({
        where: { id: { in: wanted }, catalogItems: { some: { agentId: input.agentId } } },
        select: { id: true, name: true, price: true, stock: true, attributes: true, active: true },
      }).catch(() => [])
      : Promise.resolve([]),
    input.coursesEnabled
      ? prisma.course.findMany({
        where: { workspaceId: input.workspaceId, status: { in: ['PUBLISHED', 'CLOSED'] } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, title: true },
      }).catch(() => [])
      : Promise.resolve([]),
  ])
  const byId = new Map(rows.map((row) => [row.id, row]))

  const product = (id: string, ref: string): ProductCandidate | null => {
    const row = byId.get(parentOf(id))
    if (!row || !row.active) return null
    const variations = extractTypedVariations(row.attributes)
    const variationId = variationIdOf(id)
    const pinned = variationId != null ? variations.find((variation) => variation.id === variationId) : null
    const available = variations.filter((variation) => variation.manageStock ? (variation.stockQuantity ?? 0) > 0 : variation.inStock !== false)
    const unavailable = pinned
      ? (pinned.manageStock ? (pinned.stockQuantity ?? 0) <= 0 : pinned.inStock === false)
      : row.stock === 0 || (variations.length > 0 && available.length === 0)
    return {
      ref,
      id,
      name: pinned ? `${row.name} — ${variationLabel(pinned)}` : row.name,
      price: pinned?.price ?? row.price ?? null,
      ...(!pinned && variations.length ? { variants: available.map(variationLabel).filter(Boolean).slice(0, 10) } : {}),
      ...(unavailable ? { unavailable: true } : {}),
    }
  }

  const shownCards = cardIds
    .map((id, index) => product(id, `card:${index + 1}`))
    .filter((item): item is ProductCandidate => item !== null)
  const shownParents = new Set(shownCards.map((card) => parentOf(card.id)))
  const active = activeId ? product(activeId, 'active') : null
  const seen = seenIds
    .filter((id) => !shownParents.has(parentOf(id)) && parentOf(id) !== (activeId ? parentOf(activeId) : ''))
    .map((id, index) => product(id, `seen:${index + 1}`))
    .filter((item): item is ProductCandidate => item !== null)
    .slice(0, 8)
    .map((item, index) => ({ ...item, ref: `seen:${index + 1}` }))
  const cart: CartCandidate[] = draftItems.map((item, index) => ({
    ref: `cart:${index + 1}`,
    line: index + 1,
    productId: item.variationId != null ? `${item.productId}#v${item.variationId}` : item.productId,
    name: item.name,
    variant: item.variant,
    quantity: item.quantity,
  }))
  const services: NamedCandidate[] = input.serviceNames.slice(0, 15).map((name, index) => ({ ref: `svc:${index + 1}`, id: name, name }))
  const courseCandidates: NamedCandidate[] = courses.map((course, index) => ({ ref: `course:${index + 1}`, id: course.id, name: course.title }))

  return {
    capabilities: input.capabilities,
    pending: pendingFrom(input),
    shownCards,
    cart,
    active,
    seen,
    services,
    courses: courseCandidates,
    vocabulary: vocabularySample(input.vocabulary),
    categories: (input.categories ?? []).slice(0, 20),
  }
}
