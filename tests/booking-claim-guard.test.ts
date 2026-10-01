import { describe, expect, it } from 'vitest'
import { claimWithoutAction } from '@/lib/bookings/chat-orchestrator'

describe('booking reply claim guard', () => {
  it('flags a fresh booking or cancellation claim without a matching tool receipt', () => {
    expect(claimWithoutAction('نوبت شما با موفقیت لغو شد. ✅', [])).toBe('cancelled')
    expect(claimWithoutAction('نوبت شما ثبت شد.', [])).toBe('booked')
    expect(claimWithoutAction('نوبتتان به ساعت ۱۱ جابه‌جا شد.', [])).toBe('booked')
    expect(claimWithoutAction('Your appointment has been cancelled.', [])).toBe('cancelled')
  })

  it('accepts claims backed by a receipt from this turn', () => {
    expect(claimWithoutAction('نوبت شما ثبت شد.', [{ kind: 'appointment_booked' }])).toBeNull()
    expect(claimWithoutAction('لغو شد.', [{ kind: 'appointment_cancelled' }])).toBeNull()
  })

  it('ignores questions, state descriptions and negatives', () => {
    expect(claimWithoutAction('رزرو رو برای ساعت ۱۰ انجام بدم؟', [])).toBeNull()
    expect(claimWithoutAction('نوبت شما قبلاً ثبت شده است.', [])).toBeNull()
    expect(claimWithoutAction('هنوز نوبتی ثبت نشده.', [])).toBeNull()
    expect(claimWithoutAction('ساعت ۱۰ فردا آزاد است.', [])).toBeNull()
  })
})
