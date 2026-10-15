import { describe, expect, it } from 'vitest'
import { BANKS, detectBank, formatPan, inspectCard, luhnValid } from '@/lib/payments/card/bins'
import { AMOUNT_ID_RANGE, allocateAmount, rialToToman } from '@/lib/payments/card/amount'
import { depositKeywordOf, parseBankSms, readForwardedSms } from '@/lib/payments/card/sms-parse'

describe('bank cards', () => {
  it('keeps every issuer prefix unique', () => {
    const seen = new Set<string>()
    for (const bank of BANKS) {
      for (const bin of [...bank.bins, ...(bank.prefixes8 ?? [])]) {
        expect(seen.has(bin), bin).toBe(false)
        seen.add(bin)
      }
    }
  })

  it('names the bank from the card number, in any digit script', () => {
    expect(detectBank('6037 9975 1234 5678')?.key).toBe('melli')
    expect(detectBank('۶۱۰۴۳۳۷۷۱۲۳۴۵۶۷۸')?.key).toBe('mellat')
    expect(detectBank('5022291012345678')?.key).toBe('pasargad')
    expect(detectBank('6219861912345678')?.key).toBe('blu')
    expect(detectBank('6219860012345678')?.key).toBe('saman')
    expect(detectBank('4111111111111111')).toBeNull()
  })

  it('checks the control digit', () => {
    expect(luhnValid('4111111111111111')).toBe(true)
    expect(luhnValid('4111111111111112')).toBe(false)
    expect(inspectCard('').state).toBe('empty')
    expect(inspectCard('603799').state).toBe('typing')
    expect(inspectCard('4111111111111111').state).toBe('unknown-bank')
    expect(formatPan('6037997512345678')).toBe('6037 9975 1234 5678')
  })
})

describe('payable amount', () => {
  it('is unique, inside the range and always a whole toman', () => {
    const taken = new Set<number>()
    for (let i = 0; i < AMOUNT_ID_RANGE; i++) {
      const amount = allocateAmount(1_250_000, taken)
      expect(amount).not.toBeNull()
      expect(amount!.identifier).toBeGreaterThanOrEqual(1)
      expect(amount!.identifier).toBeLessThanOrEqual(AMOUNT_ID_RANGE)
      expect(amount!.payAmount).toBeGreaterThan(1_250_000)
      expect(taken.has(amount!.payAmount)).toBe(false)
      taken.add(amount!.payAmount)
    }
    expect(allocateAmount(1_250_000, taken)).toBeNull()
    expect(allocateAmount(0, new Set())).toBeNull()
  })

  it('turns a bank SMS amount (rials) into tomans only when it is whole', () => {
    expect(rialToToman(12_503_470)).toBe(1_250_347)
    expect(rialToToman(10_000_232)).toBeNull()
  })
})

// The first two are real deposit messages; the rest follow each bank's usual layout.
const SMS = {
  realMellat: 'حساب8907027623\nواریز303,210,000\nمانده452,963,014\n05/07/15-11:33',
  realMelli: 'انتقال اينترنت:‎+10,000,232‎\nحساب:152601422685\nمانده:136,553,207\n0721-15:38',
  melli: 'بانک ملی\nانتقال:12,503,470+\nحساب:0123456789012\nمانده:8,420,000\n0522-14:35',
  saman: 'بانک سامان\nواریز مبلغ ۱۲,۵۰۳,۴۷۰ ریال به حساب 849-800-1234567-1\nموجودی: 91,220,000 ریال\n1404/05/22 14:35',
  tejarat: 'واریز: +12,503,470\nحساب: 1234567\nمانده: 20,000,000\n05/22_14:35',
  pasargad: 'واريز به سپرده 201.8000.1234567.1\nمبلغ: 12,503,470 ريال\nموجودي: 55,000,000\n1404/05/22',
  tomanApp: 'واریز 1,250,347 تومان به کارت شما انجام شد. موجودی 4,000,000 تومان',
  withdraw: 'حساب9876543210\nبرداشت12,503,470\nمانده137,496,530\n040522-14:40',
  withdrawSign: 'بانک ملی\nانتقال:12,503,470-\nحساب:0123456789012\nمانده:8,420,000',
  otp: 'خرید\nمبلغ 12,503,470 ریال\nرمز 482913\nزمان اعتبار 14:37',
  junk: 'مشتری گرامی، با همراه بانک قبض‌های خود را پرداخت کنید.',
}

