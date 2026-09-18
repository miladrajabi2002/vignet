import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    usageLog: { create: vi.fn().mockResolvedValue({}) },
    product: { findMany: vi.fn() },
    knowledgeChunk: { findMany: vi.fn() },
    knowledgeBase: { findFirst: vi.fn(), create: vi.fn() },
    agentCatalog: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/ai/openrouter', () => ({
  chatCompletion: vi.fn(),
}))

import {
  analyzerGate,
  analyzerSearchTerms,
  parseAnalysis,
  resetAnalyzerCircuit,
} from '@/lib/ai/turn-analyzer'
import { extractProductTerms, planProductRequest } from '@/lib/ai/conversation'

function basePlan(overrides: Partial<ReturnType<typeof planProductRequest>> = {}) {
  const plan = planProductRequest('سلام', [])
  return { ...plan, ...overrides }
}

beforeEach(() => {
  resetAnalyzerCircuit()
})

describe('analyzerGate — when the LLM analyzer may run at all', () => {
  it('never runs without catalog access or on topic resets', () => {
    expect(
      analyzerGate({
        message: 'رنگ گردویی می‌خوام',
        plan: basePlan({ isProductTurn: true, searchTerms: [] }),
        productAccessEnabled: false,
      }),
    ).toBeNull()
    expect(
      analyzerGate({
        message: 'رنگ گردویی می‌خوام',
        plan: basePlan({ requestNewTopic: true, isProductTurn: true, searchTerms: [] }),
        productAccessEnabled: true,
      }),
    ).toBeNull()
  })

  it('skips trivially short messages (greetings/reactions)', () => {
    expect(
      analyzerGate({
        message: 'سلام',
        plan: basePlan(),
        productAccessEnabled: true,
        retrievedChunkCount: 0,
      }),
    ).toBeNull()
  })

  it('TERM_BUILD: fires only for a product turn with zero search terms', () => {
    expect(
      analyzerGate({
        message: 'هموناش رو بفرست',
        plan: basePlan({ isProductTurn: true, searchTerms: [] }),
        productAccessEnabled: true,
      }),
    ).toBe('TERM_BUILD')
    // has terms -> nothing to build
    expect(
      analyzerGate({
        message: 'میز تلویزیون ۱۶۰ می‌خوام',
        plan: basePlan({ isProductTurn: true, searchTerms: ['میز', 'تلویزیون'] }),
        productAccessEnabled: true,
      }),
    ).toBeNull()
    // explicit showcase / discovery browse need no keywords
    expect(
      analyzerGate({
        message: 'هموناش رو بفرست',
        plan: basePlan({ isProductTurn: true, searchTerms: [], explicitShowcase: true }),
        productAccessEnabled: true,
      }),
    ).toBeNull()
    expect(
      analyzerGate({
        message: 'چی دارین؟',
        plan: basePlan({ isProductTurn: true, searchTerms: [], discoveryBrowse: true }),
        productAccessEnabled: true,
      }),
    ).toBeNull()
  })

  it('RESCUE: fires when nothing was retrieved and no layer promoted the turn', () => {
    expect(
      analyzerGate({
        message: 'همون وسیله‌ای که تو استوری گذاشتین رو می‌خوام',
        plan: basePlan({ isProductTurn: false }),
        productAccessEnabled: true,
        retrievedChunkCount: 0,
      }),
    ).toBe('RESCUE')
    // something was retrieved -> the reply model has context, no rescue needed
    expect(
      analyzerGate({
        message: 'همون وسیله‌ای که تو استوری گذاشتین رو می‌خوام',
        plan: basePlan({ isProductTurn: false }),
        productAccessEnabled: true,
        retrievedChunkCount: 2,
      }),
    ).toBeNull()
    // semantic promotion already happened -> no rescue
    expect(
      analyzerGate({
        message: 'پاف مراکشی جدید اومده؟',
        plan: basePlan({ isProductTurn: false, semanticTurn: true }),
        productAccessEnabled: true,
        retrievedChunkCount: 0,
      }),
    ).toBeNull()
    // already a product turn -> the TERM_BUILD branch (not RESCUE) owns it
    expect(
      analyzerGate({
        message: 'میز عسلی می‌خوام',
        plan: basePlan({ isProductTurn: true, searchTerms: ['میز', 'عسلی'] }),
        productAccessEnabled: true,
        retrievedChunkCount: 0,
      }),
    ).toBeNull()
  })
})

