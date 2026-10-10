/**
 * Satisfaction follows the outcome of the conversation. «ناراضی» is kept for
 * a customer who showed friction nobody has dealt with; a problem that an
 * operator answered, the customer called solved, or the conversation moved
 * past is not dissatisfaction. The threads below are real ones (2026-10).
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyzeSalesConversation, frictionOutcome, type SalesConversationMessage } from '@/lib/ai/sales-intelligence'
import { DISSATISFIED_BELOW, SATISFIED_FROM, satisfactionBucket, settleSatisfaction, turnSatisfaction } from '@/lib/ai/turn-signal'
import { SatisfactionText } from '@/components/crm/sales-insight'

const user = (content: string, understanding?: { mood: string; cues?: string[]; acts?: string[] }): SalesConversationMessage => ({
  role: 'USER',
  content,
  ...(understanding ? { metadata: { understanding: { v: 1, buy: 0, cues: [], acts: [], confidence: 0.9, ...understanding } } } : {}),
})
const agent = (content: string, signal?: { mood?: string; answered?: string; cues?: string[] }): SalesConversationMessage => ({
  role: 'ASSISTANT',
  content,
  ...(signal ? { metadata: { turnSignal: { v: 1, mood: 'neu', buy: 0, answered: 'y', topic: 'info', cues: [], ...signal } } } : {}),
})
const operator = (content: string, unanswered = false): SalesConversationMessage => ({ role: 'ASSISTANT', content, unanswered, metadata: { operator: true } })
const satisfaction = (messages: SalesConversationMessage[]) => analyzeSalesConversation({ messages }).satisfaction

describe('satisfaction follows the outcome', () => {
  const captchaComplaint = user('سلام هر چه کد امنیتی میزنم میزنه اشتباه', { mood: 'neg', cues: ['complaint', 'human'], acts: ['complaint', 'human_request'] })
  const handoff = agent('برای ادامه دقیق‌تر گفتگو، شما را به یک کارشناس انسانی متصل می‌کنم.')

  it('a complaint nobody has dealt with reads as dissatisfied', () => {
    const score = satisfaction([captchaComplaint, handoff])
    expect(score).not.toBeNull()
    expect(satisfactionBucket(score!)).toBe('dissatisfied')
  })

  it('the customer saying it is solved lifts it (the thread that was shown as «ناراضی»)', () => {
    const messages = [captchaComplaint, handoff, user('ببخشید اوکی شد ولی چند روز طول میکشه تا ادسنس اوکی شه'), operator('سلام وقت بخیر ۴۸ ساعت', true)]
    expect(frictionOutcome(messages).friction).toBe('resolved')
    expect(satisfactionBucket(satisfaction(messages)!)).not.toBe('dissatisfied')
  })

  it('thanks after the problem reads as satisfied', () => {
    const messages = [captchaComplaint, handoff, operator('کد را دوباره فرستادیم'), user('ممنون درست شد')]
    expect(satisfaction(messages)!).toBeGreaterThanOrEqual(SATISFIED_FROM)
  })

  it('an operator answer after the complaint makes it neutral, not dissatisfied', () => {
    const messages = [user('من توی تلگرام پیام دادم دو روزه اما هیچکس پاسخگو نیست', { mood: 'neg', cues: ['complaint'] }), agent('بابت این تأخیر متأسفم.', { mood: 'neg', answered: 'p', cues: ['complaint'] }), operator('سلام وقت بخیر آیدی تلگرام بفرستید چک کنم')]
    expect(frictionOutcome(messages).friction).toBe('attended')
    expect(satisfactionBucket(satisfaction(messages)!)).toBe('neutral')
  })

  it('moving on to a request the reply resolved is not dissatisfaction either', () => {
    const messages = [user('نمیشه', { mood: 'neg' }), agent('دقیقاً چه پیغامی می‌بینی؟', { mood: 'neg', answered: 'p' }), user('توی آپارات میشه', { mood: 'neu' }), agent('پس محدودیت اینترنت است؛ این راه‌حل‌ها را امتحان کن.', { answered: 'y' })]
    expect(frictionOutcome(messages).friction).toBe('attended')
    expect(satisfaction(messages)!).toBeGreaterThanOrEqual(DISSATISFIED_BELOW)
  })

  it('new friction after the operator answer reopens it', () => {
    const messages = [captchaComplaint, handoff, operator('سلام وقت بخیر'), user('هنوز هیچکس جواب نمیده، واقعا خسته شدم')]
    expect(frictionOutcome(messages).friction).toBe('open')
    expect(satisfactionBucket(satisfaction(messages)!)).toBe('dissatisfied')
  })

  it('anger is lifted only by the customer, never by an operator answer alone', () => {
    const angry = user('این چه وضعشه، افتضاحه', { mood: 'ang', cues: ['complaint'] })
    expect(satisfactionBucket(satisfaction([angry, handoff, operator('سلام وقت بخیر')])!)).toBe('dissatisfied')
    expect(satisfaction([angry, handoff, operator('انجام شد'), user('دستتون درد نکنه')])!).toBeGreaterThanOrEqual(SATISFIED_FROM)
    expect(settleSatisfaction(10, { friction: 'attended', angry: true, thanked: false })).toBe(10)
  })
})

describe('what is not dissatisfaction', () => {
  it('a problem report with «مشکل» and no model reading gives no verdict', () => {
    const messages = [user('عزیزم من تو داشبورد یه مشکل اصلی دارم'), agent('لطفاً بفرمایید دقیقاً چه پیامی می‌بینید؟'), user('میزنم گزارشات عمومی صفحه ی ارور 500 رو میاره'), agent('این موارد را بررسی کنید.')]
    expect(satisfaction(messages)).toBeNull()
  })

  it('a calm question that mentions a future «مشکل» gives no verdict', () => {
    expect(satisfaction([user('الان لازمه کاری برای درامدش انجام بدم؟ که بعدا به مشکل نخورم؟'), agent('فعلاً نه.')])).toBeNull()
  })

  it('asking for a person does not lower the score', () => {
    expect(turnSatisfaction({ v: 1, mood: 'neu', buy: 0, answered: 'y', topic: 'info', cues: ['human'] })).toBe(turnSatisfaction({ v: 1, mood: 'neu', buy: 0, answered: 'y', topic: 'info', cues: [] }))
  })

  it('a customer who never showed friction is never dissatisfied, even when the agent could not answer', () => {
    const messages = [user('کد پیگیری 1081479853 میخوام بدونم چطور پیش رفت؟', { mood: 'neu' }), agent('دسترسی من برای بررسی وضعیت فعال نیست.', { answered: 'n' }), user('روبیکا درآمد آن چند است', { mood: 'neu' }), agent('اطلاعات دقیقی ثبت نشده است.', { answered: 'n' })]
    expect(frictionOutcome(messages).friction).toBe('none')
    expect(satisfaction(messages)!).toBeGreaterThanOrEqual(DISSATISFIED_BELOW)
  })

  it('an operator answer offered to the learning center is not an unanswered customer', () => {
    const messages = [user('کارمزد چقدره؟', { mood: 'neu' }), agent('۱۵ درصد.', { answered: 'y' }), operator('۱۵٪ روی ادسنس شخصی', true), operator('۲۰٪ با پی‌پال شرکت', true)]
    expect(analyzeSalesConversation({ messages }).operational.consecutiveUnanswered).toBe(0)
  })

  it('stated dissatisfaction without any model reading is still caught', () => {
    expect(satisfactionBucket(satisfaction([user('واقعا ناراضی هستم از این وضعیت'), agent('متأسفم.')])!)).toBe('dissatisfied')
  })
})

describe('neutral readings are not shown', () => {
  const render = (value: number | null) => renderToStaticMarkup(createElement(SatisfactionText, { satisfaction: value, locale: 'fa', variant: 'tag' }))

  it('renders a verdict only', () => {
    expect(render(58)).toBe('')
    expect(render(null)).toBe('')
    expect(render(80)).toContain('راضی')
    expect(render(20)).toContain('ناراضی')
  })
})
