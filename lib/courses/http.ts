import { NextResponse } from 'next/server'
import { z } from 'zod'
import { CourseError } from '@/lib/courses/service'

const STATUS: Record<CourseError['code'], number> = {
  NOT_FOUND: 404,
  NOT_OPEN: 409,
  DEADLINE_PASSED: 409,
  FULL: 409,
  CONTACT_NOT_FOUND: 400,
  CUSTOMER_LIMIT: 402,
  HAS_ACTIVE_ENROLLMENTS: 409,
  INVALID_SESSIONS: 400,
}

export function courseErrorResponse(error: unknown) {
  if (error instanceof CourseError) return NextResponse.json({ error: error.code }, { status: STATUS[error.code] })
  if (error instanceof z.ZodError) return NextResponse.json({ error: 'INVALID', issues: error.flatten() }, { status: 400 })
  throw error
}
