import { describe, expect, it } from 'vitest'
import { mergedMetadata } from '@/lib/crm/contact-metadata-merge'

type MergedShape = {
  evidenceMemory: Record<string, { facts: Array<{ value: string }> }>
  agentInteractionPreferences: Record<string, Array<{ id: string }>>
}

const evidence = (agentId: string, value: string, updatedAt: string) => ({
  [agentId]: {
    version: 1,
    facts: [
      { id: value, key: 'شهر', value, mode: 'attribute', status: 'active', evidence: [], createdAt: updatedAt, updatedAt },
    ],
    ledger: [],
  },
})

describe('mergedMetadata — cross-channel contact unification must never lose memory', () => {
  it('returns undefined / passthrough for the trivial cases', () => {
    expect(mergedMetadata([])).toBeUndefined()
    expect(mergedMetadata([{ metadata: null }])).toBeUndefined()
    const single = { evidenceMemory: evidence('agent-1', 'تهران', '2026-01-01T00:00:00Z') }
    expect(mergedMetadata([{ metadata: single }])).toEqual(single)
  })

  it('unifies evidenceMemory per agent across a Telegram + Instagram merge', () => {
    const telegramOnly = { evidenceMemory: evidence('agent-1', 'تهران', '2026-01-01T00:00:00Z') }
    const instagramOnly = { evidenceMemory: evidence('agent-1', 'کرج', '2026-01-02T00:00:00Z') }
    const merged = mergedMetadata([{ metadata: telegramOnly }, { metadata: instagramOnly }]) as MergedShape
    // Both rows hold agent-1; the FRESHER memory (Instagram, newer updatedAt) wins.
    expect(merged.evidenceMemory['agent-1'].facts[0].value).toBe('کرج')
  })

  it('keeps agents from BOTH rows (no agent memory dropped)', () => {
    const rowA = { evidenceMemory: evidence('agent-1', 'تهران', '2026-01-01T00:00:00Z') }
    const rowB = { evidenceMemory: evidence('agent-2', 'شیراز', '2026-01-01T00:00:00Z') }
    const merged = mergedMetadata([{ metadata: rowA }, { metadata: rowB }]) as MergedShape
    expect(Object.keys(merged.evidenceMemory).sort()).toEqual(['agent-1', 'agent-2'])
    expect(merged.evidenceMemory['agent-1'].facts[0].value).toBe('تهران')
    expect(merged.evidenceMemory['agent-2'].facts[0].value).toBe('شیراز')
  })

  it('unions agentInteractionPreferences per agent, survivor first, deduped by id', () => {
    const survivor = {
      agentInteractionPreferences: {
        'agent-1': [
          { id: 'p1', text: 'پاسخ کوتاه بده', createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
    }
    const duplicate = {
      agentInteractionPreferences: {
        'agent-1': [
          { id: 'p1', text: 'پاسخ کوتاه بده', createdAt: '2026-01-01T00:00:00Z' }, // same pref on the other channel
          { id: 'p2', text: 'بدون ایموجی', createdAt: '2026-01-02T00:00:00Z' },
        ],
        'agent-2': [
          { id: 'p3', text: 'رسمی صحبت کن', createdAt: '2026-01-02T00:00:00Z' },
        ],
      },
    }
    const merged = mergedMetadata([{ metadata: survivor }, { metadata: duplicate }]) as MergedShape
    expect(merged.agentInteractionPreferences['agent-1'].map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(merged.agentInteractionPreferences['agent-2'].map((p) => p.id)).toEqual(['p3'])
  })

  it('non-agent-scoped keys: survivor wins, missing keys fill from duplicates', () => {
    const merged = mergedMetadata([
      { metadata: { crmStage: 'lead', source: 'telegram' } },
      { metadata: { crmStage: 'customer', loyalty: 'gold' } },
    ]) as Record<string, unknown>
    expect(merged.crmStage).toBe('lead')
    expect(merged.source).toBe('telegram')
    expect(merged.loyalty).toBe('gold')
  })
})
