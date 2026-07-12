import {
  addMinutes,
  localDateTimeToUtc,
  weekdayForDateKey,
} from '@/lib/bookings/time'

export interface AvailabilityRuleLike {
  weekday: number
  startMinute: number
  endMinute: number
  capacity: number | null
  active: boolean
}

export interface DateExceptionLike {
  closed: boolean
  startMinute: number | null
  endMinute: number | null
  capacity: number | null
}

export interface BusyAppointmentLike {
  startsAt: Date
  endsAt: Date
  partySize: number
}

export interface AvailabilityWindow {
  startMinute: number
  endMinute: number
  capacity: number
}

export interface AvailableSlot {
  startMinute: number
  startsAt: Date
  endsAt: Date
  capacity: number
  remainingCapacity: number
}

export function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
): boolean {
  return firstStart < secondEnd && firstEnd > secondStart
}

export function effectiveAvailabilityWindows(params: {
  dateKey: string
  defaultCapacity: number
  weeklyRules: readonly AvailabilityRuleLike[]
  exception?: DateExceptionLike | null
}): AvailabilityWindow[] {
  const { dateKey, defaultCapacity, exception } = params
  if (exception?.closed) return []

  const capacityOverride = exception?.capacity ?? null
  if (
    exception &&
    exception.startMinute !== null &&
    exception.endMinute !== null
  ) {
    return [{
      startMinute: exception.startMinute,
      endMinute: exception.endMinute,
      capacity: capacityOverride ?? defaultCapacity,
    }]
  }

  const weekday = weekdayForDateKey(dateKey)
  return params.weeklyRules
    .filter((rule) => rule.active && rule.weekday === weekday)
    .sort((a, b) => a.startMinute - b.startMinute)
    .map((rule) => ({
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
      capacity: capacityOverride ?? rule.capacity ?? defaultCapacity,
    }))
}

export function usedCapacityForRange(params: {
  rangeStart: Date
  rangeEnd: Date
  appointments: readonly BusyAppointmentLike[]
}): number {
  return params.appointments.reduce(
    (sum, item) =>
      intervalsOverlap(
        params.rangeStart,
        params.rangeEnd,
        item.startsAt,
        item.endsAt,
      )
        ? sum + item.partySize
        : sum,
    0,
  )
}

export function buildAvailableSlots(params: {
  dateKey: string
  timeZone: string
  durationMinutes: number
  slotIntervalMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  defaultCapacity: number
  partySize?: number
  weeklyRules: readonly AvailabilityRuleLike[]
  exception?: DateExceptionLike | null
  appointments: readonly BusyAppointmentLike[]
  now?: Date
}): AvailableSlot[] {
  const partySize = params.partySize ?? 1
  const windows = effectiveAvailabilityWindows(params)
  const slots: AvailableSlot[] = []

  for (const window of windows) {
    for (
      let startMinute = window.startMinute;
      startMinute + params.durationMinutes <= window.endMinute;
      startMinute += params.slotIntervalMinutes
    ) {
      const startsAt = localDateTimeToUtc(
        params.dateKey,
        startMinute,
        params.timeZone,
      )
      const endsAt = addMinutes(startsAt, params.durationMinutes)
      if (params.now && startsAt <= params.now) continue

      const conflictStart = addMinutes(startsAt, -params.bufferBeforeMinutes)
      const conflictEnd = addMinutes(endsAt, params.bufferAfterMinutes)
      const used = usedCapacityForRange({
        rangeStart: conflictStart,
        rangeEnd: conflictEnd,
        appointments: params.appointments,
      })
      const remainingCapacity = Math.max(0, window.capacity - used)
      if (remainingCapacity < partySize) continue

      slots.push({
        startMinute,
        startsAt,
        endsAt,
        capacity: window.capacity,
        remainingCapacity,
      })
    }
  }
  return slots
}

export function inspectRequestedSlot(params: {
  dateKey: string
  startMinute: number
  timeZone: string
  durationMinutes: number
  slotIntervalMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  defaultCapacity: number
  partySize: number
  weeklyRules: readonly AvailabilityRuleLike[]
  exception?: DateExceptionLike | null
  appointments: readonly BusyAppointmentLike[]
}): {
  allowed: boolean
  reason?: 'OUTSIDE_AVAILABILITY' | 'CAPACITY_EXCEEDED'
  startsAt: Date
  endsAt: Date
  capacity: number
  remainingCapacity: number
} {
  const startsAt = localDateTimeToUtc(
    params.dateKey,
    params.startMinute,
    params.timeZone,
  )
  const endsAt = addMinutes(startsAt, params.durationMinutes)
  const window = effectiveAvailabilityWindows(params).find(
    (item) =>
      params.startMinute >= item.startMinute &&
      params.startMinute + params.durationMinutes <= item.endMinute &&
      (params.startMinute - item.startMinute) % params.slotIntervalMinutes === 0,
  )
  if (!window) {
    return {
      allowed: false,
      reason: 'OUTSIDE_AVAILABILITY',
      startsAt,
      endsAt,
      capacity: 0,
      remainingCapacity: 0,
    }
  }

  const used = usedCapacityForRange({
    rangeStart: addMinutes(startsAt, -params.bufferBeforeMinutes),
    rangeEnd: addMinutes(endsAt, params.bufferAfterMinutes),
    appointments: params.appointments,
  })
  const remainingCapacity = Math.max(0, window.capacity - used)
  if (remainingCapacity < params.partySize) {
    return {
      allowed: false,
      reason: 'CAPACITY_EXCEEDED',
      startsAt,
      endsAt,
      capacity: window.capacity,
      remainingCapacity,
    }
  }

  return {
    allowed: true,
    startsAt,
    endsAt,
    capacity: window.capacity,
    remainingCapacity,
  }
}