describe('bank SMS', () => {
  it('reads the two real deposit messages', () => {
    const mellat = parseBankSms(SMS.realMellat)
    expect(mellat.kind).toBe('deposit')
    expect(mellat.amountRial).toBe(303_210_000)
    expect(mellat.redacted).not.toContain('452,963,014')
    const melli = parseBankSms(SMS.realMelli)
    expect(melli.kind).toBe('deposit')
    expect(melli.amountRial).toBe(10_000_232)
    expect(melli.redacted).not.toContain('136,553,207')
  })

  it('reads the usual deposit layouts', () => {
    for (const key of ['melli', 'saman', 'tejarat', 'pasargad', 'tomanApp'] as const) {
      const parsed = parseBankSms(SMS[key])
      expect(parsed.kind, key).toBe('deposit')
      expect(parsed.amountRial, key).toBe(12_503_470)
    }
  })

  it('never treats a withdrawal, a password or an advert as a deposit', () => {
    expect(parseBankSms(SMS.withdraw).kind).toBe('withdraw')
    expect(parseBankSms(SMS.withdrawSign).kind).toBe('withdraw')
    expect(parseBankSms(SMS.otp)).toMatchObject({ kind: 'secret', redacted: '' })
    expect(parseBankSms(SMS.junk).kind).toBe('other')
    expect(parseBankSms('').kind).toBe('other')
  })

  it('names the fixed word the forwarding rule filters on', () => {
    expect(depositKeywordOf(SMS.realMellat)).toBe('واریز')
    expect(depositKeywordOf(SMS.realMelli)).toBe('انتقال')
    expect(depositKeywordOf(SMS.junk)).toBeNull()
  })

  it('accepts JSON, form, raw text and query-string forwards', () => {
    expect(readForwardedSms({ body: '{"from":"09120000000","text":"واریز12,503,470"}' })).toMatchObject({ text: 'واریز12,503,470', from: '09120000000' })
    expect(readForwardedSms({ body: { message: 'x', sender: '+98912' } }).from).toBe('+98912')
    expect(readForwardedSms({ body: 'واریز 5' }).text).toBe('واریز 5')
    expect(readForwardedSms({ query: { text: 'واریز 7', from: '912', to: '3000' } })).toEqual({ text: 'واریز 7', from: '912', to: '3000' })
  })
})

describe('payment card in a reply', () => {
  const card = {
    code: 'A7K2Q9', authority: 'Pabcdefghijklmnop', url: 'https://vigent.ir/pay/Pabcdefghijklmnop', bankKey: 'mellat',
    pan: '6104337712345675', holder: 'نگار رضایی', amount: 1_250_347, expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    claim: true, status: 'PENDING' as const, lang: 'fa' as const,
  }

  it('travels as one marker and never shows as raw JSON', async () => {
    const { cardPayMarker, composeCardPayMessage, parseCardPayDirective } = await import('@/lib/payments/card/pay-card')
    const parsed = parseCardPayDirective(composeCardPayMessage(card))
    expect(parsed.cardPay?.pan).toBe(card.pan)
    expect(parsed.cardPay?.amount).toBe(card.amount)
    expect(parsed.text).not.toContain('[[')
    // A truncated marker (stream cut) is dropped, not printed.
    expect(parseCardPayDirective(`سلام\n${cardPayMarker(card).slice(0, 40)}`).text).toBe('سلام')
    // A marker with a broken card number is rejected.
    expect(parseCardPayDirective(cardPayMarker({ ...card, pan: '1234' })).cardPay).toBeNull()
  })

  it('splits into copyable messages for channels without buttons', async () => {
    const { cardPaySplitMessages } = await import('@/lib/payments/card/pay-card')
    const [head, pan, amount, tail] = cardPaySplitMessages(card)
    expect(pan).toBe('6104337712345675')
    expect(amount).toBe('1250347')
    expect(head).toContain('A7K2Q9')
    expect(tail).toContain('1,250,347')
  })

  it('tells the customer each state in their language', async () => {
    const { composeCardPayNotice } = await import('@/lib/payments/card/pay-card')
    expect(composeCardPayNotice({ status: 'PAID', code: 'A7K2Q9', amount: 1_250_000, lang: 'fa' })).toContain('پرداختتون رسید')
    expect(composeCardPayNotice({ status: 'CLAIMED', code: 'A7K2Q9', amount: 1_250_000, lang: 'en' })).toContain('checking')
    expect(composeCardPayNotice({ status: 'PENDING', code: 'A7K2Q9', amount: 1, lang: 'fa' })).toBeNull()
  })
})
