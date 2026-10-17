import { describe, expect, it } from 'vitest'
import { buildFallbackSummary, extractSummaryContact, isHandoffNotice } from '@/lib/conversations/summary'
import { buildLiveSummary } from '@/lib/conversations/live-summary'
import { bareReplyKind } from '@/lib/conversations/short-replies'
import { BUILT_IN_HANDOFF_NOTICES } from '@/lib/ai/handoff-replies'
import {
  advanceConversationWorkingState,
  createEmptyConversationWorkingState,
  observeAssistantTurn,
} from '@/lib/ai/conversation-state'

describe('conversation summaries', () => {
  it('does not infer dissatisfaction from an emoji-only Instagram comment', () => {
    const summary = buildFallbackSummary([
      {
        role: 'USER',
        content: '🔥',
        metadata: { vigentoInbound: { channel: 'INSTAGRAM', kind: 'COMMENT' } },
      },
      { role: 'ASSISTANT', content: 'ممنون از محبت شما' },
    ], 'fa')

    expect(summary).toContain('کامنت اینستاگرام')
    expect(summary).toContain('درخواست مشخص')
    expect(summary).not.toContain('ناراضی')
  })

  it('does not turn a greeting into a request for help', () => {
    const summary = buildFallbackSummary([
      {
        role: 'USER',
        content: 'سلام',
        metadata: { vigentoInbound: { channel: 'INSTAGRAM', kind: 'DM' } },
      },
      { role: 'ASSISTANT', content: 'سلام! چطور می‌توانم کمک کنم؟' },
    ], 'fa')

    expect(summary).toContain('دایرکت اینستاگرام')
    expect(summary).toContain('هنوز درخواست یا مشکلی مطرح نشده')
    expect(summary).not.toContain('درخواست کمک')
  })

  it('summarizes multiple recent needs and makes the unresolved state explicit without AI', () => {
    const summary = buildFallbackSummary([
      { role: 'USER', content: 'جلومبلی نقش و نگار رو مقایسه کن' },
      { role: 'ASSISTANT', content: 'نقش برای پذیرایی کوچک جمع‌وجورتر است.' },
      { role: 'USER', content: 'کدومش ارزون‌تره؟' },
    ], 'fa')

    expect(summary).toContain('جلومبلی نقش و نگار')
    expect(summary).toContain('کدومش ارزون‌تره')
    expect(summary).toContain('نیازمند پاسخ اپراتور')
  })

  it('reuses rolling memory as relevant history in the operator summary', () => {
    const summary = buildFallbackSummary([
      { role: 'USER', content: 'کیفیتشون چطوره؟' },
      { role: 'ASSISTANT', content: 'کیفیت هر دو در کاتالوگ درجه یک ثبت شده است.' },
    ], 'fa', 'هدف مشتری: مقایسه جلومبلی نقش و نگار برای پذیرایی کوچک')

    expect(summary).toContain('سابقه مرتبط')
    expect(summary).toContain('نقش و نگار')
    expect(summary).toContain('آخرین پاسخ ایجنت')
  })
})

