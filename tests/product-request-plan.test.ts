import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { structuredProductDetailReply } from '@/lib/ai/conversation'

const user = (content: string): ChatMessage => ({ role: 'user', content })
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content })

describe('product request planning', () => {

  it('answers a structured material fact without relying on stale assistant prose', () => {
    expect(structuredProductDetailReply({
      product: { name: 'پیراهن شراره 0054', attributes: { 'جنس': 'حریر' } },
      field: 'MATERIAL',
      language: 'fa',
    })).toBe('طبق مشخصات ثبت‌شدهٔ کاتالوگ، جنس پارچهٔ **پیراهن شراره 0054**، **حریر** است')
  })
})
