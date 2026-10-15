import { describe, expect, it } from 'vitest'
import { describePrepay, prepayAmount } from '@/lib/payments/card/prepay'
import { parseOperatorBotCallback } from '@/lib/channels/operator-bot'
import { readPayLinkInput } from '@/lib/channels/operator-bot-pay'
import { cardPayHeading, composeCardPayNotice, parseCardPayDirective, cardPayMarker, type CardPayView } from '@/lib/payments/card/pay-card'
import { paymentAlertButtons } from '@/lib/payments/card/bot-buttons'
import { CARD_PAY_ATTACHMENT, paymentSubject, takeCardPayAttachment } from '@/lib/payments/card/prepay-service'

const ID = 'cmabcdefghijklmnopqrstuvw'

describe('advance payment amount', () => {
  it('fixed, percent and full', () => {
    expect(prepayAmount('FIXED', 200_000, 900_000)).toBe(200_000)
    expect(prepayAmount('FIXED', 200_000, null, 3)).toBe(600_000)
    expect(prepayAmount('PERCENT', 30, 900_000)).toBe(270_000)
    expect(prepayAmount('PERCENT', 150, 100_000)).toBe(100_000)
    expect(prepayAmount('FULL', null, 450_000, 2)).toBe(900_000)
  })
  it('nothing due when it cannot be applied', () => {
    expect(prepayAmount('NONE', 200_000, 900_000)).toBeNull()
    expect(prepayAmount('PERCENT', 30, null)).toBeNull()
    expect(prepayAmount('FULL', null, 0)).toBeNull()
    expect(prepayAmount('FIXED', 500, 900_000)).toBeNull()
    expect(prepayAmount('bogus', 1, 1)).toBeNull()
  })
  it('explains itself', () => {
    expect(describePrepay('PERCENT', 30, 900_000, 'fa')).toContain('۲۷۰٬۰۰۰')
    expect(describePrepay('PERCENT', 30, null, 'fa')).toContain('قیمت')
  })
})

describe('manager bot payment buttons', () => {
  it('parses every payment callback', () => {
    expect(parseOperatorBotCallback('m:pay')).toEqual({ type: 'screen', screen: 'pay' })
    expect(parseOperatorBotCallback('py:l:r:2')).toEqual({ type: 'payList', filter: 'r', page: 2 })
    expect(parseOperatorBotCallback(`py:v:${ID}`)).toEqual({ type: 'payment', action: 'view', paymentId: ID })
    expect(parseOperatorBotCallback(`py:y:${ID}`)).toMatchObject({ action: 'askConfirm' })
    expect(parseOperatorBotCallback(`py:Y:${ID}`)).toMatchObject({ action: 'confirm' })
    expect(parseOperatorBotCallback(`py:N:${ID}`)).toMatchObject({ action: 'reject' })
    expect(parseOperatorBotCallback(`py:X:${ID}`)).toMatchObject({ action: 'cancel' })
    expect(parseOperatorBotCallback('ps:l')).toEqual({ type: 'smsList' })
    expect(parseOperatorBotCallback(`ps:i:${ID}`)).toEqual({ type: 'sms', action: 'ignore', smsId: ID })
    expect(parseOperatorBotCallback(`ps:a:${ID}:${ID}`)).toEqual({ type: 'smsAttach', smsId: ID, paymentId: ID })
    expect(parseOperatorBotCallback('pn:new')).toEqual({ type: 'payLink' })
    expect(parseOperatorBotCallback('pg:p')).toEqual({ type: 'gateway', action: 'pause' })
    expect(parseOperatorBotCallback('p:payments')).toEqual({ type: 'pref', key: 'payments' })
    expect(parseOperatorBotCallback('py:l:z:0')).toBeNull()
  })
  it('callback data fits Telegram’s 64 bytes', () => {
    for (const data of [`ps:a:${ID}:${ID}`, `py:Y:${ID}`]) expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64)
    for (const row of paymentAlertButtons({ id: ID, status: 'CLAIMED' })) {
      for (const button of row) expect(Buffer.byteLength(button.callback_data ?? '')).toBeLessThanOrEqual(64)
    }
  })
  it('approve/reject only while the payment is open', () => {
    expect(paymentAlertButtons({ id: ID, status: 'CLAIMED' }).flat().map((b) => b.callback_data)).toContain(`py:y:${ID}`)
    expect(paymentAlertButtons({ id: ID, status: 'PAID' }).flat().map((b) => b.callback_data)).toEqual([`py:v:${ID}`])
  })
  it('reads a typed amount', () => {
    expect(readPayLinkInput('250000')).toEqual({ amount: 250_000, description: null })
    expect(readPayLinkInput('۲۵۰,۰۰۰ سفارش تلفنی خانم احمدی')).toEqual({ amount: 250_000, description: 'سفارش تلفنی خانم احمدی' })
    expect(readPayLinkInput('سلام')).toBeNull()
  })
})

describe('booking and course cards', () => {
  const view: CardPayView = {
    code: 'N-7KQ2M', authority: 'Pabc', url: 'https://vigent.ir/pay/Pabc', bankKey: 'mellat', pan: '6104337712345675',
    holder: 'نگار', amount: 270_347, expiresAt: new Date(Date.now() + 600_000).toISOString(), claim: true, status: 'PENDING', lang: 'fa',
    title: 'بیعانهٔ نوبت کوتاهی مو',
  }
  it('the heading names what is paid for and survives the marker', () => {
    expect(cardPayHeading(view)).toBe('بیعانهٔ نوبت کوتاهی مو')
    expect(cardPayHeading({ ...view, title: null })).toBe('سفارش N-7KQ2M')
    expect(parseCardPayDirective(`نوبت نگه داشته شد\n${cardPayMarker(view)}`).cardPay?.title).toBe('بیعانهٔ نوبت کوتاهی مو')
  })
  it('customer notices speak about the booking, not an order', () => {
    const paid = composeCardPayNotice({ status: 'PAID', code: 'N-1', amount: 270_000, lang: 'fa', purpose: 'BOOKING', subject: 'کوتاهی مو' })
    expect(paid).toContain('نوبت «کوتاهی مو» قطعی شد')
    expect(composeCardPayNotice({ status: 'EXPIRED', code: 'C-1', amount: 1, lang: 'fa', purpose: 'COURSE', subject: 'عکاسی' })).toContain('آزاد شد')
    expect(composeCardPayNotice({ status: 'PAID', code: 'A1', amount: 1000, lang: 'fa' })).toContain('سفارش A1')
  })
  it('the card never reaches the model', () => {
    const output: Record<string, unknown> = { ok: true, status: 'AWAITING_PAYMENT', [CARD_PAY_ATTACHMENT]: view }
    expect(takeCardPayAttachment(output)?.pan).toBe(view.pan)
    expect(JSON.stringify(output)).not.toContain(view.pan)
    expect(takeCardPayAttachment({ ok: true })).toBeNull()
  })
  it('names payments by purpose', () => {
    expect(paymentSubject({ purpose: 'BOOKING', reference: 'N-1', description: 'کوتاهی مو' })).toBe('بیعانهٔ نوبت کوتاهی مو')
    expect(paymentSubject({ purpose: 'ORDER', reference: 'A7', description: null })).toBe('سفارش A7')
  })
})
