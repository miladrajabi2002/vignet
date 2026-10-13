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

  it('explains the temporary Meta role step before Instagram OAuth', () => {
    const instagram = source('components/channels/instagram-connect-wizard.tsx')

    expect(instagram).toContain('App Roles / Testers')
    expect(instagram).toContain('این پیام نشانه مشکل امنیتی پیج شما نیست')
    expect(instagram).toContain('پیج اضافه شده؛ اتصال')
    expect(instagram).toContain('SUPPORT_TELEGRAM_URL')
    // Support is reachable by a visible Telegram username, a call or an SMS.
    expect(instagram).toContain('@{SUPPORT_TELEGRAM_USERNAME}')
    expect(instagram).toContain('href={`tel:${SUPPORT_PHONE_E164}`}')
    expect(instagram).toContain('href={`sms:${SUPPORT_PHONE_E164}`}')
  })

  it('shows connections as cards that open in a side sheet', () => {
    const page = source('app/(dashboard)/agents/[agentId]/channels/page.tsx')
    const board = source('components/channels/channel-board.tsx')

    expect(page).toContain('<ChannelBoard items={channelItems} initialOpen={initialOpen} />')
    expect(board).toContain('<SideSheet')
    // One state vocabulary for every connection.
    for (const key of ['statusOn', 'statusOff', 'statusAttention', 'statusPaused']) expect(board).toContain(key)
    expect(existsSync(path.join(root, 'components/channels/channel-mobile-sections.tsx'))).toBe(false)
  })

  it('never opens a connection onto an empty sheet', () => {
    const board = source('components/channels/channel-board.tsx')
    const widget = source('components/channels/web-widget-channel.tsx')

    // Every connection shows the thing itself beside its controls — also
    // before it is connected, when there is nothing else to show.
    for (const file of [
      'components/channels/web-widget-channel.tsx',
      'components/channels/messenger-channel.tsx',
      'components/channels/chat-link-channel.tsx',
    ]) {
      expect(source(file), file).toContain('<ChannelLayout')
    }
    // The sheet is as wide as its content, and its header says which
    // connection this is and how it is doing.
    expect(board).toContain('SHEET_WIDTH[open.size]')
    expect(board).toContain('icon={open.mark}')
    // On a phone the widget preview is a tab, not a scroll past the form.
    expect(widget).toContain("t('widgetTabPreview')")
  })

  it('asks before disconnecting any connection', () => {
    for (const file of [
      'components/channels/web-widget-channel.tsx',
      'components/channels/messenger-channel.tsx',
      'components/channels/chat-link-channel.tsx',
    ]) {
      expect(source(file)).toContain('<ConfirmDialog')
    }
  })

  it('publishes a chat link on create and never shares an unsaved address', () => {
    const chatLink = source('components/channels/chat-link-channel.tsx')

    // «ساخت لینک» is the publish step; there is no second one to forget.
    expect(chatLink).not.toContain("t('publish')")
    expect(chatLink).toContain("body: JSON.stringify({ slug: candidate, enabled: true, settings })")
    // Copy / open / QR are built from the saved slug, not the draft input.
    expect(chatLink).toContain('const publicUrl = `${origin}/c/${link?.slug ?? \'\'}`')
    expect(chatLink).toContain('useAutoSave({')
  })
})
