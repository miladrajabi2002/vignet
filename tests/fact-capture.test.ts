import { describe, expect, it } from 'vitest'
import { extractStatedFacts } from '@/lib/ai/fact-capture'

const city = (text: string) => extractStatedFacts(text).find((fact) => fact.key === 'شهر')?.value ?? null
const destination = (text: string) => extractStatedFacts(text).find((fact) => fact.key === 'شهر مقصد ارسال')?.value ?? null
const address = (text: string) => extractStatedFacts(text).find((fact) => fact.key === 'آدرس')?.value ?? null

describe('extractStatedFacts — zero-LLM capture of stated customer facts', () => {
  it('captures first-person residence statements in common Persian shapes', () => {
    const cases: Array<[string, string]> = [
      ['من تهران هستم', 'تهران'],
      ['من تو مشهد زندگی می‌کنم', 'مشهد'],
      ['ساکن شیراز هستم و دنبال یه گوشی خوبم', 'شیراز'],
      ['سلام، من ساکن شیرازم. دنبال یه میز جلومبلی خوبم', 'شیراز'],
      ['سلام من کرجیم', 'کرج'],
      ['ما اهل اصفهان هستیم', 'اصفهان'],
      ['تهرانم', 'تهران'],
      ['من تهرانم، پاف بالشتی دارید؟', 'تهران'],
      ['راستش الان دیگه مشهد زندگی می‌کنم', 'مشهد'],
      ['من قمیم', 'قم'],
    ]
    for (const [text, expected] of cases) {
      expect(city(text), text).toBe(expected)
      expect(extractStatedFacts(text).every((fact) => fact.mode === 'attribute')).toBe(true)
    }
  })

  it('never turns questions about the business into customer facts', () => {
    for (const text of [
      'آدرس فروشگاهتون کجاست؟',
      'آدرس سایتتون چیه',
      'آدرس رو برام بفرستید',
      'نشانی شما کجاست',
      'آدرس دقیق شعبه اصفهان رو میدین؟',
      'آدرسم رو میخواید؟',
      'شعبه تو تهران هست؟',
      'فروشگاهتون تو تهران هستش؟',
      'تو کرج هستید؟',
      'تو کرج هم نمایندگی هستید؟',
      'ارسال به تهران بشه چند روز طول میکشه؟',
      'هزینه ارسال به تهران چنده؟',
      'به شیراز هم ارسال کنید؟',
      'اگه تهران باشم ارسال رایگانه؟',
      'قیمتش تو بودجه‌ام نیست',
      'آدرسم رو بعداً میگم',
      'من دهاتم',
    ]) {
      expect(extractStatedFacts(text), text).toEqual([])
    }
  })

  it('does not take a third party’s city as the customer’s own', () => {
    expect(city('برای مادرم که تو مشهد زندگی می‌کنه میخوام')).toBeNull()
    expect(city('من ساکن تهرانم ولی برای مادرم تو مشهد میخوام بفرستم')).toBe('تهران')
  })

  it('captures shipping destinations separately from residence', () => {
    expect(destination('لطفا بفرستید به تبریز')).toBe('تبریز')
    expect(destination('آدرس ارسال به تبریز باشه لطفا')).toBe('تبریز')
    expect(city('لطفا بفرستید به تبریز')).toBeNull()
  })

  it('captures a street-level address once, with the city it starts with', () => {
    const facts = extractStatedFacts('آدرسم: خیابان ولیعصر، پلاک ۱۲، واحد ۳')
    expect(facts.filter((fact) => fact.key === 'آدرس')).toHaveLength(1)
    expect(address('آدرسم: خیابان ولیعصر، پلاک ۱۲، واحد ۳')).toContain('ولیعصر')
    expect(address('آدرس من تهران، ونک، کوچه نهم پلاک ۴')).toContain('ونک')
    expect(city('آدرس من تهران، ونک، کوچه نهم پلاک ۴')).toBe('تهران')
  })

  it('short or empty inputs are ignored', () => {
    expect(extractStatedFacts('')).toEqual([])
    expect(extractStatedFacts('ok')).toEqual([])
  })
})
