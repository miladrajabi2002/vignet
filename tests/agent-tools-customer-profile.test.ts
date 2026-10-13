import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAppointment: vi.fn(),
  enrollInCourse: vi.fn(),
  recordConfirmedCustomer: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { service: { findMany: vi.fn(async () => [{ id: 'service-1', name: 'مشاوره' }]) } },
}))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))
vi.mock('@/lib/crm/confirmed-customer', () => ({ recordConfirmedCustomer: mocks.recordConfirmedCustomer }))
vi.mock('@/lib/bookings/service', () => ({
  agentAppointmentScope: vi.fn(),
  createAppointment: mocks.createAppointment,
  explainUnavailableDate: vi.fn(),
  findNextAvailableSlots: vi.fn(),
  listAvailableSlots: vi.fn(),
  listBookingServices: vi.fn(),
  notifyAppointmentCancellation: vi.fn(),
  rescheduleAppointment: vi.fn(),
}))
vi.mock('@/lib/courses/service', () => {
  class CourseError extends Error {
    constructor(public readonly code: string) {
      super(code)
    }
  }
  return {
    CourseError,
    enrollInCourse: mocks.enrollInCourse,
    enrollmentOpen: vi.fn(),
    listCustomerEnrollments: vi.fn(),
    listOpenCoursesForAgent: vi.fn(),
    setEnrollmentStatus: vi.fn(),
  }
})

import { executeBookingAgentTool } from '@/lib/bookings/agent-tools'
import { executeCourseAgentTool } from '@/lib/courses/agent-tools'

const booking = {
  serviceId: 'service-1',
  localDate: '2026-11-02',
  startMinute: 600,
  customerName: 'علی رضایی',
  customerPhone: '09123456789',
}

describe('details given while booking or enrolling reach the CRM profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.recordConfirmedCustomer.mockResolvedValue('contact-1')
    mocks.createAppointment.mockResolvedValue({
      created: true,
      appointment: {
        startsAt: new Date('2026-11-02T06:30:00.000Z'),
        timezone: 'Asia/Tehran',
        status: 'CONFIRMED',
        service: { name: 'مشاوره', location: null },
      },
    })
    mocks.enrollInCourse.mockResolvedValue({
      created: true,
      enrollment: { status: 'PENDING' },
      waitlistPosition: null,
      course: { title: 'دوره عکاسی' },
      seats: { left: 4 },
    })
  })

  it('a chat booking records the name and phone on the customer of that chat', async () => {
    const result = await executeBookingAgentTool({
      workspaceId: 'workspace-1',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      name: 'create_appointment',
      arguments: booking,
    })

    expect(result).toMatchObject({ ok: true, created: true })
    expect(mocks.recordConfirmedCustomer).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
      name: 'علی رضایی',
      phone: '+989123456789',
      source: 'booking',
    })
  })

  it('a booking still succeeds when the profile write fails', async () => {
    mocks.recordConfirmedCustomer.mockRejectedValue(new Error('db down'))

    const result = await executeBookingAgentTool({
      workspaceId: 'workspace-1',
      contactId: null,
      conversationId: 'conv-1',
      name: 'create_appointment',
      arguments: booking,
    })

    expect(result).toMatchObject({ ok: true })
    expect(mocks.captureError).toHaveBeenCalledWith('bookings:customer-profile-sync', expect.any(Error), { workspaceId: 'workspace-1' })
  })

  it('a booking with no chat behind it writes no profile', async () => {
    await executeBookingAgentTool({ workspaceId: 'workspace-1', name: 'create_appointment', arguments: booking })
    expect(mocks.recordConfirmedCustomer).not.toHaveBeenCalled()
  })

  it('a chat enrollment records the name and phone, attaching a chat that had no customer', async () => {
    const result = await executeCourseAgentTool({
      workspaceId: 'workspace-1',
      contactId: null,
      conversationId: 'conv-1',
      name: 'enroll_in_course',
      arguments: { courseId: 'course-1', customerName: 'سارا احمدی', customerPhone: '09123456789' },
      isFa: true,
    })

    expect(result).toMatchObject({ ok: true, created: true })
    expect(mocks.recordConfirmedCustomer).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      contactId: null,
      name: 'سارا احمدی',
      phone: '+989123456789',
      source: 'course',
    })
  })
})
