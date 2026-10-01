/**
 * Real booking smoke test against the configured database (and, with
 * BOOKING_SMOKE_CHAT=1, the running app's agent via the web widget).
 * Creates a throwaway workspace and deletes it at the end.
 *
 *   npx tsx -r dotenv/config scripts/booking-live-smoke.ts
 *   BOOKING_SMOKE_CHAT=1 npx tsx -r dotenv/config scripts/booking-live-smoke.ts
 */
import { prisma } from '@/lib/prisma'
import {
  BookingError,
  appointmentDaySummary,
  createAppointment,
  deleteService,
  findNextAvailableSlots,
  serviceDeletionImpact,
  listAvailableSlots,
  rescheduleAppointment,
} from '@/lib/bookings/service'
import { executeBookingAgentTool } from '@/lib/bookings/agent-tools'
import { dateKeyInTimeZone, localDateTimeToUtc } from '@/lib/bookings/time'
import { shiftDateKey } from '@/lib/bookings/calendar-context'

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
const baseUrl = (process.env.AGENT_SMOKE_BASE_URL || 'http://127.0.0.1:3003').replace(/\/$/, '')
let failures = 0

function check(name: string, passed: boolean, detail?: unknown) {
  if (!passed) failures++
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
}

async function expectBookingError(promise: Promise<unknown>, code: string): Promise<boolean> {
  try { await promise; return false } catch (error) { return error instanceof BookingError && error.code === code }
}

/** Next date (from tomorrow) whose weekday is in `weekdays`. */
function nextWeekday(from: string, weekdays: number[]): string {
  for (let offset = 1; offset <= 14; offset++) {
    const key = shiftDateKey(from, offset)
    if (weekdays.includes(new Date(`${key}T12:00:00Z`).getUTCDay())) return key
  }
  throw new Error('no weekday')
}

