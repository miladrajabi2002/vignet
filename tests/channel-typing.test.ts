import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MessengerAdapter } from '@/lib/channels/types'
import { startChannelTyping } from '@/lib/channels/typing'

function adapter(
  channel: MessengerAdapter['channel'],
  overrides: Partial<MessengerAdapter> = {},
): MessengerAdapter {
  return {
    channel,
    parseUpdate: () => [],
    sendText: async () => {},
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('channel typing lifecycle', () => {
  it('refreshes Telegram typing before its five-second expiry and stops cleanly', async () => {
    vi.useFakeTimers()
    const sendTyping = vi.fn().mockResolvedValue(undefined)
    const stop = startChannelTyping(adapter('TELEGRAM', { sendTyping }), 'chat-1')

    expect(sendTyping).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(sendTyping).toHaveBeenCalledTimes(2)

    stop()
    await vi.advanceTimersByTimeAsync(12_000)
    expect(sendTyping).toHaveBeenCalledTimes(2)
  })

  it('never overlaps a slow typing request', async () => {
    vi.useFakeTimers()
    const sendTyping = vi.fn(() => new Promise<void>(() => {}))

    const stop = startChannelTyping(adapter('BALE', { sendTyping }), 'chat-2')
    await vi.advanceTimersByTimeAsync(12_000)

    expect(sendTyping).toHaveBeenCalledTimes(1)
    stop()
  })

  it('aborts an in-flight nicety request when the answer is ready', () => {
    let requestSignal: AbortSignal | undefined
    const sendTyping = vi.fn((_chatId: string, signal?: AbortSignal) => {
      requestSignal = signal
      return new Promise<void>(() => {})
    })

    const stop = startChannelTyping(adapter('TELEGRAM', { sendTyping }), 'chat-3')
    expect(requestSignal?.aborted).toBe(false)

    stop()
    expect(requestSignal?.aborted).toBe(true)
  })

  it('sends one Instagram typing_on and an explicit typing_off', async () => {
    vi.useFakeTimers()
    const sendTyping = vi.fn().mockResolvedValue(undefined)
    const stopTyping = vi.fn().mockResolvedValue(undefined)
    const stop = startChannelTyping(
      adapter('INSTAGRAM', { sendTyping, stopTyping }),
      'ig-user',
    )

    await vi.advanceTimersByTimeAsync(20_000)
    expect(sendTyping).toHaveBeenCalledTimes(1)

    stop()
    expect(stopTyping).toHaveBeenCalledTimes(1)
  })

  it('is a no-op for providers without typing support', () => {
    const stop = startChannelTyping(adapter('RUBIKA'), 'rubika-chat')
    expect(() => stop()).not.toThrow()
  })
})
