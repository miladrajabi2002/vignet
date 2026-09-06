import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('admin user detail tab panels (v3.5)', () => {
  const page = () => source('app/admin/(dash)/users/[userId]/page.tsx')

  it('exposes the six per-user tabs the operator asked for', () => {
    const src = page()
    expect(src).toContain("key: 'overview', label: 'خلاصه'")
    expect(src).toContain("key: 'conversations', label: 'گفتگوها'")
    expect(src).toContain("key: 'channels', label: 'کانال‌ها'")
    expect(src).toContain("key: 'knowledge', label: 'دانش'")
    expect(src).toContain("key: 'products', label: 'محصولات'")
    expect(src).toContain("key: 'orders', label: 'سفارش‌ها'")
  })

  it('renders conversations as clickable rows leading to the transcript page', () => {
    const src = page()
    expect(src).toContain('href={`/admin/conversations/${c.id}`}')
    // conversation rows include the contact identity, channel and status
    expect(src).toContain("c.contact?.name || displayPhone(c.contact?.phone) || 'مخاطب ناشناس'")
  })

  it('loads tab data conditionally instead of fetching everything at once', () => {
    const src = page()
    expect(src).toContain("tab === 'conversations'")
    expect(src).toContain("tab === 'channels'")
    expect(src).toContain("tab === 'knowledge'")
    expect(src).toContain("tab === 'products'")
    expect(src).toContain("tab === 'orders'")
  })

  it('shows business KPIs: customers, orders, products, conversations, channels, knowledge', () => {
    const src = page()
    expect(src).toContain('label="مشتریان"')
    expect(src).toContain('label="سفارش‌ها"')
    expect(src).toContain('label="محصولات"')
    expect(src).toContain('label="ایجنت‌ها"')
    expect(src).toContain('label="اتصال کانال فعال"')
    // contact health is computed from real data
    expect(src).toContain('contact.count')
    expect(src).toContain('storeOrder')
  })

  it('keeps every tab mobile-friendly with card lists and a scrollable tab bar', () => {
    const src = page()
    expect(src).toContain('grid gap-3 md:hidden')
    expect(src).toContain('hidden md:block')
    expect(src).toContain('overflow-x-auto')
    expect(src).toContain('[scrollbar-width:none]')
  })

  it('renders store money (products/orders) in Toman without Rial labels', () => {
    const src = page()
    expect(src).toContain('function fmtStoreMoney')
    expect(src).toContain("'IRR'")
    expect(src).toContain('تومان')
    expect(src).not.toContain('ریال')
  })
})

describe('admin users list without the redundant business column (v3.5)', () => {
  const page = () => source('app/admin/(dash)/users/page.tsx')
  const cards = () => source('components/admin/admin-user-mobile-cards.tsx')

  it('drops the کسب‌وکار column and replaces it with a status column', () => {
    const src = page()
    expect(src).toContain('<Th>وضعیت</Th>')
    expect(src).not.toContain('<Th>کسب‌وکار</Th>')
    // every user owns exactly one workspace (1:1) — the workspace KPI is gone
    expect(src).not.toContain('label="کسب‌وکارها"')
    expect(src).toContain('label="مشتریان ثبت‌شده"')
    expect(src).toContain('contact.count')
  })

  it('mobile cards no longer duplicate the workspace name as a separate business row', () => {
    const src = cards()
    expect(src).not.toContain('مشاهده کسب‌وکار')
    expect(src).not.toContain('/admin/workspaces/')
    expect(src).toContain('label="محصولات"')
  })
})

describe('admin panel Toman-only price display (v3.5)', () => {
  it('agent detail shows 30-day AI spend in Toman', () => {
    const src = source('app/admin/(dash)/agents/[agentId]/page.tsx')
    expect(src).toContain('value={fmtIRR(usage._sum.chargedIRR ?? 0)}')
    expect(src).not.toContain('ریال')
  })

  it('revenue page quotes the USD rate in Toman', () => {
    const src = source('app/admin/(dash)/revenue/page.tsx')
    expect(src).toContain('Math.round(finance.usdToIRR / 10)')
    expect(src).not.toContain('} ریال')
  })

  it('AI usage page no longer advertises rial amounts', () => {
    const src = source('app/admin/(dash)/ai/page.tsx')
    expect(src).not.toContain('مجموع مبلغ ریالی')
  })

  it('platform settings form edits money as Toman and persists Rial', () => {
    const src = source('components/admin/platform-settings-form.tsx')
    expect(src).toContain('const TOMAN_SCALE = 10')
    expect(src).toContain("suffix=\"تومان\"")
    expect(src).toContain('function toToman(')
    // plan capacity limits must NOT be scaled
    expect(src).toContain("setNumber(['plans', plan, 'maxChannels'], raw)")
    expect(src).not.toContain('suffix="ریال"')
    expect(src).not.toContain('قیمت ماهانه ریال')
    expect(src).not.toContain('اعتبار هدیه ریال')
  })
})
