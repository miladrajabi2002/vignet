import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { listCourses } from '@/lib/courses/service'
import { CoursesWorkspace } from '@/components/courses/courses-workspace'
import { courseFromApi } from '@/components/courses/course-model'

export const dynamic = 'force-dynamic'

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>
}) {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const { course } = await searchParams
  // Before the migration lands the table is missing: show the empty state.
  const courses = await listCourses(user.workspaceId).catch(() => [])

  return (
    <CoursesWorkspace
      locale={locale}
      initialCourses={courses.map((row) => courseFromApi(JSON.parse(JSON.stringify(row)) as Record<string, unknown>))}
      initialRosterId={course}
    />
  )
}
