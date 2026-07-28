import { describe, expect, it } from 'vitest'
import { safeLinkHref } from '@/lib/markdown-links'

describe('chat markdown links', () => {
  it('allows only absolute http and https links', () => {
    expect(safeLinkHref('https://vigent.ir/docs')).toBe('https://vigent.ir/docs')
    expect(safeLinkHref('http://example.com')).toBe('http://example.com/')
    expect(safeLinkHref('javascript:alert(1)')).toBe('')
    expect(safeLinkHref('data:text/html,test')).toBe('')
    expect(safeLinkHref('/relative')).toBe('')
  })
})
