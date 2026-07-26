import { describe, expect, it } from 'vitest'
import { extractIdentity } from '@/lib/ai/customer-identification'

describe('extractIdentity — Persian name extraction', () => {
  it('extracts a real self-introduction', () => {
    expect(extractIdentity('من علی هستم').name).toBe('علی')
    expect(extractIdentity('اسمم میلاد رجبی هست').name).toBe('میلاد رجبی')
    expect(extractIdentity('نام من سارا است').name).toBe('سارا')
  })

  it('does NOT treat purchase requests as names (regression)', () => {
    // These exact phrases previously produced junk CRM contacts.
    expect(extractIdentity('من دنبال یه گوشی هستم').name).toBeNull()
    expect(extractIdentity('من گوشی سامسونگ میخوام').name).toBeNull()
    expect(extractIdentity('بنده کفش چرم لازم دارم').name).toBeNull()
    expect(extractIdentity('من قیمت این محصول رو میخوام').name).toBeNull()
  })

  it('does NOT match the bare «من X» form without an identity verb', () => {
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
  })
})
