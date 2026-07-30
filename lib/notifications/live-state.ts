export interface NotificationIdentity {
  id: string
  read: boolean
}

/**
 * The first dashboard load surfaces only the newest unread item. Later polls
 * surface every unseen database row, including admin broadcasts, without
 * replaying notifications already observed by this tab.
 */
export function selectNotificationArrivals<T extends NotificationIdentity>(
  previousIds: ReadonlySet<string> | null,
  items: readonly T[],
): T[] {
  if (previousIds === null) {
    return items.filter((item) => !item.read).slice(0, 1)
  }
  return items.filter((item) => !previousIds.has(item.id))
}
