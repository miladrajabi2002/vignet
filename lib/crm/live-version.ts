type ContactVersionRow = {
  id: string
  createdAt: Date
  updatedAt: Date
}

type ConversationVersionRow = {
  id: string
  createdAt: Date
  contact: { id: string; updatedAt: Date } | null
}

export function contactLiveVersion(row: ContactVersionRow | null): string {
  if (!row) return 'empty'
  return [row.createdAt.toISOString(), row.id, row.updatedAt.toISOString()].join('|')
}

export function conversationLiveVersion(row: ConversationVersionRow | null): string {
  if (!row) return 'empty'
  return [
    row.createdAt.toISOString(),
    row.id,
    row.contact?.id ?? 'no-contact',
    row.contact?.updatedAt.toISOString() ?? 'no-profile',
  ].join('|')
}
