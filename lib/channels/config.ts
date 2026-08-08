import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/crypto'

/**
 * Shape of the JSON stored in AgentChannel.config for messenger channels.
 * The bot token is encrypted at rest; the webhookToken is a random,
 * non-sensitive lookup id placed in the public webhook path.
 */
export interface MessengerConfig {
  webhookToken: string
  botTokenEnc: string
  botUsername?: string
}

/** Generate a URL-safe random token for the webhook path. */
export function newWebhookToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/** Build a fresh messenger config from a plaintext bot token. */
export function buildMessengerConfig(
  botToken: string,
  botUsername?: string,
): MessengerConfig {
  return {
    webhookToken: newWebhookToken(),
    botTokenEnc: encrypt(botToken),
    botUsername,
  }
}

/** Decrypt the bot token from a stored config, or null when absent/invalid. */
export function readBotToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<MessengerConfig> | null
  if (!c?.botTokenEnc) return null
  try {
    return decrypt(c.botTokenEnc)
  } catch {
    return null
  }
}

/**
 * Optional per-channel behavior settings, stored under `config.settings` on the
 * same AgentChannel row (so no migration is needed). Edited from the dashboard
 * channel card; consumed by the inbound handler on every reply.
 */
export interface MessengerSettings {
	/**
	 * Suggested questions shown as tappable buttons under the agent's replies
	 * (Telegram/Bale reply keyboard and Instagram quick replies). Tapping one
	 * sends its text as a normal user message. Max 4.
	 */
	quickReplies: string[]
}

/** Coerce the `settings` blob of a channel config into a safe settings object. */
export function normalizeMessengerSettings(config: Prisma.JsonValue): MessengerSettings {
	const c = config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
	const s =
		c.settings && typeof c.settings === 'object'
			? (c.settings as Record<string, unknown>)
			: {}
	const quickReplies = Array.isArray(s.quickReplies)
		? s.quickReplies
				.filter((q): q is string => typeof q === 'string' && !!q.trim())
				.map((q) => q.trim().slice(0, 40))
				.slice(0, 4)
		: []
	return { quickReplies }
}

/** Read the webhook token from a stored config, or null. */
export function readWebhookToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<MessengerConfig> | null
  return c?.webhookToken ?? null
}

/** Last 4 chars of a bot token, for a safe display hint. */
export function botTokenHint(botToken: string): string {
  return botToken.length <= 6 ? '••••' : `…${botToken.slice(-6)}`
}
