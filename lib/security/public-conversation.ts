import crypto from 'node:crypto'

export type PublicConversationScope = 'widget' | 'chat-link'

function tokenSecret(): string {
  const value = process.env.PUBLIC_CONVERSATION_SECRET || process.env.AUTH_SECRET
  if (!value) throw new Error('PUBLIC_CONVERSATION_SECRET (or AUTH_SECRET) is not set')
  return value
}

export function createPublicConversationToken(
  scope: PublicConversationScope,
  conversationId: string,
  audience: string,
): string {
  return crypto
    .createHmac('sha256', tokenSecret())
    .update(`${scope}:${audience}:${conversationId}`)
    .digest('base64url')
}

export function verifyPublicConversationToken(
  scope: PublicConversationScope,
  conversationId: string,
  audience: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false
  const expected = createPublicConversationToken(scope, conversationId, audience)
  const actualBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}
