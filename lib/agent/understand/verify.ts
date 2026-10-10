/**
 * Verification of a model reading against the closed candidate list and the
 * customer's actual words. Nothing the model reports is trusted on its own:
 *   • every reference must be a candidate ref of this turn;
 *   • numbers, phones, prices, order refs and codes must appear in the message;
 *   • names and addresses must be (mostly) the customer's own words;
 *   • search terms must come from the message, the recent turns or the
 *     tenant's catalog vocabulary (spelling fixes like «پوف»→«پاف»);
 *   • capabilities the agent lacks are reported, never executed;
 *   • a low-confidence reading never changes a cart, an order or a booking.
 */
import { findIranianCity } from '@/lib/ai/fact-capture'
import { looksLikePersonName } from '@/lib/ai/customer-identification'
import {
  digitsAppearIn,
  normalizeEvidenceText,
  phraseAppearsIn,
  priceAppearsIn,
  tokensMostlyIn,
  verifiedMobile,
} from '@/lib/agent/parsers/evidence'
import { resolvePersianDateTime } from '@/lib/agent/parsers/persian-datetime'
import type {
  Act,
  ActType,
  CandidateRef,
  Capability,
  CartOpInput,
  ProductAttributes,
  ResolvedRef,
  TurnCandidates,
  TurnUnderstanding,
  VerificationNote,
  VerifiedUnderstanding,
} from '@/lib/agent/understand/types'

/** Below this confidence no act may change a cart, an order or a booking. */
export const ACTION_CONFIDENCE_FLOOR = 0.35

const STATE_CHANGING: ReadonlySet<ActType> = new Set([
  'order_start', 'cart_edit', 'order_confirm', 'order_cancel', 'restock_subscribe',
])

export function buildRefMap(candidates: TurnCandidates): Record<CandidateRef, ResolvedRef> {
  const refs: Record<CandidateRef, ResolvedRef> = {}
  for (const card of candidates.shownCards) refs[card.ref] = { kind: 'product', ref: card.ref, id: card.id, name: card.name, source: 'card' }
  if (candidates.active) refs[candidates.active.ref] = { kind: 'product', ref: candidates.active.ref, id: candidates.active.id, name: candidates.active.name, source: 'active' }
  for (const item of candidates.seen) refs[item.ref] = { kind: 'product', ref: item.ref, id: item.id, name: item.name, source: 'seen' }
  for (const line of candidates.cart) refs[line.ref] = { kind: 'cart', ref: line.ref, line: line.line, productId: line.productId, name: line.name }
  for (const service of candidates.services) refs[service.ref] = { kind: 'service', ref: service.ref, id: service.id, name: service.name }
  for (const course of candidates.courses) refs[course.ref] = { kind: 'course', ref: course.ref, id: course.id, name: course.name }
  return refs
}

export interface VerifyInput {
  understanding: TurnUnderstanding
  candidates: TurnCandidates
  message: string
  /** Recent turns' text (customer + agent), evidence for carried terms. */
  recentText: string
  /** Full catalog identity vocabulary (normalized tokens). */
  vocabulary?: ReadonlySet<string> | null
}

