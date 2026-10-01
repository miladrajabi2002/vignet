import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  listAppointmentsForDate,
  listBookingServices,
} from '@/lib/bookings/service'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import { getDashboardModuleLabel } from '@/lib/verticals/registry'
import { remindersFromMetadata } from '@/components/bookings/booking-model'
import { AppointmentsWorkspace } from '@/components/bookings/appointments-workspace'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; edit?: string }>
}) {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const today = dateKeyInTimeZone(new Date(), 'Asia/Tehran')
  const { tab, edit } = await searchParams

  const [workspace, services, appointments] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: user.workspaceId }, select: { businessType: true, bookingRemindersEnabled: true } }),
    listBookingServices(user.workspaceId),
    listAppointmentsForDate({ workspaceId: user.workspaceId, dateKey: today }),
  ])

  // Same label the sidebar shows, so the page and the menu never disagree.
  const title = getDashboardModuleLabel(
    'appointments',
    workspace?.businessType,
    locale,
    locale === 'fa' ? 'رزروها و خدمات' : 'Bookings & services',
  )

  return (
    <AppointmentsWorkspace
      locale={locale}
      title={title}
      initialTab={tab === 'services' || edit ? 'services' : 'schedule'}
      initialEditId={edit}
      initialDate={today}
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
        price: service.price,
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
        contactId: appointment.contactId,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        timezone: appointment.timezone,
        partySize: appointment.partySize,
        status: appointment.status,
        source: appointment.source,
        notes: appointment.notes,
        reminders: remindersFromMetadata(appointment.metadata),
      }))}
      remindersEnabled={workspace?.bookingRemindersEnabled ?? true}
    />
  )
}
