/**
 * Turn understanding — the structured meaning of one customer message.
 *
 * The model reads the message together with a CLOSED list of candidates the
 * server built for this turn (the cards the customer saw, cart lines, the
 * product under discussion, products seen earlier, services, courses, the
 * question the agent is waiting on). Every reference in the output must be
 * one of those candidate refs; verify.ts drops anything else. The model
 * proposes meaning — the server checks the evidence and does the work.
 */
import type { TurnCue, TurnMood, TurnBuyLevel } from '@/lib/ai/turn-signal'

export const UNDERSTANDING_VERSION = 1 as const

/** Candidate references the model may use (and nothing else). */
export type CandidateRef = string

export type Relation =
  | 'new_goal'
  | 'refinement'
  | 'answer'
  | 'reference'
  | 'correction'
  | 'side_question'
  | 'reset'
  | 'greeting'
  | 'closing'
  | 'other'

export type ProductField =
  | 'price'
  | 'stock'
  | 'material'
  | 'size'
  | 'dimensions'
  | 'colors'
  | 'link'
  | 'photo'
  | 'details'

export type PolicyTopic =
  | 'shipping_cost'
  | 'delivery_time'
  | 'shipping_method'
  | 'payment'
  | 'installment'
  | 'warranty'
  | 'return'
  | 'hours'
  | 'address'
  | 'contact'
  | 'other'

export interface ProductAttributes {
  color?: string
  size?: string
  material?: string
  style?: string
  design?: string
}

export type CartOpInput =
  | { op: 'add'; target: CandidateRef; variant?: string; quantity?: number }
  | { op: 'remove'; line: CandidateRef }
  | { op: 'set_quantity'; line: CandidateRef; quantity: number }
  | { op: 'set_variant'; line: CandidateRef; variant: string }

export type Act =
  | { type: 'greeting' }
  | { type: 'thanks' }
  | { type: 'goodbye' }
  | { type: 'defer' }
  | { type: 'smalltalk' }
  | { type: 'reset_topic' }
  | {
      type: 'product_search'
      terms: string[]
      attributes?: ProductAttributes
      maxPrice?: number
      minPrice?: number
      sort?: 'price_asc' | 'price_desc' | 'popular'
      count?: number
      display: 'showcase' | 'consult' | 'browse'
      /** A product code the customer typed («0788», «کد 1420»). */
      code?: string
    }
  | { type: 'product_question'; target: CandidateRef; field: ProductField; question?: string }
  | { type: 'variants'; target: CandidateRef; variant?: string }
  | { type: 'compare'; targets: CandidateRef[]; criterion?: string }
  | { type: 'cheaper_alternative'; target: CandidateRef }
  | { type: 'order_start'; items: Array<{ target: CandidateRef; variant?: string; quantity?: number }> }
  | { type: 'cart_edit'; ops: CartOpInput[] }
  | {
      type: 'order_details'
      name?: string
      phone?: string
      city?: string
      address?: string
      postalCode?: string
      coupon?: string
      shipping?: string
    }
  | { type: 'order_confirm' }
  | { type: 'order_decline' }
  | { type: 'order_cancel' }
  | { type: 'payment_claim' }
  | { type: 'payment_link_request' }
  | { type: 'shipping_change' }
  | { type: 'order_status'; orderRef?: string }
  | { type: 'restock_subscribe'; target?: CandidateRef }
  | { type: 'booking'; action: 'inquire' | 'book' | 'reschedule' | 'cancel' | 'list'; service?: CandidateRef; date?: string; time?: string }
  | { type: 'course'; action: 'inquire' | 'enroll' | 'cancel' | 'list'; course?: CandidateRef }
  | { type: 'policy_question'; topic: PolicyTopic; detail?: string }
  | { type: 'knowledge_question'; query: string }
  | { type: 'complaint'; severity: 'low' | 'high' }
  | { type: 'human_request' }
  | { type: 'other' }

export type ActType = Act['type']

