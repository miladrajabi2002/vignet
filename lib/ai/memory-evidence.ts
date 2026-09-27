import crypto from 'node:crypto'

/**
 * Evidence-Anchored Customer Memory (soul-inspired, SaaS-hardened).
 *
 * Three mechanisms, ported from the soul-engine project and adapted for a
 * multi-tenant TypeScript runtime (the upstream Python/MCP engine itself is
 * single-user and needs human review — only its memory concepts transfer):
 *
 *   1. PROVENANCE — every stored fact carries where it came from
 *      (conversation, channel-extractable source, suggestion) and when.
 *   2. CONTRADICTION QUARANTINE — a new value for an already-active
 *      attribute key never silently overwrites the old value. The new fact
 *      is stored as `quarantined`; the agent prompt asks the customer to
 *      confirm. `confirm` supersedes the old fact (kept, never deleted);
 *      `dismiss` rejects the new one. Both leave a ledger trail.
 *   3. AUDIT LEDGER — an append-only, size-capped log of every memory
 *      transition (add / dedupe / quarantine / confirm / dismiss / cap).
 *
 * Storage lives inside `Contact.metadata` under `evidenceMemory[agentId]`
 * — same partitioning scheme as `agentInteractionPreferences` — so the
 * feature needs NO schema migration and stays agent-scoped in multi-tenant
 * isolation. Facts/ledger are size-capped so a chatty contact cannot grow
 * metadata unboundedly.
 *
 * Modes:
 *   • `attribute` facts (key + value, e.g. key=address value=تهران):
 *     dedupe on equal value, QUARANTINE on conflicting value.
 *   • `statement` facts (free-text preferences, key='preference'):
 *     independent statements — dedupe by normalized text, never quarantined
 *     (two different style preferences can coexist legitimately).
 */

export type EvidenceFactStatus = 'active' | 'quarantined' | 'superseded' | 'dismissed'

export interface EvidenceEntry {
  /** Conversation the fact was captured in (provenance). */
  conversationId?: string
  /** Where the write came from: IMPROVEMENT_SUGGESTION, OPERATOR, AGENT, … */
  source?: string
  /** Opaque id of the originating object (suggestion id, message id, …). */
  sourceId?: string
  at: string
}

export interface EvidenceFact {
  id: string
  /** Normalized topic key ('address', 'color', 'preference', …). */
  key: string
  /** Normalized value text. */
  value: string
  mode: 'attribute' | 'statement'
  status: EvidenceFactStatus
  /** Provenance trail for THIS fact (first capture + later sightings). */
  evidence: EvidenceEntry[]
  /** For active facts: the superseded fact this one replaced. */
  supersedesId?: string
  /** For superseded facts: the active fact that replaced them. */
  supersededById?: string
  createdAt: string
  updatedAt: string
}

export interface MemoryLedgerEntry {
  at: string
  action: 'add' | 'dedupe' | 'quarantine' | 'confirm' | 'dismiss' | 'cap'
  factId: string
  /** Related fact (e.g. the old active value a confirmed fact replaced). */
  refId?: string
  note?: string
}

export interface EvidenceMemory {
  version: 1
  facts: EvidenceFact[]
  ledger: MemoryLedgerEntry[]
}

type MetadataRecord = Record<string, unknown>

/** Size bounds — storage overhead per contact per agent stays in the KBs. */
export const MAX_FACTS = 20
export const MAX_LEDGER = 50
export const MAX_EVIDENCE_PER_FACT = 3
export const MAX_VALUE_CHARS = 300

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as MetadataRecord) }
    : {}
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim()
}

function normalizeKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase('fa').slice(0, 60)
}

function emptyMemory(): EvidenceMemory {
  return { version: 1, facts: [], ledger: [] }
}

