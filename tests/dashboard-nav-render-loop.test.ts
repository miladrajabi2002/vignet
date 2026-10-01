import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// A `capabilities = []` default creates a new array on every render; with the
// nav effects depending on it, Sidebar/MobileNav re-rendered forever (~8k
// commits a second) and the page content under the layout never hydrated.
describe('dashboard navigation render stability', () => {
  for (const file of ['components/dashboard/sidebar.tsx', 'components/dashboard/mobile-nav.tsx']) {
    it(`${file} keeps a stable capabilities default and content-based deps`, () => {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/capabilities\s*=\s*\[\]\s*[,}]/)
      expect(source).toContain('capabilities = NO_CAPABILITIES')
      expect(source).toMatch(/\[capabilitiesKey\]/)
    })
  }
})
