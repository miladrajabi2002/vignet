import { NextResponse } from 'next/server'
import { signOut } from '@/auth'

export const dynamic = 'force-dynamic'

/**
 * Force-logout endpoint — the "panic button" for stuck sessions.
 *
 * WHY THIS EXISTS
 * ───────────────
 * If a user's row is deleted from the database (e.g. by an admin or by the
 * user themselves via the DB), their JWT cookie remains cryptographically
 * valid until it expires. The middleware's `authorized` callback trusts the
 * JWT signature and lets them into protected pages, but `requireUser()`
 * then looks the user up in the DB, finds nothing, and redirects to
 * `/login`. The middleware sees the JWT is valid again and bounces back to
 * `/overview`. → INFINITE REDIRECT LOOP. The user can't reach the dashboard
 * (where the logout button lives) and can't reach /login (which redirects
 * them back to /overview).
 *
 * Clearing cookies via browser DevTools sometimes fixes this, but the
 * `__Host-` and `__Secure-` prefixed cookies are easy to miss, and a
 * service-worker or browser-history redirect can re-trigger the loop.
 *
 * USAGE
 * ─────
 * The user can hit this URL directly in the browser address bar:
 *
 *     https://vigent.ir/api/auth/force-logout
 *
 * It calls `signOut()` which properly clears all NextAuth cookies via
 * Set-Cookie headers, then redirects to `/login` where the (now-cleared)
 * session allows the login form to render normally.
 *
 * SUPPORTS BOTH GET AND POST
 * ──────────────────────────
 * GET  — so the user can type it in the URL bar.
 * POST — so it can be called from a server action or fetch() call.
 *
 * The endpoint is NOT protected by middleware (it's not in any PROTECTED_
 * PREFIXES and not in the middleware matcher), so it's reachable even when
 * the rest of the app is in a redirect loop.
 */
export async function GET() {
        return doSignOut()
}

export async function POST() {
        return doSignOut()
}

async function doSignOut() {
        // signOut() in NextAuth v5 returns a Redirect response (to the
        // configured signOut page or `/` by default). We pass `redirectTo`
        // so the user lands on the login form, ready to sign in again.
        //
        // We wrap in try/catch because NextAuth throws a NEXT_REDIRECT
        // control-flow error internally — that's expected and resolves to
        // the actual redirect response. We re-throw it; otherwise we fall
        // through to the fallback redirect below.
        try {
                // signOut returns a Response that sets the cookie-clearing
                // headers + a redirect. Returning it directly preserves
                // those headers (which is the whole point — we need the
                // cookies to be cleared on the client).
                return await signOut({ redirectTo: '/login', redirect: true }) as unknown as Response
        } catch (e) {
                // NEXT_REDIRECT is thrown as a control-flow signal — when
                // signOut is configured with redirect:true it throws a
                // redirect that Next.js turns into the actual HTTP
                // redirect. Re-throw so Next can handle it.
                if (e instanceof Error && (e as Error & { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
                        throw e
                }
                // Genuine error — log and fall back to a manual redirect.
                // The cookies may not have been cleared properly in this
                // case, but at least the user lands on /login where they
                // can clear cookies manually if needed.
                console.error('[force-logout] signOut failed:', e)
                return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'))
        }
}
