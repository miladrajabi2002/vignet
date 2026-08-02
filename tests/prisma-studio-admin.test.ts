import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolvePrismaStudioUrl } from '@/lib/admin/prisma-studio'

describe('owner-only Prisma Studio', () => {
  it('uses the explicitly configured HTTPS URL in production', () => {
    const url = resolvePrismaStudioUrl({
      NODE_ENV: 'production',
      PRISMA_STUDIO_URL: 'https://db.example.com:9443',
    })

    expect(url?.toString()).toBe('https://db.example.com:9443/')
  })

  it('rejects an insecure production URL', () => {
    const url = resolvePrismaStudioUrl({
      NODE_ENV: 'production',
      PRISMA_STUDIO_URL: 'http://example.com:8443',
    })

    expect(url).toBeNull()
  })

  it('derives the dedicated HTTPS port from the canonical app URL', () => {
    const url = resolvePrismaStudioUrl({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://vigent.example/some/path?ignored=1',
    })

    expect(url?.toString()).toBe('https://vigent.example:8443/')
  })

  it('uses local Prisma Studio during development', () => {
    const url = resolvePrismaStudioUrl({ NODE_ENV: 'development' })
    expect(url?.toString()).toBe('http://127.0.0.1:5555/')
  })

  it('keeps Studio loopback-only and gates nginx with the admin session', () => {
    const ecosystem = readFileSync(path.join(process.cwd(), 'deploy/ecosystem.config.js'), 'utf8')
    const setup = readFileSync(path.join(process.cwd(), 'deploy/setup-db-studio.sh'), 'utf8')
    const nav = readFileSync(path.join(process.cwd(), 'app/admin/(dash)/admin-nav.tsx'), 'utf8')

    expect(ecosystem).toContain('"127.0.0.1"')
    expect(ecosystem).toContain('name: "vignet-studio"')
    expect(setup).toContain('auth_request /_vignet_admin_auth')
    expect(setup).toContain('/api/admin/studio-auth')
    expect(nav).toContain("target={openInNewTab ? '_blank' : undefined}")
  })
})
