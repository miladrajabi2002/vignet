import { describe, expect, it } from 'vitest'
import { extractIdentity } from '@/lib/ai/customer-identification'
import { parseAiIdentity } from '@/lib/ai/ai-identity-extractor'

describe('extractIdentity — Persian name extraction (v2, high-precision)', () => {
  it('extracts a real self-introduction with an explicit cue', () => {
    expect(extractIdentity('اسمم میلاد رجبی هست').name).toBe('میلاد رجبی')
    expect(extractIdentity('نام من سارا است').name).toBe('سارا')
    expect(extractIdentity('اسمم علیه').name).toBe('علیه')
    expect(extractIdentity('اسمم علی، شماره‌ام ۰۹۱۲۳۴۵۶۷۸۹').name).toBe('علی')
    expect(extractIdentity('بنده رضایی می‌باشم').name).toBe('رضایی')
    expect(extractIdentity('نامم سارا محمدیه').name).toBe('سارا محمدیه')
  })

  it('does NOT treat purchase requests as names (regression)', () => {
    // These exact phrases previously produced junk CRM contacts.
    expect(extractIdentity('من دنبال یه گوشی هستم').name).toBeNull()
    expect(extractIdentity('من گوشی سامسونگ میخوام').name).toBeNull()
    expect(extractIdentity('بنده کفش چرم لازم دارم').name).toBeNull()
    expect(extractIdentity('من قیمت این محصول رو میخوام').name).toBeNull()
  })

  it('production junk audit — every phrase that manufactured a fake contact', () => {
    // Real messages from the 2026-10 CRM audit; each used to become a
    // Contact.name. They must all yield null now.
    expect(
      extractIdentity(
        'سلام محترم امید که جور و صحتمند باشید. محترم کانال من شرایط درآمد زایی را پوره کرده، من دیروز درخواست دادم اما کارمندان شما برایم پیام فرستاده که هنوز شرایط پوره نیست.',
      ).name,
    ).toBeNull() // was «دیروز درخو» («است» inside «درخواست»)
    expect(extractIdentity('من دیروز درخواست دادم هزار ساب و 4هزار ساعت واچتایم دارم').name).toBeNull() // was «درخو»
    expect(extractIdentity('سلام وقت بخیر ببخشید من تازه استریم رو شروع کردم').name).toBeNull() // was «تازه» («است» inside «استریم»)
    expect(extractIdentity('سلام من در کشوری هستم که امکان نقد کردن درامد ندارم').name).toBeNull() // was «در کشوری»
    expect(extractIdentity('چطور به نام والدینم بزنم').name).toBeNull() // was «والدینم بزنم» («نام» inside «به نام»)
    expect(extractIdentity('هزینه ثبت نام چقدره؟').name).toBeNull() // was «چقدره» («نام» inside «ثبت نام»)
    expect(extractIdentity('ما بزنیم براتون یورو و اینجا ریال بگیریم؟').name).toBeNull() // was «ریال بگیریم» («اینجا» cue)
    expect(extractIdentity('شماره تلفن من 09168434120').name).toBeNull() // was «شماره تلفن من»
    expect(extractIdentity('خیر تازه به درامد رسیده است').name).toBeNull()
    expect(extractIdentity('سلام خوبین برای ثبت نام توی سایت چنل باید چه ویژگی هایی داشته باشه؟').name).toBeNull()
  })

  it('v1 forms now deliberately fall through to the LLM extractor (no regex name)', () => {
    // «من X هستم» describes a state more often than it introduces a name
    // («من در کشوری هستم»). The regex layer stays conservative; prose names
    // are lib/ai/ai-identity-extractor.ts's job.
    expect(extractIdentity('من علی هستم').name).toBeNull()
    expect(extractIdentity('من مشکل دارم').name).toBeNull()
    expect(extractIdentity('من سوال داشتم').name).toBeNull()
  })

  it('extracts name + phone from a combined message', () => {
    const r = extractIdentity('میلاد رجبی 09123456789')
    expect(r.phone).toBe('+989123456789')
    expect(r.name).toBe('میلاد رجبی')
  })

  it('normalizes Persian digits in phones', () => {
    expect(extractIdentity('۰۹۱۲۳۴۵۶۷۸۹').phone).toBe('+989123456789')
  })

  it('rejects intent phrases next to a phone number', () => {
    const r = extractIdentity('دنبال یه گوشی هستم 09123456789')
    expect(r.phone).toBe('+989123456789')
    expect(r.name).toBeNull()
  })

  it('handles English intros and rejects English intent phrases', () => {
    expect(extractIdentity('my name is John').name).toBe('John')
    expect(extractIdentity("I'm looking for shoes").name).toBeNull()
    expect(extractIdentity('name: Bob').name).toBe('Bob')
  })
})

describe('parseAiIdentity — LLM answer validation', () => {
  it('parses a clean JSON answer', () => {
    const r = parseAiIdentity('{"name": "جواد فرجی", "phone": "09123456789"}')
    expect(r?.name).toBe('جواد فرجی')
    expect(r?.phone).toBe('+989123456789')
  })

  it('parses through markdown fences and prose wrappers', () => {
    const r = parseAiIdentity('```json\n{"name": "علی رضایی", "phone": null}\n```')
    expect(r?.name).toBe('علی رضایی')
    expect(r?.phone).toBeNull()
  })

  it('normalizes Persian-digit phone numbers', () => {
    const r = parseAiIdentity('{"name": null, "phone": "۰۹۱۶۸۴۳۴۱۲۰"}')
    expect(r?.name).toBeNull()
    expect(r?.phone).toBe('+989168434120')
  })

  it('rejects hallucinated intent words as names (production junk guard)', () => {
    expect(parseAiIdentity('{"name": "شماره تلفن من", "phone": null}')?.name).toBeNull()
    expect(parseAiIdentity('{"name": "قیمت", "phone": null}')?.name).toBeNull()
    // Truncating hallucination: «دیروز درخو» is not inside the real message.
    expect(
      parseAiIdentity('{"name": "دیروز درخو", "phone": null}', 'من دیروز درخواست دادم اما کارمندان شما پیام فرستاده')?.name,
    ).toBeNull()
  })

  it('accepts a name only when it is quoted from the source message', () => {
    // Faithful quote → accepted.
    expect(
      parseAiIdentity('{"name": "جواد فرجی", "phone": null}', 'من جواد فرجی هستم از مازندران')?.name,
    ).toBe('جواد فرجی')
    // Paraphrase / invention → rejected.
    expect(
      parseAiIdentity('{"name": "جواد فرجی", "phone": null}', 'سلام شماره‌ام ۰۹۱۲۳۴۵۶۷۸۹ هست')?.name,
    ).toBeNull()
  })

  it('rejects junk shapes outright', () => {
    expect(parseAiIdentity('no json here')).toBeNull()
    expect(parseAiIdentity('{"name": 42, "phone": false}')).toEqual({ name: null, phone: null })
    expect(parseAiIdentity('{"name": "' + 'x'.repeat(80) + '"}')?.name).toBeNull()
  })

  it('never invents values for empty answers', () => {
    expect(parseAiIdentity('{"name": null, "phone": null}')).toEqual({ name: null, phone: null })
  })
})
