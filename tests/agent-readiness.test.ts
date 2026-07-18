import { describe, expect, it } from 'vitest'
import { summarizeAgentReadiness } from '@/lib/agents/readiness'

describe('agent readiness', () => {
  it('marks setup complete when only an optional opportunity remains', () => {
    const summary = summarizeAgentReadiness([
      { key: 'settings', done: true, required: true },
      { key: 'knowledge', done: true, required: true },
      { key: 'channel', done: true, required: true },
      { key: 'wordpress', done: false, required: false },
    ])

    expect(summary).toEqual({
      complete: true,
      doneCount: 3,
      totalCount: 3,
      progress: 100,
      optionalRemaining: 1,
    })
  })

  it('keeps setup incomplete while a required signal is missing', () => {
    const summary = summarizeAgentReadiness([
      { key: 'settings', done: true, required: true },
      { key: 'knowledge', done: false, required: true },
      { key: 'wordpress', done: false, required: false },
    ])

    expect(summary.complete).toBe(false)
    expect(summary.progress).toBe(50)
    expect(summary.optionalRemaining).toBe(1)
  })
})