export function verifyUnderstanding(input: VerifyInput): VerifiedUnderstanding {
  const { understanding, candidates, message } = input
  const refs = buildRefMap(candidates)
  const notes: VerificationNote[] = []
  const unavailable = new Set<Capability>()
  const has = (capability: Capability) => candidates.capabilities.includes(capability)
  const usedRefs: Record<CandidateRef, ResolvedRef> = {}

  const resolve = (ref: CandidateRef | undefined, act: ActType, kinds: ResolvedRef['kind'][]): ResolvedRef | null => {
    if (!ref) return null
    const key = ref === 'entity' ? 'active' : ref
    const hit = refs[key]
    if (!hit || !kinds.includes(hit.kind)) {
      notes.push({ code: 'UNKNOWN_REF', act, detail: ref })
      return null
    }
    usedRefs[hit.ref] = hit
    return hit
  }
  const productRef = (ref: CandidateRef | undefined, act: ActType) => resolve(ref, act, ['product', 'cart'])

  const termEvidence = (term: string): boolean => {
    if (phraseAppearsIn(term, message, input.recentText)) return true
    const normalized = normalizeEvidenceText(term)
    if (input.vocabulary?.has(normalized)) return true
    // One-letter joiners («و») carry no identity: «سرویس قاشق و چنگال» is
    // backed by «سرویس قاشق چنگال».
    const tokens = normalized.split(' ').filter((token) => token.length >= 2)
    return tokens.length > 0 && tokens.every((token) => input.vocabulary?.has(token) || phraseAppearsIn(token, message, input.recentText))
  }

  const verifiedActs: Act[] = []
  for (const act of understanding.acts) {
    const kept = verifyAct(act)
    if (kept) verifiedActs.push(kept)
  }

  function verifyAct(act: Act): Act | null {
    switch (act.type) {
      case 'product_search': {
        if (!has('products')) { unavailable.add('products'); notes.push({ code: 'CAPABILITY_OFF', act: act.type }); return null }
        const terms = act.terms.filter((term) => {
          if (termEvidence(term)) return true
          notes.push({ code: 'TERM_NOT_IN_EVIDENCE', act: act.type, detail: term })
          return false
        })
        let attributes: ProductAttributes | undefined
        if (act.attributes) {
          const entries = Object.entries(act.attributes).filter(([, value]) => value && phraseAppearsIn(value, message, input.recentText))
          attributes = entries.length ? Object.fromEntries(entries) : undefined
        }
        const code = act.code && (digitsAppearIn(act.code, message) || phraseAppearsIn(act.code, message)) ? act.code : undefined
        const maxPrice = act.maxPrice != null && priceAppearsIn(act.maxPrice, message) ? act.maxPrice : undefined
        const minPrice = act.minPrice != null && priceAppearsIn(act.minPrice, message) ? act.minPrice : undefined
        if (act.maxPrice != null && maxPrice == null) notes.push({ code: 'NUMBER_NOT_IN_MESSAGE', act: act.type, detail: String(act.maxPrice) })
        if (act.minPrice != null && minPrice == null) notes.push({ code: 'NUMBER_NOT_IN_MESSAGE', act: act.type, detail: String(act.minPrice) })
        if (!terms.length && !attributes && !code && act.display !== 'browse' && maxPrice == null && minPrice == null && !act.sort) {
          notes.push({ code: 'EMPTY_ACT', act: act.type })
          return null
        }
        return {
          type: act.type,
          terms,
          display: act.display,
          ...(attributes ? { attributes } : {}),
          ...(code ? { code } : {}),
          ...(maxPrice != null ? { maxPrice } : {}),
          ...(minPrice != null ? { minPrice } : {}),
          ...(act.sort ? { sort: act.sort } : {}),
          ...(act.count ? { count: act.count } : {}),
        }
      }
      case 'product_question':
      case 'variants':
      case 'cheaper_alternative': {
        if (!has('products')) { unavailable.add('products'); notes.push({ code: 'CAPABILITY_OFF', act: act.type }); return null }
        return productRef(act.target, act.type) ? act : null
      }
      case 'compare': {
        if (!has('products')) { unavailable.add('products'); return null }
        const targets = act.targets.filter((target) => productRef(target, act.type))
        return targets.length >= 2 ? { ...act, targets } : null
      }
      case 'order_start': {
        if (!has('order_capture')) { unavailable.add('order_capture'); notes.push({ code: 'CAPABILITY_OFF', act: act.type }); return null }
        const items = act.items.filter((item) => productRef(item.target, act.type))
        return { ...act, items }
      }
      case 'cart_edit': {
        if (!has('order_capture')) { unavailable.add('order_capture'); return null }
        if (!candidates.cart.length) { notes.push({ code: 'EMPTY_ACT', act: act.type, detail: 'empty cart' }); return null }
        const ops = act.ops.filter((op: CartOpInput) => op.op === 'add'
          ? productRef(op.target, act.type)
          : resolve(op.line, act.type, ['cart']))
        return ops.length ? { ...act, ops } : null
      }
      case 'order_details': {
        if (!has('order_capture')) { unavailable.add('order_capture'); return null }
        const out: Extract<Act, { type: 'order_details' }> = { type: 'order_details' }
        if (act.name) {
          if (phraseAppearsIn(act.name, message) && looksLikePersonName(act.name)) out.name = act.name
          else notes.push({ code: 'NAME_NOT_IN_MESSAGE', act: act.type })
        }
        if (act.phone) {
          const phone = verifiedMobile(act.phone, message)
          if (phone) out.phone = phone
          else notes.push({ code: 'PHONE_INVALID', act: act.type })
        }
        if (act.city) {
          const city = findIranianCity(act.city) ?? (phraseAppearsIn(act.city, message) ? act.city : null)
          if (city && (phraseAppearsIn(city, message) || phraseAppearsIn(act.city, message))) out.city = city
          else notes.push({ code: 'CITY_UNKNOWN', act: act.type, detail: act.city })
        }
        if (act.address) {
          if (tokensMostlyIn(act.address, message)) out.address = act.address
          else notes.push({ code: 'ADDRESS_NOT_IN_MESSAGE', act: act.type })
        }
        if (act.postalCode) {
          const digits = act.postalCode.replace(/\D/g, '')
          if (digits.length === 10 && digitsAppearIn(digits, message)) out.postalCode = digits
          else notes.push({ code: 'NUMBER_NOT_IN_MESSAGE', act: act.type, detail: 'postal code' })
        }
        if (act.coupon && phraseAppearsIn(act.coupon, message)) out.coupon = act.coupon
        if (act.shipping && phraseAppearsIn(act.shipping, message)) out.shipping = act.shipping
        return Object.keys(out).length > 1 ? out : null
      }
      case 'order_confirm': case 'order_decline': case 'order_cancel':
      case 'payment_claim': case 'payment_link_request': case 'shipping_change':
        if (!has('order_capture')) { unavailable.add('order_capture'); return null }
        return act
      case 'order_status': {
        if (!has('order_tracking')) unavailable.add('order_tracking')
        if (act.orderRef && !digitsAppearIn(act.orderRef, message) && !phraseAppearsIn(act.orderRef, message)) {
          notes.push({ code: 'NUMBER_NOT_IN_MESSAGE', act: act.type, detail: 'order ref' })
          return { type: act.type }
        }
        return act
      }
      case 'restock_subscribe': {
        if (!has('restock')) { unavailable.add('restock'); notes.push({ code: 'CAPABILITY_OFF', act: act.type }); return null }
        if (act.target && !productRef(act.target, act.type)) return { type: act.type }
        return act
      }
      case 'booking': {
        if (!has('bookings')) { unavailable.add('bookings'); notes.push({ code: 'CAPABILITY_OFF', act: act.type }); return null }
        // A day the customer never mentioned is dropped: the words (or a date
        // the parser reads in them, typos included) must be in the
        // conversation, not only in the model's reading.
        const dateBacked = !act.date
          || phraseAppearsIn(act.date, message, input.recentText)
          || resolvePersianDateTime(message).dateKey != null
          || resolvePersianDateTime(input.recentText).dateKey != null
        if (!dateBacked) notes.push({ code: 'DATE_NOT_IN_EVIDENCE', act: act.type, detail: act.date })
        const kept = { ...act }
        if (!dateBacked) delete kept.date
        if (act.service && !resolve(act.service, act.type, ['service'])) {
          return { type: act.type, action: act.action, ...(kept.date ? { date: kept.date } : {}), ...(act.time ? { time: act.time } : {}) }
        }
        return kept
      }
      case 'course': {
        if (!has('courses')) { unavailable.add('courses'); notes.push({ code: 'CAPABILITY_OFF', act: act.type }); return null }
        if (act.course && !resolve(act.course, act.type, ['course'])) {
          return { type: act.type, action: act.action }
        }
        return act
      }
      case 'human_request':
        if (!has('handoff')) unavailable.add('handoff')
        return act
      default:
        return act
    }
  }

  let acts = verifiedActs
  if (understanding.confidence < ACTION_CONFIDENCE_FLOOR) {
    const informational = acts.filter((act) => {
      const changes = STATE_CHANGING.has(act.type)
        || (act.type === 'booking' && act.action !== 'inquire' && act.action !== 'list')
        || (act.type === 'course' && (act.action === 'enroll' || act.action === 'cancel'))
      if (changes) notes.push({ code: 'LOW_CONFIDENCE_ACTION', act: act.type })
      return !changes
    })
    acts = informational
  }
  if (!acts.length) acts = [{ type: 'other' }]
  const answersPending = understanding.answersPending && Boolean(candidates.pending)
  if (understanding.answersPending && !candidates.pending) notes.push({ code: 'NO_PENDING', act: acts[0].type })
  const clarify = understanding.clarify
    ?? (notes.some((note) => note.code === 'LOW_CONFIDENCE_ACTION') ? { reason: 'missing_info' as const } : undefined)

  return {
    ...understanding,
    acts,
    answersPending,
    ...(clarify ? { clarify } : {}),
    refs: usedRefs,
    notes,
    unavailable: [...unavailable],
  }
}
