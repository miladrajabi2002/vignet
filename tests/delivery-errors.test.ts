import { describe, expect, it } from 'vitest'
import {
  classifyProviderFailure,
  deliveryReasonDetail,
  deliveryReasonLabel,
  isInstagramCommentThread,
  isInstagram24hWindowError,
} from '@/lib/channels/delivery-errors'

describe('classifyProviderFailure', () => {
  it('reads a deleted Instagram comment as comment_unavailable', () => {
    const error = new Error(
      'INSTAGRAM comment reply failed (400): {"error":{"message":"Unsupported post request. Object with ID \'18469174690118109\' does not exist, cannot be loaded due to missing permissions, or does not support this operation","type":"IGApiException","code":100,"error_subcode":33}}',
    )
    expect(classifyProviderFailure(error)).toBe('comment_unavailable')
  })

  it('separates Instagram DM failures by cause', () => {
    const window = new Error('x')
    window.name = 'Instagram24hWindowError'
    expect(classifyProviderFailure(window)).toBe('reply_window_closed')
    expect(classifyProviderFailure(new Error('INSTAGRAM invalid credentials'))).toBe('token_invalid')
    expect(classifyProviderFailure(new Error('INSTAGRAM sendText failed (400): {"error":{"code":190,"type":"OAuthException"}}'))).toBe('token_invalid')
    expect(classifyProviderFailure(new Error('INSTAGRAM sendText failed (400): {"error":{"code":10,"type":"OAuthException"}}'))).toBe('permission_missing')
    expect(classifyProviderFailure(new Error('INSTAGRAM sendText failed (400): {"error":{"code":613,"type":"OAuthException"}}'))).toBe('rate_limited')
    expect(classifyProviderFailure(new Error('INSTAGRAM sendText failed (400): {"error":{"message":"No matching user found","code":100,"error_subcode":2534014}}'))).toBe('recipient_unreachable')
  })

  it('reads Telegram-style Bot API failures', () => {
    expect(classifyProviderFailure(new Error('TELEGRAM sendMessage failed (403): {"ok":false,"description":"Forbidden: bot was blocked by the user"}'))).toBe('recipient_unreachable')
    expect(classifyProviderFailure(new Error('BALE sendMessage failed (401): {"ok":false,"description":"Unauthorized"}'))).toBe('token_invalid')
    expect(classifyProviderFailure(new Error('TELEGRAM sendMessage failed (429): {"ok":false,"description":"Too Many Requests: retry after 5"}'))).toBe('rate_limited')
    expect(classifyProviderFailure(new Error('TELEGRAM sendMessage failed (400): {"ok":false,"description":"Bad Request: message is too long"}'))).toBe('message_rejected')
  })

  it('reads network failures and falls back to provider_error', () => {
    expect(classifyProviderFailure(new TypeError('fetch failed'))).toBe('network_error')
    expect(classifyProviderFailure(new Error('RUBIKA sendMessage failed (500)'))).toBe('provider_error')
  })
})

describe('delivery reason copy', () => {
  it('has a label and a detail for every reason the panel can show', () => {
    for (const reason of ['comment_unavailable', 'reply_window_closed', 'recipient_unreachable', 'token_invalid', 'permission_missing', 'rate_limited', 'network_error', 'message_rejected', 'products_need_dm', 'missing_thread', 'channel_inactive', 'credentials_missing', 'channel_retired']) {
      expect(deliveryReasonLabel(reason, true)).toBeTruthy()
      expect(deliveryReasonDetail(reason, false)).toBeTruthy()
    }
    expect(deliveryReasonLabel('provider_error', true)).toBeNull()
  })

  it('detects comment threads', () => {
    expect(isInstagramCommentThread('comment:18469174690118109')).toBe(true)
    expect(isInstagramCommentThread('1784')).toBe(false)
    expect(isInstagramCommentThread(null)).toBe(false)
  })
})

describe('isInstagram24hWindowError', () => {
  it('matches the typed error, the raw subcode and the API message', () => {
    const typed = new Error('INSTAGRAM_24H_WINDOW_CLOSED: {"error":{"code":10,"error_subcode":2534022}}')
    typed.name = 'Instagram24hWindowError'
    expect(isInstagram24hWindowError(typed)).toBe(true)
    expect(isInstagram24hWindowError(new Error('{"error":{"message":"This message is sent outside of allowed window.","code":10,"error_subcode":2534022,"type":"IGApiException"}}'))).toBe(true)
    expect(isInstagram24hWindowError(new Error('This message is sent outside of allowed window.'))).toBe(true)
    expect(isInstagram24hWindowError(new Error('no open thread'))).toBe(false)
    expect(isInstagram24hWindowError(null)).toBe(false)
    expect(isInstagram24hWindowError(undefined)).toBe(false)
  })
})
