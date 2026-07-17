import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  listAppointmentsForDate,
  listBookingServices,
} from '@/lib/bookings/service'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import { AppointmentsWorkspace } from '@/components/bookings/appointments-workspace'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const today = dateKeyInTimeZone(new Date(), 'Asia/Tehran')
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60_000)

  const [services, appointments, upcomingCount, pendingCount] = await Promise.all([
    listBookingServices(user.workspaceId),
    listAppointmentsForDate({
      workspaceId: user.workspaceId,
      dateKey: today,
    }),
    prisma.appointment.count({
      where: {
        workspaceId: user.workspaceId,
        startsAt: { gte: new Date(), lt: weekEnd },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    }),
    prisma.appointment.count({
      where: { workspaceId: user.workspaceId, status: 'PENDING' },
    }),
  ])

  return (
    <AppointmentsWorkspace
      locale={locale}
      initialDate={today}
      initialStats={{ upcomingCount, pendingCount }}
      initialServices={services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        slotIntervalMinutes: service.slotIntervalMinutes,
        bufferBeforeMinutes: service.bufferBeforeMinutes,
        bufferAfterMinutes: service.bufferAfterMinutes,
        capacity: service.capacity,
        timezone: service.timezone,
        location: service.location,
        active: service.active,
        appointmentCount: service._count.appointments,
        weeklyRules: service.weeklyRules.map((rule) => ({
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
          capacity: rule.capacity,
          active: rule.active,
        })),
        exceptions: service.exceptions.map((exception) => ({
          id: exception.id,
          date: exception.date.toISOString().slice(0, 10),
          closed: exception.closed,
          startMinute: exception.startMinute,
          endMinute: exception.endMinute,
          capacity: exception.capacity,
          note: exception.note,
        })),
      }))}
      initialAppointments={appointments.map((appointment) => ({
        id: appointment.id,
        serviceId: appointment.serviceId,
        serviceName: appointment.service.name,
        serviceLocation: appointment.service.location,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        timezone: appointment.timezone,
        partySize: appointment.partySize,
        status: appointment.status,
        source: appointment.source,
        notes: appointment.notes,
      }))}
    />
  )
}
