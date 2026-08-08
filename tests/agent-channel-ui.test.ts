import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('agent channel UI', () => {
  it('keeps Instagram connection in the channel list without the service setup interstitial', () => {
    const page = source('app/(dashboard)/agents/[agentId]/channels/page.tsx')

    expect(page).not.toContain('InstagramServiceSetup')
    expect(page).not.toContain('instagramServiceActive')
    expect(
      existsSync(path.join(root, 'components/channels/instagram-service-setup.tsx')),
    ).toBe(false)
  })

  it('removes WhatsApp connection surfaces', () => {
    const page = source('app/(dashboard)/agents/[agentId]/channels/page.tsx')
    const messenger = source('components/channels/messenger-channel.tsx')
    const migration = source('prisma/migrations/20260808120000_account_cascade_retention_admin_mailbox/migration.sql')

    expect(page).not.toContain('WHATSAPP')
    expect(messenger).not.toContain('WHATSAPP')
    expect(existsSync(path.join(root, 'components/channels/whatsapp-connect-wizard.tsx'))).toBe(false)
    expect(existsSync(path.join(root, 'app/api/webhook/whatsapp/route.ts'))).toBe(false)
    expect(migration).toContain(`DELETE FROM "AgentChannel" WHERE "type" = 'WHATSAPP'`)
  })

  it('portals the Instagram VPN warning above dashboard stacking contexts', () => {
    const instagram = source('components/channels/instagram-connect-wizard.tsx')

    expect(instagram).toContain('createPortal(')
    expect(instagram).toContain('z-[1000]')
    expect(instagram).toContain('document.body')
    expect(instagram).toContain('aria-modal="true"')
  })

  it('keeps large connection editors collapsed by default', () => {
    const widget = source('components/channels/web-widget-channel.tsx')
    const chatLink = source('components/channels/chat-link-channel.tsx')

    expect(widget).toContain('const [detailsOpen, setDetailsOpen] = useState(false)')
    expect(chatLink).toContain('const [showSettings, setShowSettings] = useState(false)')
  })
})
