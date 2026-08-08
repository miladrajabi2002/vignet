import { getRedis } from '@/lib/redis'

export type OAuthProvider = 'instagram'

export interface OAuthStateBinding {
  userId: string
  workspaceId: string
  agentId: string
}

const OAUTH_STATE_TTL_SECONDS = 10 * 60

function stateKey(provider: OAuthProvider, nonce: string): string {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new Error('Invalid OAuth nonce')
  }
  return `oauth-state:${provider}:${nonce}`
}

function serializeBinding(binding: OAuthStateBinding): string {
  return JSON.stringify({
    userId: binding.userId,
    workspaceId: binding.workspaceId,
    agentId: binding.agentId,
  })
}

/** Store a short-lived, server-side OAuth handshake. Redis failure is fatal. */
export async function createOAuthState(
  provider: OAuthProvider,
  nonce: string,
  binding: OAuthStateBinding,
): Promise<void> {
  const result = await getRedis().set(
    stateKey(provider, nonce),
    serializeBinding(binding),
    'EX',
    OAUTH_STATE_TTL_SECONDS,
    'NX',
  )
  if (result !== 'OK') throw new Error('OAuth nonce collision')
}

/**
 * Atomically validate and consume a handshake. A callback can therefore be
 * used only once, only by the browser session that initiated it, and only
 * while its 10-minute Redis TTL is alive.
 */
export async function consumeOAuthState(
  provider: OAuthProvider,
  nonce: string,
  binding: OAuthStateBinding,
): Promise<boolean> {
  const result = await getRedis().eval(
    `local value = redis.call('GET', KEYS[1])
     if not value then return 0 end
     if value ~= ARGV[1] then return -1 end
     redis.call('DEL', KEYS[1])
     return 1`,
    1,
    stateKey(provider, nonce),
    serializeBinding(binding),
  )
  return Number(result) === 1
}
