import { describe, expect, it } from 'vitest'
import { queryTokens } from '@/lib/ai/catalog-tools'

// Price, ranking and budget words belong to sort/max_price arguments. Left in
// the keywords they are required matches no product carries, so the search
// returned nothing for «ارزون‌ترین میز تلویزیون» and «جلومبلی زیر ۱۰ میلیون».
describe('catalog query keywords', () => {
  it('drops superlative price words from the keywords', () => {
    expect(queryTokens('ارزون‌ترین میز تلویزیون')).toEqual(['میز', 'تلویزیون'])
    expect(queryTokens('میز تلویزیون ارزان ترین')).toEqual(['میز', 'تلویزیون'])
    expect(queryTokens('گرون‌ترین پالت سایه')).toEqual(['پالت', 'سایه'])
  })

  it('moves a budget phrase out of the keywords', () => {
    expect(queryTokens('جلومبلی زیر ۱۰ میلیون')).toEqual(['جلومبلی'])
    expect(queryTokens('کمد تا ۵۰۰ هزار تومان')).toEqual(['کمد'])
    expect(queryTokens('جلومبلی زیر 10 میلیون')).toEqual(['جلومبلی'])
  })

  it('keeps words that only look like price language', () => {
    expect(queryTokens('کرم زیر چشم')).toEqual(['کرم', 'زیر', 'چشم'])
    expect(queryTokens('عطر هزار و یک شب')).toEqual(['عطر', 'هزار'])
    expect(queryTokens('لواشک ترش')).toEqual(['لواشک', 'ترش'])
  })

  it('keeps size numbers that are not attached to a currency unit', () => {
    expect(queryTokens('پاف نیمکتی سایز ۱۲۰')).toEqual(['پاف', 'نیمکتی', '120'])
  })
})
