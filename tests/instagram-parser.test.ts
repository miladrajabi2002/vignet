import { afterEach, describe, expect, it, vi } from 'vitest'
import { instagramAdapter } from '@/lib/channels/instagram'

describe('instagram inbound normalization', () => {
  const adapter = instagramAdapter('unused-for-parse')

  it('classifies an emoji-only story reply as a reaction and keeps its mid', () => {
    const [message] = adapter.parseUpdate({
      entry: [{ id: 'self', messaging: [{
        sender: { id: 'customer' },
        message: { mid: 'mid.1', text: '🔥', reply_to: { story: { id: 'story.1' } } },
      }] }],
    })
    expect(message).toMatchObject({
      kind: 'STORY_REACTION',
      text: '🔥',
      storyId: 'story.1',
      platformMessageId: 'mid.1',
    })
  })

  it('keeps text plus emoji as a normal story reply', () => {
    const [message] = adapter.parseUpdate({
      entry: [{ id: 'self', messaging: [{
        sender: { id: 'customer' },
        message: { mid: 'mid.2', text: 'عالیه 🔥', reply_to: { story: { id: 'story.1' } } },
      }] }],
    })
    expect(message.kind).toBe('STORY_REPLY')
  })

  it('keeps the comment id as both comment and platform id', () => {
    const [message] = adapter.parseUpdate({
      entry: [{ id: 'self', changes: [{
        field: 'comments',
        value: { id: 'comment.1', text: '❤️', from: { id: 'customer' } },
      }] }],
    })
    expect(message).toMatchObject({
      kind: 'COMMENT', commentId: 'comment.1', platformMessageId: 'comment.1',
    })
  })

	it('normalizes react and ignores unreact webhook events', () => {
		const messages = adapter.parseUpdate({ entry: [{ id: 'self', messaging: [
			{ sender: { id: 'customer' }, reaction: { mid: 'mid.original', action: 'react', reaction: 'love', emoji: '❤️' } },
			{ sender: { id: 'customer' }, reaction: { mid: 'mid.original', action: 'unreact', reaction: 'love' } },
		] }] })
		expect(messages).toEqual([expect.objectContaining({
   kind: 'REACTION', text: '❤️', platformMessageId: 'mid.original',
		})])
	})
})

describe('instagram outbound reaction', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('uses the official sender_action react payload', async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ username: 'account' }), { status: 200 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchMock)
		const adapter = instagramAdapter('page-token')
		await adapter.reactToMessage?.('mid.1', 'customer.1')
		expect(fetchMock).toHaveBeenLastCalledWith(
			expect.stringContaining('/me/messages'),
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					recipient: { id: 'customer.1' },
					sender_action: 'react',
					payload: { message_id: 'mid.1', reaction: 'love' },
				}),
			}),
		)
	})
})