describe('parseAnalysis — tolerant JSON handling', () => {
  it('parses a clean verdict', () => {
    const analysis = parseAnalysis(
      '{"intent":"product","keywords":["پاف","مراکشی"],"attributes":{"color":"گردویی","size":"۱۶۰"},"handoff":false,"confidence":0.9}',
    )
    expect(analysis).not.toBeNull()
    expect(analysis!.intent).toBe('product')
    expect(analysis!.productKeywords).toEqual(['پاف', 'مراکشی'])
    expect(analysis!.attributes.color).toBe('گردویی')
    expect(analysis!.attributes.size).toBe('160') // normalized digit space
    expect(analysis!.handoffUrgent).toBe(false)
    expect(analysis!.confidence).toBe(0.9)
  })

  it('parses fenced JSON and strips prose around it', () => {
    const analysis = parseAnalysis('```json\n{"intent":"knowledge","keywords":[],"attributes":{},"handoff":false,"confidence":0.8}\n```')
    expect(analysis?.intent).toBe('knowledge')
  })

  it('rejects missing intent, garbage and non-JSON', () => {
    expect(parseAnalysis('{"keywords":["x"]}')).toBeNull()
    expect(parseAnalysis('total garbage')).toBeNull()
    expect(parseAnalysis('')).toBeNull()
  })

  it('normalizes keywords and clamps values', () => {
    const analysis = parseAnalysis(
      '{"intent":"product","keywords":["  پاف ","X"],"attributes":{"color":"' + 'x'.repeat(50) + '"},"handoff":true,"confidence":5}',
    )
    expect(analysis!.productKeywords).toContain('پاف')
    expect(analysis!.productKeywords).not.toContain('X')
    expect(analysis!.attributes.color).toBeUndefined()
    expect(analysis!.handoffUrgent).toBe(true)
    expect(analysis!.confidence).toBe(1)
  })

  it('caps the keyword list at 8 and dedupes', () => {
    const keywords = Array.from({ length: 12 }, (_, i) => `کیف${i}`)
    const analysis = parseAnalysis(
      JSON.stringify({ intent: 'product', keywords: [...keywords, 'کیف0'], attributes: {}, handoff: false, confidence: 0.5 }),
    )
    expect(analysis!.productKeywords.length).toBeLessThanOrEqual(8)
    expect(new Set(analysis!.productKeywords).size).toBe(analysis!.productKeywords.length)
  })
})

describe('analyzerSearchTerms — keywords are hints, never raw queries', () => {
  it('feeds keywords + attributes through the engine term extractor', () => {
    const terms = analyzerSearchTerms(
      {
        intent: 'product',
        productKeywords: ['پاف', 'مراکشی'],
        attributes: { color: 'گردویی', size: '۱۶۰' },
        handoffUrgent: false,
        confidence: 0.9,
      },
      'همون گردویی‌شو می‌خوام بود',
    )
    // extractProductTerms filters stop-words and normalizes; the union must
    // contain the analyzer's vocabulary and the attribute values.
    expect(terms).toContain('پاف')
    expect(terms).toContain('مراکشی')
    expect(terms.some((t) => t.includes('گردویی'))).toBe(true)
    // conversational verb pollution must not leak into search terms
    expect(terms).not.toContain('می‌خوام')
    // sanity: the extractor agrees these are real terms
    expect(extractProductTerms('پاف مراکشی گردویی ۱۶۰').length).toBeGreaterThan(0)
  })
})
