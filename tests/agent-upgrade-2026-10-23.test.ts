import { describe, expect, it } from 'vitest'
import { customerAuthoredText } from '@/lib/ai/handoff'
import { correctCatalogTerm } from '@/lib/search/fuzzy-terms'
import { applyProductJudgement } from '@/lib/agent/turn/product-judge'
import { extractTurnSignal } from '@/lib/ai/turn-signal'
import { detectTurnLanguage } from '@/lib/ai/turn-language'
import { handoffPromptMismatch } from '@/lib/agent/config-lint'
import { BUILT_IN_HANDOFF_NOTICES, HANDOFF_REPLIES } from '@/lib/ai/handoff-replies'
import type { CatalogProduct } from '@/lib/ai/rag'

const product = (id: string, name: string): CatalogProduct => ({
  id, name, description: null, price: 1000, stock: 1, category: null, image: null, url: null, attributes: {}, tags: [],
})

describe('handoff keywords read the customer, not the machine', () => {
  it('drops a vision description appended to the message', () => {
    const message = 'سلام قیمت این غذاساز\n\n[محتوای تصویر ارسالی مشتری — توصیف معتبر بینایی ماشین]\n- نوع محصول: غذاساز\n- انسان: ندارد'
    expect(customerAuthoredText(message)).toBe('سلام قیمت این غذاساز')
  })
  it('drops a story description and keeps a voice transcript', () => {
    expect(customerAuthoredText('این چنده؟\n\n[استوری‌ای که مشتری رویش پیام داده — توصیف بینایی ماشین]\nرژ لب')).toBe('این چنده؟')
    expect(customerAuthoredText('[متن پیام صوتی]\nبا اپراتور کار دارم')).toContain('اپراتور')
  })
})

describe('glued compounds split into catalog words', () => {
  const vocabulary = new Set(['رژ', 'گونه', 'استامپی', 'شیگلم', 'میزتلویزیون'])
  it('«رژگونه استامپی» → «رژ گونه استامپی»', () => {
    expect(correctCatalogTerm('رژگونه استامپی', vocabulary)).toBe('رژ گونه استامپی')
  })
  it('still glues the split form the catalog writes glued', () => {
    expect(correctCatalogTerm('میز تلویزیون', vocabulary)).toBe('میزتلویزیون')
  })
  it('leaves known words and codes alone', () => {
    expect(correctCatalogTerm('شیگلم', vocabulary)).toBeNull()
    expect(correctCatalogTerm('AK91', vocabulary)).toBeNull()
  })
})

describe('product judge verdicts', () => {
  const rows = [product('a', 'ست حالت دهنده مو'), product('b', 'کلیپس مو'), product('c', 'سرخ کن')]
  it('none empties the list', () => {
    expect(applyProductJudgement(rows, { kind: 'none', ids: [] })).toEqual([])
  })
  it('exact keeps the chosen rows in the judge order', () => {
    expect(applyProductJudgement(rows, { kind: 'exact', ids: ['b'] }).map((row) => row.id)).toEqual(['b'])
  })
  it('similar marks the rows as close alternatives', () => {
    const [row] = applyProductJudgement(rows, { kind: 'similar', ids: ['c'] })
    expect(row.nearMatch).toBe(true)
    expect(row.fullTermMatch).toBe(false)
  })
  it('no verdict keeps the search result', () => {
    expect(applyProductJudgement(rows, null)).toBe(rows)
  })
})

describe('turn signal follow-up commitment', () => {
  it('reads f=y as a declared human follow-up', () => {
    const { text, signal } = extractTurnSignal('همکارم با شما تماس می‌گیرد\n[[st:m=neu;b=1;a=p;t=info;c=human;o=-;f=y]]')
    expect(text).toBe('همکارم با شما تماس می‌گیرد')
    expect(signal?.followUp).toBe(true)
  })
  it('older lines without f stay valid', () => {
    expect(extractTurnSignal('جواب\n[[st:m=neu;b=1;a=y;t=stock;c=-;o=-]]').signal).not.toHaveProperty('followUp')
  })
})

describe('reply language of a bare Latin name', () => {
  it('opens a Persian store chat in Persian', () => {
    expect(detectTurnLanguage('ninja af400', [], 'fa')).toBe('fa')
  })
  it('a real English sentence stays English', () => {
    expect(detectTurnLanguage('do you have the ninja af400?', [], 'fa')).toBe('en')
  })
})

describe('owner config warnings', () => {
  it('flags a prompt that asks for transfers while handoff is off', () => {
    expect(handoffPromptMismatch({ handoffEnabled: false, promptConfig: { fallbackBehavior: 'شماره بگیر و به اپراتور تحویل بده' } })).toContain('اپراتور')
  })
  it('is quiet when handoff is on', () => {
    expect(handoffPromptMismatch({ handoffEnabled: true, promptConfig: { fallbackBehavior: 'به اپراتور تحویل بده' } })).toEqual([])
  })
})

describe('built-in handoff lines', () => {
  it('still recognise the lines stored before the rewrite', () => {
    expect(BUILT_IN_HANDOFF_NOTICES).toContain('برای ادامه دقیق‌تر گفتگو، شما را همراه با خلاصه صحبت‌ها به یک کارشناس انسانی متصل می‌کنم.')
    expect(BUILT_IN_HANDOFF_NOTICES).toContain(HANDOFF_REPLIES.explicit.fa)
  })
})
