import { describe, expect, it } from 'vitest'
import {
  buySignalReading,
  conversationSatisfaction,
  createTurnSignalStreamFilter,
  extractTurnSignal,
  readTurnSignal,
  satisfactionBucket,
  topicsFromSignals,
  turnSatisfaction,
  visibleWhileStreaming,
  type TurnSignal,
} from '@/lib/ai/turn-signal'
import { analyzeSalesConversation, keywordTurnSignal } from '@/lib/ai/sales-intelligence'
import { buildMessages } from '@/lib/ai/rag'
import { formatTurnSignal, groundTurnSignal } from '@/lib/ai/turn-signal'
import { evaluateHandoffPolicy } from '@/lib/ai/handoff'

const signal = (overrides: Partial<TurnSignal> = {}): TurnSignal => ({
  v: 1,
  mood: 'neu',
  buy: 0,
  answered: 'y',
  topic: null,
  cues: [],
  ...overrides,
})

describe('turn signal parsing', () => {
  it('splits the status line from the customer-visible reply', () => {
    const { text, signal: parsed } = extractTurnSignal(
      'بله موجوده، ارسال هم دو روزه‌ست\n[[st:m=pos;b=2;a=y;t=stock;c=thanks]]',
    )
    expect(text).toBe('بله موجوده، ارسال هم دو روزه‌ست')
    expect(parsed).toEqual({ v: 1, mood: 'pos', buy: 2, answered: 'y', topic: 'stock', cues: ['thanks'] })
  })

  it('leaves a reply without a status line untouched', () => {
    const raw = 'سلام، چطور می‌تونم کمکتون کنم؟ [[product:{"id":"p1"}]]'
    expect(extractTurnSignal(raw)).toEqual({ text: raw, signal: null })
  })

  it('tolerates sloppy formatting from the model', () => {
    expect(extractTurnSignal('ok\n`[st: M=Neutral ; b=1 ; a=partial ; t=price ; c=pricey, repeat]`').signal)
      .toMatchObject({ mood: 'neu', buy: 1, answered: 'p', topic: 'price', cues: ['pricey', 'repeat'] })
    expect(extractTurnSignal('ok [[st:m=neg;b=0;a=n;t=weird;c=-]]').signal)
      .toMatchObject({ mood: 'neg', topic: null, cues: [] })
  })

  it('removes a malformed or truncated line without trusting it', () => {
    expect(extractTurnSignal('جواب\n[[st:m=great;b=9]]')).toEqual({ text: 'جواب', signal: null })
    expect(extractTurnSignal('جواب\n[[st:m=neu;b=1;a=')).toEqual({ text: 'جواب', signal: null })
    expect(extractTurnSignal('جواب [[')).toEqual({ text: 'جواب', signal: null })
  })

  it('treats a reply that is only the status line as empty', () => {
    expect(extractTurnSignal('[[st:m=neu;b=0;a=y;t=chat;c=-]]').text).toBe('')
  })

  it('keeps product and checkout markers intact', () => {
    const raw = 'این مدل:\n[[product:{"id":"p1","name":"کفش [مشکی]"}]]\n[[st:m=neu;b=2;a=y;t=product;c=-]]'
    expect(extractTurnSignal(raw).text).toBe('این مدل:\n[[product:{"id":"p1","name":"کفش [مشکی]"}]]')
  })

  it('round-trips through message metadata', () => {
    const stored = { turnSignal: signal({ mood: 'ang', buy: 3, cues: ['complaint'] }) }
    expect(readTurnSignal(JSON.parse(JSON.stringify(stored)))).toEqual(stored.turnSignal)
    expect(readTurnSignal({ turnSignal: { mood: 'x', buy: 1 } })).toBeNull()
    expect(readTurnSignal(null)).toBeNull()
  })
})

