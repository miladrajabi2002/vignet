import { describe, expect, it } from 'vitest'
import { verifyUnderstanding } from '@/lib/agent/understand/verify'
import { routeFromUnderstanding } from '@/lib/agent/turn/route'
import { createEmptyConversationWorkingState } from '@/lib/ai/conversation-state'
import type { Act, TurnCandidates, TurnUnderstanding } from '@/lib/agent/understand/types'

// Sunday 2026-10-04 (12 Mehr 1405) in Tehran.
const now = new Date('2026-10-04T08:00:00.000Z')

const candidates: TurnCandidates = {
  capabilities: ['bookings', 'handoff'], pending: null, task: null, shownCards: [], cart: [], active: null, seen: [],
  services: [{ ref: 'svc:1', id: 'کوتاهی مو', name: 'کوتاهی مو' }], courses: [], vocabulary: [], categories: [],
}

function run(message: string, act: Act, recentText = '') {
  const understanding: TurnUnderstanding = {
    v: 1, language: 'fa', relation: 'new_goal', acts: [act], answersPending: false,
    customer: { mood: 'neu', buy: 2, cues: [] }, confidence: 0.9,
  }
  const verified = verifyUnderstanding({ understanding, candidates, message, recentText, vocabulary: new Set() })
  const route = routeFromUnderstanding({ verified, candidates, message, state: createEmptyConversationWorkingState('s'), lang: 'fa', now })
  return { verified, route }
}

describe('booking dates through verify → route', () => {
  it('«پسفدا عصر» (typo) → the exact day and the evening window in the hint and state', () => {
    const { route } = run('پسفدا عصر برای کوتاهی مو وقت دارید؟', { type: 'booking', action: 'inquire', service: 'svc:1', date: 'پس‌فردا', time: 'عصر' })
    expect(route.booking?.hint).toContain('کوتاهی مو')
    expect(route.booking?.hint).toContain('(2026-10-06)')
    expect(route.booking?.hint).toContain('عصر (16:00 تا 19:00)')
    expect(route.stateTurn?.slots).toMatchObject({ date: '2026-10-06', time: 'عصر' })
  })

  it('a normalized spoken time becomes a clock time', () => {
    const { route } = run('یکشنبه هفته بعد یه ربع به شش', { type: 'booking', action: 'book', date: 'یکشنبه هفته بعد', time: '17:45' })
    expect(route.stateTurn?.slots).toMatchObject({ date: '2026-10-11', time: '17:45' })
  })

  it('falls back to the customer message when the model left the day out', () => {
    const { route } = run('۱۵ مهر ساعت ۱۰ و نیم صبح', { type: 'booking', action: 'book' })
    expect(route.stateTurn?.slots).toMatchObject({ date: '2026-10-07', time: '10:30' })
  })

  it('drops a day the customer never said', () => {
    const { verified, route } = run('برای کوتاهی مو وقت دارید؟', { type: 'booking', action: 'inquire', service: 'svc:1', date: 'شنبه' })
    expect(verified.acts[0]).not.toHaveProperty('date')
    expect(verified.notes.map((note) => note.code)).toContain('DATE_NOT_IN_EVIDENCE')
    expect(route.stateTurn?.slots?.date).toBeUndefined()
  })

  it('keeps a day mentioned earlier in the conversation', () => {
    const { verified } = run('ساعت ۵ خوبه', { type: 'booking', action: 'book', date: '۱۵ مهر', time: '17:00' }, 'مشتری: ۱۵ مهر وقت دارید؟')
    expect(verified.acts[0]).toMatchObject({ date: '۱۵ مهر' })
  })
})
