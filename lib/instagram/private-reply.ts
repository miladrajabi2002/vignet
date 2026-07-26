/**
 * Instagram "private reply" addressing.
 *
 * Meta only lets a business DM a user who has messaged it first. A commenter
 * with NO prior DM thread is reachable only via a one-time Private Reply,
 * addressed by `recipient.comment_id` (allowed once per comment, within 7
 * days). Sending to `recipient.id` for such users fails with error #100 —
 * which used to break the whole "comment a keyword → get a DM" funnel for
 * new audiences.
 *
 * These helpers encode the private-reply target inside the adapter's string
 * chatId so every send path (adapter.sendText and the media/template senders)
 * can route correctly without changing the MessengerAdapter interface.
 *
 * Format: `private:<commentId>` or `private:<commentId>:<userIgsid>`. The
 * optional IGSID lets multi-part sends fall back to a normal DM (works when a
 * thread exists) for parts after the single allowed private reply.
 */
export const PRIVATE_REPLY_PREFIX = 'private:'

export function instagramPrivateReplyTarget(
  commentId: string,
  userId?: string,
): string {
  return userId
    ? `${PRIVATE_REPLY_PREFIX}${commentId}:${userId}`
    : `${PRIVATE_REPLY_PREFIX}${commentId}`
}

export function parsePrivateReplyTarget(
  chatId: string,
): { commentId: string; userId: string | null } | null {
  if (!chatId.startsWith(PRIVATE_REPLY_PREFIX)) return null
  const rest = chatId.slice(PRIVATE_REPLY_PREFIX.length)
  const sep = rest.indexOf(':')
  if (sep === -1) return { commentId: rest, userId: null }
  return { commentId: rest.slice(0, sep), userId: rest.slice(sep + 1) || null }
}

/** Build the `/me/messages` recipient payload for any adapter chatId. */
export function igRecipient(chatId: string): Record<string, string> {
  const pr = parsePrivateReplyTarget(chatId)
  return pr ? { comment_id: pr.commentId } : { id: chatId }
}
