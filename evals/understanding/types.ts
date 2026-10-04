/**
 * Evaluation cases for the turn-understanding layer. A case describes one
 * customer turn with its closed candidate world and the reading a careful
 * human would give it. The same cases score the model reading, the legacy
 * regex router (baseline) and the deterministic verify→route half (oracle).
 */
import type { ActType, Capability, PendingKind } from '@/lib/agent/understand/types'

export interface EvalProduct {
  name: string
  price?: number
  variants?: string[]
  unavailable?: boolean
}

export interface EvalCase {
  id: string
  /** Area and flags («regression» = a bug the regex router has today). */
  tags: string[]
  capabilities?: Capability[]
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  cards?: EvalProduct[]
  active?: EvalProduct | null
  seen?: EvalProduct[]
  cart?: Array<{ name: string; variant?: string | null; qty?: number }>
  services?: string[]
  courses?: string[]
  pending?: { kind: PendingKind; slot?: string } | null
  task?: 'product' | 'order' | 'booking' | 'course' | 'support' | null
  message: string
  expect: {
    /** Act types that must be present. */
    acts: ActType[]
    /** Act types that must NOT be present (e.g. order_cancel on an edit). */
    notActs?: ActType[]
    /** Refs that must be targeted by some act (card:2, active, cart:1…). */
    refs?: string[]
    /** Cart operations that must be produced (op + line/target). */
    ops?: Array<{ op: 'add' | 'remove' | 'set_quantity' | 'set_variant'; ref: string; quantity?: number; variant?: string }>
    /** A product_search must carry these attribute values / budget. */
    maxPrice?: number
    sort?: 'price_asc' | 'price_desc' | 'popular'
    /** The message answers the pending question. */
    answersPending?: boolean
  }
}

export const STORE: Capability[] = ['products', 'order_capture', 'restock', 'order_tracking', 'handoff']
export const STORE_WITH_BOOKINGS: Capability[] = [...STORE, 'bookings']
export const SALON: Capability[] = ['bookings', 'handoff']
export const ACADEMY: Capability[] = ['courses', 'handoff']
