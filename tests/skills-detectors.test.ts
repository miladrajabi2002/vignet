import 'dotenv/config'
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  candidateConflictPairs,
  claimedProductCount,
  categorizeQuestion,
  detectFunnelStalls,
  detectKnowledgeGaps,
  detectPostChanges,
  detectPreferenceViolations,
  detectToolFailures,
  normalizeKnowledgeConflicts,
  normalizeToneReview,
  parseFaNumber,
  parseModelJsonSafe,
  sameQuestionCluster,
  type FunnelConversationInput,
  type MetricWindow,
  type PostChangeInput,
  type ReceiptTurnInput,
} from '@/lib/skills/detectors'
import { persistFindings, markClean } from '@/lib/skills/findings'
import type { FindingDraft } from '@/lib/skills/detectors'

const AGENT = { agentId: 'agent-1', workspaceId: 'ws-1', agentName: 'ایجنت تست' }

function turn(overrides: Partial<ReceiptTurnInput> & Pick<ReceiptTurnInput, 'messageId' | 'content' | 'receipts'>): ReceiptTurnInput {
  return {
    conversationId: 'conv-1',
    agentId: AGENT.agentId,
    workspaceId: AGENT.workspaceId,
    createdAt: new Date('2026-09-10T12:00:00Z'),
    userContent: 'شومیز دارین؟',
    ...overrides,
  }
}

describe('skills detectors — number and claim parsing', () => {
  it('parses Persian and Latin digits plus number words', () => {
    expect(parseFaNumber('۱۰')).toBe(10)
    expect(parseFaNumber('45')).toBe(45)
    expect(parseFaNumber('هشت')).toBe(8)
    expect(parseFaNumber('سه')).toBe(3)
    expect(parseFaNumber('xyz')).toBeNull()
  })

  it('reads the promised product count from Persian text', () => {
    expect(claimedProductCount('۱۰ محصول موجود و مرتبط پیدا کردم:')).toBe(10)
    expect(claimedProductCount('۸ مدل برات پیدا کردم')).toBe(8)
    expect(claimedProductCount('سه تا گزینه برات دارم')).toBe(3)
    expect(claimedProductCount('کدوم شال رو بیشتر میپسندی؟')).toBeNull()
  })

  it('ignores negative claims', () => {
    expect(claimedProductCount('متأسفانه ۲ مدل ناموجود شد')).toBeNull()
    expect(claimedProductCount('۴ مدل تمومش کردیم')).toBeNull()
  })

  it('counts numbered lists as promises', () => {
    const content = 'این‌ها رو ببین:\n1. شومیز آریا\n2. شومیز مروارید\n3. شومیز روناز'
    expect(claimedProductCount(content)).toBe(3)
  })
})

