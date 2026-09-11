import 'dotenv/config'
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  candidateConflictPairs,
  claimedProductCount,
  detectKnowledgeGaps,
  detectPostChanges,
  detectPreferenceViolations,
  detectToolFailures,
  normalizeKnowledgeConflicts,
  normalizeToneReview,
  parseFaNumber,
  parseModelJsonSafe,
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
