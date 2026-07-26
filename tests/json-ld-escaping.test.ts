import { describe, expect, it } from 'vitest'
import { jsonLdScript } from '@/lib/seo/json-ld'

/**
 * JSON-LD blocks on public pages embed tenant-controlled database text
 * (product names, workspace names, post titles). JSON.stringify alone does not
 * escape `<`, so a product named `</script><img src=x onerror=…>` used to
 * close the script element and execute — stored XSS on /menu/[slug].
 */
describe('jsonLdScript', () => {
  const CLOSING_TAG = '</scr' + 'ipt>'

  it('escapes a script-closing sequence in tenant text', () => {
    const out = jsonLdScript({ name: `${CLOSING_TAG}<img src=x onerror=alert(1)>` })
    expect(out).not.toMatch(/<\/script/i)
    expect(out).not.toContain('<img')
    expect(out).toContain('\\u003c')
  })

  it('escapes both angle brackets', () => {
    const out = jsonLdScript({ a: '<b>' })
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
  })

  it('escapes U+2028 / U+2029 line separators', () => {
    const out = jsonLdScript({ a: `x${String.fromCharCode(0x2028)}y${String.fromCharCode(0x2029)}z` })
    expect(out).not.toContain(String.fromCharCode(0x2028))
    expect(out).not.toContain(String.fromCharCode(0x2029))
    expect(out).toContain('\\u2028')
    expect(out).toContain('\\u2029')
  })

  it('still produces valid JSON with the original values', () => {
    const value = {
      name: `منوی <b>test</b> ${CLOSING_TAG}`,
      nested: { price: 1000, sep: String.fromCharCode(0x2028) },
    }
    expect(JSON.parse(jsonLdScript(value))).toEqual(value)
  })
})
