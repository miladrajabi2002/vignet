import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  INSTAGRAM_WEBHOOK_FIELDS,
  getInstagramProfile,
  subscribeIgUserToWebhook,
  unsubscribeIgUserFromWebhook,
} from '@/lib/instagram/oauth'

describe('Instagram webhook subscription', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches and returns both the Graph id and webhook user_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '38072185465760663',
        user_id: '17841401976835496',
        username: 'example',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getInstagramProfile('token-1')).resolves.toMatchObject({
      igUserId: '38072185465760663',
      webhookIgId: '17841401976835496',
      username: 'example',
    })

    const url = new URL(fetchMock.mock.calls[0][0] as string | URL)
    expect(url.searchParams.get('fields')?.split(',')).toContain('user_id')
  })

  it('subscribes only to valid fields and receives story mentions through messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await subscribeIgUserToWebhook('ig-user-1', 'token-1')

    expect(result).toEqual(INSTAGRAM_WEBHOOK_FIELDS)
    expect(INSTAGRAM_WEBHOOK_FIELDS).toContain('messages')
    expect(INSTAGRAM_WEBHOOK_FIELDS).not.toContain('story_mention')

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [
      string | URL,
      RequestInit,
    ]
    const url = new URL(requestUrl)

    expect(url.searchParams.get('subscribed_fields')).toBe(
      'messages,messaging_postbacks,comments,mentions',
    )
    expect(url.searchParams.get('access_token')).toBe('token-1')
    expect(requestInit).toEqual({ method: 'POST' })
  })

  it('removes the app webhook subscription when an account is disconnected', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(unsubscribeIgUserFromWebhook('ig-user-1', 'token-1')).resolves.toBe(true)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [
      string | URL,
      RequestInit,
    ]
    const url = new URL(requestUrl)
    expect(url.pathname).toContain('/ig-user-1/subscribed_apps')
    expect(url.searchParams.get('access_token')).toBe('token-1')
    expect(requestInit).toEqual({ method: 'DELETE' })
  })
})
