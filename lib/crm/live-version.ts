type VersionRow = {
  id: string
  updatedAt: Date
}

type ContactSnapshot = {
  count: number
  latest: VersionRow | null
}

type ConversationSnapshot = {
  count: number
  latestConversation: VersionRow | null
  latestContact: VersionRow | null
}

export function contactLiveVersion(snapshot: ContactSnapshot): string {
  return [
    snapshot.count,
    snapshot.latest?.updatedAt.toISOString() ?? 'empty',
    snapshot.latest?.id ?? 'empty',
  ].join('|')
}

export function conversationLiveVersion(snapshot: ConversationSnapshot): string {
  return [
    snapshot.count,
    snapshot.latestConversation?.updatedAt.toISOString() ?? 'empty',
    snapshot.latestConversation?.id ?? 'empty',
    snapshot.latestContact?.updatedAt.toISOString() ?? 'no-contact',
    snapshot.latestContact?.id ?? 'no-contact',
  ].join('|')
}
