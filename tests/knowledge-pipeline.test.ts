import { describe, expect, it } from 'vitest'
import { chunkFaq, chunkText } from '@/lib/knowledge/chunker'
import { buildLexicalQuery, normalizePersian } from '@/lib/knowledge/normalize'
import {
  CURATED_BOOST,
  MIN_VECTOR_SIMILARITY,
  rankRetrievedChunks,
} from '@/lib/knowledge/ranking'

describe('knowledge pipeline primitives', () => {
  it('keeps every generic chunk within the configured budget', () => {
    const longSentence = 'عبارت خیلی طولانی بدون نشانه پایان '.repeat(30)
    const chunks = chunkText(longSentence, { maxChars: 120, overlap: 20 })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 120)).toBe(true)
    expect(chunks.join(' ')).toContain('عبارت خیلی طولانی')
  })

  it('keeps each FAQ question with its answer', () => {
    const chunks = chunkFaq(
      'سؤال: هزینه ارسال چقدر است؟\nپاسخ: برای تهران رایگان است.\n\nپرسش: زمان تحویل؟\nپاسخ: دو روز کاری.',
    )

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toContain('هزینه ارسال')
    expect(chunks[0]).toContain('رایگان')
    expect(chunks[1]).toContain('زمان تحویل')
    expect(chunks[1]).toContain('دو روز')
  })

  it('normalizes Persian variants and removes conversational filler from lexical search', () => {
    expect(normalizePersian('كالا‌ي ۱۲٣')).toBe('کالا ی 123')
    expect(buildLexicalQuery('سلام ببخشید می‌خواستم قیمت ارسال فوری رو بدونم'))
      .toBe('قیمت or ارسال or فوری')
  })

  it('drops irrelevant vector-only chunks and lets curated knowledge break close ties', () => {
    const rows = [
      { id: 'irrelevant', similarity: MIN_VECTOR_SIMILARITY - 0.01, hybridScore: 0.9 },
      { id: 'crawl', similarity: 0.7, hybridScore: 0.5, metadata: { source: 'URL' } },
      { id: 'curated', similarity: 0.7, hybridScore: 0.5, metadata: { source: 'FAQ' } },
    ]

    const ranked = rankRetrievedChunks(rows, 5, Date.now())
    expect(ranked.map((row) => row.id)).toEqual(['curated', 'crawl'])
    expect(CURATED_BOOST).toBeGreaterThan(0)
  })
})
