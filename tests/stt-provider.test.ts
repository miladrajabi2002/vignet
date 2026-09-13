import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureSttCredit: vi.fn(),
  ensureSttCreditAvailable: vi.fn(),
  getOpenRouterKey: vi.fn(),
  getCommercialConfig: vi.fn(),
}))

vi.mock('@/lib/billing/stt-credits', () => ({
  captureSttCredit: mocks.captureSttCredit,
  ensureSttCreditAvailable: mocks.ensureSttCreditAvailable,
}))
vi.mock('@/lib/ai/openrouter', () => ({
  OPENROUTER_BASE: 'https://openrouter.test/api/v1',
  getPlatformOpenRouterKey: mocks.getOpenRouterKey,
}))
vi.mock('@/lib/platform/commercial-config', () => ({
  PLATFORM_STT_MODEL: 'openai/whisper-large-v3-turbo',
  getPlatformCommercialConfig: mocks.getCommercialConfig,
}))
vi.mock('@/lib/security/safe-http', () => ({ safeHttpGet: vi.fn() }))

import { transcribeAudio } from '@/lib/voice/stt'

describe('OpenRouter speech-to-text', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOpenRouterKey.mockReturnValue('test-openrouter-key')
    mocks.getCommercialConfig.mockResolvedValue({
      sttModel: 'legacy/provider',
      sttPricePerMinuteIRR: 100,
      zeroDataRetention: true,
    })
    mocks.ensureSttCreditAvailable.mockResolvedValue(undefined)
    mocks.captureSttCredit.mockResolvedValue({ chargeIRR: 25, balanceAfterIRR: 975 })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('uses only the pinned multilingual Whisper model and bills reported seconds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'generation-1',
      text: 'سلام، قیمت این محصول چقدر است؟',
      usage: { seconds: 15, cost: 0.00075, input_tokens: 10, output_tokens: 4 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const text = await transcribeAudio({
      audio: Buffer.from('audio-bytes'),
      mime: 'audio/ogg',
      workspaceId: 'workspace-1',
      agentId: 'agent-1',
      idempotencyKey: 'stt:event-1',
    })

    expect(text).toBe('سلام، قیمت این محصول چقدر است؟')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.test/api/v1/audio/transcriptions')
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-openrouter-key' }))
    const body = JSON.parse(String(init.body))
    expect(body).toEqual(expect.objectContaining({
      model: 'openai/whisper-large-v3-turbo',
      input_audio: expect.objectContaining({ format: 'ogg' }),
      provider: { data_collection: 'deny', zdr: true },
    }))
    expect(body).not.toHaveProperty('language')
    expect(mocks.ensureSttCreditAvailable).toHaveBeenCalledWith('workspace-1', 'stt:event-1')
    expect(mocks.captureSttCredit).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      agentId: 'agent-1',
      model: 'openai/whisper-large-v3-turbo',
      audioSeconds: 15,
      pricePerMinuteIRR: 100,
      providerRequestId: 'generation-1',
      providerCostUSD: 0.00075,
      idempotencyKey: 'stt:event-1',
    }))
  })

  it('forwards an explicit ISO language hint when supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      text: 'hello', usage: { seconds: 2 },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await transcribeAudio({
      audio: Buffer.from('audio-bytes'),
      mime: 'audio/webm',
      workspaceId: 'workspace-1',
      language: 'en',
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.language).toBe('en')
  })

  it('fails before upload when the platform OpenRouter key is unavailable', async () => {
    mocks.getOpenRouterKey.mockReturnValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(transcribeAudio({
      audio: Buffer.from('audio-bytes'), mime: 'audio/ogg', workspaceId: 'workspace-1',
    })).rejects.toThrow('PLATFORM_AI_NOT_CONFIGURED')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
