import { describe, expect, it } from 'vitest'
import {
  applyEvidenceFact,
  confirmEvidenceFact,
  dismissEvidenceFact,
  estimateEvidenceMemoryBytes,
  evidenceMemoryInstruction,
  readEvidenceMemory,
} from '@/lib/ai/memory-evidence'

const AGENT = 'agent-1'

function apply(metadata: unknown, value: string, at = '2026-09-01T10:00:00.000Z') {
  return applyEvidenceFact({
    metadata, agentId: AGENT, mode: 'attribute', key: 'address', value,
    conversationId: 'conv-1', source: 'AGENT', at,
  })
}

describe('evidence-anchored memory — attribute facts', () => {
  it('stores a new fact as active with provenance', () => {
    const { outcome, fact, memory } = apply({}, 'تهران، ولیعصر، پلاک ۱۲')
    expect(outcome).toBe('added')
    expect(fact.status).toBe('active')
    expect(fact.evidence[0]).toMatchObject({ conversationId: 'conv-1', source: 'AGENT' })
    expect(memory.ledger[0]?.action).toBe('add')
  })

  it('dedupes the same value and appends provenance instead of a new fact', () => {
    let metadata: unknown = {}
    const first = apply(metadata, 'تهران، ولیعصر، پلاک ۱۲')
    metadata = first.metadata
    const second = apply(metadata, 'تهران، ولیعصر، پلاک ۱۲', '2026-09-02T10:00:00.000Z')
    expect(second.outcome).toBe('deduped')
    expect(second.memory.facts).toHaveLength(1)
    expect(second.fact.evidence).toHaveLength(2)
    expect(second.memory.ledger.at(-1)?.action).toBe('dedupe')
  })

  it('quarantines a contradicting value and keeps the old one authoritative', () => {
    let metadata: unknown = {}
    metadata = apply(metadata, 'تهران، ولیعصر، پلاک ۱۲').metadata
    const conflict = apply(metadata, 'مشهد، بلوار وکیل‌آباد ۵', '2026-09-08T10:00:00.000Z')
    expect(conflict.outcome).toBe('quarantined')
    const statuses = conflict.memory.facts.map((f) => [f.value, f.status])
    expect(statuses).toEqual([
      ['تهران، ولیعصر، پلاک ۱۲', 'active'],
      ['مشهد، بلوار وکیل‌آباد ۵', 'quarantined'],
    ])
    expect(conflict.memory.ledger.at(-1)).toMatchObject({ action: 'quarantine', refId: conflict.memory.facts[0].id })
  })

  it('confirm supersedes the old fact but never deletes it (full audit trail)', () => {
    let metadata: unknown = {}
    metadata = apply(metadata, 'تهران، ولیعصر، پلاک ۱۲').metadata
    metadata = apply(metadata, 'مشهد، بلوار وکیل‌آباد ۵', '2026-09-08T10:00:00.000Z').metadata
    const quarantinedId = readEvidenceMemory(metadata, AGENT)!.facts.find((f) => f.status === 'quarantined')!.id
    const confirmed = confirmEvidenceFact({ metadata, agentId: AGENT, factId: quarantinedId, at: '2026-09-09T10:00:00.000Z' })

    expect(confirmed.superseded?.value).toBe('تهران، ولیعصر، پلاک ۱۲')
    expect(confirmed.superseded?.status).toBe('superseded')
    expect(confirmed.fact.status).toBe('active')
    expect(confirmed.fact.supersedesId).toBe(confirmed.superseded?.id)
    const actions = confirmed.memory.ledger.map((entry) => entry.action)
    expect(actions).toEqual(['add', 'quarantine', 'confirm'])
  })

  it('dismiss rejects the quarantined value and keeps the old one active', () => {
    let metadata: unknown = {}
    metadata = apply(metadata, 'تهران').metadata
    metadata = apply(metadata, 'کرج', '2026-09-08T10:00:00.000Z').metadata
    const id = readEvidenceMemory(metadata, AGENT)!.facts.find((f) => f.status === 'quarantined')!.id
    const dismissed = dismissEvidenceFact({ metadata, agentId: AGENT, factId: id })
    expect(dismissed.fact.status).toBe('dismissed')
    expect(dismissed.memory.facts.find((f) => f.value === 'تهران')?.status).toBe('active')
  })

  it('rejects confirm/dismiss on non-quarantined facts', () => {
    const { metadata } = apply({}, 'تهران')
    const fact = readEvidenceMemory(metadata, AGENT)!.facts[0]
    expect(() => confirmEvidenceFact({ metadata, agentId: AGENT, factId: fact.id })).toThrow('NOT_QUARANTINED')
    expect(() => dismissEvidenceFact({ metadata, agentId: AGENT, factId: fact.id })).toThrow('NOT_QUARANTINED')
    expect(() => confirmEvidenceFact({ metadata, agentId: AGENT, factId: 'missing' })).toThrow('NOT_FOUND')
  })
})

