import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  kbFind: vi.fn(), approvalFind: vi.fn(), kbUpdate: vi.fn(), deleteChunks: vi.fn(),
  publish: vi.fn(), swap: vi.fn(), embed: vi.fn(), insert: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  knowledgeBase: { findUnique: mocks.kbFind, updateMany: mocks.kbUpdate },
  knowledgeApproval: { findUnique: mocks.approvalFind },
  knowledgeChunk: { deleteMany: mocks.deleteChunks }, $transaction: mocks.transaction,
} }))
vi.mock('@/lib/ai/embeddings', () => ({ embedTexts: mocks.embed }))
vi.mock('@/lib/knowledge/vector-store', () => ({ insertChunk: mocks.insert }))
vi.mock('@/lib/knowledge/parsers', () => ({ parsePdfPages: vi.fn(), parseCsv: vi.fn(), parseUrl: vi.fn() }))
vi.mock('@/lib/storage', () => ({ downloadFile: vi.fn(), BUCKETS: {} }))
vi.mock('@/lib/queue/jobs', () => ({ dispatchNotification: vi.fn() }))
import { processIngestion } from '@/lib/knowledge/ingest'

describe('approved knowledge versions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.kbFind.mockResolvedValue({ id: 'kb', agentId: 'agent', workspaceId: 'workspace', type: 'FAQ', name: 'FAQ', sourceUrl: null, fileName: null })
    mocks.approvalFind.mockResolvedValue({ question: 'روش تعویض چیست؟', answer: 'نسخه جدید تأییدشده', knowledgeVersion: 2 })
    mocks.embed.mockResolvedValue([[0.1, 0.2]])
    mocks.publish.mockResolvedValue({ count: 1 })
    mocks.transaction.mockImplementation((fn) => fn({ knowledgeBase: { updateMany: mocks.publish }, knowledgeChunk: { deleteMany: mocks.swap } }))
  })
  it('embeds the latest durable answer instead of stale queued text', async () => {
    await processIngestion({ kbId: 'kb', text: 'پاسخ قدیمی' })
    expect(mocks.embed.mock.calls[0][0][0]).toContain('نسخه جدید تأییدشده')
    expect(mocks.embed.mock.calls[0][0][0]).not.toContain('پاسخ قدیمی')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ learnedVersion: 2 }) }))
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'kb', approval: { is: { knowledgeVersion: 2 } } } }))
  })
  it('discards its own generation when an answer was edited during embedding', async () => {
    mocks.publish.mockResolvedValue({ count: 0 })
    await processIngestion({ kbId: 'kb' })
    expect(mocks.swap).toHaveBeenCalledWith({ where: { kbId: 'kb', metadata: { path: ['generation'], equals: expect.any(String) } } })
  })
})
