import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/llm/aux', () => ({ auxCompletion: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn() }))

import { auxCompletion } from '@/lib/ai/llm/aux'
import { anchorInSms, chooseFilter, foldSms, readSampleRules, readSmsSample } from '@/lib/payments/card/sms-sample'

const MELLI = 'انتقال اينترنت:+2,000,332\nحساب:152601422685\nمانده:143,054,089\n0723-15:38'
const MELLAT = 'حساب8907027623\nواریز303,210,000\nمانده452,963,014\n05/07/15-11:33'

describe('sms sample reader', () => {
  it('folds one character to one character', () => {
    const raw = 'انتقال اينترنت\r\n۱۲۳'
    expect(foldSms(raw)).toHaveLength(raw.length)
  })

  it('keeps the bank’s own spelling of what it finds', () => {
    // Typed with a Persian «ی», found as the bank's Arabic «ي».
    expect(anchorInSms(MELLI, 'انتقال اینترنت')).toBe('انتقال اينترنت')
    expect(anchorInSms(MELLI, 'برداشت')).toBeNull()
  })

  it('reads the deposit word and the account by rule', () => {
    expect(readSampleRules(MELLI)).toEqual({ word: 'انتقال', account: '152601422685' })
    expect(readSampleRules(MELLAT)).toEqual({ word: 'واریز', account: '8907027623' })
  })

  it('takes the model’s answer only when it is in the message', async () => {
    vi.mocked(auxCompletion).mockResolvedValueOnce({ content: '{"word":"انتقال","account":"152601422685"}' } as never)
    expect(await readSmsSample('w', MELLI)).toMatchObject({ kind: 'deposit', word: 'انتقال', account: '152601422685', source: 'ai' })
    // An invented account and a balance-as-account fall back to the rules.
    vi.mocked(auxCompletion).mockResolvedValueOnce({ content: '{"word":"واریز","account":"452963014"}' } as never)
    expect(await readSmsSample('w', MELLAT)).toMatchObject({ word: 'واریز', account: '8907027623' })
  })

  it('never sends a password message to the model', async () => {
    vi.mocked(auxCompletion).mockClear()
    expect(await readSmsSample('w', 'رمز پویا: 123456 بانک ملت')).toMatchObject({ kind: 'secret', word: null })
    expect(auxCompletion).not.toHaveBeenCalled()
  })

  it('stands on the rules when the model is unavailable', async () => {
    vi.mocked(auxCompletion).mockRejectedValueOnce(Object.assign(new Error('AUX_NO_KEY'), { name: 'AuxUnavailableError' }))
    expect(await readSmsSample('w', MELLAT)).toMatchObject({ word: 'واریز', account: '8907027623', source: 'rules' })
  })

  it('filters on the account with its label, else on the word', async () => {
    expect(chooseFilter(MELLAT, 'واریز', '8907027623')).toBe('حساب8907027623')
    expect(chooseFilter(MELLI, 'انتقال', '152601422685')).toBe('حساب:152601422685')
    expect(chooseFilter('واریز 500,000 به 0105123456', 'واریز', '0105123456')).toBe('0105123456')
    expect(chooseFilter('واریز:+500,000', 'واریز', null)).toBe('واریز')
    vi.mocked(auxCompletion).mockRejectedValueOnce(Object.assign(new Error('AUX_NO_KEY'), { name: 'AuxUnavailableError' }))
    expect(await readSmsSample('w', MELLAT)).toMatchObject({ filter: 'حساب8907027623' })
  })

  it('flags an Arabic letter in the chosen word', async () => {
    vi.mocked(auxCompletion).mockResolvedValueOnce({ content: '{"word":"واريز","account":null}' } as never)
    expect(await readSmsSample('w', 'واريز:+500,000 به کارت')).toMatchObject({ word: 'واريز', filter: 'واريز', arabicLetters: true })
  })
})
