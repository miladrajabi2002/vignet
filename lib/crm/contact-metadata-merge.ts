type MetadataRecord = Record<string, unknown>

/** Row shape needed by the metadata merge (subset of the full ContactRow). */
export type MetadataCarrierRow = { metadata: unknown }

function asMetadataRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as MetadataRecord) }
    : {}
}

function newestMemoryAt(entry: unknown): string {
  const record = asMetadataRecord(entry)
  const facts = Array.isArray(record.facts) ? record.facts : []
  let newest = ''
  for (const fact of facts) {
    const updatedAt = asMetadataRecord(fact).updatedAt
    if (typeof updatedAt === 'string' && updatedAt > newest) newest = updatedAt
  }
  return newest
}

/**
 * Merge per-agent memory maps across every merged contact row. The previous
 * `firstValue(all, 'metadata')` silently DROPPED the duplicates' customer
 * memory: when a Telegram-only contact and an Instagram-only contact were
 * unified by a shared phone, whichever row lost the metadata coin-flip took
 * its evidence facts and interaction preferences to the grave — exactly the
 * cross-channel memory loss this module is supposed to prevent.
 *
 * - `evidenceMemory[agentId]`: the entry whose newest fact is fresher wins
 *   (memories evolve; a stale copy must not resurrect old values).
 * - `agentInteractionPreferences[agentId]`: union of both arrays, deduped by
 *   preference id, survivor's entries first, capped like the writer (20).
 * - Every other metadata key: survivor (oldest row) wins, as before.
 */
export function mergedMetadata(rows: MetadataCarrierRow[]): unknown {
  const carriers = rows.filter((row) => row.metadata != null && typeof row.metadata === 'object')
  if (carriers.length === 0) return undefined
  if (carriers.length === 1) return carriers[0].metadata

  const root: MetadataRecord = asMetadataRecord(carriers[0].metadata)
  for (const row of carriers.slice(1)) {
    for (const [key, value] of Object.entries(asMetadataRecord(row.metadata))) {
      if (root[key] == null) root[key] = value
    }
  }

  // evidenceMemory: per-agent, freshness-resolved.
  const evidenceCarriers = carriers
    .map((row) => asMetadataRecord(row.metadata).evidenceMemory)
    .filter((value): value is MetadataRecord => Object.keys(asMetadataRecord(value)).length > 0)
  if (evidenceCarriers.length > 1) {
    const byAgent: MetadataRecord = {}
    const agentIds = [...new Set(evidenceCarriers.flatMap((carrier) => Object.keys(carrier)))]
    for (const agentId of agentIds) {
      const candidates = evidenceCarriers
        .map((carrier) => carrier[agentId])
        .filter((entry) => entry != null && typeof entry === 'object')
      byAgent[agentId] = candidates.reduce((best, entry) =>
        newestMemoryAt(entry) > newestMemoryAt(best) ? entry : best,
      )
    }
    root.evidenceMemory = byAgent
  }

  // agentInteractionPreferences: union per agent, survivor first, dedup by id.
  const prefCarriers = carriers
    .map((row) => asMetadataRecord(row.metadata).agentInteractionPreferences)
    .filter((value): value is MetadataRecord => Object.keys(asMetadataRecord(value)).length > 0)
  if (prefCarriers.length > 1) {
    const byAgent: MetadataRecord = {}
    const agentIds = [...new Set(prefCarriers.flatMap((carrier) => Object.keys(carrier)))]
    for (const agentId of agentIds) {
      const merged: unknown[] = []
      const seenIds = new Set<string>()
      for (const carrier of prefCarriers) {
        const list = carrier[agentId]
        if (!Array.isArray(list)) continue
        for (const item of list) {
          const id = asMetadataRecord(item).id
          const dedupeKey = typeof id === 'string' ? `id:${id}` : `raw:${JSON.stringify(item)}`
          if (seenIds.has(dedupeKey)) continue
          seenIds.add(dedupeKey)
          merged.push(item)
        }
      }
      if (merged.length) byAgent[agentId] = merged.slice(-20)
    }
    root.agentInteractionPreferences = byAgent
  }

  return root
}
