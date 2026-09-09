import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')

describe('web widget style isolation', () => {
  it('mounts styles, fonts, and UI inside a reset Shadow DOM host', () => {
    const widget = source('public/widget/loader.src.js')

    expect(widget).toContain("document.createElement('vigent-widget')")
    expect(widget).toContain("widgetHost.attachShadow({ mode: 'open' })")
    expect(widget).toContain("':host{all:initial!important;")
    expect(widget).toContain('if (widgetShadow) widgetShadow.appendChild(node)')
    expect(widget).toContain('widgetShadow.appendChild(root)')
    expect(widget).toContain('document.body.appendChild(widgetHost)')
    expect(widget).toContain(
      '.vgt-root button,.vgt-root textarea,.vgt-root input{margin:0;font-family:inherit;',
    )
    expect(widget).not.toContain('margin:0;font:inherit;')
  })

  it('keeps a light-DOM fallback for browsers without Shadow DOM', () => {
    const widget = source('public/widget/loader.src.js')

    expect(widget).toContain('if (widgetHost.attachShadow)')
    expect(widget).toContain('else document.head.appendChild(node)')
    expect(widget).toContain('document.body.appendChild(root)')
  })

  it('keeps text measurement inside the isolated widget tree', () => {
    const widget = source('public/widget/loader.src.js')

    expect(widget).toContain('root.appendChild(span)')
    expect(widget).not.toContain('document.body.appendChild(span)')
  })

  it('keeps the send control circular when a host theme styles button hover states', () => {
    const widget = source('public/widget/loader.src.js')

    expect(widget).toContain('.vgt-root .vgt-send{appearance:none;')
    expect(widget).toContain('border-radius:50%!important;cursor:pointer;')
    expect(widget).toContain(
      '.vgt-root .vgt-send:hover:not(:disabled){border-radius:50%!important;',
    )
  })

  it('keeps the send icon visible in the disabled and host-svg-reset states', () => {
    const widget = source('public/widget/loader.src.js')

    expect(widget).toContain('.vgt-root .vgt-send:disabled{opacity:1;')
    expect(widget).toContain('background:var(--vgt-accent-soft);color:var(--vgt-accent-ink);')
    expect(widget).toContain('.vgt-root .vgt-send svg{width:18px;height:18px;')
    expect(widget).toContain('fill:none;stroke:currentColor;')
    expect(widget).toContain('.vgt-send .vgt-send-spin{display:none!important;')
    expect(widget).toContain('.vgt-send.vgt-busy .vgt-send-arrow{display:none!important;}')
    expect(widget).toContain('.vgt-send.vgt-busy .vgt-send-spin{display:block!important;}')
    expect(widget).toContain('padding:7px;border-radius:50%;')
  })

  it('ships the isolated send styles in the minified artifact', () => {
    const built = source('public/widget/loader.js')

    expect(built).toContain('document.createElement("vigent-widget")')
    expect(built).toContain('attachShadow({mode:"open"})')
    expect(built).toContain(':host{all:initial!important')
    expect(built).toContain('.vgt-root .vgt-send')
    expect(built).toContain('border-radius:50%!important')
    expect(built).toContain('.vgt-send .vgt-send-spin{display:none!important')
  })
})
