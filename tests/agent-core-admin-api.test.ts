import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ authed: vi.fn(), save: vi.fn(), get: vi.fn() }))
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthed: mocks.authed }))
vi.mock('@/lib/agent/understand/mode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/agent/understand/mode')>()),
  saveUnderstandingConfig: mocks.save,
  getUnderstandingConfig: mocks.get,
}))

import { GET, PUT } from '@/app/api/admin/agent-core/route'
import { DEFAULT_UNDERSTANDING_CONFIG } from '@/lib/agent/understand/mode'

const put = (body: unknown) => PUT(new Request('http://x/api/admin/agent-core', { method: 'PUT', body: JSON.stringify(body) }))

describe('admin agent-core rollout API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authed.mockResolvedValue(true)
    mocks.save.mockImplementation(async (value) => value)
    mocks.get.mockResolvedValue(DEFAULT_UNDERSTANDING_CONFIG)
  })

  it('refuses anyone who is not an admin', async () => {
    mocks.authed.mockResolvedValue(false)
    expect((await GET()).status).toBe(401)
    expect((await put(DEFAULT_UNDERSTANDING_CONFIG)).status).toBe(401)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('saves a valid configuration with per-domain switches and workspace overrides', async () => {
    const config = {
      ...DEFAULT_UNDERSTANDING_CONFIG,
      mode: 'shadow',
      domains: { ...DEFAULT_UNDERSTANDING_CONFIG.domains, bookings: false },
      timeoutMs: 5000,
      workspaces: { ws_1: 'on' },
    }
    const response = await put(config)
    expect(response.status).toBe(200)
    expect(mocks.save).toHaveBeenCalledWith(config)
  })

  it('rejects unknown modes, missing domains and out-of-range timeouts', async () => {
    expect((await put({ ...DEFAULT_UNDERSTANDING_CONFIG, mode: 'maybe' })).status).toBe(400)
    expect((await put({ ...DEFAULT_UNDERSTANDING_CONFIG, domains: { products: true } })).status).toBe(400)
    expect((await put({ ...DEFAULT_UNDERSTANDING_CONFIG, timeoutMs: 100 })).status).toBe(400)
    expect((await put({ ...DEFAULT_UNDERSTANDING_CONFIG, workspaces: { ws: 'loud' } })).status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
