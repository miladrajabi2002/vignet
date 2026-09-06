// Shared by model context and both inbox timelines. System activity does not
// keep a dialogue alive; a returning customer starts the next session.
export const CONVERSATION_IDLE_HOURS = 48
export const CONVERSATION_IDLE_MS = CONVERSATION_IDLE_HOURS * 60 * 60 * 1000

export type SessionMessage = { id: string; role: string; createdAt: Date | string }

export function startsNewSession(previous: SessionMessage, next: SessionMessage): boolean {
  return next.role === 'USER' &&
    new Date(next.createdAt).getTime() - new Date(previous.createdAt).getTime() >= CONVERSATION_IDLE_MS
}

/** Input is chronological. Return IDs of returning customer messages. */
export function conversationSessionBoundaries(messages: SessionMessage[]): Set<string> {
  const boundaries = new Set<string>()
  let previous: SessionMessage | undefined
  for (const message of messages) {
    if (message.role !== 'USER' && message.role !== 'ASSISTANT') continue
    if (previous && startsNewSession(previous, message)) boundaries.add(message.id)
    previous = message
  }
  return boundaries
}

export function currentSessionMessages<T extends SessionMessage>(messages: T[]): T[] {
  const boundaries = conversationSessionBoundaries(messages)
  for (let index = messages.length - 1; index >= 0; index--) {
    if (boundaries.has(messages[index].id)) return messages.slice(index)
  }
  return messages
}
