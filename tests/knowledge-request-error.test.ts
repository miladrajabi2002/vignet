import { describe, expect, it } from 'vitest'
import { knowledgeRequestErrorMessageKey } from '@/lib/knowledge/request-error'

describe('knowledge request errors', () => {
  it('identifies an expired session instead of reusing the add-button label', () => {
    expect(knowledgeRequestErrorMessageKey(401, 'UNAUTHORIZED')).toBe('sessionExpired')
  })

  it('maps common API validation and entitlement failures', () => {
    expect(knowledgeRequestErrorMessageKey(402, 'PLAN_BLOCKED')).toBe('planBlocked')
    expect(knowledgeRequestErrorMessageKey(429, 'RATE_LIMIT')).toBe('rateLimit')
    expect(knowledgeRequestErrorMessageKey(413, 'PAYLOAD_TOO_LARGE')).toBe('fileTooLarge')
    expect(knowledgeRequestErrorMessageKey(415, 'INVALID_FILE_TYPE')).toBe('invalidFileType')
  })

  it('uses a real failure message for unknown server errors', () => {
    expect(knowledgeRequestErrorMessageKey(500)).toBe('requestFailed')
  })
})
