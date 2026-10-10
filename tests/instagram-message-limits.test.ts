/**
 * What one Instagram Direct message may carry — the limits the scenario form
 * shows and the routes enforce.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  rateLimitCost: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', workspaceId: 'workspace-1' })),
}))
vi.mock('@/lib/billing/entitlements', () => ({
  checkWorkspaceActive: vi.fn(async () => ({ allowed: true, plan: 'STARTER' })),
}))
vi.mock('@/lib/ratelimit', () => ({
  rateLimit: mocks.rateLimit,
  rateLimitCost: mocks.rateLimitCost,
}))

import { POST } from '@/app/api/uploads/instagram/route'
import { splitInstagramText } from '@/lib/channels/instagram'
import {
  IG_BUTTON_TEXT_LIMIT,
  IG_MEDIA_MAX_BYTES,
  IG_SINGLE_TEXT_LIMIT,
  igKeyTextLimit,
  isValidButtonUrl,
  normalizeButtonUrl,
} from '@/lib/instagram/limits'

function uploadRequest(file: File): Request {
  const form = new FormData()
  form.append('files', file)
  return new Request('https://vigent.ir/api/uploads/instagram', { method: 'POST', body: form })
}

beforeEach(() => {
  mocks.rateLimit.mockReset().mockResolvedValue(true)
  mocks.rateLimitCost.mockReset().mockResolvedValue(true)
})

describe('Instagram message limits', () => {
  it('a text at the limit leaves as one message, one character more as two', () => {
    expect(splitInstagramText('ا'.repeat(IG_SINGLE_TEXT_LIMIT))).toHaveLength(1)
    expect(splitInstagramText('ا'.repeat(IG_SINGLE_TEXT_LIMIT + 1))).toHaveLength(2)
  })

  it('a key message inside the bubble is shorter than one with reply chips', () => {
    expect(igKeyTextLimit('button')).toBe(IG_BUTTON_TEXT_LIMIT)
    expect(igKeyTextLimit(undefined)).toBe(IG_BUTTON_TEXT_LIMIT)
    expect(igKeyTextLimit('quick_reply')).toBe(IG_SINGLE_TEXT_LIMIT)
  })

  it('gives a typed link its scheme and keeps a complete one untouched', () => {
    expect(normalizeButtonUrl('  example.com/sale ')).toBe('https://example.com/sale')
    expect(normalizeButtonUrl('http://example.com')).toBe('http://example.com')
    expect(normalizeButtonUrl('   ')).toBe('')
  })

  it('accepts only links Instagram can open from a button', () => {
    expect(isValidButtonUrl('https://vigent.ir/pricing')).toBe(true)
    expect(isValidButtonUrl('vigent.ir')).toBe(true)
    expect(isValidButtonUrl('')).toBe(false)
    expect(isValidButtonUrl('قیمت ها')).toBe(false)
    expect(isValidButtonUrl('javascript:alert(1)')).toBe(false)
    expect(isValidButtonUrl('https://localhost')).toBe(false)
  })

  it('refuses an image larger than Instagram accepts before storing it', async () => {
    const tooBig = new File([new Uint8Array(IG_MEDIA_MAX_BYTES.IMAGE + 1)], 'big.png', { type: 'image/png' })

    const response = await POST(uploadRequest(tooBig))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('TOO_LARGE') })
    expect(mocks.rateLimitCost).not.toHaveBeenCalled()
  })
})
