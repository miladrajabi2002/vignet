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

  it('retries transient ping failures quietly and stops on success', async () => {
    vi.useFakeTimers()
    const sendTyping = vi
      .fn()
      .mockRejectedValueOnce(new Error('IGApiException: Service temporarily unavailable'))
      .mockRejectedValueOnce(new Error('IGApiException: Service temporarily unavailable'))
      .mockResolvedValue(undefined)
    const onError = vi.fn()
    const stop = startChannelTyping(adapter('INSTAGRAM', { sendTyping }), 'ig-1', onError)

    expect(sendTyping).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_500)
    expect(sendTyping).toHaveBeenCalledTimes(2)
    expect(onError).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_500)
    expect(sendTyping).toHaveBeenCalledTimes(3)
    expect(onError).not.toHaveBeenCalled()
    stop()
  })

  it('surfaces the error only after every retry is exhausted', async () => {
    vi.useFakeTimers()
    const sendTyping = vi.fn().mockRejectedValue(new Error('down'))
    const onError = vi.fn()
    const stop = startChannelTyping(adapter('INSTAGRAM', { sendTyping }), 'ig-2', onError)

    await vi.advanceTimersByTimeAsync(1_500)
    await vi.advanceTimersByTimeAsync(1_500)
    expect(sendTyping).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledTimes(1)

    // No further retries after the budget is spent.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sendTyping).toHaveBeenCalledTimes(3)
    stop()
  })

  it('cancels a pending retry when the answer is ready', async () => {
    vi.useFakeTimers()
    const sendTyping = vi.fn().mockRejectedValue(new Error('boom'))
    const stop = startChannelTyping(adapter('INSTAGRAM', { sendTyping }), 'ig-3')

    await vi.advanceTimersByTimeAsync(10)
    expect(sendTyping).toHaveBeenCalledTimes(1)
    stop()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(sendTyping).toHaveBeenCalledTimes(1)
  })
})
