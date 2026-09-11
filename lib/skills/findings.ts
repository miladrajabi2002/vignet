/**
 * Admin-only improvement skills — finding persistence.
 *
 * Dedupe contract: (skillKey, dedupeKey) is unique. Re-detection updates the
 * existing row instead of duplicating it:
 *   - OPEN        → refresh diagnosis/evidence, bump occurrences, escalate (never downgrade) severity
 *   - ACKNOWLEDGED→ same refresh, status preserved (the owner is working on it)
 *   - RESOLVED    → the problem came BACK after a fix: reopen with a note
 *   - DISMISSED   → the owner explicitly said ignore: keep dismissed, only bump lastSeenAt
 *
 * `markClean` auto-resolves OPEN findings whose problem demonstrably
 * disappeared during this scan (the post-change guard closing healthy fixes).
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { maxSeverity, type FindingDraft } from './detectors'
import type { SkillKey } from './registry'

export interface PersistStats {
  created: number
  updated: number
  reopened: number
}

function toRow(draft: FindingDraft): Prisma.SkillFindingUncheckedCreateInput {
  return {
    skillKey: draft.skillKey,
    dedupeKey: draft.dedupeKey,
    workspaceId: draft.workspaceId,
    agentId: draft.agentId ?? null,
    conversationId: draft.conversationId ?? null,
    contactId: draft.contactId ?? null,
    severity: draft.severity,
    title: draft.title,
    diagnosis: draft.diagnosis,
    evidence: (draft.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
    suggestedAction: (draft.suggestedAction ?? undefined) as Prisma.InputJsonValue | undefined,
    status: draft.initialStatus ?? 'OPEN',
    firstSeenAt: draft.seenAt ?? new Date(),
    lastSeenAt: draft.seenAt ?? new Date(),
    resolvedAt: draft.initialStatus === 'RESOLVED' ? (draft.seenAt ?? new Date()) : null,
    resolvedNote: draft.initialStatus === 'RESOLVED' ? 'خودکار: بهبود در پنجرهٔ بعدی تأیید شد' : null,
  }
}

export async function persistFindings(drafts: FindingDraft[]): Promise<PersistStats> {
  const stats: PersistStats = { created: 0, updated: 0, reopened: 0 }
  for (const draft of drafts) {
    try {
      const existing = await prisma.skillFinding.findUnique({
        where: { skillKey_dedupeKey: { skillKey: draft.skillKey, dedupeKey: draft.dedupeKey } },
        select: { id: true, status: true, severity: true, occurrences: true },
      })
      if (!existing) {
        await prisma.skillFinding.create({ data: toRow(draft) })
        stats.created++
        continue
      }
      const seenAt = draft.seenAt ?? new Date()
      if (existing.status === 'RESOLVED') {
        // Recurrence after a recorded fix — reopen and keep the audit trail.
        await prisma.skillFinding.update({
          where: { id: existing.id },
          data: {
            status: 'OPEN',
            severity: maxSeverity(existing.severity as 'HIGH' | 'MEDIUM' | 'LOW', draft.severity),
            title: draft.title,
            diagnosis: draft.diagnosis,
            evidence: (draft.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
            suggestedAction: (draft.suggestedAction ?? undefined) as Prisma.InputJsonValue | undefined,
            occurrences: { increment: 1 },
            lastSeenAt: seenAt,
            resolvedAt: null,
            resolvedNote: null,
          },
        })
        stats.reopened++
      } else if (existing.status === 'DISMISSED') {
        await prisma.skillFinding.update({ where: { id: existing.id }, data: { lastSeenAt: seenAt } })
        stats.updated++
      } else {
        await prisma.skillFinding.update({
          where: { id: existing.id },
          data: {
            severity: maxSeverity(existing.severity as 'HIGH' | 'MEDIUM' | 'LOW', draft.severity),
            title: draft.title,
            diagnosis: draft.diagnosis,
            evidence: (draft.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
            suggestedAction: (draft.suggestedAction ?? undefined) as Prisma.InputJsonValue | undefined,
            occurrences: { increment: 1 },
            lastSeenAt: seenAt,
          },
        })
        stats.updated++
      }
    } catch (error) {
      console.error('[skills] persist finding failed', { dedupeKey: draft.dedupeKey, error })
    }
  }
  return stats
}

/** Auto-resolve OPEN findings whose problem disappeared in the latest scan. */
export async function markClean(skillKey: SkillKey, dedupeKeys: string[], note: string): Promise<number> {
  if (!dedupeKeys.length) return 0
  try {
    const result = await prisma.skillFinding.updateMany({
      where: { skillKey, dedupeKey: { in: dedupeKeys }, status: 'OPEN' },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedNote: note },
    })
    return result.count
  } catch (error) {
    console.error('[skills] markClean failed', { skillKey, error })
    return 0
  }
}