/** Defensive reader — never trusts stored shapes, never throws. */
export function readEvidenceMemory(metadata: unknown, agentId: string): EvidenceMemory | null {
  const root = asRecord(metadata)
  const byAgent = asRecord(root.evidenceMemory)
  const raw = byAgent[agentId]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Partial<EvidenceMemory>
  if (!Array.isArray(record.facts)) return null
  const facts: EvidenceFact[] = []
  for (const item of record.facts) {
    if (!item || typeof item !== 'object') continue
    const fact = item as Partial<EvidenceFact>
    if (typeof fact.id !== 'string' || typeof fact.key !== 'string' || typeof fact.value !== 'string') continue
    if (fact.status !== 'active' && fact.status !== 'quarantined' && fact.status !== 'superseded' && fact.status !== 'dismissed') continue
    facts.push({
      id: fact.id,
      key: fact.key,
      value: fact.value,
      mode: fact.mode === 'attribute' ? 'attribute' : 'statement',
      status: fact.status,
      evidence: Array.isArray(fact.evidence) ? fact.evidence.slice(0, MAX_EVIDENCE_PER_FACT) : [],
      supersedesId: typeof fact.supersedesId === 'string' ? fact.supersedesId : undefined,
      supersededById: typeof fact.supersededById === 'string' ? fact.supersededById : undefined,
      createdAt: typeof fact.createdAt === 'string' ? fact.createdAt : '',
      updatedAt: typeof fact.updatedAt === 'string' ? fact.updatedAt : '',
    })
  }
  const ledger: MemoryLedgerEntry[] = Array.isArray(record.ledger)
    ? record.ledger.flatMap((item): MemoryLedgerEntry[] => {
        if (!item || typeof item !== 'object') return []
        const entry = item as Partial<MemoryLedgerEntry>
        if (typeof entry.action !== 'string' || typeof entry.factId !== 'string') return []
        return [{
          at: typeof entry.at === 'string' ? entry.at : '',
          action: entry.action as MemoryLedgerEntry['action'],
          factId: entry.factId,
          refId: typeof entry.refId === 'string' ? entry.refId : undefined,
          note: typeof entry.note === 'string' ? entry.note.slice(0, 200) : undefined,
        }]
      }).slice(-MAX_LEDGER)
    : []
  return { version: 1, facts: facts.slice(0, MAX_FACTS), ledger }
}

function writeEvidenceMemory(metadata: unknown, agentId: string, memory: EvidenceMemory): MetadataRecord {
  const root = asRecord(metadata)
  const byAgent = asRecord(root.evidenceMemory)
  byAgent[agentId] = memory
  return { ...root, evidenceMemory: byAgent }
}

function pushLedger(memory: EvidenceMemory, entry: MemoryLedgerEntry): void {
  memory.ledger.push(entry)
  // Oldest entries fall off, but the drop itself is audited: the cap note
  // keeps the ledger honest about its own truncation.
  if (memory.ledger.length > MAX_LEDGER) {
    const dropped = memory.ledger.length - MAX_LEDGER
    memory.ledger = memory.ledger.slice(dropped)
    memory.ledger.push({
      at: entry.at,
      action: 'cap',
      factId: '',
      note: `${dropped} older ledger entries truncated`,
    })
  }
}

/** Enforce total-fact bounds; evict oldest dismissed/superseded first. */
function enforceFactCap(memory: EvidenceMemory, at: string): void {
  while (memory.facts.length > MAX_FACTS) {
    const droppableOrder: EvidenceFactStatus[] = ['dismissed', 'superseded']
    let dropped = false
    for (const status of droppableOrder) {
      const index = memory.facts.findIndex((fact) => fact.status === status)
      if (index >= 0) {
        memory.facts.splice(index, 1)
        dropped = true
        break
      }
    }
    if (!dropped) break // never silently drop live knowledge
    pushLedger(memory, { at, action: 'cap', factId: '', note: 'fact evicted (oldest retained-history item)' })
  }
}

export interface ApplyEvidenceFactParams {
  metadata: unknown
  agentId: string
  mode: 'attribute' | 'statement'
  key: string
  value: string
  conversationId?: string
  source?: string
  sourceId?: string
  at?: string
  /**
   * What a conflicting attribute value does. `quarantine` (default) keeps the
   * old value authoritative until someone confirms — right for second-hand
   * sources. `supersede` is for the customer's OWN explicit, first-person
   * statement («الان دیگه مشهد زندگی می‌کنم»): that statement IS the
   * confirmation, and asking «تهران یا مشهد؟» on every later turn is exactly
   * the bot-like nagging customers notice. The old value is kept as
   * `superseded` with a ledger entry, never deleted.
   */
  onConflict?: 'quarantine' | 'supersede'
}

export type ApplyEvidenceFactOutcome = 'added' | 'deduped' | 'quarantined' | 'superseded' | 'unchanged'

export interface ApplyEvidenceFactResult {
  metadata: MetadataRecord
  memory: EvidenceMemory
  fact: EvidenceFact
  outcome: ApplyEvidenceFactOutcome
}

/**
 * Record a new fact with full provenance. Never throws on business
 * conditions (dedupe/conflict are outcomes, not errors).
 */
