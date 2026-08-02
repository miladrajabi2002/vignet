import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

/** Internal nginx auth_request target for the separate Prisma Studio origin. */
export async function GET() {
  const response = new NextResponse(null, {
    status: (await isAdminAuthed()) ? 204 : 401,
  })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
