import { cookies } from 'next/headers'
import { isLocale, LOCALE_COOKIE } from '@/lib/locale'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'Expected application/json' }, { status: 415 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const locale =
    typeof payload === 'object' && payload !== null && 'locale' in payload
      ? (payload as { locale?: unknown }).locale
      : undefined

  if (typeof locale !== 'string' || !isLocale(locale)) {
    return Response.json({ error: 'Unsupported locale' }, { status: 400 })
  }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })

  return Response.json(
    { locale },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
