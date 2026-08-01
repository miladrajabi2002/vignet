import { describe, expect, it } from 'vitest'
import {
  evaluateLearningEligibility,
  isEligibleOperatorLearningMetadata,
} from '@/lib/ai/learning-policy'

describe('operator learning eligibility', () => {
  it('allows reusable policy answers', () => {
    const result = evaluateLearningEligibility(
      'ارسال معمولاً چند روز طول می‌کشد؟',
      'ارسال استاندارد بین سه تا پنج روز کاری زمان می‌برد.',
    )

    expect(result).toMatchObject({ eligible: true, reasonCodes: [] })
  })

  it.each([
    ['سفارش من کجاست؟', 'سفارش شماره A-129 برای شما ارسال شد.', 'ORDER_SPECIFIC'],
    ['چطور خبرم می‌کنید؟', 'با شماره 09121234567 تماس می‌گیریم.', 'PERSONAL_DATA'],
    ['موجود است؟', 'فعلاً موجود است و امروز ارسال می‌شود.', 'TIME_SENSITIVE'],
    ['قیمت برای من چقدر است؟', 'قیمت نهایی برای شما ۲۵۰۰۰۰ تومان است.', 'VOLATILE_COMMERCIAL_DATA'],
    ['کد ورود چیست؟', 'کد تأیید شما 123456 است.', 'SECRET_OR_CREDENTIAL'],
  ])('blocks private or episodic content: %s', (question, answer, reason) => {
    const result = evaluateLearningEligibility(question, answer)

    expect(result.eligible).toBe(false)
    expect(result.reasonCodes).toContain(reason)
  })

  it('requires an explicit policy decision on operator-authored metadata', () => {
    expect(isEligibleOperatorLearningMetadata({ operator: true })).toBe(false)
    expect(isEligibleOperatorLearningMetadata({
      operator: true,
      learningCandidate: { eligible: true },
    })).toBe(true)
  })
})
