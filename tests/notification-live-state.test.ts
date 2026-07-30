import { describe, expect, it } from 'vitest'
import { selectNotificationArrivals } from '@/lib/notifications/live-state'

const items = [
  { id: 'newest', read: false },
  { id: 'older-unread', read: false },
  { id: 'read', read: true },
]

describe('live notification arrivals', () => {
  it('surfaces one concise unread alert when entering the dashboard', () => {
    expect(selectNotificationArrivals(null, items)).toEqual([items[0]])
  })

  it('surfaces newly created rows from later polls, including broadcasts', () => {
    expect(
      selectNotificationArrivals(new Set(['older-unread', 'read']), items),
    ).toEqual([items[0]])
  })

  it('does not replay rows already observed by this browser tab', () => {
    expect(
      selectNotificationArrivals(new Set(items.map((item) => item.id)), items),
    ).toEqual([])
  })
})
