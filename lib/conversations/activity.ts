import type { Prisma } from '@prisma/client'

/**
 * Machine-readable receipts attached to messages in `Message.metadata`.
 *
 * Keeping receipts on the message that produced them gives the operator an
 * auditable timeline without introducing a second event store.  Only bounded
 * facts are persisted here (counts and stable kinds) -- never retrieved text,
 * prompts, phone numbers, or other customer PII.
 */
export const CONVERSATION_ACTIVITY_VERSION = 1 as const

export type ConversationReceiptKind =
  | 'knowledge_used'
  | 'catalog_checked'
  | 'products_presented'
  | 'products_compared'
  | 'stock_checked'
  | 'link_shared'
  | 'slots_checked'
  | 'appointment_booked'
  | 'appointment_cancelled'

export type ConversationTimelineKind =
  | 'customer_identified'
  | 'handoff_ready'
  | 'operator_reply'
  | 'campaign_sent'

export interface ConversationReceipt {
  kind: ConversationReceiptKind
  count?: number
}

export interface ConversationTimelineActivity {
  kind: ConversationTimelineKind
  fields?: Array<'name' | 'phone'>
  summaryReady?: boolean
  source?: 'dashboard' | 'telegram_bot' | 'agent'
}

export interface TurnEvidence {
  userMessage: string
  assistantReply: string
  retrievedChunks: Array<{ metadata: unknown }>
}

function uniqueProductCount(chunks: Array<{ metadata: unknown }>): number {
  const ids = new Set<string>()
  for (const chunk of chunks) {
    if (!chunk.metadata || typeof chunk.metadata !== 'object') continue
    const productId = (chunk.metadata as Record<string, unknown>).productId
    if (typeof productId === 'string' && productId) ids.add(productId)
  }
  return ids.size
}

function productCardCount(content: string): number {
  return content.match(/\[\[product:\{[\s\S]*?\}\]\]/g)?.length ?? 0
}

/** Build receipts only from facts that actually happened during the turn. */
export function buildTurnReceipts(evidence: TurnEvidence): ConversationReceipt[] {
  const receipts: ConversationReceipt[] = []
  const chunkCount = evidence.retrievedChunks.length
  const catalogCount = uniqueProductCount(evidence.retrievedChunks)
  const cards = productCardCount(evidence.assistantReply)
  const normalizedQuestion = evidence.userMessage.toLocaleLowerCase('fa')
  const normalizedReply = evidence.assistantReply.toLocaleLowerCase('fa')

  if (chunkCount > 0) receipts.push({ kind: 'knowledge_used', count: chunkCount })
  if (catalogCount > 0) receipts.push({ kind: 'catalog_checked', count: catalogCount })

  if (cards > 0) {
    const asksForComparison = /(\u0645\u0642\u0627\u06cc\u0633|\u0641\u0631\u0642|\u06a9\u062f\u0627\u0645|compare|difference|which)/i.test(normalizedQuestion)
    receipts.push({
      kind: asksForComparison && cards > 1 ? 'products_compared' : 'products_presented',
      count: cards,
    })
  }

  if (
    catalogCount > 0 &&
    /(\u0645\u0648\u062c\u0648\u062f|\u0645\u0648\u062c\u0648\u062f\u06cc|\u0627\u0646\u0628\u0627\u0631|stock|available)/i.test(normalizedQuestion) &&
    /(\u0645\u0648\u062c\u0648\u062f|\u0646\u0627\u0645\u0648\u062c\u0648\u062f|stock|available|unavailable|out of stock)/i.test(normalizedReply)
  ) {
    receipts.push({ kind: 'stock_checked' })
  }

  if (/https?:\/\/[^\s)\]]+/i.test(evidence.assistantReply)) {
    receipts.push({ kind: 'link_shared' })
  }

  return receipts
}

export function metadataWithReceipts(
  receipts: ConversationReceipt[],
  base?: Record<string, unknown>,
): Prisma.InputJsonObject | undefined {
  if (receipts.length === 0 && !base) return undefined
  return {
    ...(base ?? {}),
    ...(receipts.length > 0
      ? {
          vigentoReceipts: receipts as unknown as Prisma.InputJsonArray,
          vigentoActivityVersion: CONVERSATION_ACTIVITY_VERSION,
        }
      : {}),
  } as Prisma.InputJsonObject
}

/** Append a centered timeline event to the existing conversation message log. */
export async function recordConversationActivity(
  tx: Pick<Prisma.TransactionClient, 'message'>,
  conversationId: string,
  activity: ConversationTimelineActivity,
): Promise<void> {
  await tx.message.create({
    data: {
      conversationId,
      role: 'SYSTEM',
      // Human copy is rendered from the stable metadata kind in the viewer.
      content: activity.kind,
      metadata: {
        vigentoActivity: activity as unknown as Prisma.InputJsonObject,
        vigentoActivityVersion: CONVERSATION_ACTIVITY_VERSION,
      },
    },
  })
}