describe('evidence-anchored memory — statement facts', () => {
  it('coexists distinct preferences without quarantine, dedupes exact repeats', () => {
    let metadata: unknown = {}
    const addStatement = (text: string) => applyEvidenceFact({
      metadata, agentId: AGENT, mode: 'statement', key: 'preference', value: text,
      conversationId: 'conv-2', source: 'IMPROVEMENT_SUGGESTION', sourceId: 'sug-1',
    })
    metadata = addStatement('پاسخ‌ها را کوتاه بده').metadata
    metadata = addStatement('قیمت را مستقیم بگو').metadata
    const third = addStatement('پاسخ‌ها را کوتاه بده')
    expect(third.outcome).toBe('deduped')
    const active = readEvidenceMemory(metadata, AGENT)!.facts.filter((f) => f.status === 'active')
    expect(active).toHaveLength(2)
    expect(third.memory.facts.filter((f) => f.status === 'quarantined')).toHaveLength(0)
  })
})

describe('evidence-anchored memory — bounds and storage', () => {
  it('caps facts and ledger; dropped retained-history items are audited', () => {
    let metadata: unknown = {}
    metadata = apply(metadata, 'v0').metadata
    // 25 alternating contradictions: each even round supersedes the active one.
    for (let i = 1; i <= 25; i++) {
      metadata = apply(metadata, `v${i}`, `2026-09-01T10:0${(i % 10)}:00.000Z`).metadata
      const pending = readEvidenceMemory(metadata, AGENT)!.facts.find((f) => f.status === 'quarantined')
      if (pending) metadata = confirmEvidenceFact({ metadata, agentId: AGENT, factId: pending.id }).metadata
    }
    const memory = readEvidenceMemory(metadata, AGENT)!
    expect(memory.facts.length).toBeLessThanOrEqual(20)
    expect(memory.ledger.length).toBeLessThanOrEqual(50)
    // One active value per attribute key survives, older ones superseded/evicted.
    const actives = memory.facts.filter((f) => f.status === 'active' && f.mode === 'attribute')
    expect(actives).toHaveLength(1)
    expect(actives[0].value).toBe('v25')
  })

  it('stays small in bytes and ignores malformed stored shapes', () => {
    const { metadata, memory } = apply({}, 'تهران، ولیعصر، پلاک ۱۲')
    expect(estimateEvidenceMemoryBytes(memory)).toBeLessThan(1024)
    expect(readEvidenceMemory({ evidenceMemory: { [AGENT]: { facts: 'garbage' } } }, AGENT)).toBeNull()
    expect(readEvidenceMemory(null, AGENT)).toBeNull()
    expect(metadata).toBeTypeOf('object')
  })
})

describe('evidence-anchored memory — prompt block', () => {
  it('renders confirmed facts, statements and pending confirmations compactly', () => {
    let metadata: unknown = {}
    metadata = apply(metadata, 'تهران، ولیعصر، پلاک ۱۲').metadata
    metadata = applyEvidenceFact({
      metadata, agentId: AGENT, mode: 'statement', key: 'preference', value: 'پاسخ کوتاه بده',
      conversationId: 'conv-2', source: 'IMPROVEMENT_SUGGESTION',
    }).metadata
    metadata = apply(metadata, 'مشهد، وکیل‌آباد ۵', '2026-09-08T10:00:00.000Z').metadata

    const block = evidenceMemoryInstruction('fa', readEvidenceMemory(metadata, AGENT))
    expect(block).toContain('حافظه مشتری')
    expect(block).toContain('address: تهران، ولیعصر، پلاک ۱۲')
    expect(block).toContain('پاسخ کوتاه بده')
    expect(block).toContain('انتظار تأیید')
    expect(block).toContain('مشهد، وکیل‌آباد ۵')
    // Compact: a full 3-fact profile (header + rules + pending cue) stays
    // under ~300 tokens (bytes/3 heuristic is conservative for Persian).
    expect(Buffer.byteLength(block, 'utf8')).toBeLessThan(900)
  })

  it('renders nothing when empty and isolates per agent', () => {
    const { metadata } = apply({}, 'تهران')
    expect(evidenceMemoryInstruction('fa', null)).toBe('')
    expect(evidenceMemoryInstruction('fa', readEvidenceMemory(metadata, 'other-agent'))).toBe('')
  })
})
