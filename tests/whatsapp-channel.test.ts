import { afterEach, describe, expect, it, vi } from 'vitest'
import { whatsappAdapter } from '@/lib/channels/whatsapp'

describe('WhatsApp inbound identity parsing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('stores the customer mobile in 09 form and never uses the business phone-number id', () => {
    const [message] = whatsappAdapter('token|181316641398869').parseUpdate({
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: '181316641398869' },
        contacts: [{ wa_id: '989128352271', profile: { name: 'Ali' } }],
        messages: [{ id: 'wamid.1', from: '989128352271', text: { body: 'سلام' } }],
      } }] }],
    })

    expect(message).toMatchObject({
      chatId: '989128352271',
      senderId: '989128352271',
      senderPhone: '09128352271',
      senderName: 'Ali',
      text: 'سلام',
    })
    expect(message.senderPhone).not.toBe('181316641398869')
  })

  it('does not label an opaque Meta id as a phone number', () => {
    const [message] = whatsappAdapter('token|business-phone-id').parseUpdate({
      entry: [{ changes: [{ value: {
        contacts: [{ profile: { name: 'Customer' } }],
        messages: [{ id: 'wamid.2', from: '181316641398869', text: { body: 'hello' } }],
      } }] }],
    })

    expect(message.chatId).toBe('181316641398869')
    expect(message.senderPhone).toBeUndefined()
  })

  it('refuses to send to the business phone-number id', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      whatsappAdapter('token|181316641398869').sendText('181316641398869', 'hello'),
    ).rejects.toThrow('business phone-number id')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('converts a 09 recipient to the provider format only at the API boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await whatsappAdapter('token|business-id').sendText('09128352271', 'hello')

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      to: '989128352271',
    })
  })
})
