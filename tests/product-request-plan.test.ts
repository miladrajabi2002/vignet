import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { historyForProductTurn, planProductRequest } from '@/lib/ai/conversation'

const user = (content: string): ChatMessage => ({ role: 'user', content })
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content })

describe('product request planning', () => {
  it('does not turn generic send/list verbs into a product showcase', () => {
    expect(planProductRequest('این پیام رو بفرست', []).explicitShowcase).toBe(false)
    expect(planProductRequest('لیست سفارش‌ها رو نشون بده', []).isProductTurn).toBe(false)
    expect(planProductRequest('خدمات موجود و وقت‌های رزرو رو نشون بده', []).isProductTurn).toBe(false)
    expect(planProductRequest('قیمت خدمات موجود رو بفرست', []).isProductTurn).toBe(false)
    const serviceHistory = [user('خدمات موجود رو نشون بده')]
    expect(planProductRequest('۵ تا بفرست', serviceHistory).explicitShowcase).toBe(false)
  })

  it('extracts a broad product category and honors the 10-card ceiling', () => {
    const plan = planProductRequest('سلام هرچی پیراهن موجود داری بهم نشون بده', [])

    expect(plan.explicitShowcase).toBe(true)
    expect(plan.requestedCount).toBe(10)
    expect(plan.inventoryMode).toBe('AVAILABLE')
    expect(plan.searchTerms).toContain('پیراهن')
    expect(planProductRequest('یه محصول موجود معرفی کن', []).requestedCount).toBe(1)
  })

  it('carries product terms into a count-only follow-up and clamps counts above ten', () => {
    const history = [user('هرچی پیراهن موجود داری نشون بده'), assistant('حتماً')]
    const followUp = planProductRequest('میشه ۵ تا بدون هیچ سوالی بفرستی ببینم', history)
    const oversized = planProductRequest('۲۰ تا محصول موجود بفرست', [])

    expect(followUp.explicitShowcase).toBe(true)
    expect(followUp.requestedCount).toBe(5)
    expect(followUp.searchTerms).toContain('پیراهن')
    expect(oversized.requestedCount).toBe(10)
  })

  it('keeps a generic available-products request broad when embeddings are unavailable', () => {
    const plan = planProductRequest('۵ تا از محصولات موجودتون رو بفرستین', [])

    expect(plan.explicitShowcase).toBe(true)
    expect(plan.requestedCount).toBe(5)
    expect(plan.inventoryMode).toBe('AVAILABLE')
    expect(plan.searchTerms).toEqual([])

    const resetAndShow = planProductRequest('قبلی رو بیخیال، محصولات دیگه نشون بده', [])
    expect(resetAndShow.explicitShowcase).toBe(true)
    expect(resetAndShow.requestNewTopic).toBe(false)
    expect(resetAndShow.searchTerms).toEqual([])
  })

  it('keeps messages before a reset out of later model history', () => {
    const history = [
      user('پیراهن ماکسی نشون بده'),
      assistant('اطلاعات قدیمی'),
      user('بیخیال، این اطلاعات بدرد نمیخوره'),
      assistant('باشه'),
      user('درخواست تازه من اینه'),
    ]
    const scoped = historyForProductTurn(history, planProductRequest('ادامه بده', history))

    expect(scoped.map((item) => item.content)).toEqual(['باشه', 'درخواست تازه من اینه'])
  })
})
