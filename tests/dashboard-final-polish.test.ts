import { describe, expect, it } from 'vitest'
import { telegramMarkdownToHtml } from '@/lib/channels/telegram-like'
import { isHumanOwnedConversation } from '@/lib/ai/conversation'
import { getBusinessServiceOptions, getDashboardModules } from '@/lib/verticals/registry'

describe('operator ownership gate', () => {
  it('keeps both handed-off representations under human control', () => {
    expect(isHumanOwnedConversation({ status: 'HANDED_OFF', handedOff: false })).toBe(true)
    expect(isHumanOwnedConversation({ status: 'OPEN', handedOff: true })).toBe(true)
    expect(isHumanOwnedConversation({ status: 'OPEN', handedOff: false })).toBe(false)
  })
})

describe('Telegram response formatting', () => {
  it('converts agent markdown bold to Telegram HTML without changing bullets', () => {
    expect(telegramMarkdownToHtml('- **پلن استارتر:** ۸۹۰,۰۰۰ تومان'))
      .toBe('- <b>پلن استارتر:</b> ۸۹۰,۰۰۰ تومان')
  })

  it('escapes unsafe HTML before adding supported markup', () => {
    expect(telegramMarkdownToHtml('قیمت < ۱۰۰ & **قطعی**'))
      .toBe('قیمت &lt; ۱۰۰ &amp; <b>قطعی</b>')
  })
})

describe('additive business capabilities', () => {
  it('does not remove products when booking is selected', () => {
    const modules = getDashboardModules('COMMERCE', ['رزرو و نوبت‌دهی'])
    expect(modules).toContain('products')
    expect(modules).toContain('appointments')
    expect(modules).toContain('services')
  })

  it('enables the real food menu and Instagram together', () => {
    const modules = getDashboardModules('FOOD', ['مدیریت و فروش در اینستاگرام'])
    expect(modules).toEqual(expect.arrayContaining(['menu', 'products', 'instagram']))
  })

  it('offers every cross-business capability while prioritizing relevant ones', () => {
    const food = getBusinessServiceOptions('FOOD')
    expect(food.map((option) => option.key)).toEqual(expect.arrayContaining(['digital-menu', 'instagram', 'products', 'services', 'bookings']))
    expect(food[0].recommendedFor).toContain('FOOD')
  })
})
