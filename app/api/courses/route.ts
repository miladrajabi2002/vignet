import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { courseInputSchema } from '@/lib/courses/validation'
import { createCourse, listCourses } from '@/lib/courses/service'
import { courseErrorResponse } from '@/lib/courses/http'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return NextResponse.json({ courses: await listCourses(user.workspaceId) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  try {
    const input = courseInputSchema.parse(await request.json().catch(() => null))
    return NextResponse.json({ course: await createCourse(user.workspaceId, input) }, { status: 201 })
  } catch (error) {
    return courseErrorResponse(error)
  }
}