describe('skills detectors — tool failure investigator', () => {
  it('aggregates model_error receipts per agent with escalating severity', () => {
    const result = detectToolFailures([AGENT], [
      turn({ messageId: 'm1', content: 'متأسفانه خطایی رخ داد', receipts: [{ kind: 'model_error' }] }),
      turn({ messageId: 'm2', content: 'متأسفانه خطایی رخ داد', receipts: [{ kind: 'model_error' }] }),
    ], [])
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].skillKey).toBe('tool-failure')
    expect(result.findings[0].severity).toBe('MEDIUM')
    expect((result.findings[0].evidence as { count: number }).count).toBe(2)

    const high = detectToolFailures([AGENT], [
      turn({ messageId: 'm1', content: 'x', receipts: [{ kind: 'model_error' }] }),
      turn({ messageId: 'm2', content: 'x', receipts: [{ kind: 'model_error' }] }),
      turn({ messageId: 'm3', content: 'x', receipts: [{ kind: 'model_error' }] }),
    ], [])
    expect(high.findings[0].severity).toBe('HIGH')
  })

  it('marks agents clean when no model errors exist', () => {
    const result = detectToolFailures([AGENT], [], [])
    expect(result.findings).toHaveLength(0)
    expect(result.clean).toContain('tool:modelerror:agent-1')
  })

  it('flags the claimed-versus-delivered mismatch (the vitrine bug family)', () => {
    const result = detectToolFailures([AGENT], [
      turn({
        messageId: 'm10',
        content: 'این ۱۰ محصول رو برات پیدا کردم و همه موجوده:',
        receipts: [{ kind: 'products_presented', count: 1 }, { kind: 'catalog_checked', count: 12 }],
      }),
    ], [])
    const mismatch = result.findings.find((f) => f.dedupeKey === 'tool:countmismatch:agent-1')
    expect(mismatch).toBeDefined()
    expect(mismatch!.severity).toBe('HIGH')
    const evidence = mismatch!.evidence as { count: number; samples: Array<{ claimed: number; presented: number }> }
    expect(evidence.count).toBe(1)
    expect(evidence.samples[0].claimed).toBe(10)
    expect(evidence.samples[0].presented).toBe(1)
  })

  it('does not flag honest counts', () => {
    const result = detectToolFailures([AGENT], [
      turn({
        messageId: 'm11',
        content: '۱۰ محصول موجود و مرتبط پیدا کردم:',
        receipts: [{ kind: 'products_presented', count: 10 }, { kind: 'catalog_checked', count: 12 }],
      }),
    ], [])
    expect(result.findings.filter((f) => f.dedupeKey === 'tool:countmismatch:agent-1')).toHaveLength(0)
  })

  it('flags explicit showcase requests that showed no product', () => {
    const result = detectToolFailures([AGENT], [
      turn({
        messageId: 'm20',
        content: 'فعلاً موجود نیست.',
        userContent: 'شومیز دارین؟',
        receipts: [{ kind: 'catalog_checked', count: 12 }],
      }),
    ], [])
    const noshow = result.findings.find((f) => f.dedupeKey === 'tool:noshow:agent-1')
    expect(noshow).toBeDefined()
    expect((noshow!.evidence as { count: number }).count).toBe(1)
    expect(result.clean).not.toContain('tool:noshow:agent-1')
  })

  it('ignores catalog consultations without an explicit showcase request (vocabulary quirks)', () => {
    for (const userContent of ['واقعیه یانه کلاه برداری نباشه', 'خرید از اینجا', 'هزینه ارسال چقدره؟']) {
      const result = detectToolFailures([AGENT], [
        turn({ messageId: 'm21', content: 'بله فروشگاه معتبر است.', userContent, receipts: [{ kind: 'catalog_checked', count: 3 }] }),
      ], [])
      expect(result.findings.filter((f) => f.dedupeKey === 'tool:noshow:agent-1')).toHaveLength(0)
      expect(result.clean).toContain('tool:noshow:agent-1')
    }
  })

  it('surfaces pending TOOL suggestions for the platform owner', () => {
    const result = detectToolFailures([AGENT], [], [{
      suggestionId: 's1', agentId: AGENT.agentId, workspaceId: AGENT.workspaceId,
      title: 'ویترین فقط ۱ کارت فرستاد', diagnosis: 'توصیف ۸ محصول اما ۱ کارت.', evidenceConversations: 2,
    }])
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].dedupeKey).toBe('tool:pending:s1')
  })
})

describe('skills detectors — knowledge gap curator', () => {
  it('aggregates unanswered questions per agent', () => {
    const result = detectKnowledgeGaps([{
      agentId: AGENT.agentId,
      workspaceId: AGENT.workspaceId,
      agentName: AGENT.agentName,
      unanswered: [
        { messageId: 'u1', conversationId: 'c1', content: 'این کت آب نمی‌خوره؟', createdAt: new Date() },
        { messageId: 'u2', conversationId: 'c2', content: 'سایز ۴۵ دارید؟', createdAt: new Date() },
      ],
      pendingKnowledge: [],
      unresolvedReviews: 3,
    }])
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].severity).toBe('MEDIUM')
    expect(result.findings[0].diagnosis).toContain('این کت آب نمی‌خوره؟')
    expect(result.clean).toHaveLength(0)
  })

  it('escalates to HIGH at eight unanswered messages and reports pending knowledge', () => {
    const unanswered = Array.from({ length: 8 }, (_, i) => ({
      messageId: `u${i}`, conversationId: `c${i}`, content: `سوال ${i}`, createdAt: new Date(),
    }))
    const result = detectKnowledgeGaps([{
      agentId: AGENT.agentId, workspaceId: AGENT.workspaceId, unanswered, pendingKnowledge: [],
      unresolvedReviews: 0,
    }, {
      agentId: 'agent-2', workspaceId: AGENT.workspaceId, unanswered: [],
      pendingKnowledge: [{
        suggestionId: 's2', topicKey: 'return policy', title: 'سیاست مرجوعی نامشخص',
        diagnosis: 'مشتری پرسید و پاسخی نبود.', draftQuestion: 'مرجوعی چطور است؟',
        draftAnswer: 'تا ۷ روز قابل مرجوع است.', evidenceConversations: 4,
      }],
      unresolvedReviews: 0,
    }])
    expect(result.findings.find((f) => f.dedupeKey === 'gap:unanswered:agent-1')?.severity).toBe('HIGH')
    expect(result.clean).toContain('gap:unanswered:agent-2')
    const kb = result.findings.find((f) => f.dedupeKey === 'gap:kb:s2')
    expect(kb).toBeDefined()
    expect((kb!.evidence as { evidenceConversations: number }).evidenceConversations).toBe(4)
    expect(kb!.severity).toBe('HIGH')
  })
})

