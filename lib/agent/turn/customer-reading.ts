/**
 * Store the understanding layer's reading of the customer's message on the
 * USER message (metadata.understanding): mood, buying stage, cues and the
 * acts. Sales insights (satisfaction, buyer probability) read it as the
 * customer-side signal, independent of the reply model's self-report.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { VerifiedUnderstanding } from '@/lib/agent/understand/types'

export interface StoredCustomerReading {
  v: 1
  mood: VerifiedUnderstanding['customer']['mood']
  buy: VerifiedUnderstanding['customer']['buy']
  cues: VerifiedUnderstanding['customer']['cues']
  acts: string[]
  confidence: number
}

export function storedReading(verified: VerifiedUnderstanding): StoredCustomerReading {
  return {
    v: 1,
    mood: verified.customer.mood,
    buy: verified.customer.buy,
    cues: verified.customer.cues,
    acts: verified.acts.map((act) => act.type),
    confidence: Math.round(verified.confidence * 100) / 100,
  }
}

/** Read a stored reading back from Message.metadata. */
export function readStoredReading(metadata: unknown): StoredCustomerReading | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).understanding
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const mood = value.mood
  const buy = Number(value.buy)
  if (!['pos', 'neu', 'neg', 'ang'].includes(String(mood)) || !Number.isInteger(buy) || buy < 0 || buy > 3) return null
  return {
    v: 1,
    mood: mood as StoredCustomerReading['mood'],
    buy: buy as StoredCustomerReading['buy'],
    cues: Array.isArray(value.cues) ? value.cues.filter((cue): cue is StoredCustomerReading['cues'][number] => typeof cue === 'string') : [],
    acts: Array.isArray(value.acts) ? value.acts.filter((act): act is string => typeof act === 'string') : [],
    confidence: typeof value.confidence === 'number' ? value.confidence : 0.5,
  }
}

/** Fire-and-forget merge into the inbound message's metadata. */
export function recordCustomerReading(messageId: string, verified: VerifiedUnderstanding): void {
  const reading = storedReading(verified)
  void prisma.message.findUnique({ where: { id: messageId }, select: { metadata: true } })
    .then((row) => {
      const base = row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {}
      return prisma.message.update({
        where: { id: messageId },
        data: { metadata: { ...base, understanding: reading } as unknown as Prisma.InputJsonObject },
      })
    })
    .catch(() => {})
}
