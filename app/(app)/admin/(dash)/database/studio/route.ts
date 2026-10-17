import { NextResponse } from 'next/server'
import { isAdminAuthedRequest } from '@/lib/admin/auth'
import { resolvePrismaStudioUrl } from '@/lib/admin/prisma-studio'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await isAdminAuthedRequest(request))) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const studioUrl = resolvePrismaStudioUrl()
  if (!studioUrl) {
    return NextResponse.redirect(new URL('/admin/database?studio=unavailable', request.url))
  }

  const response = NextResponse.redirect(studioUrl)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
