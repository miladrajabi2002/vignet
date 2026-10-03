import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

const SAVE_FORMS = [
  'components/agents/agent-settings-form.tsx',
  'components/channels/messenger-channel.tsx',
  'components/channels/web-widget-channel.tsx',
  'components/channels/chat-link-channel.tsx',
  'components/settings/weekly-report-card.tsx',
  'components/settings/business-settings.tsx',
  'components/menu/menu-design.tsx',
  'components/crm/contact-detail.tsx',
  'components/crm/operator-channel-setup.tsx',
  'components/products/product-form.tsx',
  'components/instagram/automation-form.tsx',
  'components/admin/platform-settings-form.tsx',
  'components/admin/ai-model-policy-form.tsx',
]

describe('one save feel across the panels', () => {
  it('routes every in-place save through the shared SaveButton', () => {
    for (const path of SAVE_FORMS) {
      const file = source(path)
      expect(file, path).toContain("from '@/components/ui/save-button'")
      expect(file, path).toContain('<SaveButton')
      expect(file, path).toContain('useSaveState()')
    }
  })

  it('keeps the button width steady and confirms with a drawn check', () => {
    const button = source('components/ui/save-button.tsx')
    const css = source('app/ui-system.css')
    expect(button).toContain('ui-save-label')
    expect(button).toContain('ui-save-check')
    expect(button).toContain('aria-live="polite"')
    expect(css).toContain('.ui-save-label > span')
    expect(css).toContain('@keyframes ui-save-check')
    // A "saved" button is disabled but must not fall back to the muted look.
    expect(css).toContain(":not([data-save-state='saved'])")
  })
})

describe('mobile motion in the user panel', () => {
  it('keeps dashboard loops running on phones instead of resting after one cycle', () => {
    const pauser = source('components/marketing/site/motion-pauser.tsx')
    expect(pauser).toContain("const HERO = '[data-vg-hero], #dashboard-main'")
  })
})

describe('admin panel way back', () => {
  it('offers a return to the user dashboard and keeps logout in the menus', () => {
    const header = source('app/admin/(dash)/admin-header.tsx')
    const rail = source('app/admin/(dash)/admin-nav.tsx')
    const mobileNav = source('app/admin/(dash)/mobile-nav.tsx')
    expect(header).toContain('href="/overview"')
    expect(header).toContain('بازگشت به پنل کاربر')
    expect(header).toContain('action={adminLogout}')
    expect(rail).toContain('action={adminLogout}')
    expect(mobileNav).toContain('action={adminLogout}')
  })
})
