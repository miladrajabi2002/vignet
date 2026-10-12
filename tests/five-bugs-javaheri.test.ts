import { describe, expect, it } from 'vitest'
import { extractProductTerms, normalizePersianText } from '@/lib/ai/conversation'

const JAVAHERI_CORPUS = [
  'میز', 'تلویزیون', 'جلومبلی', 'پذیرایی', 'پاف', 'نیمکتی', 'نقش', 'نگار', 'ست',
  'طرح', 'کاشانه', 'سلین', 'ایوان', 'شهداد', 'قمصر', 'لاهیجان', 'ترکمن', 'آکام', 'چوب',
]

describe('Persian copula enclitic «ست» (Javaheri issue 5 root cause)', () => {
  it('strips the ZWNJ-attached enclitic but keeps the set noun', () => {
    // «ساده‌ست» → «ساده» — the enclitic must vanish…
    expect(normalizePersianText('مدل نگار به نظرم خیلی ساده‌ست')).not.toMatch(/ست/)
    expect(normalizePersianText('خیلی ساده‌ست.')).not.toMatch(/ست/)
    // …while a standalone «ست» (set noun) survives normalization.
    expect(normalizePersianText('ست پذیرایی دارین؟')).toContain('ست')
  })

  it('keeps the enclitic out of search terms and anchors', () => {
    const terms = extractProductTerms('مدل نگار به نظرم خیلی ساده‌ست')
    expect(terms).not.toContain('ست')
    expect(terms).not.toContain('خیلی')
    expect(terms).not.toContain('نظر')
    expect(terms).toContain('نگار')
  })

  it('drops the SPACE-separated copula «ست» but keeps the set noun', () => {
    // «ساده ست» typed with a plain space — same copula, harder to spot.
    expect(extractProductTerms('مدل نگار به نظرم خیلی ساده ست')).not.toContain('ست')
    expect(extractProductTerms('قیمتش گرون ست')).not.toContain('ست')
    // …while real set-noun usage survives.
    expect(extractProductTerms('ست پذیرایی دارین؟')).toContain('ست')
    expect(extractProductTerms('یه ست میخوام')).toContain('ست')
  })
})

describe('colloquial variant plurals', () => {
  it('normalizes «طرحات» to the variant noun (a stop word, not an opaque term)', () => {
    const terms = extractProductTerms('طرحات چیه')
    expect(terms).not.toContain('طرحات')
  })
})
