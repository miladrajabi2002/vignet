import type { ChannelType } from '@prisma/client'

/** Keep expiring Instagram signatures off the client; other channels can use their URL directly. */
export function contactAvatarSrc(params: {
  contactId?: string | null
  channel?: ChannelType | null
  rawUrl?: string | null
}): string | null {
  if (params.channel === 'INSTAGRAM' && params.contactId) {
    return `/api/contacts/${encodeURIComponent(params.contactId)}/avatar?channel=INSTAGRAM`
  }
  return params.rawUrl ?? null
}
