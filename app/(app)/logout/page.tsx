import Link from 'next/link'
import { signOut } from '@/auth'

export const dynamic = 'force-dynamic'

/**
 * /logout — server-side logout page.
 *
 * Renders only briefly (or not at all) before calling signOut. This page
 * exists so we have a stable, predictable URL that always logs the user out
 * — used by the dashboard header's logout form (server action) and as a
 * fallback entry point if anyone bookmarks it.
 *
 * Visiting /logout in the browser immediately signs the user out and
 * redirects to /login. The page itself is mostly a server component — no
 * UI is rendered in the happy path because the redirect happens before
 * React even starts streaming.
 *
 * If for any reason signOut doesn't redirect (shouldn't happen, but
 * defensive), we render a minimal HTML page with a manual link to
 * /api/auth/force-logout as a last resort.
 */
export default async function LogoutPage() {
  // signOut throws a NEXT_REDIRECT control-flow error that Next.js turns
  // into an HTTP redirect. We catch it just to be safe — if it actually
  // completes without throwing, we render the fallback page below.
  try {
    await signOut({ redirectTo: '/login', redirect: true })
    // Unreachable in normal flow — signOut throws NEXT_REDIRECT.
    return null
  } catch (e) {
    if (e instanceof Error && (e as Error & { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
      // This is the expected NEXT_REDIRECT — re-throw so Next can turn it
      // into the actual HTTP redirect response.
      throw e
    }
    // Genuine error — render a fallback page so the user isn't stuck on
    // a blank screen. They can click the link below to force-logout.
    console.error('[logout] signOut failed:', e)
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, "IRANSansWeb", sans-serif',
        background: '#fafafa',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          textAlign: 'center',
          maxWidth: '24rem',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111' }}>
          خروج از حساب
        </h1>
        <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6 }}>
          خطایی در خروج خودکار رخ داد. برای خروج کامل، روی لینک زیر بزنید:
        </p>
        {/*
          We use <Link> with prefetch={false} instead of a plain <a>:
          • Satisfies the @next/next/no-html-link-for-pages ESLint rule.
          • CRITICAL: prefetch={false} prevents Next from fetching the
            /api/auth/force-logout route on hover/focus — that route clears
            the session cookie, so a default-prefetch Link would log the
            user out the moment their cursor grazed the link. With
            prefetch={false}, the route is only hit on an actual click.
        */}
        <Link
          href="/api/auth/force-logout"
          prefetch={false}
          style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            padding: '0.75rem 1.5rem',
            background: '#000',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          خروج اجباری
        </Link>
      </div>
    </div>
  )
}