describe('skills detectors — post-change monitor and before/after evaluation', () => {
  const baseWindow: MetricWindow = { reviews: 5, resolved: 4, userMessages: 50, unanswered: 5, assistantMessages: 50, modelErrors: 1 }

  function change(overrides: Partial<PostChangeInput> & Pick<PostChangeInput, 'changeId' | 'reviewsAfter'>): PostChangeInput {
    return {
      suggestionId: 'sg1', agentId: AGENT.agentId, workspaceId: AGENT.workspaceId, agentName: AGENT.agentName,
      kind: 'KNOWLEDGE', topicKey: 'حالت شومیز', title: 'مسیر شومیز اصلاح شد',
      appliedAt: new Date('2026-09-01T00:00:00Z'),
      before: baseWindow, after: baseWindow,
      ...overrides,
    }
  }

  it('flags a recurrence of the same topic after the fix', () => {
    const result = detectPostChanges([change({
      changeId: 'ch1',
      reviewsAfter: [{
        reviewId: 'r1', conversationId: 'cv1', createdAt: new Date('2026-09-05T00:00:00Z'),
        topics: [{ kind: 'KNOWLEDGE', topicKey: 'حالت شومیز' }],
      }],
    })])
    const finding = result.findings.find((f) => f.dedupeKey === 'fix:ch1')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('MEDIUM')
    expect(finding!.title).toContain('تکرار مشکل')
  })

  it('auto-closes the guard finding when reviews after the fix are clean', () => {
    const result = detectPostChanges([change({
      changeId: 'ch2',
      reviewsAfter: [
        { reviewId: 'r1', conversationId: 'cv1', createdAt: new Date('2026-09-05T00:00:00Z'), topics: [{ kind: 'BEHAVIOR', topicKey: 'موضوع دیگر' }] },
        { reviewId: 'r2', conversationId: 'cv2', createdAt: new Date('2026-09-06T00:00:00Z'), topics: [] },
      ],
    })])
    expect(result.findings.filter((f) => f.dedupeKey === 'fix:ch2')).toHaveLength(0)
    expect(result.clean).toContain('fix:ch2')
  })

  it('reports a resolution-rate regression with numbers', () => {
    const result = detectPostChanges([change({
      changeId: 'ch3',
      reviewsAfter: [],
      before: { ...baseWindow, reviews: 10, resolved: 8 },
      after: { ...baseWindow, reviews: 10, resolved: 5 },
    })])
    const finding = result.findings.find((f) => f.dedupeKey === 'ba:ch3:resolution')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('HIGH')
    expect(finding!.title).toContain('افت نرخ حل گفتگو')
  })

  it('records a confirmed improvement as an already-resolved finding', () => {
    const result = detectPostChanges([change({
      changeId: 'ch4',
      reviewsAfter: [],
      before: { ...baseWindow, reviews: 10, resolved: 5 },
      after: { ...baseWindow, reviews: 10, resolved: 8 },
    })])
    const finding = result.findings.find((f) => f.dedupeKey === 'ba:ch4:resolution')
    expect(finding).toBeDefined()
    expect(finding!.initialStatus).toBe('RESOLVED')
    expect(finding!.title).toContain('بهبود تأیید شد')
  })

  it('flags unanswered-rate regressions only with enough volume', () => {
    const make = (before: MetricWindow, after: MetricWindow) => detectPostChanges([change({ changeId: 'ch5', reviewsAfter: [], before, after })])
      .findings.find((f) => f.dedupeKey === 'ba:ch5:unanswered')
    expect(make(
      { ...baseWindow, userMessages: 50, unanswered: 5 },
      { ...baseWindow, userMessages: 50, unanswered: 20 },
    )).toBeDefined()
    expect(make(
      { ...baseWindow, userMessages: 10, unanswered: 1 },
      { ...baseWindow, userMessages: 10, unanswered: 4 },
    )).toBeUndefined()
  })
})