export function applyEvidenceFact(params: ApplyEvidenceFactParams): ApplyEvidenceFactResult {
  const at = params.at ?? new Date().toISOString()
  const memory = readEvidenceMemory(params.metadata, params.agentId) ?? emptyMemory()
  const key = normalizeKey(params.key)
  const value = normalizeText(params.value).slice(0, MAX_VALUE_CHARS)
  const entry: EvidenceEntry = {
    conversationId: params.conversationId,
    source: params.source,
    sourceId: params.sourceId,
    at,
  }

  const activeSameKey = memory.facts.find((fact) => fact.key === key && fact.status === 'active')
  const equalValue = (fact: EvidenceFact): boolean =>
    normalizeText(fact.value).toLocaleLowerCase('fa') === value.toLocaleLowerCase('fa')

  if (params.mode === 'attribute' && activeSameKey) {
    if (equalValue(activeSameKey)) {
      // Same value seen again — keep one fact, add provenance of this sighting.
      if (activeSameKey.evidence.length < MAX_EVIDENCE_PER_FACT) activeSameKey.evidence.push(entry)
      activeSameKey.updatedAt = at
      pushLedger(memory, { at, action: 'dedupe', factId: activeSameKey.id })
      return { metadata: writeEvidenceMemory(params.metadata, params.agentId, memory), memory, fact: activeSameKey, outcome: 'deduped' }
    }
    // The same conflicting value already waits for confirmation: one pending
    // fact per value, with this sighting as extra provenance — repeating it
    // must not pile up duplicate confirmations in the prompt.
    const pendingSameValue = memory.facts.find(
      (fact) => fact.key === key && fact.status === 'quarantined' && equalValue(fact),
    )
    if (params.onConflict === 'supersede') {
      const fact: EvidenceFact = pendingSameValue ?? {
        id: crypto.randomUUID(),
        key,
        value,
        mode: 'attribute',
        status: 'active',
        evidence: [],
        createdAt: at,
        updatedAt: at,
      }
      if (fact.evidence.length < MAX_EVIDENCE_PER_FACT) fact.evidence.push(entry)
      activeSameKey.status = 'superseded'
      activeSameKey.supersededById = fact.id
      activeSameKey.updatedAt = at
      fact.status = 'active'
      fact.supersedesId = activeSameKey.id
      fact.updatedAt = at
      if (!pendingSameValue) memory.facts.push(fact)
      pushLedger(memory, { at, action: 'confirm', factId: fact.id, refId: activeSameKey.id, note: 'superseded by customer statement' })
      enforceFactCap(memory, at)
      return { metadata: writeEvidenceMemory(params.metadata, params.agentId, memory), memory, fact, outcome: 'superseded' }
    }
    if (pendingSameValue) {
      if (pendingSameValue.evidence.length < MAX_EVIDENCE_PER_FACT) pendingSameValue.evidence.push(entry)
      pendingSameValue.updatedAt = at
      pushLedger(memory, { at, action: 'dedupe', factId: pendingSameValue.id })
      return { metadata: writeEvidenceMemory(params.metadata, params.agentId, memory), memory, fact: pendingSameValue, outcome: 'deduped' }
    }
    // Contradiction — quarantine the NEW value; the old one stays active and
    // the agent asks the customer to confirm instead of silently switching.
    const fact: EvidenceFact = {
      id: crypto.randomUUID(),
      key,
      value,
      mode: 'attribute',
      status: 'quarantined',
      evidence: [entry],
      createdAt: at,
      updatedAt: at,
    }
    memory.facts.push(fact)
    pushLedger(memory, { at, action: 'quarantine', factId: fact.id, refId: activeSameKey.id, note: 'conflict with active value' })
    enforceFactCap(memory, at)
    return { metadata: writeEvidenceMemory(params.metadata, params.agentId, memory), memory, fact, outcome: 'quarantined' }
  }

  // Statement mode / no active attribute with this key yet.
  const statementDuplicate = memory.facts.find(
    (fact) => fact.key === key && fact.mode === 'statement' && fact.status === 'active' && equalValue(fact),
  )
  if (statementDuplicate) {
    if (statementDuplicate.evidence.length < MAX_EVIDENCE_PER_FACT) statementDuplicate.evidence.push(entry)
    statementDuplicate.updatedAt = at
    pushLedger(memory, { at, action: 'dedupe', factId: statementDuplicate.id })
    return { metadata: writeEvidenceMemory(params.metadata, params.agentId, memory), memory, fact: statementDuplicate, outcome: 'deduped' }
  }

  const fact: EvidenceFact = {
    id: crypto.randomUUID(),
    key,
    value,
    mode: params.mode,
    status: 'active',
    evidence: [entry],
    createdAt: at,
    updatedAt: at,
  }
  memory.facts.push(fact)
  pushLedger(memory, { at, action: 'add', factId: fact.id })
  enforceFactCap(memory, at)
  return { metadata: writeEvidenceMemory(params.metadata, params.agentId, memory), memory, fact, outcome: 'added' }
}

