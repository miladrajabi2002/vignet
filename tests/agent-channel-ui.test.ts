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

  it('renders connected WhatsApp identities without an at-sign prefix', () => {
    const messenger = source('components/channels/messenger-channel.tsx')

    expect(messenger).toContain("botUsername.replace(/^@+/, '')")
    expect(messenger).toContain("type === 'WHATSAPP' ? t('msgrQuickRepliesLabel')")
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
