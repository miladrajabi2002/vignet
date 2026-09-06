import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('admin user detail tab panels (v3.6)', () => {
  const page = () => source('app/admin/(dash)/users/[userId]/page.tsx')

  it('exposes five per-user tabs (conversations tab removed by request)', () => {
    const src = page()
    expect(src).toContain("key: 'overview', label: 'خلاصه'")
    expect(src).toContain("key: 'channels', label: 'کانال‌ها'")
    expect(src).toContain("key: 'knowledge', label: 'دانش'")
    expect(src).toContain("key: 'products', label: 'محصولات'")
    expect(src).toContain("key: 'orders', label: 'سفارش‌ها'")
    expect(src).not.toContain("key: 'conversations'")
    expect(src).not.toContain("tab === 'conversations'")
  })

  it('removes the channel disconnection alarm entirely', () => {
    const src = page()
    expect(src).not.toContain('HEALTH_STATUS')
    expect(src).not.toContain('healthStatus')
    expect(src).not.toContain('healthCheckedAt')
    expect(src).not.toContain('HeartPulse')
    expect(src).not.toContain('<Th>سلامت</Th>')
    expect(src).not.toContain('label="سلامت کانال"')
  })

  it('renders the overview inbox with avatars, last message, status and channel badges', () => {
    const src = page()
    // rows stay clickable and lead to the transcript page
    expect(src).toContain('href={`/admin/conversations/${item.id}`}')
    expect(src).toContain('ContactAvatar')
    expect(src).toContain('ConversationStatusBadge')
    expect(src).toContain('ChannelBadge')
    expect(src).toContain('stripProductTokens')
    expect(src).toContain('relativeTime(item.when')
    // link to the full per-user conversation list uses the phone filter
    expect(src).toContain('/admin/conversations?q=${encodeURIComponent(user.phone)}')
  })

  it('shows the login report (آخرین ورود + گزارش ورود) from LoginEvent', () => {
    const src = page()
    expect(src).toContain('prisma.loginEvent.findMany')
    expect(src).toContain('prisma.loginEvent.count')
    expect(src).toContain('آخرین ورود به پنل')
    expect(src).toContain('گزارش ورود به پنل')
    expect(src).toContain('describeDevice')
    expect(src).toContain('isNewUser')
  })

  it('shows the SMS delivery report for this phone number', () => {
    const src = page()
    expect(src).toContain('prisma.smsDelivery.findMany')
    expect(src).toContain('prisma.smsDelivery.count')
    expect(src).toContain('پیامک‌های ارسال‌شده')
    expect(src).toContain('SMS_KIND_LABEL')
  })

  it('loads tab data conditionally instead of fetching everything at once', () => {
    const src = page()
    expect(src).toContain("tab === 'channels'")
    expect(src).toContain("tab === 'knowledge'")
    expect(src).toContain("tab === 'products'")
    expect(src).toContain("tab === 'orders'")
  })

  it('shows business KPIs: customers, orders, products, conversations, agents, channels', () => {
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
    expect(src).toContain('grid gap-2 md:hidden')
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

describe('login + SMS delivery tracking (v3.6)', () => {
  it('records a LoginEvent and lastLoginAt on every successful OTP sign-in', () => {
    const src = source('auth.ts')
    expect(src).toContain('prisma.loginEvent.create')
    expect(src).toContain('prisma.user.update')
    expect(src).toContain('lastLoginAt: new Date()')
    expect(src).toContain("request.headers.get('user-agent')")
    // failures must never block the sign-in itself
    expect(src).toContain('captureWarning')
  })

  it('records every OTP and pattern SMS in SmsDelivery', () => {
    const src = source('lib/sms/ippanel.ts')
    expect(src).toContain('prisma.smsDelivery.create')
    expect(src).toContain('recordSmsDelivery')
    expect(src).toContain('SMS_KIND_BY_SOURCE')
    expect(src).toContain("kind: 'OTP', status: 'SENT'")
    expect(src).toContain("kind: 'OTP', status: 'FAILED'")
  })

  it('backfilled history tables exist in the schema', () => {
    const src = source('prisma/schema.prisma')
    expect(src).toContain('model LoginEvent')
    expect(src).toContain('model SmsDelivery')
    expect(src).toContain('lastLoginAt  DateTime?')
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