// The real handed-off Instagram freight inquiry whose summary read
// «شهر: بله | درخواست مشتری: بله ← 09033977377 ناصر ← همین الان».
describe('handoff summary of a short, fact-heavy chat', () => {
  const dm = { vigentoInbound: { channel: 'INSTAGRAM', kind: 'DM' } }
  const transcript = [
    { role: 'USER' as const, content: 'سلام', metadata: dm },
    { role: 'ASSISTANT' as const, content: 'سلام! برای دریافت راهنمایی یا ثبت درخواست بفرمایید چه کمکی می‌توانم بکنم؟' },
    { role: 'USER' as const, content: 'ارسال هوایی دارید', metadata: dm },
    { role: 'ASSISTANT' as const, content: 'بله، حمل هوایی یکی از گزینه‌های ماست. اول بفرمایید چه نوع کالایی می‌خواهید ارسال کنید؟' },
    { role: 'USER' as const, content: 'کفش', metadata: dm },
    { role: 'ASSISTANT' as const, content: 'برای کفش، وزن تقریبی و تعداد کارتن‌ها رو بفرمایید' },
    { role: 'USER' as const, content: '۱۰۰ کیلو ۶ کارتن', metadata: dm },
    { role: 'ASSISTANT' as const, content: 'حالا شهر مبدأ (محل بار) رو بفرمایید و مقصد هم تهران یا شهر دیگه‌ست؟' },
    { role: 'USER' as const, content: 'شنزن', metadata: dm },
    { role: 'ASSISTANT' as const, content: 'شهر مبدأ یعنی «شنزن» و مقصد هم تهران است؟' },
    { role: 'USER' as const, content: 'بله', metadata: dm },
    { role: 'ASSISTANT' as const, content: 'نام خانوادگی و شماره تماستون رو بفرمایید تا همکارم تماس بگیره' },
    { role: 'USER' as const, content: '09033977377 ناصر', metadata: dm },
    { role: 'ASSISTANT' as const, content: 'ممنون ناصر. درخواست شما جمع‌بندی شد: ارسال هوایی کفش، ۱۰۰ کیلو در ۶ کارتن، از شنزن به تهران. اگر بازهٔ زمانی خاصی برای تماس بهتره بفرمایید.' },
    { role: 'USER' as const, content: 'همین الان', metadata: dm },
    { role: 'ASSISTANT' as const, content: 'برای ادامه دقیق‌تر گفتگو، شما را همراه با خلاصه صحبت‌ها به یک کارشناس انسانی متصل می‌کنم.' },
  ]

  function freightState() {
    let state = createEmptyConversationWorkingState('s')
    const turn = (message: string, id: string, understood: Parameters<typeof advanceConversationWorkingState>[0]['understood']) => {
      state = advanceConversationWorkingState({ state, sessionStartId: 's', message, messageId: id, createdAt: new Date(), understood })
    }
    turn('ارسال هوایی دارید', 'u1', { relation: 'NEW_GOAL', intent: 'BUSINESS_INFO', searchTerms: [], slots: {} })
    turn('کفش', 'u2', { relation: 'ANSWER', intent: 'GENERAL', searchTerms: [], slots: {} })
    turn('۱۰۰ کیلو ۶ کارتن', 'u3', { relation: 'ANSWER', intent: 'GENERAL', searchTerms: [], slots: {} })
    state = observeAssistantTurn(state, 'حالا شهر مبدأ (محل بار) رو بفرمایید و مقصد هم تهران یا شهر دیگه‌ست؟', 'a3', new Date())
    turn('شنزن', 'u4', { relation: 'ANSWER', intent: 'GENERAL', searchTerms: [], slots: {} })
    state = observeAssistantTurn(state, 'شهر مبدأ یعنی «شنزن» و مقصد هم تهران است؟', 'a4', new Date())
    turn('بله', 'u5', { relation: 'ANSWER', intent: 'GENERAL', searchTerms: [], slots: {} })
    turn('09033977377 ناصر', 'u6', { relation: 'ANSWER', intent: 'GENERAL', searchTerms: [], slots: {} })
    return state
  }

  it('a bare «بله» confirms the slot instead of overwriting «شنزن»', () => {
    const state = freightState()
    expect(state.slots.location?.value).toBe('شنزن')
    expect(state.lastAnswer?.value).toBe('بله')
    expect(state.constraints.map((fact) => fact.value)).not.toContain('بله')
  })

  it('a bare «نه» drops the value the agent checked', () => {
    let state = createEmptyConversationWorkingState('s')
    state = advanceConversationWorkingState({ state, sessionStartId: 's', message: 'کاناپه میخوام', messageId: 'u1', createdAt: new Date(), understood: { relation: 'NEW_GOAL', intent: 'PRODUCT', searchTerms: ['کاناپه'], slots: { color: 'آبی' } } })
    state = observeAssistantTurn(state, 'رنگ آبی رو می‌خواید؟', 'a1', new Date())
    state = advanceConversationWorkingState({ state, sessionStartId: 's', message: 'نه', messageId: 'u2', createdAt: new Date(), understood: { relation: 'ANSWER', intent: 'PRODUCT', searchTerms: [], slots: {} } })
    expect(state.slots.color).toBeUndefined()
  })

  it('names every detail, the contact and the real next step', () => {
    const contact = extractSummaryContact(transcript)
    expect(contact).toEqual({ name: 'ناصر', phone: '09033977377' })
    const structured = buildLiveSummary({ state: freightState(), draft: null, language: 'fa', contact })
    const summary = buildFallbackSummary(transcript, 'fa', null, structured, { contact }) ?? ''

    for (const fact of ['ارسال هوایی', 'کفش', 'کارتن', 'شنزن', 'ناصر', '09033977377']) expect(summary).toContain(fact)
    expect(summary).not.toContain('شهر: بله')
    expect(summary).not.toMatch(/درخواست مشتری[^|]*بله/)
    // The agent's recap, not the transfer notice, is its latest answer.
    expect(summary).toContain('آخرین پاسخ ایجنت: ممنون ناصر. درخواست شما جمع‌بندی شد')
    expect(summary).not.toContain('کارشناس انسانی متصل')
    expect(summary).toContain('آخرین پیام مشتری «همین الان» (در جواب آخرین پاسخ ایجنت) نیازمند پاسخ اپراتور است')
    expect(summary.length).toBeLessThanOrEqual(900)
  })

  it('recognises the transfer notice by marker, custom text or wording', () => {
    expect(isHandoffNotice({ role: 'ASSISTANT', content: 'هر چیزی', metadata: { handoffNotice: true } })).toBe(true)
    expect(isHandoffNotice({ role: 'ASSISTANT', content: 'این مورد نیاز به بررسی داره، همکارم پیام میده.' }, ['این مورد نیاز به بررسی داره، همکارم پیام میده.'])).toBe(true)
    for (const notice of BUILT_IN_HANDOFF_NOTICES) expect(isHandoffNotice({ role: 'ASSISTANT', content: notice })).toBe(true)
    // Rows from the other handoff paths keep the original wording check.
    expect(isHandoffNotice({ role: 'ASSISTANT', content: 'گفتگو به اپراتور سپرده شد.' })).toBe(true)
    // An offer to involve a colleague is still the agent's own answer.
    expect(isHandoffNotice({ role: 'ASSISTANT', content: 'اگه بخواید، این موضوع رو به همکارم می‌سپارم تا دقیق بررسی کنه' })).toBe(false)
    expect(isHandoffNotice({ role: 'ASSISTANT', content: 'نام و شماره تماستون رو بفرمایید تا همکارم تماس بگیره' })).toBe(false)
  })

  it('says plainly that the customer kept writing after the handoff with no operator reply', () => {
    const hold = 'لطفاً کمی صبر کنید، همکار ما به‌زودی پاسخ می‌دهد'
    const later = [
      ...transcript,
      { role: 'USER' as const, content: 'یک بار دیگه هم دارم', metadata: dm },
      { role: 'ASSISTANT' as const, content: hold },
      { role: 'USER' as const, content: 'سلام مجدد', metadata: dm },
      { role: 'ASSISTANT' as const, content: hold },
    ]
    const summary = buildFallbackSummary(later, 'fa', null, null) ?? ''
    expect(summary).toContain('مشتری بعد از انتقال ۲ پیام دیگر فرستاده و هنوز هیچ اپراتوری جواب نداده')
    expect(summary).toContain('یک بار دیگه هم دارم')
    expect(summary).not.toContain(`آخرین پاسخ ایجنت: ${hold}`)

    const answered = [...later, { role: 'ASSISTANT' as const, content: 'سلام ناصر جان، الان تماس می‌گیرم', metadata: { operator: true } }]
    const after = buildFallbackSummary(answered, 'fa', null, null) ?? ''
    expect(after).toContain('آخرین پاسخ اپراتور: سلام ناصر جان')
    expect(after).not.toContain('هنوز هیچ اپراتوری جواب نداده')
  })

  it('reads bare replies but never real content as one', () => {
    expect(bareReplyKind('بله')).toBe('yes')
    expect(bareReplyKind('آره مرسی!')).toBe('yes')
    expect(bareReplyKind('نه ممنون')).toBe('no')
    expect(bareReplyKind('اوکی')).toBe('ack')
    expect(bareReplyKind('شنزن')).toBeNull()
    expect(bareReplyKind('بله آبی')).toBeNull()
    expect(bareReplyKind('همین الان')).toBeNull()
  })
})