/** The customer's own message, read by a neutral analyzer (not the reply model). */
export interface CustomerReading {
  mood: TurnMood
  buy: TurnBuyLevel
  cues: TurnCue[]
}

export interface TurnUnderstanding {
  v: typeof UNDERSTANDING_VERSION
  language: 'fa' | 'en' | 'ar'
  relation: Relation
  acts: Act[]
  /** The message answers the agent's pending question/offer. */
  answersPending: boolean
  /** The model could not resolve something essential; ask this instead of guessing. */
  clarify?: { reason: 'ambiguous_reference' | 'ambiguous_product' | 'missing_info'; question?: string }
  customer: CustomerReading
  confidence: number
}

// ─── Candidates (built by the server, sent to the model) ─────────────────────

export interface ProductCandidate {
  ref: CandidateRef
  /** Catalog id; may carry a «#v<variationId>» suffix for a variant card. */
  id: string
  name: string
  price?: number | null
  variants?: string[]
  unavailable?: boolean
}

export interface CartCandidate {
  ref: CandidateRef
  /** 1-based cart line. */
  line: number
  productId: string
  name: string
  variant: string | null
  quantity: number
}

export interface NamedCandidate {
  ref: CandidateRef
  id: string
  name: string
}

export type PendingKind =
  | 'confirm_order_summary'
  | 'confirm_cancel'
  | 'order_offer'
  | 'restock_offer'
  | 'showcase_offer'
  | 'booking_confirm'
  | 'ask_slot'
  | 'ask_choice'

export interface PendingQuestion {
  kind: PendingKind
  /** For ask_slot: which field («address», «phone», «color»…). */
  slot?: string
  /** The agent's own words, for context (bounded). */
  text?: string
}

export type Capability =
  | 'products'
  | 'order_capture'
  | 'pay_link'
  | 'restock'
  | 'order_tracking'
  | 'bookings'
  | 'courses'
  | 'handoff'

export interface TurnCandidates {
  capabilities: Capability[]
  pending: PendingQuestion | null
  /** What the customer is in the middle of (short answers continue it). */
  task: 'product' | 'order' | 'booking' | 'course' | 'support' | null
  /** The cards of the agent's recent replies, most recent showcase order first. */
  shownCards: ProductCandidate[]
  cart: CartCandidate[]
  /** The product under discussion right now. */
  active: ProductCandidate | null
  /** Products discussed earlier in this session (not in shownCards). */
  seen: ProductCandidate[]
  services: NamedCandidate[]
  courses: NamedCandidate[]
  /** Tenant catalog vocabulary sample (spelling anchors for search terms). */
  vocabulary: string[]
  categories: string[]
}

/** A reference after verification: what it really points at. */
export type ResolvedRef =
  | { kind: 'product'; ref: CandidateRef; id: string; name: string; source: 'card' | 'active' | 'seen' }
  | { kind: 'cart'; ref: CandidateRef; line: number; productId: string; name: string }
  | { kind: 'service'; ref: CandidateRef; id: string; name: string }
  | { kind: 'course'; ref: CandidateRef; id: string; name: string }

export interface VerificationNote {
  code:
    | 'UNKNOWN_REF'
    | 'TERM_NOT_IN_EVIDENCE'
    | 'NUMBER_NOT_IN_MESSAGE'
    | 'PHONE_INVALID'
    | 'NAME_NOT_IN_MESSAGE'
    | 'ADDRESS_NOT_IN_MESSAGE'
    | 'CITY_UNKNOWN'
    | 'CAPABILITY_OFF'
    | 'LOW_CONFIDENCE_ACTION'
    | 'NO_PENDING'
    | 'EMPTY_ACT'
    | 'DATE_NOT_IN_EVIDENCE'
  act: ActType
  detail?: string
}

/** The understanding after verify.ts: refs resolved, unsupported facts removed. */
export interface VerifiedUnderstanding extends TurnUnderstanding {
  refs: Record<CandidateRef, ResolvedRef>
  notes: VerificationNote[]
  /** Capabilities the customer asked for that this agent does not have. */
  unavailable: Capability[]
}
