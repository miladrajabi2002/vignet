import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { courseUpdateSchema } from '@/lib/courses/validation'
import { courseDeleteImpact, deleteCourse, getCourse, updateCourse } from '@/lib/courses/service'
import { courseErrorResponse } from '@/lib/courses/http'

type Props = { params: Promise<{ courseId: string }> }

/** The course with sessions and roster; `?impact=1` answers what a delete removes. */
export async function GET(request: Request, props: Props) {
  const { courseId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (new URL(request.url).searchParams.get('impact') === '1') {
    const impact = await courseDeleteImpact(user.workspaceId, courseId)
    return impact ? NextResponse.json({ impact }) : NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  const course = await getCourse(user.workspaceId, courseId)
  return course ? NextResponse.json({ course }) : NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
}

export async function PATCH(request: Request, props: Props) {
  const { courseId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  try {
    const input = courseUpdateSchema.parse(await request.json().catch(() => null))
    return NextResponse.json({ course: await updateCourse(user.workspaceId, courseId, input) })
  } catch (error) {
    return courseErrorResponse(error)
  }
}

/** Refused while people are still signed up; archive the course instead. */
export async function DELETE(_request: Request, props: Props) {
  const { courseId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  try {
    const result = await deleteCourse(user.workspaceId, courseId)
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'HAS_ACTIVE_ENROLLMENTS', active: result.active }, { status: 409 })
  } catch (error) {
    return courseErrorResponse(error)
  }
}
