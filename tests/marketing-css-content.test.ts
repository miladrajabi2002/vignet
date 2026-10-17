import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'
import { MARKETING_CONTENT } from '@/tailwind.marketing.config'

const root = process.cwd()
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return listSources(full)
    return /\.(tsx?|jsx?)$/.test(name) ? [full] : []
  })
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null
  if (!base) return null
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext
  return null
}

/** Every first-party file reachable from the public site's routes. */
function publicSiteFiles(): string[] {
  const queue = [
    ...listSources(path.join(root, 'app/(marketing)')),
    path.join(root, 'app/global-not-found.tsx'),
  ]
  const seen = new Set<string>()
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g)) {
      const resolved = resolveImport(file, match[1] ?? match[2] ?? match[3])
      if (resolved && /\.(tsx?|jsx?)$/.test(resolved)) queue.push(resolved)
    }
  }
  return [...seen].map((file) => path.relative(root, file))
}

describe('public-site stylesheet content', () => {
  it('scans every component and route a public page imports', () => {
    // lib/ holds no class names of its own (the app config does not scan it
    // either), so only component and route files must be covered.
    // fast-glob is what Tailwind uses to expand `content`.
    const scanned = new Set(fg.sync(MARKETING_CONTENT, { cwd: root }).map((file) => file.replace(/^\.\//, '')))
    const missing = publicSiteFiles()
      .filter((file) => !file.startsWith('lib/'))
      .filter((file) => !scanned.has(file))
    expect(missing, 'add these files to MARKETING_CONTENT in tailwind.marketing.config.ts').toEqual([])
  })
})

describe('public pages stay free of dashboard JavaScript', () => {
  it('the dashboard layout reaches shared marketing client components only through its own boundary', () => {
    // Next maps a client component shared by two route layouts to one of their
    // chunks; a direct import here made every public page download ~30 KB of
    // dashboard layout JS. components/dashboard/dashboard-page-effects.tsx is
    // the dashboard's own boundary for BackToTop and MotionPauser.
    const layout = readFileSync(path.join(root, 'app/(app)/(dashboard)/layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/from '@\/components\/marketing\//)
  })
})

describe('stylesheet entries', () => {
  it('compiles Tailwind only through entries that name their config', () => {
    // Tailwind's PostCSS plugin keeps the last `@config` path it saw and uses it
    // for every later file, so a stylesheet with @tailwind and no @config of
    // its own may be compiled with the public-site content list.
    for (const entry of ['app/app.css', 'app/marketing.css']) {
      expect(readFileSync(path.join(root, entry), 'utf8')).toMatch(/@config '\.\.\/tailwind\.(marketing\.)?config\.ts'/)
    }
    const code = [...listSources(path.join(root, 'app')), ...listSources(path.join(root, 'components'))]
    const direct = code.filter((file) => /import ['"][^'"]*(globals|tailwind-variants)\.css['"]/.test(readFileSync(file, 'utf8')))
    expect(direct.map((file) => path.relative(root, file))).toEqual([])
  })
})