async function sendTurn(agentId: string, message: string, previous?: { conversationId: string; conversationToken: string }) {
  const response = await fetch(`${baseUrl}/api/widget/${encodeURIComponent(agentId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, conversationId: previous?.conversationId, conversationToken: previous?.conversationToken }),
    signal: AbortSignal.timeout(120_000),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`chat ${response.status}: ${body.slice(0, 300)}`)
  let answer = ''
  let conversationId = previous?.conversationId ?? ''
  for (const block of body.split(/\n\n+/)) {
    const line = block.split('\n').find((part) => part.trimStart().startsWith('data:'))
    if (!line) continue
    try {
      const event = JSON.parse(line.slice(line.indexOf('data:') + 5).trim()) as Record<string, unknown>
      if (event.type === 'meta' && typeof event.conversationId === 'string') conversationId = event.conversationId
      if (event.type === 'delta' && typeof event.text === 'string') answer += event.text
    } catch { /* keep-alive */ }
  }
  const conversationToken = response.headers.get('x-vigent-conversation-token') ?? previous?.conversationToken ?? ''
  console.log(`\n  👤 ${message}\n  🤖 ${answer.trim()}\n`)
  return { answer: answer.trim(), conversationId, conversationToken }
}

async function main() {
  const workspace = await prisma.workspace.create({
    data: {
      name: `Booking smoke ${runId}`,
      slug: `booking-smoke-${runId}`,
      plan: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      aiCreditBalanceIRR: 200_000,
      excludeFromAdminReports: true,
      onboardingCompleted: true,
      businessType: 'SERVICES',
    },
    select: { id: true },
  })
  const workspaceId = workspace.id
  try {
    const today = dateKeyInTimeZone(new Date())
    // Saturday–Wednesday 09:00–13:00 and 14:00–18:00 (lunch break), Thursday
    // 09:00–13:00, Friday closed. 60-minute sessions every 30 minutes.
    const openDays = [6, 0, 1, 2, 3]
    const service = await prisma.service.create({
      data: {
        workspaceId,
        slug: `smoke-${runId}`,
        name: 'مشاوره پوست',
        durationMinutes: 60,
        slotIntervalMinutes: 30,
        capacity: 1,
        location: 'تهران، ونک',
        weeklyRules: {
          create: [
            ...openDays.flatMap((weekday) => [
              { weekday, startMinute: 540, endMinute: 780 },
              { weekday, startMinute: 840, endMinute: 1080 },
            ]),
            { weekday: 4, startMinute: 540, endMinute: 780 },
          ],
        },
      },
    })
    const workday = nextWeekday(today, openDays)
    const friday = nextWeekday(today, [5])

    // ── Availability ──
    const slots = await listAvailableSlots({ workspaceId, serviceId: service.id, dateKey: workday })
    const times = slots.slots.map((slot) => slot.startMinute)
    check('split shift yields 14 slots and none across lunch', slots.slots.length === 14 && !times.includes(750) && times.includes(720) && times.includes(840), times)
    const fridaySlots = await listAvailableSlots({ workspaceId, serviceId: service.id, dateKey: friday })
    check('Friday (closed weekday) has no slots', fridaySlots.slots.length === 0)

    // ── Capacity & conflicts ──
    const base = { serviceId: service.id, localDate: workday, partySize: 1, source: 'dashboard' as const }
    const first = await createAppointment(workspaceId, { ...base, startMinute: 600, customerName: 'علی تست', customerPhone: '+989121111111' })
    check('book 10:00', first.created && first.appointment.startsAt.getTime() === localDateTimeToUtc(workday, 600).getTime())
    check('overlapping 10:30 rejected (capacity 1)', await expectBookingError(
      createAppointment(workspaceId, { ...base, startMinute: 630, customerName: 'مریم تست', customerPhone: '+989122222222' }), 'CAPACITY_EXCEEDED'))
    check('off-grid 10:10 rejected', await expectBookingError(
      createAppointment(workspaceId, { ...base, startMinute: 610, customerName: 'مریم تست', customerPhone: '+989122222222' }), 'OUTSIDE_AVAILABILITY'))
    check('lunch-crossing 12:30 rejected', await expectBookingError(
      createAppointment(workspaceId, { ...base, startMinute: 750, customerName: 'مریم تست', customerPhone: '+989122222222' }), 'OUTSIDE_AVAILABILITY'))

    // Concurrency: 5 parallel requests for the same slot → exactly one wins.
    const race = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => createAppointment(workspaceId, {
      ...base, startMinute: 900, customerName: `رقیب ${index}`, customerPhone: `+98912333333${index}`,
    })))
    check('5 concurrent bookings of 15:00 → exactly 1 succeeds', race.filter((item) => item.status === 'fulfilled').length === 1,
      race.map((item) => (item.status === 'fulfilled' ? 'ok' : (item.reason as Error).message)))

    // ── Reschedule into an overlapping time of itself ──
    const moved = await rescheduleAppointment({ workspaceId, appointmentId: first.appointment.id, localDate: workday, startMinute: 630, source: 'dashboard' })
    const old = await prisma.appointment.findUniqueOrThrow({ where: { id: first.appointment.id } })
    check('reschedule 10:00 → 10:30 succeeds despite overlapping itself', moved.created && old.status === 'CANCELLED')
    check('rescheduled booking keeps customer and links back', moved.appointment.customerName === 'علی تست'
      && (moved.appointment as { metadata?: unknown }).metadata !== undefined)
    check('reschedule onto a full slot fails and keeps the original', await expectBookingError(
      rescheduleAppointment({ workspaceId, appointmentId: moved.appointment.id, localDate: workday, startMinute: 900, source: 'dashboard' }), 'CAPACITY_EXCEEDED')
      && (await prisma.appointment.findUniqueOrThrow({ where: { id: moved.appointment.id } })).status === 'CONFIRMED')

    // ── Closure + earliest-slot search ──
    await prisma.serviceDateException.create({ data: { serviceId: service.id, date: new Date(`${workday}T00:00:00.000Z`), closed: true } })
    const next = await findNextAvailableSlots({ workspaceId, serviceId: service.id, fromDateKey: workday, days: 14, maxDates: 2 })
    check('earliest search skips the closed date and Friday', next.dates.length === 2 && next.dates.every((item) => item.date !== workday && new Date(`${item.date}T12:00:00Z`).getUTCDay() !== 5), next.dates.map((item) => item.date))
    await prisma.serviceDateException.deleteMany({ where: { serviceId: service.id } })

    // ── Summary ──
    const summary = await appointmentDaySummary({ workspaceId, fromDateKey: today, days: 14 })
    check('day summary counts active bookings on the workday', summary[workday]?.active === 2, summary[workday])

    // ── Agent tool scope ──
    const conversationA = `conv-a-${runId}`
    const created = await executeBookingAgentTool({
      workspaceId,
      conversationId: conversationA,
      name: 'create_appointment',
      arguments: { serviceId: service.id, localDate: workday, startMinute: 960, customerName: 'سارا تست', customerPhone: '09124444444', idempotencyKey: `agent:${conversationA}:x` },
    }) as { ok?: boolean; dateLabel?: string; localTime?: string }
    check('agent create returns Jalali label + local time', created.ok === true && created.localTime === '16:00' && /مهر|آبان|آذر|دی|بهمن|اسفند|فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور/.test(created.dateLabel ?? ''), created)
    const mine = await executeBookingAgentTool({ workspaceId, conversationId: conversationA, name: 'list_my_appointments', arguments: {} }) as { appointments: Array<{ appointmentId: string }> }
    const others = await executeBookingAgentTool({ workspaceId, conversationId: `conv-b-${runId}`, name: 'list_my_appointments', arguments: {} }) as { appointments: unknown[] }
    check('customer sees own booking only', mine.appointments.length === 1 && others.appointments.length === 0)
    const foreignCancel = await executeBookingAgentTool({
      workspaceId, conversationId: `conv-b-${runId}`, name: 'cancel_appointment',
      arguments: { appointmentId: mine.appointments[0].appointmentId, reason: 'test', confirmedByCustomer: true },
    }) as { cancelled?: boolean }
    check('another conversation cannot cancel it', foreignCancel.cancelled === false)
    const agentMove = await executeBookingAgentTool({
      workspaceId, conversationId: conversationA, name: 'reschedule_appointment',
      arguments: { appointmentId: mine.appointments[0].appointmentId, localDate: workday, startMinute: 990, confirmedByCustomer: true },
    }) as { ok?: boolean; localTime?: string }
    check('agent reschedule works and stays in scope', agentMove.ok === true && agentMove.localTime === '16:30')
    const afterMove = await executeBookingAgentTool({ workspaceId, conversationId: conversationA, name: 'list_my_appointments', arguments: {} }) as { appointments: Array<{ appointmentId: string; localTime: string }> }
    check('moved booking still visible to the same customer', afterMove.appointments.length === 1 && afterMove.appointments[0].localTime === '16:30')
    const closedTool = await executeBookingAgentTool({ workspaceId, name: 'list_available_slots', arguments: { serviceId: service.id, date: friday } }) as { reason?: string; nextAvailable?: { date: string } | null }
    check('closed day explains why and suggests next date', closedTool.reason === 'NOT_A_WORKING_DAY' && Boolean(closedTool.nextAvailable?.date), closedTool)

    // ── Deleting a service ──
    const doomed = await prisma.service.create({
      data: { workspaceId, slug: `doomed-${runId}`, name: 'خدمت حذفی', durationMinutes: 30, slotIntervalMinutes: 30, weeklyRules: { create: openDays.map((weekday) => ({ weekday, startMinute: 540, endMinute: 780 })) } },
    })
    const upcoming = await createAppointment(workspaceId, { serviceId: doomed.id, localDate: workday, startMinute: 600, customerName: 'مشتری آینده', customerPhone: '+989120000009', partySize: 1, source: 'dashboard' })
    await prisma.appointment.create({ data: { workspaceId, serviceId: doomed.id, customerName: 'مشتری قبلی', startsAt: new Date(Date.now() - 3 * 86_400_000), endsAt: new Date(Date.now() - 3 * 86_400_000 + 1_800_000), status: 'COMPLETED' } })
    const impact = await serviceDeletionImpact(workspaceId, doomed.id)
    check('delete impact counts history and upcoming', impact?.total === 2 && impact.upcoming === 1, impact)
    const blocked = await deleteService(workspaceId, doomed.id)
    check('delete refused while a customer holds an upcoming booking', !blocked.ok && blocked.error === 'HAS_UPCOMING' && Boolean(await prisma.service.findUnique({ where: { id: doomed.id } })), blocked)
    const foreign = await deleteService('not-this-workspace', doomed.id)
    check('another workspace cannot delete it', !foreign.ok && foreign.error === 'NOT_FOUND')
    await prisma.appointment.update({ where: { id: upcoming.appointment.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
    const deleted = await deleteService(workspaceId, doomed.id)
    check('delete succeeds after cancelling and removes history + rules', deleted.ok && deleted.appointments === 2
      && !(await prisma.service.findUnique({ where: { id: doomed.id } }))
      && (await prisma.serviceAvailabilityRule.count({ where: { serviceId: doomed.id } })) === 0, deleted)

    if (process.env.BOOKING_SMOKE_CHAT === '1') await chatScenario(workspaceId, service.id, today)
  } finally {
    await prisma.appointment.deleteMany({ where: { workspaceId } })
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch((error) => console.error('cleanup failed', error))
  }
}

async function chatScenario(workspaceId: string, serviceId: string, today: string) {
  console.log('\n── Live agent conversation ──')
  // Start from an empty calendar: the DB checks above booked the same days.
  await prisma.appointment.deleteMany({ where: { workspaceId } })
  const agent = await prisma.agent.create({
    data: {
      workspaceId,
      name: 'ایجنت رزرو کلینیک',
      language: 'fa',
      active: true,
      requireCustomerInfo: false,
      handoffEnabled: false,
      roleTemplate: 'appointments',
      systemPrompt: 'تو دستیار رزرو کلینیک پوست «رز» هستی. کوتاه، مؤدب و فارسی پاسخ بده.',
      channels: { create: { type: 'WEB_WIDGET', active: true, config: { allowedDomains: [], leadCapture: false } } },
    },
    select: { id: true },
  })
  const tomorrow = shiftDateKey(today, 1)
  const tomorrowOpen = [6, 0, 1, 2, 3, 4].includes(new Date(`${tomorrow}T12:00:00Z`).getUTCDay())

  let turn = await sendTurn(agent.id, 'سلام، فردا ساعت ۱۰ صبح برای مشاوره پوست وقت خالی دارید؟')
  check('agent answers about tomorrow with real availability', tomorrowOpen ? /۱۰|10/.test(turn.answer) : /تعطیل|جمعه|نزدیک|آزاد/.test(turn.answer))
  turn = await sendTurn(agent.id, 'بله همون ساعت ۱۰ رو برام رزرو کنید. سارا محمدی هستم، ۰۹۱۲۵۵۵۶۶۷۷', turn)
  let booked = await prisma.appointment.findFirst({ where: { workspaceId, status: 'CONFIRMED', customerPhone: '+989125556677' } })
  if (!booked) {
    turn = await sendTurn(agent.id, 'بله، تأیید می‌کنم. ثبت کنید.', turn)
    booked = await prisma.appointment.findFirst({ where: { workspaceId, status: 'CONFIRMED', customerPhone: '+989125556677' } })
  }
  const expectedDate = tomorrowOpen ? tomorrow : null
  check('agent booked in the database', Boolean(booked), booked ? { date: dateKeyInTimeZone(booked.startsAt), time: booked.startsAt.toISOString() } : null)
  if (booked && expectedDate) {
    check('booked the right day and 10:00 Tehran', dateKeyInTimeZone(booked.startsAt) === expectedDate
      && booked.startsAt.getTime() === localDateTimeToUtc(expectedDate, 600).getTime())
  }
  check('reply confirms only after a real booking', !booked || /ثبت|رزرو شد|تأیید شد/.test(turn.answer))

  turn = await sendTurn(agent.id, 'ببخشید میشه نوبتم رو ببرید ساعت ۱۱؟', turn)
  if (!/ساعت ۱۱|11:00|۱۱:۰۰/.test(turn.answer) || /تأیید|مطمئن|؟/.test(turn.answer)) turn = await sendTurn(agent.id, 'بله، ببرید ساعت ۱۱.', turn)
  const moved = await prisma.appointment.findFirst({ where: { workspaceId, status: 'CONFIRMED', customerPhone: '+989125556677' } })
  check('agent moved the booking to 11:00', Boolean(moved && booked && moved.id !== booked.id && moved.startsAt.getTime() - booked.startsAt.getTime() === 60 * 60_000),
    moved?.startsAt.toISOString())

  turn = await sendTurn(agent.id, 'جمعه هم باز هستید؟', turn)
  check('agent says Friday is closed', /تعطیل|بسته|باز نیست|نیستیم/.test(turn.answer))

  turn = await sendTurn(agent.id, 'راستش کلاً نوبتم رو لغو کنید لطفاً، برام کاری پیش اومده.', turn)
  let active = await prisma.appointment.count({ where: { workspaceId, status: 'CONFIRMED', customerPhone: '+989125556677' } })
  if (active) {
    turn = await sendTurn(agent.id, 'بله، لغو کنید.', turn)
    active = await prisma.appointment.count({ where: { workspaceId, status: 'CONFIRMED', customerPhone: '+989125556677' } })
  }
  check('agent cancelled after confirmation', active === 0)
  void serviceId
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log(failures ? `\n${failures} check(s) failed` : '\nAll booking checks passed')
    process.exit(failures ? 1 : 0)
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
