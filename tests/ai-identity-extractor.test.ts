/**
 * The LLM identity layer must (a) only spend a model call that can still teach
 * the CRM something and (b) never write a value the customer did not type.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  conversationFindUnique: vi.fn(),
  auxCompletion: vi.fn(),
  applyContactIdentity: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: {
      findUnique: mocks.conversationFindUnique,
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    contact: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}))
vi.mock('@/lib/ai/llm/aux', () => ({
  auxCompletion: mocks.auxCompletion,
  AuxUnavailableError: class AuxUnavailableError extends Error {},
}))
vi.mock('@/lib/crm/contact-identity', () => ({ applyContactIdentity: mocks.applyContactIdentity }))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError, captureWarning: vi.fn() }))

import { extractIdentityWithAi, parseAiIdentity } from '@/lib/ai/ai-identity-extractor'
import { extractIdentity } from '@/lib/ai/customer-identification'

const base = { workspaceId: 'workspace-1', conversationId: 'conv-1', agentId: 'agent-1' }

function contact(name: string | null, phone: string | null) {
  mocks.conversationFindUnique.mockResolvedValue({ contactId: 'contact-1', contact: { name, phone } })
}

function modelSays(answer: Record<string, unknown>) {
  mocks.auxCompletion.mockResolvedValue({ content: JSON.stringify(answer) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.conversationFindUnique.mockResolvedValue({ contactId: null, contact: null })
  mocks.applyContactIdentity.mockResolvedValue('contact-1')
})

describe('extractIdentityWithAi — when a model call is worth making', () => {
  it('asks the model while the name is still unknown', async () => {
    modelSays({ name: 'رضا', phone: null })

    const result = await extractIdentityWithAi({ ...base, message: 'من رضا هستم' })

    expect(result).toEqual({ name: 'رضا', phone: null })
    expect(mocks.applyContactIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: null, name: 'رضا', phone: null }),
    )
  })

  it('skips the call when the name is known and the message holds no number', async () => {
    contact('رضا', null)

    expect(await extractIdentityWithAi({ ...base, message: 'قیمت این محصول چنده؟' })).toBeNull()
    expect(mocks.auxCompletion).not.toHaveBeenCalled()
  })

  it('skips the call when name and phone are both already on the contact', async () => {
    contact('رضا', '+989123456789')

    expect(await extractIdentityWithAi({ ...base, message: 'شماره دومم 0935 111 2233 هست' })).toBeNull()
    expect(mocks.auxCompletion).not.toHaveBeenCalled()
  })

  it('reads a spaced phone for a named contact and never replaces the known name', async () => {
    contact('رضا', null)
    modelSays({ name: 'علی', phone: '09351112233' })

    const result = await extractIdentityWithAi({ ...base, message: 'علی گفت شماره‌ام 0935 111 2233' })

    expect(result).toEqual({ name: null, phone: '+989351112233' })
    expect(mocks.applyContactIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'contact-1', name: null, phone: '+989351112233' }),
    )
  })

  it('writes nothing when the model answers with an unanchored value', async () => {
    modelSays({ name: 'مینا', phone: '09120000000' })

    const result = await extractIdentityWithAi({ ...base, message: 'سلام وقت بخیر' })

    expect(result).toEqual({ name: null, phone: null })
    expect(mocks.applyContactIdentity).not.toHaveBeenCalled()
  })
})

describe('parseAiIdentity — anchoring to the customer\'s own text', () => {
  it('accepts a phone the customer typed with spaces, dashes or Persian digits', () => {
    expect(parseAiIdentity('{"name": null, "phone": "09123456789"}', 'شماره من 0912 345 6789')?.phone).toBe('+989123456789')
    expect(parseAiIdentity('{"name": null, "phone": "+989123456789"}', 'تماس: ۰۹۱۲-۳۴۵-۶۷۸۹')?.phone).toBe('+989123456789')
  })

  it('rejects a phone that is not in the message — a phone is a contact merge key', () => {
    expect(parseAiIdentity('{"name": null, "phone": "09123456789"}', 'سلام، شماره‌ام رو بعداً می‌دم')?.phone).toBeNull()
    expect(parseAiIdentity('{"name": null, "phone": "09123456789"}', 'کد پیگیری 0912345678')?.phone).toBeNull()
  })

  it('lets the model accept «هستی» as a name while the regex layer still refuses it', () => {
    // «هستی» is "you are" AND a common girl's name — only a reader of the
    // sentence can tell, so the stopword filter yields to the LLM layer.
    expect(parseAiIdentity('{"name": "هستی", "phone": null}', 'اسمم هستی هست')?.name).toBe('هستی')
    expect(parseAiIdentity('{"name": "هستی محمدی", "phone": null}', 'من هستی محمدی هستم')?.name).toBe('هستی محمدی')
    expect(extractIdentity('هستی؟').name).toBeNull()
    // Real intent words stay rejected even for the model.
    expect(parseAiIdentity('{"name": "قیمت", "phone": null}', 'قیمت چنده')?.name).toBeNull()
  })
})
