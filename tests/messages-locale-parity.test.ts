import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SOLUTIONS, getLocalizedSolutions } from '@/lib/marketing/solutions'

interface MessageTree {
  [key: string]: string | MessageTree
}

function load(locale: 'fa' | 'en'): MessageTree {
  return JSON.parse(readFileSync(resolve(process.cwd(), `messages/${locale}.json`), 'utf8')) as MessageTree
}

function flatten(value: MessageTree, prefix = ''): Array<[string, string]> {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof child === 'string' ? [[path, child]] : flatten(child, path)
  })
}

describe('message locale quality', () => {
  it('keeps Persian and English translation keys in exact parity', () => {
    const faKeys = flatten(load('fa')).map(([key]) => key).sort()
    const enKeys = flatten(load('en')).map(([key]) => key).sort()
    expect(enKeys).toEqual(faKeys)
  })

  it('does not leak Persian-script copy into the English message catalog', () => {
    const leaks = flatten(load('en')).filter(([, value]) => /[\u0600-\u06ff]/u.test(value))
    expect(leaks).toEqual([])
  })

  it('provides complete Persian-free English content for every solution route', async () => {
    const englishSolutions = await getLocalizedSolutions('en')
    expect(englishSolutions.map(({ slug }) => slug)).toEqual(SOLUTIONS.map(({ slug }) => slug))
    expect(JSON.stringify(englishSolutions)).not.toMatch(/[\u0600-\u06ff]/u)
    for (const solution of englishSolutions) {
      expect(solution.benefits).toHaveLength(4)
      expect(solution.steps).toHaveLength(3)
      expect(solution.faq).toHaveLength(3)
    }
  })
})
