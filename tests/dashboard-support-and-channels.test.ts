import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('dashboard support and channel alert destinations', () => {
  it('keeps support reachable from the global dashboard header', () => {
    const header = source('components/dashboard/header.tsx')
    const support = source('components/dashboard/support-button.tsx')

    expect(header).toContain('<SupportButton />')
    expect(support).toContain('SUPPORT_TELEGRAM_URL')
    expect(support).toContain('SUPPORT_PHONE_DISPLAY')
  })

  it('links new channel health alerts to their agent and redirects legacy links', () => {
    const health = source('lib/channels/health.ts')
    const legacyRoute = source('app/(dashboard)/channels/page.tsx')

    expect(health).toContain('link: `/agents/${ch.agent.id}/channels`')
    expect(health).not.toContain("link: '/channels'")
    expect(legacyRoute).toContain('redirect(agent ? `/agents/${agent.id}/channels` : \'/agents\')')
  })
})
