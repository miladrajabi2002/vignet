import { describe, expect, it } from 'vitest'
import { normalizePriceGrouping, restoreHalfSpaces } from '@/lib/ai/response-postprocess'

const ZWNJ = '‌'

describe('restoreHalfSpaces', () => {
  it('puts the half-space back in joined verbs', () => {
    expect(restoreHalfSpaces('الان چک میکنم و خبر میدم')).toBe(`الان چک می${ZWNJ}کنم و خبر می${ZWNJ}دم`)
    expect(restoreHalfSpaces('نمیتونم قیمت رو عوض کنم، میخواهید ببینید؟')).toBe(`نمی${ZWNJ}تونم قیمت رو عوض کنم، می${ZWNJ}خواهید ببینید؟`)
    expect(restoreHalfSpaces('ارسال با باربری انجام میشه.')).toBe(`ارسال با باربری انجام می${ZWNJ}شه.`)
  })

  it('repairs the plural after ه and the fixed compounds', () => {
    expect(restoreHalfSpaces('نسخههای دیگر و گزینههای موجود')).toBe(`نسخه${ZWNJ}های دیگر و گزینه${ZWNJ}های موجود`)
    expect(restoreHalfSpaces('برای شستوشوی پارچه، بهطور کلی')).toBe(`برای شست${ZWNJ}وشوی پارچه، به${ZWNJ}طور کلی`)
  })

  it('leaves real words that only look like a verb', () => {
    for (const text of ['میز تلویزیون', 'میدان آزادی', 'میزان موجودی', 'میان این دو', 'میلاد', 'میوه', 'یک میلیون تومان', 'میکاپ', 'تحقیق میدانی']) {
      expect(restoreHalfSpaces(text)).toBe(text)
    }
  })

  it('never touches a product card line or text that is already correct', () => {
    const card = '[[product:{"id":"p1","name":"شامپو میکنم"}]]'
    expect(restoreHalfSpaces(`جواب میدم\n${card}`)).toBe(`جواب می${ZWNJ}دم\n${card}`)
    const fine = `الان چک می${ZWNJ}کنم`
    expect(restoreHalfSpaces(fine)).toBe(fine)
  })
})

describe('normalizePriceGrouping', () => {
  it('rewrites a price grouped with the Persian comma', () => {
    expect(normalizePriceGrouping('قیمتش ۲،۴۷۰،۰۰۰ تومان است')).toBe('قیمتش ۲٬۴۷۰٬۰۰۰ تومان است')
    expect(normalizePriceGrouping('**۸۶۷،۰۰۰ تومان**')).toBe('**۸۶۷٬۰۰۰ تومان**')
  })

  it('keeps a list of numbers a list', () => {
    expect(normalizePriceGrouping('سایز ۱۴۰،۱۶۰،۱۹۰ داریم')).toBe('سایز ۱۴۰،۱۶۰،۱۹۰ داریم')
  })
})
