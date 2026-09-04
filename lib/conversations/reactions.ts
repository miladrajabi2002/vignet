type MessageLike = {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  createdAt: string | Date
  metadata: unknown
}

export type ConversationReaction = {
  id: string
  emoji: string
  createdAt: string
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function inboundSource(metadata: unknown): Record<string, unknown> | null {
  return objectValue(objectValue(metadata)?.vigentoInbound)
}

export function isStandaloneInstagramReaction(message: Pick<MessageLike, 'metadata'>): boolean {
  const source = inboundSource(message.metadata)
  return source?.channel === 'INSTAGRAM' && source.kind === 'REACTION'
}

export function standaloneReactionEmoji(
  message: Pick<MessageLike, 'content' | 'metadata'>,
): string | null {
  return isStandaloneInstagramReaction(message) && message.content.trim()
    ? message.content.trim()
    : null
}

function messagePlatformId(message: Pick<MessageLike, 'metadata'>): string | null {
  const value = inboundSource(message.metadata)?.platformMessageId
  return typeof value === 'string' && value ? value : null
}

function storedReactions(message: MessageLike): ConversationReaction[] {
  const raw = objectValue(message.metadata)?.vigentoReactions
  if (!Array.isArray(raw)) return []

  return raw.flatMap((value, index) => {
    const reaction = objectValue(value)
    if (!reaction) return []
    const emoji = reaction.emoji
    if (typeof emoji !== 'string' || !emoji.trim()) return []
    const id = typeof reaction.id === 'string' ? reaction.id : `${message.id}:stored:${index}`
    const createdAt = typeof reaction.createdAt === 'string'
      ? reaction.createdAt
      : new Date(message.createdAt).toISOString()
    return [{ id, emoji: emoji.trim(), createdAt }]
  })
}

/**
 * Hide legacy standalone Instagram reaction rows and associate them with the
 * message they reacted to. New reactions are already stored on the target
 * message; the legacy fallback prefers the latest assistant message because
 * Instagram reaction webhooks commonly refer to an outbound DM whose provider
 * id was not persisted by older versions.
 */
export function presentConversationMessages<T extends MessageLike>(source: T[]): {
  messages: T[]
  reactionsByMessageId: Map<string, ConversationReaction[]>
} {
  const messages = source.filter((message) => !isStandaloneInstagramReaction(message))
  const reactionsByMessageId = new Map<string, ConversationReaction[]>()

  for (const message of messages) {
    const reactions = storedReactions(message)
    if (reactions.length) reactionsByMessageId.set(message.id, reactions)
  }

  source.forEach((reactionMessage, reactionIndex) => {
    if (!isStandaloneInstagramReaction(reactionMessage)) return

    const targetPlatformId = messagePlatformId(reactionMessage)
    let target = targetPlatformId
      ? source.slice(0, reactionIndex).reverse().find((candidate) =>
          !isStandaloneInstagramReaction(candidate) && messagePlatformId(candidate) === targetPlatformId,
        )
      : undefined
    target ??= source.slice(0, reactionIndex).reverse().find((candidate) =>
      !isStandaloneInstagramReaction(candidate) && candidate.role === 'ASSISTANT',
    )
    target ??= source.slice(0, reactionIndex).reverse().find((candidate) =>
      !isStandaloneInstagramReaction(candidate) && candidate.role !== 'SYSTEM',
    )
    if (!target) return

    const emoji = standaloneReactionEmoji(reactionMessage)
    if (!emoji) return
    const reactions = reactionsByMessageId.get(target.id) ?? []
    if (!reactions.some((reaction) => reaction.id === reactionMessage.id)) {
      reactions.push({
        id: reactionMessage.id,
        emoji,
        createdAt: new Date(reactionMessage.createdAt).toISOString(),
      })
      reactionsByMessageId.set(target.id, reactions)
    }
  })

  return { messages, reactionsByMessageId }
}
