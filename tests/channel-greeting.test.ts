import { describe, expect, it } from 'vitest'
import {
  greetingReplyText,
  isGreetingOnlyMessage,
} from '@/lib/channels/greeting'

describe('greeting fast-path detector', () => {
  it('recognizes bare Persian greetings', () => {
    expect(isGreetingOnlyMessage('سلام')).toBe(true)
    expect(isGreetingOnlyMessage('سلام!')).toBe(true)
    expect(isGreetingOnlyMessage('سلام، خوبین؟')).toBe(true)
    expect(isGreetingOnlyMessage('سلام وقت بخیر')).toBe(true)
    expect(isGreetingOnlyMessage('درود بر شما')).toBe(true)
    expect(isGreetingOnlyMessage('سلام خوبی')).toBe(true)
    expect(isGreetingOnlyMessage('سلام چطوری')).toBe(true)
    expect(isGreetingOnlyMessage('سلام سلام')).toBe(true)
  })

  it('recognizes English greetings', () => {
    expect(isGreetingOnlyMessage('hello')).toBe(true)
    expect(isGreetingOnlyMessage('Hi there!')).toBe(true)
    expect(isGreetingOnlyMessage('Good morning')).toBe(true)
    expect(isGreetingOnlyMessage('salam')).toBe(true)
  })

  it('never takes a message with real intent to the fast path', () => {
    expect(isGreetingOnlyMessage('سلام قیمت محصول چنده؟')).toBe(false)
    expect(isGreetingOnlyMessage('سلام خوبین محصول فلان رو دارین')).toBe(false)
    expect(isGreetingOnlyMessage('سلام وقت دارین یه سوال بپرسم')).toBe(false)
    expect(isGreetingOnlyMessage('سلام چه خبر از تخفیف ها')).toBe(false)
    expect(isGreetingOnlyMessage('قیمت طرح ها چنده')).toBe(false)
    expect(isGreetingOnlyMessage('لغو')).toBe(false)
    expect(isGreetingOnlyMessage('')).toBe(false)
    expect(
      isGreetingOnlyMessage(
        'سلام من چند روز پیش سفارش دادم و هنوز به دستم نرسیده، میشه بررسی کنید؟',
      ),
    ).toBe(false)
  })

  it('caps the fast path to short messages', () => {
    expect(
      isGreetingOnlyMessage(
        'سلام سلام سلام سلام سلام سلام سلام سلام سلام سلام سلام',
      ),
    ).toBe(false)
  })
})

describe('greeting canned reply', () => {
  it('replies in Persian to a Persian greeting', () => {
    expect(greetingReplyText('سلام')).toMatch(/سلام/)
  })

  it('replies in English to a Latin-script greeting', () => {
    expect(greetingReplyText('hello')).toMatch(/Hello/)
  })
})
