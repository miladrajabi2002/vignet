import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ENROLLMENT_STATUSES } from '@/lib/courses/validation'
import { promoteWaitlist, setEnrollmentStatus, SEAT_STATUSES } from '@/lib/courses/service'
import { courseErrorResponse } from '@/lib/courses/http'

type Props = { params: Promise<{ enrollmentId: string }> }

const schema = z.object({ status: z.enum(ENROLLMENT_STATUSES) })

export async function PATCH(request: Request, props: Props) {
  const { enrollmentId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  try {
    const { status } = schema.parse(await request.json().catch(() => null))
    return NextResponse.json({ enrollment: await setEnrollmentStatus(user.workspaceId, enrollmentId, status) })
  } catch (error) {
    return courseErrorResponse(error)
  }
}

/** Remove a record for good (a mistaken entry); its seat goes to the waitlist. */
export async function DELETE(_request: Request, props: Props) {
  const { enrollmentId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const enrollment = await prisma.courseEnrollment.findFirst({ where: { id: enrollmentId, workspaceId: user.workspaceId }, select: { id: true, courseId: true, status: true } })
  if (!enrollment) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  await prisma.courseEnrollment.delete({ where: { id: enrollment.id } })
  if (SEAT_STATUSES.includes(enrollment.status)) await promoteWaitlist(user.workspaceId, enrollment.courseId)
  return NextResponse.json({ ok: true })
}
