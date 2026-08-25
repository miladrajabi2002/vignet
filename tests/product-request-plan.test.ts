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
    expect(planProductRequest('آیا ارسال به مریخ رایگان است؟ اگر اطلاعات قطعی نداری حدس نزن.', []).isProductTurn).toBe(false)
    expect(planProductRequest('اگر اطلاعات بیشتری نداری صادقانه بگو', []).isProductTurn).toBe(false)
    expect(planProductRequest('کوله پشتی دارید؟', []).isProductTurn).toBe(true)
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

  it('treats a broad "what do you have" as consultative discovery, not a dump', () => {
    const browse = planProductRequest('چی دارین برای فروش ؟', [])
    expect(browse.isProductTurn).toBe(true)
    expect(browse.explicitShowcase).toBe(false)
    expect(browse.discoveryBrowse).toBe(true)
    expect(browse.requestedCount).toBe(6)

    const english = planProductRequest('what do you have?', [])
    expect(english.discoveryBrowse).toBe(true)

    // A specific product question is a normal consult turn, not discovery.
    const specific = planProductRequest('پیراهن سایز بزرگ دارید؟', [])
    expect(specific.discoveryBrowse).toBe(false)
    expect(specific.isProductTurn).toBe(true)

    // An explicit imperative or count keeps the direct showcase path.
    expect(planProductRequest('محصولاتتون رو نشون بده', []).explicitShowcase).toBe(true)
    expect(planProductRequest('۵ تا پیراهن بفرست ببینم', []).explicitShowcase).toBe(true)
    expect(planProductRequest('۵ تا پیراهن بفرست ببینم', []).discoveryBrowse).toBe(false)
  })

  it('completes a browse into a showcase on "show all" or an accepted offer', () => {
    const browseHistory = [
      user('چی دارین برای فروش ؟'),
      assistant('ما انواع پیراهن و ست داریم. دنبال چه مدلی هستید؟ اگر بخواید همه محصولات پرطرفدار رو نشونتون می‌دم.'),
    ]
    const showAll = planProductRequest('همه رو نشون بده', browseHistory)
    expect(showAll.explicitShowcase).toBe(true)
    expect(showAll.requestedCount).toBe(10)

    const bareYes = planProductRequest('آره', browseHistory)
    expect(bareYes.explicitShowcase).toBe(true)
    // The affirmative word itself must never become a catalog search term.
    expect(bareYes.searchTerms).toEqual([])
    expect(planProductRequest('بله نشون بده', browseHistory).explicitShowcase).toBe(true)

    // An accepted offer after a specific product question keeps its terms.
    const shirtHistory = [
      user('پیراهن مردونه دارید؟'),
      assistant('بله چند مدل داریم. می‌خواید پرطرفدارترین‌ها رو نشونتون بدم؟'),
    ]
    const acceptedShirt = planProductRequest('آره', shirtHistory)
    expect(acceptedShirt.explicitShowcase).toBe(true)
    expect(acceptedShirt.searchTerms).toContain('پیراهن')

    // A bare "yes" answering a non-showcase question must never dump products,
    // even when the assistant text contains filler like «ببینید» and «در مورد».
    const orderHistory = [
      user('پیراهن آبی دارید؟'),
      assistant('ببینید، برای ثبت سفارش باید آدرستون رو بدید. در مورد زمان ارسال هم ۳ روز کاریه. سفارش رو ثبت کنم؟'),
    ]
    expect(planProductRequest('بله', orderHistory).explicitShowcase).toBe(false)
  })

  it('handles reset+browse, greeting words and filler numbers correctly', () => {
    // Reset AND new browse in one message: consult, not the canned reset reply.
    const resetBrowse = planProductRequest('بیخیال، چی دارین؟', [user('کفش دارید؟')])
    expect(resetBrowse.requestNewTopic).toBe(false)
    expect(resetBrowse.discoveryBrowse).toBe(true)
    expect(resetBrowse.resetProductContext).toBe(true)

    // A reset with no product content still asks for the new request.
    expect(planProductRequest('بیخیال، این بدرد نمیخوره', []).requestNewTopic).toBe(true)

    // «وقت بخیر» is a greeting, not an appointment topic.
    const greeted = planProductRequest('سلام وقت بخیر، چی دارین برای فروش؟', [])
    expect(greeted.isProductTurn).toBe(true)
    expect(greeted.discoveryBrowse).toBe(true)

    // «یه سوال» is not a request for exactly one product.
    const filler = planProductRequest('یه سوال، چی دارید؟', [])
    expect(filler.discoveryBrowse).toBe(true)
    expect(filler.requestedCount).toBe(6)
    expect(planProductRequest('یه محصول موجود معرفی کن', []).requestedCount).toBe(1)
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
