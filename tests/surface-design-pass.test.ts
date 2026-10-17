import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')

describe('web widget layout tiers', () => {
  const widget = source('public/widget/loader.src.js')

  it('keeps the full-screen sheet for phones only and docks the panel on tablets', () => {
    expect(widget).toContain("'@media (max-width:600px){'")
    expect(widget).toContain("'@media (min-width:601px) and (max-width:1024px){'")
    expect(widget).toContain("window.matchMedia('(max-width: 600px)').matches")
    expect(widget).toContain("window.matchMedia('(min-width: 601px) and (max-width: 1024px)').matches")
    // The sheet rules must not leak back into the 768px touch-sizing block.
    const touch = widget.slice(
      widget.indexOf("'@media (max-width:768px){'"),
      widget.indexOf("'@media (max-width:600px){'"),
    )
    expect(touch).not.toContain('.vgt-panel{')
    expect(touch).not.toContain('.vgt-backdrop')
  })

  it('locks the host page only under the full-screen sheet', () => {
    expect(widget).toMatch(/if \(isSheet\(\)\) \{\s*lockBodyScroll\(\)/)
  })

  it('lets the product rail and the teaser follow a right-to-left language', () => {
    expect(widget).toContain("'.vgt-root.vgt-rtl .vgt-rail-shell{direction:rtl;}'")
    expect(widget).toContain("'.vgt-root.vgt-rtl .vgt-teaser{direction:rtl;}'")
  })

  it('labels the lead fields and themes the error colours', () => {
    expect(widget).toContain("nameLabel.htmlFor = 'vgt-lead-name'")
    expect(widget).toContain("phoneLabel.htmlFor = 'vgt-lead-phone'")
    expect(widget).toContain("s.setProperty('--vgt-danger', dark ? '#fecaca' : '#b91c1c')")
    expect(widget).not.toContain('color:#b91c1c')
  })

  it('uses the shared elevation tokens instead of pure-black shadows', () => {
    expect(widget).toContain('box-shadow:var(--vgt-elev-1)')
    expect(widget).not.toContain('rgba(0,0,0,.34)')
  })

  it('ships the new tiers in the minified artifact', () => {
    const built = source('public/widget/loader.js')
    expect(built).toContain('@media (max-width:600px){')
    expect(built).toContain('@media (min-width:601px) and (max-width:1024px){')
    expect(built).toContain('.vgt-root.vgt-rtl .vgt-rail-shell{direction:rtl;}')
  })
})

describe('chat link page', () => {
  const page = source('app/(app)/c/[slug]/chat-client.tsx')

  it('does not point at a form "below" while the lead form sits above', () => {
    expect(page).not.toContain('اطلاعات زیر را وارد کنید')
  })

  it('puts the bubble tail after the radius so tailwind-merge keeps it', () => {
    expect(page).toContain("rounded-[20px] px-4 text-[15px] leading-7 ${isUser ? 'rounded-ee-[6px]' : 'rounded-es-[6px]'}")
    expect(page).not.toContain('rounded-3xl px-4')
  })

  it('labels both lead fields', () => {
    expect(page).toContain('htmlFor="cl-lead-name"')
    expect(page).toContain('htmlFor="cl-lead-phone"')
  })
})

describe('WooCommerce plugin admin page', () => {
  const admin = source('wordpress-plugin/vigent-woo/includes/class-vigent-woo-admin.php')

  it('lays the three stats out on three columns', () => {
    expect(admin).toContain('.vg-stats { display: grid; grid-template-columns: repeat(3, 1fr);')
    expect(admin).not.toContain('repeat(4, 1fr)')
    expect(admin.match(/<div class="vg-stat">/g)).toHaveLength(3)
  })

  it('keeps disconnect out of the header and after the page content', () => {
    const button = admin.indexOf('class="vg-btn-disconnect" onclick="vgDisconnect(this)"')
    expect(button).toBeGreaterThan(admin.indexOf('$this->render_debug_log_card();'))
    expect(admin).not.toContain('.vg-header .vg-btn-disconnect')
  })

  it('shows the connect steps before the connect button', () => {
    const connect = admin.slice(admin.indexOf('private function render_connect_step'))
    expect(connect.indexOf('vg-center-steps')).toBeLessThan(connect.indexOf('vgConnect(this)'))
  })
})
