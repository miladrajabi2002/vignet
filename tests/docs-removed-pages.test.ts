import { describe, expect, it } from 'vitest'
import { DOCS, getDoc } from '@/lib/docs/content'
import { DOCS_NAV } from '@/lib/docs/nav'
import { SOLUTIONS, getLocalizedSolutions } from '@/lib/marketing/solutions'

describe('removed documentation pages', () => {
  it('does not publish the internal Meta setup guide', () => {
    expect(getDoc('meta-app-setup')).toBeUndefined()
    expect(DOCS.some((doc) => doc.slug === 'meta-app-setup')).toBe(false)
    expect(DOCS_NAV.some((doc) => doc.slug === 'meta-app-setup')).toBe(false)
  })

  it('does not publish the retired WhatsApp solution in either locale', async () => {
    expect(SOLUTIONS.some((solution) => solution.slug === 'whatsapp')).toBe(false)
    expect((await getLocalizedSolutions('en')).some((solution) => solution.slug === 'whatsapp')).toBe(false)
  })
})
