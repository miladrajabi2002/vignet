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
import { buildTrustedProductReply } from '@/lib/products/presentation'

const catalogRow = (id: string, name: string) => ({
  product: {
    id,
    name,
    description: 'توضیح کوتاه محصول',
    price: 898_000,
    images: [`https://cdn.example/${id}.jpg`],
    externalUrl: `https://shop.example/p/${id}`,
    attributes: null,
  },
})

const RONAZ = 'ronaz-0788'
const PERIAN = 'perian-0649'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pickTemplateImageUrl.mockImplementation((images: string[]) => images?.[0] ?? null)
  mocks.agentCatalogFindMany.mockImplementation(() =>
    Promise.resolve([catalogRow(RONAZ, 'تونیک روناز 0788'), catalogRow(PERIAN, 'تونیک پریان 0649')]),
  )
})

// ─── Root cause 1: digit-script-insensitive product-name matching ───────────
// The catalog name is «تونیک روناز 0788» (ASCII digits). The model echoes the
// CUSTOMER's script, so its prose says «تونیک روناز ۰۷۸۸». The old
// normalizedProductMention never folded Persian digits, the exact-name
// recovery silently failed, and the reply shipped without any product card.
describe('product card hydration — digit-script-insensitive name matching', () => {
  it('attaches the card when the reply echoes the name with Persian digits', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'تونیک روناز ۰۷۸۸ قیمتش ۸۹۸,۰۰۰ تومان و فری سایز است. کدوم طرح رو مد نظر دارید؟',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
    expect((reply.match(/\[\[product:/g) ?? []).length).toBe(1)
  })

  it('attaches the card when the reply echoes the name with ASCII digits', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'تونیک روناز 0788 قیمتش ۸۹۸,۰۰۰ تومان است.',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
  })

  it('resolves a model-authored [[product:]] directive whose name uses Persian digits', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'این مدل مناسب شماست.\n[[product:{"id":"","name":"تونیک روناز ۰۷۸۸"}]]',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
    expect(reply).toContain('"name":"تونیک روناز 0788"')
  })

  it('drops a model-authored directive for a product outside this turn\'s catalog scope', async () => {
    // The engine only shows the model the deterministic top-N rows of the
    // CURRENT turn; a directive naming anything else is off-turn noise and
    // must never reach the customer as a card.
    const reply = await buildTrustedProductReply({
      raw: 'این مدل مناسب شماست.\n[[product:{"id":"","name":"تونیک پریان ۰۶۴۹"}]]',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ],
    })
    expect(reply).not.toContain(`[[product:{"id":"${PERIAN}"`)
    expect(reply).toContain('این مدل مناسب شماست.')
  })

  it('still skips cards when neither the name nor an identification is present', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'سلام! در خدمتم؛ بگویید دنبال چه مدلی هستید.',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
    })
    expect(reply).not.toContain('[[product:')
  })
})

// ─── Root cause 2: identified products always get their vitrin card ─────────
// «تونیک روناز ۰۷۸۸» is a code-carrying consultation: the deterministic search
// proves which row the customer means, so that row's card must be attached
// even when the model paraphrases instead of echoing the exact catalog name.
describe('product card hydration — identified products are always presented', () => {
  it('attaches the identified card to a paraphrased consultation reply', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'بله اون تونیک موجوده؛ قیمتش ۸۹۸ هزار تومانه. کدوم طرح رو میخوای؟',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
      identifiedProductIds: [RONAZ],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
    expect((reply.match(/\[\[product:/g) ?? []).length).toBe(1)
  })

  it('keeps the model prose and places the card after it', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'قیمتش ۸۹۸,۰۰۰ تومان است و طرح ۰۱ تا ۱۲ موجود هستند.',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ],
      identifiedProductIds: [RONAZ],
    })
    const [prose, marker] = reply.split('\n\n[[product:')
    expect(prose).toContain('۸۹۸')
    expect(marker).toContain(`"id":"${RONAZ}"`)
  })

  it('works when only identifiedProductIds are passed (no preferred list)', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'این مدل الان موجوده.',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      identifiedProductIds: [RONAZ],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
  })

  it('narrows a forced showcase to exactly the identified product', async () => {
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
      identifiedProductIds: [RONAZ],
      forceShowcase: true,
      subjectPhrase: 'تونیک',
    })
    expect((reply.match(/\[\[product:/g) ?? []).length).toBe(1)
    expect(reply).toContain(`"id":"${RONAZ}"`)
    expect(reply).toContain('یک مدل تونیک')
  })

  it('falls back to the full preferred vitrin when nothing is identified', async () => {
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
      forceShowcase: true,
      subjectPhrase: 'تونیک',
    })
    expect((reply.match(/\[\[product:/g) ?? []).length).toBe(2)
  })
})