describe('skills detectors — customer preference guard', () => {
  const contact = (preferences: Array<{ id: string; text: string; createdAt: Date }>, messages: Array<{ messageId: string; content: string; createdAt: Date }>) => ({
    contactId: 'ct1', workspaceId: AGENT.workspaceId, agentId: AGENT.agentId, contactName: 'مشتری',
    preferences,
    productMessages: messages.map((m) => ({ messageId: m.messageId, conversationId: 'cv9', content: m.content, createdAt: m.createdAt })),
  })
  const prefDate = new Date('2026-09-01T00:00:00Z')
  const later = new Date('2026-09-09T00:00:00Z')

  it('detects a color preference violation', () => {
    const result = detectPreferenceViolations([contact(
      [{ id: 'p1', text: 'فقط خاکستری می‌خوام', createdAt: prefDate }],
      [{ messageId: 'pm1', content: '[[product:{"title":"شومیز صورتی مدل ۰۳۷۸"}]]', createdAt: later }],
    )])
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].severity).toBe('MEDIUM')
    expect(result.findings[0].title).toContain('فقط خاکستری')
  })

  it('accepts recommendations honoring the preference', () => {
    const result = detectPreferenceViolations([contact(
      [{ id: 'p1', text: 'فقط خاکستری می‌خوام', createdAt: prefDate }],
      [{ messageId: 'pm1', content: '[[product:{"title":"شومیز خاکستری مدل ۰۳۷۸"}]]', createdAt: later }],
    )])
    expect(result.findings).toHaveLength(0)
  })

  it('detects excluded colors and sizes', () => {
    const result = detectPreferenceViolations([contact(
      [
        { id: 'p1', text: 'بدون صورتی لطفاً', createdAt: prefDate },
        { id: 'p2', text: 'فقط سایز ۴۵', createdAt: prefDate },
      ],
      [{ messageId: 'pm1', content: 'شومیز صورتی — سایز ۴۰ موجود است', createdAt: later }],
    )])
    expect(result.findings).toHaveLength(2)
  })

  it('ignores messages sent before the preference existed', () => {
    const result = detectPreferenceViolations([contact(
      [{ id: 'p1', text: 'فقط خاکستری می‌خوام', createdAt: later }],
      [{ messageId: 'pm1', content: 'شومیز صورتی', createdAt: prefDate }],
    )])
    expect(result.findings).toHaveLength(0)
  })
})

