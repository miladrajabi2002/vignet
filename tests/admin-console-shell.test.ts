import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ADMIN_DIR = 'app/admin/(dash)'

function source(file: string) {
  return readFileSync(file, 'utf8')
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return tsxFiles(full)
    return full.endsWith('.tsx') ? [full] : []
  })
}

const ADMIN_UI_FILES = [
  ...tsxFiles('app/admin'),
  ...tsxFiles('components/admin'),
  'components/blog/admin-blog-manager.tsx',
  'components/showcase/admin-showcase-manager.tsx',
  'components/showcase/admin-trusted-logo-manager.tsx',
]

describe('owner console shell', () => {
  it('lists every admin page in the one navigation registry', () => {
    const nav = source(`${ADMIN_DIR}/nav-items.ts`)
    const sections = readdirSync(ADMIN_DIR).filter((name) => {
      const page = path.join(ADMIN_DIR, name, 'page.tsx')
      try {
        // Redirect-only routes (errors, notifications, workspaces) are not destinations.
        return statSync(page).isFile() && !/^\s*redirect\(/m.test(source(page))
      } catch {
        return false
      }
    })

    expect(sections.length).toBeGreaterThan(10)
    for (const section of sections) {
      // Vigento is the rail's own filled shortcut, not a list row.
      if (section === 'vigento') continue
      expect(nav, `/admin/${section} is missing from nav-items.ts`).toContain(`'/admin/${section}`)
    }
    expect(source(`${ADMIN_DIR}/admin-nav.tsx`)).toContain('href="/admin/vigento"')
    expect(source(`${ADMIN_DIR}/mobile-nav.tsx`)).toContain('href="/admin/vigento"')
  })

  it('drives the rail, the phone bar and its sheet from that registry', () => {
    const rail = source(`${ADMIN_DIR}/admin-nav.tsx`)
    const phone = source(`${ADMIN_DIR}/mobile-nav.tsx`)
    expect(rail).toContain('ADMIN_NAV_GROUPS')
    expect(phone).toContain('ADMIN_NAV_GROUPS')
    expect(phone).toContain('ADMIN_PRIMARY_HREFS')
    // Same bottom-sheet mechanics as the user dashboard: drag handle, no hamburger in the header.
    expect(phone).toContain('dashboard-more-sheet')
    expect(phone).toContain('onPointerDown={onDragStart}')
    expect(source(`${ADMIN_DIR}/layout.tsx`)).not.toContain('<Menu')
  })

  it('keeps ink and white primary with the iris signal as the only accent', () => {
    const css = source('app/globals.css')
    expect(css).toContain('--admin-accent: var(--signal, #5b3de8)')
    expect(css).not.toContain('--admin-accent: #0a84ff')

    for (const file of ADMIN_UI_FILES) {
      const text = source(file)
      // Shared tokens instead of Tailwind's cool greys, and no iOS blue.
      expect(text, `${file} uses a raw zinc utility`).not.toMatch(/\b(?:text|bg|border|divide|ring)-zinc-\d/)
      expect(text, `${file} uses a blue utility`).not.toMatch(/\b(?:text|bg|border|ring)-(?:blue|sky|indigo)-\d/)
      expect(text, `${file} hardcodes iOS blue`).not.toMatch(/#0a84ff|#2563eb|#3b82f6/i)
    }
  })

  it('has no motion graphics or decorative loops (those teach users, not the owner)', () => {
    for (const file of ADMIN_UI_FILES) {
      const text = source(file)
      expect(text, `${file} imports a motion explainer`).not.toMatch(/components\/motion\/|live-empty-state|vg-anim/)
      expect(text, `${file} runs a decorative loop`).not.toMatch(/animate-(?:ping|pulse|bounce)/)
    }
    // Charts paint instantly; recharts' mount animation stays off.
    for (const chart of ['components/admin/trend-chart.tsx', 'components/admin/sparkline.tsx', 'components/admin/server-stats-widget.tsx']) {
      const text = source(chart)
      expect(text).toContain('isAnimationActive={false}')
      expect(text).not.toMatch(/isAnimationActive(?!=\{false\})/)
    }
  })

  it('lets the page be the only vertical scroller of a data table', () => {
    const ui = source(`${ADMIN_DIR}/ui.tsx`)
    const shell = ui.slice(ui.indexOf('export function TableShell'), ui.indexOf('// ─── EMPTY STATE'))
    expect(shell).toContain('overflow-x-auto')
    expect(shell).not.toContain('max-h-')
    expect(shell).not.toContain('[scrollbar-width:thin]')
  })
})
