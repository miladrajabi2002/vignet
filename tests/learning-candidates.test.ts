import { describe, expect, it } from 'vitest'
import { isLearningNoise, learningItemFromMessage, LEARNING_REVIEW_VERSION, uniqueLearningItems } from '@/lib/ai/learning-candidates'
import { evaluateLearningEligibility } from '@/lib/ai/learning-policy'

describe('contextual learning candidates', () => {
  it.each(['قیمت لطفا', 'مدله چهارم', 'کد 0575 موجوده یا نه', 'لباس نخی ۶۹۸ تومن؟', 'بله لطفا کاتالوگ'])('filters real catalog noise: %s', (question) => {
    expect(isLearningNoise(question)).toBe(true)
  })
  it('keeps a reusable policy question and blocks private Persian-digit answers', () => {
    expect(learningItemFromMessage({ id: '1', conversationId: 'c', metadata: { question: 'شرایط تعویض کالا چیست؟' } })).not.toBeNull()
    expect(evaluateLearningEligibility('چطور پیگیری کنم؟', 'با ۰۹۳۵۲۱۲۱۱۳۰ تماس بگیرید.').eligible).toBe(false)
    expect(evaluateLearningEligibility('ارسال چقدر طول می‌کشد؟', '[نیاز به تکمیل صاحب کسب‌وکار]').eligible).toBe(false)
  })
  it('blocks product-specific stock even when AI mistakenly labels it reusable', () => {
    expect(learningItemFromMessage({ id: 'stock', conversationId: 'c', metadata: {
      question: 'عکس از کد۰۷ میفرستید', learningReview: {
        version: LEARNING_REVIEW_VERSION, eligible: true,
        question: 'موجودی سایز XL را از کاتالوگ بررسی کن',
        answer: 'کد ۰۶۴۶ در سایز XL موجود نیست و تنها کد ۰۷ موجود است.',
      },
    } })).toBeNull()
  })

  it('uses a contextual intent while retaining the original message and an empty draft', () => {
    expect(learningItemFromMessage({ id: '1', conversationId: 'c', metadata: {
      question: 'من وقت ندارم ده بار برم سایت', operatorAnswer: 'اون محصول موجود نیست',
      learningReview: { version: LEARNING_REVIEW_VERSION, eligible: true, question: 'چطور خطای سبد خرید را رفع کنم؟', summary: 'مشتری در تکمیل خرید مشکل داشت.', answer: '' },
    } })).toMatchObject({ question: 'چطور خطای سبد خرید را رفع کنم؟', originalQuestion: 'من وقت ندارم ده بار برم سایت', operatorAnswer: '', analyzed: true })
  })
  it('hides AI-rejected items and deduplicates normalized questions', () => {
    const base = { conversationId: 'c', metadata: { question: 'چطور كالا را تعویض کنم؟' } }
    expect(uniqueLearningItems([
      { ...base, id: '1' },
      { ...base, id: '2', metadata: { question: 'چطور کالا را تعویض کنم؟' } },
      { ...base, id: '3', metadata: { ...base.metadata, learningReview: { version: LEARNING_REVIEW_VERSION, eligible: false } } },
    ])).toHaveLength(1)
  })
})
