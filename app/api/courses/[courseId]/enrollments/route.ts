import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { enrollmentInputSchema } from '@/lib/courses/validation'
import { enrollInCourse } from '@/lib/courses/service'
import { courseErrorResponse } from '@/lib/courses/http'

type Props = { params: Promise<{ courseId: string }> }

/** Staff adds someone to the roster (or the waitlist when full). */
export async function POST(request: Request, props: Props) {
  const { courseId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  try {
    const input = enrollmentInputSchema.parse(await request.json().catch(() => null))
    const result = await enrollInCourse(user.workspaceId, courseId, input, { source: 'dashboard' })
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (error) {
    return courseErrorResponse(error)
  }
}
