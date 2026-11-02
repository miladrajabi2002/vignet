import { NextResponse, type NextRequest } from 'next/server'

/**
 * The dashboard lives on its own host (panel.vigent.ir) so the installed PWA,
 * its service worker and its push subscriptions belong to the panel alone,
 * not to the marketing site. vigent.ir keeps the site, webhooks, payment
 * callbacks and the public chat pages.
 *
 * Both hosts share one session: the Auth.js cookie is written for the parent
 * domain (AUTH_COOKIE_DOMAIN=.vigent.ir). Sessions issued before that change
 * are host-only cookies on vigent.ir; the first dashboard visit there copies
 * them to the parent domain and removes the host-only copy, then redirects —
 * nobody is logged out by the move, and a later logout clears the only copy.
 *
 * Unset PANEL_ORIGIN (local development) and nothing changes.
 *
 * Edge-safe: no Node APIs, used by middleware and auth.config.
 */

const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60 // Auth.js default session lifetime

export function panelOrigin(): URL | null {
  const raw = process.env.PANEL_ORIGIN?.trim()
  if (!raw) return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

export function sessionCookieDomain(): string | undefined {
  return process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined
}

export function sessionCookieName(): string {
  return `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}authjs.session-token`
}

function requestHost(req: NextRequest): string {
  return (req.headers.get('host') ?? req.nextUrl.host).toLowerCase()
}

export function isPanelHost(req: NextRequest): boolean {
  const panel = panelOrigin()
  return !!panel && requestHost(req) === panel.host.toLowerCase()
}

/**
 * A dashboard page (or /login) opened on the main site: send it to the panel
 * with the session carried over. API calls are never redirected.
 */
export function redirectToPanel(req: NextRequest, isDashboardPath: (path: string) => boolean): NextResponse | null {
  const panel = panelOrigin()
  if (!panel || isPanelHost(req)) return null
  if (req.method !== 'GET' && req.method !== 'HEAD') return null
  const { pathname, search } = req.nextUrl
  if (pathname.startsWith('/api/')) return null
  if (pathname !== '/login' && !pathname.startsWith('/login/') && !isDashboardPath(pathname)) return null

  const target = new URL(`${pathname}${search}`, panel)
  const res = NextResponse.redirect(target, 307)
  const domain = sessionCookieDomain()
  if (!domain) return res

  const name = sessionCookieName()
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const rawNames = (req.headers.get('cookie') ?? '').split(';').map((part) => part.split('=')[0]?.trim())
  for (const cookie of req.cookies.getAll()) {
    // Auth.js splits a large JWT into name.0, name.1, …
    if (cookie.name !== name && !cookie.name.startsWith(`${name}.`)) continue
    // Sent twice means a parent-domain copy already exists next to an older
    // host-only one: keep the parent-domain session, only drop the old twin.
    if (rawNames.filter((raw) => raw === cookie.name).length === 1) {
      res.headers.append(
        'Set-Cookie',
        `${cookie.name}=${cookie.value}; Domain=${domain}; Path=/; Max-Age=${SESSION_MAX_AGE_S}; HttpOnly; SameSite=Lax${secure}`,
      )
    }
    // The host-only twin (no Domain attribute) is a separate cookie: drop it.
    res.headers.append('Set-Cookie', `${cookie.name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`)
  }
  return res
}
