import { describe, expect, it } from 'vitest'
import { observedPathname } from '@/instrumentation'

describe('request-error path sanitization', () => {
  it('removes query strings and fragments before a path reaches persistent logs', () => {
    expect(observedPathname('/api/sync/woocommerce?token=secret-value#debug')).toBe(
      '/api/sync/woocommerce',
    )
  })

  it('keeps ordinary paths unchanged', () => {
    expect(observedPathname('/api/health')).toBe('/api/health')
    expect(observedPathname(undefined)).toBeUndefined()
  })
})
