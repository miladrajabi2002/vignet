import { describe, expect, it } from 'vitest'
import { describeResolvedDateTime, nextJalaliDate, resolvePersianDateTime } from '@/lib/agent/parsers/persian-datetime'

// Sunday 2026-10-04 = 12 Mehr 1405, 11:30 in Tehran.
const now = new Date('2026-10-04T08:00:00.000Z')
const read = (text: string) => resolvePersianDateTime(text, { now })
const at = (hour: number, minute = 0) => hour * 60 + minute

describe('Persian booking dates', () => {
  it('relative days, in every common spelling', () => {
    for (const text of ['پس‌فردا', 'پسفردا', 'پس فردا', 'پسفدا', 'پَس‌فردا']) expect(read(text).dateKey, text).toBe('2026-10-06')
    expect(read('فردا').dateKey).toBe('2026-10-05')
    expect(read('امروز').dateKey).toBe('2026-10-04')
    expect(read('پس پس فردا').dateKey).toBe('2026-10-07')
    expect(read('سه روز دیگه').dateKey).toBe('2026-10-07')
    expect(read('یه هفته دیگه').dateKey).toBe('2026-10-11')
  })

  it('weekdays, with the Iranian week (starts on Saturday)', () => {
    expect(read('شنبه').dateKey).toBe('2026-10-10')
    expect(read('یکشنبه').dateKey).toBe('2026-10-04') // today
    expect(read('یکشنبه بعد').dateKey).toBe('2026-10-11')
    expect(read('یک شنبه هفته بعد').dateKey).toBe('2026-10-11')
    expect(read('شنبه هفته بعد').dateKey).toBe('2026-10-10')
    expect(read('سه‌شنبه').dateKey).toBe('2026-10-06')
    expect(read('سه شنبه').dateKey).toBe('2026-10-06')
    expect(read('یکشبنه بعد').dateKey).toBe('2026-10-11') // typo
    expect(read('چارشنبه').dateKey).toBe('2026-10-07') // colloquial
    expect(read('۵شنبه').dateKey).toBe('2026-10-08')
    expect(read('آخر هفته').dateKey).toBe('2026-10-08')
  })

  it('Jalali dates: day + month name, ordinals, slashes, ISO; never in the past', () => {
    expect(read('۱۵ مهر').dateKey).toBe('2026-10-07')
    expect(read('پونزدهم مهر').dateKey).toBe('2026-10-07')
    expect(read('۱۵ام مهر').dateKey).toBe('2026-10-07')
    expect(read('۲۰ آبان').dateKey).toBe('2026-11-11')
    expect(read('۷/۱۵').dateKey).toBe('2026-10-07')
    expect(read('1405/07/15').dateKey).toBe('2026-10-07')
    expect(read('2026-10-20').dateKey).toBe('2026-10-20')
    expect(read('۵ مهر').dateKey?.startsWith('2027-09')).toBe(true) // passed → next year
    expect(read('دیروز').dateKey).toBeNull()
    expect(nextJalaliDate('2026-10-04', 7, 12)).toBe('2026-10-04')
  })
})

describe('Persian booking times', () => {
  it('parts of day become a window', () => {
    expect(read('پس‌فردا عصر')).toMatchObject({ dateKey: '2026-10-06', minute: null, window: { label: 'عصر', from: at(16), to: at(19) } })
    expect(read('فردا صبح').window?.label).toBe('صبح')
    expect(read('امشب')).toMatchObject({ dateKey: '2026-10-04', window: { label: 'شب' } })
    expect(read('شنبه بعد از ظهر').window?.label).toBe('بعدازظهر')
  })

  it('clock times, spoken times and their afternoon reading', () => {
    expect(read('فردا ساعت ۵')).toMatchObject({ dateKey: '2026-10-05', minute: at(17), assumedAfternoon: true })
    expect(read('فردا ساعت ۱۰')).toMatchObject({ minute: at(10), assumedAfternoon: false })
    expect(read('۱۰ و نیم صبح').minute).toBe(at(10, 30))
    expect(read('ساعت پنج و ربع عصر').minute).toBe(at(17, 15))
    expect(read('۴ بعدازظهر').minute).toBe(at(16))
    expect(read('۸ شب').minute).toBe(at(20))
    expect(read('۲۰ آبان ساعت ۱۸:۳۰')).toMatchObject({ dateKey: '2026-11-11', minute: at(18, 30) })
    expect(read('فردا یه ربع به شش').minute).toBe(at(17, 45))
    expect(read('ساعت ۱ ظهر').minute).toBe(at(13))
  })

  it('reads no date or time from words that only look like one', () => {
    expect(read('ساعت مچی دارین؟')).toMatchObject({ dateKey: null, minute: null })
    expect(read('قیمتش ۵ تومنه؟')).toMatchObject({ dateKey: null, minute: null })
    expect(read('دو تا میخوام')).toMatchObject({ dateKey: null, minute: null })
    expect(read('')).toMatchObject({ dateKey: null, minute: null, window: null })
  })

  it('describes the result for the booking model', () => {
    const text = describeResolvedDateTime(read('پس‌فردا عصر'))
    expect(text).toContain('سه‌شنبه')
    expect(text).toContain('(2026-10-06)')
    expect(text).toContain('عصر (16:00 تا 19:00)')
    expect(describeResolvedDateTime(read('فردا ساعت ۵'))).toContain('ساعت 17:00 (عصر فرض شد')
    expect(describeResolvedDateTime(read('سلام'))).toBe('')
  })
})
