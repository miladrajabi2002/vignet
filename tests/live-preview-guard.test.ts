import { describe, expect, it } from 'vitest'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { createLivePreviewGuard } from '@/lib/agent-kernel/postprocess'

const plan = compileAgentSkillPlan({ language: 'fa', userMessage: 'سلام', history: [] })

/** Feeds the text in small chunks like a provider stream and records every draft. */
function stream(text: string, guard: (visible: string) => string, step = 3): string[] {
  const drafts: string[] = []
  for (let end = step; end < text.length + step; end += step) drafts.push(guard(text.slice(0, end)))
  return drafts
}

describe('live preview guard', () => {
  it('holds the sentence being written; the final replace delivers it', () => {
    const guard = createLivePreviewGuard(plan, { userMessage: 'سلام' })
    expect(stream('سلام! خوش اومدید', guard).at(-1)).toBe('سلام!')
    expect(guard('سلام! خوش اومدید.')).toBe('سلام!')
  })

  it('shows finished sentences only and grows as a prefix', () => {
    const guard = createLivePreviewGuard(plan, { userMessage: 'قیمت میز چنده؟' })
    const drafts = stream('قیمتش ۲ میلیون تومنه. رنگ سفید هم داریم. سایز', guard)

    expect(drafts.at(-1)).toBe('قیمتش ۲ میلیون تومنه. رنگ سفید هم داریم.')
    for (let index = 1; index < drafts.length; index += 1) {
      expect(drafts[index].startsWith(drafts[index - 1])).toBe(true)
    }
  })

  it('freezes before a fabricated payment link', () => {
    const guard = createLivePreviewGuard(plan, { userMessage: 'لینک پرداخت رو بفرست' })
    const drafts = stream('حتماً. لینک پرداخت: https://shop.ir/checkout/order-pay/12?pay_for_order=true و بعدش هم ارسال می‌شه.', guard)

    expect(drafts.at(-1)).toBe('حتماً.')
    expect(drafts.some((draft) => draft.includes('order-pay'))).toBe(false)
  })

  it('freezes before a false completed-order claim', () => {
    const guard = createLivePreviewGuard(plan, { userMessage: 'باشه همینو می‌خوام' })
    const drafts = stream('عالیه. سفارش شما ثبت شد و فردا ارسال می‌شه. ممنون.', guard)

    expect(drafts.at(-1)).toBe('عالیه.')
  })

  it('keeps a grounded order status visible', () => {
    const guard = createLivePreviewGuard(plan, { userMessage: 'سفارش ۱۲۳ کجاست؟', hasGroundedOrder: true })
    const drafts = stream('سفارش شما ارسال شده. کد رهگیری رو پیامک کردیم.\n', guard)

    expect(drafts.at(-1)).toBe('سفارش شما ارسال شده. کد رهگیری رو پیامک کردیم.')
  })

  it('withholds the whole draft when the final reply will be replaced', () => {
    const guard = createLivePreviewGuard(plan, { userMessage: 'سفارش رو ثبت کنید لطفاً', orderCaptureEnabled: false })
    const drafts = stream('حتماً. فقط اسم و آدرس رو بفرستید.', guard)

    expect(drafts.every((draft) => draft === '')).toBe(true)
  })

  it('freezes before a discount grant when the agent sells in chat', () => {
    const guard = createLivePreviewGuard(plan, { userMessage: 'تخفیف نداره؟', orderCaptureEnabled: true })
    const drafts = stream('قیمت همونه. براتون ۱۰ درصد تخفیف می‌ذارم.', guard)

    expect(drafts.at(-1)).toBe('قیمت همونه.')
  })

  it('keeps a conditional follow-up offer but stops an unconditional promise', () => {
    const offer = createLivePreviewGuard(plan, { userMessage: 'سؤال دارم' })
    expect(stream('اگه بخواید به همکارم می‌سپارم تا بررسی کنه.\n', offer).at(-1)).toBe('اگه بخواید به همکارم می‌سپارم تا بررسی کنه.')

    const promise = createLivePreviewGuard(plan, { userMessage: 'سؤال دارم' })
    expect(stream('سؤال خوبیه. به همکارم منتقل می‌کنم و خبر می‌دم.', promise).at(-1)).toBe('سؤال خوبیه.')
  })
})
