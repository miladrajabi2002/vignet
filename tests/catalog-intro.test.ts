import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  agentCatalogFindMany: vi.fn(),
  pickTemplateImageUrl: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentCatalog: {
      findMany: mocks.agentCatalogFindMany,
    },
  },
}))
vi.mock('@/lib/instagram/media', () => ({
  pickTemplateImageUrl: mocks.pickTemplateImageUrl,
}))
vi.mock('@/lib/products/description', () => ({
  extractTypedVariations: vi.fn(() => []),
  extractListItems: vi.fn(() => []),
  normalizeAttributes: vi.fn(() => []),
  stripListBlocks: vi.fn((value: string) => value),
}))

import { planProductRequest, showcaseSubjectPhrase } from '@/lib/ai/conversation'
import { buildTrustedProductReply, showcaseIntroText } from '@/lib/products/presentation'

const catalogRow = (id: string, name: string) => ({
  product: {
    id,
    name,
    description: 'توضیح کوتاه محصول',
    price: 1_200_000,
    images: [`https://cdn.example/${id}.jpg`],
    externalUrl: `https://shop.example/p/${id}`,
    attributes: null,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pickTemplateImageUrl.mockImplementation((images: string[]) => images?.[0] ?? null)
})

describe('showcase introduction — the message sent before the catalog', () => {
  it('names the subject, the count and what each card shows, then one narrowing question', () => {
    const intro = showcaseIntroText({ count: 10, subject: 'شومیز', isFa: true })
    const lines = intro.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('۱۰ مدل شومیز')
    expect(lines[0]).toContain('موجود')
    expect(lines[0]).toContain('در ادامه')
    expect(lines[1]).toContain('رنگ یا سایز')
    expect(intro.endsWith(':')).toBe(false)
  })

  it('falls back to a neutral subject when the request named no catalog noun', () => {
    const intro = showcaseIntroText({ count: 10, isFa: true })
    expect(intro.split('\n')[0]).toContain('۱۰ محصول موجود و مرتبط')
  })

  it('uses a dedicated wording for a single result', () => {
    const intro = showcaseIntroText({ count: 1, subject: 'شومیز', isFa: true })
    expect(intro.split('\n')[0]).toContain('یک مدل شومیز')
    expect(intro.split('\n')[1]).toContain('سایز یا رنگ')
  })

  it('keeps the zero-result reply honest and still offers one next step', () => {
    const withSubject = showcaseIntroText({ count: 0, subject: 'شومیز', isFa: true })
    expect(withSubject.split('\n')[0]).toContain('هیچ شومیز موجودی')
    expect(withSubject.split('\n')[1]).toContain('مدل یا رنگ خاصی')
    const withoutSubject = showcaseIntroText({ count: 0, isFa: true })
    expect(withoutSubject.split('\n')[0]).toContain('پیدا نشد')
  })

  it('renders the English variants with the same structure', () => {
    const multi = showcaseIntroText({ count: 3, subject: 'shirt', isFa: false })
    expect(multi.split('\n')[0]).toContain('3 available shirt options')
    expect(multi.split('\n')[1]).toContain('color or size')
    expect(showcaseIntroText({ count: 1, isFa: false }).split('\n')[0]).toContain('one available matching product')
    expect(showcaseIntroText({ count: 0, subject: 'shirt', isFa: false }).split('\n')[0]).toContain('could not find an available shirt')
  })
})

describe('showcaseSubjectPhrase — only catalog nouns are named back', () => {
  it('carries the bare noun of a vitrin phrase', () => {
    expect(showcaseSubjectPhrase(planProductRequest('شومیز', []))).toBe('شومیز')
    expect(showcaseSubjectPhrase(planProductRequest('کیف دوشی دارین؟', []))).toBe('کیف')
    expect(showcaseSubjectPhrase(planProductRequest('سارافون مجلسی', []))).toBe('سارافون')
    expect(showcaseSubjectPhrase(planProductRequest('دنبال کیف هستم', []))).toBe('کیف')
  })

  it('drops non-noun modifiers so the intro stays true for every shown card', () => {
    // «مجلسی» ranks results but does not strictly filter them; naming it would
    // imply all ten cards are مجلسی.
    expect(showcaseSubjectPhrase(planProductRequest('شومیز مجلسی', []))).toBe('شومیز')
  })

  it('carries prior subject terms into a follow-up showcase command', () => {
    const history = [
      { role: 'user' as const, content: 'دنبال یه شومیز خوشگل هستم' },
      { role: 'assistant' as const, content: 'چند مدل شومیز داریم؛ می‌خواهید نشانتان بدهم؟' },
    ]
    expect(showcaseSubjectPhrase(planProductRequest('آره نشون بده', history))).toBe('شومیز')
  })

  it('returns an empty phrase when no catalog noun is present', () => {
    expect(showcaseSubjectPhrase(planProductRequest('سلام', []))).toBe('')
    expect(showcaseSubjectPhrase({ ...planProductRequest('شومیز', []), searchTerms: [] })).toBe('')
  })
})

describe('buildTrustedProductReply — showcase replies open with the introduction', () => {
  it('places the two-line intro before the product markers', async () => {
    mocks.agentCatalogFindMany.mockResolvedValue([
      catalogRow('p1', 'شومیز مروارید 0372'),
      catalogRow('p2', 'شومیز ساتن 0401'),
    ])
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'agent',
      isFa: true,
      preferredProductIds: ['p1', 'p2'],
      forceShowcase: true,
      subjectPhrase: 'شومیز',
    })
    const [intro, markerBlock] = reply.split('\n\n')
    expect(intro.split('\n')[0]).toContain('۲ مدل شومیز')
    expect(intro.split('\n')[1]).toContain('رنگ یا سایز')
    expect((markerBlock.match(/\[\[product:/gu) ?? []).length).toBe(2)
    expect(markerBlock).toContain('شومیز مروارید 0372')
  })

  it('uses the single-result wording for one product', async () => {
    mocks.agentCatalogFindMany.mockResolvedValue([catalogRow('p1', 'شومیز مروارید 0372')])
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'agent',
      isFa: true,
      preferredProductIds: ['p1'],
      forceShowcase: true,
      subjectPhrase: 'شومیز',
    })
    expect(reply.split('\n')[0]).toContain('یک مدل شومیز')
    expect(reply).toContain('[[product:')
  })

  it('answers a catalog miss with the honest zero-result intro', async () => {
    mocks.agentCatalogFindMany.mockResolvedValue([])
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'agent',
      isFa: true,
      preferredProductIds: ['gone'],
      forceShowcase: true,
      subjectPhrase: 'کیف',
    })
    expect(reply).not.toContain('[[product:')
    expect(reply.split('\n')[0]).toContain('هیچ کیف موجودی')
    expect(reply.split('\n')[1]).toContain('مدل یا رنگ خاصی')
  })

  it('answers an empty catalog selection the same way', async () => {
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'agent',
      isFa: true,
      preferredProductIds: [],
      forceShowcase: true,
      subjectPhrase: 'کیف',
    })
    expect(reply.split('\n')[0]).toContain('هیچ کیف موجودی')
    expect(mocks.agentCatalogFindMany).not.toHaveBeenCalled()
  })

  it('leaves model-authored consultation text untouched when not forcing a showcase', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'این شومیز برای مهمانی عالی است.',
      workspaceId: 'ws',
      agentId: 'agent',
      isFa: true,
      preferredProductIds: [],
      forceShowcase: false,
      subjectPhrase: 'شومیز',
    })
    expect(reply).toBe('این شومیز برای مهمانی عالی است.')
    expect(mocks.agentCatalogFindMany).not.toHaveBeenCalled()
  })

  it('drops the subject when the shown products do not actually carry it', async () => {
    // Vector search without a similarity floor: «دوچرخه» on a fashion catalog
    // still returns loosely related rows. Naming them «مدل دوچرخه» would be a
    // false customer-facing claim, so the intro falls back to the neutral form.
    mocks.agentCatalogFindMany.mockResolvedValue([
      catalogRow('p1', 'پیراهن روزمره نلا 0351'),
      catalogRow('p2', 'ست خانومی میکی موس 0349'),
      catalogRow('p3', 'تونیک آرامش 0352'),
      catalogRow('p4', 'بلوز کشباف 0305'),
    ])
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'agent',
      isFa: true,
      preferredProductIds: ['p1', 'p2', 'p3', 'p4'],
      forceShowcase: true,
      subjectPhrase: 'دوچرخه',
    })
    expect(reply.split('\n')[0]).toContain('۴ محصول موجود و مرتبط')
    expect(reply.split('\n')[0]).not.toContain('دوچرخه')
  })

  it('keeps the subject when at least half the products genuinely carry it', async () => {
    mocks.agentCatalogFindMany.mockResolvedValue([
      catalogRow('p1', 'شارژ کیف پول'),
      catalogRow('p2', 'پیراهن روزمره ثریا 0308'),
    ])
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'agent',
      isFa: true,
      preferredProductIds: ['p1', 'p2'],
      forceShowcase: true,
      subjectPhrase: 'کیف',
    })
    expect(reply.split('\n')[0]).toContain('۲ مدل کیف')
  })

  it('keeps the subject in the zero-result intro — nothing was found is honest', async () => {
    mocks.agentCatalogFindMany.mockResolvedValue([])
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'agent',
      isFa: true,
      preferredProductIds: ['gone'],
      forceShowcase: true,
      subjectPhrase: 'دوچرخه',
    })
    expect(reply.split('\n')[0]).toContain('هیچ دوچرخه موجودی')
  })
})