describe('skills detectors — DEEP normalizers', () => {
  it('parses fenced model JSON safely', () => {
    expect(parseModelJsonSafe('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseModelJsonSafe('not json')).toBeNull()
  })

  it('keeps only evidence-backed tone issues', () => {
    const findings = normalizeToneReview({
      issues: [
        { type: 'tone', title: 'جواب سرد', diagnosis: 'پاسخ بدون همدلی بود.', messageIds: ['a1'], suggestion: 'با همدلی شروع کن.', severity: 'HIGH', behaviorPath: 'conversation.empathy', behaviorValue: 'warm' },
        { type: 'tone', title: 'هیچ', diagnosis: 'بدون شاهد.', messageIds: ['zzz'], severity: 'LOW' },
      ],
    }, {
      agentId: AGENT.agentId, workspaceId: AGENT.workspaceId, conversationId: 'cv1',
      transcriptMessageIds: new Set(['a1', 'a2']),
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('HIGH')
    expect(findings[0].suggestedAction).toMatchObject({ type: 'behavior_hint', path: 'conversation.empathy' })
  })

  it('keeps only conflicts referencing real sources', () => {
    const sources = new Map([
      ['k1', { question: 'ارسال چند روزه است؟', answer: '۳ روز', name: 'KB1' }],
      ['k2', { question: 'ارسال چند روز طول می‌کشد؟', answer: '۵ روز', name: 'KB2' }],
    ])
    const findings = normalizeKnowledgeConflicts({
      conflicts: [
        { aId: 'k1', bId: 'k2', explanation: 'مدت ارسال متفاوت است.', correctHint: 'مدت واقعی را تأیید کنید.' },
        { aId: 'k1', bId: 'nope', explanation: 'x' },
      ],
    }, { agentId: AGENT.agentId, workspaceId: AGENT.workspaceId, sources })
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('HIGH')
    expect(findings[0].diagnosis).toContain('۳ روز')
    expect(findings[0].diagnosis).toContain('۵ روز')
  })

  it('pairs equivalent questions and skips unrelated ones', () => {
    const pairs = candidateConflictPairs([
      { id: 'a', question: 'ارسال چند روزه است؟', answer: '۳' },
      { id: 'b', question: 'ارسال چند روزه است', answer: '۵' },
      { id: 'c', question: 'رنگ‌بندی شومیز چی دارید؟', answer: 'x' },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].aId).toBe('a')
    expect(pairs[0].bId).toBe('b')
  })
})

describe('skills detectors — v1.1.0 upgrades (knowledge gap, tool failure, conflicts)', () => {
  it('clusters the same unanswered question across conversations into a recurring gap', () => {
    const result = detectKnowledgeGaps([{
      agentId: AGENT.agentId,
      workspaceId: AGENT.workspaceId,
      unanswered: [
        { messageId: 'u1', conversationId: 'c1', content: 'ساعت کاری شماره رو می دید؟', createdAt: new Date() },
        { messageId: 'u2', conversationId: 'c2', content: 'ساعات کاری‌تون چیه؟', createdAt: new Date() },
        { messageId: 'u3', conversationId: 'c3', content: 'قیمت ارسال چقدر می شه؟', createdAt: new Date() },
      ],
      pendingKnowledge: [],
      unresolvedReviews: 0,
    }])
    const recurring = result.findings.find((f) => f.dedupeKey.startsWith('gap:recurring:'))
    expect(recurring).toBeDefined()
    expect((recurring!.evidence as { conversations: string[] }).conversations).toHaveLength(2)
    expect(recurring!.severity).toBe('MEDIUM')
    expect(recurring!.title).toContain('تماس و ساعات کاری')
  })

  it('escalates to HIGH when a recurring gap spans three conversations', () => {
    const result = detectKnowledgeGaps([{
      agentId: AGENT.agentId,
      workspaceId: AGENT.workspaceId,
      unanswered: [
        { messageId: 'u1', conversationId: 'c1', content: 'مرجوعی دارید؟', createdAt: new Date() },
        { messageId: 'u2', conversationId: 'c2', content: 'مرجوعی می کنید؟', createdAt: new Date() },
        { messageId: 'u3', conversationId: 'c3', content: 'امکان مرجوعی هست؟', createdAt: new Date() },
      ],
      pendingKnowledge: [],
      unresolvedReviews: 0,
    }])
    const recurring = result.findings.find((f) => f.dedupeKey.startsWith('gap:recurring:'))
    expect(recurring).toBeDefined()
    expect(recurring!.severity).toBe('HIGH')
  })

  it('classifies unanswered questions into business categories', () => {
    expect(categorizeQuestion('هزینه ارسال چقدره؟').key).toBe('delivery')
    expect(categorizeQuestion('قیمت نهایی می شه چند؟').key).toBe('price')
    expect(categorizeQuestion('سایز ۴۴ دارید؟').key).toBe('sizing')
    expect(categorizeQuestion('سلام حالتون چطوره؟').key).toBe('other')
  })

  it('marks a HIGH severity via the unanswered RATE on thin traffic', () => {
    const result = detectKnowledgeGaps([{
      agentId: AGENT.agentId,
      workspaceId: AGENT.workspaceId,
      totalUserMessages: 24,
      unanswered: [
        { messageId: 'u1', conversationId: 'c1', content: 'الف سوال؟', createdAt: new Date() },
        { messageId: 'u2', conversationId: 'c2', content: 'دیگری سوال؟', createdAt: new Date() },
        { messageId: 'u3', conversationId: 'c3', content: 'سومین سوال؟', createdAt: new Date() },
      ],
      pendingKnowledge: [],
      unresolvedReviews: 0,
    }])
    expect(result.findings[0].severity).toBe('HIGH') // 3/24 = 12.5% unanswered
  })

  it('clusters near-identical questions but keeps different questions apart', () => {
    expect(sameQuestionCluster('ساعت کاری شماره رو می دید؟', 'ساعات کاری‌تون چیه؟')).toBe(true)
    expect(sameQuestionCluster('رنگ این شومیز چیه؟', 'ساعت کاری چند است؟')).toBe(false)
  })

  it('flags stock claims that were never grounded in catalog or knowledge', () => {
    const result = detectToolFailures([AGENT], [
      turn({
        messageId: 'm30',
        content: 'این محصول موجود است و می‌تونید سفارش بدید.',
        receipts: [],
        userContent: 'این کالا موجوده؟',
      }),
    ], [])
    const finding = result.findings.find((f) => f.dedupeKey === 'tool:stockground:agent-1')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('MEDIUM')
  })

  it('does not flag stock claims when the conversation consulted the catalog earlier', () => {
    const result = detectToolFailures([AGENT], [
      turn({ messageId: 'm31', content: 'سه مدل برات پیدا کردم', receipts: [{ kind: 'catalog_checked', count: 8 }] }),
      turn({ messageId: 'm32', content: 'همه‌شون موجود هستند.', receipts: [] }),
    ], [])
    expect(result.findings.filter((f) => f.dedupeKey === 'tool:stockground:agent-1')).toHaveLength(0)
    expect(result.clean).toContain('tool:stockground:agent-1')
  })

  it('flags promised handoffs that never happened', () => {
    const result = detectToolFailures([AGENT], [
      turn({
        messageId: 'm40',
        content: 'گفتگو را به اپراتور منتقل می‌کنم تا با شما تماس بگیرد.',
        receipts: [],
        userContent: 'با آدم واقعی حرف بزنم',
      }),
    ], [], { 'conv-1': false })
    const finding = result.findings.find((f) => f.dedupeKey === 'tool:handoff:agent-1')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('MEDIUM')
  })

  it('does not flag promised handoffs when the conversation WAS handed off', () => {
    const result = detectToolFailures([AGENT], [
      turn({ messageId: 'm41', content: 'کارشناس ما در تماس می‌شود.', receipts: [] }),
    ], [], { 'conv-1': true })
    expect(result.findings.filter((f) => f.dedupeKey === 'tool:handoff:agent-1')).toHaveLength(0)
    expect(result.clean).toContain('tool:handoff:agent-1')
  })

  it('prioritizes numeric-mismatch knowledge pairs over vague topical pairs', () => {
    const pairs = candidateConflictPairs([
      { id: 'same-words', question: 'ارسال چند روزه است؟', answer: '۳ روز' },
      { id: 'same-words-2', question: 'ارسال چند روزه است', answer: '۵ روز' },
      { id: 'numeric-diff', question: 'هزینه ارسال به تهران؟', answer: '۴۵ هزار تومان' },
      { id: 'numeric-diff-2', question: 'هزینه ارسال به تهران چقدر است؟', answer: '۶۰ هزار تومان' },
    ], 2)
    expect(pairs).toHaveLength(2)
    // Both selected pairs should be numeric-mismatch pairs (score 3).
    const numericPairIds = new Set(['numeric-diff', 'numeric-diff-2', 'same-words', 'same-words-2'])
    for (const pair of pairs) expect(numericPairIds.has(pair.aId)).toBe(true)
  })
})

describe('skills detectors — funnel guard (v1.0.0)', () => {
  const t = (minutes: number) => new Date(`2026-09-10T12:${String(minutes).padStart(2, '0')}:00Z`)

  function conversation(overrides: Partial<FunnelConversationInput> & Pick<FunnelConversationInput, 'conversationId' | 'messages'>): FunnelConversationInput {
    return {
      agentId: AGENT.agentId,
      workspaceId: AGENT.workspaceId,
      handedOff: false,
      ...overrides,
    }
  }

  it('flags a strong buy intent that got no link, card or handoff', () => {
    const result = detectFunnelStalls([AGENT], [conversation({
      conversationId: 'cv1',
      messages: [
        { messageId: 'm1', role: 'USER', createdAt: t(0), content: 'این شومیز رو برام ثبت کن' },
        { messageId: 'm2', role: 'ASSISTANT', createdAt: t(1), content: 'فعلاً امکان ثبت سفارش در چت فعال نیست.', receipts: [] },
      ],
    })])
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].skillKey).toBe('funnel-guard')
    expect(result.findings[0].severity).toBe('MEDIUM') // 1 strong intent
    expect(result.findings[0].diagnosis).toContain('برام ثبت کن')
  })

  it('treats a shared link after the intent as a funnel exit (no finding)', () => {
    const result = detectFunnelStalls([AGENT], [conversation({
      conversationId: 'cv2',
      messages: [
        { messageId: 'm1', role: 'USER', createdAt: t(0), content: 'می‌خوام بخرمش' },
        { messageId: 'm2', role: 'ASSISTANT', createdAt: t(1), content: 'برای خرید از این لینک وارد شوید: https://shop.example.com/p/1', receipts: [{ kind: 'link_shared' }] },
      ],
    })])
    expect(result.findings.filter((f) => f.dedupeKey === 'funnel:stall:agent-1')).toHaveLength(0)
    expect(result.clean).toContain('funnel:stall:agent-1')
  })

  it('does not flag cards shown before the intent, only exits after it', () => {
    const result = detectFunnelStalls([AGENT], [conversation({
      conversationId: 'cv3',
      messages: [
        { messageId: 'm1', role: 'USER', createdAt: t(0), content: 'شومیز دارید؟' },
        { messageId: 'm2', role: 'ASSISTANT', createdAt: t(1), content: 'این کارت‌ها را ببینید', receipts: [{ kind: 'products_presented', count: 3 }] },
        { messageId: 'm3', role: 'USER', createdAt: t(2), content: 'قیمت نهایی چنده؟' },
        { messageId: 'm4', role: 'ASSISTANT', createdAt: t(3), content: '۲۵۰ هزار تومان.', receipts: [] },
      ],
    })])
    const finding = result.findings.find((f) => f.dedupeKey === 'funnel:stall:agent-1')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('LOW') // 1 mild intent
  })

  it('skips handed-off conversations entirely', () => {
    const result = detectFunnelStalls([AGENT], [conversation({
      conversationId: 'cv4',
      handedOff: true,
      messages: [
        { messageId: 'm1', role: 'USER', createdAt: t(0), content: 'می‌خوام بخرم' },
        { messageId: 'm2', role: 'ASSISTANT', createdAt: t(1), content: 'انتقال می‌دهم به اپراتور', receipts: [] },
      ],
    })])
    expect(result.findings.filter((f) => f.agentId === AGENT.agentId)).toHaveLength(0)
  })

  it('escalates to HIGH when two or more strong intents stalled', () => {
    const result = detectFunnelStalls([AGENT], [
      conversation({
        conversationId: 'cv5',
        messages: [{ messageId: 'm1', role: 'USER', createdAt: t(0), content: 'برام رزروش کن' }],
      }),
      conversation({
        conversationId: 'cv6',
        messages: [{ messageId: 'm2', role: 'USER', createdAt: t(2), content: 'می‌خوام سفارش ثبت کنم' }],
      }),
    ])
    const finding = result.findings.find((f) => f.dedupeKey === 'funnel:stall:agent-1')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('HIGH')
    expect((finding!.evidence as { strongCount: number }).strongCount).toBe(2)
  })

  it('counts an operator reply after the intent as a funnel exit', () => {
    const result = detectFunnelStalls([AGENT], [conversation({
      conversationId: 'cv7',
      messages: [
        { messageId: 'm1', role: 'USER', createdAt: t(0), content: 'برام ثبتش کن' },
        { messageId: 'm2', role: 'ASSISTANT', createdAt: t(1), content: 'سلام، اپراتور هستم؛ برای سفارش کمکتون می‌کنم.', receipts: [], operator: true },
      ],
    })])
    expect(result.findings.filter((f) => f.dedupeKey === 'funnel:stall:agent-1')).toHaveLength(0)
  })

  it('ignores conversations without any buy intent', () => {
    const result = detectFunnelStalls([AGENT], [conversation({
      conversationId: 'cv8',
      messages: [
        { messageId: 'm1', role: 'USER', createdAt: t(0), content: 'رنگ‌بندی این مدل چیه؟' },
        { messageId: 'm2', role: 'ASSISTANT', createdAt: t(1), content: 'مشکی و کرم داریم.', receipts: [{ kind: 'catalog_checked', count: 2 }] },
      ],
    })])
    expect(result.clean).toContain('funnel:stall:agent-1')
  })
})

describe('skills detectors — before/after funnel metrics (v1.1.0)', () => {
  const window: MetricWindow = { reviews: 10, resolved: 8, userMessages: 60, unanswered: 6, assistantMessages: 60, modelErrors: 2, productCards: 30, orderLinks: 18 }

  function change(overrides: Partial<PostChangeInput> & Pick<PostChangeInput, 'changeId' | 'before' | 'after'>): PostChangeInput {
    return {
      suggestionId: 'sg2', agentId: AGENT.agentId, workspaceId: AGENT.workspaceId, agentName: AGENT.agentName,
      kind: 'BEHAVIOR', topicKey: 'لحن پاسخ', title: 'لحن گرم‌تر شد',
      appliedAt: new Date('2026-09-01T00:00:00Z'),
      reviewsAfter: [],
      ...overrides,
    }
  }

  it('reports an order-link rate drop after a change', () => {
    const result = detectPostChanges([change({
      changeId: 'ch6',
      before: window,
      after: { ...window, orderLinks: 0 },
    })])
    const finding = result.findings.find((f) => f.dedupeKey === 'ba:ch6:orderlink')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('MEDIUM')
    expect(finding!.title).toContain('نرخ ارسال لینک سفارش')
  })

  it('records a showcase-rate improvement as a resolved confirmation', () => {
    const result = detectPostChanges([change({
      changeId: 'ch7',
      before: { ...window, productCards: 6 },
      after: window,
    })])
    const finding = result.findings.find((f) => f.dedupeKey === 'ba:ch7:showcase')
    expect(finding).toBeDefined()
    expect(finding!.initialStatus).toBe('RESOLVED')
  })

  it('requires assistant volume before judging funnel metrics', () => {
    const result = detectPostChanges([change({
      changeId: 'ch8',
      before: { ...window, assistantMessages: 10, orderLinks: 9 },
      after: { ...window, assistantMessages: 10, orderLinks: 0 },
    })])
    expect(result.findings.find((f) => f.dedupeKey === 'ba:ch8:orderlink')).toBeUndefined()
  })
})

describe('skills detectors — tone coach nextstep type (v1.1.0)', () => {
  it('normalizes nextstep issues with the right label', () => {
    const findings = normalizeToneReview({
      issues: [
        { type: 'nextstep', title: 'خرید بدون لینک', diagnosis: 'مشتری گفت می‌خواد بخرم اما پاسخ لینکی نداد.', messageIds: ['a1'], suggestion: 'همان جواب + لینک محصول.', severity: 'HIGH' },
      ],
    }, {
      agentId: AGENT.agentId, workspaceId: AGENT.workspaceId, conversationId: 'cv1',
      transcriptMessageIds: new Set(['a1']),
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].title).toContain('قدم بعدی')
    expect(findings[0].severity).toBe('HIGH')
  })
})

// ─── Store semantics against PostgreSQL (opt-in, disposable fixtures) ───────

describe.skipIf(process.env.RUN_SKILLS_DB_TESTS !== '1')('skills findings store semantics', () => {
  let workspaceId: string, agentId: string, conversationId: string

  beforeAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    const tag = crypto.randomUUID()
    const workspace = await prisma.workspace.create({ data: { name: 'Skills test', slug: `skills-test-${tag}`, excludeFromAdminReports: true } })
    workspaceId = workspace.id
    const agent = await prisma.agent.create({ data: { workspaceId, name: 'Skills tester', active: false, systemPrompt: 'x' } })
    agentId = agent.id
    const conversation = await prisma.conversation.create({ data: { workspaceId, agentId, channel: 'API', lastMessageAt: new Date(), messageCount: 0 } })
    conversationId = conversation.id
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  it('creates once, refreshes with occurrences, reopens after resolution, and auto-cleans', async () => {
    const draft: FindingDraft = {
      skillKey: 'tool-failure',
      dedupeKey: `test:${agentId}`,
      workspaceId,
      agentId,
      conversationId,
      severity: 'MEDIUM',
      title: 'خطای تست',
      diagnosis: 'شرح اول',
      seenAt: new Date(),
    }
    const first = await persistFindings([draft])
    expect(first.created).toBe(1)

    const second = await persistFindings([{ ...draft, diagnosis: 'شرح دوم', severity: 'LOW' }])
    expect(second.updated).toBe(1)
    const { prisma } = await import('@/lib/prisma')
    const stored = await prisma.skillFinding.findUniqueOrThrow({ where: { skillKey_dedupeKey: { skillKey: draft.skillKey, dedupeKey: draft.dedupeKey } } })
    expect(stored.occurrences).toBe(2)
    expect(stored.severity).toBe('MEDIUM') // never downgraded while open
    expect(stored.diagnosis).toBe('شرح دوم')

    const resolvedCount = await markClean('tool-failure', [draft.dedupeKey], 'خودکار: تست')
    expect(resolvedCount).toBe(1)
    const closed = await prisma.skillFinding.findUniqueOrThrow({ where: { skillKey_dedupeKey: { skillKey: draft.skillKey, dedupeKey: draft.dedupeKey } } })
    expect(closed.status).toBe('RESOLVED')
    expect(closed.resolvedNote).toBe('خودکار: تست')

    // The problem comes back after the recorded fix → reopen.
    const third = await persistFindings([{ ...draft, severity: 'HIGH' }])
    expect(third.reopened).toBe(1)
    const reopened = await prisma.skillFinding.findUniqueOrThrow({ where: { skillKey_dedupeKey: { skillKey: draft.skillKey, dedupeKey: draft.dedupeKey } } })
    expect(reopened.status).toBe('OPEN')
    expect(reopened.severity).toBe('HIGH')
  })

  it('keeps positive confirmations resolved across re-detections', async () => {
    const { prisma } = await import('@/lib/prisma')
    const draft: FindingDraft = {
      skillKey: 'before-after',
      dedupeKey: `test-positive:${agentId}`,
      workspaceId,
      agentId,
      severity: 'LOW',
      initialStatus: 'RESOLVED',
      title: 'بهبود تأیید شد',
      diagnosis: 'نرخ حل بهتر شده.',
      seenAt: new Date(),
    }
    await persistFindings([draft])
    // Re-detect twice — must never reopen.
    await persistFindings([{ ...draft, diagnosis: 'همچنان بهتر است.' }])
    await persistFindings([{ ...draft }])
    const stored = await prisma.skillFinding.findUniqueOrThrow({ where: { skillKey_dedupeKey: { skillKey: draft.skillKey, dedupeKey: draft.dedupeKey } } })
    expect(stored.status).toBe('RESOLVED')
    expect(stored.resolvedNote).toBe('خودکار: بهبود در پنجرهٔ بعدی تأیید شد')
    expect(stored.occurrences).toBe(1) // lastSeen-only refresh, no occurrence inflation
  })
})
