import { describe, expect, it } from 'vitest'
import { instagramAdapter } from '@/lib/channels/instagram'

/**
 * Button-tap (postback) events carry no `message.mid`, so their idempotency
 * id used to fall back to a CONTENT hash. Every repeat tap of the same
 * button by the same user then collapsed into the FIRST tap's completed
 * InboundEvent and was silently swallowed — the follow-gate ("فالو اجباری")
 * flow died after the first tap and no message ever went out again.
 *
 * The fix: derive the platform message id from the per-event messaging
 * timestamp (unique per tap, stable across Meta redeliveries) or from
 * postback.mid when Meta provides it.
 */
describe('instagram postback idempotency id', () => {
  const adapter = instagramAdapter('unused-for-parse')

  function postbackUpdate(ts: number, title = 'فالو کردم') {
    return {
      entry: [{
        id: 'self',
        messaging: [{
          sender: { id: 'customer-1' },
          recipient: { id: 'business-1' },
          timestamp: ts,
          postback: { title, payload: `btn:${title}` },
        }],
      }],
    }
  }

  it('derives a stable id from the messaging timestamp when no mid exists', () => {
    const [msg] = adapter.parseUpdate(postbackUpdate(1_711_234_567_890))
    expect(msg).toMatchObject({
      kind: 'DM',
      text: 'فالو کردم',
      platformMessageId: 'pb:1711234567890:customer-1',
    })
  })

  it('marks a tap so the inbox can tell it from typed text', () => {
    const [tap] = adapter.parseUpdate(postbackUpdate(1_711_234_567_890))
    expect(tap.buttonTap).toBe(true)

    const [chip, typed] = adapter.parseUpdate({
      entry: [{
        id: 'self',
        messaging: [
          { sender: { id: 'customer-1' }, message: { mid: 'm1', text: 'مشاهده', quick_reply: { payload: 'qr_0' } } },
          { sender: { id: 'customer-1' }, message: { mid: 'm2', text: 'مشاهده' } },
        ],
      }],
    })
    expect(chip.buttonTap).toBe(true)
    expect(typed.buttonTap).toBeUndefined()
  })

  it('a second tap of the same button gets a DISTINCT id (no silent dedupe)', () => {
    const [first] = adapter.parseUpdate(postbackUpdate(1_711_234_567_890))
    const [second] = adapter.parseUpdate(postbackUpdate(1_711_234_600_001))
    expect(first.platformMessageId).not.toBe(second.platformMessageId)
  })

  it('a Meta redelivery of the SAME event keeps the same id (deduped)', () => {
    const ts = 1_711_234_567_890
    const [first] = adapter.parseUpdate(postbackUpdate(ts))
    const [redelivered] = adapter.parseUpdate(postbackUpdate(ts))
    expect(redelivered.platformMessageId).toBe(first.platformMessageId)
  })

  it('prefers postback.mid when Meta provides one', () => {
    const update = {
      entry: [{
        id: 'self',
        messaging: [{
          sender: { id: 'customer-1' },
          recipient: { id: 'business-1' },
          timestamp: 1_711_234_567_890,
          postback: { title: 'دنبال کردم', payload: 'btn:x', mid: 'mid.pb.1' },
        }],
      }],
    }
    const [msg] = adapter.parseUpdate(update)
    expect(msg.platformMessageId).toBe('mid.pb.1')
  })
})