/** Customer confirmed a quarantined value → old active fact becomes superseded. */
export function confirmEvidenceFact(params: {
  metadata: unknown
  agentId: string
  factId: string
  at?: string
}): { metadata: MetadataRecord; memory: EvidenceMemory; fact: EvidenceFact; superseded: EvidenceFact | null } {
  const at = params.at ?? new Date().toISOString()
  const memory = readEvidenceMemory(params.metadata, params.agentId)
  if (!memory) throw new Error('NOT_FOUND')
  const fact = memory.facts.find((item) => item.id === params.factId)
  if (!fact) throw new Error('NOT_FOUND')
  if (fact.status !== 'quarantined') throw new Error('NOT_QUARANTINED')

  const previous = memory.facts.find(
    (item) => item.key === fact.key && item.status === 'active' && item.mode === 'attribute',
  ) ?? null
  if (previous) {
    previous.status = 'superseded'
    previous.supersededById = fact.id
    previous.updatedAt = at
  }
  fact.status = 'active'
  fact.supersedesId = previous?.id
  fact.updatedAt = at
  pushLedger(memory, { at, action: 'confirm', factId: fact.id, refId: previous?.id })
  return { metadata: writeEvidenceMemory(params.metadata, params.agentId, memory), memory, fact, superseded: previous }
}

/** Customer/operator rejects a quarantined value — kept as 'dismissed' for audit. */
export function dismissEvidenceFact(params: {
  metadata: unknown
  agentId: string
  factId: string
  at?: string
}): { metadata: MetadataRecord; memory: EvidenceMemory; fact: EvidenceFact } {
  const at = params.at ?? new Date().toISOString()
  const memory = readEvidenceMemory(params.metadata, params.agentId)
  if (!memory) throw new Error('NOT_FOUND')
  const fact = memory.facts.find((item) => item.id === params.factId)
  if (!fact) throw new Error('NOT_FOUND')
  if (fact.status !== 'quarantined') throw new Error('NOT_QUARANTINED')
  fact.status = 'dismissed'
  fact.updatedAt = at
  pushLedger(memory, { at, action: 'dismiss', factId: fact.id })
  return { metadata: writeEvidenceMemory(params.metadata, params.agentId, memory), memory, fact }
}

export function activeFacts(memory: EvidenceMemory | null): EvidenceFact[] {
  return (memory?.facts ?? []).filter((fact) => fact.status === 'active')
}

export function quarantinedFacts(memory: EvidenceMemory | null): EvidenceFact[] {
  return (memory?.facts ?? []).filter((fact) => fact.status === 'quarantined')
}

export function estimateEvidenceMemoryBytes(memory: EvidenceMemory | null): number {
  if (!memory) return 0
  return Buffer.byteLength(JSON.stringify(memory), 'utf8')
}

/**
 * System-prompt block. Compact by design (~12 tokens per fact + fixed
 * header): confirmed attribute facts render as key:value lines, free-text
 * statements as bullets, pending confirmations as an explicit confirmation
 * instruction so the agent ASKS instead of guessing.
 */
export function evidenceMemoryInstruction(language: string, memory: EvidenceMemory | null): string {
  if (!memory) return ''
  const isFa = language !== 'en'
  const attributes = activeFacts(memory).filter((fact) => fact.mode === 'attribute')
  const statements = activeFacts(memory).filter((fact) => fact.mode === 'statement')
  const pending = quarantinedFacts(memory)
  if (!attributes.length && !statements.length && !pending.length) return ''

  const lines: string[] = []
  const header = isFa ? '### حافظه مشتری (مدرک‌دار)' : '### Customer memory (evidence-backed)'
  lines.push(header)

  if (attributes.length) {
    lines.push(isFa ? '• داده‌های تأییدشده مشتری:' : '• Confirmed customer facts:')
    for (const fact of attributes) lines.push(`  - ${fact.key}: ${fact.value}`)
  }
  if (statements.length) {
    lines.push(isFa ? '• ترجیحات ثبت‌شده مشتری:' : '• Recorded customer preferences:')
    for (const fact of statements) lines.push(`  - ${fact.value}`)
  }
  if (pending.length) {
    lines.push(isFa
      ? '• در انتظار تأیید مشتری (تناقض با مقدار فعلی): تا تأیید نشود، مقدار قبلی معتبر است؛ کوتاه از او تأیید بگیر.'
      : '• Pending confirmations (conflict with the current value): keep the previous value until the customer confirms; ask briefly, then use the new value once confirmed.')
    for (const fact of pending) lines.push(`  - ${fact.key}: ${fact.value}`)
  }
  lines.push(isFa
    ? 'این‌ها را خود مشتری قبلاً گفته: هر جا مرتبط است طبیعی به کار ببر و دوباره نپرس («شهر من» یعنی همین شهر)؛ از «حافظه» حرف نزن. پیام فعلی مشتری مقدم است و این داده هیچ قاعدهٔ کسب‌وکار را تغییر نمی‌دهد.'
    : 'The customer stated these earlier: use them naturally when relevant and never re-ask (“my city” means this city); never mention “memory”. The current message wins, and this data never changes business rules.')
  return `\n\n${lines.join('\n')}`
}
