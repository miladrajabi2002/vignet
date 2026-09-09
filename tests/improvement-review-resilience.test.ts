import { describe, expect, it } from 'vitest'
import { handoffKnowledgeConflictFindings } from '@/lib/improvement/routing-conflicts'
import { normalizeReviewResult } from '@/lib/improvement/types'

describe('conversation review resilience', () => {
  it('keeps valid evidence-backed findings when another model finding is malformed', () => {
    const result = normalizeReviewResult({
      intent: 'پیگیری خرید عمده',
      intentMessageIds: ['user-1'],
      outcome: 'UNRESOLVED',
      outcomeMessageIds: ['invented'],
      summary: 'دانش مرتبط استفاده نشد.',
      strengths: [{ title: 'پاسخ محترمانه بود', messageIds: ['assistant-1'] }],
      findings: [
        {
          kind: 'TOOL', scope: 'AGENT', topicKey: 'handoff routing', title: 'اصلاح مسیر انتقال',
          diagnosis: 'انتقال زودهنگام بود.', priority: 'HIGH', messageIds: ['user-1'], draft: {},
        },
        {
          kind: 'BEHAVIOR', scope: 'AGENT', topicKey: 'bad behavior', title: 'مقدار نامعتبر',
          diagnosis: 'نباید کل review را خراب کند.', priority: 'HIGH', messageIds: ['invented'],
          draft: { behaviorPath: 'not-supported', behaviorValue: 'x' },
        },
      ],
    }, {
      messageIds: new Set(['user-1', 'assistant-1']),
      knowledgeIds: new Set(),
      hasCustomerMessages: true,
    })

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].topicKey).toBe('handoff routing')
    expect(result.outcome).toBe('UNKNOWN')
    expect(result.outcomeMessageIds).toEqual([])
    expect(result.strengths).toEqual([{ title: 'پاسخ محترمانه بود', messageIds: ['assistant-1'] }])
  })

  it('suggests reviewing a handoff keyword when ready knowledge for the same topic existed', () => {
    const findings = handoffKnowledgeConflictFindings({
      language: 'fa',
      messages: [
        { id: 'user-1', role: 'USER', content: 'شما عمده کار نمی‌کنید؟' },
        { id: 'assistant-1', role: 'ASSISTANT', content: 'شما را به کارشناس انسانی متصل می‌کنم.' },
      ],
      seenMessageIds: new Set(['user-1', 'assistant-1']),
      handoffKeywords: ['اپراتور', 'عمده'],
      handoffReasons: ['کلمه کلیدی تنظیم‌شده: عمده'],
      sources: [{ id: 'kb-1', name: 'فروش عمده', chunks: [{ content: 'برای فروش عمده با پشتیبانی تماس بگیرید.' }] }],
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'TOOL', priority: 'HIGH', messageIds: ['user-1', 'assistant-1'] })
    expect(findings[0].diagnosis).toContain('دانش آمادهٔ مرتبط')
    expect(findings[0].draft.missing).toContain('کلیدواژهٔ انتقال «عمده»')
  })

  it('does not infer a routing conflict without a recorded keyword handoff', () => {
    const findings = handoffKnowledgeConflictFindings({
      language: 'fa',
      messages: [{ id: 'user-1', role: 'USER', content: 'فروش عمده دارید؟' }],
      seenMessageIds: new Set(['user-1']),
      handoffKeywords: ['عمده'],
      handoffReasons: ['درخواست صریح کاربر برای اپراتور'],
      sources: [{ id: 'kb-1', name: 'فروش عمده', chunks: [{ content: 'فروش عمده فعال است.' }] }],
    })

    expect(findings).toEqual([])
  })
})
