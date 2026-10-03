/**
 * Oracle run of the evaluation set: every case's EXPECTED reading goes
 * through the real verify → route code. This keeps the dataset honest
 * (refs exist, capabilities match) and proves the deterministic half does
 * the right thing whenever the model reads a message correctly — the model's
 * own accuracy is measured by scripts/eval-understanding.ts --system llm.
 */
import { describe, expect, it } from 'vitest'
import { EVAL_CASES } from '../evals/understanding/cases'
import type { EvalCase } from '../evals/understanding/types'
import { candidatesFor } from '../scripts/eval-understanding'
import { verifyUnderstanding } from '@/lib/agent/understand/verify'
import { routeFromUnderstanding } from '@/lib/agent/turn/route'
import { createEmptyConversationWorkingState } from '@/lib/ai/conversation-state'
import type { Act, ActType, TurnUnderstanding } from '@/lib/agent/understand/types'

function oracleAct(c: EvalCase, type: ActType, refs: string[]): Act {
  const firstWord = c.message.split(/\s+/u).find((word) => word.length >= 2) ?? c.message
  switch (type) {
    case 'product_search':
      return { type, terms: [firstWord], display: 'consult', ...(c.expect.maxPrice ? { maxPrice: c.expect.maxPrice } : {}), ...(c.expect.sort ? { sort: c.expect.sort } : {}) }
    case 'product_question': return { type, target: refs[0] ?? 'active', field: 'details' }
    case 'variants': return { type, target: refs[0] ?? 'active' }
    case 'compare': return { type, targets: refs.length >= 2 ? refs : ['card:1', 'card:2'] }
    case 'cheaper_alternative': return { type, target: refs[0] ?? 'active' }
    case 'order_start': return { type, items: refs.map((target) => ({ target })) }
    case 'cart_edit':
      return {
        type,
        ops: (c.expect.ops ?? []).map((op) => op.op === 'add'
          ? { op: 'add' as const, target: op.ref }
          : op.op === 'remove'
            ? { op: 'remove' as const, line: op.ref }
            : op.op === 'set_quantity'
              ? { op: 'set_quantity' as const, line: op.ref, quantity: op.quantity ?? 1 }
              : { op: 'set_variant' as const, line: op.ref, variant: op.variant ?? '' }),
      }
    case 'order_details': {
      const coupon = /[A-Z]{3,}\d+/.exec(c.message)?.[0]
      if (coupon) return { type, coupon }
      const shipping = ['تیپاکس', 'پیک', 'پست'].find((word) => c.message.includes(word))
      if (shipping) return { type, shipping }
      const lines = c.message.split('\n')
      return lines.length > 1
        ? { type, name: lines[0].split(/\s+/u).slice(0, 2).join(' '), address: lines[1] }
        : { type, address: c.message }
    }
    case 'booking': return { type, action: 'inquire' }
    case 'course': return { type, action: 'inquire' }
    case 'policy_question': return { type, topic: 'other' }
    case 'knowledge_question': return { type, query: c.message }
    case 'complaint': return { type, severity: 'high' }
    case 'restock_subscribe': return refs[0] ? { type, target: refs[0] } : { type }
    case 'order_status': return { type }
    default: return { type } as Act
  }
}

function oracle(c: EvalCase): TurnUnderstanding {
  const refs = c.expect.refs ?? []
  return {
    v: 1,
    language: 'fa',
    relation: 'other',
    acts: c.expect.acts.length ? c.expect.acts.map((type, index) => oracleAct(c, type, index === 0 || c.expect.acts.length === 1 ? refs : refs.slice(index))) : [{ type: 'other' }],
    answersPending: c.expect.answersPending ?? false,
    customer: { mood: 'neu', buy: 1, cues: [] },
    confidence: 0.9,
  }
}

describe('evaluation set — oracle readings through verify → route', () => {
  for (const c of EVAL_CASES) {
    it(`${c.id}: ${c.message.slice(0, 40)}`, () => {
      const candidates = candidatesFor(c)
      const verified = verifyUnderstanding({
        understanding: oracle(c),
        candidates,
        message: c.message,
        recentText: (c.history ?? []).map((turn) => turn.text).join('\n'),
        vocabulary: new Set(candidates.vocabulary),
      })
      const kept = new Set(verified.acts.map((act) => act.type))
      // Every expected act survives verification (refs exist, capability on).
      for (const act of c.expect.acts) expect(kept.has(act), `${act} dropped: ${JSON.stringify(verified.notes)}`).toBe(true)
      for (const act of c.expect.notActs ?? []) expect(kept.has(act)).toBe(false)
      if (c.expect.answersPending) expect(verified.answersPending).toBe(true)

      const decided = routeFromUnderstanding({ verified, candidates, message: c.message, state: createEmptyConversationWorkingState('s'), lang: 'fa' })
      // Executors receive exactly what the reading said.
      for (const op of c.expect.ops ?? []) {
        const line = Number(op.ref.split(':')[1])
        const ops = decided.orderSignals.cartOps ?? []
        if (op.op === 'add') expect(ops.some((item) => item.op === 'add')).toBe(true)
        else expect(ops.some((item) => item.op === op.op && 'line' in item && item.line === line)).toBe(true)
      }
      if (c.expect.acts.includes('order_start')) expect(decided.orderSignals.orderIntent).toBe(true)
      if (c.expect.acts.includes('booking')) expect(decided.booking).not.toBeNull()
      if (c.expect.notActs?.includes('booking')) expect(decided.booking).toBeNull()
      if (c.expect.acts.includes('order_cancel')) expect(decided.orderSignals.cancel).toBe(true)
      if (c.expect.notActs?.includes('order_cancel')) expect(decided.orderSignals.cancel).toBe(false)
      if (c.expect.maxPrice) expect(decided.catalogSearch?.budget.maxPrice).toBe(c.expect.maxPrice)
      const productRefs = (c.expect.refs ?? []).filter((ref) => !ref.startsWith('cart:'))
      if (productRefs.length && c.expect.acts.some((act) => ['product_question', 'variants', 'compare', 'cheaper_alternative'].includes(act))) {
        expect(decided.productPlan?.isProductTurn).toBe(true)
      }
    })
  }
})