describe('turn signal streaming', () => {
  const tag = '[[st:m=neu;b=1;a=y;t=price;c=-]]'

  it('never leaks any part of the status line, whatever the chunking', () => {
    const raw = `قیمتش ۲۵۰ تومنه\n${tag}`
    for (let size = 1; size <= raw.length; size += 1) {
      const filter = createTurnSignalStreamFilter()
      let shown = ''
      for (let index = 0; index < raw.length; index += size) {
        shown += filter.push(raw.slice(index, index + size))
        expect(shown).not.toMatch(/\[\[s|st:|m=neu/)
      }
      expect(shown).toBe('قیمتش ۲۵۰ تومنه')
    }
  })

  it('still streams ordinary brackets and product markers', () => {
    const raw = 'سایز [۴۲] موجوده [[product:{"id":"p1"}]] دیگه؟'
    const filter = createTurnSignalStreamFilter()
    let shown = ''
    for (const char of raw) shown += filter.push(char)
    expect(shown).toBe(raw)
  })

  it('hides a partial line in live previews', () => {
    expect(visibleWhileStreaming('در حال بررسی\n[[st:m=ne')).toBe('در حال بررسی')
    expect(visibleWhileStreaming(`تمام شد\n${tag}`)).toBe('تمام شد')
  })
})

describe('turn signal scoring', () => {
  it('scores what was observed, not what the model would like', () => {
    expect(turnSatisfaction(signal({ mood: 'pos', cues: ['thanks'] }))).toBeGreaterThanOrEqual(90)
    expect(turnSatisfaction(signal())).toBeGreaterThan(60)
    expect(turnSatisfaction(signal({ mood: 'neg', answered: 'n', cues: ['repeat'] }))).toBeLessThan(10)
    expect(turnSatisfaction(signal({ mood: 'ang', cues: ['complaint'] }))).toBe(0)
  })

  it('lets a clear ending outweigh neutral questions', () => {
    const thanked = [signal({ mood: 'pos', cues: ['thanks'] }), signal(), signal(), signal()]
    expect(satisfactionBucket(conversationSatisfaction(thanked)!)).toBe('satisfied')
    const soured = [signal({ mood: 'neg', answered: 'n', cues: ['repeat'] }), signal(), signal()]
    expect(satisfactionBucket(conversationSatisfaction(soured)!)).toBe('dissatisfied')
  })

  it('reads a resolved complaint as resolved and plain questions as neutral', () => {
    const resolved = [signal({ mood: 'pos', cues: ['thanks'] }), signal({ mood: 'neg', cues: ['complaint'] })]
    expect(satisfactionBucket(conversationSatisfaction(resolved)!)).not.toBe('dissatisfied')
    expect(satisfactionBucket(conversationSatisfaction([signal(), signal()])!)).toBe('neutral')
    expect(conversationSatisfaction([])).toBeNull()
  })

  it('fades old buying intent and honours a decline', () => {
    expect(buySignalReading([signal({ buy: 3 })])!.probability).toBe(90)
    const cooled = buySignalReading([signal(), signal(), signal(), signal({ buy: 3 })])!
    expect(cooled.probability).toBeLessThan(65)
    expect(cooled.level).toBe(0)
    const declined = buySignalReading([signal({ buy: 2, cues: ['decline'] }), signal({ buy: 3 })])!
    expect(declined).toMatchObject({ declined: true, level: 0 })
    expect(declined.probability).toBeLessThanOrEqual(15)
  })

  it('ranks topics by how often they came up', () => {
    expect(topicsFromSignals([
      signal({ topic: 'shipping' }), signal({ topic: 'price' }), signal({ topic: 'price' }), signal({ topic: 'chat' }),
    ])).toEqual(['price', 'shipping'])
  })
})

describe('hybrid sales analysis', () => {
  const indirectBuyer = [
    { role: 'USER' as const, content: 'اینو واسه تولد خواهرم می‌خوام، تا پنجشنبه دستم می‌رسه؟' },
    { role: 'ASSISTANT' as const, content: 'بله، تا چهارشنبه تحویل می‌شه', signal: signal({ buy: 3, topic: 'shipping' }) },
    { role: 'USER' as const, content: 'پس همینو برمی‌دارم' },
  ]

  it('is unchanged for threads without status lines', () => {
    const messages = indirectBuyer.map(({ role, content }) => ({ role, content }))
    const analysis = analyzeSalesConversation({ messages, businessType: 'COMMERCE' })
    expect(analysis.aiTurnCount).toBe(0)
    expect(analysis).toEqual(
      analyzeSalesConversation({ messages: indirectBuyer, businessType: 'COMMERCE', heuristicOnly: true }),
    )
  })

  it('recognises buying intent the keyword lexicon misses', () => {
    const keywordOnly = analyzeSalesConversation({ messages: indirectBuyer, businessType: 'COMMERCE', heuristicOnly: true })
    const hybrid = analyzeSalesConversation({ messages: indirectBuyer, businessType: 'COMMERCE' })
    expect(keywordOnly.stage).not.toBe('PURCHASE_INTENT')
    expect(hybrid.stage).toBe('PURCHASE_INTENT')
    expect(hybrid.leadType).toBe('BUYER')
    expect(hybrid.buyerProbability).toBeGreaterThanOrEqual(85)
    expect(hybrid.topics).toEqual(['shipping'])
  })

  it('reads signals stored in message metadata', () => {
    const analysis = analyzeSalesConversation({
      messages: [
        { role: 'USER', content: 'خب؟' },
        { role: 'ASSISTANT', content: 'متأسفم', metadata: { turnSignal: signal({ mood: 'neg', answered: 'n', cues: ['complaint'] }) } },
      ],
    })
    expect(analysis.sentiment).toBe('NEGATIVE')
    expect(analysis.satisfaction).toBeLessThan(45)
  })

  it('never talks down a completed purchase or an explicit commitment', () => {
    const committed = analyzeSalesConversation({
      businessType: 'COMMERCE',
      messages: [
        { role: 'USER', content: 'میخوام بخرم، لینک پرداخت رو بفرستید' },
        { role: 'ASSISTANT', content: 'حتماً', signal: signal({ buy: 0 }) },
      ],
    })
    expect(committed.stage).toBe('PURCHASE_INTENT')
    expect(committed.buyerProbability).toBeGreaterThanOrEqual(85)
  })

  it('keeps handoff policy independent of model output', () => {
    const messages = [
      { role: 'USER' as const, content: 'قیمت این چنده؟' },
      { role: 'ASSISTANT' as const, content: '۲۵۰ تومن', signal: signal({ mood: 'ang', answered: 'n', cues: ['complaint', 'human', 'repeat'] }) },
      { role: 'USER' as const, content: 'باشه مرسی' },
    ]
    const policyView = analyzeSalesConversation({ messages, businessType: 'COMMERCE', heuristicOnly: true })
    expect(policyView.operational.explicitHumanRequest).toBe(false)
    expect(evaluateHandoffPolicy({ analysis: policyView, businessType: 'COMMERCE', messageCount: 3 }).recommended).toBe(false)
    // The full reading still reports the friction for the inbox.
    const hybrid = analyzeSalesConversation({ messages, businessType: 'COMMERCE' })
    expect(hybrid.operational).toEqual(policyView.operational)
    expect(hybrid.riskFlags).toEqual(policyView.riskFlags)
  })
})

describe('grounding and history tags', () => {
  it('keeps a positive reading only when the customer said so', () => {
    const optimistic = signal({ mood: 'pos', buy: 3, cues: ['thanks'] })
    expect(groundTurnSignal(optimistic, 'تایید')).toMatchObject({ mood: 'neu', buy: 3, cues: [] })
    expect(groundTurnSignal(optimistic, 'مرسی، عالی بود')).toBe(optimistic)
    expect(groundTurnSignal(signal({ mood: 'pos' }), 'ok 🙏').mood).toBe('pos')
    // A negative reading is exactly what keywords miss, so it stands.
    const sarcastic = signal({ mood: 'neg', cues: ['complaint'] })
    expect(groundTurnSignal(sarcastic, 'چه سرعت فوق‌العاده‌ای، سه روزه منتظرم')).toBe(sarcastic)
  })

  it('reads a customer message in the status-line vocabulary', () => {
    expect(keywordTurnSignal('میخوام بخرم، لینک پرداخت رو بفرستید')).toMatchObject({ buy: 3, topic: 'order' })
    expect(keywordTurnSignal('هزینه ارسال چقدره؟')).toMatchObject({ buy: 2, topic: 'shipping', mood: 'neu' })
    expect(keywordTurnSignal('ممنون')).toMatchObject({ mood: 'pos', cues: ['thanks'], topic: 'chat' })
    expect(keywordTurnSignal('سفارشم هنوز نرسیده')).toMatchObject({ mood: 'neg', topic: 'complaint' })
    expect(keywordTurnSignal('تایید', 3).buy).toBe(3)
    expect(keywordTurnSignal('تایید').buy).toBe(0)
  })

  it('tags earlier replies only when the engine asks for the status line', () => {
    const base = {
      systemPrompt: 'You are a shop assistant.',
      language: 'fa',
      contextText: '',
      catalogProducts: [],
      history: [
        { role: 'user' as const, content: 'هزینه ارسال چقدره؟' },
        { role: 'assistant' as const, content: 'ارسال ۵۰ تومنه' },
      ],
      userMessage: 'باشه',
    }
    const plain = buildMessages(base)
    expect(plain[2].content).toBe('ارسال ۵۰ تومنه')
    expect(plain[0].content).not.toContain('[[st:')

    const tagged = buildMessages({ ...base, turnSignal: true })
    expect(tagged[0].content).toContain('Hidden status line')
    expect(tagged[2].content).toBe(`ارسال ۵۰ تومنه\n${formatTurnSignal(keywordTurnSignal('هزینه ارسال چقدره؟'))}`)
    expect(tagged[1].content).toBe('هزینه ارسال چقدره؟')
    // The caller's history objects are never mutated.
    expect(base.history[1].content).toBe('ارسال ۵۰ تومنه')
  })
})
