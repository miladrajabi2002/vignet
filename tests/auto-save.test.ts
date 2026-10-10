import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutoSaver, type AutoSaveStatus } from '@/lib/auto-save'

type Form = { name: string }

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(save: (value: Form) => Promise<void> = async () => {}) {
  const sent: Form[] = []
  const statuses: AutoSaveStatus[] = []
  const saver = createAutoSaver<Form>({ name: 'a' }, {
    delay: 800,
    savedHoldMs: 1800,
    save: (value) => {
      sent.push(value)
      return save(value)
    },
    onStatus: (status) => statuses.push(status),
  })
  return { saver, sent, statuses }
}

describe('createAutoSaver', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sends nothing until the value differs from what is stored', async () => {
    const { saver, sent, statuses } = setup()
    saver.update({ name: 'a' })
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent).toEqual([])
    expect(statuses).toEqual([])
  })

  it('waits for a pause, then sends only the latest value', async () => {
    const { saver, sent, statuses } = setup()
    saver.update({ name: 'ab' })
    await vi.advanceTimersByTimeAsync(500)
    saver.update({ name: 'abc' })
    await vi.advanceTimersByTimeAsync(799)
    expect(sent).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(sent).toEqual([{ name: 'abc' }])
    expect(statuses).toEqual(['pending', 'saving', 'saved'])
    await vi.advanceTimersByTimeAsync(1800)
    expect(saver.status).toBe('idle')
  })

  it('saves at once on flush', async () => {
    const { saver, sent } = setup()
    saver.update({ name: 'ab' })
    saver.flush()
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toEqual([{ name: 'ab' }])
    expect(saver.status).toBe('saved')
  })

  it('drops the pending save when the value goes back to the stored one', async () => {
    const { saver, sent } = setup()
    saver.update({ name: 'ab' })
    saver.update({ name: 'a' })
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent).toEqual([])
    expect(saver.status).toBe('idle')
  })

  it('holds an invalid value back and sends it once it is fixed', async () => {
    const { saver, sent } = setup()
    saver.update({ name: '' }, false)
    saver.flush()
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent).toEqual([])
    expect(saver.status).toBe('idle')
    saver.update({ name: 'b' }, true)
    await vi.advanceTimersByTimeAsync(800)
    expect(sent).toEqual([{ name: 'b' }])
  })

  it('sends an edit made during a request after that request, one at a time', async () => {
    const first = deferred()
    const calls: Array<ReturnType<typeof deferred>> = [first]
    let index = 0
    const { saver, sent } = setup(() => calls[index++]?.promise ?? Promise.resolve())
    saver.update({ name: 'ab' })
    await vi.advanceTimersByTimeAsync(800)
    saver.update({ name: 'abc' })
    await vi.advanceTimersByTimeAsync(800)
    expect(sent).toEqual([{ name: 'ab' }])
    first.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toEqual([{ name: 'ab' }, { name: 'abc' }])
    expect(saver.status).toBe('saved')
  })

  it('settles as saved when an edit during a request is undone before it lands', async () => {
    const first = deferred()
    const { saver, sent } = setup(() => first.promise)
    saver.update({ name: 'ab' })
    await vi.advanceTimersByTimeAsync(800)
    saver.update({ name: 'abc' })
    saver.update({ name: 'ab' })
    first.resolve()
    await vi.advanceTimersByTimeAsync(800)
    expect(sent).toEqual([{ name: 'ab' }])
    expect(saver.status).toBe('saved')
  })

  it('reports a failure and retries on flush', async () => {
    let fail = true
    const { saver, sent } = setup(async () => {
      if (fail) throw new Error('SAVE_FAILED')
    })
    saver.update({ name: 'ab' })
    await vi.advanceTimersByTimeAsync(800)
    expect(saver.status).toBe('error')
    fail = false
    saver.flush()
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toEqual([{ name: 'ab' }, { name: 'ab' }])
    expect(saver.status).toBe('saved')
  })

  it('sends what is still waiting when the form goes away', async () => {
    const { saver, sent, statuses } = setup()
    saver.update({ name: 'ab' })
    expect(saver.dispose()).toBe(true)
    expect(sent).toEqual([{ name: 'ab' }])
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent).toHaveLength(1)
    expect(statuses).toEqual(['pending'])
  })

  it('sends nothing on the way out when there is nothing to save or the value is invalid', () => {
    const clean = setup()
    expect(clean.saver.dispose()).toBe(false)
    const invalid = setup()
    invalid.saver.update({ name: '' }, false)
    expect(invalid.saver.dispose()).toBe(false)
    expect(clean.sent).toEqual([])
    expect(invalid.sent).toEqual([])
  })
})
