import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { redirectToPanel } from '@/lib/auth/panel-host'

const isDashboard = (path: string) => path === '/overview' || path.startsWith('/conversations')

function request(url: string, cookie?: string, method = 'GET') {
  return new NextRequest(url, { method, headers: { host: new URL(url).host, ...(cookie ? { cookie } : {}) } })
}

describe('dashboard on panel.vigent.ir', () => {
  beforeEach(() => {
    process.env.PANEL_ORIGIN = 'https://panel.vigent.ir'
    process.env.AUTH_COOKIE_DOMAIN = '.vigent.ir'
  })
  afterEach(() => {
    delete process.env.PANEL_ORIGIN
    delete process.env.AUTH_COOKIE_DOMAIN
  })

  it('redirects dashboard pages and keeps the path and query', () => {
    const res = redirectToPanel(request('https://vigent.ir/conversations/abc?tab=1'), isDashboard)
    expect(res?.status).toBe(307)
    expect(res?.headers.get('location')).toBe('https://panel.vigent.ir/conversations/abc?tab=1')
  })

  it('leaves the site, APIs, posts and the panel itself alone', () => {
    expect(redirectToPanel(request('https://vigent.ir/pricing'), isDashboard)).toBeNull()
    expect(redirectToPanel(request('https://vigent.ir/api/agents/x'), isDashboard)).toBeNull()
    expect(redirectToPanel(request('https://vigent.ir/overview', undefined, 'POST'), isDashboard)).toBeNull()
    expect(redirectToPanel(request('https://panel.vigent.ir/overview'), isDashboard)).toBeNull()
  })

  it('moves a host-only session to the parent domain and drops the old copy', () => {
    const name = 'authjs.session-token' // NODE_ENV is test: no __Secure- prefix
    const res = redirectToPanel(request('https://vigent.ir/overview', `${name}=jwt-value`), isDashboard)
    const cookies = res?.headers.getSetCookie() ?? []
    expect(cookies.some((c) => c.startsWith(`${name}=jwt-value;`) && c.includes('Domain=.vigent.ir'))).toBe(true)
    expect(cookies.some((c) => c.startsWith(`${name}=;`) && c.includes('Max-Age=0') && !c.includes('Domain='))).toBe(true)
  })

  it('does nothing without PANEL_ORIGIN', () => {
    delete process.env.PANEL_ORIGIN
    expect(redirectToPanel(request('https://vigent.ir/overview'), isDashboard)).toBeNull()
  })
})
